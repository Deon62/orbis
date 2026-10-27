import { ArrowDownToLine } from 'lucide-react'
import { useState } from 'react'
import { cell, EmptyState, Filter, Loading, Notice, num, PageHeader, Panel, Ref, Status, Table, useAdminData, UserLink } from '../components/ui'
import { local, usd, when } from '../lib/format'
import { METHOD, type Tx } from '../lib/types'

type Show = 'all' | 'completed' | 'pending' | 'failed'

export default function Deposits() {
  const [show, setShow] = useState<Show>('all')
  const { data, error, loading } = useAdminData<Tx[]>(`/transactions?type=deposit&status=${show}&limit=300`)

  return (
    <>
      <PageHeader title="Deposits" note="A deposit pending for more than 15 minutes usually means a lost callback: check it with the provider.">
        <Filter<Show>
          value={show}
          onChange={setShow}
          options={[
            ['all', 'All'],
            ['completed', 'Completed'],
            ['pending', 'Pending'],
            ['failed', 'Failed'],
          ]}
        />
      </PageHeader>
      {error && <Notice>{error}</Notice>}
      <Panel flush>
        {loading && !data ? (
          <Loading />
        ) : !data?.length ? (
          <EmptyState icon={ArrowDownToLine} title="No deposits here" />
        ) : (
          <Table minWidth="60rem" columns={['Reference', 'User', 'Method', { label: 'Paid', right: true }, { label: 'Credited', right: true }, 'Receipt', 'Status', 'When']}>
            {data.map((tx) => (
              <tr key={tx.reference}>
                <td className={cell}>
                  <Ref value={tx.reference} />
                </td>
                <td className={cell}>
                  <UserLink id={tx.userId} email={tx.email} />
                </td>
                <td className={cell}>{METHOD[tx.method] ?? tx.method}</td>
                <td className={num}>{local(tx.local, tx.localCurrency) ?? usd(tx.amount)}</td>
                <td className={num}>{usd(tx.net)}</td>
                <td className={`${cell} font-mono text-xs`}>
                  {tx.receipt ?? (tx.failure ? <span className="text-bad">{tx.failure}</span> : <span className="text-muted">-</span>)}
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
    </>
  )
}
