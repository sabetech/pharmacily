package worker

import (
	"context"
	"math/rand"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/pharmacily/api/internal/adapter"
	"github.com/pharmacily/api/internal/config"
	"github.com/pharmacily/api/internal/db"
	"github.com/robfig/cron/v3"
	"github.com/rs/zerolog/log"
)

type SyncWorker struct {
	queries    *db.Queries
	cfg        *config.Config
	adapterReg *adapter.AdapterRegistry
	cron       *cron.Cron
}

func NewSyncWorker(queries *db.Queries, cfg *config.Config, adapterReg *adapter.AdapterRegistry) *SyncWorker {
	return &SyncWorker{
		queries:    queries,
		cfg:        cfg,
		adapterReg: adapterReg,
		cron:       cron.New(cron.WithSeconds()),
	}
}

func (w *SyncWorker) Start(ctx context.Context) error {
	schedule := w.cfg.Worker.SyncCronSchedule
	if schedule == "" {
		schedule = "0 2 * * *"
	}

	_, err := w.cron.AddFunc(schedule, func() {
		w.runFullSync(ctx)
	})
	if err != nil {
		return err
	}

	_, err = w.cron.AddFunc("@every 1m", func() {
		w.processRetryQueue(ctx)
	})
	if err != nil {
		return err
	}

	w.cron.Start()
	log.Info().Str("schedule", schedule).Msg("Sync worker started")
	return nil
}

func (w *SyncWorker) Stop() {
	w.cron.Stop()
	log.Info().Msg("Sync worker stopped")
}

func (w *SyncWorker) runFullSync(ctx context.Context) {
	log.Info().Msg("Starting nightly full sync")

	configs, err := w.queries.GetEnabledPharmacyAPIConfigs(ctx)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get enabled pharmacy configs")
		return
	}

	for _, pc := range configs {
		w.syncPharmacy(ctx, pc)
	}

	log.Info().Msg("Nightly full sync completed")
}

func (w *SyncWorker) syncPharmacy(ctx context.Context, pc db.GetEnabledPharmacyAPIConfigsRow) {
	factory, ok := w.adapterReg.Get(pc.ApiType)
	if !ok {
		log.Warn().
			Str("pharmacy_id", pc.PharmacyID.String()).
			Str("api_type", pc.ApiType).
			Msg("No adapter registered for API type")
		w.updateSyncStatus(ctx, pc.PharmacyID, db.SyncStatusFailed, "No adapter for type: "+pc.ApiType)
		return
	}

	endpoint := ""
	if pc.Endpoint.Valid {
		endpoint = pc.Endpoint.String
	}

	credentialsRef := ""
	if pc.CredentialsRef.Valid {
		credentialsRef = pc.CredentialsRef.String
	}

	pharmacy := adapter.Pharmacy{
		ID:             pc.PharmacyID.String(),
		Name:           pc.PharmacyName,
		ChainID:        "",
		APIType:        pc.ApiType,
		Endpoint:       endpoint,
		CredentialsRef: credentialsRef,
		RateLimit:      w.cfg.Adapter.DefaultRateLimit,
		RequestTimeout: w.cfg.Adapter.RequestTimeout,
	}

	syncAdapter := factory(w.buildAdapterConfig(endpoint, credentialsRef))

	items, err := syncAdapter.FetchInventory(ctx, pharmacy)
	if err != nil {
		log.Error().
			Err(err).
			Str("pharmacy_id", pc.PharmacyID.String()).
			Msg("Failed to fetch inventory")
		w.updateSyncStatus(ctx, pc.PharmacyID, db.SyncStatusFailed, err.Error())
		w.addToRetryQueue(ctx, pc.PharmacyID, uuid.Nil, err.Error())
		return
	}

	// Convert to BulkUpsertInventory params
	params := make([]db.BulkUpsertInventoryParams, 0, len(items))
	for _, item := range items {
		// Look up drug by NDC
		drug, err := w.queries.GetDrugByNDC(ctx, item.DrugNDC)
		if err != nil {
			log.Warn().
				Str("ndc", item.DrugNDC).
				Msg("Drug not found in database, skipping")
			continue
		}

		priceCents := pgtype.Int4{Valid: false}
		if item.PriceCents != nil {
			priceCents = pgtype.Int4{Int32: int32(*item.PriceCents), Valid: true}
		}

		params = append(params, db.BulkUpsertInventoryParams{
			PharmacyID: pc.PharmacyID,
			DrugID:     drug.ID,
			Quantity:   int32(item.Quantity),
			PriceCents: priceCents,
			Source:     db.InventorySource(item.Source),
		})
	}

	if len(params) > 0 {
		for _, param := range params {
			err = w.queries.BulkUpsertInventory(ctx, param)
			if err != nil {
				log.Error().
					Err(err).
					Str("pharmacy_id", pc.PharmacyID.String()).
					Msg("Failed to upsert inventory item")
				w.updateSyncStatus(ctx, pc.PharmacyID, db.SyncStatusPartial, err.Error())
				return
			}
		}
	}

	w.updateSyncStatus(ctx, pc.PharmacyID, db.SyncStatusSuccess, "")
	log.Info().
		Str("pharmacy_id", pc.PharmacyID.String()).
		Int("items_synced", len(params)).
		Msg("Pharmacy sync completed")
}

