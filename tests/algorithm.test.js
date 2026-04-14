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
    const date = new Date(result);
    // getDay() on a date-only string (no time component) is parsed as local midnight
    expect(date.getDay()).toBe(4);
  });

  test('accepts a custom now date for testability', () => {
    // Wednesday 16 Apr 2025 → next Thursday is 17 Apr
    const wednesday = new Date(2025, 3, 16); // month is 0-indexed
    expect(getNearestThursday(wednesday)).toBe('2025-04-17');
  });

  test('returns same day when now is already Thursday', () => {
    const thursday = new Date(2025, 3, 17); // Thursday 17 Apr 2025
    expect(getNearestThursday(thursday)).toBe('2025-04-17');
  });
});
