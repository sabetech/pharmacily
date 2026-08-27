import { useState, useCallback, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Pill, MapPin, Truck, Bell, Shield, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useDrugSearch } from '@/hooks/useQueries'
import { formatDistance, formatStock } from '@/utils/helpers'
import type { DrugSearchResult } from '@/types'

export function Landing() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selectedDrug, setSelectedDrug] = useState<DrugSearchResult | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)

  const { data: drugs, isLoading } = useDrugSearch(query)

  // Get user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUserLocation({ lat: 37.7749, lng: -122.4194 }) // Default to SF
      )
    } else {
      setUserLocation({ lat: 37.7749, lng: -122.4194 })
    }
  }, [])

  const handleSearch = useCallback((drug: DrugSearchResult) => {
    setSelectedDrug(drug)
    setQuery(drug.name)
    setShowSuggestions(false)
    navigate(`/search?drug_id=${drug.id}`)
  }, [navigate])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedDrug) {
      navigate(`/search?drug_id=${selectedDrug.id}`)
    }
  }

  const features = [
    { icon: MapPin, title: 'Find Nearby', desc: 'Search pharmacies within 25km radius with real-time stock levels' },
    { icon: Pill, title: 'Compare Prices', desc: 'See prices across multiple pharmacies to find the best deal' },
    { icon: Bell, title: 'Stock Alerts', desc: 'Get notified when your medication is back in stock' },
    { icon: Shield, title: 'Verified Data', desc: 'Direct integration with pharmacy inventory systems' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-950">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-primary">
            <Pill className="h-8 w-8" />
            <span>Pharmacily</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/search" className="text-sm font-medium text-gray-700 hover:text-primary dark:text-gray-300">Search</Link>
            <Link to="/favorites" className="text-sm font-medium text-gray-700 hover:text-primary dark:text-gray-300">Favorites</Link>
            <Link to="/pharmacy/login" className="text-sm font-medium text-gray-700 hover:text-primary dark:text-gray-300">Pharmacy Login</Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Find Your Medication
            <br />
            <span className="text-primary">At Pharmacies Near You</span>
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-10 max-w-2xl mx-auto">
            Search any prescription drug and instantly see which nearby pharmacies have it in stock,
            compare prices, and get directions. Never drive from pharmacy to pharmacy again.
          </p>

          {/* Search Form */}
          <form onSubmit={handleSubmit} className="relative max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                type="search"
                placeholder="Search for a medication (e.g., Lipitor, Metformin...)"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setSelectedDrug(null)
                  setShowSuggestions(true)
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="pl-12 pr-40 h-14 text-lg"
                autoComplete="off"
              />
              <Button type="submit" className="absolute right-2 top-2 h-10 px-6" disabled={!selectedDrug}>
                Search
              </Button>
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && (drugs || isLoading) && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border rounded-lg shadow-lg max-h-60 overflow-auto z-50">
                {isLoading ? (
                  <div className="p-4 text-center text-gray-500">Searching...</div>
                ) : drugs && drugs.length > 0 ? (
                  drugs.map((drug) => (
                    <button
                      key={drug.id}
                      onClick={() => handleSearch(drug)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 border-b last:border-0"
                    >
                      <Pill className="h-5 w-5 text-primary" />
                      <div className="flex-1 text-left">
                        <p className="font-medium">{drug.name}</p>
                        <p className="text-sm text-gray-500">
                          {drug.generic_name} {drug.strength} {drug.form}
                        </p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-gray-500">No medications found</div>
                )}
              </div>
            )}
          </form>

          {/* Popular searches */}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {['Lipitor', 'Metformin', 'Lisinopril', 'Levothyroxine', 'Amoxicillin', 'Atorvastatin'].map((drug) => (
              <Badge key={drug} variant="outline" className="cursor-pointer hover:bg-primary/10" onClick={() => setQuery(drug)}>
                {drug}
              </Badge>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="mt-20 grid md:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <Card key={i} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <h3 className="font-semibold mb-1">{feature.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{feature.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* How it works */}
        <div className="mt-20">
          <h2 className="text-2xl font-bold text-center mb-10">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: '1', title: 'Search Your Medication', desc: 'Type the drug name or scan a prescription' },
              { step: '2', title: 'See Nearby Pharmacies', desc: 'View map with stock levels, prices, and hours' },
              { step: '3', title: 'Get Directions', desc: 'Navigate to the pharmacy or save for later' },
            ].map((item) => (
              <Card key={item.step} className="relative">
                <CardContent className="pt-6 text-center">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl">
                    {item.step}
                  </div>
                  <div className="pt-4">
                    <h3 className="font-semibold mb-2">{item.title}</h3>
                    <p className="text-gray-600 dark:text-gray-400">{item.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-12 mt-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p>Pharmacily - Making medication access easier</p>
          <p className="mt-2">Not a substitute for professional medical advice</p>
        </div>
      </footer>
    </div>
  )
}