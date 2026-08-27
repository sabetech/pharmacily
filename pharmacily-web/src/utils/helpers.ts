import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`
  }
  return `${(meters / 1000).toFixed(1)}km`
}

export function formatPrice(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) {
    return 'Price not available'
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

export function formatStock(quantity: number): { label: string; class: string } {
  if (quantity <= 0) {
    return { label: 'Out of stock', class: 'text-red-600 dark:text-red-400' }
  }
  if (quantity <= 5) {
    return { label: `Low stock (${quantity})`, class: 'text-yellow-600 dark:text-yellow-400' }
  }
  if (quantity <= 20) {
    return { label: `In stock (${quantity})`, class: 'text-green-600 dark:text-green-400' }
  }
  return { label: `In stock (${quantity}+)`, class: 'text-green-600 dark:text-green-400' }
}

export function formatHours(hours: Record<string, string> | null | undefined): string[] {
  if (!hours) return ['Hours not available']
  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  return days.map((day, i) => `${dayNames[i]}: ${hours[day] || 'Closed'}`)
}

export function isOpenNow(hours: Record<string, string> | null | undefined): boolean {
  if (!hours) return false
  const now = new Date()
  const day = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()]
  const todayHours = hours[day]
  if (!todayHours || todayHours === 'Closed') return false

  // Parse hours like "9-21" or "9:00-21:00"
  const [openStr, closeStr] = todayHours.split('-')
  if (!openStr || !closeStr) return false

  const parseTime = (timeStr: string) => {
    const [hours, minutes = '0'] = timeStr.split(':').map(Number)
    return hours * 60 + minutes
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const openMinutes = parseTime(openStr)
  const closeMinutes = parseTime(closeStr)

  return nowMinutes >= openMinutes && nowMinutes < closeMinutes
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

export function generateAddressHash(address: string): string {
  // Simple hash for caching - in production use crypto.subtle.digest
  let hash = 0
  for (let i = 0; i < address.length; i++) {
    const char = address.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16)
}