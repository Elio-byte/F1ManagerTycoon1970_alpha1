# F1 Manager Tycoon 1970 - Alpha scaffold

This repository is a minimal scaffold for the "F1ManagerTycoon1970_alpha1" project. It includes a small Node.js backend and a static frontend (no build tools) to demonstrate:

- Register + (email) verification flow (demo: verification token printed to server log)
- A simple race engine that runs laps on the server and emits updates via Socket.IO
- A tiny frontend that connects to the server, toggles language (English/Spanish) with i18next,
  shows a simple SVG race map, and displays race events.

This scaffold is intentionally small and dependency-light so you can run it locally and iterate.

Quick start (local):

1. Clone the repo and cd into it.
2. Install dependencies: `npm install`
3. Run: `npm start`
4. Open http://localhost:3000 in your browser.

Notes / next steps:
- This scaffold uses an in-file JSON store (users.json) for simplicity. Replace with PostgreSQL / Prisma for production.
- The verification email is simulated by printing a verification URL to the server console. Hook nodemailer for real emails.
- The race engine is deterministic for demonstration but simple. Replace with your full game logic and persistence.

