import moment from 'moment-timezone';
import { inspect } from 'util';
import { queryPrices as prices } from './lib/index.js';

const tz = 'Europe/Berlin';
// some Monday in the future
const when = moment
  .tz(Date.now(), tz)
  .hour(10)
  .minute(30)
  .second(0)
  .day(1 + 7)
  .toDate();

// from Hamburg Hbf to Hegyeshalom
prices('008099970', '005501362', when)
  .then((routes) => {
    console.log(inspect(routes, { depth: null }));
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
