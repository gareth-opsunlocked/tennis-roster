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

  test('returns 400 when duplicate players are sent', async () => {
    const res = await request(app)
      .post('/api/week')
      .send({ players: ['Rick', 'Rick', 'Rick', 'Rick'] });
    expect(res.status).toBe(400);
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
