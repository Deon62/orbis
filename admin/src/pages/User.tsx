import { ArrowLeft, Receipt } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { TradeTable } from '../components/TradeTable'
import { cell, EmptyState, Loading, Notice, num, Panel, Ref, Stat, Status, Table, useAdminData } from '../components/ui'
import { local, signedUsd, usd, when } from '../lib/format'
import { METHOD, type Trade, type Tx } from '../lib/types'

type Detail = {
  id: string
  email: string
  name: string
  phone: string
  country: string | null
  currency: string
  referralCode: string
  referredBy: string | null
  createdAt: string
  balances: { real?: number; demo?: number }
  deposited: number
  withdrawn: number
  realPl: number
  transactions: Tx[]
  trades: Trade[]
  methods: Array<{ id: string; kind: string; label: string; masked: string; status: string; isDefault: boolean; createdAt: string; removed: boolean }>
}

export default function User() {
  const { id = '' } = useParams()
  const { data, error, loading } = useAdminData<Detail>(`/users/${encodeURIComponent(id)}`)

  return (
    <>
      <Link to="/users" className="inline-flex items-center gap-2 text-sm text-muted hover:text-text">
        <ArrowLeft size={14} aria-hidden="true" />
        Users
      </Link>
      {error && <Notice>{error}</Notice>}
      {loading && !data && <Loading />}
      {data && (
        <>
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.02em]">{data.name || data.email}</h1>
            <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {[
                ['Email', data.email],
                ['Phone', data.phone || '-'],
                ['Country', data.country || '-'],
                ['Joined', when(data.createdAt)],
                ['Referral code', data.referralCode],
                ['Referred by', data.referredBy || '-'],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-3">
                  <dt className="w-28 shrink-0 text-muted">{label}</dt>
                  <dd className="min-w-0 break-all">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 flex items-center text-xs text-muted">
              User ID <Ref value={data.id} />
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Real balance" value={usd(data.balances.real)} note={`Demo ${usd(data.balances.demo)}`} />
            <Stat label="Deposited" value={usd(data.deposited)} />
            <Stat label="Withdrawn" value={usd(data.withdrawn)} />
            <Stat label="Real trading P/L" value={signedUsd(data.realPl)} tone={data.realPl > 0 ? 'bad' : data.realPl < 0 ? 'good' : undefined} note="The user's, so a gain is the house's loss" />
          </div>

          <Panel title="Money" flush>
            {data.transactions.length === 0 ? (
              <EmptyState icon={Receipt} title="No deposits or withdrawals" />
            ) : (
              <Table minWidth="56rem" columns={['Reference', 'Type', 'Method', { label: 'Amount', right: true }, { label: 'Net', right: true }, 'Detail', 'Status', 'When']}>
                {data.transactions.map((tx) => (
                  <tr key={tx.reference}>
                    <td className={cell}>
                      <Ref value={tx.reference} />
                    </td>
                    <td className={cell}>{tx.type}</td>
                    <td className={cell}>{METHOD[tx.method] ?? tx.method}</td>
                    <td className={num}>{local(tx.local, tx.localCurrency) ?? usd(tx.amount)}</td>
                    <td className={num}>{usd(tx.net)}</td>
                    <td className={`${cell} max-w-64 text-xs`}>
                      {tx.failure ? <span className="text-bad">{tx.failure}</span> : <span className="font-mono">{tx.receipt ?? tx.destination ?? '-'}</span>}
                    </td>
                    <td className={cell}>
                      <Status value={tx.status} />
                    </td>
                    <td className={`${cell} whitespace-nowrap text-muted`}>{when(tx.createdAt)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Panel>

          <Panel title="Payment methods" flush>
            {data.methods.length === 0 ? (
              <EmptyState icon={Receipt} title="No payment methods" />
            ) : (
              <Table minWidth="40rem" columns={['Method', 'Account', 'Status', 'Added']}>
                {data.methods.map((m) => (
                  <tr key={m.id} className={m.removed ? 'text-muted' : undefined}>
                    <td className={cell}>
                      {m.label}
                      {m.isDefault && <span className="ml-2 text-xs text-muted">default</span>}
                      {m.removed && <span className="ml-2 text-xs">removed by user</span>}
                    </td>
                    <td className={`${cell} font-mono text-xs`}>{m.masked}</td>
                    <td className={cell}>
                      <Status value={m.status} />
                    </td>
                    <td className={`${cell} whitespace-nowrap text-muted`}>{when(m.createdAt)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Panel>

          <Panel title="Latest trades" flush>
            <TradeTable rows={data.trades} showUser={false} />
          </Panel>
        </>
      )}
    </>
  )
}
