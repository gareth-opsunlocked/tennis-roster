# Thursday Tennis Roster — Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 7-player support, Neon PostgreSQL persistence, historical data seeding, edit/override for past weeks, copy-to-clipboard duty message, and an AO-inspired visual redesign.

**Architecture:** All changes stay in the two existing files (`server.js`, `public/index.html`) plus tests. Storage uses a runtime branch: `DATABASE_URL` set → PostgreSQL (Neon); unset → existing file path (local dev and tests unchanged). `algorithm.js` is untouched.

**Tech Stack:** Node.js, Express, `pg` (node-postgres), Neon (PostgreSQL), vanilla HTML/CSS/JS, Jest + Supertest.

---

## File Map

| File | Changes |
|------|---------|
| `package.json` | Add `pg` to dependencies |
| `server.js` | Update player list; add `SEED_DATA`; add `Pool`; make `readData`/`writeData` async; make route handlers async; add `PUT /api/week/:weekNumber` |
| `public/index.html` | AO colour redesign; change 🥤→🍺; add copy button; add inline edit form |
| `tests/api.test.js` | Update 5-player expectations to 7; add `PUT` tests |

`algorithm.js` and `tests/algorithm.test.js` are **not modified**.

---

### Task 1: Install pg and update player list

**Files:**
- Modify: `package.json`
- Modify: `server.js` (lines 6–9)
- Modify: `tests/api.test.js` (lines 20–31)

- [ ] **Step 1: Update the failing tests first**

Open `tests/api.test.js` and replace the two GET `/api/state` tests (lines 17–32):

```javascript
describe('GET /api/state', () => {
  test('returns 200 with empty weeks and null currentWeek on first run', async () => {
    const res = await request(app).get('/api/state');
    expect(res.status).toBe(200);
    expect(res.body.players).toEqual(['Rick', 'Gareth', 'Lachy', 'Scott', 'Miles', 'Glenn', 'Grant']);
    expect(res.body.weeks).toEqual([]);
    expect(res.body.currentWeek).toBeNull();
  });

  test('stats contains all 7 players with zero totals on first run', async () => {
    const res = await request(app).get('/api/state');
    expect(Object.keys(res.body.stats)).toHaveLength(7);
    for (const player of ['Rick', 'Gareth', 'Lachy', 'Scott', 'Miles', 'Glenn', 'Grant']) {
      expect(res.body.stats[player].total).toBe(0);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: 2 failures — player list and stats count are wrong.

- [ ] **Step 3: Install pg**

```bash
npm install pg
```

Expected: `pg` added to `node_modules` and `package.json` dependencies.

- [ ] **Step 4: Update DEFAULT_DATA and add SEED_DATA in server.js**

Replace lines 6–9 of `server.js` (the `DEFAULT_DATA` constant) with:

```javascript
const DEFAULT_DATA = {
  players: ['Rick', 'Gareth', 'Lachy', 'Scott', 'Miles', 'Glenn', 'Grant'],
  weeks: [],
};

