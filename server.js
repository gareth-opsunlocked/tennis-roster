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

if (pool) {
  pool.on('error', (err) => {
    console.error('Idle pool client error:', err);
  });
}

async function initDb() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS roster (
      id   INTEGER PRIMARY KEY,
      data JSONB NOT NULL
    )
  `);
}

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
      [data]
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

    if (!paying || !drinks) {
      return res.status(400).json({ error: 'paying and drinks are required' });
    }

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

module.exports = { app };

if (require.main === module) {
  const port = process.env.PORT || 3000;
  initDb()
    .then(() => app.listen(port, () => console.log(`Server running on http://localhost:${port}`)))
    .catch((err) => { console.error('Failed to initialise DB:', err); process.exit(1); });
}
