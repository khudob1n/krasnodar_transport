import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { COLLECTIONS } from '../lib/collections.js';
import { resolveCollection, toResponseRecord, listRecords, getFacets, getRecordById } from '../lib/collectionsQuery.js';

export const collectionsRouter = Router();
collectionsRouter.use(requireAuth);

collectionsRouter.get('/', async (_req, res) => {
  const counts = await prisma.dataRecord.groupBy({ by: ['collection'], _count: true });
  const countByKey = Object.fromEntries(counts.map((c) => [c.collection, c._count]));
  res.json({
    collections: COLLECTIONS.map((c) => ({
      key: c.key,
      label: c.label,
      single: Boolean(c.single),
      recordCount: countByKey[c.key] || 0,
    })),
  });
});

const base = '/:namespace/:name';

collectionsRouter.get(`${base}/records`, resolveCollection, listRecords);
collectionsRouter.get(`${base}/facets`, resolveCollection, getFacets);
collectionsRouter.get(`${base}/records/:id`, resolveCollection, getRecordById);

collectionsRouter.patch(`${base}/records/:id`, resolveCollection, requireRole('ADMIN'), async (req, res) => {
  const { data } = req.body || {};
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Тело запроса должно содержать поле data' });
  }

  const existing = await prisma.dataRecord.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.collection !== req.collection.key) {
    return res.status(404).json({ error: 'Запись не найдена' });
  }

  const record = await prisma.dataRecord.update({
    where: { id: req.params.id },
    data: { payload: JSON.stringify(data), updatedByEmail: req.user.email },
  });
  res.json({ record: toResponseRecord(record) });
});

collectionsRouter.post(`${base}/records`, resolveCollection, requireRole('ADMIN'), async (req, res) => {
  const { collection } = req;
  if (collection.single) return res.status(400).json({ error: 'В этом датасете одна запись, создание недоступно' });

  const { data, recordKey } = req.body || {};
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Тело запроса должно содержать поле data' });
  }
  const key = recordKey ? String(recordKey) : collection.keyOf(data, Date.now());

  try {
    const record = await prisma.dataRecord.create({
      data: { collection: collection.key, recordKey: key, payload: JSON.stringify(data), updatedByEmail: req.user.email },
    });
    res.status(201).json({ record: toResponseRecord(record) });
  } catch {
    res.status(409).json({ error: 'Запись с таким ключом уже существует' });
  }
});

collectionsRouter.delete(`${base}/records/:id`, resolveCollection, requireRole('ADMIN'), async (req, res) => {
  const existing = await prisma.dataRecord.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.collection !== req.collection.key) {
    return res.status(404).json({ error: 'Запись не найдена' });
  }
  await prisma.dataRecord.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});
