export interface PharmacyChain {
  id: string
  name: string
  api_type: string
  base_endpoint: string | null
  created_at: string
}

export interface Pharmacy {
  id: string
  name: string
  address: string
  city: string
  state: string
  zip_code: string
  latitude: number
  longitude: number
  phone: string | null
  hours: Record<string, string> | null
  chain_id: string | null
  chain_name?: string
  chain_api_type?: string
  api_credentials_encrypted: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  distance_meters?: number
}

export interface Drug {
  id: string
  name: string
  generic_name: string
  ndc_code: string
  strength: string | null
  form: string | null
  manufacturer: string | null
  atc_code?: string | null
  atc_level1?: string | null
  atc_group?: string | null
  therapeutic_category?: string | null
  shopper_category?: string | null
  rx_otc?: 'Rx' | 'OTC' | null
  ghana_eml?: boolean | null
  nhis_covered?: boolean | null
  created_at: string
}

export interface InventoryItem {
  id: string
  pharmacy_id: string
  drug_id: string
  quantity: number
  price_cents: number | null
  last_updated: string
  source: 'api' | 'manual' | 'webhook' | 'csv'
  drug_name?: string
  drug_generic_name?: string
  drug_ndc_code?: string
  drug_strength?: string
  drug_form?: string
  rx_otc?: 'Rx' | 'OTC' | null
  nhis_covered?: boolean | null
  pharmacy_name?: string
  pharmacy_address?: string
  pharmacy_city?: string
  pharmacy_state?: string
  pharmacy_zip_code?: string
  pharmacy_latitude?: number
  pharmacy_longitude?: number
  pharmacy_phone?: string
  pharmacy_hours?: Record<string, string>
  chain_name?: string
  distance_meters?: number
}

export interface UserFavorite {
  id: string
  user_id: string
  drug_id: string
  pharmacy_id: string | null
  notify_on_stock: boolean
  created_at: string
  drug_name?: string
  drug_generic_name?: string
  drug_ndc_code?: string
  drug_strength?: string
  drug_form?: string
  pharmacy_name?: string
  pharmacy_address?: string
  pharmacy_city?: string
  pharmacy_state?: string
  pharmacy_latitude?: number
  pharmacy_longitude?: number
}

export interface PharmacyAPIConfig {
  id: string
  pharmacy_id: string
  api_type: string
  endpoint: string | null
  credentials_ref: string | null
  sync_schedule: string | null
  last_sync_at: string | null
  last_sync_status: 'success' | 'partial' | 'failed' | 'pending' | null
  is_enabled: boolean
}

export interface SearchParams {
  drug_id: string
  lat: number
  lng: number
  radius_km?: number
  in_stock_only?: boolean
}

export interface SearchResult {
  pharmacy: Pharmacy
  inventory: InventoryItem
  distance_meters: number
}

export interface DrugSearchResult {
  id: string
  name: string
  generic_name: string
  ndc_code: string
  strength: string | null
  form: string | null
}

export interface PharmacyNearbyResult {
  id: string
  name: string
  address: string
  city: string
  state: string
  zip_code: string
  latitude: number
  longitude: number
  phone: string | null
  hours: Record<string, string> | null
  chain_id: string | null
  chain_name: string | null
  chain_api_type: string | null
  is_active: boolean
  distance_meters: number
}

export interface SaleLine {
  id: string
  inventory_id: string
  drug_id: string
  drug_name: string
  strength: string | null
  form: string | null
  quantity: number
  unit_price_pesewas: number
  line_total_pesewas: number
  is_rx: boolean
}

export interface Sale {
  id: string
  pharmacy_id: string
  served_by: string
  approved_by: string | null
  total_pesewas: number
  amount_tendered_pesewas: number | null
  method: 'cash' | 'momo'
  rx_confirmed: boolean
  rx_prescriber: string | null
  created_at: string
}

export interface CreateSaleResult {
  sale: Sale
  lines: SaleLine[]
  inventory_after: { inventory_id: string; quantity: number }[]
}

export interface SaleReceipt extends Sale {
  lines: SaleLine[]
  pharmacy_name: string
  pharmacy_address: string
  pharmacy_city: string
  pharmacy_phone: string | null
  served_by_email: string | null
  approved_by_email: string | null
}

export interface SalesSummary {
  total_pesewas: number
  transactions: number
}