import isRoughlyEqual from 'is-roughly-equal';
import { readStations as stations } from 'mav-stations';
import test from 'tape';
import { queryPrices as prices } from './lib/index.js';

const HOUR_IN_MILLIS = 60 * 60 * 1000;

const isValidDate = (date) => {
  return isRoughlyEqual(36 * HOUR_IN_MILLIS, +morning, +new Date(date));
};

const findStation = async (id) => {
  for await (const station of stations()) {
    if (station.id === id) return true;
  }

  return false;
};

const isValidLeg = async (test, leg) => {
  test.ok(leg, 'missing leg');
  test.ok(leg.mode, 'leg is missing mode');

  test.ok(isValidDate(leg.departure), 'invalid departure date');
  test.ok(leg.origin, 'missing `origin`');
  test.ok(
    await findStation(leg.origin.id),
    `station ${leg.origin.id} not found`
  );
  if (leg.departureDelay) test.equal(typeof leg.departureDelay, 'number');
  if (leg.departurePlatform) test.equal(typeof leg.departurePlatform, 'string');

  test.ok(isValidDate(leg.arrival), 'invalid arrival date');
  test.ok(leg.destination, 'missing `destination`');
  test.ok(
    await findStation(leg.destination.id),
    `station ${leg.destination.id} not found`
  );
  if (leg.departureDelay) test.equal(typeof leg.departureDelay, 'number');
  if (leg.arrivalPlatform) test.equal(typeof leg.arrivalPlatform, 'string');

  if (leg.line) {
    test.ok(leg.line, 'missing line');
    test.equal(typeof leg.line.name, 'string');
    test.equal(typeof leg.line.mode, 'string');
  }

  if (leg.schedule) {
    test.ok(leg.schedule, 'missing schedule');
    test.equal(typeof leg.schedule, 'string');
  }
};

const isValidPrice = (test, price) => {
  test.ok(price, 'missing price');

  test.equal(price.currency, 'EUR');
  test.equal(typeof price.amount, 'number');
  test.ok(price.amount > 0 && price.amount < 1000, 'unlikely amount');
  if (price.name) test.equal(typeof price.name, 'string');
};

const isValidJourney = async (test, journey) => {
  test.ok(journey, 'missing journey');
  test.equal(journey.type, 'journey');

  test.ok(Array.isArray(journey.legs), 'missing legs');
  test.ok(journey.legs.length > 0, 'missing legs');
  for (const leg of journey.legs) {
    await isValidLeg(test, leg);
  }

  isValidPrice(test, journey.price);
};

const erfurtHbf = '008016043';
const hamburgHbf = '008001071';
const hegyeshalom = '005501362';
const wienHbf = '008101003';

// some Monday in the future
const midnight = new Date();
midnight.setDate(midnight.getDate() + (1 + 7) - midnight.getDay());
midnight.setHours(0);
midnight.setMinutes(0);
midnight.setSeconds(0);

const morning = new Date();
morning.setDate(morning.getDate() + (1 + 7) - morning.getDay());
morning.setHours(10);
morning.setMinutes(30);
morning.setSeconds(0);

test('Hamburg Hbf -> Hegyeshalom', async (test) => {
  const results = await prices(hamburgHbf, hegyeshalom, morning);
  test.ok(Array.isArray(results));
  test.ok(results.length > 0, 'no results');
  for (const result of results) {
    await isValidJourney(test, result);
  }

  test.end();
});

test('Erfurt Hbf -> Hegyeshalom via Wien Hbf', async (test) => {
  const opt = {
    duration: 11 * 60,
    intermediateStations: [
      {
        stationCode: wienHbf,
        durationOfStay: 1,
      },
    ],
  };
  const results = await prices(erfurtHbf, hegyeshalom, midnight, opt);
  test.ok(Array.isArray(results));
  test.ok(results.length > 0, 'no results');
  for (const result of results) {
    await isValidJourney(test, result);
    test.ok(
      new Date(result.legs[0].departure).getTime() <=
        midnight.getTime() + (opt.duration / 60) * HOUR_IN_MILLIS
    );
  }

  test.end();
});

// TODO: test further opt parameters
