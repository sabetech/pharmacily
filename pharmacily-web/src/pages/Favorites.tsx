import { useAuth } from '@/hooks/useAuth'
import { useUserFavorites, useDeleteFavorite, useUpdateFavorite } from '@/hooks/useQueries'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Logo } from '@/components/Logo'
import { Link, useNavigate } from 'react-router-dom'
import { formatDistance } from '@/utils/helpers'
import { useToast } from '@/hooks/useToast'

export function Favorites() {
  const navigate = useNavigate()
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
      <div className="flex min-h-screen items-center justify-center bg-ground">
        <span className="icon-circle h-12 w-12">
          <i className="ph ph-circle-notch animate-spin text-[22px]" aria-hidden="true" />
        </span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ground">
      <header className="sticky top-0 z-40 bg-ground/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between px-4 py-4 md:px-10">
          <Link to="/" aria-label="Pharmacily home">
            <Logo size={32} />
          </Link>
          <Button variant="outline" size="sm" onClick={() => navigate('/')}>
            <i className="ph ph-arrow-left mr-1" aria-hidden="true" /> Back to search
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-4 py-8 md:px-10">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex items-center gap-3">
            <span className="icon-circle h-11 w-11 bg-expiry-bg text-expiry-ink">
              <i className="ph-fill ph-heart text-[20px]" aria-hidden="true" />
            </span>
            <h1 className="font-display text-2xl font-semibold text-ink">My favorites</h1>
          </div>

          {favorites?.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <span className="icon-circle mx-auto mb-4 h-16 w-16">
                  <i className="ph ph-heart text-[28px]" aria-hidden="true" />
                </span>
                <h3 className="mb-2 font-display text-xl font-semibold text-ink">No favorites yet</h3>
                <p className="mb-6 text-sm text-muted">
                  Save medications and pharmacies to get notified when they are in stock.
                </p>
                <Button onClick={() => navigate('/')}>
                  Search for medications
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {favorites?.map((fav) => (
                <Card key={`${fav.drug_id}-${fav.pharmacy_id || 'any'}`}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center">
                      <span className="icon-circle hidden h-[46px] w-[46px] rounded-field bg-stock-bg text-stock-label md:grid">
                        <i className="ph ph-pill text-[20px]" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <h3 className="text-[14.5px] font-semibold text-ink">{fav.drug_name}</h3>
                          <Badge variant="otc" className="text-[11px]">
                            {fav.drug_generic_name} {fav.drug_strength} {fav.drug_form}
                          </Badge>
                        </div>
                        {fav.pharmacy_name ? (
                          <div className="flex items-center gap-2 text-xs text-muted">
                            <i className="ph ph-map-pin text-[14px]" aria-hidden="true" />
                            <span>{fav.pharmacy_name}</span>
                            {fav.pharmacy_latitude && fav.pharmacy_longitude && (
                              <span className="tnum">
                                {formatDistance(
                                  Math.sqrt(
                                    Math.pow((fav.pharmacy_latitude! - 5.6037) * 111000, 2) +
                                    Math.pow((fav.pharmacy_longitude! + 0.1870) * 111000, 2)
                                  )
                                )}
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-muted">Any pharmacy</p>
                        )}
                      </div>

                      <div className="flex flex-row flex-wrap items-center gap-2 md:w-auto md:flex-col md:items-end">
                        <Label className="flex cursor-pointer items-center gap-2 text-[13px]">
                          <input
                            type="checkbox"
                            checked={fav.notify_on_stock}
                            onChange={() => handleToggleNotify(fav)}
                            className="h-4 w-4 rounded accent-[#1d7a5f]"
                          />
                          Notify when in stock
                        </Label>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemove(fav.drug_id, fav.pharmacy_id)}
                          >
                            <i className="ph ph-x mr-1" aria-hidden="true" /> Remove
                          </Button>
                          {fav.pharmacy_name && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(fav.pharmacy_address! + ', ' + fav.pharmacy_city! + ', ' + fav.pharmacy_state!)}`, '_blank')}
                            >
                              <i className="ph ph-navigation-arrow mr-1" aria-hidden="true" /> Directions
                            </Button>
                          )}
                        </div>
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
