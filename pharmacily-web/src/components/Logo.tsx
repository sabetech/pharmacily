export function LogoMark({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden="true">
      <rect x="0" y="0" width="44" height="44" rx="14" fill="#0f4034" />
      <rect x="18.5" y="10" width="7" height="24" rx="3.5" fill="#d8ecb4" />
      <rect x="10" y="18.5" width="24" height="7" rx="3.5" fill="#a8dccf" />
    </svg>
  )
}

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="font-display text-[22px] font-semibold tracking-tight text-ink">
        Pharmacily
      </span>
    </span>
  )
}
