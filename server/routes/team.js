const { verifyToken } = require('../middleware/auth');

module.exports = function teamRoutes(app) {
  const prisma = app.locals.prisma;

  if (!prisma) {
    console.warn('Prisma not available - team routes disabled');
    return;
  }

  app.post('/api/team/create', verifyToken, async (req, res) => {
    try {
      const { name, colorPrimary, colorSecondary, year } = req.body;
      const userId = req.userId;

      const team = await prisma.team.create({
        data: {
          userId,
          name,
          colorPrimary: colorPrimary || '#FF0000',
          colorSecondary: colorSecondary || '#FFFFFF'
        }
      });

      const car = await prisma.car.create({
        data: {
          teamId: team.id,
          year: year || 1975,
          currentReliability: 85
        }
      });

      res.json({ team, car });
    } catch (e) {
      console.error('Team creation error:', e);
      res.status(500).json({ error: 'Failed to create team: ' + e.message });
    }
  });

  app.get('/api/team/:userId', async (req, res) => {
    try {
      const teams = await prisma.team.findMany({
        where: { userId: req.params.userId },
        include: { cars: true }
      });
      res.json({ teams });
    } catch (e) {
      res.status(500).json({ error: 'Failed to fetch teams' });
    }
  });
};
