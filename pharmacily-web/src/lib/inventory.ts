import { supabase } from '@/lib/supabase'
import type { InventoryItem } from '@/types'

/** Client-side validation mirrors the API rules: qty >= 0, price > 0. */
export function assertInventoryInput(quantity: number, priceCents: number | null) {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error('Quantity must be a whole number, 0 or more.')
  }
  if (priceCents !== null && (!Number.isInteger(priceCents) || priceCents <= 0)) {
    throw new Error('Price must be more than Gh₵ 0.00.')
  }
}

export async function upsertInventoryRow(
  pharmacyId: string,
  drugId: string,
  quantity: number,
  priceCents: number | null
): Promise<InventoryItem> {
  assertInventoryInput(quantity, priceCents)
  const { data, error } = await supabase
    .from('inventory')
    .upsert(
      {
        pharmacy_id: pharmacyId,
        drug_id: drugId,
        quantity,
        price_cents: priceCents,
        source: 'manual',
        last_updated: new Date().toISOString(),
      },
      { onConflict: 'pharmacy_id,drug_id' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateInventoryQuantity(
  id: string,
  pharmacyId: string,
  quantity: number
): Promise<void> {
  assertInventoryInput(quantity, null)
  const { error } = await supabase
    .from('inventory')
    .update({ quantity, last_updated: new Date().toISOString() })
    .eq('id', id)
    .eq('pharmacy_id', pharmacyId)
  if (error) throw error
}
