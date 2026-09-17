import { useState, useCallback, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Logo } from '@/components/Logo'
import { useDrugSearch } from '@/hooks/useQueries'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { ACCRA_CENTER } from '@/utils/helpers'
import type { DrugSearchResult } from '@/types'

export function Landing() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selectedDrug, setSelectedDrug] = useState<DrugSearchResult | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [userLocation, setUserLocation] = useState(ACCRA_CENTER)

  // Debounced so autocomplete doesn't fire per keystroke
  const debouncedQuery = useDebouncedValue(query, 300)
  const { data: drugs, isLoading } = useDrugSearch(debouncedQuery)

  // Browser geolocation; Accra fallback (never San Francisco)
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserLocation(ACCRA_CENTER),
      { timeout: 8000, maximumAge: 300000 }
    )
  }, [])

  const goToResults = useCallback(
    (drug: DrugSearchResult) => {
      const params = new URLSearchParams({
        drug_id: drug.id,
        lat: userLocation.lat.toString(),
        lng: userLocation.lng.toString(),
        radius: '25',
      })
      navigate(`/search?${params}`)
    },
    [navigate, userLocation]
  )

  const handleSearch = useCallback(
    (drug: DrugSearchResult) => {
      setSelectedDrug(drug)
      setQuery(drug.name)
      setShowSuggestions(false)
      goToResults(drug)
    },
    [goToResults]
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedDrug) {
      goToResults(selectedDrug)
    }
  }

  const features = [
    { icon: 'ph-map-pin', title: 'Find nearby', desc: 'See pharmacies within 25km with live stock levels.' },
    { icon: 'ph-pill', title: 'Compare prices', desc: 'Prices in Gh₵ across pharmacies, updated by staff.' },
    { icon: 'ph-bell', title: 'Stock alerts', desc: 'Get notified when your medication is back on the shelf.' },
    { icon: 'ph-shield-check', title: 'Verified data', desc: 'Stock entered by verified pharmacy staff.' },
  ]

  return (
    <div className="min-h-screen bg-ground">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-ground/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between px-4 py-4 md:px-10">
          <Link to="/" aria-label="Pharmacily home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <Link to="/search" className="text-sm font-medium">Search</Link>
            <Link to="/favorites" className="text-sm font-medium">Favorites</Link>
            <Link to="/pharmacy/login" className="text-sm font-medium">Pharmacy login</Link>
          </nav>
          <Link to="/pharmacy/login" className="md:hidden">
            <span className="icon-circle h-10 w-10">
              <i className="ph ph-storefront text-[19px]" aria-hidden="true" />
            </span>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-[1180px] px-4 pb-24 pt-14 md:px-10 md:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-display text-[46px] font-semibold leading-[1.05] tracking-tight text-ink">
            Find your medication
            <br />
            at pharmacies near you
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[15px] leading-[1.65] text-[#3d5850]">
            Search any drug and instantly see which nearby pharmacies have it in stock,
            compare prices, and get directions. No more walking from counter to counter.
          </p>

          {/* Search */}
          <form onSubmit={handleSubmit} className="relative mx-auto mt-10 max-w-2xl">
            <div className="relative">
              <i
                className="ph ph-magnifying-glass pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[20px] text-live"
                aria-hidden="true"
              />
              <Input
                type="search"
                placeholder="Search for a medication (e.g. Amoxicillin, Paracetamol...)"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setSelectedDrug(null)
                  setShowSuggestions(true)
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="h-14 rounded-full pl-13 pr-36 text-[15px]"
                autoComplete="off"
              />
              <Button type="submit" className="absolute right-2 top-2 h-10" disabled={!selectedDrug}>
                Search
              </Button>
            </div>

            {showSuggestions && (drugs || isLoading) && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-60 overflow-auto rounded-row bg-card shadow-floating">
                {isLoading ? (
                  <div className="p-4 text-center text-sm text-muted">Searching...</div>
                ) : drugs && drugs.length > 0 ? (
                  drugs.map((drug) => (
                    <button
                      key={drug.id}
                      onClick={() => handleSearch(drug)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-field"
                    >
                      <span className="icon-circle h-10 w-10">
                        <i className="ph ph-pill text-[19px]" aria-hidden="true" />
                      </span>
                      <span className="flex-1 text-left">
                        <span className="block text-[14.5px] font-semibold text-ink">{drug.name}</span>
                        <span className="block text-xs text-muted">
                          {drug.generic_name} {drug.strength} {drug.form}
                        </span>
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-sm text-muted">No medications found</div>
                )}
              </div>
            )}
          </form>

          {/* Popular searches */}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {['Amoxicillin', 'Paracetamol', 'Lisinopril', 'Metformin', 'Atorvastatin'].map((drug) => (
              <button key={drug} onClick={() => setQuery(drug)}>
                <Badge variant="outline" className="cursor-pointer bg-card">
                  {drug}
                </Badge>
              </button>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="mt-20 grid gap-5 md:grid-cols-4">
          {features.map((feature) => (
            <Card key={feature.title}>
              <CardContent className="pt-6">
                <span className="icon-circle mb-4 h-10 w-10">
                  <i className={`ph ${feature.icon} text-[19px]`} aria-hidden="true" />
                </span>
                <h3 className="mb-1 font-display text-base font-semibold text-ink">{feature.title}</h3>
                <p className="text-[13.5px] leading-relaxed text-[#3d5850]">{feature.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* How it works */}
        <div className="mt-20">
          <h2 className="mb-10 text-center font-display text-2xl font-semibold text-ink">
            How it works
          </h2>
          <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-3">
            {[
              { step: '1', title: 'Search your medication', desc: 'Type the drug name from your prescription.' },
              { step: '2', title: 'See nearby pharmacies', desc: 'View the map with stock levels, prices and hours.' },
              { step: '3', title: 'Get directions', desc: 'Walk in, or save it and get notified later.' },
            ].map((item) => (
              <Card key={item.step} className="relative">
                <CardContent className="pt-6 text-center">
                  <div className="absolute -top-4 left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full bg-deep font-display text-xl font-semibold text-[#f4faf1]">
                    {item.step}
                  </div>
                  <div className="pt-4">
                    <h3 className="mb-2 font-display font-semibold text-ink">{item.title}</h3>
                    <p className="text-[13.5px] text-[#3d5850]">{item.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-12">
        <div className="mx-auto max-w-[1180px] px-4 text-center text-sm text-muted md:px-10">
          <p>Pharmacily — making medication access easier.</p>
          <p className="mt-2 text-[13px]">Not a substitute for professional medical advice.</p>
        </div>
      </footer>
    </div>
  )
}
