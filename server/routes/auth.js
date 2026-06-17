import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export function registerRoutes(app) {
  const prisma = app.locals.prisma;
  const JWT_SECRET = app.locals.jwt_secret;

  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, language } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'email and password required' });

      const exists = await prisma.user.findUnique({ where: { email } });
      if (exists) return res.status(400).json({ error: 'email already registered' });

      const hash = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: { email, passwordHash: hash, language: language || 'en', verified: true }
      });

      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ token, user: { id: user.id, email: user.email, language: user.language } });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return res.status(400).json({ error: 'invalid credentials' });

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return res.status(400).json({ error: 'invalid credentials' });

      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ token, user: { id: user.id, email: user.email, language: user.language } });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  app.post('/api/auth/set-language', async (req, res) => {
    try {
      const { userId, language } = req.body;
      const user = await prisma.user.update({
        where: { id: userId },
        data: { language }
      });
      res.json({ user });
    } catch (e) {
      res.status(500).json({ error: 'Failed to set language' });
    }
  });
}
