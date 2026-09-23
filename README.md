# orbisflow — binary trading platform (design prototype)

A deliberately simple Deriv alternative: pick a market, pick a direction, set stake and
duration, done. Static HTML/CSS/JS — no build step, no dependencies to install.

**Everything is mocked** — no auth, no live prices, no money. Prices are generated in the
browser and links that aren't built yet show a placeholder toast. The user-facing copy
does not say so, because the build is meant to present as a real product.

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

## Connecting the API

The backend is a separate repository (the local `backend/` folder, ignored by this one) deployed to Render. See its `README.md`.

The UI runs in two modes, switched by one line at the top of `assets/js/api.js`:

```js
var API_BASE = '';                                   // offline: local simulation, empty states
var API_BASE = 'https://orbisflow-api.onrender.com'; // live
```

Live, these talk to the API:

| Where | What |
|---|---|
| `login`, `signup` (`assets/js/auth.js`) | Account creation, log-in, Google, email confirmation, "Forgot?", password reset. A referral link `/r/ORBIS-XXXXX` (rewritten in `vercel.json`) fills the sign-up code. |
| Every app page (`api.js`, `app.js`) | Sends signed-out visitors to `/login?next=…`; loads the real balances into the account card and the name into the menu; Log out ends the session. |
| Profile details | Saves name, phone, country and currency. |
| Payment methods | Lists, adds (M-Pesa, bank, USDT) and removes methods. Cards are saved by paying with them. |
| Refer & earn | The account's own referral link and QR. |
| Deposit | M-Pesa sends an STK push and waits on the phone; cards go to Paystack and return to Cashier, which confirms the payment. |
| Withdraw | Only to verified methods, with the $5 minimum and the $1 fee on top. |
| Cashier | Real transaction history. |

Pages whose data the backend does not serve yet (trades, reports, calendar, news, alerts, copy trading, AI, and others) show their empty states.

## Pages

| File | What it is |
|---|---|
| `index.html` | Marketing landing page. Rotating tagline, then the chart, then the rest. Scrolls section-by-section. |
| `academy.html` | Free trading courses. |
| `about.html` | Who builds it and how it makes money. |
| `login.html` / `signup.html` | Centred cards, "Continue with Google" below the email form. Signup takes one Trader name; country is set later in the profile. |
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

## Scripts

No build step, but three generators live in `scripts/`:

- `node scripts/build-icons.js` rebuilds `assets/js/icons.js` from the lucide CDN,
  keeping only the icons the repo references. **Run it after using a new icon name**,
  or that glyph renders as nothing.
- `node scripts/build-pdfs.js` prints the Academy's free course introductions to
  `assets/pdf/` with Chrome. It is the only generator with a dependency
  (`npm i puppeteer-core`); the PDFs are committed, so it runs only when the copy
  changes. `CHROME=...` points it at another browser binary.
- `node scripts/dedash.js` strips em and en dashes from the copy: a comma where the
  dash joined clauses, a hyphen where it spanned a range. `--check` lists offenders
  without changing anything.

## Charts

Two categorical slots, `--viz-1` / `--viz-2`, validated for colour-vision
separation against both surfaces: green/indigo, not green/gold (green and gold read
as the same colour to a protanope, ΔE 4.3). Referral earnings uses a horizontal
stacked bar rather than a donut, because pending is 6% of the total and a 6% slice of
a donut is a sliver.

## The Academy, and its PDFs

Three courses in increasing order: Foundations ($19), Practitioner ($59),
Professional ($149). Each card carries its benefits and a free introduction in PDF,
and those PDFs are real: `scripts/build-pdfs.js` prints them from a branded HTML
template with Chrome, so they are typeset rather than hand-assembled. Regenerate with
`node scripts/build-pdfs.js`; they land in `assets/pdf/`.

The three cards are two grey and one dark: the middle course is the one most people
should take, so it is a dark island in the row, built by re-declaring the surface
tokens inside it (the same trick as the marketing hero chart) rather than overriding
every rule. On a dark page it inverts, going darker than the page with a lighter
border, because a black card on a near-black background is not a highlight.

