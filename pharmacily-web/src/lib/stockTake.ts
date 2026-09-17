import { supabase } from '@/lib/supabase'

export type StockTakeStatus = 'draft' | 'submitted' | 'approved' | 'rejected'

export interface StockTakeSession {
  id: string
  pharmacy_id: string
  status: StockTakeStatus
  notes: string | null
  created_by: string | null
  decided_by: string | null
  created_at: string
  submitted_at: string | null
  decided_at: string | null
}

export interface StockTakeLine {
  id: string
  session_id: string
  drug_id: string
  system_qty: number
  counted_qty: number | null
  note: string | null
  drug_name?: string
  drug_strength?: string
  drug_form?: string
}

export async function listSessions(pharmacyId: string): Promise<StockTakeSession[]> {
  const { data, error } = await supabase
    .from('stock_take_sessions')
    .select('*')
    .eq('pharmacy_id', pharmacyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getSession(sessionId: string): Promise<StockTakeSession> {
  const { data, error } = await supabase
    .from('stock_take_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()
  if (error) throw error
  return data
}

export async function getLines(sessionId: string): Promise<StockTakeLine[]> {
  const { data, error } = await supabase
    .from('stock_take_lines')
    .select('*, drugs (name, strength, form)')
    .eq('session_id', sessionId)
  if (error) throw error
  return ((data || []) as any[])
    .map((l) => ({
      ...l,
      drug_name: l.drugs?.name,
      drug_strength: l.drugs?.strength,
      drug_form: l.drugs?.form,
    }))
    .sort((a, b) => (a.drug_name || '').localeCompare(b.drug_name || ''))
}

/** Start a session, snapshotting current system quantities as lines. */
export async function startSession(
  pharmacyId: string,
  createdBy: string,
  snapshot: { drug_id: string; system_qty: number }[]
): Promise<StockTakeSession> {
  const { data: session, error } = await supabase
    .from('stock_take_sessions')
    .insert({ pharmacy_id: pharmacyId, status: 'draft', created_by: createdBy })
    .select()
    .single()
  if (error) throw error
  if (snapshot.length > 0) {
    const { error: lineError } = await supabase.from('stock_take_lines').insert(
      snapshot.map((s) => ({
        session_id: session.id,
        drug_id: s.drug_id,
        system_qty: s.system_qty,
      }))
    )
    if (lineError) throw lineError
  }
  return session
}

export async function saveCountedQty(lineId: string, countedQty: number | null): Promise<void> {
  if (countedQty !== null && (!Number.isInteger(countedQty) || countedQty < 0)) {
    throw new Error('Count must be a whole number, 0 or more.')
  }
  const { error } = await supabase
    .from('stock_take_lines')
    .update({ counted_qty: countedQty })
    .eq('id', lineId)
  if (error) throw error
}

export async function submitSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('stock_take_sessions')
    .update({ status: 'submitted', submitted_at: new Date().toISOString() })
    .eq('id', sessionId)
  if (error) throw error
}

export async function decideSession(
  sessionId: string,
  decision: 'approved' | 'rejected',
  decidedBy: string
): Promise<void> {
  const { error } = await supabase
    .from('stock_take_sessions')
    .update({
      status: decision,
      decided_by: decidedBy,
      decided_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
  if (error) throw error
}
