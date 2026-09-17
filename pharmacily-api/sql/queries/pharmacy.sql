-- name: GetPharmacyChains :many
SELECT * FROM pharmacy_chains ORDER BY name;

-- name: GetPharmacyChainByID :one
SELECT * FROM pharmacy_chains WHERE id = $1;

-- name: CreatePharmacyChain :one
INSERT INTO pharmacy_chains (name, api_type, base_endpoint)
VALUES ($1, $2, $3)
RETURNING *;

-- name: UpdatePharmacyChain :one
UPDATE pharmacy_chains
SET name = $2, api_type = $3, base_endpoint = $4
WHERE id = $1
RETURNING *;

-- name: DeletePharmacyChain :exec
DELETE FROM pharmacy_chains WHERE id = $1;

-- name: GetPharmaciesNearby :many
SELECT
    p.*,
    pc.name as chain_name,
    pc.api_type as chain_api_type,
    earth_distance(ll_to_earth($1, $2), ll_to_earth(p.latitude, p.longitude)) as distance_meters
FROM pharmacies p
LEFT JOIN pharmacy_chains pc ON p.chain_id = pc.id
WHERE p.is_active = true
  AND earth_box(ll_to_earth($1, $2), $3) @> ll_to_earth(p.latitude, p.longitude)
ORDER BY distance_meters
LIMIT $4;

-- name: GetPharmacyByID :one
SELECT
    p.*,
    pc.name as chain_name,
    pc.api_type as chain_api_type
FROM pharmacies p
LEFT JOIN pharmacy_chains pc ON p.chain_id = pc.id
WHERE p.id = $1;

-- name: CreatePharmacy :one
INSERT INTO pharmacies (name, address, city, state, zip_code, latitude, longitude, phone, hours, chain_id, api_credentials_encrypted)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING *;

-- name: UpdatePharmacy :one
UPDATE pharmacies
SET name = $2, address = $3, city = $4, state = $5, zip_code = $6,
    latitude = $7, longitude = $8, phone = $9, hours = $10, chain_id = $11,
    api_credentials_encrypted = $12, is_active = $13, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeletePharmacy :exec
DELETE FROM pharmacies WHERE id = $1;

-- name: SearchDrugs :many
-- Prefix matches first (still GIN-trigram indexed), then typo-tolerant similarity.
-- NOTE: $1 repeats; sqlc collapses it to a single Column1 (pgtype.Text) param.
SELECT * FROM drugs
WHERE name ILIKE $1 || '%' OR generic_name ILIKE $1 || '%'
   OR name % $1 OR generic_name % $1
ORDER BY (name ILIKE $1 || '%' OR generic_name ILIKE $1 || '%') DESC,
         similarity(name, $1) DESC, similarity(generic_name, $1) DESC
LIMIT $2;

-- name: GetDrugByID :one
SELECT * FROM drugs WHERE id = $1;

-- name: GetDrugByNDC :one
SELECT * FROM drugs WHERE ndc_code = $1;

-- name: CreateDrug :one
INSERT INTO drugs (name, generic_name, ndc_code, strength, form, manufacturer)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: UpdateDrug :one
UPDATE drugs
SET name = $2, generic_name = $3, ndc_code = $4, strength = $5, form = $6, manufacturer = $7
WHERE id = $1
RETURNING *;

-- name: DeleteDrug :exec
DELETE FROM drugs WHERE id = $1;

-- name: GetInventoryByPharmacyAndDrug :one
SELECT i.*, d.name as drug_name, d.generic_name, d.ndc_code, d.strength, d.form
FROM inventory i
JOIN drugs d ON i.drug_id = d.id
WHERE i.pharmacy_id = $1 AND i.drug_id = $2;

-- name: SearchInventoryByDrug :many
SELECT
    i.*,
    p.name as pharmacy_name,
    p.address,
    p.city,
    p.state,
    p.zip_code,
    p.latitude,
    p.longitude,
    p.phone,
    p.hours,
    pc.name as chain_name,
    d.name as drug_name,
    d.generic_name,
    d.ndc_code,
    d.strength,
    d.form,
    earth_distance(ll_to_earth($1, $2), ll_to_earth(p.latitude, p.longitude)) as distance_meters
FROM inventory i
JOIN pharmacies p ON i.pharmacy_id = p.id
LEFT JOIN pharmacy_chains pc ON p.chain_id = pc.id
JOIN drugs d ON i.drug_id = d.id
WHERE i.drug_id = $3
  AND p.is_active = true
  AND i.quantity > 0
  AND earth_box(ll_to_earth($1, $2), $4) @> ll_to_earth(p.latitude, p.longitude)
ORDER BY distance_meters, i.price_cents ASC NULLS LAST
LIMIT $5;

