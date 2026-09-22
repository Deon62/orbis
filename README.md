# orbisflow — binary trading platform (design prototype)

A deliberately simple Deriv alternative: pick a market, pick a direction, set stake and
duration, done. Static HTML/CSS/JS — no build step, no dependencies to install.

**Everything is mocked.** No auth, no prices, no money. Prices are simulated in the
browser, links that aren't built yet show a "placeholder" toast.

## URLs

Deployed on Vercel with `vercel.json` → `cleanUrls: true`, `trailingSlash: false`, so
pages are served without the extension: `/login`, `/trade`, `/referral-earnings`, and
`/` for the home page. Vercel 308-redirects `/login.html` → `/login` for any old links.

Every internal link and every asset path is root-relative and extensionless to match, so
navigation never takes a redirect hop.

## Run it

Because of the clean URLs this needs a server that resolves `/login` → `login.html`
(`vercel dev` does, plain `python -m http.server` does not, and `file://` will not work
at all):

```bash
vercel dev            # or any static server with clean-URL support
```

## Pages

| File | What it is |
|---|---|
| `index.html` | Marketing landing page. On laptops it scrolls section-by-section. |
| `login.html` / `signup.html` | Centred cards, "Continue with Google" below the email form. |
| `trade.html` | Chart + ticket. The row above the chart is the duration picker; the ticket is Manual/Auto, a stake stepper, and two CTAs. |
| `markets.html` | The instrument list, searchable and filterable. Nothing above it but the search row. |
| `ai.html` | Market scan: signals with confidence and a pattern watch. Each signal hands its market, direction, duration and stake to the ticket via query params. The market read (sentiment, volatility, accuracy, next event) is behind the info icon. |
| `positions.html` | Open, settled and statistics tabs — the list and nothing else. |
| `cashier.html` | Transaction history — the list alone. Deposit and withdraw are modals. |
| `referrals.html` | The referral list, nothing else. |
| `referral-earnings.html` | Weekly payouts and accruals. |
| `profile-details.html` | The profile page — what the Profile tab, the avatar and the panel's account strip all open. The old `account.html` hub is gone; the drawer covers what it listed. |
| `verification.html`, `security.html`, `payments.html`, `preferences.html` | One concern each, reached from the drawer. |
| `copy-trading`, `economic-calendar`, `market-news`, `price-alerts`, `watchlists` | Trading tools. |
| `profit-table`, `trade-confirmations` | Reports. |
| `help-centre`, `live-chat`, `contact` | Support. |
| `terms`, `privacy`, `risk-disclosure` | Legal. |

Every link in the drawer now leads to a real page — nothing in it falls back to a
"not wired up" toast. Group order: **Money → Account → Trading tools → Reports →
Support → Legal.**

## Copy trading

`copy-trading` lists four providers (`OrbisData.providers` in `data.js`) with 30-day
return, win rate, max drawdown and the minimum allocation each requires — $50, $100,
$250 and $500. Sort by any of them. **Copy** opens a modal with a stepper that refuses
anything below that provider's minimum, and states the fee and exit terms before you
commit.

**Tab bar:** pages reached from the panel set `data-tabbar="hide"` and drop the bottom
bar, because they are dead ends you return from rather than destinations you switch
between. The five tab destinations keep it, `profile-details` included.

Sub-pages carry no page title or description of their own: they set `data-title`
(shown in the header, with a back chevron) and `data-nav="account"` so the Profile tab
stays lit. The list pages are lists — no headers, no blurbs.

## Modals

Flows too short to deserve a page live in `assets/js/modals.js`, opened by
`data-modal="deposit|withdraw|refer|account"` on any element.

- **Deposit** — step 1 picks the method, step 2 prefills the saved destination masked
  (`+254 7•• ••• 412`) with a **Use another** toggle, then the CTA reads
  *Send STK push · $100.00* for M-Pesa. The back chevron returns to step 1.
- **Withdraw** — same shape, against the available balance.
- **Refer & earn** — the link with a copy button, share row, and two rows out to
  *Your referrals* and *Referral earnings*.

- **Switch account** — Demo / Real with balances, tick on the active one.
- **Add a method** — payment type, then its one field; opened from Payment methods.
- **Market read** — the AI page's sentiment/volatility/accuracy figures.
- **Copy <provider>** — allocation stepper, minimum enforced, fee and exit terms.

Saved destinations are the `SAVED` map at the top of `modals.js`; accounts come from
`window.orbisAccounts` in `app.js`. Swap both for the account service.

## Shell

`<body data-shell="…">` decides the chrome, injected by `assets/js/app.js`:

- **`app`** — icon rail on desktop, slide-in drawer + 5-tab bottom bar on mobile,
  edge-to-edge layout, **no footer**. Used by every signed-in page.

  The five primary destinations are **Trade, Markets, AI, Positions, Profile**. Everything
  else lives in the drawer, which never repeats a tab: Money (deposit and withdraw open
  modals; history and refer), Trading tools, Reports, Account, Support, Legal. On desktop
  the drawer opens from **More** at the bottom of the rail.
