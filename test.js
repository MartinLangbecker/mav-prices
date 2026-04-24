import isRoughlyEqual from 'is-roughly-equal';
import { readStations } from 'mav-stations';
import test from 'tape';
import { queryPrices } from './lib/index.js';

const HOUR_IN_MILLIS = 60 * 60 * 1000;

const loadStationIds = async () => {
  const ids = new Set();
  for await (const station of readStations()) ids.add(station.id);
  return ids;
};

const stationIds = await loadStationIds();

const isValidDate = (referenceDate, date) =>
  isRoughlyEqual(36 * HOUR_IN_MILLIS, +referenceDate, +new Date(date));

const isValidLeg = (t, leg, referenceDate) => {
  t.ok(leg, 'missing leg');
  t.ok(leg.mode, 'leg is missing mode');

  t.ok(isValidDate(referenceDate, leg.departure), 'invalid departure date');
  t.ok(leg.origin, 'missing `origin`');
  t.ok(stationIds.has(leg.origin.id), `station ${leg.origin.id} not found`);
  if (leg.departureDelay) t.equal(typeof leg.departureDelay, 'number');
  if (leg.departurePlatform) t.equal(typeof leg.departurePlatform, 'string');

  t.ok(isValidDate(referenceDate, leg.arrival), 'invalid arrival date');
  t.ok(leg.destination, 'missing `destination`');
  t.ok(stationIds.has(leg.destination.id), `station ${leg.destination.id} not found`);
  if (leg.arrivalDelay) t.equal(typeof leg.arrivalDelay, 'number');
  if (leg.arrivalPlatform) t.equal(typeof leg.arrivalPlatform, 'string');

  if (leg.line) {
    t.equal(typeof leg.line.name, 'string');
    t.equal(typeof leg.line.mode, 'string');
  }

  if (leg.schedule) t.equal(typeof leg.schedule, 'string');
};

const isValidPrice = (t, price) => {
  t.ok(price, 'missing price');
  t.equal(price.currency, 'EUR');
  t.equal(typeof price.amount, 'number');
  t.ok(price.amount > 0 && price.amount < 1000, 'unlikely amount');
  if (price.name) t.equal(typeof price.name, 'string');
};

const isValidJourney = (t, journey, referenceDate) => {
  t.ok(journey, 'missing journey');
  t.equal(journey.type, 'journey');
  t.ok(Array.isArray(journey.legs), 'missing legs');
  t.ok(journey.legs.length > 0, 'missing legs');
  for (const leg of journey.legs) isValidLeg(t, leg, referenceDate);
  isValidPrice(t, journey.price);
};

const erfurtHbf = '008016043';
const hamburgHbf = '008001071';
const hegyeshalom = '005501362';
const wienHbf = '008101003';

// some Monday in the future
const nextMonday = (hours, minutes) => {
  const date = new Date();
  date.setDate(date.getDate() + ((1 + 7 - date.getDay()) % 7 || 7));
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const midnight = nextMonday(0, 0);
const morning = nextMonday(10, 30);

test('Hamburg Hbf -> Hegyeshalom', async (t) => {
  const results = await queryPrices(hamburgHbf, hegyeshalom, morning);
  t.ok(Array.isArray(results));
  t.ok(results.length > 0, 'no results');
  for (const journey of results) isValidJourney(t, journey, morning);
  t.end();
});

test('Erfurt Hbf -> Hegyeshalom via Wien Hbf', async (t) => {
  const options = {
    duration: 11 * 60,
    intermediateStations: [{ stationCode: wienHbf, durationOfStay: 1 }],
  };
  const results = await queryPrices(erfurtHbf, hegyeshalom, midnight, options);
  t.ok(Array.isArray(results));
  t.ok(results.length > 0, 'no results');
  const deadline = midnight.getTime() + (options.duration / 60) * HOUR_IN_MILLIS;
  for (const journey of results) {
    isValidJourney(t, journey, midnight);
    t.ok(new Date(journey.legs[0].departure).getTime() <= deadline);
  }
  t.end();
});

test('Wien Hbf -> Hegyeshalom, first class with seat reservation', async (t) => {
  const options = { class: 1, seatReservation: true };
  const results = await queryPrices(wienHbf, hegyeshalom, morning, options);
  t.ok(Array.isArray(results));
  t.ok(results.length > 0, 'no results');
  for (const journey of results) isValidJourney(t, journey, morning);
  t.end();
});