func (w *SyncWorker) processRetryQueue(ctx context.Context) {
	items, err := w.queries.GetDueRetryQueue(ctx, 50)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get retry queue")
		return
	}

	for _, item := range items {
		pc, err := w.queries.GetPharmacyAPIConfig(ctx, item.PharmacyID)
		if err != nil {
			log.Error().
				Err(err).
				Str("pharmacy_id", item.PharmacyID.String()).
				Msg("Failed to get pharmacy config for retry")
			w.queries.DeleteRetryQueueItem(ctx, item.ID)
			continue
		}

		factory, ok := w.adapterReg.Get(pc.ApiType)
		if !ok {
			log.Warn().
				Str("pharmacy_id", item.PharmacyID.String()).
				Str("api_type", pc.ApiType).
				Msg("No adapter for retry")
			w.queries.DeleteRetryQueueItem(ctx, item.ID)
			continue
		}

		endpoint := ""
		if pc.Endpoint.Valid {
			endpoint = pc.Endpoint.String
		}
		credentialsRef := ""
		if pc.CredentialsRef.Valid {
			credentialsRef = pc.CredentialsRef.String
		}

		syncAdapter := factory(w.buildAdapterConfig(endpoint, credentialsRef))

		if item.DrugID.Valid {
			// Retry specific drug
			drug, err := w.queries.GetDrugByID(ctx, item.DrugID.Bytes)
			if err != nil {
				log.Warn().Err(err).Msg("Drug not found for retry")
				w.queries.DeleteRetryQueueItem(ctx, item.ID)
				continue
			}

			pharmacy := adapter.Pharmacy{
				ID:             pc.PharmacyID.String(),
				APIType:        pc.ApiType,
				Endpoint:       endpoint,
				CredentialsRef: credentialsRef,
				RateLimit:      w.cfg.Adapter.DefaultRateLimit,
				RequestTimeout: w.cfg.Adapter.RequestTimeout,
			}

			fetched, err := syncAdapter.FetchInventory(ctx, pharmacy)
			if err != nil {
				log.Error().Err(err).Msg("Retry fetch failed")
				w.updateRetryAttempt(ctx, item, err.Error())
				continue
			}

			// Find the specific drug in results
			for _, f := range fetched {
				if f.DrugNDC == drug.NdcCode {
					priceCents := pgtype.Int4{Valid: false}
					if f.PriceCents != nil {
						priceCents = pgtype.Int4{Int32: int32(*f.PriceCents), Valid: true}
					}
					_, err = w.queries.UpsertInventory(ctx, db.UpsertInventoryParams{
						PharmacyID: pc.PharmacyID,
						DrugID:     drug.ID,
						Quantity:   int32(f.Quantity),
						PriceCents: priceCents,
						Source:     db.InventorySource(f.Source),
					})
					if err != nil {
						log.Error().Err(err).Msg("Retry upsert failed")
						w.updateRetryAttempt(ctx, item, err.Error())
						continue
					}
					w.queries.DeleteRetryQueueItem(ctx, item.ID)
					log.Info().
						Str("pharmacy_id", pc.PharmacyID.String()).
						Str("drug_id", drug.ID.String()).
						Msg("Retry sync succeeded")
					break
				}
			}
		} else {
			// Retry full pharmacy sync
			pcRow := db.GetEnabledPharmacyAPIConfigsRow{
				ID:             pc.ID,
				PharmacyID:     pc.PharmacyID,
				ApiType:        pc.ApiType,
				Endpoint:       pc.Endpoint,
				CredentialsRef: pc.CredentialsRef,
				SyncSchedule:   pc.SyncSchedule,
				LastSyncAt:     pc.LastSyncAt,
				LastSyncStatus: pc.LastSyncStatus,
				IsEnabled:      pc.IsEnabled,
				PharmacyName:   "",
				Latitude:       0,
				Longitude:      0,
			}
			w.syncPharmacy(ctx, pcRow)
			w.queries.DeleteRetryQueueItem(ctx, item.ID)
		}
	}
}

