import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Calculate a policy's end date from its start date and term in years.
 *
 * Policy periods are inclusive, so a 1-year policy starting 13-11-2026
 * ends on 12-11-2027. Arithmetic is done on local date parts to avoid the
 * off-by-one day issues caused by parsing `YYYY-MM-DD` as UTC.
 */
export function calculatePolicyEndDate(startDate: string, policyTermYears: number): string {
  const parts = startDate.split('-').map(Number)
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return ''

  const [year, month, day] = parts
  const end = new Date(year, month - 1, day)
  if (Number.isNaN(end.getTime())) return ''

  end.setFullYear(end.getFullYear() + policyTermYears)
  end.setDate(end.getDate() - 1)

  const mm = String(end.getMonth() + 1).padStart(2, '0')
  const dd = String(end.getDate()).padStart(2, '0')
  return `${end.getFullYear()}-${mm}-${dd}`
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}