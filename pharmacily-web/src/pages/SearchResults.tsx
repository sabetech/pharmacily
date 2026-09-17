import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Logo } from '@/components/Logo'
import { useAuth } from '@/hooks/useAuth'
import { useInventorySearch, useCreateFavorite, useUserFavorites } from '@/hooks/useQueries'
import { ACCRA_CENTER, formatDistance, formatPrice, isOpenNow } from '@/utils/helpers'
import { StockPill } from '@/components/pharmacy/StockPill'
import type { SearchResult, DrugSearchResult } from '@/types'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'

const DEFAULT_CENTER = ACCRA_CENTER
const DEFAULT_ZOOM = 12

export function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: favorites } = useUserFavorites(user?.id || '')
  const createFavorite = useCreateFavorite(user?.id || '')

  const drugId = searchParams.get('drug_id')
  // Missing/invalid coords fall back to Accra so the page never searches nowhere
  const rawLat = parseFloat(searchParams.get('lat') || '')
  const rawLng = parseFloat(searchParams.get('lng') || '')
  const usingFallback =
    !Number.isFinite(rawLat) || !Number.isFinite(rawLng) || (rawLat === 0 && rawLng === 0)
  const lat = usingFallback ? ACCRA_CENTER.lat : rawLat
  const lng = usingFallback ? ACCRA_CENTER.lng : rawLng
  const radius = parseInt(searchParams.get('radius') || '25', 10)
  const [inStockOnly] = useState(true)
  const [selectedPharmacy, setSelectedPharmacy] = useState<SearchResult | null>(null)
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map')
  const [sortBy] = useState<'distance' | 'price'>('distance')

  const { data: results, isLoading, error, refetch } = useInventorySearch(
    drugId && lat && lng ? { drug_id: drugId, lat, lng, radius_km: radius, in_stock_only: inStockOnly } : null
  )

  const [drug, setDrug] = useState<DrugSearchResult | null>(null)
  useEffect(() => {
    if (drugId) {
      setDrug({ id: drugId, name: 'Loading...', generic_name: '', ndc_code: '', strength: null, form: null } as DrugSearchResult)
    }
  }, [drugId])

  const isFavorite = (pharmacyId: string, drugId: string) => {
    return favorites?.some(f => f.drug_id === drugId && f.pharmacy_id === pharmacyId) ?? false
  }

  const handleToggleFavorite = (pharmacyId: string) => {
    if (!user) {
      navigate('/auth/login')
      return
    }
    createFavorite.mutate({ drugId: drugId!, pharmacyId, notifyOnStock: false })
  }

  const handleNotifyMe = (pharmacyId: string) => {
    if (!user) {
      navigate('/auth/login')
      return
    }
    createFavorite.mutate({ drugId: drugId!, pharmacyId, notifyOnStock: true })
  }

  const updateFilters = (filters: Partial<{ in_stock_only: boolean; radius: number; sort: 'distance' | 'price' }>) => {
    const params = new URLSearchParams(searchParams)
    if (filters.in_stock_only !== undefined) params.set('in_stock_only', filters.in_stock_only.toString())
    if (filters.radius !== undefined) params.set('radius', filters.radius.toString())
    if (filters.sort !== undefined) params.set('sort', filters.sort)
    setSearchParams(params)
  }

  const sortedResults = useCallback(() => {
    if (!results) return []
    return [...results].sort((a, b) => {
      if (sortBy === 'distance') {
        return a.distance_meters - b.distance_meters
      }
      const priceA = a.inventory.price_cents ?? Infinity
      const priceB = b.inventory.price_cents ?? Infinity
      return priceA - priceB
    })
  }, [results, sortBy])

  const createMarkerIcon = (quantity: number) => {
    const stockClass = quantity <= 0 ? 'out-of-stock' : quantity <= 5 ? 'low-stock' : 'in-stock'
    return `
      <div class="pharmacy-marker ${stockClass}">
        <div class="marker-dot"></div>
      </div>
    `
  }

  if (!drugId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ground p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <span className="icon-circle mx-auto mb-4 h-12 w-12">
              <i className="ph ph-magnifying-glass text-[22px]" aria-hidden="true" />
            </span>
            <h2 className="mb-2 font-display text-xl font-semibold text-ink">No medication selected</h2>
            <p className="mb-4 text-sm text-muted">Search for a medication first.</p>
            <Button onClick={() => navigate('/')}>Go to search</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ground">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-ground/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between px-4 py-3 md:px-10">
          <Link to="/" aria-label="Pharmacily home">
            <Logo size={32} />
          </Link>
          <Button variant="outline" size="sm" onClick={() => navigate('/')}>
            <i className="ph ph-arrow-left mr-1" aria-hidden="true" /> Back to search
          </Button>
        </div>

        {/* Drug info bar */}
        <div className="px-4 md:px-10">
          <div className="mx-auto max-w-[1180px]">
            <div className="flex flex-wrap items-center gap-4 rounded-row bg-card px-5 py-3 shadow-resting">
              <span className="icon-circle h-11 w-11 bg-stock-bg text-stock-label">
                <i className="ph ph-pill text-[20px]" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[14.5px] font-semibold text-ink">{drug?.name || 'Loading...'}</p>
                <p className="text-xs text-muted">
                  {drug?.generic_name} {drug?.strength} {drug?.form}
                </p>
              </div>
              <div className="flex-1" />
              <div className="flex items-center gap-1.5 text-[13px] text-muted">
                <i className="ph ph-map-pin text-base" aria-hidden="true" />
                <span>Within {radius}km</span>
                {usingFallback && <Badge variant="otc">Near Accra</Badge>}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-[1180px] px-4 py-6 md:px-10">
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Filters */}
          <aside className="space-y-5 lg:col-span-1">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="icon-circle h-8 w-8">
                    <i className="ph ph-funnel text-[16px]" aria-hidden="true" />
                  </span>
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="flex cursor-pointer items-center gap-2 text-[13.5px]">
                    <input
                      type="checkbox"
                      checked={inStockOnly}
                      onChange={(e) => updateFilters({ in_stock_only: e.target.checked })}
                      className="h-4 w-4 rounded accent-[#1d7a5f]"
                    />
                    In stock only
                  </Label>
                </div>

                <div>
                  <Label htmlFor="radius" className="label-micro mb-1.5 block">
                    Search radius
                  </Label>
                  <select
                    id="radius"
                    value={radius}
                    onChange={(e) => updateFilters({ radius: parseInt(e.target.value, 10) })}
                    className="mt-1 w-full rounded-field border border-[rgba(16,50,40,0.1)] bg-field px-3 py-2.5 text-sm text-ink focus:border-live focus:outline-none"
                  >
                    <option value={5}>5 km</option>
                    <option value={10}>10 km</option>
                    <option value={25}>25 km</option>
                    <option value={50}>50 km</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="sort" className="label-micro mb-1.5 block">
                    Sort by
                  </Label>
                  <select
                    id="sort"
                    value={sortBy}
                    onChange={(e) => updateFilters({ sort: e.target.value as 'distance' | 'price' })}
                    className="mt-1 w-full rounded-field border border-[rgba(16,50,40,0.1)] bg-field px-3 py-2.5 text-sm text-ink focus:border-live focus:outline-none"
                  >
                    <option value="distance">Distance</option>
                    <option value="price">Price (low to high)</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <Card>
              <CardContent className="space-y-3 pt-6 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Pharmacies found</span>
                  <span className="tnum font-semibold text-ink">{results?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">In stock</span>
                  <span className="tnum font-semibold text-live">
                    {results?.filter(r => r.inventory.quantity > 0).length || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Lowest price</span>
                  <span className="tnum font-semibold text-ink">
                    {results?.length
                      ? formatPrice(Math.min(...results.map(r => r.inventory.price_cents ?? Infinity)))
                      : 'N/A'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* Results */}
          <div className="space-y-5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold text-ink">
                {results?.length || 0} pharmacies found
              </h2>
              <div className="flex rounded-full bg-ground p-[3px] shadow-resting">
                <button
                  onClick={() => setViewMode('map')}
                  className={`flex items-center gap-1 rounded-full px-4 py-[7px] text-[12.5px] font-semibold ${viewMode === 'map' ? 'bg-deep text-[#f4faf1]' : 'text-muted'}`}
                >
                  <i className="ph ph-map-pin" aria-hidden="true" /> Map
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-1 rounded-full px-4 py-[7px] text-[12.5px] font-semibold ${viewMode === 'list' ? 'bg-deep text-[#f4faf1]' : 'text-muted'}`}
                >
                  <i className="ph ph-list" aria-hidden="true" /> List
                </button>
              </div>
            </div>

            {viewMode === 'map' && (
              <Card className="overflow-hidden p-0">
                <div className="map-container">
                  <MapContainer
                    center={[lat || DEFAULT_CENTER.lat, lng || DEFAULT_CENTER.lng]}
                    zoom={DEFAULT_ZOOM}
                    scrollWheelZoom={true}
                    className="h-full w-full"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {sortedResults().map((result) => (
                      <Marker
                        key={result.pharmacy.id}
                        position={[result.pharmacy.latitude, result.pharmacy.longitude]}
                        icon={{
                          html: createMarkerIcon(result.inventory.quantity),
                          className: '',
                          iconSize: [22, 22],
                          iconAnchor: [11, 11],
                        } as any}
                      >
                        <Popup>
                          <div className="min-w-[200px] p-2">
                            <p className="font-display font-semibold text-ink">{result.pharmacy.name}</p>
                            <p className="text-[13px] text-muted">{result.pharmacy.address}</p>
                            <p className="mt-1 text-[13px]">
                              <StockPill quantity={result.inventory.quantity} />
                            </p>
                            {result.inventory.price_cents != null && (
                              <p className="tnum mt-1 font-display text-[17px] font-semibold text-ink">
                                {formatPrice(result.inventory.price_cents)}
                              </p>
                            )}
                            <p className="tnum mt-1 text-xs text-muted">
                              {formatDistance(result.distance_meters)} away
                            </p>
                            <Button
                              size="sm"
                              className="mt-2 w-full"
                              onClick={() => setSelectedPharmacy(result)}
                            >
                              View details
                            </Button>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
              </Card>
            )}

            {viewMode === 'list' && (
              <div className="space-y-3">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="animate-pulse rounded-row bg-card p-4 shadow-resting">
                      <div className="mb-2 h-4 w-1/4 rounded bg-ground" />
                      <div className="h-3 w-1/2 rounded bg-ground" />
                    </div>
                  ))
                ) : results?.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <span className="icon-circle mx-auto mb-4 h-12 w-12">
                        <i className="ph ph-map-pin text-[22px]" aria-hidden="true" />
                      </span>
                      <h3 className="mb-2 font-display text-lg font-semibold text-ink">No pharmacies found</h3>
                      <p className="mb-4 text-sm text-muted">
                        Try a wider radius or check back later.
                      </p>
                      <Button onClick={() => updateFilters({ radius: radius * 2 })}>
                        Expand to {radius * 2}km
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  sortedResults().map((result) => {
                    const trouble = result.inventory.quantity <= 5
                    return (
                      <div
                        key={result.pharmacy.id}
                        className={`flex flex-col gap-4 rounded-row p-4 shadow-resting md:flex-row md:items-center ${trouble ? 'bg-expiry-tint' : 'bg-card'}`}
                      >
                        <span className={`icon-circle hidden h-[46px] w-[46px] rounded-field md:grid ${trouble ? 'bg-expiry-bg text-expiry-label' : 'bg-stock-bg text-stock-label'}`}>
                          <i className="ph ph-pill text-[20px]" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <h3 className="text-[14.5px] font-semibold text-ink">{result.pharmacy.name}</h3>
                            {isFavorite(result.pharmacy.id, drugId!) && (
                              <i className="ph-fill ph-heart text-[15px] text-expiry-label" aria-label="Saved" />
                            )}
                            {result.pharmacy.chain_name && (
                              <Badge variant="otc" className="text-[11px]">
                                {result.pharmacy.chain_name}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted">
                            {result.pharmacy.address}, {result.pharmacy.city}, {result.pharmacy.state} {result.pharmacy.zip_code}
                          </p>
                          <div className="tnum mt-2 flex flex-wrap items-center gap-4 text-[13px] text-muted">
                            <span className="flex items-center gap-1">
                              <i className="ph ph-map-pin text-[14px]" aria-hidden="true" />
                              {formatDistance(result.distance_meters)}
                            </span>
                            <span className="flex items-center gap-1">
                              {isOpenNow(result.pharmacy.hours) ? (
                                <span className="text-live">● Open now</span>
                              ) : (
                                <span>● Closed</span>
                              )}
                            </span>
                            {result.pharmacy.phone && (
                              <a href={`tel:${result.pharmacy.phone}`} className="font-semibold text-live">
                                {result.pharmacy.phone}
                              </a>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-row items-center justify-between gap-2 md:w-48 md:flex-col md:items-end">
                          <div className="text-left md:text-right">
                            <StockPill quantity={result.inventory.quantity} />
                            {result.inventory.price_cents != null && (
                              <p className="tnum mt-1 font-display text-[17px] font-semibold text-ink">
                                {formatPrice(result.inventory.price_cents)}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setSelectedPharmacy(result)}>
                              Details
                            </Button>
                            <Button
                              size="sm"
                              variant={isFavorite(result.pharmacy.id, drugId!) ? 'secondary' : 'outline'}
                              onClick={() => handleToggleFavorite(result.pharmacy.id)}
                            >
                              {isFavorite(result.pharmacy.id, drugId!) ? 'Saved' : 'Save'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {error && (
              <Card className="bg-expiry-tint">
                <CardContent className="py-8 text-center">
                  <p className="text-sm text-expiry-ink">Could not load results. Try again.</p>
                  <Button onClick={() => refetch()} className="mt-4">Retry</Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Pharmacy detail modal */}
      {selectedPharmacy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,64,52,0.32)] p-4">
          <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto shadow-modal">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl">{selectedPharmacy.pharmacy.name}</CardTitle>
              <button
                onClick={() => setSelectedPharmacy(null)}
                className="icon-circle h-10 w-10"
                aria-label="Close"
              >
                <i className="ph ph-x text-[18px]" aria-hidden="true" />
              </button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted">
                <i className="ph ph-map-pin text-base" aria-hidden="true" />
                <span>{selectedPharmacy.pharmacy.address}, {selectedPharmacy.pharmacy.city}, {selectedPharmacy.pharmacy.state} {selectedPharmacy.pharmacy.zip_code}</span>
              </div>
              {selectedPharmacy.pharmacy.phone && (
                <a href={`tel:${selectedPharmacy.pharmacy.phone}`} className="flex items-center gap-2 text-sm font-semibold text-live">
                  <i className="ph ph-phone text-base" aria-hidden="true" />
                  {selectedPharmacy.pharmacy.phone}
                </a>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <StockPill quantity={selectedPharmacy.inventory.quantity} />
                {selectedPharmacy.inventory.price_cents != null && (
                  <span className="tnum font-display text-xl font-semibold text-ink">
                    {formatPrice(selectedPharmacy.inventory.price_cents)}
                  </span>
                )}
              </div>
              <div className="border-t border-[rgba(16,50,40,0.1)] pt-4">
                <h4 className="label-micro mb-2">Hours</h4>
                {selectedPharmacy.pharmacy.hours ? (
                  <div className="tnum grid grid-cols-2 gap-1 text-[13px] text-muted">
                    {Object.entries(selectedPharmacy.pharmacy.hours).map(([day, hours]) => (
                      <div key={day} className={isOpenNow({ [day]: hours }) ? 'font-semibold text-live' : ''}>
                        {day.charAt(0).toUpperCase() + day.slice(1)}: {hours || 'Closed'}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">Hours not available</p>
                )}
              </div>
              <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                <Button className="flex-1" onClick={() => handleToggleFavorite(selectedPharmacy.pharmacy.id)}>
                  {isFavorite(selectedPharmacy.pharmacy.id, drugId!) ? 'Remove from favorites' : 'Save to favorites'}
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => handleNotifyMe(selectedPharmacy.pharmacy.id)}>
                  <i className="ph ph-bell mr-1" aria-hidden="true" /> Notify me
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(selectedPharmacy.pharmacy.address + ', ' + selectedPharmacy.pharmacy.city + ', ' + selectedPharmacy.pharmacy.state)}`, '_blank')}
                >
                  <i className="ph ph-navigation-arrow mr-1" aria-hidden="true" /> Directions
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