const SEED_DATA = {
  players: ['Rick', 'Gareth', 'Lachy', 'Scott', 'Miles', 'Glenn', 'Grant'],
  weeks: [
    { date: '2026-01-01', weekNumber: 1,  ballsWeek: true,  players: ['Rick','Grant','Scott','Gareth'],  assignments: { paying: 'Rick',   balls: 'Scott',  drinks: 'Gareth' } },
    { date: '2026-01-08', weekNumber: 2,  ballsWeek: false, players: ['Scott','Gareth','Lachy','Rick'],  assignments: { paying: 'Scott',  balls: null,     drinks: 'Rick'   } },
    { date: '2026-01-15', weekNumber: 3,  ballsWeek: true,  players: ['Miles','Rick','Scott','Glenn'],   assignments: { paying: 'Miles',  balls: 'Glenn',  drinks: 'Glenn'  } },
    { date: '2026-01-22', weekNumber: 4,  ballsWeek: false, players: ['Gareth','Glenn','Rick','Scott'],  assignments: { paying: 'Gareth', balls: null,     drinks: 'Scott'  } },
    { date: '2026-01-29', weekNumber: 5,  ballsWeek: true,  players: ['Glenn','Gareth','Scott','Rick'],  assignments: { paying: 'Glenn',  balls: 'Rick',   drinks: 'Rick'   } },
    { date: '2026-02-05', weekNumber: 6,  ballsWeek: false, players: ['Scott','Rick','Glenn','Gareth'],  assignments: { paying: 'Scott',  balls: null,     drinks: 'Gareth' } },
    { date: '2026-02-12', weekNumber: 7,  ballsWeek: true,  players: ['Rick','Scott','Gareth','Glenn'],  assignments: { paying: 'Rick',   balls: 'Gareth', drinks: 'Glenn'  } },
    { date: '2026-02-19', weekNumber: 8,  ballsWeek: false, players: ['Scott','Rick','Gareth','Glenn'],  assignments: { paying: 'Scott',  balls: null,     drinks: 'Glenn'  } },
    { date: '2026-02-26', weekNumber: 9,  ballsWeek: true,  players: ['Rick','Scott','Lachy','Gareth'],  assignments: { paying: 'Rick',   balls: 'Scott',  drinks: 'Gareth' } },
    { date: '2026-03-05', weekNumber: 10, ballsWeek: false, players: ['Gareth','Rick','Lachy','Scott'],  assignments: { paying: 'Gareth', balls: null,     drinks: 'Scott'  } },
  ],
};
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test
```

Expected: all tests pass (the updated GET tests now match the 7-player list).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json server.js tests/api.test.js
git commit -m "feat: expand player list to 7, add seed data, install pg"
```

---

### Task 2: Async storage layer (PostgreSQL + file fallback)

**Files:**
- Modify: `server.js` (lines 1–90 — restructure readData, writeData, route handlers)

No new tests needed: existing tests cover the file path and will continue to pass. The DB path is verified via deployment. **Important:** tests must not have `DATABASE_URL` set in the environment — if it is set, unset it before running tests.

- [ ] **Step 1: Replace the entire server.js with the async version**

Replace `server.js` with:

