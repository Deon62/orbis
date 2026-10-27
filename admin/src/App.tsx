import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout, Wordmark } from './components/Layout'
import { AdminContext } from './components/ui'
import { adminGet, API_URL, loadToken, saveToken } from './lib/api'
import { useTheme } from './lib/theme'
import Activity from './pages/Activity'
import Deposits from './pages/Deposits'
import Markets from './pages/Markets'
import Methods from './pages/Methods'
import Overview from './pages/Overview'
import Trades from './pages/Trades'
import User from './pages/User'
import Users from './pages/Users'
import Withdrawals from './pages/Withdrawals'

function SignIn({ onSignedIn, error: initialError }: { onSignedIn: (token: string) => void; error?: string | null }) {
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(initialError ?? null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await adminGet('/overview', token.trim())
      onSignedIn(token.trim())
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center px-5 py-16">
      <form onSubmit={submit} className="w-full max-w-sm">
        <div className="flex justify-center">
          <Wordmark />
        </div>
        <h1 className="mt-8 text-center text-2xl font-semibold tracking-[-0.02em]">Sign in</h1>
        <p className="mt-2 text-center text-sm text-muted">Use the admin token set on the API.</p>
        <label htmlFor="token" className="mt-8 block text-sm font-medium">
          Admin token
        </label>
        <input
          id="token"
          type="password"
          autoComplete="current-password"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          required
          className="mt-2 h-11 w-full border border-line bg-surface px-3 text-sm outline-none transition-colors focus:border-text"
        />
        {error && <p className="mt-4 text-sm text-bad">{error}</p>}
        <button
          type="submit"
          disabled={busy || !token.trim()}
          className="mt-6 h-11 w-full bg-brand text-sm font-semibold text-white transition-opacity disabled:opacity-45"
        >
          {busy ? 'Checking' : 'Sign in'}
        </button>
        <p className="mt-6 text-center text-xs leading-relaxed text-muted">
          Kept for this tab only.
          <br />
          {API_URL}
        </p>
      </form>
    </main>
  )
}

export default function App() {
  const [theme, setTheme] = useTheme()
  const [token, setToken] = useState<string | null>(loadToken)
  const [expired, setExpired] = useState<string | null>(null)

  const signOut = useCallback(() => {
    saveToken(null)
    setToken(null)
  }, [])

  // A token saved earlier in this tab: confirm it still works.
  useEffect(() => {
    if (!token) return
    adminGet('/overview', token).catch((reason: Error & { status?: number }) => {
      if (reason.status === 401 || reason.status === 404) {
        setExpired(reason.message)
        signOut()
      }
    })
  }, [token, signOut])

  if (!token) {
    return (
      <SignIn
        error={expired}
        onSignedIn={(next) => {
          saveToken(next)
          setExpired(null)
          setToken(next)
        }}
      />
    )
  }

  return (
    <AdminContext.Provider value={{ token, signOut }}>
      <Routes>
        <Route element={<Layout theme={theme} onTheme={setTheme} />}>
          <Route index element={<Overview />} />
          <Route path="withdrawals" element={<Withdrawals />} />
          <Route path="deposits" element={<Deposits />} />
          <Route path="users" element={<Users />} />
          <Route path="users/:id" element={<User />} />
          <Route path="payment-methods" element={<Methods />} />
          <Route path="trades" element={<Trades />} />
          <Route path="markets" element={<Markets />} />
          <Route path="activity" element={<Activity />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AdminContext.Provider>
  )
}
