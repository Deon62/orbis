import { useState } from 'react'
import { Filter, Loading, Notice, PageHeader, Panel, useAdminData } from '../components/ui'
import { WithdrawalTable } from '../components/WithdrawalTable'
import type { Tx } from '../lib/types'

type Show = 'waiting' | 'completed' | 'failed' | 'all'

export default function Withdrawals() {
  const [show, setShow] = useState<Show>('waiting')
  const { data, error, loading, reload } = useAdminData<Tx[]>(`/transactions?type=withdrawal&status=${show}&limit=300`)

  return (
    <>
      <PageHeader title="Withdrawals" note="Pay outside this site, then mark the withdrawal paid with its receipt. Oldest first while waiting.">
        <Filter<Show>
          value={show}
          onChange={setShow}
          options={[
            ['waiting', 'Waiting'],
            ['completed', 'Paid'],
            ['failed', 'Rejected'],
            ['all', 'All'],
          ]}
        />
      </PageHeader>
      {error && <Notice>{error}</Notice>}
      <Panel flush>
        {loading && !data ? (
          <Loading />
        ) : (
          <WithdrawalTable
            rows={data ?? []}
            emptyText={show === 'waiting' ? 'Nothing waiting' : 'No withdrawals here'}
            onChanged={() => {
              void reload()
            }}
          />
        )}
      </Panel>
    </>
  )
}
