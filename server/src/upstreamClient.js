import { config } from './config.js';
import { matchSubroute } from './routeMatcher.js';

// Живые позиции транспорта Краснодара - из API карты КТТУ (lite.krdpt.ru). Ответ бинарный:
// записи с длиной-префиксом, внутри строки/числа little-endian. Декодер перенесён из
// krasnodar-transport-mobile (server.mjs). Отдаём машины в том же виде, в каком их отдавал
// портал Екатеринбурга (getVehiclesAnimation), чтобы poller.js и весь клиент не менялись.

const { url, timeoutMs } = config.upstream;

// Тип машины krdpt -> rtype портала Екатеринбурга. 6 - служебные, их не показываем.
const RTYPE = { 1: 'Тб', 2: 'А', 3: 'Тм' };
const LOW_FLOOR_TAG = 2;

class BinaryReader {
  constructor(bytes) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.offset = 0;
  }

  uint8() {
    return this.view.getUint8(this.offset++);
  }

  uint16() {
    const value = this.view.getUint16(this.offset, true);
    this.offset += 2;
    return value;
  }

  uint32BE() {
    const value = this.view.getUint32(this.offset, false);
    this.offset += 4;
    return value;
  }

  float64() {
    const value = this.view.getFloat64(this.offset, true);
    this.offset += 8;
    return value;
  }

  int64() {
    const value = Number(this.view.getBigInt64(this.offset, true));
    this.offset += 8;
    return value;
  }

  bool() {
    return this.uint8() === 1;
  }

  bytesBlock() {
    const length = this.uint16();
    const value = this.bytes.subarray(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  string() {
    return new TextDecoder().decode(this.bytesBlock());
  }

  nullable(read) {
    return this.bool() ? read() : null;
  }

  array(sizeType, read) {
    const length = sizeType === 'uint8' ? this.uint8() : this.uint16();
    return Array.from({ length }, read);
  }
}

function splitRecords(bytes) {
  const reader = new BinaryReader(bytes);
  const records = [];
  while (reader.offset < bytes.length) {
    const length = reader.uint32BE();
    records.push(bytes.subarray(reader.offset, reader.offset + length));
    reader.offset += length;
  }
  return records;
}

function readInfo(bytes) {
  const r = new BinaryReader(bytes);
  return {
    classType: r.uint8(),
    builtIn: r.int64(),
    operator: r.string(),
    registrationNumber: r.string(),
    serviceNumber: r.string(),
    model: r.string(),
    externalUrl: r.string(),
    imageId: r.nullable(() => r.string()),
    tags: r.array('uint8', () => r.uint8()),
  };
}

function readPosition(bytes) {
  const r = new BinaryReader(bytes);
  return { lat: r.float64(), lng: r.float64(), angle: r.float64() };
}

function readRoute(bytes) {
  const r = new BinaryReader(bytes);
  return {
    id: r.string(),
    name: r.string(),
    stops: r.array('uint8', () => r.string()),
    type: r.uint8(),
    direction: r.uint8(),
  };
}

function readLive(bytes) {
  const r = new BinaryReader(bytes);
  return {
    displayName: r.string(),
    position: readPosition(r.bytesBlock()),
    route: r.nullable(() => readRoute(r.bytesBlock())),
  };
}

function readVehicle(bytes) {
  const r = new BinaryReader(bytes);
  const id = r.string();
  const type = r.uint8();
  return {
    id,
    type,
    info: r.nullable(() => readInfo(r.bytesBlock())),
    live: r.nullable(() => readLive(r.bytesBlock())),
  };
}

// Числовой id маршрута для клиента (RawVehicle.routeId - число): стабильный хэш «тип|номер».
// Тот же хэш - id маршрутов в data/ground_transport (data/import_mobile.py).
export function routeIdFor(rtype, number) {
  let hash = 2166136261;
  for (const ch of `${rtype}|${number}`) {
    hash ^= ch.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// У krdpt нет времени GPS-отметки, поэтому navTime - момент, когда мы впервые увидели
// машину в текущей точке. Стоит на месте дольше 5 минут - клиент покажет её устаревшей
// (components/Map/Vehicles/staleness.ts), как и для Екатеринбурга.
const lastFix = new Map();

function navTimeFor(id, lat, lng, now) {
  const key = `${lat},${lng}`;
  const prev = lastFix.get(id);
  if (prev?.key === key) return prev.navTime;
  const navTime = new Date(now).toISOString();
  lastFix.set(id, { key, navTime });
  return navTime;
}

function toAnim(vehicle, now) {
  const rtype = RTYPE[vehicle.type];
  const live = vehicle.live;
  // Без маршрута (в депо, служебный рейс) krdpt вместо номера маршрута ставит бортовой -
  // такие машины не показываем, как и фид Екатеринбурга.
  if (!rtype || !live?.route) return null;
  const { lat, lng, angle } = live.position;
  // Латинские буквы в номере - кириллицей, как в data/ground_transport («2Е»).
  const number = (live.route.name || live.displayName).replace(/[ABCEHKMOPTX]/g, (ch) => 'АВСЕНКМОРТХ'['ABCEHKMOPTX'.indexOf(ch)]);
  const stops = live.route.stops;
  const rid = routeIdFor(rtype, number);
  return {
    deviceCode: vehicle.id,
    gosNum: vehicle.info?.registrationNumber || '',
    rid,
    srid: matchSubroute(rid, lat, lng, angle) ?? 0,
    rtype,
    rnum: number,
    lat,
    lng,
    // Скорости krdpt не отдаёт - null, и карточка машины не показывает спидометр.
    speed: null,
    dir: Math.round(angle),
    navTime: navTimeFor(vehicle.id, lat, lng, now),
    // Метка 2 у krdpt - низкий пол: она у МАЗ-206/103, трамваев 71-623/631 и «Витязь», и её нет
    // у высокопольных ЗиУ-682 и Tatra T3.
    lowFloor: vehicle.info?.tags.includes(LOW_FLOOR_TAG) ?? false,
    // Поля сверх формата портала Екатеринбурга - клиент показывает их в карточке машины.
    model: vehicle.info?.model || '',
    operator: vehicle.info?.operator || '',
    boardNumber: vehicle.info?.serviceNumber || '',
    from: stops[0] || '',
    to: stops.at(-1) || '',
  };
}

export async function fetchVehicleSnapshot() {
  const res = await fetch(url, {
    headers: {
      Origin: 'https://lite.krdpt.ru',
      Referer: 'https://lite.krdpt.ru/',
      Accept: '*/*',
      'Cache-Control': 'no-cache',
      'User-Agent': 'Mozilla/5.0 (krasnodar-transport)',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`upstream HTTP ${res.status}`);

  const bytes = new Uint8Array(await res.arrayBuffer());
  const now = Date.now();
  return splitRecords(bytes)
    .map(readVehicle)
    .map((vehicle) => toAnim(vehicle, now))
    .filter(Boolean);
}
