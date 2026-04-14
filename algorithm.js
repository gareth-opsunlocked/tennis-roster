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
  const year = thursday.getFullYear();
  const month = String(thursday.getMonth() + 1).padStart(2, '0');
  const day = String(thursday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = { assignDuties, computeStats, getNearestThursday };
