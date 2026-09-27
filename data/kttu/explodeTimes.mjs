// Декодер строки расписания из routes.txt сайта proezd.kttu.ru (движок stops.lt / Pikas).
// Читаемый перевод функции, которую их planner.js подставляет в ti.explodeTimes для
// Краснодара (там она минифицирована как `ej`). У Краснодара нет trip_ids (has_trips_ids).
//
// Строка: «<закодированные отправления с первой остановки>,<периоды действия>,<дни недели>,
// <сдвиги по остановкам>». Результат - матрица времени «рейс × остановка» в минутах от
// полуночи: times[stopIndex * trips + tripIndex].

function decodeSignedNumbers(encoded) {
  // Та же схема, что у Google Encoded Polyline: 5 бит на символ, символы со сдвигом 63.
  const numbers = [];
  let pos = 0;
  while (pos < encoded.length) {
    let chunk;
    let shift = 0;
    let value = 0;
    do {
      chunk = encoded.charCodeAt(pos++) - 63;
      value |= (chunk & 31) << shift;
      shift += 5;
    } while (chunk >= 32);
    numbers.push(value & 1 ? ~(value >> 1) : value >> 1);
  }
  return numbers;
}

/** Повторы вида «значение,сколько раз»; пустое «сколько» - до конца (всего total). */
function readRuns(parts, pos, total, parse) {
  const out = [];
  for (; ++pos < parts.length; ) {
    const value = parse(parts[pos]);
    let count = parts[++pos];
    const last = count === '';
    count = last ? total - out.length : +count;
    while (count-- > 0) out.push(value);
    if (last) break;
  }
  return { values: out, pos };
}

export function explodeTimes(line) {
  const parts = line.split(',');

  // 1. Отправления с первой остановки: дельты, в младших трёх битах - флаги рейса.
  const times = [];
  let step = 10;
  let time = 240;
  decodeSignedNumbers(parts[0]).forEach((raw, i) => {
    const delta = raw >> 3;
    if (i === 0) time += delta;
    else {
      step += delta;
      time += step;
    }
    times.push(time);
  });
  const trips = times.length;

  // 2. Для каждого рейса: действует с (дни от 1970-01-01), по (0 - без срока), дни недели.
  const validFrom = readRuns(parts, 1, trips, Number);
  const validTo = readRuns(parts, validFrom.pos, trips, Number);
  const workdays = readRuns(parts, validTo.pos, trips, String);

  // 3. Время на следующих остановках: сдвиг от предыдущей остановки (минуты, +5), серии
  //    «сдвиг,сколько рейсов»; пустое «сколько» - остаток рейсов этой остановки.
  let pos = workdays.pos;
  let index = trips;
  let left = trips;
  let offset = 5;
  for (; ++pos < parts.length; ) {
    offset += +parts[pos] - 5;
    let count = parts[++pos];
    if (count !== '') {
      count = +count;
      left -= count;
    } else {
      count = left;
      left = 0;
    }
    while (count-- > 0) {
      times[index] = offset + times[index - trips];
      index += 1;
    }
    if (left <= 0) {
      left = trips;
      offset = 5;
    }
  }

  return { trips, times, validFrom: validFrom.values, validTo: validTo.values, workdays: workdays.values };
}
