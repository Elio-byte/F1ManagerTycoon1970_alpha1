import { RaceEngine } from '../engine/raceEngine.js';
import { verifyToken } from '../middleware/auth.js';

const activeRaces = new Map();

export function raceRoutes(app, io) {
  const prisma = app.locals.prisma;

  app.post('/api/race/start', verifyToken, async (req, res) => {
    try {
      const { carId, circuitName, year } = req.body;
      const userId = req.userId;

      const car = await prisma.car.findUnique({
        where: { id: carId },
        include: { team: true }
      });

      if (!car || car.team.userId !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      let circuit = await prisma.circuit.findUnique({
        where: { name: circuitName }
      });

      if (!circuit) {
        circuit = await createDefaultCircuit(circuitName, year);
      }

      const season = await prisma.season.findFirst({ where: { year } }) ||
        await prisma.season.create({ data: { year } });

      const race = await prisma.race.create({
        data: {
          seasonId: season.id,
          circuitId: circuit.id,
          date: new Date(),
          status: 'race'
        }
      });

      const aiTeams = await generateAITeams(prisma, 3);
      const cars = [car, ...aiTeams.map(t => ({ id: t.cars[0].id, team: t }))].map(c => ({
        id: c.id,
        team: c.team.name,
        currentReliability: c.currentReliability || 85,
        aggression: Math.random() * 0.7 + 0.3,
        progress: 0,
        lap: 0,
        status: 'running'
      }));

      const engine = new RaceEngine(cars, circuit.laps || 20, raceSeed());
      activeRaces.set(race.id, { engine, race, cars, circuit });

      engine.on('lap', (data) => {
        io.emit('race:lap', data);
      });

      engine.on('event', (data) => {
        io.emit('race:event', data);
      });

      engine.on('end', async (result) => {
        await saveRaceResults(prisma, race.id, userId, carId, result);
        io.emit('race:end', result);
        activeRaces.delete(race.id);
      });

      engine.start();
      res.json({ raceId: race.id, circuitName: circuit.name, laps: circuit.laps });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to start race' });
    }
  });

  app.post('/api/race/:raceId/decision', verifyToken, async (req, res) => {
    const { decision } = req.body;
    const data = activeRaces.get(req.params.raceId);
    if (data) {
      data.engine.applyDecision(decision);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Race not found' });
    }
  });
}

async function generateAITeams(prisma, count) {
  const aiNames = [
    'Ferrari AI', 'McLaren AI', 'Lotus AI', 'Tyrrell AI', 'Brabham AI',
    'Williams AI', 'Renault AI', 'March AI', 'Surtees AI', 'Shadow AI'
  ];
  const teams = [];
  for (let i = 0; i < count; i++) {
    const team = await prisma.team.create({
      data: {
        name: aiNames[i % aiNames.length] + ' ' + Date.now(),
        colorPrimary: '#' + Math.floor(Math.random() * 16777215).toString(16),
        colorSecondary: '#FFFFFF',
        userId: 'ai-' + i
      }
    });
    const car = await prisma.car.create({
      data: {
        teamId: team.id,
        year: 1975,
        currentReliability: Math.floor(Math.random() * 15) + 75
      }
    });
    teams.push({ ...team, cars: [car] });
  }
  return teams;
}

async function createDefaultCircuit(name, year) {
  return await app.locals.prisma.circuit.create({
    data: {
      name,
      year,
      laps: 20,
      lengthKm: 5.0,
      svgPath: 'M20 100 Q 200 20 400 100 T 980 100'
    }
  });
}

async function saveRaceResults(prisma, raceId, userId, carId, result) {
  for (const car of result.cars) {
    await prisma.raceResult.create({
      data: {
        raceId,
        carId: car.id === 'player-car' ? carId : car.id,
        userId: car.id === 'player-car' ? userId : 'ai-driver',
        finishingPosition: car.position,
        points: calculatePoints(car.position),
        finalReliability: car.currentReliability,
        retired: car.status === 'retired',
        retirementReason: car.retirementReason
      }
    });
  }
}

function calculatePoints(position) {
  const pointsTable = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  return pointsTable[position - 1] || 0;
}

function raceSeed() {
  return Math.floor(Math.random() * 1000000);
}
