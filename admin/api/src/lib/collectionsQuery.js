import { prisma } from './prisma.js';
import { findCollection } from './collections.js';

// Only safe to splice into a `json_extract(payload, '$.<field>')` path expression -
// validated before use, never taken from an un-checked string.
export const FIELD_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function toResponseRecord(record) {
  return {
    id: record.id,
    collection: record.collection,
    recordKey: record.recordKey,
    data: JSON.parse(record.payload),
    updatedAt: record.updatedAt,
    updatedByEmail: record.updatedByEmail,
  };
}

// Collection keys are "namespace/name" (e.g. "ground_transport/stops"), so they need
// two URL segments - Express params don't match slashes within a single segment.
export function resolveCollection(req, res, next) {
  const collection = findCollection(`${req.params.namespace}/${req.params.name}`);
  if (!collection) return res.status(404).json({ error: 'Датасет не найден' });
  req.collection = collection;
  next();
}

export async function listRecords(req, res) {
  const { collection } = req;

  const page = Math.max(Number(req.query.page) || 1, 1);
  const pageSize = Math.min(Number(req.query.pageSize) || 50, 500);
  // Plain substring match on the raw JSON payload - SQLite's LIKE is only
  // case-insensitive for ASCII, so this is case-sensitive for Cyrillic text.
  const q = req.query.q ? String(req.query.q) : null;

  let filters = {};
  if (req.query.filters) {
    try {
      filters = JSON.parse(String(req.query.filters));
    } catch {
      return res.status(400).json({ error: 'Некорректный параметр filters (ожидается JSON)' });
    }
  }

  const conditions = ['collection = ?'];
  const params = [collection.key];
  for (const [field, value] of Object.entries(filters)) {
    if (value === '' || value == null || !FIELD_NAME_RE.test(field)) continue;
    conditions.push(`json_extract(payload, '$.${field}') = ?`);
    // Bind as-is (not String(value)): json_extract() returns a real INTEGER/REAL for numeric
    // JSON fields, and SQLite's `=` never treats a TEXT-typed parameter as equal to that even
    // when the digits match, so a numeric filter (e.g. {id: 10036}) would silently match
    // nothing if coerced to a string here.
    params.push(value);
  }
  if (q) {
    conditions.push('payload LIKE ?');
    params.push(`%${q}%`);
  }
  const where = conditions.join(' AND ');

  const [countRows, records] = await Promise.all([
    prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM DataRecord WHERE ${where}`, ...params),
    // recordKey is often "routeId" or "routeId-subrouteId" - a plain string ORDER BY sorts
    // lexicographically ("134" before "23"). CAST(...AS INTEGER) takes SQLite's leading-digits
    // prefix, so this groups by the numeric route id first, then puts the forward/main
    // direction before the backward one (route_geometry only - harmless no-op elsewhere,
    // json_extract() on a payload without "forward" is just NULL), then falls back to the
    // plain string for final stable ordering.
    prisma.$queryRawUnsafe(
      `SELECT id, collection, recordKey, payload, updatedAt, updatedByEmail FROM DataRecord WHERE ${where}
       ORDER BY CAST(recordKey AS INTEGER) ASC, json_extract(payload, '$.forward') DESC, recordKey ASC
       LIMIT ? OFFSET ?`,
      ...params,
      pageSize,
      (page - 1) * pageSize,
    ),
  ]);

  res.json({
    collection: { key: collection.key, label: collection.label, single: Boolean(collection.single) },
    page,
    pageSize,
    total: Number(countRows[0].count),
    records: records.map(toResponseRecord),
  });
}

// Distinct values for one field within a collection, with counts - powers select-style
// filters in the UI without hardcoding known values on the frontend.
export async function getFacets(req, res) {
  const field = String(req.query.field || '');
  if (!FIELD_NAME_RE.test(field)) return res.status(400).json({ error: 'Некорректное имя поля' });

  const rows = await prisma.$queryRawUnsafe(
    `SELECT json_extract(payload, '$.${field}') as value, COUNT(*) as count
     FROM DataRecord
     WHERE collection = ? AND json_extract(payload, '$.${field}') IS NOT NULL
     GROUP BY value ORDER BY count DESC LIMIT 200`,
    req.collection.key,
  );
  // json_extract() returns SQLite INTEGER columns (numbers, booleans-as-0/1) as BigInt
  // via the raw query driver - JSON.stringify can't serialize those directly.
  const toJsonSafe = (v) => (typeof v === 'bigint' ? Number(v) : v);
  res.json({ field, values: rows.map((r) => ({ value: toJsonSafe(r.value), count: Number(r.count) })) });
}

export async function getRecordById(req, res) {
  const record = await prisma.dataRecord.findUnique({ where: { id: req.params.id } });
  if (!record || record.collection !== req.collection.key) {
    return res.status(404).json({ error: 'Запись не найдена' });
  }
  res.json({ record: toResponseRecord(record) });
}
