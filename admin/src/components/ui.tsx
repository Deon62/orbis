import { Check, Copy, X, type LucideIcon } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { adminGet, adminPost, AdminError } from '../lib/api'
import { cn } from '../lib/format'

/** The signed-in admin: their token and a way out. */
export const AdminContext = createContext<{ token: string; signOut: () => void }>({ token: '', signOut: () => {} })
export const useAdmin = () => useContext(AdminContext)

/** Loads an admin endpoint; signs out if the token stops working. */
export function useAdminData<T>(path: string) {
  const { token, signOut } = useAdmin()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await adminGet<T>(path, token))
    } catch (reason) {
      if (reason instanceof AdminError && reason.status === 401) signOut()
      setError((reason as Error).message)
    } finally {
      setLoading(false)
    }
  }, [path, token, signOut])

  useEffect(() => {
    void load()
  }, [load])

  return { data, error, loading, reload: load }
}

/** Sends one admin change; signs out if the token stops working. */
export function useAdminPost() {
  const { token, signOut } = useAdmin()
  return useCallback(
    async <T,>(path: string, body: unknown = {}) => {
      try {
        return await adminPost<T>(path, token, body)
      } catch (reason) {
        if (reason instanceof AdminError && reason.status === 401) signOut()
        throw reason
      }
    },
    [token, signOut],
  )
}

export function PageHeader({ title, note, children }: { title: string; note?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">{title}</h1>
        {note && <p className="mt-1 text-sm text-muted">{note}</p>}
      </div>
      {children}
    </div>
  )
}

export function Panel({ title, action, children, flush }: { title?: string; action?: ReactNode; children: ReactNode; flush?: boolean }) {
  return (
    <section className="border border-line bg-surface">
      {title && (
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </header>
      )}
      <div className={flush ? undefined : 'p-5'}>{children}</div>
    </section>
  )
}

export function Stat({ label, value, note, to, tone }: { label: string; value: ReactNode; note?: ReactNode; to?: string; tone?: 'good' | 'bad' | 'warn' }) {
  const body = (
    <>
      <p className="type-label text-muted">{label}</p>
      <p className={cn('mt-3 text-[1.75rem] font-semibold tracking-[-0.03em] tabular-nums', tone === 'good' && 'text-good', tone === 'bad' && 'text-bad', tone === 'warn' && 'text-warn')}>
        {value}
      </p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </>
  )
  return to ? (
    <Link to={to} className="block border border-line bg-surface p-5 transition-colors hover:bg-hover">
      {body}
    </Link>
  ) : (
    <div className="border border-line bg-surface p-5">{body}</div>
  )
}

export function Notice({ children, tone = 'bad' }: { children: ReactNode; tone?: 'bad' | 'good' }) {
  return <p className={cn('border px-4 py-2.5 text-sm', tone === 'bad' ? 'border-bad/50 text-bad' : 'border-good/50 text-good')}>{children}</p>
}

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="flex size-11 items-center justify-center border border-line text-muted">
        <Icon size={20} aria-hidden="true" />
      </span>
      <p className="mt-4 text-sm font-medium">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-muted">{children}</p>}
    </div>
  )
}

export function Loading() {
  return <p className="px-5 py-10 text-center text-sm text-muted">Loading</p>
}

