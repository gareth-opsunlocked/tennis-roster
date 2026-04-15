# Thursday Tennis Roster — Enhancements Design Spec
**Date:** 2026-04-15

## Overview

Four enhancements to the existing Thursday tennis roster app:

1. **Expand player list** to 7 players (Rick, Gareth, Lachy, Scott, Miles, Glenn, Grant)
2. **Seed historical data** — 10 weeks from 2026 as baseline for the fairness algorithm
3. **Persistent storage** — replace filesystem JSON with Neon free-tier PostgreSQL so data survives Render redeploys
4. **Edit/override past weeks** — inline form in history section to correct assignments when reality differs from the algorithm
5. **Copy-to-clipboard** — one-tap text message Rick can send to the group after setting each week
6. **AO-inspired redesign** — replace the current green theme with the Australian Open colour palette

---

## Stack Changes

- Add `pg` (node-postgres) as a dependency
- `DATABASE_URL` environment variable drives storage choice at runtime:
  - Set → use PostgreSQL (production on Render + Neon)
  - Not set → fall back to current file-based storage (local dev and tests)
- No other dependency changes

---

## Player List

Master list updated to 7 players:

```javascript
['Rick', 'Gareth', 'Lachy', 'Scott', 'Miles', 'Glenn', 'Grant']
```

The app still requires exactly 4 players per week. The fairness algorithm is unchanged.

---

## Database

### Schema

```sql
CREATE TABLE IF NOT EXISTS roster (
  id INTEGER PRIMARY KEY,
  data JSONB NOT NULL
);
```

Single table, single row. The entire roster (players + weeks array) is stored as a JSONB blob — same structure as the current `roster.json` file. This keeps `algorithm.js` and all data-shape code unchanged.

### Initialisation

Two constants in `server.js`:
- `DEFAULT_DATA` — `{ players: [...7 players], weeks: [] }` — used by the file-based path (local dev and tests start with an empty weeks array)
- `SEED_DATA` — `{ players: [...7 players], weeks: [...10 historical weeks] }` — used only by the DB init path

On first `readData()` call via the DB path, if the row does not exist, the app inserts `SEED_DATA`. No separate migration script is needed. After a Render filesystem wipe, the DB row persists unaffected.

### Connection

```javascript
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
```

SSL is required by Neon.

### Storage abstraction

`readData()` and `writeData()` become async. All route handlers become `async/await`. The file-based path remains for local dev and tests.

```javascript
async function readData() {
  if (process.env.DATABASE_URL) {
    const result = await pool.query('SELECT data FROM roster WHERE id = 1');
    if (result.rows.length === 0) {
      await writeData(SEED_DATA);
      return JSON.parse(JSON.stringify(SEED_DATA));
    }
    return result.rows[0].data;
  }
  // existing file-based logic
}

async function writeData(data) {
  if (process.env.DATABASE_URL) {
    await pool.query(
      'INSERT INTO roster (id, data) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET data = $1',
      [JSON.stringify(data)]
    );
    return;
  }
  // existing file-based logic
}
```

---

## Historical Seed Data

10 weeks seeded into `DEFAULT_DATA.weeks`. Dates are consecutive Thursdays from 2026-01-01 (approximate — actual sessions had gaps, but dates are display-only and do not affect the fairness algorithm).

| # | Date | Players | Paying | Balls | Drinks |
|---|------|---------|--------|-------|--------|
| 1 | 2026-01-01 | Rick, Grant, Scott, Gareth | Rick | Scott | Gareth |
| 2 | 2026-01-08 | Scott, Gareth, Lachy, Rick | Scott | null | Rick |
| 3 | 2026-01-15 | Miles, Rick, Scott, Glenn | Miles | Glenn | Glenn |
| 4 | 2026-01-22 | Gareth, Glenn, Rick, Scott | Gareth | null | Scott |
| 5 | 2026-01-29 | Glenn, Gareth, Scott, Rick | Glenn | Rick | Rick |
| 6 | 2026-02-05 | Scott, Rick, Glenn, Gareth | Scott | null | Gareth |
| 7 | 2026-02-12 | Rick, Scott, Gareth, Glenn | Rick | Gareth | Glenn |
| 8 | 2026-02-19 | Scott, Rick, Gareth, Glenn | Scott | null | Glenn |
| 9 | 2026-02-26 | Rick, Scott, Lachy, Gareth | Rick | Scott | Gareth |
| 10 | 2026-03-05 | Gareth, Rick, Lachy, Scott | Gareth | null | Scott |

