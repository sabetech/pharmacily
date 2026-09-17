import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { ACCRA_CENTER } from '@/utils/helpers'
import type { DrugSearchResult, PharmacyNearbyResult, SearchParams, SearchResult, Pharmacy, InventoryItem, UserFavorite, PharmacyAPIConfig } from '@/types'
import * as api from '@/lib/api'

// Drug hooks
export function useDrugSearch(query: string, enabled = true) {
  return useQuery({
    queryKey: ['drugs', 'search', query],
    queryFn: () => api.searchDrugs(query),
    enabled: enabled && query.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
  })
}

export function useDrug(id: string) {
  return useQuery({
    queryKey: ['drugs', id],
    queryFn: () => api.getDrug(id),
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
  })
}

// Pharmacy hooks
export function usePharmaciesNearby(lat: number, lng: number, radiusKm = 25, enabled = true) {
  return useQuery({
    queryKey: ['pharmacies', 'nearby', lat, lng, radiusKm],
    queryFn: () => api.getPharmaciesNearby(lat, lng, radiusKm),
    enabled: enabled && lat !== 0 && lng !== 0,
    staleTime: 5 * 60 * 1000,
  })
}

export function usePharmacy(id: string) {
  return useQuery({
    queryKey: ['pharmacies', id],
    queryFn: () => api.getPharmacy(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}

export function usePharmacyInventory(pharmacyId: string, drugId?: string) {
  return useQuery({
    queryKey: ['pharmacies', pharmacyId, 'inventory', drugId],
    queryFn: () => api.getPharmacyInventory(pharmacyId, drugId),
    enabled: !!pharmacyId,
    staleTime: 30 * 1000, // 30 seconds for inventory
  })
}

// Search hook (core)
export function useInventorySearch(params: SearchParams | null) {
  return useQuery({
    queryKey: ['search', 'inventory', params],
    queryFn: () => api.searchInventory(params!),
    enabled: !!params,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData, // Keep previous results while loading new
  })
}

// Favorites hooks
export function useUserFavorites(userId: string) {
  return useQuery({
    queryKey: ['favorites', userId],
    queryFn: () => api.getUserFavorites(userId),
    enabled: !!userId,
    staleTime: 1 * 60 * 1000,
  })
}

export function useCreateFavorite(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ drugId, pharmacyId, notifyOnStock }: { drugId: string; pharmacyId: string | null; notifyOnStock?: boolean }) =>
      api.createUserFavorite(userId, drugId, pharmacyId, notifyOnStock),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites', userId] })
    },
  })
}

export function useUpdateFavorite(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ drugId, pharmacyId, notifyOnStock }: { drugId: string; pharmacyId: string | null; notifyOnStock: boolean }) =>
      api.updateUserFavorite(userId, drugId, pharmacyId, notifyOnStock),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites', userId] })
    },
  })
}

export function useDeleteFavorite(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ drugId, pharmacyId }: { drugId: string; pharmacyId: string | null }) =>
      api.deleteUserFavorite(userId, drugId, pharmacyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites', userId] })
    },
  })
}

// Pharmacy dashboard hooks
export function usePharmacyAPIConfig(pharmacyId: string) {
  return useQuery({
    queryKey: ['pharmacy', pharmacyId, 'api-config'],
    queryFn: () => api.getPharmacyAPIConfig(pharmacyId),
    enabled: !!pharmacyId,
    staleTime: 1 * 60 * 1000,
  })
}

export function useUpsertPharmacyAPIConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ pharmacyId, config }: { pharmacyId: string; config: Partial<PharmacyAPIConfig> }) =>
      api.upsertPharmacyAPIConfig(pharmacyId, config),
    onSuccess: (_, { pharmacyId }) => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy', pharmacyId, 'api-config'] })
    },
  })
}

// Geolocation hook
export function useGeolocation() {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(false)

  const getPosition = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const pos = await api.getCurrentPosition()
      setPosition(pos)
    } catch (err) {
      setError(err as Error)
      // Fallback to IP geolocation
      try {
        const ipPos = await api.getIPGeolocation()
        setPosition({ lat: ipPos.lat, lng: ipPos.lng })
      } catch {
        // Fall back to Accra
        setPosition(ACCRA_CENTER)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  return { position, error, loading, getPosition }
}

