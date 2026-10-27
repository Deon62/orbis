# obisflow Admin

The admin site for obisflow: withdrawals to pay, deposits, users, payment
methods to verify, trades, the live price feed, and a log of every change made
here. Light and dark themes.

It is a standalone Vite + React app with its own `package.json` and lockfile.
It lives in the website repo under `admin/`, and deploys as its own Vercel
project. The main site never ships it (see the root `.vercelignore`).

## How it signs in

The admin API exists only when the obisflow API has `ADMIN_TOKEN` set (32+
characters). This site asks for that token and keeps it in `sessionStorage`,
so it lasts for the tab and is gone when the browser closes. Wrong tokens are
limited to 10 attempts per 15 minutes per address.

## What it can change

Only what used to be SQL run by hand from `backend/sql/admin`:

| Action | Effect |
|---|---|
| Withdrawal: Mark paid | Records the receipt you paid with, and emails and texts the user. Pay first, outside this site. |
| Withdrawal: Reject | Gives the money back to the user's real balance and emails them the reason. |
| Payment method: Verify | Bank accounts and USDT wallets, once the name matches the user's ID. Withdrawals only go to verified methods. |
| Payment method: Block | It can no longer be paid to, and the user cannot add it back. |

Each is recorded under Activity with the note and the address it came from.
Balances, prices and settings are not editable here.

## Run it locally

Needs Node 22.18+.

```sh
npm install
cp .env.example .env    # VITE_API_URL: the API to talk to
npm run dev             # http://localhost:5176
```

For a local API, start it with an admin token and allow this origin:

```sh
ADMIN_TOKEN=<32+ characters> ADMIN_URL=http://localhost:5176 uvicorn app.main:app --reload
```

## Deploy (Vercel)

1. In Vercel, add a new project from the website repo and set **Root
   Directory** to `admin`. `vercel.json` sets the build, the SPA fallback, and
   `noindex` / no-framing headers.
2. Set `VITE_API_URL` to the API (`https://backend-xv27.onrender.com`).
3. Give it a domain, e.g. `admin.obisflow.com`.
4. On Render, for the API:
   - run `backend/sql/009_admin.sql` in Supabase first
   - set `ADMIN_TOKEN` to a long random value:
     `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
   - set `ADMIN_URL` to this site's address, e.g. `https://admin.obisflow.com`;
     the API always allows it

Keep the token in a password manager: anyone with it can see every user and
pay out or refund withdrawals.

## Pages

| Page | What it shows |
|---|---|
| Overview | Withdrawals waiting, deposits, house result, real balances, users, open contracts, methods to verify, markets live |
| Withdrawals | Waiting (oldest first), paid, rejected; Mark paid and Reject |
| Deposits | Every deposit with its receipt or failure |
| Users | Search by email, name, phone or referral code; each user's balances, money, methods and trades |
| Payment methods | Methods to verify, with the details they were saved with; Verify and Block |
| Trades | Real and demo contracts, open and settled, with entry, exit and P/L |
| Markets | The price feed per market, providers set on the API, and the money settings |
| Activity | Every change made from this site |
