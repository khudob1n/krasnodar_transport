// Переносит отдельные записи коллекции из data/ в базу админки - когда поправили несколько строк
// файла (координаты станций и т. п.) и не хочется перезаливать коллекцию целиком через seed --force.
//
//   node --env-file=.env scripts/sync-records.mjs --collection=rail/stations [--keys=a,b,c] [--force]
//
// Без --keys - все записи коллекции, которые отличаются от файла. Записи, исправленные в админке
// (updatedByEmail), не трогаются: правка в панели новее файла. --force перезаписывает и их.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { COLLECTIONS } from '../src/lib/collections.js';
import { DATA_DIR } from '../src/lib/paths.js';

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    return [key, value ?? true];
  }),
);

const collection = COLLECTIONS.find((c) => c.key === args.collection);
if (!collection) {
  console.error(`usage: sync-records.mjs --collection=<key> [--keys=a,b] [--force]\nколлекции: ${COLLECTIONS.map((c) => c.key).join(', ')}`);
  process.exit(1);
}
if (collection.single) {
  console.error('одиночные коллекции так не синхронизируются');
  process.exit(1);
}

const rows = JSON.parse(readFileSync(path.join(DATA_DIR, collection.file), 'utf-8'));
const byKey = new Map(rows.map((row, index) => [collection.keyOf(row, index), row]));
const keys = typeof args.keys === 'string' ? args.keys.split(',') : [...byKey.keys()];

const prisma = new PrismaClient();
let updated = 0;
let created = 0;
try {
  for (const recordKey of keys) {
    const row = byKey.get(recordKey);
    if (!row) {
      console.warn(`[sync] ${recordKey}: нет в файле, пропуск`);
      continue;
    }
    const payload = JSON.stringify(row);
    const existing = await prisma.dataRecord.findFirst({ where: { collection: collection.key, recordKey } });
    if (!existing) {
      await prisma.dataRecord.create({ data: { collection: collection.key, recordKey, payload } });
      created += 1;
      continue;
    }
    if (existing.payload === payload) continue;
    if (existing.updatedByEmail && !args.force) {
      console.warn(`[sync] ${recordKey}: правили в админке (${existing.updatedByEmail}), пропуск - нужен --force`);
      continue;
    }
    await prisma.dataRecord.update({ where: { id: existing.id }, data: { payload } });
    updated += 1;
  }
  console.log(`[sync] ${collection.key}: обновлено ${updated}, добавлено ${created}`);
} finally {
  await prisma.$disconnect();
}