```javascript
const express = require('express');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { assignDuties, computeStats, getNearestThursday } = require('./algorithm');

const DEFAULT_DATA = {
  players: ['Rick', 'Gareth', 'Lachy', 'Scott', 'Miles', 'Glenn', 'Grant'],
  weeks: [],
};

const SEED_DATA = {
  players: ['Rick', 'Gareth', 'Lachy', 'Scott', 'Miles', 'Glenn', 'Grant'],
  weeks: [
    { date: '2026-01-01', weekNumber: 1,  ballsWeek: true,  players: ['Rick','Grant','Scott','Gareth'],  assignments: { paying: 'Rick',   balls: 'Scott',  drinks: 'Gareth' } },
    { date: '2026-01-08', weekNumber: 2,  ballsWeek: false, players: ['Scott','Gareth','Lachy','Rick'],  assignments: { paying: 'Scott',  balls: null,     drinks: 'Rick'   } },
    { date: '2026-01-15', weekNumber: 3,  ballsWeek: true,  players: ['Miles','Rick','Scott','Glenn'],   assignments: { paying: 'Miles',  balls: 'Glenn',  drinks: 'Glenn'  } },
    { date: '2026-01-22', weekNumber: 4,  ballsWeek: false, players: ['Gareth','Glenn','Rick','Scott'],  assignments: { paying: 'Gareth', balls: null,     drinks: 'Scott'  } },
    { date: '2026-01-29', weekNumber: 5,  ballsWeek: true,  players: ['Glenn','Gareth','Scott','Rick'],  assignments: { paying: 'Glenn',  balls: 'Rick',   drinks: 'Rick'   } },
    { date: '2026-02-05', weekNumber: 6,  ballsWeek: false, players: ['Scott','Rick','Glenn','Gareth'],  assignments: { paying: 'Scott',  balls: null,     drinks: 'Gareth' } },
    { date: '2026-02-12', weekNumber: 7,  ballsWeek: true,  players: ['Rick','Scott','Gareth','Glenn'],  assignments: { paying: 'Rick',   balls: 'Gareth', drinks: 'Glenn'  } },
    { date: '2026-02-19', weekNumber: 8,  ballsWeek: false, players: ['Scott','Rick','Gareth','Glenn'],  assignments: { paying: 'Scott',  balls: null,     drinks: 'Glenn'  } },
    { date: '2026-02-26', weekNumber: 9,  ballsWeek: true,  players: ['Rick','Scott','Lachy','Gareth'],  assignments: { paying: 'Rick',   balls: 'Scott',  drinks: 'Gareth' } },
    { date: '2026-03-05', weekNumber: 10, ballsWeek: false, players: ['Gareth','Rick','Lachy','Scott'],  assignments: { paying: 'Gareth', balls: null,     drinks: 'Scott'  } },
  ],
};

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

function getDataFile() {
  return process.env.DATA_FILE || path.join(__dirname, 'data', 'roster.json');
}

async function readData() {
  if (pool) {
    const result = await pool.query('SELECT data FROM roster WHERE id = 1');
    if (result.rows.length === 0) {
      await writeData(SEED_DATA);
      return JSON.parse(JSON.stringify(SEED_DATA));
    }
    return result.rows[0].data;
  }
  const file = getDataFile();
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(DEFAULT_DATA, null, 2));
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function writeData(data) {
  if (pool) {
    await pool.query(
      'INSERT INTO roster (id, data) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET data = $1',
      [JSON.stringify(data)]
    );
    return;
  }
  fs.writeFileSync(getDataFile(), JSON.stringify(data, null, 2));
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/state', async (req, res) => {
  try {
    const data = await readData();
    const stats = computeStats(data.players, data.weeks);
    res.json({
      players: data.players,
      currentWeek: data.weeks.length > 0 ? data.weeks[data.weeks.length - 1] : null,
      weeks: [...data.weeks].reverse(),
      stats,
    });
  } catch (err) {
    console.error('Failed to read state:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/week', async (req, res) => {
  try {
    const { players } = req.body;
    const data = await readData();

    if (!Array.isArray(players) || players.length !== 4) {
      return res.status(400).json({ error: 'Exactly 4 players required' });
    }
    if (new Set(players).size !== players.length) {
      return res.status(400).json({ error: 'Duplicate players are not allowed' });
    }
    for (const p of players) {
      if (!data.players.includes(p)) {
        return res.status(400).json({ error: `Unknown player: ${p}` });
      }
    }

    const { weekNumber, ballsWeek, assignments } = assignDuties(players, data.weeks);
    const week = {
      date: getNearestThursday(),
      weekNumber,
      ballsWeek,
      players,
      assignments,
    };

    data.weeks.push(week);
    await writeData(data);

    res.json(week);
  } catch (err) {
    console.error('Failed to assign week:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = { app };

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
}
```

- [ ] **Step 2: Run tests to verify all still pass**

```bash
npm test
```