**Enrolling never touches a trading account.** The Academy runs on its own dashboard,
so `data-modal="enrol"` with `data-course="..."` opens a four-step flow in `modals.js`:
what enrolment actually gets you, the email the login is sent to (validated, the CTA
stays disabled until it parses), the payment method, then the receipt. Card goes to
Paystack and USDT reuses the TRC-20 address with its QR. The page says the same thing
above the cards, because someone who never opens the modal still needs to know that
paying here does not open an orbisflow account.

On a phone each course card owns a screen (`min-height:calc(100svh - var(--nav-h))`,
with `scroll-margin-top` for the sticky header) so the three are compared one at a
time rather than scrolled past as a wall. Above 760px they return to a three-column
grid, and the footers are pushed to a common line because the benefit lists differ in
length.

## Loading

`window.orbisVeil(label)` paints a full-screen veil with the
[cssloaders](https://cssloaders.github.io/#rect) diamond. Work that ends on another
page gets it — signup, login, Google, the Paystack redirect — because a toast does not
survive the navigation it is announcing. Work that finishes on the same page keeps
its toast.

The loader is the upstream geometry with our own colours: `--color-1` is the track
(`--line-strong`), `--color-3` the sweep (`--brand-strong` on light, the lighter
`--brand` on dark, which is the one that reads there), and `--color-2` is the well,
which has to match whatever sits behind it or the middle stops looking like a hole.
The source ships `#20DE00` on `#060706`, a pure lime on near-black: off-brand, and a
black square in the middle of a light page.

## QR codes

`assets/js/qr.js` is a small byte-mode encoder, error correction level M, versions 1
to 6, rendering straight to a canvas. It is always drawn dark-on-light whatever the
theme, because an inverted QR fails on most scanners. Correctness is verified by
decoding the output with `jsqr`, not by eye.

## Country picker

`assets/js/countries.js` holds 198 ISO 3166-1 alpha-2 entries, which double as the
flagcdn codes used everywhere else. The profile's country field is a button that opens
a searchable modal with a flag beside every name.

## Sound

Short synthesised tones (Web Audio, no audio files) on placing a contract and on its
result. Muted from the panel's **Sound** switch, stored in `localStorage` under
`orbisflow-sound`. `window.orbisBeep('place'|'win'|'lose')`.

## Page transitions

Each page's `main` fades and lifts in over 180ms (pure CSS, so it survives a JS
failure). A 2px progress bar is created **synchronously** on an internal link click —
a deferred timer is no use, because the browser tears down the old document's scripting
as soon as the navigation starts. The "only when it is slow" behaviour comes from a
150ms `animation-delay`: a quick switch is gone before anything paints, a slow one gets
the bar. Both respect `prefers-reduced-motion`.

## Filters

Every filter is a dropdown, not a row of pills — six categories in a horizontal row
crowded the page and wrapped on phones. The markup is `[data-fdrop]` with a
`.fdrop-btn` and `.fdrop-menu` of `.fdrop-opt` buttons; `app.js` handles open/close,
click-outside and Escape, then fires `fdrop:change` with the chosen value. An option
carrying `data-panel` also switches panels, which is how Positions' Open/Settled/
Statistics works now.

A page can also hang one action off the top bar with `data-hdr-action` (plus
`data-hdr-icon`/`data-hdr-label`) — the AI page uses it for the market-read info icon.

## Modals

Flows too short to deserve a page live in `assets/js/modals.js`, opened by
`data-modal="deposit|withdraw|refer|account"` on any element.

- **Deposit** — step 1 picks the method, step 2 depends on it. The back chevron
  returns to step 1 from any of them.
  - *M-Pesa and bank* prefill the saved destination masked (`+254 7•• ••• 412`) with a
    **Use another** toggle; the CTA reads *Send STK push · $100.00*.
  - *Card* goes through **Paystack**. No card field exists anywhere on this site — the
    CTA is *Continue to Paystack*, and the modal says the details are taken on
    Paystack's own page. The 1.5% processor fee is shown and subtracted from what is
    credited. The same holds in **Add a method**: a card is saved by paying with it,
    not by typing a number in.
  - *USDT* is an address, not a form: the TRC-20 deposit address whole and wrapped
    (`USDT_ADDRESS` in `modals.js`), a copy button, a QR of it, and the one warning
    that matters — wrong network, money gone. No amount field, because the amount is
    whatever arrives.
- **Withdraw** — same shape, against the available balance, minus a flat $1.00 platform
  fee. The modal shows the fee and what actually lands; below $1.00 the CTA disables
  and says so rather than offering a withdrawal that nets nothing.
