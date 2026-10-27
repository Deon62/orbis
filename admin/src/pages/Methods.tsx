import { CreditCard } from 'lucide-react'
import { useState } from 'react'
import { AskDialog, Button, cell, EmptyState, Filter, Loading, Notice, PageHeader, Panel, Status, Table, useAdminData, useAdminPost, UserLink } from '../components/ui'
import { when } from '../lib/format'

type Method = {
  id: string
  userId: string
  email: string
  name: string
  kind: string
  label: string
  masked: string
  details: Record<string, unknown> | null
  status: string
  createdAt: string
}
type Show = 'pending' | 'verified' | 'disabled' | 'all'

/** The details a method was saved with, minus anything empty, as "key: value" lines. */
function Details({ value }: { value: Method['details'] }) {
  const entries = Object.entries(value ?? {}).filter(([, v]) => v !== null && v !== '' && typeof v !== 'object')
  if (!entries.length) return <span className="text-muted">-</span>
  return (
    <dl className="space-y-0.5 text-xs">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <dt className="text-muted">{k.replace(/_/g, ' ')}</dt>
          <dd className="break-all font-mono">{String(v)}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function Methods() {
  const [show, setShow] = useState<Show>('pending')
  const { data, error, loading, reload } = useAdminData<Method[]>(`/payment-methods?status=${show}`)
  const post = useAdminPost()
  const [asking, setAsking] = useState<{ m: Method; kind: 'verify' | 'block' } | null>(null)

  return (
    <>
      <PageHeader
        title="Payment methods"
        note="M-Pesa numbers and cards verify themselves on their first payment. Bank accounts and USDT wallets are verified here, once the name matches the user's ID."
      >
        <Filter<Show>
          value={show}
          onChange={setShow}
          options={[
            ['pending', 'To verify'],
            ['verified', 'Verified'],
            ['disabled', 'Blocked'],
            ['all', 'All'],
          ]}
        />
      </PageHeader>
      {error && <Notice>{error}</Notice>}
      <Panel flush>
        {loading && !data ? (
          <Loading />
        ) : !data?.length ? (
          <EmptyState icon={CreditCard} title={show === 'pending' ? 'Nothing to verify' : 'No methods here'} />
        ) : (
          <Table minWidth="60rem" columns={['User', 'Method', 'Account', 'Details', 'Status', 'Added', '']}>
            {data.map((m) => (
              <tr key={m.id} className="align-top">
                <td className={cell}>
                  <UserLink id={m.userId} email={m.email} />
                  {m.name && <p className="text-xs text-muted">{m.name}</p>}
                </td>
                <td className={cell}>{m.label}</td>
                <td className={`${cell} font-mono text-xs`}>{m.masked}</td>
                <td className={`${cell} max-w-72`}>
                  <Details value={m.details} />
                </td>
                <td className={cell}>
                  <Status value={m.status} />
                </td>
                <td className={`${cell} whitespace-nowrap text-muted`}>{when(m.createdAt)}</td>
                <td className={`${cell} whitespace-nowrap text-right`}>
                  <span className="inline-flex gap-2">
                    {m.status !== 'verified' && (
                      <Button tone="primary" onClick={() => setAsking({ m, kind: 'verify' })}>
                        Verify
                      </Button>
                    )}
                    {m.status !== 'disabled' && (
                      <Button tone="danger" onClick={() => setAsking({ m, kind: 'block' })}>
                        Block
                      </Button>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      {asking && (
        <AskDialog
          title={asking.kind === 'verify' ? 'Verify payment method' : 'Block payment method'}
          tone={asking.kind === 'verify' ? 'primary' : 'danger'}
          text={
            asking.kind === 'verify' ? (
              <>
                Withdrawals can then be paid to <b className="text-text">{asking.m.label} {asking.m.masked}</b>. Only verify it once the
                name on it matches {asking.m.name || 'the user'}.
              </>
            ) : (
              <>
                <b className="text-text">{asking.m.label} {asking.m.masked}</b> can no longer be paid to, and the user cannot add it back.
              </>
            )
          }
          label="Note for the activity log"
          placeholder="Optional"
          optional
          confirm={asking.kind === 'verify' ? 'Verify' : 'Block'}
          onClose={() => setAsking(null)}
          onSubmit={async (note) => {
            await post(`/payment-methods/${asking.m.id}/${asking.kind}`, { note: note || null })
            setAsking(null)
            void reload()
          }}
        />
      )}
    </>
  )
}
