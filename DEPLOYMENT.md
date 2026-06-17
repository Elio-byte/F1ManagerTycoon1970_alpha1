# 🏁 F1 Manager Tycoon 1970-1980

## Game Overview
A realistic F1 manager tycoon game set in the golden era of Formula 1 (1970-1980). Players create their own team and compete against AI teams. Every decision matters—from setup choices to pit strategies—and affects car reliability and performance.

## Features (Alpha)
✅ User Registration & Login (email-based)  
✅ Team Creation with custom colors  
✅ 15-minute realistic race simulations  
✅ AI opponents (3+ teams per race)  
✅ Real-time race map with car positions  
✅ Decision prompts during race (Push/Conserve/Pit)  
✅ Damage & reliability system  
✅ Surprise events (mechanical failures, punctures, engine blowouts)  
✅ Bilingual UI (English / Español)  
✅ Persistent results after race completion  
✅ Socket.IO real-time updates  

## Tech Stack
- **Frontend**: Vanilla JS + HTML/CSS (Socket.IO client)
- **Backend**: Node.js + Express + Socket.IO
- **Database**: SQLite + Prisma ORM
- **Hosting**: Render.com or Heroku

## Local Setup

### Prerequisites
- Node.js 16+
- npm or yarn

### Installation
```bash
git clone https://github.com/Elio-byte/F1ManagerTycoon1970_alpha1.git
cd F1ManagerTycoon1970_alpha1
npm install
```

### Environment Setup
```bash
cp .env.example .env
```

### Run Locally
```bash
npm start
```
Open http://localhost:3000 in your browser.

## Deploy to Render.com (Free)

### Step 1: Push to GitHub (Already done)

### Step 2: Create Render Account
1. Go to https://render.com
2. Sign up with GitHub

### Step 3: Create New Web Service
1. Click "New +" → "Web Service"
2. Connect your GitHub repo: `Elio-byte/F1ManagerTycoon1970_alpha1`
3. Fill in:
   - **Name**: `f1-manager-tycoon`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Set environment variables:
   - `JWT_SECRET`: `your-secret-key-here`
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: `file:./dev.db` (SQLite)
5. Click "Create Web Service"

### Step 4: Share the Link
Once deployed, Render will give you a URL like:
```
https://f1-manager-tycoon.onrender.com
```

Share this link with friends to play!

## Deploy to Heroku (Free tier limited)

### Step 1: Install Heroku CLI
```bash
curl https://cli-assets.heroku.com/install.sh | sh
```

### Step 2: Login & Deploy
```bash
heroku login
heroku create f1-manager-tycoon-alpha
git push heroku main
```

### Step 3: Set Environment Variables
```bash
heroku config:set JWT_SECRET=your-secret-key
heroku open
```

## Game Flow

1. **Register/Login** → Create account with email & password
2. **Create Team** → Choose team name & color
3. **Start Race** → Pick circuit (Monaco, Silverstone, etc.)
4. **Race** (15 min):
   - Watch real-time leaderboard
   - Make decisions every few laps (Push/Conserve/Pit)
   - Survive surprise events
   - Track car reliability drop
5. **Results** → See final standings & damage report

## Game Mechanics

### Reliability System
- Each car starts with 85% reliability
- Aggressive driving (-0.3% per lap) vs. Conservative (-0.2% per lap)
- Mechanical failures trigger at low reliability
- Pit stops restore +15% reliability

### Decision Impact
- **Push**: +aggression → faster but -40% wear
- **Conserve**: -aggression → slower but -20% wear
- **Pit**: Restore reliability but lose time

### Surprise Events
- Mechanical failure: -5 to -40 reliability
- Puncture: forced pit stop
- Engine blowout: retirement
- Weather shifts: affects all drivers

## API Endpoints

### Auth
- `POST /api/auth/register` → Create account
- `POST /api/auth/login` → Get JWT token
- `POST /api/auth/set-language` → Set user language

### Teams
- `POST /api/team/create` → Create team + car
- `GET /api/team/:userId` → List user teams

### Races
- `POST /api/race/start` → Start new race
- `POST /api/race/:raceId/decision` → Send decision (push/conserve/pit)

### WebSocket Events
- `race:lap` → Lap complete (positions, reliability)
- `race:event` → Surprise event triggered
- `race:end` → Race finished (final standings)

## File Structure
```
F1ManagerTycoon1970_alpha1/
├── server/
│   ├── index.js                 # Main server
│   ├── routes/
│   │   ├── auth.js             # Auth endpoints
│   │   ├── race.js             # Race endpoints
│   │   └── team.js             # Team endpoints
│   ├── engine/
│   │   └── raceEngine.js       # Race simulation logic
│   └── middleware/
│       └── auth.js             # JWT verification
├── public/
│   ├── index.html              # Main page
│   ├── style.css               # Styling
│   └── app.jsx                 # Game UI logic
├── prisma/
│   └── schema.prisma           # Database schema
├── package.json
├── .env.example
└── README.md
```

## Next Steps (Roadmap)
- [ ] Multi-season career mode
- [ ] Sponsor system & financial management
- [ ] Car upgrades & tuning
- [ ] More circuits (50+)
- [ ] Multiplayer head-to-head races
- [ ] Leaderboards & achievements
- [ ] Better UI/UX with React
- [ ] Mobile optimization

## Troubleshooting

### Race won't start
- Check browser console for errors
- Verify backend is running (`npm start`)
- Check Socket.IO connection

### Database errors
- Delete `dev.db` and restart
- Run `npm run prisma:generate`

### Login not working
- Make sure you registered first
- Check that email is exactly correct

## License
MIT

## Support
For issues or feature requests, open a GitHub issue: https://github.com/Elio-byte/F1ManagerTycoon1970_alpha1/issues

---

**Made with ❤️ for F1 fans** 🏁