- **Indicators** — chart type (candles or line) and SMA 20 / 50 overlays, driving the
  chart through `window.orbisChartState / orbisChartType / orbisChartSma`, which
  `trade.html` defines. The overlay colours come from `--viz-2` and `--ink-3`, read at
  draw time so they follow the theme.
- **Refer & earn** — the link with a copy button, share row, and two rows out to
  *Your referrals* and *Referral earnings*.

- **Switch account** — Demo / Real with balances, tick on the active one.
- **Add a method** — payment type, then its one field, except a card, which goes to
  Paystack; opened from Payment methods.
- **Market read** — the AI page's sentiment/volatility/accuracy figures.
- **Copy <provider>** — allocation stepper, minimum enforced, fee and exit terms.
- **Contract running → Won/Lost** — placing a trade opens a running card with a
  countdown and progress bar, then settles into a result. Settlement is compressed to
  six seconds and the card says so; the outcome is a coin flip.

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
| `--surface` | `#F4F3F0` | `#1C1C1B` | The tinted band a section sits on |
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

The marketing header and menu only link to pages that run the public shell
(`/#how`, `/academy`, `/about`). Everything else lives inside the trading app, and
linking to it from the landing page would drop a visitor into the app sideways.

The top bar has two shapes. On **Trade, Markets and Positions** it carries the account
card (`.acct-card`, with a round US flag and a chevron) plus Deposit and the avatar;
pressing the card opens a centred **Switch account** modal that closes on selection.
Every other page gets only a back arrow and the page name; the deposit button is not
offered on pages where no money is at stake. A page can put a person in that corner
instead with `data-hdr-person` (live chat shows Sam, with a presence dot). The theme switch
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
the entire page.

The three tools to the right of the durations are 36×32 with a 20px glyph — the first
pass reused the text-button padding, which squeezed the icon to 12px through
`svg{max-width:100%}`. They toggle candles / line, open **Indicators**, and take the
chart fullscreen. The line is one steady colour (`--chart-line`) rather than red or
green by direction — direction belongs to a single candle, and a whole line that
repaints on every tick is not what a real platform does. Under it is a flat wash
(`--chart-fill`, ~5.5% ink) thin enough that the skyline still reads through, and the
panel lifts `--sky-opacity` while the line is showing so it does. Fullscreen is a class on `.chart-panel`, not the Fullscreen API, so
the modal layer still works over it; `main` has to be lifted with it, because `main`
carries its own stacking context and the sticky header would otherwise paint over a
`position:fixed` child of it. Escape leaves fullscreen, unless a modal is open — that
takes the key first. Back arrows step through history when there is any, falling back to
`data-back-to` or `/trade`. On phones the theme switch and Log out are pinned to the bottom of the
drawer so they never need scrolling to, and the Deposit button only appears on the
trading surfaces — not on settings sub-pages.

## Icons

[Lucide](https://lucide.dev), but **self-hosted and subsetted**: `assets/js/icons.js`
carries only the ~90 icons this site uses (17 KB) instead of the full 436 KB UMD build
from a CDN, and ships a `createIcons()` with the same call signature. Regenerate it with
`scratchpad/subset.js` after using a new icon name — the generator keeps every quoted
kebab token that matches a real icon, because names also reach the DOM through
ternaries and concatenation.
Lucide dropped brand logos, so X / Facebook / Instagram / Telegram / YouTube come from
[Simple Icons](https://simpleicons.org) (`cdn.simpleicons.org`). Note LinkedIn is not
served by that CDN.

Markets carry real marks rather than initials: country flags from `flagcdn.com`
(currency pairs show both sides overlapped) and coin logos from Simple Icons. The spec
lives per-market in `data.js` under `icon`, rendered by `assetHTML()` — which also feeds
the market picker, so the flags appear in the dropdown too.

Thirty-eight markets: 15 forex (the majors, the yen and franc crosses, and ZAR, KES and
MXN), 13 crypto, 3 commodities, 4 indices, 3 synthetics. A coin mark sits on a fixed
light chip in both themes, because half of those brand colours are near-black or navy
and would vanish against a dark panel. Two Simple Icons slugs that look obvious do not
exist: `bnb` (it is `binance`) and `tron`.

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
