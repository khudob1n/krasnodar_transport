import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';

export const usersRouter = Router();
usersRouter.use(requireAuth, requireRole('ADMIN'));

function publicUser(user) {
  return { id: user.id, email: user.email, role: user.role, isActive: user.isActive, createdAt: user.createdAt };
}

usersRouter.get('/', async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  res.json({ users: users.map(publicUser) });
});

usersRouter.post('/', async (req, res) => {
  const { email, password, role } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Укажите email и пароль' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Пароль должен быть не короче 8 символов' });
  }
  if (role && role !== 'ADMIN' && role !== 'VIEWER') {
    return res.status(400).json({ error: 'Роль должна быть ADMIN или VIEWER' });
  }

  const existing = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
  if (existing) {
    return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email: String(email).toLowerCase(), passwordHash, role: role || 'VIEWER' },
  });
  res.status(201).json({ user: publicUser(user) });
});

usersRouter.patch('/:id', async (req, res) => {
  const { role, isActive, password } = req.body || {};
  const data = {};
  if (role !== undefined) {
    if (role !== 'ADMIN' && role !== 'VIEWER') {
      return res.status(400).json({ error: 'Роль должна быть ADMIN или VIEWER' });
    }
    data.role = role;
  }
  if (isActive !== undefined) data.isActive = Boolean(isActive);
  if (password) {
    if (password.length < 8) {
      return res.status(400).json({ error: 'Пароль должен быть не короче 8 символов' });
    }
    data.passwordHash = await bcrypt.hash(password, 12);
  }

  if (req.params.id === req.user.id && (data.role === 'VIEWER' || data.isActive === false)) {
    return res.status(400).json({ error: 'Нельзя понизить или деактивировать самого себя' });
  }

  try {
    const user = await prisma.user.update({ where: { id: req.params.id }, data });
    res.json({ user: publicUser(user) });
  } catch {
    res.status(404).json({ error: 'Пользователь не найден' });
  }
});

usersRouter.delete('/:id', async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Нельзя удалить самого себя' });
  }
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Пользователь не найден' });
  }
});
