import { Link } from 'react-router-dom'
import { Loading, Notice, PageHeader, Panel, Stat, useAdminData } from '../components/ui'
import { WithdrawalTable } from '../components/WithdrawalTable'
import { count, signedUsd, usd } from '../lib/format'
import type { Tx } from '../lib/types'

type Overview = {
  users: number
  newUsers24h: number
  realBalances: number
  deposits24h: number
  deposits24hCount: number
  deposits7d: number
  depositsStuck: number
  withdrawalsWaiting: number
  withdrawalsWaitingUsd: number
  withdrawals7d: number
  realTrades24h: number
  realVolume24h: number
  houseResult24h: number
  realTraders24h: number
  openRealContracts: number
  openRealAtRisk: number
  methodsWaiting: number
  marketsLive: number
  markets: number
}

export default function Overview() {
  const { data, error } = useAdminData<Overview>('/overview')
  const waiting = useAdminData<Tx[]>('/transactions?type=withdrawal&status=waiting&limit=10')

  return (
    <>
      <PageHeader title="Overview" note="Real money only, unless it says demo." />
      {error && <Notice>{error}</Notice>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Withdrawals waiting"
          value={data ? count(data.withdrawalsWaiting) : '-'}
          note={data && `${usd(data.withdrawalsWaitingUsd)} to pay`}
          tone={data && data.withdrawalsWaiting > 0 ? 'warn' : undefined}
          to="/withdrawals"
        />
        <Stat
          label="Deposits, 24 h"
          value={data ? usd(data.deposits24h) : '-'}
          note={data && `${count(data.deposits24hCount)} deposits · ${usd(data.deposits7d)} in 7 days`}
          to="/deposits"
        />
        <Stat
          label="House result, 24 h"
          value={data ? signedUsd(data.houseResult24h) : '-'}
          note={data && `${count(data.realTrades24h)} trades · ${usd(data.realVolume24h)} staked`}
          tone={data ? (data.houseResult24h >= 0 ? 'good' : 'bad') : undefined}
          to="/trades"
        />
        <Stat label="Real balances" value={data ? usd(data.realBalances) : '-'} note="What users could withdraw" />
        <Stat label="Users" value={data ? count(data.users) : '-'} note={data && `${count(data.newUsers24h)} new in 24 h`} to="/users" />
        <Stat
          label="Open real contracts"
          value={data ? count(data.openRealContracts) : '-'}
          note={data && `${usd(data.openRealAtRisk)} staked · ${count(data.realTraders24h)} traders in 24 h`}
        />
        <Stat
          label="Methods to verify"
          value={data ? count(data.methodsWaiting) : '-'}
          note={data && (data.depositsStuck ? `${count(data.depositsStuck)} deposits stuck at pending` : 'Bank and USDT accounts')}
          tone={data && data.methodsWaiting > 0 ? 'warn' : undefined}
          to="/payment-methods"
        />
        <Stat
          label="Markets live"
          value={data ? `${data.marketsLive} / ${data.markets}` : '-'}
          note="Open for real money now"
          tone={data && data.marketsLive === 0 ? 'bad' : undefined}
          to="/markets"
        />
      </div>

      <Panel
        title="Withdrawals waiting"
        flush
        action={
          <Link to="/withdrawals" className="text-xs text-muted underline-offset-4 hover:text-text hover:underline">
            All withdrawals
          </Link>
        }
      >
        {waiting.loading && !waiting.data ? (
          <Loading />
        ) : waiting.error ? (
          <div className="p-5">
            <Notice>{waiting.error}</Notice>
          </div>
        ) : (
          <WithdrawalTable
            rows={waiting.data ?? []}
            emptyText="Nothing waiting"
            onChanged={() => {
              void waiting.reload()
            }}
          />
        )}
      </Panel>
    </>
  )
}
