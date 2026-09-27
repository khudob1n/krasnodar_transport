import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAppAuth } from '../middleware/requireAppAuth.js';

export const favoritesRouter = Router();
favoritesRouter.use(requireAppAuth);

const VALID_KINDS = new Set(['route', 'stop']);

favoritesRouter.get('/', async (req, res) => {
  const favorites = await prisma.favorite.findMany({
    where: { appUserId: req.appUser.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ favorites: favorites.map((f) => ({ id: f.id, kind: f.kind, refId: f.refId, createdAt: f.createdAt })) });
});

favoritesRouter.post('/', async (req, res) => {
  const { kind, refId } = req.body || {};
  if (!VALID_KINDS.has(kind) || !refId) {
    return res.status(400).json({ error: 'Укажите kind ("route" или "stop") и refId' });
  }

  try {
    const favorite = await prisma.favorite.create({
      data: { appUserId: req.appUser.id, kind, refId: String(refId) },
    });
    res.status(201).json({ favorite: { id: favorite.id, kind: favorite.kind, refId: favorite.refId, createdAt: favorite.createdAt } });
  } catch {
    res.status(409).json({ error: 'Уже добавлено в избранное' });
  }
});

favoritesRouter.delete('/:kind/:refId', async (req, res) => {
  await prisma.favorite.deleteMany({
    where: { appUserId: req.appUser.id, kind: req.params.kind, refId: req.params.refId },
  });
  res.json({ ok: true });
});
