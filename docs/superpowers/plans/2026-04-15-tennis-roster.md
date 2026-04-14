# Thursday Tennis Roster — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Node/Express web app that weekly auto-assigns tennis duties (Paying, Balls, Drinks) to 4 of 5 players based on long-term fairness history.

**Architecture:** Express backend serves a single-page vanilla JS frontend; data persists in a local JSON file; fairness algorithm is a pure function in its own module, making it easy to test independently of I/O.

**Tech Stack:** Node.js, Express 4, Jest, Supertest — no build step, no frontend framework.

---

## File Map

| File | Purpose |
|------|---------|
| `package.json` | Project config, scripts, dependencies |
| `.gitignore` | Exclude node_modules and data file |
| `algorithm.js` | Pure functions: `assignDuties`, `computeStats`, `getNearestThursday` |
| `server.js` | Express app: file I/O, routes; exports `app` for testing |
| `public/index.html` | Full frontend — HTML + embedded CSS + embedded JS |
| `tests/algorithm.test.js` | Unit tests for the fairness algorithm |
| `tests/api.test.js` | Integration tests for Express routes via supertest |
| `data/roster.json` | Runtime data — created by server on first run, gitignored |

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "tennis-roster",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.2"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^6.3.4"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
data/roster.json
```

- [ ] **Step 3: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, no errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore: project scaffolding"
```

---

## Task 2: Algorithm Module

**Files:**
- Create: `algorithm.js`
- Create: `tests/algorithm.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/algorithm.test.js`:

```javascript
const { assignDuties, computeStats, getNearestThursday } = require('../algorithm');

const PLAYERS = ['Rick', 'Gareth', 'Lachy', 'Miles'];

describe('assignDuties', () => {
  test('week 1 is a balls week with weekNumber 1', () => {
    const result = assignDuties(PLAYERS, []);
    expect(result.weekNumber).toBe(1);
    expect(result.ballsWeek).toBe(true);
    expect(result.assignments.balls).not.toBeNull();
  });

  test('week 2 is not a balls week', () => {
    const history = [{ assignments: { paying: 'Rick', balls: 'Gareth', drinks: 'Lachy' } }];
    const result = assignDuties(PLAYERS, history);
    expect(result.weekNumber).toBe(2);
    expect(result.ballsWeek).toBe(false);
    expect(result.assignments.balls).toBeNull();
  });

  test('week 3 is a balls week', () => {
    const history = [
      { assignments: { paying: 'Rick', balls: 'Gareth', drinks: 'Lachy' } },
      { assignments: { paying: 'Gareth', balls: null, drinks: 'Miles' } },
    ];
    const result = assignDuties(PLAYERS, history);
    expect(result.ballsWeek).toBe(true);
  });

  test('assigned players are all from the playing list', () => {
    const result = assignDuties(PLAYERS, []);
    expect(PLAYERS).toContain(result.assignments.paying);
    expect(PLAYERS).toContain(result.assignments.balls);
    expect(PLAYERS).toContain(result.assignments.drinks);
  });

  test('no player is assigned two roles', () => {
    const result = assignDuties(PLAYERS, []);
    const { paying, balls, drinks } = result.assignments;
    const assigned = [paying, balls, drinks].filter(Boolean);
    expect(new Set(assigned).size).toBe(assigned.length);
  });

  test('player with most paying turns is avoided for paying', () => {
    // Rick has paid 5 times; others 0 — Rick must not pay this week
    const history = Array(5).fill(null).map(() => ({
      assignments: { paying: 'Rick', balls: 'Gareth', drinks: 'Lachy' },
    }));
    for (let i = 0; i < 20; i++) {
      const result = assignDuties(PLAYERS, history);
      expect(result.assignments.paying).not.toBe('Rick');
    }
  });
});

describe('computeStats', () => {
  test('counts each role per player across all weeks', () => {
    const weeks = [
      { assignments: { paying: 'Rick', balls: 'Gareth', drinks: 'Lachy' } },
      { assignments: { paying: 'Gareth', balls: null, drinks: 'Rick' } },
    ];
    const stats = computeStats(['Rick', 'Gareth', 'Lachy', 'Miles', 'Scott'], weeks);
    expect(stats.Rick.paying).toBe(1);
    expect(stats.Rick.drinks).toBe(1);
    expect(stats.Rick.total).toBe(2);
    expect(stats.Gareth.paying).toBe(1);
    expect(stats.Gareth.balls).toBe(1);
    expect(stats.Gareth.total).toBe(2);
    expect(stats.Miles.total).toBe(0);
  });

  test('returns zero counts for all players when no weeks', () => {
    const stats = computeStats(['Rick', 'Gareth'], []);
    expect(stats.Rick).toEqual({ paying: 0, balls: 0, drinks: 0, total: 0 });
    expect(stats.Gareth).toEqual({ paying: 0, balls: 0, drinks: 0, total: 0 });
  });
});

describe('getNearestThursday', () => {
  test('returns YYYY-MM-DD string', () => {
    expect(getNearestThursday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('returned date is a Thursday', () => {
    const result = getNearestThursday();
    // Parse as noon UTC to avoid timezone-shift issues with date-only strings
    const date = new Date(result + 'T12:00:00Z');
    expect(date.getUTCDay()).toBe(4);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../algorithm'`