Expected: all tests pass (file path is unchanged, tests don't set DATABASE_URL).

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat: async storage layer with PostgreSQL/Neon + file fallback"
```

---

### Task 3: PUT /api/week/:weekNumber endpoint

**Files:**
- Modify: `server.js` (add new route before `module.exports`)
- Modify: `tests/api.test.js` (add new describe block)

- [ ] **Step 1: Write the failing tests**

Append this describe block to `tests/api.test.js` (after the `POST /api/week` describe, before the end of file):

```javascript
describe('PUT /api/week/:weekNumber', () => {
  beforeEach(async () => {
    // Create week 1 (balls week) with known players
    await request(app)
      .post('/api/week')
      .send({ players: ['Rick', 'Gareth', 'Lachy', 'Scott'] });
  });

  test('returns 200 and updated assignments on valid edit', async () => {
    const res = await request(app)
      .put('/api/week/1')
      .send({ assignments: { paying: 'Gareth', balls: 'Rick', drinks: 'Lachy' } });
    expect(res.status).toBe(200);
    expect(res.body.assignments.paying).toBe('Gareth');
    expect(res.body.assignments.balls).toBe('Rick');
    expect(res.body.assignments.drinks).toBe('Lachy');
  });

  test('returns 404 for non-existent week number', async () => {
    const res = await request(app)
      .put('/api/week/999')
      .send({ assignments: { paying: 'Rick', balls: 'Gareth', drinks: 'Lachy' } });
    expect(res.status).toBe(404);
  });

  test('returns 400 when paying player was not in that week', async () => {
    const res = await request(app)
      .put('/api/week/1')
      .send({ assignments: { paying: 'Miles', balls: 'Rick', drinks: 'Lachy' } });
    expect(res.status).toBe(400);
  });

  test('returns 400 when balls assigned on a non-balls week', async () => {
    await request(app)
      .post('/api/week')
      .send({ players: ['Rick', 'Gareth', 'Lachy', 'Scott'] });
    const res = await request(app)
      .put('/api/week/2')
      .send({ assignments: { paying: 'Rick', balls: 'Gareth', drinks: 'Lachy' } });
    expect(res.status).toBe(400);
  });

  test('after edit, GET /api/state stats reflect the overridden assignments', async () => {
    await request(app)
      .put('/api/week/1')
      .send({ assignments: { paying: 'Gareth', balls: 'Rick', drinks: 'Lachy' } });
    const stateRes = await request(app).get('/api/state');
    expect(stateRes.body.stats.Gareth.paying).toBe(1);
    expect(stateRes.body.stats.Rick.balls).toBe(1);
    expect(stateRes.body.stats.Lachy.drinks).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: 5 failures — `PUT /api/week/:weekNumber` route does not exist (404s everywhere).

- [ ] **Step 3: Add the PUT route to server.js**

Insert this block in `server.js` between the `POST /api/week` handler and `module.exports`:

```javascript
app.put('/api/week/:weekNumber', async (req, res) => {
  try {
    const weekNumber = parseInt(req.params.weekNumber, 10);
    const { assignments } = req.body;
    if (!assignments) {
      return res.status(400).json({ error: 'assignments required' });
    }

    const data = await readData();
    const week = data.weeks.find(w => w.weekNumber === weekNumber);
    if (!week) {
      return res.status(404).json({ error: `Week ${weekNumber} not found` });
    }

    const { paying, balls, drinks } = assignments;

    if (!week.players.includes(paying)) {
      return res.status(400).json({ error: `${paying} did not play in week ${weekNumber}` });
    }
    if (!week.players.includes(drinks)) {
      return res.status(400).json({ error: `${drinks} did not play in week ${weekNumber}` });
    }
    if (week.ballsWeek) {
      if (!balls || !week.players.includes(balls)) {
        return res.status(400).json({ error: "balls must be one of this week's players on a balls week" });
      }
    } else {
      if (balls != null) {
        return res.status(400).json({ error: 'balls must be null on non-balls weeks' });
      }
    }

    week.assignments = { paying, balls: balls ?? null, drinks };
    await writeData(data);
    res.json(week);
  } catch (err) {
    console.error('Failed to update week:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add server.js tests/api.test.js
git commit -m "feat: add PUT /api/week/:weekNumber for editing past assignments"
```

---

### Task 4: AO-inspired visual redesign

**Files:**
- Modify: `public/index.html`

No automated tests for UI. Verify visually by running the server and opening the browser.

- [ ] **Step 1: Replace the entire `<style>` block in index.html**

Replace everything between `<style>` and `</style>` (lines 7–170) with:

```css
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #F5F7FA;
      color: #1A1A2E;
      min-height: 100vh;
    }

    header {
      background: #0B3D6E;
      color: white;
      padding: 16px 20px;
    }
    header h1 { font-size: 1.25rem; font-weight: 800; margin-bottom: 4px; letter-spacing: 0.02em; }
    #week-meta { font-size: 0.85rem; opacity: 0.85; display: flex; gap: 10px; align-items: center; }
    .badge {
      background: #C8E34B;
      color: #1A1A2E;
      padding: 2px 8px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 700;
    }

    main { max-width: 480px; margin: 0 auto; padding: 20px 16px; display: flex; flex-direction: column; gap: 24px; }

    /* --- Role Cards --- */
    #role-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
    }
    .role-card {
      background: white;
      border-radius: 10px;
      padding: 16px 12px;
      text-align: center;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    }
    .role-card .icon { font-size: 1.75rem; margin-bottom: 6px; }
    .role-card .player { font-weight: 700; font-size: 1rem; color: #009AC7; margin-bottom: 2px; }
    .role-card .label { font-size: 0.75rem; color: #6c757d; text-transform: uppercase; letter-spacing: 0.04em; }

    /* --- Player chips (who's playing) --- */
    #playing-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
    .chip {
      background: #E3F4FA;
      color: #0B3D6E;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 500;
    }

    /* --- Set players section --- */
    #set-week-area { background: white; border-radius: 10px; padding: 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    #set-week-btn {
      width: 100%;
      background: none;
      border: 2px solid #009AC7;
      color: #009AC7;
      padding: 10px;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
    }
    #set-week-btn:hover { background: #E3F4FA; }

    #player-select { margin-top: 14px; display: none; }
    #player-select.open { display: block; }
    #player-select .select-label { font-size: 0.8rem; color: #6c757d; margin-bottom: 10px; }
    #toggle-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
    .toggle-chip {
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      border: 2px solid #009AC7;
      background: white;
      color: #009AC7;
      transition: background 0.15s, color 0.15s;
    }
    .toggle-chip.selected { background: #009AC7; color: white; }
    #select-count { font-size: 0.8rem; color: #6c757d; display: block; margin-bottom: 10px; }

    #assign-btn {
      width: 100%;
      background: #009AC7;
      color: white;
      border: none;
      padding: 10px;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
    }
    #assign-btn:disabled { background: #adb5bd; cursor: not-allowed; }
    #error-msg { color: #dc3545; font-size: 0.85rem; margin-top: 8px; display: none; }

    /* --- Copy button --- */
    #copy-btn {
      width: 100%;
      background: none;
      border: 2px solid #009AC7;
      color: #009AC7;
      padding: 8px;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      margin-top: 12px;
    }
    #copy-btn:hover { background: #E3F4FA; }

    /* --- No week state --- */
    #no-week {
      background: white;
      border-radius: 10px;
      padding: 24px;
      text-align: center;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    }
    #no-week p { color: #6c757d; margin-bottom: 12px; font-size: 0.9rem; }

    /* --- Stats --- */
    #stats-section h2 {
      font-size: 0.85rem;
      font-weight: 800;
      margin-bottom: 12px;
      color: #0B3D6E;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    #stats-cards { display: flex; flex-direction: column; gap: 10px; }
    .stat-card {
      background: white;
      border-radius: 10px;
      padding: 14px 16px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .stat-name { font-weight: 700; font-size: 0.95rem; }
    .stat-total { font-size: 0.75rem; color: #6c757d; margin-top: 1px; }
    .stat-badges { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
    .stat-badge {
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .badge-paying { background: #fff3cd; color: #856404; }
    .badge-balls  { background: #cfe2ff; color: #084298; }
    .badge-drinks { background: #d1e7dd; color: #0f5132; }

    /* --- History --- */
    #toggle-history {
      background: none;
      border: none;
      color: #0B3D6E;
      font-size: 0.875rem;
      font-weight: 700;
      cursor: pointer;
      padding: 0;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    #history-list { display: none; flex-direction: column; gap: 8px; }
    #history-list.open { display: flex; }
    .history-entry {
      background: white;
      border-radius: 8px;
      padding: 12px 14px;
      font-size: 0.85rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .h-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .history-entry .h-date { font-weight: 700; color: #0B3D6E; margin-bottom: 3px; }
    .history-entry .h-detail { color: #495057; }
    .history-entry .h-players { color: #6c757d; font-size: 0.78rem; margin-top: 3px; }

    /* --- Edit form --- */
    .edit-link {
      background: none;
      border: none;
      color: #009AC7;
      font-size: 0.8rem;
      cursor: pointer;
      padding: 0;
      font-weight: 600;
      flex-shrink: 0;
      margin-left: 8px;
    }
    .edit-form { margin-top: 10px; padding-top: 10px; border-top: 1px solid #e9ecef; }
    .edit-field { display: flex; flex-direction: column; gap: 3px; margin-bottom: 8px; }
    .edit-field label { font-size: 0.75rem; color: #6c757d; text-transform: uppercase; letter-spacing: 0.04em; }
    .edit-field select { padding: 6px 8px; border: 1px solid #dee2e6; border-radius: 6px; font-size: 0.875rem; width: 100%; }
    .edit-actions { display: flex; gap: 8px; margin-top: 4px; }
    .save-edit-btn {
      background: #009AC7;
      color: white;
      border: none;
      padding: 7px 16px;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
    }
    .cancel-edit-btn {
      background: none;
      border: 1px solid #6c757d;
      color: #6c757d;
      padding: 7px 16px;
      border-radius: 6px;
      font-size: 0.85rem;
      cursor: pointer;
    }
    .edit-error { color: #dc3545; font-size: 0.8rem; margin-top: 6px; }

    .hidden { display: none !important; }
```

- [ ] **Step 2: Update the `#week-display` div to include the copy button**

Replace the `#week-display` div in the HTML (currently lines 187–190):

```html
    <div id="week-display" class="hidden">
      <div id="role-cards"></div>
      <div id="playing-chips" style="margin-top:14px;"></div>
      <button id="copy-btn">Copy for text</button>
    </div>
```

- [ ] **Step 3: Change the drinks icon from 🥤 to 🍺 in renderThisWeek (JS)**

In the `renderThisWeek` function, change:
```javascript
      { key: 'drinks', icon: '🥤', label: 'Drinks' },
```
to:
```javascript
      { key: 'drinks', icon: '🍺', label: 'Drinks' },
```

- [ ] **Step 4: Change the drinks icon in renderStats (JS)**

In the `renderStats` function, change:
```javascript
          <span class="stat-badge badge-drinks">🥤 ×${s.drinks}</span>
```
to:
```javascript
          <span class="stat-badge badge-drinks">🍺 ×${s.drinks}</span>
```

- [ ] **Step 5: Start the server and verify the redesign visually**

```bash
node server.js
```

Open `http://localhost:3000` and verify:
- Navy (`#0B3D6E`) header
- Electric blue (`#009AC7`) buttons and active chips
- 🍺 emoji for drinks
- "DUTY STATS" and "SHOW HISTORY ▼" in uppercase
- White card backgrounds on off-white page background

- [ ] **Step 6: Commit**

```bash
git add public/index.html
git commit -m "feat: AO-inspired visual redesign (navy/electric blue/lime palette)"
```

---

### Task 5: Copy-for-text button

**Files:**
- Modify: `public/index.html` (JS section only)

The CSS and HTML for the button were added in Task 4. This task wires up the JavaScript.

- [ ] **Step 1: Add the formatCopyText function**

In the `<script>` block, add this function after the `renderHistory` function (before the history toggle event listener):

```javascript
  function formatCopyText() {
    const w = state.currentWeek;
    const d = new Date(w.date + 'T12:00:00Z');
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const dayStr = `${dayNames[d.getUTCDay()]} ${d.getUTCDate()} ${monthNames[d.getUTCMonth()]}`;

    let ballsLine;
    if (w.ballsWeek) {
      ballsLine = `🎾 Balls: ${w.assignments.balls} - week 1`;
    } else {
      const lastBallsWeek = state.weeks.find(wk => wk.assignments.balls !== null);
      const lastBallsPerson = lastBallsWeek ? lastBallsWeek.assignments.balls : '?';
      ballsLine = `🎾 Balls: ${lastBallsPerson} - week 2`;
    }

    return `Tennis ${dayStr} - Week ${w.weekNumber}\n💰 Paying: ${w.assignments.paying}\n${ballsLine}\n🍺 Drinks: ${w.assignments.drinks}`;
  }
```

- [ ] **Step 2: Add the copy button event listener**

After the `formatCopyText` function (still before the history toggle listener), add:

```javascript
  document.getElementById('copy-btn').addEventListener('click', async function () {
    const text = formatCopyText();
    try {
      await navigator.clipboard.writeText(text);
      this.textContent = 'Copied!';
      setTimeout(() => { this.textContent = 'Copy for text'; }, 2000);
    } catch (e) {
      // Fallback for browsers without clipboard API
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'width:100%;margin-top:8px;font-size:0.85rem;resize:none;';
      ta.rows = 4;
      this.insertAdjacentElement('afterend', ta);
      ta.select();
      this.textContent = 'Select all and copy ↑';
      this.onclick = null;
    }
  });
```

- [ ] **Step 3: Verify the copy button works**

Start the server (`node server.js`), open `http://localhost:3000`.

If the data file is empty (no weeks), create a week first. Then verify:
- "Copy for text" button appears below the role cards
- Clicking it copies text to clipboard (check by pasting into a text editor)
- Button shows "Copied!" for ~2 seconds then resets
- On a balls week, the text includes `🎾 Balls: [name] - week 1`
- On a non-balls week, the text includes `🎾 Balls: [last balls person] - week 2`

- [ ] **Step 4: Commit**

```bash
git add public/index.html
git commit -m "feat: copy-for-text button formats weekly duties as a text message"
```

---

### Task 6: Edit/override past weeks UI

**Files:**
- Modify: `public/index.html` (JS section only — CSS was added in Task 4)

- [ ] **Step 1: Replace the renderHistory function**

Replace the entire `renderHistory` function in the `<script>` block with:

```javascript
  function renderHistory() {
    const container = document.getElementById('history-list');
    if (state.weeks.length === 0) {
      container.innerHTML = '<p style="color:#6c757d;font-size:0.85rem;">No weeks recorded yet.</p>';
      return;
    }

    container.innerHTML = state.weeks.map(w => {
      const a = w.assignments;
      const dateStr = new Date(w.date + 'T12:00:00Z').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
      const parts = [
        `${a.paying} paid`,
        ...(a.balls ? [`${a.balls} brought balls`] : []),
        `${a.drinks} brought drinks`,
      ];
      const playerOptions = w.players.map(p => `<option value="${p}">${p}</option>`).join('');
      const ballsField = w.ballsWeek ? `
        <div class="edit-field">
          <label>Balls</label>
          <select data-role="balls">${playerOptions}</select>
        </div>` : '';

      return `
        <div class="history-entry" id="entry-${w.weekNumber}">
          <div class="h-header">
            <div>
              <div class="h-date">${dateStr} — Week ${w.weekNumber}</div>
              <div class="h-detail">${parts.join(' · ')}</div>
              <div class="h-players">${w.players.join(', ')}</div>
            </div>
            <button class="edit-link" onclick="openEditForm(${w.weekNumber})">Edit</button>
          </div>
          <div class="edit-form hidden" id="edit-form-${w.weekNumber}">
            <div class="edit-field">
              <label>Paying</label>
              <select data-role="paying">${playerOptions}</select>
            </div>
            ${ballsField}
            <div class="edit-field">
              <label>Drinks</label>
              <select data-role="drinks">${playerOptions}</select>
            </div>
            <div class="edit-actions">
              <button class="save-edit-btn" onclick="saveEdit(${w.weekNumber})">Save</button>
              <button class="cancel-edit-btn" onclick="closeEditForm(${w.weekNumber})">Cancel</button>
            </div>
            <p class="edit-error hidden" id="edit-error-${w.weekNumber}"></p>
          </div>
        </div>
      `;
    }).join('');

    // Pre-select current values in each form's dropdowns
    state.weeks.forEach(w => {
      const form = document.getElementById(`edit-form-${w.weekNumber}`);
      if (!form) return;
      form.querySelector('[data-role="paying"]').value = w.assignments.paying;
      form.querySelector('[data-role="drinks"]').value = w.assignments.drinks;
      if (w.ballsWeek && w.assignments.balls) {
        form.querySelector('[data-role="balls"]').value = w.assignments.balls;
      }
    });
  }
```

- [ ] **Step 2: Add the edit helper functions**

Add these three functions to the `<script>` block, after `renderHistory` and before `formatCopyText`:

```javascript
  function openEditForm(weekNumber) {
    document.getElementById(`edit-form-${weekNumber}`).classList.remove('hidden');
  }

  function closeEditForm(weekNumber) {
    document.getElementById(`edit-form-${weekNumber}`).classList.add('hidden');
    document.getElementById(`edit-error-${weekNumber}`).classList.add('hidden');
  }

  async function saveEdit(weekNumber) {
    const form = document.getElementById(`edit-form-${weekNumber}`);
    const errEl = document.getElementById(`edit-error-${weekNumber}`);
    errEl.classList.add('hidden');

    const paying = form.querySelector('[data-role="paying"]').value;
    const drinks = form.querySelector('[data-role="drinks"]').value;
    const ballsSelect = form.querySelector('[data-role="balls"]');
    const balls = ballsSelect ? ballsSelect.value : null;

    try {
      const res = await fetch(`/api/week/${weekNumber}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments: { paying, balls, drinks } }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }));
        errEl.textContent = data.error || 'Request failed';
        errEl.classList.remove('hidden');
        return;
      }
      await loadState();
    } catch (e) {
      errEl.textContent = 'Network error — please try again.';
      errEl.classList.remove('hidden');
    }
  }
