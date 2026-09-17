package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pharmacily/api/internal/adapter"
	"github.com/pharmacily/api/internal/config"
	"github.com/pharmacily/api/internal/db"
	"github.com/rs/zerolog/log"
)

type API struct {
	queries *db.Queries
	pool    *pgxpool.Pool
	cfg     *config.Config
	adapter *adapter.AdapterRegistry
}

func NewAPI(queries *db.Queries, pool *pgxpool.Pool, cfg *config.Config, adapterRegistry *adapter.AdapterRegistry) *API {
	return &API{
		queries: queries,
		pool:    pool,
		cfg:     cfg,
		adapter: adapterRegistry,
	}
}

func (a *API) Routes() chi.Router {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))
	// Browsers preflight cross-origin fetches (the web app sends
	// Content-Type: application/json). Without this, all UI search fails.
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   a.cfg.Server.AllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Get("/health", a.HealthCheck)
	r.Get("/ready", a.ReadyCheck)

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/drugs/search", a.SearchDrugs)
		r.Get("/drugs/{id}", a.GetDrug)
		r.Get("/pharmacies/nearby", a.GetPharmaciesNearby)
		r.Get("/pharmacies/{id}", a.GetPharmacy)
		r.Get("/pharmacies/{id}/inventory", a.GetPharmacyInventory)
		r.Get("/search", a.SearchInventory)
	})

	return r
}

