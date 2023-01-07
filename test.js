import * as isRoughlyEqual from 'is-roughly-equal';
import * as stations from 'mav-stations';
import moment from 'moment-timezone';
import tape from 'tape';
import { queryPrices as prices } from './lib/index.js';

const hour = 60 * 60 * 1000;

const validDate = (d) => {
  return isRoughlyEqual(36 * hour, +when, +new Date(d));
};

const findStation = (id) =>
  new Promise((resolve, reject) =>
    stations(id).on('error', reject).once('data', resolve)
  );

const validLeg = async (test, t) => {
  test.ok(t, 'missing trip');

  test.ok(validDate(t.departure), 'invalid departure date');
  test.ok(t.origin, 'missing `origin`');
  test.ok(await findStation(t.origin.station), 'station not found');
  if (t.departurePlatform) test.equal(typeof t.departurePlatform, 'string');

  if (!validDate(t.arrival)) console.error(t.arrival, when);
  test.ok(validDate(t.arrival), 'invalid arrival date');
  test.ok(t.destination, 'missing `destination`');
  test.ok(await findStation(t.destination.station), 'station not found');
  if (t.arrivalPlatform) test.equal(typeof t.arrivalPlatform, 'string');

  test.ok(t.line, 'missing line');
  test.equal(typeof t.line.name, 'string');
  test.equal(typeof t.line.mode, 'string');
  test.equal(typeof t.line.product, 'string');
};

const validPrice = (test, p) => {
  test.ok(p, 'missing price');

  test.equal(p.currency, 'EUR');
  test.equal(typeof p.amount, 'number');
  test.ok(p.amount > 0 && p.amount < 1000, 'ridiculous amount');
  test.equal(typeof p.discount, 'boolean');
  test.equal(typeof p.anyTrain, 'boolean');
};

const validJourney = async (test, j) => {
  test.ok(j, 'missing route');

  test.ok(Array.isArray(j.legs), 'missing legs');
  test.ok(j.legs.length > 0, 'missing legs');
  for (const leg of j.legs) {
    await validLeg(test, leg);
  }

  test.equal(typeof j.nightTrain, 'boolean');
  validPrice(test, j.price);
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

tape('Hamburg Hbf -> Hegyeshalom Hbf', async (test) => {
  const results = await prices(hamburgHbf, hegyeshalom, when);
  test.ok(Array.isArray(results));
  test.ok(results.length > 0, 'no results');
  for (const result of results) {
    await validJourney(test, result);
  }

  test.end();
});

// todo: opt.class
// todo: opt.noICETrains
// todo: opt.transferTime
// todo: opt.preferFastRoutes
