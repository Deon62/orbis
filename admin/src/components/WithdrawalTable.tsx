import { ArrowUpFromLine } from 'lucide-react'
import { useState } from 'react'
import { local, usd, when } from '../lib/format'
import { METHOD, type Tx } from '../lib/types'
import { AskDialog, Button, cell, EmptyState, num, Ref, Status, Table, useAdminPost, UserLink } from './ui'

/**
 * Withdrawals, with Paid and Reject on the ones still waiting. Paying happens
 * outside this site (M-Pesa, bank, USDT); Paid records the receipt, Reject
 * puts the money back in the user's balance. Both email the user.
 */
export function WithdrawalTable({ rows, onChanged, emptyText }: { rows: Tx[]; onChanged: () => void; emptyText?: string }) {
  const post = useAdminPost()
  const [asking, setAsking] = useState<{ tx: Tx; kind: 'approve' | 'reject' } | null>(null)

  if (rows.length === 0) return <EmptyState icon={ArrowUpFromLine} title={emptyText ?? 'No withdrawals'} />

  return (
    <>
      <Table
        minWidth="64rem"
        columns={['Reference', 'User', 'Method', 'Pay to', { label: 'Send', right: true }, { label: 'Debited', right: true }, 'Status', 'Requested', '']}
      >
        {rows.map((tx) => {
          const waiting = tx.status === 'review' || tx.status === 'processing'
          return (
            <tr key={tx.reference} className="align-top">
              <td className={cell}>
                <Ref value={tx.reference} />
              </td>
              <td className={cell}>
                <UserLink id={tx.userId} email={tx.email} />
              </td>
              <td className={cell}>{METHOD[tx.method] ?? tx.method}</td>
              <td className={`${cell} max-w-56`}>
                <span className="whitespace-nowrap font-mono text-xs">{tx.destination ?? '-'}</span>
                {tx.receipt && <p className="mt-1 text-xs text-muted">Receipt {tx.receipt}</p>}
                {tx.failure && <p className="mt-1 text-xs text-bad">{tx.failure}</p>}
              </td>
              <td className={num}>
                <b className="font-semibold">{local(tx.local, tx.localCurrency) ?? usd(tx.amount)}</b>
                {tx.local != null && <p className="text-muted">{usd(tx.amount)}</p>}
              </td>
              <td className={num}>
                {usd(tx.net)}
                <p className="text-muted">fee {usd(tx.fee)}</p>
              </td>
              <td className={cell}>
                <Status value={tx.status} />
              </td>
              <td className={`${cell} whitespace-nowrap text-muted`}>{when(tx.createdAt)}</td>
              <td className={`${cell} whitespace-nowrap text-right`}>
                {waiting && (
                  <span className="inline-flex gap-2">
                    <Button tone="primary" onClick={() => setAsking({ tx, kind: 'approve' })}>
                      Mark paid
                    </Button>
                    <Button tone="danger" onClick={() => setAsking({ tx, kind: 'reject' })}>
                      Reject
                    </Button>
                  </span>
                )}
              </td>
            </tr>
          )
        })}
      </Table>

      {asking?.kind === 'approve' && (
        <AskDialog
          title="Mark withdrawal paid"
          text={
            <>
              Send <b className="text-text">{local(asking.tx.local, asking.tx.localCurrency) ?? usd(asking.tx.amount)}</b> by{' '}
              {METHOD[asking.tx.method] ?? asking.tx.method} to <b className="text-text">{asking.tx.destination}</b> first, then record the
              receipt here. The user is emailed that it was paid.
            </>
          }
          label="Receipt or transaction reference"
          placeholder="e.g. SJK4H7Q2XP"
          confirm="Mark paid"
          onClose={() => setAsking(null)}
          onSubmit={async (receipt) => {
            await post(`/withdrawals/${encodeURIComponent(asking.tx.reference)}/approve`, { receipt })
            setAsking(null)
            onChanged()
          }}
        />
      )}
      {asking?.kind === 'reject' && (
        <AskDialog
          title="Reject withdrawal"
          tone="danger"
          text={
            <>
              <b className="text-text">{usd(asking.tx.net)}</b> goes back to the user's real balance, and they are emailed the reason
              below.
            </>
          }
          label="Reason, shown to the user"
          placeholder="e.g. The name on the account does not match your ID"
          confirm="Reject and refund"
          onClose={() => setAsking(null)}
          onSubmit={async (reason) => {
            await post(`/withdrawals/${encodeURIComponent(asking.tx.reference)}/reject`, { reason })
            setAsking(null)
            onChanged()
          }}
        />
      )}
    </>
  )
}
