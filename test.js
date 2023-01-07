import isRoughlyEqual from 'is-roughly-equal';
import { readStations as stations } from 'mav-stations';
import moment from 'moment-timezone';
import test from 'tape';
import { queryPrices as prices } from './lib/index.js';

const hour = 60 * 60 * 1000;

const isValidDate = (date) => {
  return isRoughlyEqual(36 * hour, +when, +new Date(date));
};

const findStation = async (id) => {
  for await (const station of stations()) {
    if (station.id === id) return true;
  }

  return false;
};

const isValidLeg = async (test, leg) => {
  test.ok(leg, 'missing leg');

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

  test.ok(leg.line, 'missing line');
  test.equal(typeof leg.line.name, 'string');
  test.equal(typeof leg.line.mode, 'string');
};

const isValidPrice = (test, price) => {
  test.ok(price, 'missing price');

  test.equal(price.currency, 'EUR');
  test.equal(typeof price.amount, 'number');
  test.ok(price.amount > 0 && price.amount < 1000, 'ridiculous amount');
  if (price.name) test.equal(typeof price.name, 'string');
};

const isValidJourney = async (test, journey) => {
  test.ok(journey, 'missing journey');

  test.ok(Array.isArray(journey.legs), 'missing legs');
  test.ok(journey.legs.length > 0, 'missing legs');
  for (const leg of journey.legs) {
    await isValidLeg(test, leg);
  }

  isValidPrice(test, journey.price);
};

const hamburgHbf = '008001071';
const hegyeshalom = '005501362';

// some Monday in the future
const when = moment
  .tz(Date.now(), 'Europe/Berlin')
  .hour(10)
  .minute(30)
  .second(0)
  .day(1 + 7)
  .toDate();

test('Hamburg Hbf -> Hegyeshalom Hbf', async (test) => {
  const results = await prices(hamburgHbf, hegyeshalom, when);
  test.ok(Array.isArray(results));
  test.ok(results.length > 0, 'no results');
  for (const result of results) {
    await isValidJourney(test, result);
  }

  test.end();
});

// todo: test opt parameters
