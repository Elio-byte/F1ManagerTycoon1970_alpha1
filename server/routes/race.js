const { RaceEngine } = require('../engine/raceEngine');
const { verifyToken } = require('../middleware/auth');

const activeRaces = new Map();

module.exports = function raceRoutes(app, io) {
  const prisma = app.locals.prisma;

  if (!prisma) {
    console.warn('Prisma not available - race routes disabled');
    return;
  }

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
      }).catch(() => null);

      if (!circuit) {
        circuit = await prisma.circuit.create({
          data: {
            name: circuitName,
            year: year || 1975,
            laps: 20,
            lengthKm: 5.0,
            svgPath: 'M20 100 Q 200 20 400 100 T 980 100'
          }
        });
      }

      let season = await prisma.season.findFirst({ where: { year: year || 1975 } }).catch(() => null);
      if (!season) {
        season = await prisma.season.create({ data: { year: year || 1975 } });
      }

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
      console.error('Race start error:', e);
      res.status(500).json({ error: 'Failed to start race: ' + e.message });
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
};

async function generateAITeams(prisma, count) {
  const aiNames = [
    'Ferrari', 'McLaren', 'Lotus', 'Tyrrell', 'Brabham',
    'Williams', 'Renault', 'March', 'Surtees', 'Shadow'
  ];
  const teams = [];
  for (let i = 0; i < count; i++) {
    try {
      const team = await prisma.team.create({
        data: {
          name: aiNames[i % aiNames.length] + ' (AI)',
          colorPrimary: '#' + Math.floor(Math.random() * 16777215).toString(16),
          colorSecondary: '#FFFFFF',
          userId: 'ai-' + Date.now() + '-' + i
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
    } catch (e) {
      console.error('AI team error:', e.message);
    }
  }
  return teams;
}

async function saveRaceResults(prisma, raceId, userId, carId, result) {
  for (let i = 0; i < result.cars.length; i++) {
    const car = result.cars[i];
    try {
      await prisma.raceResult.create({
        data: {
          raceId,
          carId: car.id,
          userId: car.id === carId ? userId : 'ai-driver',
          startingPosition: i + 1,
          finishingPosition: i + 1,
          points: calculatePoints(i + 1),
          finalReliability: Math.max(0, Math.round(car.currentReliability)),
          retired: car.status === 'retired',
          retirementReason: car.retirementReason || null
        }
      });
    } catch (e) {
      console.error('Save result error:', e.message);
    }
  }
}

function calculatePoints(position) {
  const pointsTable = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  return pointsTable[position - 1] || 0;
}

function raceSeed() {
  return Math.floor(Math.random() * 1000000);
}
