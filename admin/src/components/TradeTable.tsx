import { CandlestickChart } from 'lucide-react'
import { signedUsd, usd, when } from '../lib/format'
import type { Trade } from '../lib/types'
import { cell, EmptyState, num, Ref, Status, Table, UserLink } from './ui'

export function TradeTable({ rows, showUser = true }: { rows: Trade[]; showUser?: boolean }) {
  if (rows.length === 0) return <EmptyState icon={CandlestickChart} title="No trades" />
  return (
    <Table
      minWidth="62rem"
      columns={[
        'Contract',
        ...(showUser ? ['User'] : []),
        'Account',
        'Market',
        { label: 'Stake', right: true },
        { label: 'Entry', right: true },
        { label: 'Exit', right: true },
        'Result',
        { label: 'User P/L', right: true },
        'Opened',
      ]}
    >
      {rows.map((t) => (
        <tr key={t.ref}>
          <td className={cell}>
            <Ref value={t.ref} />
          </td>
          {showUser && (
            <td className={cell}>
              <UserLink id={t.userId} email={t.email} />
            </td>
          )}
          <td className={`${cell} ${t.account === 'real' ? '' : 'text-muted'}`}>{t.account}</td>
          <td className={cell}>
            {t.symbol} <span className="text-muted">{t.direction}</span>
          </td>
          <td className={num}>{usd(t.stake)}</td>
          <td className={num}>{t.entry ?? '-'}</td>
          <td className={num}>{t.exit ?? '-'}</td>
          <td className={cell}>
            <Status value={t.status} />
          </td>
          <td className={`${num} ${t.profit == null ? '' : t.profit > 0 ? 'text-good' : t.profit < 0 ? 'text-bad' : ''}`}>{signedUsd(t.profit)}</td>
          <td className={`${cell} whitespace-nowrap text-muted`}>{when(t.openedAt)}</td>
        </tr>
      ))}
    </Table>
  )
}