- [ ] **Step 3: Create `algorithm.js`**

```javascript
/**
 * Pick the candidate with the fewest turns for `role`.
 * Breaks ties randomly.
 */
function pickLowest(role, players, counts, exclude) {
  const candidates = players.filter(p => !exclude.includes(p));
  const min = Math.min(...candidates.map(p => counts[p][role]));
  const tied = candidates.filter(p => counts[p][role] === min);
  return tied[Math.floor(Math.random() * tied.length)];
}

/**
 * Given the 4 players for this week and all past weeks, returns:
 * { weekNumber, ballsWeek, assignments: { paying, balls, drinks } }
 * `assignments.balls` is null on non-balls weeks.
 * The 4th player (no duty) does not appear in assignments.
 */
function assignDuties(players, weeks) {
  const weekNumber = weeks.length + 1;
  const ballsWeek = weekNumber % 2 === 1;

  // Initialise counts for this week's players only
  const counts = {};
  for (const p of players) {
    counts[p] = { paying: 0, balls: 0, drinks: 0 };
  }

  for (const week of weeks) {
    const a = week.assignments;
    if (players.includes(a.paying)) counts[a.paying].paying++;
    if (a.balls && players.includes(a.balls)) counts[a.balls].balls++;
    if (players.includes(a.drinks)) counts[a.drinks].drinks++;
  }

  const exclude = [];

  const paying = pickLowest('paying', players, counts, exclude);
  exclude.push(paying);

  let balls = null;
  if (ballsWeek) {
    balls = pickLowest('balls', players, counts, exclude);
    exclude.push(balls);
  }

  const drinks = pickLowest('drinks', players, counts, exclude);

  return { weekNumber, ballsWeek, assignments: { paying, balls, drinks } };
}

/**
 * Returns duty counts per player across all weeks.
 * allPlayers is the full master list (all 5), not just those who played.
 */
function computeStats(allPlayers, weeks) {
  const stats = {};
  for (const p of allPlayers) {
    stats[p] = { paying: 0, balls: 0, drinks: 0, total: 0 };
  }

  for (const week of weeks) {
    const a = week.assignments;
    if (stats[a.paying]) { stats[a.paying].paying++; stats[a.paying].total++; }
    if (a.balls && stats[a.balls]) { stats[a.balls].balls++; stats[a.balls].total++; }
    if (stats[a.drinks]) { stats[a.drinks].drinks++; stats[a.drinks].total++; }
  }

  return stats;
}

/**
 * Returns the nearest Thursday as YYYY-MM-DD.
 * If today is Thursday, returns today.
 * Otherwise returns the next Thursday.
 */
function getNearestThursday() {
  const now = new Date();
  const daysUntil = (4 - now.getDay() + 7) % 7;
  const thursday = new Date(now);
  thursday.setDate(now.getDate() + daysUntil);
  return thursday.toISOString().slice(0, 10);
}

module.exports = { assignDuties, computeStats, getNearestThursday };
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `npm test tests/algorithm.test.js`
Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add algorithm.js tests/algorithm.test.js
git commit -m "feat: fairness algorithm with tests"
```

