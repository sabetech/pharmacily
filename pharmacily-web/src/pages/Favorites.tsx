import { useAuth } from '@/hooks/useAuth'
import { useUserFavorites, useDeleteFavorite, useUpdateFavorite } from '@/hooks/useQueries'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Heart, Bell, MapPin, X, Navigation } from 'lucide-react'
import { formatDistance, formatPrice, formatStock } from '@/utils/helpers'
import { useToast } from '@/hooks/useToast'
import Link from 'next/link'

export function Favorites() {
  const { user } = useAuth()
  const { data: favorites, isLoading } = useUserFavorites(user?.id || '')
  const deleteFavorite = useDeleteFavorite(user?.id || '')
  const updateFavorite = useUpdateFavorite(user?.id || '')
  const { toast } = useToast()

  const handleRemove = (drugId: string, pharmacyId: string | null) => {
    deleteFavorite.mutate({ drugId, pharmacyId }, {
      onSuccess: () => toast({ title: 'Removed from favorites' }),
    })
  }

  const handleToggleNotify = (fav: any) => {
    updateFavorite.mutate({
      drugId: fav.drug_id,
      pharmacyId: fav.pharmacy_id,
      notifyOnStock: !fav.notify_on_stock,
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-primary">
            <span className="text-2xl">💊</span>
            <span>Pharmacily</span>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Heart className="h-8 w-8 text-red-500" />
              My Favorites
            </h1>
          </div>

          {favorites?.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <Heart className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold mb-2">No favorites yet</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Save medications and pharmacies to get notified when they're in stock
                </p>
                <Button asChild>
                  <Link to="/search">Search for medications</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {favorites?.map((fav) => (
                <Card key={`${fav.drug_id}-${fav.pharmacy_id || 'any'}`}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg">{fav.drug_name}</h3>
                          <Badge variant="secondary" className="text-xs">
                            {fav.drug_generic_name} {fav.drug_strength} {fav.drug_form}
                          </Badge>
                        </div>
                        {fav.pharmacy_name ? (
                          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" />
                              {fav.pharmacy_name}
                            </span>
                            {fav.pharmacy_latitude && fav.pharmacy_longitude && (
                              <span>
                                {formatDistance(
                                  Math.sqrt(
                                    Math.pow((fav.pharmacy_latitude! - 37.7749) * 111000, 2) +
                                    Math.pow((fav.pharmacy_longitude! + 122.4194) * 111000, 2)
                                  )
                                )}
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">Any pharmacy</p>
                        )}
                      </div>

                      <div className="flex flex-col items-end md:items-center gap-2 md:w-64">
                        <Label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={fav.notify_on_stock}
                            onChange={() => handleToggleNotify(fav)}
                            className="rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <span className="text-sm">Notify when in stock</span>
                        </Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemove(fav.drug_id, fav.pharmacy_id)}
                        >
                          <X className="h-4 w-4 mr-1" /> Remove
                        </Button>
                        {fav.pharmacy_name && (
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(fav.pharmacy_address! + ', ' + fav.pharmacy_city! + ', ' + fav.pharmacy_state!)}`, '_blank')}
                          >
                            <Navigation className="h-4 w-4 mr-1" /> Directions
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function Link({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) {
  return <a href={to} className={className}>{children}</a>
}