- **`public`** — marketing header + full footer. Used by `index.html`.
- **`bare`** — nothing injected. Used by the auth pages.

Change the nav once in `app.js` (`NAV`, `DRAWER_GROUPS`, `PUBLIC_NAV`, `FOOTER_COLS`)
and every page follows.

## Themes

Light and dark, toggled from the header and stored in `localStorage` under
`orbisflow-theme`. Each page sets `data-theme` on `<html>` in a tiny inline script
before paint, so there is no flash. First visit follows `prefers-color-scheme`.

The chart reads its colours from the same CSS variables, so it repaints on switch
(`orbisChartTheme()` in `chart.js`).

## Design tokens

Defined at the top of `assets/css/styles.css`.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#FAFAF9` | `#171716` | The one page background |
| `--panel` | `#FFFFFF` | `#1E1E1D` | Chart and cards — barely lifted off `--bg` |
| `--line` | `#E8E6E1` | `#2E2E2C` | Hairline separators |
| `--ink` | `#1C1C1C` | `#EDECE8` | Text |
| `--brand` | `#00BF63` | same | Logo green, rising prices, accents |
| `--brand-strong` | `#00994F` | same | Button fills, so white text stays readable |

Everything sits on one background. Boxes are used sparingly: stat tiles have no frame,
lists and tables are horizontal hairlines (`.list`, `.card-flat`) rather than cards.

**Selection is a small green dot, never a filled box or a line** — under the label on the
rail and tab bar, before the label on segments. Compact controls (timeframes, chips,
pills) just darken their text and border. Tap highlight is off everywhere and focus
rings only show for keyboard users. Corners are square except avatars and asset badges.

The top bar has two shapes. On **Trade, Markets and Positions** it carries the account
card (`.acct-card`, with a round US flag and a chevron) plus Deposit and the avatar;
pressing the card opens a centred **Switch account** modal that closes on selection.
Every other page gets only a back arrow, the page name and the avatar. The theme switch
lives in the rail on desktop and the drawer on mobile, so it is reachable either way.
All modals float centred, phones included.

On phones the drawer covers 55% of the width. Duration is chosen once, in the row above
the chart — the ticket has no duration control of its own. Stake is a stepper: minus,
centred amount, plus, stepping by 1 below $20 and by 5 above, floored at $1.

The phone CTA bar is fixed, so `body[data-page="trade"]` reserves
`var(--tab-h) + 118px` — enough that every ticket control can be scrolled clear of it
(86px of clearance on the tightest control at full scroll, on any phone size).

The chart has its own `+` / `−` in the bottom-left corner: they change how many candles
are drawn (`Chart.view`, 24–140) rather than relying on browser zoom, which would scale
the entire page. Back arrows step through history when there is any, falling back to
`data-back-to` or `/trade`. On phones the theme switch and Log out are pinned to the bottom of the
drawer so they never need scrolling to, and the Deposit button only appears on the
trading surfaces — not on settings sub-pages.

## Icons

[Lucide](https://lucide.dev) via CDN, rendered from `data-lucide="name"` attributes.
Lucide dropped brand logos, so X / Facebook / Instagram / Telegram / YouTube come from
[Simple Icons](https://simpleicons.org) (`cdn.simpleicons.org`). Note LinkedIn is not
served by that CDN.

Markets carry real marks rather than initials: country flags from `flagcdn.com`
(currency pairs show both sides overlapped) and coin logos from Simple Icons. The spec
lives per-market in `data.js` under `icon`, rendered by `assetHTML()` — which also feeds
the market picker, so the flags appear in the dropdown too.

## Trade screen notes

The market selector is a custom listbox (`#picker` in `trade.html`), not a native
`<select>`: native options cannot carry flags. It groups by asset class, filters as you
type, and shows the live price per row. Click-outside and Escape close it.

On phones the Rise/Fall buttons are `position: fixed` just above the tab bar, so they
stay reachable while you scroll the ticket; the page reserves the space with
`padding-bottom` on `body[data-page="trade"]`.

## Assets

- The logo is a **wordmark**, so it is set in type (Poppins 700) rather than shipped as
  an image: `orbis` + `flow` with a green underline, matching `logo.png`. The desktop
  rail uses an `of` monogram. `favicon.svg` is the same motif drawn as shapes.
- `assets/img/skyline.svg` / `skyline-ink.svg` — the Manhattan silhouette behind the
  charts (Empire State, Chrysler, One WTC, with the low-rise gap between Midtown and
  Downtown). Two fills, because the chart is white in light mode and near-black in dark;
  CSS shows whichever suits the theme. Stretched edge-to-edge, faded to 4–5%.
- `assets/img/reference-deriv.png` — the reference screenshot you supplied.

## What to replace when the backend exists

| Mock | Where |
|---|---|
| Price feed | `assets/js/chart.js` → `generate()` and `Chart.prototype.tick()` |
| Markets, trades, transactions, referrals | `assets/js/data.js` |
| Auth | `[data-login]` and `form[data-mock-submit]` handlers in `app.js` |
| Every unbuilt link | elements carrying `data-mock="…"` |
