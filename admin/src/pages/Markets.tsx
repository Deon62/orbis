import { useEffect } from 'react'
import { cell, Loading, Notice, num, PageHeader, Panel, Table, useAdminData } from '../components/ui'
import { cn, usd } from '../lib/format'

type System = {
  frontendUrl: string
  adminUrl: string
  minDepositUsd: number
  minWithdrawUsd: number
  withdrawFeeUsd: number
  usdKesRate: number
  providers: Record<string, boolean>
  markets: Array<{ sym: string; source: string; payout: number; price: string | null; age: number | null; live: boolean }>
}

const SOURCE: Record<string, string> = { binance: 'Binance', finnhub: 'Finnhub (OANDA)', synthetic: 'Server' }

export default function Markets() {
  const { data, error, loading, reload } = useAdminData<System>('/system')

  // the feed moves every second; refresh the table every five
  useEffect(() => {
    const id = setInterval(() => void reload(), 5000)
    return () => clearInterval(id)
  }, [reload])

  const live = data?.markets.filter((m) => m.live).length ?? 0

  return (
    <>
      <PageHeader
        title="Markets"
        note="A market is open for real money while the server has a price under 15 seconds old. Forex, metals and indices close at weekends."
      />
      {error && <Notice>{error}</Notice>}
      {loading && !data && <Loading />}
      {data && (
        <>
          <Panel title={`Price feed · ${live} of ${data.markets.length} live`} flush>
            <Table minWidth="40rem" columns={['Market', 'Source', { label: 'Price', right: true }, { label: 'Age', right: true }, { label: 'Payout', right: true }, 'Real money']}>
              {data.markets.map((m) => (
                <tr key={m.sym}>
                  <td className={`${cell} font-medium`}>{m.sym}</td>
                  <td className={`${cell} text-muted`}>{SOURCE[m.source] ?? m.source}</td>
                  <td className={num}>{m.price ?? '-'}</td>
                  <td className={`${num} text-muted`}>{m.age == null ? '-' : `${m.age}s`}</td>
                  <td className={num}>{m.payout}%</td>
                  <td className={cell}>
                    <span className={cn('font-mono text-xs', m.live ? 'text-good' : 'text-muted')}>{m.live ? 'open' : 'closed'}</span>
                  </td>
                </tr>
              ))}
            </Table>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Providers">
              <ul className="divide-y divide-line text-sm">
                {Object.entries(data.providers).map(([name, on]) => (
                  <li key={name} className="flex justify-between py-2 first:pt-0 last:pb-0">
                    <span>{name}</span>
                    <span className={cn('font-mono text-xs', on ? 'text-good' : 'text-muted')}>{on ? 'set' : 'not set'}</span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Settings">
              <ul className="divide-y divide-line text-sm">
                {[
                  ['Minimum deposit', usd(data.minDepositUsd)],
                  ['Minimum withdrawal', usd(data.minWithdrawUsd)],
                  ['Withdrawal fee', usd(data.withdrawFeeUsd)],
                  ['M-Pesa rate', `KSh ${data.usdKesRate} to $1`],
                  ['Website', data.frontendUrl],
                  ['Admin site', data.adminUrl || '-'],
                ].map(([label, value]) => (
                  <li key={label} className="flex justify-between gap-4 py-2 first:pt-0 last:pb-0">
                    <span className="text-muted">{label}</span>
                    <span className="truncate font-mono text-xs">{value}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted">Changed with environment variables on Render.</p>
            </Panel>
          </div>
        </>
      )}
    </>
  )
}
