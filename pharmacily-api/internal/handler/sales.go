package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/pharmacily/api/internal/db"
	"github.com/pharmacily/api/internal/middleware"
	"github.com/rs/zerolog/log"
)

type saleLineRequest struct {
	InventoryID string `json:"inventory_id"`
	Quantity    int    `json:"quantity"`
}

type createSaleRequest struct {
	Lines                []saleLineRequest `json:"lines"`
	Method               string            `json:"method"`
	AmountTenderedPesewas *int             `json:"amount_tendered_pesewas"`
	RxConfirmed          bool              `json:"rx_confirmed"`
	RxPrescriber         string            `json:"rx_prescriber"`
}

type saleResponse struct {
	ID                    string  `json:"id"`
	PharmacyID            string  `json:"pharmacy_id"`
	ServedBy              string  `json:"served_by"`
	ApprovedBy            *string `json:"approved_by"`
	TotalPesewas          int     `json:"total_pesewas"`
	AmountTenderedPesewas *int    `json:"amount_tendered_pesewas"`
	Method                string  `json:"method"`
	RxConfirmed           bool    `json:"rx_confirmed"`
	RxPrescriber          *string `json:"rx_prescriber"`
	CreatedAt             string  `json:"created_at"`
}

type saleLineResponse struct {
	ID               string  `json:"id"`
	InventoryID      string  `json:"inventory_id"`
	DrugID           string  `json:"drug_id"`
	DrugName         string  `json:"drug_name"`
	Strength         *string `json:"strength"`
	Form             *string `json:"form"`
	Quantity         int     `json:"quantity"`
	UnitPricePesewas int     `json:"unit_price_pesewas"`
	LineTotalPesewas int     `json:"line_total_pesewas"`
	IsRx             bool    `json:"is_rx"`
}

type inventoryAfterResponse struct {
	InventoryID string `json:"inventory_id"`
	Quantity    int    `json:"quantity"`
}

type createSaleResponse struct {
	Sale           saleResponse            `json:"sale"`
	Lines          []saleLineResponse      `json:"lines"`
	InventoryAfter []inventoryAfterResponse `json:"inventory_after"`
}

type receiptResponse struct {
	Sale                 saleResponse     `json:"sale"`
	Lines                []saleLineResponse `json:"lines"`
	PharmacyName         string           `json:"pharmacy_name"`
	PharmacyAddress      string           `json:"pharmacy_address"`
	PharmacyCity         string           `json:"pharmacy_city"`
	PharmacyPhone        *string          `json:"pharmacy_phone"`
	ServedByEmail        *string          `json:"served_by_email"`
	ApprovedByEmail      *string          `json:"approved_by_email"`
}

// httpError writes the {error, details} shape AGENTS §7 requires.
func httpError(w http.ResponseWriter, status int, err, details string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	body := map[string]string{"error": err}
	if details != "" {
		body["details"] = details
	}
	json.NewEncoder(w).Encode(body)
}

func textPtr(t pgtype.Text) *string {
	if !t.Valid {
		return nil
	}
	s := t.String
	return &s
}

func uuidPtr(u pgtype.UUID) *string {
	if !u.Valid {
		return nil
	}
	s := uuid.UUID(u.Bytes).String()
	return &s
}

func toPGUUID(u uuid.UUID) pgtype.UUID {
	return pgtype.UUID{Bytes: [16]byte(u), Valid: true}
}

func saleToResponse(s db.Sale) saleResponse {
	var tendered *int
	if s.AmountTenderedPesewas.Valid {
		v := int(s.AmountTenderedPesewas.Int32)
		tendered = &v
	}
	return saleResponse{
		ID:                    s.ID.String(),
		PharmacyID:            s.PharmacyID.String(),
		ServedBy:              s.ServedBy.String(),
		ApprovedBy:            uuidPtr(s.ApprovedBy),
		TotalPesewas:          int(s.TotalPesewas),
		AmountTenderedPesewas: tendered,
		Method:                s.Method,
		RxConfirmed:           s.RxConfirmed,
		RxPrescriber:          textPtr(s.RxPrescriber),
		CreatedAt:             s.CreatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
	}
}

