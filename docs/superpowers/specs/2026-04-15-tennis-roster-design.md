# Thursday Tennis Roster — Design Spec
**Date:** 2026-04-15

## Overview

A simple web app for managing weekly Thursday tennis duty assignments across five players: Rick, Gareth, Lachy, Miles, Scott. One person selects the four players for the week; the app auto-assigns duties fairly based on long-term history.

---

## Stack

- **Backend:** Node.js + Express (`server.js`)
- **Frontend:** Single `public/index.html` — vanilla JS, inline CSS, no build step
- **Data:** `data/roster.json` — JSON file on the server filesystem
- **Hosting:** Render (free web service, deployed from GitHub)

---

## Data Structure

`data/roster.json`:

```json
{
  "players": ["Rick", "Gareth", "Lachy", "Miles", "Scott"],
  "weeks": [
    {
      "date": "2026-04-17",
      "weekNumber": 1,
      "ballsWeek": true,
      "players": ["Gareth", "Rick", "Lachy", "Miles"],
      "assignments": {
        "paying": "Gareth",
        "balls": "Rick",
        "drinks": "Lachy"
      }
    }
  ]
}
```

- `weekNumber` is the 1-based index of the week in the `weeks` array (i.e. `weeks.length` after appending)
- `ballsWeek` is `true` when `weekNumber` is odd (1, 3, 5…)
- `assignments.balls` is `null` on non-balls weeks
- The player with no duty is not mentioned in `assignments`

---

## API

### `GET /api/state`

Returns the full app state needed to render the UI.

**Response:**
```json
{
  "players": ["Rick", "Gareth", "Lachy", "Miles", "Scott"],
  "currentWeek": { ...week object or null if none set yet },
  "weeks": [ ...all week objects, newest first ],
  "stats": {
    "Rick":   { "paying": 2, "balls": 3, "drinks": 2, "total": 7 },
    "Gareth": { "paying": 3, "balls": 2, "drinks": 3, "total": 8 }
  }
}
```

`currentWeek` is the most recent week entry (last in `weeks` array). `stats` are computed server-side from the full history.

### `POST /api/week`

Accepts the list of players for this week, runs the fairness algorithm, appends the result to `weeks`, and returns the new week object.

**Request body:**
```json
{ "players": ["Gareth", "Rick", "Lachy", "Miles"] }
```

**Validation:** exactly 4 players, all must be in the master players list.

**Response:** the newly created week object (same shape as a week entry).

---

## Fairness Algorithm

Runs server-side in `POST /api/week`:

1. Compute each playing player's historical count for each role from `weeks`
2. Assign **Paying**: pick the player (among this week's 4) with the fewest past paying turns; break ties by random selection
3. If `ballsWeek`: assign **Balls** to the player with fewest past balls turns, excluding the Paying assignee; break ties randomly
4. Assign **Drinks** to the player with fewest past drinks turns, excluding already-assigned players; break ties randomly
5. The remaining player has no duty

Ties are broken randomly so the same player isn't always penalised by alphabetical order.

---

## UI — Single Page, Three Sections

### Section 1 — This Week

- Header bar: Thursday date, week number, "Balls week" badge if applicable
- Role cards in a 2- or 3-card grid:
  - **Paying** (always shown)
  - **Balls** (shown only on balls weeks)
  - **Drinks** (always shown)
  - Each card shows the emoji icon, role name, and assigned player name
- Playing-this-week chips (all 4 players shown as green pills)
- **"Set This Week's Players"** button — expands an inline section with:
  - Toggle chips for all 5 players (green = selected, outlined = sitting out)
  - Counter showing how many selected (must be exactly 4 to submit)
  - **"Assign Duties"** button — disabled unless exactly 4 are selected
  - On submit: POST to `/api/week`, reload state, collapse the section
- If no week has been set yet, show a prompt to set the first week

### Section 2 — Stats

- Heading: "Duty Stats"
- One card per player, sorted by total duties ascending (fewest first)
- Each card shows:
  - Player name + total duty count
  - Coloured badges: 💰 ×N (yellow), 🎾 ×N (blue), 🥤 ×N (green)

### Section 3 — History

- Collapsed by default, toggled by a "Show history" link
- Reverse-chronological list of past weeks
- Each entry: date, players, assignments (e.g. "Gareth paid · Rick brought balls · Lachy brought drinks")

---

## Balls Week Logic

- Week 1 (the very first entry) is a balls week
- Alternates: odd `weekNumber` = balls week, even = no balls
- `weekNumber` equals the position of the week in the `weeks` array (1-indexed)

---

## Error Handling

- If `POST /api/week` receives invalid input (wrong player count, unknown player), return `400` with a plain-text error message
- The frontend shows this message inline near the submit button
- If the JSON file is missing on startup, the server creates it with the default empty structure

---

## Deployment

- Source: GitHub repo
- Render: free web service, Node runtime, start command `node server.js`
- Environment: no env vars required
- Data persistence: Render free tier may wipe the filesystem on restart — acceptable for now; can migrate to a hosted DB later if needed

---

## Out of Scope

- Authentication / access control
- Ability to manually override auto-assigned duties
- Email or push notifications
- Player management UI (player list is hardcoded in the JSON)