func (a *API) HealthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (a *API) ReadyCheck(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	if err := a.pool.Ping(ctx); err != nil {
		http.Error(w, "database not ready", http.StatusServiceUnavailable)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
}

func (a *API) SearchDrugs(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		http.Error(w, "query parameter 'q' required", http.StatusBadRequest)
		return
	}

	limit := 20
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	drugs, err := a.queries.SearchDrugs(ctx, db.SearchDrugsParams{
		Column1: pgtype.Text{String: q, Valid: true},
		Limit:   int32(limit),
	})
	if err != nil {
		log.Error().Err(err).Msg("search drugs failed")
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(drugs)
}

func (a *API) GetDrug(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "invalid drug ID", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	drug, err := a.queries.GetDrugByID(ctx, id)
	if err != nil {
		if err.Error() == "no rows in result set" {
			http.Error(w, "drug not found", http.StatusNotFound)
			return
		}
		log.Error().Err(err).Msg("get drug failed")
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(drug)
}

func (a *API) GetPharmaciesNearby(w http.ResponseWriter, r *http.Request) {
	latStr := r.URL.Query().Get("lat")
	lngStr := r.URL.Query().Get("lng")
	radiusStr := r.URL.Query().Get("radius_km")
	limitStr := r.URL.Query().Get("limit")

	if latStr == "" || lngStr == "" {
		http.Error(w, "lat and lng parameters required", http.StatusBadRequest)
		return
	}

	lat, err := strconv.ParseFloat(latStr, 64)
	if err != nil {
		http.Error(w, "invalid lat", http.StatusBadRequest)
		return
	}

	lng, err := strconv.ParseFloat(lngStr, 64)
	if err != nil {
		http.Error(w, "invalid lng", http.StatusBadRequest)
		return
	}

	radiusKm := 25.0
	if radiusStr != "" {
		if parsed, err := strconv.ParseFloat(radiusStr, 64); err == nil && parsed > 0 {
			// Clamp (not default) so inter-city searches like Accra->Kumasi work
			radiusKm = min(parsed, 1000)
		}
	}

	limit := 50
	if limitStr != "" {
		if parsed, err := strconv.Atoi(limitStr); err == nil && parsed > 0 && parsed <= 200 {
			limit = parsed
		}
	}

	// Convert radius to meters for PostGIS
	radiusMeters := radiusKm * 1000

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	pharmacies, err := a.queries.GetPharmaciesNearby(ctx, db.GetPharmaciesNearbyParams{
		LlToEarth:   lat,
		LlToEarth_2: lng,
		EarthBox:    radiusMeters,
		Limit:       int32(limit),
	})
	if err != nil {
		log.Error().Err(err).Msg("get pharmacies nearby failed")
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(pharmacies)
}

func (a *API) GetPharmacy(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "invalid pharmacy ID", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	pharmacy, err := a.queries.GetPharmacyByID(ctx, id)
	if err != nil {
		if err.Error() == "no rows in result set" {
			http.Error(w, "pharmacy not found", http.StatusNotFound)
			return
		}
		log.Error().Err(err).Msg("get pharmacy failed")
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(pharmacy)
}

func (a *API) GetPharmacyInventory(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	pharmacyID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "invalid pharmacy ID", http.StatusBadRequest)
		return
	}

	drugIDStr := r.URL.Query().Get("drug_id")
	var drugID uuid.UUID
	if drugIDStr != "" {
		drugID, err = uuid.Parse(drugIDStr)
		if err != nil {
			http.Error(w, "invalid drug_id", http.StatusBadRequest)
			return
		}
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	if drugID != uuid.Nil {
		inventory, err := a.queries.GetInventoryByPharmacyAndDrug(ctx, db.GetInventoryByPharmacyAndDrugParams{
			PharmacyID: pharmacyID,
			DrugID:     drugID,
		})
		if err != nil {
			if err.Error() == "no rows in result set" {
				http.Error(w, "inventory not found", http.StatusNotFound)
				return
			}
			log.Error().Err(err).Msg("get inventory failed")
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(inventory)
		return
	}

	limit := 100
	offset := 0
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 500 {
			limit = parsed
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	inventory, err := a.queries.GetPharmacyInventory(ctx, db.GetPharmacyInventoryParams{
		PharmacyID: pharmacyID,
		Limit:      int32(limit),
		Offset:     int32(offset),
	})
	if err != nil {
		log.Error().Err(err).Msg("get pharmacy inventory failed")
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(inventory)
}

func (a *API) SearchInventory(w http.ResponseWriter, r *http.Request) {
	drugIDStr := r.URL.Query().Get("drug_id")
	if drugIDStr == "" {
		http.Error(w, "drug_id parameter required", http.StatusBadRequest)
		return
	}

	drugID, err := uuid.Parse(drugIDStr)
	if err != nil {
		http.Error(w, "invalid drug_id", http.StatusBadRequest)
		return
	}

	latStr := r.URL.Query().Get("lat")
	lngStr := r.URL.Query().Get("lng")
	if latStr == "" || lngStr == "" {
		http.Error(w, "lat and lng parameters required", http.StatusBadRequest)
		return
	}

	lat, err := strconv.ParseFloat(latStr, 64)
	if err != nil {
		http.Error(w, "invalid lat", http.StatusBadRequest)
		return
	}

	lng, err := strconv.ParseFloat(lngStr, 64)
	if err != nil {
		http.Error(w, "invalid lng", http.StatusBadRequest)
		return
	}

	radiusKm := 25.0
	if rStr := r.URL.Query().Get("radius_km"); rStr != "" {
		if parsed, err := strconv.ParseFloat(rStr, 64); err == nil && parsed > 0 {
			// Clamp (not default) so inter-city searches like Accra->Kumasi work
			radiusKm = min(parsed, 1000)
		}
	}

	_ = r.URL.Query().Get("in_stock_only") // inStockOnly - not used in query, handled by quantity > 0

	radiusMeters := radiusKm * 1000

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	results, err := a.queries.SearchInventoryByDrug(ctx, db.SearchInventoryByDrugParams{
		LlToEarth:   lat,
		LlToEarth_2: lng,
		DrugID:      drugID,
		EarthBox:    radiusMeters,
		Limit:       50,
	})
	if err != nil {
		log.Error().Err(err).Msg("search inventory failed")
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}