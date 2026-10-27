export const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')

/** An ISO time to a short local date and time. */
export const when = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '-'

export const usd = (value: number | null | undefined) =>
  value == null
    ? '-'
    : (value < 0 ? '-$' : '$') + Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const signedUsd = (value: number | null | undefined) => (value == null ? '-' : (value > 0 ? '+' : '') + usd(value))

export const count = (value: number | null | undefined) => (value == null ? '-' : value.toLocaleString())

export const local = (amount: number | null | undefined, currency: string | null | undefined) =>
  amount == null ? null : `${currency === 'KES' ? 'KSh' : currency ?? ''} ${Math.round(amount).toLocaleString()}`.trim()
