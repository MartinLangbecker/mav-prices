import { randomUUID } from 'crypto';
import createFetch from 'fetch-ponyfill';

import * as parse from './parse.js';

const { fetch } = createFetch();

const url =
  'https://jegy-a.mav.hu/IK_API_PROD/api/OfferRequestApi/GetOfferRequest';

const defaults = {
  class: 2,
  seatReservation: false,
  directConnection: false,
  longerTransferTime: false, // >=10 minutes transfer time not guaranteed
  isArrivalDate: false, // date parameter is departure date
  duration: undefined, // only use date parameter
  intermediateStations: [],
  travellers: [
    // one adult, no discounts
    {
      type: '8',
      discounts: [],
    },
  ],
};

const passengerTypes = {
  0: '109_000-004', // child (0-4 years)
  1: '11_004-006', // child (4-6 years)
  2: '30', // child (6-12 years)
  3: '11_012-014', // child (12-14 years)
  4: '107_014-015', // youth (14-15 years)
  5: '107_015-016', // youth (15-16 years)
  6: '59', // teenager (16-18 years)
  7: '107_18-26', // young adult (18-26 years)
  8: '44', // adult (26+ years)
  9: 'KUTYA_105', // dog
};

const discounts = {
  1: 'BAHNCARD25/RAILPLUS',
  3: 'BAHNCARD50/RAILPLUS',
  5: 'BAHNCARD100/RAILPLUS',
  8: 'VORTEILSCARD/RAILPLUS',
  9: 'Generalabonnement',
  10: 'Halbtaxabonnement',
};

const buildPassengerList = (opt) => {
  const passengerList = [];

  for (let i = 0; i < opt.travellers.length; i++) {
    passengerList.push({
      passengerCount: 1,
      passengerId: i,
      customerTypeKey: passengerTypes[opt.travellers[i].type],
      customerDiscountsKeys: opt.travellers[i].discounts.map((j) =>
        discounts(j)
      ),
    });
  }

  return passengerList;
};

const buildServiceList = (opt) => {
  const serviceList = [];

  if (opt.class === 1) {
    serviceList.push(49);
    if (opt.seatReservation) serviceList.push(61);
  } else if (opt.class === 2) {
    serviceList.push(50);
    if (opt.seatReservation) serviceList.push(62);
  }

  return serviceList;
};

const buildSearchServiceList = (opt) => {
  const searchServiceList = [];

  if (opt.directConnection) searchServiceList.push('ATSZALLAS_NELKUL');
  if (opt.seatReservation) searchServiceList.push('HELYBIZTOSITASSAL');
  if (opt.longerTransferTime) searchServiceList.push('MIN_ATSZALLASI_IDO');

  return searchServiceList;
};

const queryPrices = (start, dest, date, opt) => {
  const opts = Object.assign({}, defaults, opt || {});
  const now = new Date();
  const travelDate = date.toISOString() || now.toISOString();

  const body = {
    offerkind: '4', // seems to be static, but required
    startStationCode: start,
    innerStationsCodes: opts.intermediateStations,
    endStationCode: dest,
    passangers: buildPassengerList(opts),
    isOneWayTicket: true,
    isTravelEndTime: opts.isArrivalDate || !!opts.duration, // false -> date is departure time, true -> date is arrival time
    travelStartDate: opts.duration // if duration is set, set arrival time accordingly
      ? now.setMinutes(now.getMinutes + opts.duration).toISOString()
      : travelDate,
    selectedServices: buildServiceList(opts),
    selectedSearchServices: buildSearchServiceList(opts),
    isOfDetailedSearch: true,
  };

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      UserSessionId: randomUUID(),
      Language: 'en',
    },
    body: JSON.stringify(body),
  })
    .then((res) => {
      if (!res.ok) {
        const err = new Error(res.statusText);
        err.statusCode = res.status;
        throw err;
      }
      return res.json();
    })
    .then((body) => {
      // TODO parse body

      const notes = parse.notes(body.peTexte);

      const offers = [];
      for (const id in body.angebote) {
        offers.push(parse.offer(body.angebote[id], notes));
      }

      const journeys = [];
      for (const id in body.verbindungen) {
        journeys.push(parse.journey(body.verbindungen[id], offers));
      }

      return journeys;
    });
};

export { queryPrices };
