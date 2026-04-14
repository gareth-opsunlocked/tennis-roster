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
