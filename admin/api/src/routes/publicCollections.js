import { Router } from 'express';
import { COLLECTIONS } from '../lib/collections.js';
import { prisma } from '../lib/prisma.js';
import { resolveCollection, listRecords, getFacets, getRecordById } from '../lib/collectionsQuery.js';

// Read-only mirror of collectionsRouter for the passenger app - no login required, and no
// write routes exist here at all (not just gated off) since riders never edit reference data.
export const publicCollectionsRouter = Router();

// count и updatedAt - «версия» коллекции для мобильного приложения: оно кэширует справочники
// и расписания на устройстве и перекачивает коллекцию, только когда они поменялись.
publicCollectionsRouter.get('/', async (_req, res, next) => {
  try {
    const stats = await prisma.dataRecord.groupBy({
      by: ['collection'],
      _count: { _all: true },
      _max: { updatedAt: true },
    });
    const byKey = new Map(stats.map((s) => [s.collection, s]));
    res.json({
      collections: COLLECTIONS.map((c) => ({
        key: c.key,
        label: c.label,
        single: Boolean(c.single),
        count: byKey.get(c.key)?._count._all ?? 0,
        updatedAt: byKey.get(c.key)?._max.updatedAt ?? null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

const base = '/:namespace/:name';

publicCollectionsRouter.get(`${base}/records`, resolveCollection, listRecords);
publicCollectionsRouter.get(`${base}/facets`, resolveCollection, getFacets);
publicCollectionsRouter.get(`${base}/records/:id`, resolveCollection, getRecordById);
