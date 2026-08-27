import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, MarkerClusterGroup } from 'react-leaflet'
import { MapPin, Filter, ChevronDown, Navigation, Bell, Heart, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import { useInventorySearch, useCreateFavorite, useUserFavorites } from '@/hooks/useQueries'
import { formatDistance, formatPrice, formatStock, isOpenNow } from '@/utils/helpers'
import type { SearchResult, DrugSearchResult } from '@/types'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'

const DEFAULT_CENTER = { lat: 37.7749, lng: -122.4194 }
const DEFAULT_ZOOM = 11

export function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: favorites } = useUserFavorites(user?.id || '')
  const createFavorite = useCreateFavorite(user?.id || '')

  const drugId = searchParams.get('drug_id')
  const lat = parseFloat(searchParams.get('lat') || '0')
  const lng = parseFloat(searchParams.get('lng') || '0')
  const radius = parseInt(searchParams.get('radius') || '25', 10)
  const [inStockOnly, setInStockOnly] = useState(true)
  const [showMap, setShowMap] = useState(true)
  const [selectedPharmacy, setSelectedPharmacy] = useState<SearchResult | null>(null)
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map')
  const [sortBy, setSortBy] = useState<'distance' | 'price'>('distance')

  const { data: results, isLoading, error, refetch } = useInventorySearch(
    drugId && lat && lng ? { drug_id: drugId, lat, lng, radius_km: radius, in_stock_only: inStockOnly } : null
  )

  // Get drug info
  const [drug, setDrug] = useState<DrugSearchResult | null>(null)
  useEffect(() => {
    if (drugId) {
      // In a real app, fetch drug details
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

  // Custom marker icon
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
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-semibold mb-4">No medication selected</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Please search for a medication first</p>
            <Button onClick={() => navigate('/')}>Go to Search</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 font-bold text-xl text-primary">
              <span className="text-2xl">💊</span>
              <span>Pharmacily</span>
            </Link>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                ← Back to Search
              </Button>
            </div>
          </div>
        </div>

        {/* Drug info bar */}
        <div className="px-4 py-3 bg-primary/5 dark:bg-primary/10 border-b">
          <div className="container mx-auto flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">💊</span>
              <div>
                <p className="font-semibold">{drug?.name || 'Loading...'}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {drug?.generic_name} {drug?.strength} {drug?.form}
                </p>
              </div>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <MapPin className="h-4 w-4" />
              <span>Searching within {radius}km</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Filters Sidebar */}
          <aside className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inStockOnly}
                      onChange={(e) => updateFilters({ in_stock_only: e.target.checked })}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm">In stock only</span>
                  </Label>
                </div>

                <div>
                  <Label htmlFor="radius" className="block text-sm font-medium mb-1">
                    Search Radius
                  </Label>
                  <select
                    id="radius"
                    value={radius}
                    onChange={(e) => updateFilters({ radius: parseInt(e.target.value, 10) })}
                    className="mt-1 w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 text-sm"
                  >
                    <option value={5}>5 km</option>
                    <option value={10}>10 km</option>
                    <option value={25}>25 km</option>
                    <option value={50}>50 km</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="sort" className="block text-sm font-medium mb-1">
                    Sort By
                  </Label>
                  <select
                    id="sort"
                    value={sortBy}
                    onChange={(e) => updateFilters({ sort: e.target.value as 'distance' | 'price' })}
                    className="mt-1 w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 text-sm"
                  >
                    <option value="distance">Distance</option>
                    <option value="price">Price (Low to High)</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Pharmacies found</span>
                    <span className="font-semibold">{results?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">In stock</span>
                    <span className="font-semibold text-green-600">
                      {results?.filter(r => r.inventory.quantity > 0).length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Lowest price</span>
                    <span className="font-semibold">
                      {results?.length
                        ? formatPrice(Math.min(...results.map(r => r.inventory.price_cents ?? Infinity)))
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* Results - Map & List */}
          <div className="lg:col-span-2 space-y-6">
            {/* View Toggle */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {results?.length || 0} pharmacies found
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === 'map' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('map')}
                >
                  <MapPin className="h-4 w-4 mr-1" /> Map
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  List
                </Button>
              </div>
            </div>

            {/* Map View */}
            {viewMode === 'map' && (
              <Card className="overflow-hidden">
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
                    {/* User location marker */}
                    {lat && lng && (
                      <Marker position={[lat, lng]} icon={undefined}>
                        <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center">
                          <span className="text-white text-xs font-bold">You</span>
                        </div>
                      </Marker>
                    )}
                    {/* Pharmacy markers */}
                    <MarkerClusterGroup
                      options={{
                        spiderfyOnMaxZoom: true,
                        showCoverageOnHover: false,
                        zoomToBoundsOnClick: true,
                        maxClusterRadius: 50,
                        iconCreateFunction: `
                          function(cluster) {
                            return L.divIcon({
                              html: '<div class="cluster-marker"><span>' + cluster.getChildCount() + '</span></div>',
                              className: 'marker-cluster',
                              iconSize: L.point(40, 40)
                            });
                          }
                        `,
                      }}
                    >
                      {sortedResults().map((result) => (
                        <Marker
                          key={result.pharmacy.id}
                          position={[result.pharmacy.latitude, result.pharmacy.longitude]}
                          icon={{
                            html: createMarkerIcon(result.inventory.quantity),
                            className: '',
                            iconSize: [22, 22],
                            iconAnchor: [11, 11],
                          }}
                        >
                          <Popup>
                            <div className="min-w-[200px] p-2">
                              <p className="font-semibold">{result.pharmacy.name}</p>
                              <p className="text-sm text-gray-600">{result.pharmacy.address}</p>
                              <p className="text-sm">
                                <span className={formatStock(result.inventory.quantity).class}>
                                  {formatStock(result.inventory.quantity).label}
                                </span>
                              </p>
                              {result.inventory.price_cents && (
                                <p className="text-sm font-medium text-primary">
                                  {formatPrice(result.inventory.price_cents)}
                                </p>
                              )}
                              <p className="text-xs text-gray-500 mt-1">
                                {formatDistance(result.distance_meters)} away
                              </p>
                              <Button
                                size="sm"
                                className="w-full mt-2"
                                onClick={() => setSelectedPharmacy(result)}
                              >
                                View Details
                              </Button>
                            </div>
                          </Popup>
                        </Marker>
                      ))}
                    </MarkerClusterGroup>
                  </MapContainer>
                </div>
              </Card>
            )}

            {/* List View */}
            {viewMode === 'list' && (
              <div className="space-y-4">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="pt-6">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2" />
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                      </CardContent>
                    </Card>
                  ))
                ) : results?.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center py-12">
                      <MapPin className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No pharmacies found</h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-4">
                        Try expanding your search radius or check back later
                      </p>
                      <Button onClick={() => updateFilters({ radius: radius * 2 })}>
                        Expand to {radius * 2}km
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  sortedResults().map((result) => (
                    <Card key={result.pharmacy.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="pt-6">
                        <div className="flex flex-col md:flex-row md:items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-lg">{result.pharmacy.name}</h3>
                              {isFavorite(result.pharmacy.id, drugId!) && (
                                <Heart className="h-4 w-4 text-red-500 fill-current" />
                              )}
                              {result.pharmacy.chain_name && (
                                <Badge variant="outline" className="text-xs">
                                  {result.pharmacy.chain_name}
                                </Badge>
                              )}
                            </div>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                              {result.pharmacy.address}, {result.pharmacy.city}, {result.pharmacy.state} {result.pharmacy.zip_code}
                            </p>
                            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                {formatDistance(result.distance_meters)}
                              </span>
                              <span className="flex items-center gap-1">
                                {isOpenNow(result.pharmacy.hours) ? (
                                  <span className="text-green-600">● Open now</span>
                                ) : (
                                  <span className="text-gray-500">● Closed</span>
                                )}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col items-end md:items-center gap-2 md:w-48">
                            <div className="text-right">
                              <p className={formatStock(result.inventory.quantity).class}>
                                {formatStock(result.inventory.quantity).label}
                              </p>
                              {result.inventory.price_cents && (
                                <p className="text-lg font-bold text-primary mt-1">
                                  {formatPrice(result.inventory.price_cents)}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col gap-2 w-full md:w-auto">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedPharmacy(result)}
                                className="w-full md:w-auto"
                              >
                                Details
                              </Button>
                              <Button
                                size="sm"
                                variant={isFavorite(result.pharmacy.id, drugId!) ? 'secondary' : 'outline'}
                                onClick={() => handleToggleFavorite(result.pharmacy.id)}
                                className="w-full md:w-auto"
                              >
                                {isFavorite(result.pharmacy.id, drugId!) ? 'Saved' : 'Save'}
                              </Button>
                              {!isFavorite(result.pharmacy.id, drugId!) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleNotifyMe(result.pharmacy.id)}
                                  className="w-full md:w-auto"
                                >
                                  <Bell className="h-4 w-4 mr-1" /> Notify
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="link"
                                onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(result.pharmacy.address + ', ' + result.pharmacy.city + ', ' + result.pharmacy.state)}`, '_blank')}
                                className="w-full md:w-auto"
                              >
                                <Navigation className="h-4 w-4 mr-1" /> Directions
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}

            {/* Error state */}
            {error && (
              <Card className="border-destructive">
                <CardContent className="pt-6 text-center py-8">
                  <p className="text-destructive">Failed to load results. Please try again.</p>
                  <Button onClick={() => refetch()} className="mt-4">Retry</Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Pharmacy Detail Modal */}
      {selectedPharmacy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between border-b">
              <CardTitle>{selectedPharmacy.pharmacy.name}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setSelectedPharmacy(null)}>
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <MapPin className="h-4 w-4" />
                <span>{selectedPharmacy.pharmacy.address}, {selectedPharmacy.pharmacy.city}, {selectedPharmacy.pharmacy.state} {selectedPharmacy.pharmacy.zip_code}</span>
              </div>
              {selectedPharmacy.pharmacy.phone && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  📞 {selectedPharmacy.pharmacy.phone}
                </div>
              )}
              <div className="text-sm">
                <span className={formatStock(selectedPharmacy.inventory.quantity).class}>
                  {formatStock(selectedPharmacy.inventory.quantity).label}
                </span>
              </div>
              {selectedPharmacy.inventory.price_cents && (
                <div className="text-xl font-bold text-primary">
                  {formatPrice(selectedPharmacy.inventory.price_cents)}
                </div>
              )}
              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">Hours</h4>
                {selectedPharmacy.pharmacy.hours ? (
                  <div className="grid grid-cols-2 gap-1 text-sm">
                    {Object.entries(selectedPharmacy.pharmacy.hours).map(([day, hours]) => (
                      <div key={day} className={isOpenNow({ [day]: hours }) ? 'font-medium text-green-600' : ''}>
                        {day.charAt(0).toUpperCase() + day.slice(1)}: {hours || 'Closed'}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">Hours not available</p>
                )}
              </div>
              <div className="flex gap-2 pt-4">
                <Button className="flex-1" onClick={() => handleToggleFavorite(selectedPharmacy.pharmacy.id)}>
                  {isFavorite(selectedPharmacy.pharmacy.id, drugId!) ? 'Remove from Favorites' : 'Save to Favorites'}
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => handleNotifyMe(selectedPharmacy.pharmacy.id)}>
                  <Bell className="h-4 w-4 mr-1" /> Notify Me
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(selectedPharmacy.pharmacy.address)}`, '_blank')}>
                  <Navigation className="h-4 w-4 mr-1" /> Directions
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function Link({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) {
  return <a href={to} className={className}>{children}</a>
}