---

## Task 3: Express Server + GET /api/state

**Files:**
- Create: `server.js`
- Create: `tests/api.test.js`

- [ ] **Step 1: Write failing tests for GET /api/state**

Create `tests/api.test.js`:

```javascript
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Must be set before requiring server so server reads it at call time
const tmpFile = path.join(os.tmpdir(), `roster-test-${Date.now()}.json`);
process.env.DATA_FILE = tmpFile;

const { app } = require('../server');

afterEach(() => {
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
});

describe('GET /api/state', () => {
  test('returns 200 with empty weeks and null currentWeek on first run', async () => {
    const res = await request(app).get('/api/state');
    expect(res.status).toBe(200);
    expect(res.body.players).toEqual(['Rick', 'Gareth', 'Lachy', 'Miles', 'Scott']);
    expect(res.body.weeks).toEqual([]);
    expect(res.body.currentWeek).toBeNull();
  });

  test('stats contains all 5 players with zero totals on first run', async () => {
    const res = await request(app).get('/api/state');
    expect(Object.keys(res.body.stats)).toHaveLength(5);
    for (const player of ['Rick', 'Gareth', 'Lachy', 'Miles', 'Scott']) {
      expect(res.body.stats[player].total).toBe(0);
    }
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npm test tests/api.test.js`
Expected: FAIL — `Cannot find module '../server'`

- [ ] **Step 3: Create `server.js`**

```javascript
const express = require('express');
const fs = require('fs');
const path = require('path');
const { assignDuties, computeStats, getNearestThursday } = require('./algorithm');

const DEFAULT_DATA = {
  players: ['Rick', 'Gareth', 'Lachy', 'Miles', 'Scott'],
  weeks: [],
};

function getDataFile() {
  return process.env.DATA_FILE || path.join(__dirname, 'data', 'roster.json');
}

function readData() {
  const file = getDataFile();
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(DEFAULT_DATA, null, 2));
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeData(data) {
  fs.writeFileSync(getDataFile(), JSON.stringify(data, null, 2));
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/state', (req, res) => {
  const data = readData();
  const stats = computeStats(data.players, data.weeks);
  res.json({
    players: data.players,
    currentWeek: data.weeks.length > 0 ? data.weeks[data.weeks.length - 1] : null,
    weeks: [...data.weeks].reverse(),
    stats,
  });
});

module.exports = { app };

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `npm test tests/api.test.js`
Expected: Both GET /api/state tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server.js tests/api.test.js
git commit -m "feat: express server with GET /api/state"
```

---

## Task 4: POST /api/week Endpoint

**Files:**
- Modify: `server.js` (add POST route before `module.exports`)
- Modify: `tests/api.test.js` (append POST describe block)

- [ ] **Step 1: Write failing tests — append to `tests/api.test.js`**

Add this block at the end of the file:

