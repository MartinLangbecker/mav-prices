import { inspect } from 'util';
import { queryPrices } from './lib/index.js';

// some Monday in the future
const when = new Date();
when.setDate(when.getDate() + ((1 + 7 - when.getDay()) % 7 || 7));
when.setHours(0, 0, 0, 0);

const opt = {
  class: 1,
  seatReservation: true,
  directConnection: false,
  duration: 1080, // search for connections within 18 hours from departure date (triggers 3 API requests)
  longerTransferTime: false,
  isArrivalDate: true, // ignored because duration is set
  intermediateStations: [
    {
      stationCode: '008020347', // München Hbf
      durationOfStay: 0, // set to 0 so train should at least pass through station
    },
  ],
  travellers: [
    {
      type: '7', // young adult
      discounts: ['1', '8'], // BahnCard25/Railplus & Vorteilscard/Railplus
    },
  ],
};

// The MAV API requires at least one Hungarian station as departure or destination.
// Hegyeshalom is the closest Hungarian station to Western/Central Europe, so it can
// serve as an "anchor" for querying routes between non-Hungarian cities — the real
// origin/destination is then specified as an intermediate station with durationOfStay: 0.
// from Hamburg Hbf to Hegyeshalom with custom options
queryPrices('008099970', '005501362', when, opt)
  .then((journeys) => console.log(inspect(journeys, { depth: null })))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

// from Aalborg to Szeged with default settings
queryPrices('008600020', '005517228', when)
  .then((journeys) => console.log(inspect(journeys, { depth: null })))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

// from Wien to Budapest departing within the next 8 hours
queryPrices('008108000', '005510009')
  .then((journeys) => console.log(inspect(journeys, { depth: null })))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
