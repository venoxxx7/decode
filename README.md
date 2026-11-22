# Decode

Decode is a private, local-first trading journal for the **V1 / V2 order-block strategy**. It pairs a clean dark interface with deterministic statistics and a local vision model that audits your uploaded chart screenshots.

Everything runs on your machine. Trades, screenshots and AI analysis stay in `decode/data/` unless you export them.

---

## What it does

- **Dashboard** — equity curve, net P&L, win rate, expectancy, drawdown, daily loss and strategy split.
- **Trade journal** — full trade records with direction, trend, entry/SL/TP, planned vs actual R, news context, notes and up to 10 annotated charts per trade.
- **V1 / V2 workflow** — explicit checklist for order block, shortened 50% zone, first tap, FVG / wick FVG / imbalance, second tap and optional 15M CHoCH confirmation.
- **AI chart audit** — sends the actual uploaded screenshots to a local Ollama vision model. The model is instructed to report only visible evidence, mark anything unclear as `uncertain`, and return structured JSON. You can correct its findings manually.
- **Risk management** — risk per trade, daily loss limit, max drawdown, open-risk warnings and a position-size calculator.
- **Analytics** — strategy, pair, session, grade, news, trend and confirmation breakdowns, all calculated from saved trades.
- **Insights** — deterministic findings generated from your own data, plus an optional AI-written performance review.
- **Settings** — account risk defaults, Ollama endpoint and vision model, JSON export.

Statistics are always derived from saved trades. The AI never invents trades, prices or chart details.

---

## Requirements

| Requirement | Notes |
| --- | --- |
| **Node.js 24+** | Uses the built-in `node:sqlite` module. Node 22.5+ works but is not recommended. |
| **npm** | Ships with Node. |
| **Ollama** | Only needed for AI chart audits and AI narratives. The rest of the app works without it. |
| **Vision model** | Default: `qwen3-vl:4b-instruct` (fast, ~3 GB). Larger vision models such as `qwen3-vl:8b` or `qwen3.8:27b` can be selected for higher-quality readings. |

A GPU is recommended. The default 4B model is designed to run comfortably on a laptop; the 27B model is much slower on CPU-only machines.

---

## Quick start

```bash
cd decode
npm install
npm start
```

Open **http://localhost:4173**.

On first launch the server creates `data/decode.db` and seeds a demo workspace with 38 illustrative trades and sample annotated charts.

- Click **Enter live demo** on the sign-in screen to explore the demo account.
- Or **Create an account** to start with an empty, private journal.

### Ollama setup (optional)

```bash
ollama serve
ollama pull qwen3-vl:4b-instruct
```

Then open **Settings → AI analysis** and confirm:

- Endpoint: `http://127.0.0.1:11434`
- Vision model: `qwen3-vl:4b-instruct`

The AI Lab page shows whether Ollama is online and which models are installed.

---

## Strategy definitions

### V1 — primary

1. Identify the 1H trend and the order block.
2. Use the shortened **50% portion** of the order-block zone.
3. Wait for the **first tap** into the zone.
4. The first tap must show **FVG**, **wick FVG** or **imbalance-candle** confirmation.
5. Enter on the **second tap** into the zone.
6. Buy in an uptrend, sell in a downtrend.
7. Minimum planned reward-to-risk is **1:4**.

### V2 — optional confirmation

V1 plus an optional **15M Change of Character (CHoCH)** check during the second tap. Record whether CHoCH was used and whether it was actually present.

Decode deliberately supports only these two versions.

---

## How the AI audit works

1. Upload one or more annotated screenshots to a trade.
2. Click **Run AI audit**.
3. The server sends the images and the recorded trade checklist to your Ollama endpoint with `format: "json"`.
4. The response is validated and stored against the trade: observations, missing confirmations, mistakes, grade and confidence.
5. If the model misreads the chart, open **Correct analysis** and record what the chart actually shows. Corrections are saved alongside the AI output and are never overwritten by a re-run.

The prompt explicitly requires the model to say `uncertain` instead of guessing, and to describe only what is visible in the supplied screenshots. Analysis can take a while on CPU-only machines.

---

## Data and privacy

- Database: `data/decode.db` (SQLite, WAL mode)
- Original screenshots: `data/uploads/`
- Authentication: scrypt password hashing, HttpOnly session cookies, CSRF tokens on every mutation, login rate limiting.
- Chart files are served only through the authenticated `/api/charts/:id/file` route.
- **Export** in Settings downloads a full JSON copy of your journal.
- **Delete `data/decode.db` and `data/uploads/`** to reset the app. The demo workspace is recreated on the next start.

The app binds to localhost by default. If you expose it on a network, put it behind HTTPS and set a strong account password.

---

## Project structure

```
decode/
  server.js              Express server, SQLite schema, auth, analytics, AI integration
  public/
    index.html           SPA entry
    app.js               Boot, auth, routing, shell events
    styles.css           Full dark responsive design system
    js/
      core.js            State, API client, formatters, icons, SVG helpers
      views.js           All page views and shell markup
      modals.js          Trade editor, uploads, corrections, dialogs, calculator
    fonts/               Bundled Manrope + Instrument Serif
  data/
    decode.db            SQLite database (created on first run)
    uploads/             Uploaded chart screenshots
```

---

## Scripts

| Command | Purpose |
| --- | --- |
| `npm start` | Start the server on port 4173. |
| `npm run dev` | Start with Node's watch mode. |

Set `PORT` to change the port:

```bash
PORT=8080 npm start
```

---

## Troubleshooting

**`node:sqlite` is not available**
Upgrade to Node 24 or newer.

**AI status says offline**
Make sure `ollama serve` is running and the endpoint in Settings matches. Check that the selected model is installed with `ollama list`.

**The model is slow**
The default 4B vision model is small enough for most laptops. Larger models such as `qwen3-vl:8b` or `qwen3.8:27b` produce richer readings but are much slower without a GPU. Select a smaller model in Settings if an audit takes too long.

**Charts do not appear**
Confirm the file is PNG, JPEG or WebP and under 8 MB. Up to 10 charts can be attached to one trade.

**I need to start over**
Stop the server, delete `data/decode.db*` and the files in `data/uploads/`, then start again.

---

## Disclaimer

Decode is a journaling and review tool, not financial advice or an execution platform. Demo trades and demo charts are illustrative. Always verify AI observations against the original chart.