// CreateSale posts a counter sale: validates stock and Rx rules, recomputes
// totals server-side, decrements inventory and writes the ledger in one tx.
func (a *API) CreateSale(w http.ResponseWriter, r *http.Request) {
	auth := middleware.FromContext(r.Context())
	if auth == nil {
		httpError(w, http.StatusUnauthorized, "unauthorized", "")
		return
	}
	if !auth.HasPharmacy() {
		httpError(w, http.StatusForbidden, "no pharmacy bound to this account", "sign in from a device linked to a pharmacy")
		return
	}

	var req createSaleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, http.StatusBadRequest, "invalid JSON body", err.Error())
		return
	}
	if len(req.Lines) == 0 {
		httpError(w, http.StatusBadRequest, "sale needs at least one line", "")
		return
	}
	if req.Method != "cash" && req.Method != "momo" {
		httpError(w, http.StatusBadRequest, "method must be 'cash' or 'momo'", "")
		return
	}

	type resolvedLine struct {
		inventoryID uuid.UUID
		quantity    int32
		unitPrice   int32
		drugID      uuid.UUID
		isRx        bool
	}
	seen := make(map[uuid.UUID]bool, len(req.Lines))
	resolved := make([]resolvedLine, 0, len(req.Lines))
	anyRx := false
	total := int32(0)

	ctx := r.Context()
	tx, err := a.pool.Begin(ctx)
	if err != nil {
		log.Error().Err(err).Msg("begin sale tx failed")
		httpError(w, http.StatusInternalServerError, "internal error", "")
		return
	}
	defer tx.Rollback(ctx)
	qtx := a.queries.WithTx(tx)

	for _, line := range req.Lines {
		invID, err := uuid.Parse(line.InventoryID)
		if err != nil {
			httpError(w, http.StatusBadRequest, "invalid inventory_id", line.InventoryID)
			return
		}
		if seen[invID] {
			httpError(w, http.StatusBadRequest, "duplicate inventory_id in lines", line.InventoryID)
			return
		}
		seen[invID] = true
		if line.Quantity <= 0 {
			httpError(w, http.StatusBadRequest, "line quantity must be at least 1", line.InventoryID)
			return
		}

		row, err := qtx.GetInventoryByIDForUpdate(ctx, invID)
		if errors.Is(err, pgx.ErrNoRows) {
			httpError(w, http.StatusNotFound, "inventory item not found", line.InventoryID)
			return
		}
		if err != nil {
			log.Error().Err(err).Msg("lock inventory failed")
			httpError(w, http.StatusInternalServerError, "internal error", "")
			return
		}
		if row.PharmacyID != auth.PharmacyID {
			// Do not leak whether the item exists at another pharmacy.
			httpError(w, http.StatusNotFound, "inventory item not found", line.InventoryID)
			return
		}
		if !row.PriceCents.Valid || row.PriceCents.Int32 <= 0 {
			httpError(w, http.StatusBadRequest, "item has no selling price set", row.DrugName)
			return
		}
		if int(row.Quantity) < line.Quantity {
			httpError(w, http.StatusConflict, "not enough stock", row.DrugName)
			return
		}

		isRx := row.RxOtc.Valid && row.RxOtc.String == "Rx"
		if isRx {
			anyRx = true
		}
		unit := row.PriceCents.Int32
		total += unit * int32(line.Quantity)
		resolved = append(resolved, resolvedLine{
			inventoryID: invID,
			quantity:    int32(line.Quantity),
			unitPrice:   unit,
			drugID:      row.DrugID,
			isRx:        isRx,
		})
	}

	if anyRx {
		if !req.RxConfirmed {
			httpError(w, http.StatusBadRequest, "Rx sale blocked unless rx_confirmed is true", "a pharmacist must approve prescription items")
			return
		}
		if strings.TrimSpace(req.RxPrescriber) == "" {
			httpError(w, http.StatusBadRequest, "rx_prescriber is required for Rx sales", "")
			return
		}
		if !auth.IsPharmacist() {
			httpError(w, http.StatusForbidden, "Rx sales need a pharmacist account", "ask the pharmacist on duty to approve")
			return
		}
	} else if req.RxConfirmed {
		// Harmless but keep the stored flag honest: no Rx lines, no confirmation.
		req.RxConfirmed = false
		req.RxPrescriber = ""
	}

	var tendered pgtype.Int4
	if req.AmountTenderedPesewas != nil {
		if *req.AmountTenderedPesewas < int(total) {
			httpError(w, http.StatusBadRequest, "amount tendered is less than the total", "")
			return
		}
		tendered = pgtype.Int4{Int32: int32(*req.AmountTenderedPesewas), Valid: true}
	} else if req.Method == "cash" {
		// Cash without an explicit tendered amount implies exact change.
		tendered = pgtype.Int4{Int32: total, Valid: true}
	}

	var approvedBy pgtype.UUID
	if anyRx {
		approvedBy = toPGUUID(auth.UserID)
	}
	var prescriber pgtype.Text
	if req.RxConfirmed && strings.TrimSpace(req.RxPrescriber) != "" {
		prescriber = pgtype.Text{String: strings.TrimSpace(req.RxPrescriber), Valid: true}
	}

	sale, err := qtx.CreateSale(ctx, db.CreateSaleParams{
		PharmacyID:            auth.PharmacyID,
		ServedBy:              auth.UserID,
		ApprovedBy:            approvedBy,
		TotalPesewas:          total,
		AmountTenderedPesewas: tendered,
		Method:                req.Method,
		RxConfirmed:           anyRx && req.RxConfirmed,
		RxPrescriber:          prescriber,
	})
	if err != nil {
		log.Error().Err(err).Msg("insert sale failed")
		httpError(w, http.StatusInternalServerError, "internal error", "")
		return
	}

	saleID := toPGUUID(sale.ID)
	lineResponses := make([]saleLineResponse, 0, len(resolved))
	after := make([]inventoryAfterResponse, 0, len(resolved))

	for _, line := range resolved {
		created, err := qtx.CreateSaleLine(ctx, db.CreateSaleLineParams{
			SaleID:           sale.ID,
			InventoryID:      line.inventoryID,
			DrugID:           line.drugID,
			Quantity:         line.quantity,
			UnitPricePesewas: line.unitPrice,
			LineTotalPesewas: line.unitPrice * line.quantity,
			IsRx:             line.isRx,
		})
		if err != nil {
			log.Error().Err(err).Msg("insert sale line failed")
			httpError(w, http.StatusInternalServerError, "internal error", "")
			return
		}

		inv, err := qtx.DecrementInventoryForSale(ctx, db.DecrementInventoryForSaleParams{
			ID:         line.inventoryID,
			PharmacyID: auth.PharmacyID,
			Quantity:   line.quantity,
		})
		if errors.Is(err, pgx.ErrNoRows) {
			httpError(w, http.StatusConflict, "not enough stock", "")
			return
		}
		if err != nil {
			log.Error().Err(err).Msg("decrement inventory failed")
			httpError(w, http.StatusInternalServerError, "internal error", "")
			return
		}

		if _, err := qtx.CreateStockLedgerRow(ctx, db.CreateStockLedgerRowParams{
			InventoryID: line.inventoryID,
			Delta:       -line.quantity,
			Reason:      "sale",
			SaleID:      saleID,
			Actor:       auth.UserID,
		}); err != nil {
			log.Error().Err(err).Msg("insert stock ledger failed")
			httpError(w, http.StatusInternalServerError, "internal error", "")
			return
		}

		lineResponses = append(lineResponses, saleLineResponse{
			ID:               created.ID.String(),
			InventoryID:      line.inventoryID.String(),
			DrugID:           line.drugID.String(),
			Quantity:         int(created.Quantity),
			UnitPricePesewas: int(created.UnitPricePesewas),
			LineTotalPesewas: int(created.LineTotalPesewas),
			IsRx:             created.IsRx,
		})
		after = append(after, inventoryAfterResponse{
			InventoryID: line.inventoryID.String(),
			Quantity:    int(inv.Quantity),
		})
	}

	if err := tx.Commit(ctx); err != nil {
		log.Error().Err(err).Msg("commit sale failed")
		httpError(w, http.StatusInternalServerError, "internal error", "")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(createSaleResponse{
		Sale:           saleToResponse(sale),
		Lines:          lineResponses,
		InventoryAfter: after,
	})
}

