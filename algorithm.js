/**
 * Pick the candidate with the lowest duty rate (duties / sessions played) for `role`.
 * Breaks ties randomly.
 */
function pickLowest(role, players, counts, sessions, exclude) {
  const candidates = players.filter(p => !exclude.includes(p));
  if (candidates.length === 0) throw new Error(`No candidates available for role: ${role}`);
  const rate = p => sessions[p] > 0 ? counts[p][role] / sessions[p] : 0;
  const min = Math.min(...candidates.map(rate));
  const tied = candidates.filter(p => rate(p) === min);
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
  const lastWeek = weeks[weeks.length - 1];
  const lastWasBallsWeek = lastWeek
    ? (lastWeek.ballsWeek ?? lastWeek.assignments.balls != null)
    : false;
  const ballsWeek = !lastWasBallsWeek;

  // Count sessions played and duties done globally for each of this week's players
  const counts = {};
  const sessions = {};
  for (const p of players) {
    counts[p] = { paying: 0, balls: 0, drinks: 0 };
    sessions[p] = 0;
  }

  for (const week of weeks) {
    const a = week.assignments;
    for (const p of players) {
      if (!week.players || week.players.includes(p)) sessions[p]++;
    }
    if (players.includes(a.paying)) counts[a.paying].paying++;
    if (a.balls && players.includes(a.balls)) counts[a.balls].balls++;
    if (players.includes(a.drinks)) counts[a.drinks].drinks++;
  }

  const exclude = [];

  const paying = pickLowest('paying', players, counts, sessions, exclude);
  exclude.push(paying);

  let balls = null;
  if (ballsWeek) {
    balls = pickLowest('balls', players, counts, sessions, exclude);
    exclude.push(balls);
  }

  const drinks = pickLowest('drinks', players, counts, sessions, exclude);

  return { weekNumber, ballsWeek, assignments: { paying, balls, drinks } };
}

/**
 * Returns duty counts per player across all weeks.
 * allPlayers is the full master list (all 7), not just those who played.
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
function getNearestThursday(now = new Date()) {
  const daysUntil = (4 - now.getDay() + 7) % 7;
  const thursday = new Date(now);
  thursday.setDate(now.getDate() + daysUntil);
  const year = thursday.getFullYear();
  const month = String(thursday.getMonth() + 1).padStart(2, '0');
  const day = String(thursday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = { assignDuties, computeStats, getNearestThursday };