/** A table with a label row; rows are given as ready-made cells. */
export function Table({ columns, children, minWidth = '48rem' }: { columns: Array<string | { label: string; right?: boolean }>; children: ReactNode; minWidth?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        <thead>
          <tr className="type-label border-b border-line text-muted">
            {columns.map((column, index) => {
              const { label, right } = typeof column === 'string' ? { label: column, right: false } : column
              return (
                <th key={index} scope="col" className={cn('px-4 py-3 font-medium first:pl-5 last:pr-5', right && 'text-right')}>
                  {label}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  )
}

export const cell = 'px-4 py-3 first:pl-5 last:pr-5'
export const num = `${cell} text-right font-mono text-xs tabular-nums`

/** Segmented filter, e.g. Waiting / Paid / Rejected. */
export function Filter<T extends string>({ value, options, onChange }: { value: T; options: Array<[T, string]>; onChange: (value: T) => void }) {
  return (
    <div role="group" className="flex border border-line bg-surface p-1">
      {options.map(([option, label]) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn('px-3.5 py-1.5 text-xs font-medium transition-colors', value === option ? 'bg-text text-bg' : 'text-muted hover:text-text')}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

const GOOD = ['completed', 'verified', 'won', 'live', 'paid']
const BAD = ['failed', 'cancelled', 'disabled', 'lost', 'rejected']
const WAIT = ['review', 'processing', 'pending', 'open']

/** A status as small text: green when done, red when it went wrong, amber while waiting. */
export function Status({ value }: { value: string }) {
  const label = value === 'review' ? 'waiting' : value === 'void' ? 'refunded' : value === 'disabled' ? 'blocked' : value
  return (
    <span className={cn('font-mono text-xs', GOOD.includes(value) ? 'text-good' : BAD.includes(value) ? 'text-bad' : WAIT.includes(value) ? 'text-warn' : 'text-muted')}>
      {label}
    </span>
  )
}

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      aria-label="Copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          // Clipboard blocked: the value is on screen to select.
        }
      }}
      className="inline-flex size-7 items-center justify-center text-muted transition-colors hover:text-text"
    >
      {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
    </button>
  )
}

/** A reference or ID in monospace, with a copy button. */
export function Ref({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-muted">-</span>
  return (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap font-mono text-xs">
      {value}
      <CopyButton value={value} />
    </span>
  )
}

export function UserLink({ id, email }: { id?: string; email?: string }) {
  if (!id) return <span className="text-muted">{email ?? '-'}</span>
  return (
    <Link to={`/users/${id}`} className="underline-offset-4 hover:underline">
      {email ?? id}
    </Link>
  )
}

export function Button({ children, tone = 'plain', ...rest }: { tone?: 'plain' | 'primary' | 'danger' } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        'inline-flex h-8 items-center justify-center gap-1.5 px-3 text-xs font-medium transition-colors disabled:opacity-45',
        tone === 'primary' && 'bg-brand text-white hover:opacity-90',
        tone === 'danger' && 'border border-bad/60 text-bad hover:bg-bad hover:text-white',
        tone === 'plain' && 'border border-line text-text hover:bg-hover',
        rest.className,
      )}
    >
      {children}
    </button>
  )
}

/**
 * A small dialog that asks for one line of text before a change goes through,
 * e.g. the receipt a withdrawal was paid with, or why it was rejected.
 */
export function AskDialog({
  title,
  text,
  label,
  placeholder,
  confirm,
  tone = 'primary',
  optional,
  onSubmit,
  onClose,
}: {
  title: string
  text: ReactNode
  label: string
  placeholder?: string
  confirm: string
  tone?: 'primary' | 'danger'
  optional?: boolean
  onSubmit: (value: string) => Promise<void>
  onClose: () => void
}) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const key = (event: KeyboardEvent) => event.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [busy, onClose])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSubmit(value.trim())
    } catch (reason) {
      setError((reason as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4" onClick={() => !busy && onClose()}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md border border-line bg-surface"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} disabled={busy} className="text-muted hover:text-text">
            <X size={16} aria-hidden="true" />
          </button>
        </header>
        <div className="space-y-4 p-5">
          <div className="text-sm text-muted">{text}</div>
          <label className="block">
            <span className="text-sm font-medium">{label}</span>
            <input
              autoFocus
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={placeholder}
              required={!optional}
              minLength={optional ? undefined : 3}
              className="mt-2 h-10 w-full border border-line bg-bg px-3 text-sm outline-none transition-colors focus:border-text"
            />
          </label>
          {error && <p className="text-sm text-bad">{error}</p>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-line px-5 py-4">
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" tone={tone} disabled={busy || (!optional && value.trim().length < 3)}>
            {busy ? 'Saving' : confirm}
          </Button>
        </footer>
      </form>
    </div>
  )
}