// GetSale returns one of the caller's sales with receipt context.
func (a *API) GetSale(w http.ResponseWriter, r *http.Request) {
	auth := middleware.FromContext(r.Context())
	if auth == nil {
		httpError(w, http.StatusUnauthorized, "unauthorized", "")
		return
	}

	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpError(w, http.StatusBadRequest, "invalid sale ID", "")
		return
	}

	ctx := r.Context()
	sale, err := a.queries.GetSaleForReceipt(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		httpError(w, http.StatusNotFound, "sale not found", "")
		return
	}
	if err != nil {
		log.Error().Err(err).Msg("get sale failed")
		httpError(w, http.StatusInternalServerError, "internal error", "")
		return
	}
	if sale.PharmacyID != auth.PharmacyID {
		httpError(w, http.StatusNotFound, "sale not found", "")
		return
	}

	lines, err := a.queries.GetSaleLinesBySaleID(ctx, id)
	if err != nil {
		log.Error().Err(err).Msg("get sale lines failed")
		httpError(w, http.StatusInternalServerError, "internal error", "")
		return
	}

	var tendered *int
	if sale.AmountTenderedPesewas.Valid {
		v := int(sale.AmountTenderedPesewas.Int32)
		tendered = &v
	}
	lineResponses := make([]saleLineResponse, 0, len(lines))
	for _, l := range lines {
		lineResponses = append(lineResponses, saleLineResponse{
			ID:               l.ID.String(),
			InventoryID:      l.InventoryID.String(),
			DrugID:           l.DrugID.String(),
			DrugName:         l.DrugName,
			Strength:         textPtr(l.Strength),
			Form:             textPtr(l.Form),
			Quantity:         int(l.Quantity),
			UnitPricePesewas: int(l.UnitPricePesewas),
			LineTotalPesewas: int(l.LineTotalPesewas),
			IsRx:             l.IsRx,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(receiptResponse{
		Sale: saleResponse{
			ID:                    sale.ID.String(),
			PharmacyID:            sale.PharmacyID.String(),
			ServedBy:              sale.ServedBy.String(),
			ApprovedBy:            uuidPtr(sale.ApprovedBy),
			TotalPesewas:          int(sale.TotalPesewas),
			AmountTenderedPesewas: tendered,
			Method:                sale.Method,
			RxConfirmed:           sale.RxConfirmed,
			RxPrescriber:          textPtr(sale.RxPrescriber),
			CreatedAt:             sale.CreatedAt.UTC().Format("2006-01-02T15:04:05Z07:00"),
		},
		Lines:           lineResponses,
		PharmacyName:    sale.PharmacyName,
		PharmacyAddress: sale.PharmacyAddress,
		PharmacyCity:    sale.PharmacyCity,
		PharmacyPhone:   textPtr(sale.PharmacyPhone),
		ServedByEmail:   textPtr(sale.ServedByEmail),
		ApprovedByEmail: textPtr(sale.ApprovedByEmail),
	})
}

type salesSummaryResponse struct {
	TotalPesewas int `json:"total_pesewas"`
	Transactions int `json:"transactions"`
}

// GetSalesSummary returns today's totals for the caller's pharmacy.
func (a *API) GetSalesSummary(w http.ResponseWriter, r *http.Request) {
	auth := middleware.FromContext(r.Context())
	if auth == nil {
		httpError(w, http.StatusUnauthorized, "unauthorized", "")
		return
	}
	if !auth.HasPharmacy() {
		httpError(w, http.StatusForbidden, "no pharmacy bound to this account", "")
		return
	}

	summary, err := a.queries.GetSalesToday(r.Context(), auth.PharmacyID)
	if err != nil {
		log.Error().Err(err).Msg("get sales summary failed")
		httpError(w, http.StatusInternalServerError, "internal error", "")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(salesSummaryResponse{
		TotalPesewas: int(summary.TotalPesewas),
		Transactions: int(summary.Transactions),
	})
}
