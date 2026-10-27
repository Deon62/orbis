export type Tx = {
  reference: string
  type: 'deposit' | 'withdrawal' | 'referral'
  method: string
  status: string
  amount: number
  fee: number
  net: number
  local: number | null
  localCurrency: string | null
  destination: string | null
  receipt: string | null
  failure: string | null
  createdAt: string
  completedAt: string | null
  email?: string
  userId?: string
}

export type Trade = {
  ref: string
  account: 'real' | 'demo'
  symbol: string
  direction: 'Rise' | 'Fall'
  stake: number
  payout: number
  entry: string | null
  exit: string | null
  status: string
  profit: number | null
  openedAt: string
  settledAt: string | null
  email?: string
  userId?: string
}

export const METHOD: Record<string, string> = { mpesa: 'M-Pesa', card: 'Card', bank: 'Bank', usdt: 'USDT', referral: 'Referral' }
