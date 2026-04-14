# Thursday Tennis Roster

Weekly duty roster for Thursday tennis. Fairly assigns Paying, Balls (every other week), and Drinks responsibilities across the group.

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
