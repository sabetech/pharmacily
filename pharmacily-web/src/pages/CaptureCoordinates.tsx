import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { isCaptureExpired, readCaptureExpiry, writeCapture } from '@/lib/capture'

export function CaptureCoordinates() {
  const { token = '' } = useParams()
  const expiry = readCaptureExpiry(token)
  const expired = isCaptureExpired(expiry)

  const [loading, setLoading] = useState(false)
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const locate = () => {
    if (!('geolocation' in navigator)) {
      setError('This device cannot share location.')
      return
    }
    setLoading(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoading(false)
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy })
      },
      (err) => {
        setLoading(false)
        if (err.code === err.PERMISSION_DENIED) {
          setError('Location is off. Turn it on in the browser bar and try again.')
        } else if (err.code === err.TIMEOUT) {
          setError('Location timed out. Try again.')
        } else {
          setError('Could not get location. Try again.')
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  }

  const send = () => {
    if (!coords || !token) return
    writeCapture(token, { ...coords, at: Date.now() })
    setSent(true)
  }

  return (
    <div className="grid min-h-screen place-items-center bg-ground p-4">
      <Card className="w-full max-w-[400px]">
        <CardContent className="pt-6">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-stock-bg text-stock-ink">
            <i className="ph ph-map-pin text-[22px]" aria-hidden="true" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-semibold text-ink">Share shop location</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Stand inside the shop, share the GPS fix, then send it to the desktop form.
          </p>

          {expired ? (
            <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-field bg-expiry-bg p-3 text-sm text-expiry-ink">
              <i className="ph ph-warning-circle mt-0.5 text-[18px]" aria-hidden="true" />
              <span>This link expired. Ask the desktop to make a new one.</span>
            </div>
          ) : sent ? (
            <div role="status" className="mt-4 flex items-start gap-2.5 rounded-field bg-sales-bg p-3 text-sm text-sales-ink">
              <i className="ph ph-check-circle mt-0.5 text-[18px]" aria-hidden="true" />
              <span>Sent. You can close this page.</span>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {error && (
                <div role="alert" className="flex items-start gap-2.5 rounded-field bg-expiry-tint p-3 text-sm text-expiry-ink">
                  <i className="ph ph-warning-circle mt-0.5 text-[18px] text-expiry-label" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}
              {coords && (
                <p className="rounded-field bg-field p-3 text-sm text-ink tnum">
                  {coords.lat}, {coords.lng} · accurate to {Math.round(coords.accuracy)} m
                </p>
              )}
              {!coords ? (
                <Button onClick={locate} disabled={loading} size="lg" className="h-12 w-full">
                  {loading && <i className="ph ph-circle-notch animate-spin text-[20px]" aria-hidden="true" />}
                  {loading ? 'Locating' : 'Use my location'}
                </Button>
              ) : (
                <Button onClick={send} size="lg" className="h-12 w-full">
                  Send to desktop
                </Button>
              )}
              {coords && (
                <button
                  onClick={locate}
                  className="inline-flex min-h-[44px] items-center justify-center text-sm font-semibold text-live"
                >
                  Retake location
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