-- name: UpsertInventory :one
INSERT INTO inventory (pharmacy_id, drug_id, quantity, price_cents, last_updated, source)
VALUES ($1, $2, $3, $4, now(), $5)
ON CONFLICT (pharmacy_id, drug_id) DO UPDATE SET
    quantity = EXCLUDED.quantity,
    price_cents = EXCLUDED.price_cents,
    last_updated = now(),
    source = EXCLUDED.source
RETURNING *;

-- name: BulkUpsertInventory :exec
INSERT INTO inventory (pharmacy_id, drug_id, quantity, price_cents, last_updated, source)
VALUES ($1, $2, $3, $4, now(), $5)
ON CONFLICT (pharmacy_id, drug_id) DO UPDATE SET
    quantity = EXCLUDED.quantity,
    price_cents = EXCLUDED.price_cents,
    last_updated = now(),
    source = EXCLUDED.source;

-- name: GetPharmacyInventory :many
SELECT i.*, d.name as drug_name, d.generic_name, d.ndc_code, d.strength, d.form
FROM inventory i
JOIN drugs d ON i.drug_id = d.id
WHERE i.pharmacy_id = $1
ORDER BY d.name
LIMIT $2 OFFSET $3;

-- name: GetUserFavorites :many
SELECT
    uf.*,
    d.name as drug_name,
    d.generic_name,
    d.ndc_code,
    d.strength,
    d.form,
    p.name as pharmacy_name,
    p.address,
    p.city,
    p.state,
    p.latitude,
    p.longitude
FROM user_favorites uf
JOIN drugs d ON uf.drug_id = d.id
LEFT JOIN pharmacies p ON uf.pharmacy_id = p.id
WHERE uf.user_id = $1
ORDER BY uf.created_at DESC;

-- name: CreateUserFavorite :one
INSERT INTO user_favorites (user_id, drug_id, pharmacy_id, notify_on_stock)
VALUES ($1, $2, $3, $4)
ON CONFLICT (user_id, drug_id, pharmacy_id) DO UPDATE SET
    notify_on_stock = EXCLUDED.notify_on_stock
RETURNING *;

-- name: UpdateUserFavorite :one
UPDATE user_favorites
SET notify_on_stock = $4
WHERE user_id = $1 AND drug_id = $2 AND pharmacy_id = $3
RETURNING *;

-- name: DeleteUserFavorite :exec
DELETE FROM user_favorites WHERE user_id = $1 AND drug_id = $2 AND pharmacy_id = $3;

-- name: GetPharmacyAPIConfig :one
SELECT * FROM pharmacy_api_configs WHERE pharmacy_id = $1;

-- name: UpsertPharmacyAPIConfig :one
INSERT INTO pharmacy_api_configs (pharmacy_id, api_type, endpoint, credentials_ref, sync_schedule, is_enabled)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (pharmacy_id) DO UPDATE SET
    api_type = EXCLUDED.api_type,
    endpoint = EXCLUDED.endpoint,
    credentials_ref = EXCLUDED.credentials_ref,
    sync_schedule = EXCLUDED.sync_schedule,
    is_enabled = EXCLUDED.is_enabled
RETURNING *;

-- name: UpdatePharmacyAPIConfigSyncStatus :exec
UPDATE pharmacy_api_configs
SET last_sync_at = $2, last_sync_status = $3
WHERE pharmacy_id = $1;

-- name: GetEnabledPharmacyAPIConfigs :many
SELECT pac.*, p.name as pharmacy_name, p.latitude, p.longitude
FROM pharmacy_api_configs pac
JOIN pharmacies p ON pac.pharmacy_id = p.id
WHERE pac.is_enabled = true;

-- name: AddToRetryQueue :one
INSERT INTO sync_retry_queue (pharmacy_id, drug_id, attempt_count, last_attempt_at, next_retry_at, error_message)
VALUES ($1, $2, $3, now(), $4, $5)
RETURNING *;

-- name: GetDueRetryQueue :many
SELECT * FROM sync_retry_queue
WHERE next_retry_at <= now()
ORDER BY next_retry_at
LIMIT $1;

-- name: UpdateRetryQueueAttempt :exec
UPDATE sync_retry_queue
SET attempt_count = attempt_count + 1,
    last_attempt_at = now(),
    next_retry_at = now() + ($2 * interval '1 second')
WHERE id = $1;

-- name: DeleteRetryQueueItem :exec
DELETE FROM sync_retry_queue WHERE id = $1;

-- name: UpsertGeocodeCache :one
INSERT INTO geocode_cache (address_hash, address, latitude, longitude)
VALUES ($1, $2, $3, $4)
ON CONFLICT (address_hash) DO UPDATE SET
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude
RETURNING *;

-- name: GetGeocodeCache :one
SELECT * FROM geocode_cache WHERE address_hash = $1;