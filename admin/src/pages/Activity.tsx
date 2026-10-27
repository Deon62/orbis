import { History } from 'lucide-react'
import { cell, EmptyState, Loading, Notice, PageHeader, Panel, Ref, Table, useAdminData, UserLink } from '../components/ui'
import { when } from '../lib/format'

type Action = { id: number; action: string; target: string; userId: string | null; email: string | null; note: string | null; ip: string | null; at: string }

const LABEL: Record<string, string> = {
  'withdrawal.approve': 'Withdrawal marked paid',
  'withdrawal.reject': 'Withdrawal rejected',
  'method.verify': 'Method verified',
  'method.block': 'Method blocked',
}

export default function Activity() {
  const { data, error, loading } = useAdminData<Action[]>('/actions?limit=300')

  return (
    <>
      <PageHeader title="Activity" note="Every change made from this site, newest first." />
      {error && <Notice>{error}</Notice>}
      <Panel flush>
        {loading && !data ? (
          <Loading />
        ) : !data?.length ? (
          <EmptyState icon={History} title="Nothing yet" />
        ) : (
          <Table minWidth="52rem" columns={['What', 'On', 'User', 'Note', 'From', 'When']}>
            {data.map((a) => (
              <tr key={a.id}>
                <td className={cell}>{LABEL[a.action] ?? a.action}</td>
                <td className={cell}>
                  <Ref value={a.target} />
                </td>
                <td className={cell}>
                  <UserLink id={a.userId ?? undefined} email={a.email ?? undefined} />
                </td>
                <td className={`${cell} max-w-72 text-muted`}>{a.note ?? '-'}</td>
                <td className={`${cell} font-mono text-xs text-muted`}>{a.ip ?? '-'}</td>
                <td className={`${cell} whitespace-nowrap text-muted`}>{when(a.at)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </>
  )
}
