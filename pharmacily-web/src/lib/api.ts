import { supabase } from '@/lib/supabase'
import type { DrugSearchResult, PharmacyNearbyResult, SearchParams, SearchResult, Pharmacy, InventoryItem, UserFavorite, PharmacyAPIConfig } from '@/types'

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1'

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

// Drug endpoints
export async function searchDrugs(query: string, limit = 20): Promise<DrugSearchResult[]> {
  return fetchAPI<DrugSearchResult[]>(`/drugs/search?q=${encodeURIComponent(query)}&limit=${limit}`)
}

export async function getDrug(id: string): Promise<DrugSearchResult & { created_at: string }> {
  return fetchAPI(`/drugs/${id}`)
}

// Pharmacy endpoints
export async function getPharmaciesNearby(
  lat: number,
  lng: number,
  radiusKm = 25,
  limit = 50
): Promise<PharmacyNearbyResult[]> {
  return fetchAPI<PharmacyNearbyResult[]>(
    `/pharmacies/nearby?lat=${lat}&lng=${lng}&radius_km=${radiusKm}&limit=${limit}`
  )
}

export async function getPharmacy(id: string): Promise<Pharmacy> {
  return fetchAPI(`/pharmacies/${id}`)
}

export async function getPharmacyInventory(
  pharmacyId: string,
  drugId?: string,
  limit = 100,
  offset = 0
): Promise<InventoryItem[]> {
  const params = new URLSearchParams()
  if (drugId) params.set('drug_id', drugId)
  params.set('limit', limit.toString())
  params.set('offset', offset.toString())
  return fetchAPI(`/pharmacies/${pharmacyId}/inventory?${params}`)
}

// Search endpoint (core)
export async function searchInventory(params: SearchParams): Promise<SearchResult[]> {
  const searchParams = new URLSearchParams()
  searchParams.set('drug_id', params.drug_id)
  searchParams.set('lat', params.lat.toString())
  searchParams.set('lng', params.lng.toString())
  if (params.radius_km) searchParams.set('radius_km', params.radius_km.toString())
  if (params.in_stock_only !== undefined) searchParams.set('in_stock_only', params.in_stock_only.toString())

  return fetchAPI<SearchResult[]>(`/search?${searchParams}`)
}

// Favorites (using Supabase directly for realtime)
export async function getUserFavorites(userId: string): Promise<UserFavorite[]> {
  const { data, error } = await supabase
    .from('user_favorites')
    .select(`
      *,
      drugs (name, generic_name, ndc_code, strength, form),
      pharmacies (name, address, city, state, latitude, longitude)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function createUserFavorite(
  userId: string,
  drugId: string,
  pharmacyId: string | null,
  notifyOnStock = false
): Promise<UserFavorite> {
  const { data, error } = await supabase
    .from('user_favorites')
    .upsert({
      user_id: userId,
      drug_id: drugId,
      pharmacy_id: pharmacyId,
      notify_on_stock: notifyOnStock,
    }, { onConflict: 'user_id,drug_id,pharmacy_id' })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateUserFavorite(
  userId: string,
  drugId: string,
  pharmacyId: string | null,
  notifyOnStock: boolean
): Promise<UserFavorite> {
  const { data, error } = await supabase
    .from('user_favorites')
    .update({ notify_on_stock: notifyOnStock })
    .eq('user_id', userId)
    .eq('drug_id', drugId)
    .eq('pharmacy_id', pharmacyId ?? '')
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteUserFavorite(
  userId: string,
  drugId: string,
  pharmacyId: string | null
): Promise<void> {
  const { error } = await supabase
    .from('user_favorites')
    .delete()
    .eq('user_id', userId)
    .eq('drug_id', drugId)
    .eq('pharmacy_id', pharmacyId ?? '')

  if (error) throw error
}

// Pharmacy dashboard (using Supabase directly)
export async function getPharmacyAPIConfig(pharmacyId: string): Promise<PharmacyAPIConfig | null> {
  const { data, error } = await supabase
    .from('pharmacy_api_configs')
    .select('*')
    .eq('pharmacy_id', pharmacyId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function upsertPharmacyAPIConfig(
  pharmacyId: string,
  config: Partial<PharmacyAPIConfig>
): Promise<PharmacyAPIConfig> {
  const { data, error } = await supabase
    .from('pharmacy_api_configs')
    .upsert({ pharmacy_id: pharmacyId, ...config })
    .select()
    .single()

  if (error) throw error
  return data
}

// Realtime subscription
export function subscribeToInventoryChanges(
  drugId: string,
  callback: (payload: any) => void
) {
  const channel = supabase
    .channel(`inventory:${drugId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'inventory',
        filter: `drug_id=eq.${drugId}`,
      },
      callback
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

// Geolocation helper
export function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      (error) => {
        reject(error)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    )
  })
}

// Fallback IP-based geolocation (using Supabase Edge Function)
export async function getIPGeolocation(): Promise<{ lat: number; lng: number; city: string; region: string }> {
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/geocode-ip`)
  if (!response.ok) throw new Error('Failed to get IP geolocation')
  return response.json()
}