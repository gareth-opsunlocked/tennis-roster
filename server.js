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
  try {
    const data = readData();
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

app.post('/api/week', (req, res) => {
  try {
    const { players } = req.body;
    const data = readData();

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
    writeData(data);

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