func (w *SyncWorker) buildAdapterConfig(endpoint, credentialsRef string) adapter.Config {
	return adapter.Config{
		Endpoint:        endpoint,
		CredentialsRef:  credentialsRef,
		RateLimit:       w.cfg.Adapter.DefaultRateLimit,
		RequestTimeout:  w.cfg.Adapter.RequestTimeout,
	}
}

func (w *SyncWorker) updateSyncStatus(ctx context.Context, pharmacyID uuid.UUID, status db.SyncStatus, errorMsg string) {
	w.queries.UpdatePharmacyAPIConfigSyncStatus(ctx, db.UpdatePharmacyAPIConfigSyncStatusParams{
		PharmacyID:       pharmacyID,
		LastSyncAt:       pgtype.Timestamptz{Time: time.Now(), Valid: true},
		LastSyncStatus:   db.NullSyncStatus{SyncStatus: status, Valid: true},
	})
}

func (w *SyncWorker) addToRetryQueue(ctx context.Context, pharmacyID uuid.UUID, drugID uuid.UUID, errorMsg string) {
	baseDelay := w.cfg.Worker.RetryBaseDelay
	nextRetry := time.Now().Add(baseDelay)

	var drugIDParam pgtype.UUID
	if drugID != uuid.Nil {
		drugIDParam = pgtype.UUID{Bytes: drugID, Valid: true}
	}

	w.queries.AddToRetryQueue(ctx, db.AddToRetryQueueParams{
		PharmacyID:   pharmacyID,
		DrugID:       drugIDParam,
		AttemptCount: pgtype.Int4{Int32: 0, Valid: true},
		NextRetryAt:  nextRetry,
		ErrorMessage: pgtype.Text{String: errorMsg, Valid: true},
	})
}

func (w *SyncWorker) updateRetryAttempt(ctx context.Context, item db.SyncRetryQueue, errorMsg string) {
	attempt := 1
	if item.AttemptCount.Valid {
		attempt = int(item.AttemptCount.Int32) + 1
	}
	if attempt >= w.cfg.Worker.MaxRetries {
		w.queries.DeleteRetryQueueItem(ctx, item.ID)
		log.Warn().
			Str("id", item.ID.String()).
			Msg("Max retries exceeded, removing from queue")
		return
	}

	delay := w.cfg.Worker.RetryBaseDelay * time.Duration(1<<attempt)
	jitter := time.Duration(float64(delay) * 0.1 * (2*rand.Float64() - 1))
	nextRetry := time.Now().Add(delay + jitter)

	intervalStr := nextRetry.Sub(time.Now()).String()
	w.queries.UpdateRetryQueueAttempt(ctx, db.UpdateRetryQueueAttemptParams{
		ID:       item.ID,
		Column2:  intervalStr,
	})
}