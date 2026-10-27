import { useState } from 'react'
import { TradeTable } from '../components/TradeTable'
import { Filter, Loading, Notice, PageHeader, Panel, useAdminData } from '../components/ui'
import type { Trade } from '../lib/types'

type Account = 'real' | 'demo' | 'all'
type Show = 'all' | 'open' | 'settled'

export default function Trades() {
  const [account, setAccount] = useState<Account>('real')
  const [show, setShow] = useState<Show>('all')
  const { data, error, loading } = useAdminData<Trade[]>(`/trades?account=${account}&status=${show}&limit=300`)

  return (
    <>
      <PageHeader title="Trades" note="Newest first. P/L is the user's: a positive figure is paid out by the house.">
        <div className="flex flex-wrap gap-2">
          <Filter<Show>
            value={show}
            onChange={setShow}
            options={[
              ['all', 'All'],
              ['open', 'Open'],
              ['settled', 'Settled'],
            ]}
          />
          <Filter<Account>
            value={account}
            onChange={setAccount}
            options={[
              ['real', 'Real'],
              ['demo', 'Demo'],
              ['all', 'Both'],
            ]}
          />
        </div>
      </PageHeader>
      {error && <Notice>{error}</Notice>}
      <Panel flush>{loading && !data ? <Loading /> : <TradeTable rows={data ?? []} />}</Panel>
    </>
  )
}