```

- [ ] **Step 3: Verify the edit flow**

Start the server (`node server.js`), open `http://localhost:3000`, expand history.

For each history entry verify:
- "Edit" button appears top-right of the entry
- Clicking "Edit" expands the inline form with dropdowns pre-set to current values
- Changing a value and clicking "Save" updates the entry and reloads (form closes, stats update)
- Clicking "Cancel" closes the form without changes
- On a balls week, a Balls dropdown appears; on a non-balls week, it does not

- [ ] **Step 4: Run the full test suite one final time**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add public/index.html
git commit -m "feat: inline edit/override form for past week assignments"
```

---

## Deployment (after all tasks complete)

- [ ] **Set up Neon database**

  1. Go to [neon.tech](https://neon.tech), create a free account
  2. Create a new project (any name, e.g. "tennis-roster")
  3. On the project dashboard, copy the connection string — it looks like:
     `postgres://user:password@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require`

- [ ] **Add DATABASE_URL to Render**

  1. Go to your Render service dashboard
  2. Environment → Add Environment Variable
  3. Key: `DATABASE_URL`, Value: the Neon connection string

- [ ] **Push and deploy**

  ```bash
  git push origin main
  ```

  Render auto-deploys. On first request, the app creates the `roster` table and inserts the 10-week seed data. Verify by opening the deployed URL — history should show 10 weeks.
