-- name: CreateSale :one
INSERT INTO sales (
    pharmacy_id, served_by, approved_by, total_pesewas,
    amount_tendered_pesewas, method, rx_confirmed, rx_prescriber
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: CreateSaleLine :one
INSERT INTO sale_lines (
    sale_id, inventory_id, drug_id, quantity,
    unit_price_pesewas, line_total_pesewas, is_rx
) VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetSaleByID :one
SELECT * FROM sales WHERE id = $1;

-- name: GetSaleForReceipt :one
SELECT s.*, p.name AS pharmacy_name, p.address AS pharmacy_address,
       p.city AS pharmacy_city, p.phone AS pharmacy_phone,
       su.email AS served_by_email, au.email AS approved_by_email
FROM sales s
JOIN pharmacies p ON s.pharmacy_id = p.id
LEFT JOIN auth.users su ON s.served_by = su.id
LEFT JOIN auth.users au ON s.approved_by = au.id
WHERE s.id = $1;

-- name: GetSaleLinesBySaleID :many
SELECT sl.*, d.name AS drug_name, d.strength, d.form
FROM sale_lines sl
JOIN drugs d ON sl.drug_id = d.id
WHERE sl.sale_id = $1
ORDER BY sl.id;

-- name: GetSalesToday :one
SELECT
    COALESCE(SUM(total_pesewas), 0)::int AS total_pesewas,
    COUNT(*)::int AS transactions
FROM sales
WHERE pharmacy_id = $1
  AND created_at >= date_trunc('day', now());

-- name: CreateStockLedgerRow :one
INSERT INTO stock_ledger (inventory_id, delta, reason, sale_id, actor)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: DecrementInventoryForSale :one
-- Guard quantity >= requested so a lost race returns no rows (handler maps
-- to 409 sold-out) instead of going negative.
UPDATE inventory
SET quantity = quantity - $3, last_updated = now()
WHERE id = $1
  AND pharmacy_id = $2
  AND quantity >= $3
RETURNING *;

-- name: GetInventoryByIDForUpdate :one
-- SELECT ... FOR UPDATE: caller must already be inside a transaction.
SELECT i.*, d.name AS drug_name, d.rx_otc
FROM inventory i
JOIN drugs d ON i.drug_id = d.id
WHERE i.id = $1
FOR UPDATE OF i;
