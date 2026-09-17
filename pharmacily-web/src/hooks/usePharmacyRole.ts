import { useAuth } from '@/hooks/useAuth'

export type PharmacyRole = 'pharmacist' | 'staff'

/**
 * Pharmacist vs counter-staff, from the `pharmacy_role` app metadata claim.
 * Defaults to 'staff' (least privilege) when the claim is absent.
 * The base `pharmacy_staff` gate stays in PharmacyProtectedRoute.
 */
export function usePharmacyRole(): PharmacyRole {
  const { session } = useAuth()
  const claim = session?.user?.app_metadata?.pharmacy_role
  return claim === 'pharmacist' ? 'pharmacist' : 'staff'
}

export function usePharmacyId(): string | undefined {
  const { session } = useAuth()
  return session?.user?.app_metadata?.pharmacy_id as string | undefined
}
