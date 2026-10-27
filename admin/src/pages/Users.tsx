import { Search, Users as UsersIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cell, EmptyState, Loading, Notice, num, PageHeader, Panel, Table, useAdminData } from '../components/ui'
import { usd, when } from '../lib/format'

type Row = { id: string; email: string; name: string; phone: string; country: string | null; createdAt: string; real: number; demo: number }

export default function Users() {
  const [query, setQuery] = useState('')
  const [q, setQ] = useState('')
  const navigate = useNavigate()

  // search as you type, once typing pauses
  useEffect(() => {
    const id = setTimeout(() => setQ(query.trim()), 300)
    return () => clearTimeout(id)
  }, [query])

  const { data, error, loading } = useAdminData<Row[]>(`/users?limit=200&q=${encodeURIComponent(q)}`)

  return (
    <>
      <PageHeader title="Users" note="Newest first. Search by email, name, phone or referral code." />
      <label className="flex h-11 items-center gap-2 border border-line bg-surface px-3 focus-within:border-text">
        <Search size={16} className="text-muted" aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search users"
          aria-label="Search users"
          className="h-full flex-1 bg-transparent text-sm outline-none"
        />
      </label>
      {error && <Notice>{error}</Notice>}
      <Panel flush>
        {loading && !data ? (
          <Loading />
        ) : !data?.length ? (
          <EmptyState icon={UsersIcon} title={q ? 'Nobody matches' : 'No users yet'} />
        ) : (
          <Table minWidth="52rem" columns={['Name', 'Email', 'Phone', { label: 'Real', right: true }, { label: 'Demo', right: true }, 'Joined']}>
            {data.map((u) => (
              <tr key={u.id} onClick={() => navigate(`/users/${u.id}`)} className="cursor-pointer transition-colors hover:bg-hover">
                <td className={`${cell} font-medium`}>{u.name || <span className="text-muted">-</span>}</td>
                <td className={cell}>{u.email}</td>
                <td className={`${cell} font-mono text-xs`}>{u.phone || '-'}</td>
                <td className={num}>{usd(u.real)}</td>
                <td className={`${num} text-muted`}>{usd(u.demo)}</td>
                <td className={`${cell} whitespace-nowrap text-muted`}>{when(u.createdAt)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </>
  )
}