```javascript
describe('POST /api/week', () => {
  test('returns 400 when fewer than 4 players sent', async () => {
    const res = await request(app)
      .post('/api/week')
      .send({ players: ['Rick', 'Gareth', 'Lachy'] });
    expect(res.status).toBe(400);
  });

  test('returns 400 when more than 4 players sent', async () => {
    const res = await request(app)
      .post('/api/week')
      .send({ players: ['Rick', 'Gareth', 'Lachy', 'Miles', 'Scott'] });
    expect(res.status).toBe(400);
  });

  test('returns 400 when an unknown player is included', async () => {
    const res = await request(app)
      .post('/api/week')
      .send({ players: ['Rick', 'Gareth', 'Lachy', 'Unknown'] });
    expect(res.status).toBe(400);
  });

  test('creates a valid week 1 with balls', async () => {
    const players = ['Rick', 'Gareth', 'Lachy', 'Miles'];
    const res = await request(app).post('/api/week').send({ players });
    expect(res.status).toBe(200);
    expect(res.body.weekNumber).toBe(1);
    expect(res.body.ballsWeek).toBe(true);
    expect(players).toContain(res.body.assignments.paying);
    expect(players).toContain(res.body.assignments.balls);
    expect(players).toContain(res.body.assignments.drinks);
    expect(res.body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('week 2 has no balls and balls assignment is null', async () => {
    const players = ['Rick', 'Gareth', 'Lachy', 'Miles'];
    await request(app).post('/api/week').send({ players });
    const res = await request(app).post('/api/week').send({ players });
    expect(res.body.weekNumber).toBe(2);
    expect(res.body.ballsWeek).toBe(false);
    expect(res.body.assignments.balls).toBeNull();
  });

  test('GET /api/state reflects week after creation', async () => {
    const players = ['Rick', 'Gareth', 'Lachy', 'Miles'];
    await request(app).post('/api/week').send({ players });
    const res = await request(app).get('/api/state');
    expect(res.body.weeks).toHaveLength(1);
    expect(res.body.currentWeek).not.toBeNull();
  });

  test('stats update after a week is created', async () => {
    const players = ['Rick', 'Gareth', 'Lachy', 'Miles'];
    const weekRes = await request(app).post('/api/week').send({ players });
    const stateRes = await request(app).get('/api/state');
    const payer = weekRes.body.assignments.paying;
    expect(stateRes.body.stats[payer].paying).toBe(1);
    expect(stateRes.body.stats[payer].total).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run tests — verify new tests fail**

Run: `npm test tests/api.test.js`
Expected: POST tests FAIL with 404.

- [ ] **Step 3: Add POST route to `server.js`**

Add this route after the `app.get('/api/state', ...)` block:

```javascript
app.post('/api/week', (req, res) => {
  const { players } = req.body;
  const data = readData();

  if (!Array.isArray(players) || players.length !== 4) {
    return res.status(400).send('Exactly 4 players required');
  }
  for (const p of players) {
    if (!data.players.includes(p)) {
      return res.status(400).send(`Unknown player: ${p}`);
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
  writeData(data);

  res.json(week);
});
```

- [ ] **Step 4: Run all tests — verify they pass**

Run: `npm test`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server.js tests/api.test.js
git commit -m "feat: POST /api/week with validation and fairness algorithm"
```

---

## Task 5: Frontend — HTML + CSS Shell

**Files:**
- Create: `public/index.html`

- [ ] **Step 1: Create `public/index.html` with HTML structure and CSS**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thursday Tennis</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f0f4f0;
      color: #1a2e1a;
      min-height: 100vh;
    }

    header {
      background: #2d6a4f;
      color: white;
      padding: 16px 20px;
    }
    header h1 { font-size: 1.25rem; font-weight: 700; margin-bottom: 4px; }
    #week-meta { font-size: 0.85rem; opacity: 0.85; display: flex; gap: 10px; align-items: center; }
    .badge {
      background: rgba(255,255,255,0.25);
      padding: 2px 8px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
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
    .role-card .player { font-weight: 700; font-size: 1rem; color: #2d6a4f; margin-bottom: 2px; }
    .role-card .label { font-size: 0.75rem; color: #6c757d; text-transform: uppercase; letter-spacing: 0.04em; }

    /* --- Player chips (who's playing) --- */
    #playing-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
    .chip {
      background: #e8f5e9;
      color: #2d6a4f;
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
      border: 2px solid #2d6a4f;
      color: #2d6a4f;
      padding: 10px;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
    }
    #set-week-btn:hover { background: #e8f5e9; }

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
      border: 2px solid #2d6a4f;
      background: white;
      color: #2d6a4f;
      transition: background 0.15s, color 0.15s;
    }
    .toggle-chip.selected { background: #2d6a4f; color: white; }
    #select-count { font-size: 0.8rem; color: #6c757d; display: block; margin-bottom: 10px; }

    #assign-btn {
      width: 100%;
      background: #2d6a4f;
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
    #stats-section h2 { font-size: 1rem; font-weight: 700; margin-bottom: 12px; color: #2d6a4f; }
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
    #history-section h2 { font-size: 1rem; font-weight: 700; margin-bottom: 12px; color: #2d6a4f; }
    #toggle-history {
      background: none;
      border: none;
      color: #2d6a4f;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      padding: 0;
      margin-bottom: 10px;
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
    .history-entry .h-date { font-weight: 700; color: #2d6a4f; margin-bottom: 3px; }
    .history-entry .h-detail { color: #495057; }
    .history-entry .h-players { color: #6c757d; font-size: 0.78rem; margin-top: 3px; }

    .hidden { display: none !important; }
  </style>
</head>
<body>

<header>
  <h1>🎾 Thursday Tennis</h1>
  <div id="week-meta"></div>
</header>

<main>

  <!-- Section 1: This Week -->
  <section id="this-week-section">
    <div id="no-week" class="hidden">
      <p>No week set yet. Select who's playing to get started.</p>
    </div>

    <div id="week-display" class="hidden">
      <div id="role-cards"></div>
      <div id="playing-chips" style="margin-top:14px;"></div>
    </div>

    <div id="set-week-area" style="margin-top:12px;">
      <button id="set-week-btn">Set This Week's Players</button>
      <div id="player-select">
        <p class="select-label" style="margin-top:14px;">Tap to toggle players in/out:</p>
        <div id="toggle-chips"></div>
        <span id="select-count">0 of 4 selected</span>
        <button id="assign-btn" disabled>Assign Duties →</button>
        <p id="error-msg"></p>
      </div>
    </div>
  </section>

  <!-- Section 2: Stats -->
  <section id="stats-section">
    <h2>Duty Stats</h2>
    <div id="stats-cards"></div>
  </section>

  <!-- Section 3: History -->
  <section id="history-section">
    <button id="toggle-history">Show history ▼</button>
    <div id="history-list"></div>
  </section>

</main>

<script>
  // JS added in Task 6 and 7
</script>
</body>
</html>
```

- [ ] **Step 2: Start the server and verify the shell loads**

Run: `node server.js`
Open: http://localhost:3000
Expected: Page loads with green header "🎾 Thursday Tennis" and empty sections. No JS errors in console.

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat: frontend HTML and CSS shell"
```

---

## Task 6: Frontend JS — Display State

**Files:**
- Modify: `public/index.html` (replace the `// JS added in Task 6 and 7` comment with full script)

- [ ] **Step 1: Replace the `<script>` content in `public/index.html`**

Replace the `<script>` block (the comment line inside it) with:

```javascript
  const PLAYERS_ALL = ['Rick', 'Gareth', 'Lachy', 'Miles', 'Scott'];

  let state = null;

  async function loadState() {
    const res = await fetch('/api/state');
    state = await res.json();
    render();
  }

  function render() {
    renderHeader();
    renderThisWeek();
    renderStats();
    renderHistory();
  }

  function renderHeader() {
    const meta = document.getElementById('week-meta');
    if (!state.currentWeek) { meta.textContent = ''; return; }
    const w = state.currentWeek;
    const dateStr = new Date(w.date + 'T12:00:00Z').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
    meta.innerHTML = `<span>${dateStr}</span><span>Week ${w.weekNumber}</span>${w.ballsWeek ? '<span class="badge">Balls week</span>' : ''}`;
  }

  function renderThisWeek() {
    const noWeek = document.getElementById('no-week');
    const weekDisplay = document.getElementById('week-display');

    if (!state.currentWeek) {
      noWeek.classList.remove('hidden');
      weekDisplay.classList.add('hidden');
      return;
    }

    noWeek.classList.add('hidden');
    weekDisplay.classList.remove('hidden');

    const w = state.currentWeek;
    const roles = [
      { key: 'paying', icon: '💰', label: 'Court Hire' },
      ...(w.ballsWeek ? [{ key: 'balls', icon: '🎾', label: 'New Balls' }] : []),
      { key: 'drinks', icon: '🥤', label: 'Drinks' },
    ];

    document.getElementById('role-cards').innerHTML = roles.map(r => `
      <div class="role-card">
        <div class="icon">${r.icon}</div>
        <div class="player">${w.assignments[r.key]}</div>
        <div class="label">${r.label}</div>
      </div>
    `).join('');

    document.getElementById('playing-chips').innerHTML =
      '<div style="font-size:0.75rem;color:#6c757d;width:100%;margin-bottom:4px;">PLAYING THIS WEEK</div>' +
      w.players.map(p => `<span class="chip">${p}</span>`).join('');
  }

  function renderStats() {
    const container = document.getElementById('stats-cards');
    const sorted = Object.entries(state.stats)
      .sort((a, b) => a[1].total - b[1].total);

    container.innerHTML = sorted.map(([name, s]) => `
      <div class="stat-card">
        <div>
          <div class="stat-name">${name}</div>
          <div class="stat-total">${s.total} duties total</div>
        </div>
        <div class="stat-badges">
          <span class="stat-badge badge-paying">💰 ×${s.paying}</span>
          <span class="stat-badge badge-balls">🎾 ×${s.balls}</span>
          <span class="stat-badge badge-drinks">🥤 ×${s.drinks}</span>
        </div>
      </div>
    `).join('');
  }

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
      return `
        <div class="history-entry">
          <div class="h-date">${dateStr} — Week ${w.weekNumber}</div>
          <div class="h-detail">${parts.join(' · ')}</div>
          <div class="h-players">${w.players.join(', ')}</div>
        </div>
      `;
    }).join('');
  }

  // History toggle
  document.getElementById('toggle-history').addEventListener('click', function () {
    const list = document.getElementById('history-list');
    const open = list.classList.toggle('open');
    this.textContent = open ? 'Hide history ▲' : 'Show history ▼';
  });

  loadState();
```

- [ ] **Step 2: Verify state display in browser**

Run: `node server.js`
Open: http://localhost:3000
Expected:
- "No week set yet" prompt is visible.
- Stats section shows all 5 players with 0 duties each.
- History shows "No weeks recorded yet."
- No console errors.

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat: frontend state display (this week, stats, history)"
```

---

## Task 7: Frontend JS — Player Selection

**Files:**
- Modify: `public/index.html` (add player selection JS inside the existing `<script>` tag, before `loadState()`)

- [ ] **Step 1: Add player selection code to the `<script>` block in `public/index.html`**

Insert this block immediately before the `loadState();` call at the bottom of the `<script>`:

```javascript
  // --- Player selection ---

  let selectedPlayers = new Set();

  function renderToggleChips() {
    const container = document.getElementById('toggle-chips');
    container.innerHTML = PLAYERS_ALL.map(p => `
      <button class="toggle-chip${selectedPlayers.has(p) ? ' selected' : ''}"
              data-player="${p}"
              onclick="togglePlayer(this, '${p}')">
        ${selectedPlayers.has(p) ? '✓ ' : ''}${p}
      </button>
    `).join('');
    updateSelectCount();
  }

  function togglePlayer(btn, player) {
    if (selectedPlayers.has(player)) {
      selectedPlayers.delete(player);
    } else {
      selectedPlayers.add(player);
    }
    renderToggleChips();
  }

  function updateSelectCount() {
    const n = selectedPlayers.size;
    document.getElementById('select-count').textContent = `${n} of 4 selected`;
    document.getElementById('assign-btn').disabled = n !== 4;
  }

  document.getElementById('set-week-btn').addEventListener('click', function () {
    const panel = document.getElementById('player-select');
    const isOpen = panel.classList.toggle('open');
    this.textContent = isOpen ? 'Cancel ✕' : 'Set This Week\'s Players';
    if (isOpen) {
      selectedPlayers = new Set();
      renderToggleChips();
    }
  });

  document.getElementById('assign-btn').addEventListener('click', async function () {
    const errEl = document.getElementById('error-msg');
    errEl.style.display = 'none';
    this.disabled = true;
    this.textContent = 'Assigning…';

    try {
      const res = await fetch('/api/week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players: [...selectedPlayers] }),
      });

      if (!res.ok) {
        const msg = await res.text();
        errEl.textContent = msg;
        errEl.style.display = 'block';
        this.disabled = false;
        this.textContent = 'Assign Duties →';
        return;
      }

      // Close panel, reload state
      document.getElementById('player-select').classList.remove('open');
      document.getElementById('set-week-btn').textContent = 'Set This Week\'s Players';
      await loadState();
    } catch (e) {
      errEl.textContent = 'Network error — please try again.';
      errEl.style.display = 'block';
      this.disabled = false;
      this.textContent = 'Assign Duties →';
    }
  });
```

- [ ] **Step 2: Test player selection end-to-end in browser**

Run: `node server.js`
Open: http://localhost:3000

1. Click "Set This Week's Players" — inline panel opens.
2. Click 4 player chips (e.g. Rick, Gareth, Lachy, Miles) — they turn green. "Assign Duties" button activates.
3. Click "Assign Duties →" — button shows "Assigning…", then panel closes.
4. Role cards appear: Paying, Balls (week 1), Drinks — each showing a player name.
5. Stats update with 1 total duty spread across players.
6. Click "Show history ▼" — week entry appears.
7. Repeat: click "Set This Week's Players" again, pick 4 players, assign — week 2 appears with no Balls card.

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat: player selection and duty assignment UI"
```

---

## Task 8: Deployment Setup

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# Thursday Tennis Roster

Weekly duty roster for Thursday tennis. Fairly assigns Paying, Balls (every other week), and Drinks responsibilities.

## Local Development

```bash
npm install
npm start        # http://localhost:3000
npm test         # run tests
```

## Deploy to Render

1. Push this repo to GitHub.
2. Go to [render.com](https://render.com) → New → Web Service.
3. Connect your GitHub repo.
4. Settings:
   - **Runtime:** Node
   - **Build command:** `npm install`
   - **Start command:** `node server.js`
5. Click Deploy.

> **Note:** Render's free tier may reset the filesystem on restart, which will wipe `data/roster.json`. For persistence, upgrade to a paid plan or migrate `roster.json` to a hosted database.
```

- [ ] **Step 2: Run full test suite one final time**

Run: `npm test`
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README with local dev and Render deployment instructions"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ GET /api/state → Task 3
- ✅ POST /api/week with validation → Task 4
- ✅ Fairness algorithm with tie-breaking → Task 2
- ✅ Balls week alternation (odd weeks) → Task 2
- ✅ Thursday date auto-calculation → Task 2 (`getNearestThursday`)
- ✅ Layout A (role cards) → Task 5
- ✅ Inline toggle chips (Layout B) → Task 7
- ✅ Stats per-player cards with badges (Layout C) → Task 6
- ✅ History collapsed by default → Task 6
- ✅ JSON file created on first run → Task 3
- ✅ 400 errors with inline message → Tasks 4 + 7
- ✅ Render deployment instructions → Task 8

**Type consistency:** `assignDuties` returns `{ weekNumber, ballsWeek, assignments }` — used identically in `server.js` Task 4 and tested in `algorithm.test.js` Task 2. ✅

**No placeholders found.** ✅
