# orbisflow — binary trading platform (design prototype)

A deliberately simple Deriv alternative: pick a market, pick a direction, set stake and
duration, done. Static HTML/CSS/JS — no build step, no dependencies to install.

**Everything is mocked.** No auth, no prices, no money. Prices are simulated in the
browser, links that aren't built yet show a "placeholder" toast.

## Run it

```bash
python -m http.server 8777      # from this folder, then open http://127.0.0.1:8777
```

Opening `index.html` straight from disk works too.

## Pages

| File | What it is |
|---|---|
| `index.html` | Marketing landing page. On laptops it scrolls section-by-section. |
| `login.html` / `signup.html` | Centred cards, "Continue with Google" below the email form. |
| `trade.html` | Chart + Rise/Fall ticket. Custom market picker with flags. |
| `markets.html` | 17 instruments across 5 asset classes, searchable and filterable. |
| `ai.html` | Signals with confidence, pattern watch, ask box. |
| `positions.html` | Open, settled and statistics tabs. |
| `cashier.html` | Transaction history. Deposit and withdraw are modals, not pages. |
| `referrals.html` | The referral list, nothing else. |
| `referral-earnings.html` | Weekly payouts and accruals. |
| `account.html` | Profile hub — a short menu. |
| `profile-details.html`, `verification.html`, `security.html`, `payments.html`, `preferences.html` | One concern each. |

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

**Selection is a 2px green line, never a filled box** — left edge on the rail, top edge
on the tab bar, bottom edge on segments, timeframes, pills and chips. Corners are square
except avatars and asset badges.

The active account sits in the top bar as a card (`.acct-card`) with a chevron; pressing
it opens a centred **Switch account** modal listing Demo and Real with their balances,
and the card updates in place. All modals float centred, phones included. On phones the theme switch and Log out are pinned to the bottom of the
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
