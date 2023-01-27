import moment from 'moment-timezone';
import { inspect } from 'util';
import { queryPrices as prices } from './lib/index.js';

const tz = 'Europe/Berlin';
// some Monday in the future
const when = moment
  .tz(Date.now(), tz)
  .hour(20)
  .minute(30)
  .second(0)
  .day(1 + 7)
  .toDate();

const opt = {
  class: 1,
  seatReservation: true,
  directConnection: false,
  duration: 1080, // search for connection within 18 hours from departure date (should trigger 3 API requests)
  longerTransferTime: false,
  isArrivalDate: true, // should be ignored because duration is set
  intermediateStations: [
    {
      stationCode: '008020347', // München Hbf
      durationOfStay: 0, // set to 0 so train should at least pass through station
    },
  ],
  travellers: [
    // one or more objects; up to six people and six dogs
    {
      type: '7', // young adult
      discounts: ['1', '8'], // BahnCard25/Railplus & Vorteilscard/Railplus
    },
  ],
};

// from Hamburg Hbf to Hegyeshalom with custom options
prices('008099970', '005501362', when, opt)
  .then((routes) => {
    console.log(inspect(routes, { depth: null }));
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

// from Aalborg to Szeged with default settings
prices('008600020', '005517228', when)
  .then((routes) => {
    console.log(inspect(routes, { depth: null }));
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

// from WIEN to BUDAPEST departing within the next 8 hours
prices('008108000', '005510009')
  .then((routes) => {
    console.log(inspect(routes, { depth: null }));
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