Notes:
- Week 3: Glenn held both balls and drinks (reflects what actually happened)
- Week 5: Rick held both balls and drinks (reflects what actually happened)
- Balls weeks are odd-numbered (1, 3, 5, 7, 9) — pattern holds
- The next game will be week 11 (balls week)
- `ballsWeek` is `false` for all even-numbered weeks → `assignments.balls` is `null`

---

## API Changes

### `GET /api/state` — unchanged

Response shape is unchanged. The frontend computes the last-balls-person from the `weeks` array already returned (finds the most recent week where `assignments.balls !== null`).

### `PUT /api/week/:weekNumber` — new

Allows overriding the assignments for any past week.

**Request body:**
```json
{ "assignments": { "paying": "Rick", "balls": "Scott", "drinks": "Gareth" } }
```

**Validation:**
- `weekNumber` must exist in the weeks array
- `paying` must be in that week's `players` list
- `drinks` must be in that week's `players` list
- If `ballsWeek` is `true`: `balls` must be in that week's `players` list
- If `ballsWeek` is `false`: `balls` must be `null` or absent
- One person may hold multiple roles (to match real-world history)

**Response:** the updated week object

**Stats:** `computeStats` recalculates from scratch on every `GET /api/state` — edits flow through to stats and future allocations automatically, no extra work needed.

---

## UI — Visual Redesign (AO-inspired)

Replace the current green tennis theme with the Australian Open colour palette:

| Token | Value | Usage |
|-------|-------|-------|
| Navy | `#0B3D6E` | Header bar, dark section backgrounds |
| Electric blue | `#009AC7` | Primary buttons, active player chips, links |
| Lime yellow | `#C8E34B` | "Balls week" badge, highlight accents |
| White | `#FFFFFF` | Card backgrounds, body text on dark |
| Off-white | `#F5F7FA` | Page background |
| Dark text | `#1A1A2E` | Body text on light backgrounds |

Typography: system sans-serif stack, bold/heavy weights for section headings (uppercase or near-uppercase), regular weight for body.

---

## UI — New Features

### Copy for Text (This Week section)

A "Copy for text" button sits below the role cards in the This Week section. Only shown when a current week exists.

**Button behaviour:**
- On click: formats the message (see below) and copies to clipboard via `navigator.clipboard.writeText()`
- Button text changes to "Copied!" for 2 seconds then resets
- Fallback: if clipboard API unavailable, show a `<textarea>` with the text selected so the user can copy manually

**Message format:**

On a balls week (week 1 of those balls):
```
Tennis Thu 19 Mar - Week 12
💰 Paying: Rick
🎾 Balls: Glenn - week 1
🍺 Drinks: Gareth
```

On a non-balls week (balls carry-over):
```
Tennis Thu 5 Mar - Week 11
💰 Paying: Gareth
🎾 Balls: Scott - week 2
🍺 Drinks: Rick
```

The carry-over name is the player from the most recent week where `assignments.balls !== null`. The "week 1" / "week 2" label indicates whether this is the first (new) or second (carry-over) session with those balls.

### Edit/Override (History section)

Each history entry gets a small "Edit" link. Clicking it expands an inline form below the entry summary:

- `<select>` for Paying — options: the 4 players who played that week
- `<select>` for Drinks — options: the 4 players who played that week
- `<select>` for Balls (only shown on balls weeks) — options: the 4 players who played that week
- "Save" button: `PUT /api/week/:weekNumber`, reload state, collapse form
- "Cancel" button: collapse without saving

The selects use the native OS picker on mobile (no custom styling needed). The form stacks vertically on small screens.

---

## Testing

### Existing tests
All existing tests continue to use the file-based path (`process.env.DATA_FILE`) — no DB required.

### New tests (api.test.js)
- `PUT /api/week/:weekNumber` — valid edit returns updated week
- `PUT /api/week/:weekNumber` — player not in that week's list returns 400
- `PUT /api/week/:weekNumber` — unknown weekNumber returns 404
- `PUT /api/week/:weekNumber` — balls assigned on non-balls week returns 400
- After an edit, `GET /api/state` stats reflect the change

---

## Deployment

### Neon setup (one-time)
1. Create free account at [neon.tech](https://neon.tech)
2. Create a new project → copy the connection string (starts with `postgres://`)
3. On Render: add environment variable `DATABASE_URL` = the Neon connection string
4. Redeploy — the app creates the table and seeds historical data on first request

### Environment variables on Render
| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Neon connection string |
| `TZ` | `Australia/Sydney` |

---

## Out of Scope

- Changing which players can be selected (still exactly 4 per week)
- Editing which players participated in a past week (only assignments are editable)
- Player management UI
- Push notifications
- Authentication
