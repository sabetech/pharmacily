import { z } from 'zod'
import seed from './drugs.seed.json'

export const AtcLevel1 = z.enum([
  'A',
  'B',
  'C',
  'D',
  'G',
  'H',
  'J',
  'L',
  'M',
  'N',
  'P',
  'R',
  'S',
  'V',
])

export const RxOtc = z.enum(['Rx', 'OTC'])

export const DrugSeedEntry = z.object({
  generic_name: z.string().min(1),
  brand_examples_gh: z.array(z.string()).default([]),
  strength: z.string().min(1),
  form: z.string().min(1),
  atc_code: z.string().min(1),
  atc_level1: AtcLevel1,
  atc_group: z.string().min(1),
  therapeutic_category: z.string().min(1),
  shopper_category: z.string().min(1),
  rx_otc: RxOtc,
  ghana_eml: z.boolean(),
  nhis_covered: z.boolean(),
  manufacturer_examples: z.array(z.string()).default([]),
})

export type DrugSeedEntry = z.infer<typeof DrugSeedEntry>

export const DrugSeedFile = z.object({
  meta: z.object({
    name: z.string(),
    version: z.string(),
    count: z.number(),
  }).passthrough(),
  drugs: z.array(DrugSeedEntry),
})

export type DrugSeedFile = z.infer<typeof DrugSeedFile>

export const drugSeed: DrugSeedFile = DrugSeedFile.parse(seed)

export const therapeuticCategories = [...new Set(drugSeed.drugs.map((d) => d.therapeutic_category))].sort()

export const shopperCategories = [...new Set(drugSeed.drugs.map((d) => d.shopper_category))].sort()

export const atcGroups = [...new Set(drugSeed.drugs.map((d) => `${d.atc_level1} — ${d.atc_group}`))].sort()

export function drugsByShopperCategory(shopper: string): DrugSeedEntry[] {
  return drugSeed.drugs.filter((d) => d.shopper_category === shopper)
}

export function drugsByTherapeuticCategory(therapeutic: string): DrugSeedEntry[] {
  return drugSeed.drugs.filter((d) => d.therapeutic_category === therapeutic)
}

export function drugsByAtcLevel1(level1: z.infer<typeof AtcLevel1>): DrugSeedEntry[] {
  return drugSeed.drugs.filter((d) => d.atc_level1 === level1)
}
