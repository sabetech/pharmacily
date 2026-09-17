import type { ReactNode } from 'react'

export interface PharmacyTopBarProps {
  title: string
  kicker: string
  action?: ReactNode
}

export function PharmacyTopBar({ title, kicker, action }: PharmacyTopBarProps) {
  return (
    <div className="flex h-24 flex-none items-center justify-between px-4 md:px-8">
      <div>
        <p className="label-micro">{kicker}</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-ink">{title}</h1>
      </div>
      {action}
    </div>
  )
}
