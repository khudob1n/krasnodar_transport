import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { COLLECTIONS } from '../src/lib/collections.js';
import { DATA_DIR } from '../src/lib/paths.js';

const prisma = new PrismaClient();

// Rows go in batched rather than as one createMany: schedule_trips alone is ~87k rows
// x 3 columns, which is well past what SQLite will bind in a single statement.
const BATCH_SIZE = 5000;

// --only=<key>[,<key>] limits the run to those collections, --force re-imports a
// collection that already has rows (delete + insert) instead of skipping it. Without
// --force the behaviour is the original one: a non-empty collection is left alone, so
// a plain `npm run seed` on a fresh database still works exactly as before.
function parseArgs(argv) {
  const only = [];
  let force = false;
  let yes = false;
  for (const arg of argv) {
    if (arg === '--force') force = true;
    else if (arg === '--yes') yes = true;
    else if (arg.startsWith('--only=')) only.push(...arg.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean));
    else throw new Error(`unknown argument: ${arg}\nusage: seed.mjs [--only=<collection>[,<collection>]] [--force] [--yes]`);
  }
  const known = new Set(COLLECTIONS.map((c) => c.key));
  const unknown = only.filter((key) => !known.has(key));
  if (unknown.length > 0) {
    throw new Error(`unknown collection(s): ${unknown.join(', ')}\navailable:\n  ${COLLECTIONS.map((c) => c.key).join('\n  ')}`);
  }
  return { only, force, yes };
}

async function seedCollection(collection, { force }) {
  const filePath = path.join(DATA_DIR, collection.file);
  const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
  const rows = collection.single ? [raw] : raw;

  const existing = await prisma.dataRecord.count({ where: { collection: collection.key } });
  if (existing > 0) {
    if (!force) {
      console.log(`[seed] ${collection.key}: already has ${existing} records, skipping`);
      return;
    }
    // A partial refresh isn't possible: some collections derive recordKey from the row's
    // index in the file (see collections.js), so keys only line up after a full re-import.
    const { count } = await prisma.dataRecord.deleteMany({ where: { collection: collection.key } });
    console.log(`[seed] ${collection.key}: --force, deleted ${count} existing records`);
  }

  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE);
    await prisma.dataRecord.createMany({
      data: batch.map((row, i) => ({
        collection: collection.key,
        recordKey: collection.keyOf(row, offset + i),
        payload: JSON.stringify(row),
      })),
    });
    if (rows.length > BATCH_SIZE) {
      console.log(`[seed] ${collection.key}: ${Math.min(offset + BATCH_SIZE, rows.length)}/${rows.length}`);
    }
  }
  console.log(`[seed] ${collection.key}: imported ${rows.length} records`);
}

const { only, force, yes } = parseArgs(process.argv.slice(2));
const selected = only.length > 0 ? COLLECTIONS.filter((c) => only.includes(c.key)) : COLLECTIONS;

// A blanket --force wipes every collection, including rows an admin edited in the panel
// (those edits live only in the database - the data/ files never get them back).
if (force && only.length === 0 && !yes) {
  const edited = await prisma.dataRecord.count({ where: { updatedByEmail: { not: null } } });
  console.error(
    `[seed] --force without --only re-imports ALL ${COLLECTIONS.length} collections from data/ and would discard ` +
    `${edited} record(s) edited in the admin panel.\n` +
    `       Re-run with --only=<collection> to scope it, or add --yes to confirm.`,
  );
  await prisma.$disconnect();
  process.exit(1);
}

for (const collection of selected) {
  await seedCollection(collection, { force });
}

await prisma.$disconnect();
