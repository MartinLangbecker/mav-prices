import { randomUUID } from 'crypto';
import createFetch from 'fetch-ponyfill';

import { parseJourney } from './parse.js';

Date.prototype.addMinutes = function (minutes) {
  this.setMinutes(this.getMinutes() + minutes);
  return this;
};

const { fetch } = createFetch();

const EIGHT_HOURS = 8 * 60;

// returns search results within 8 hours after departure time or before arrival time
const url =
  'https://jegy-a.mav.hu/IK_API_PROD/api/OfferRequestApi/GetOfferRequest';

const defaults = {
  class: 2,
  seatReservation: false,
  directConnection: false,
  longerTransferTime: false, // >=10 minutes transfer time not guaranteed
  isArrivalDate: false, // date parameter is departure date
  duration: undefined, // use default 8 hour window
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
      customerDiscountsKeys: opt.travellers[i].discounts
        .filter((entry) => entry) // remove null / undefined values
        .discounts.map((j) => discounts[j]),
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

const sendRequest = (body) => {
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
    .then((body) => body.route.map(parseJourney));
};

const queryPrices = (start, dest, date, opt) => {
  const opts = Object.assign({}, defaults, opt || {});
  const travelDate = date ?? new Date();

  const body = {
    offerkind: '4', // seems to be static, but required
    startStationCode: start,
    innerStationsCodes: opts.intermediateStations,
    endStationCode: dest,
    passangers: buildPassengerList(opts),
    isOneWayTicket: true,
    isTravelEndTime: opts.isArrivalDate, // false -> date is departure time, true -> date is arrival time
    travelStartDate: travelDate.toISOString(),
    selectedServices: buildServiceList(opts),
    selectedSearchServices: buildSearchServiceList(opts),
    isOfDetailedSearch: true,
  };

  if (!(opts.duration > 0)) {
    // send single request if duration isn't specified
    return sendRequest(body);
  }

  // always treat travelDate as departure time when duration is given
  body.isTravelEndTime = false;
  // calculate necessary number of requests to cover duration
  const requestCount = Math.ceil(opts.duration / EIGHT_HOURS);

  let requests = [];
  for (let i = 0; i < requestCount; i++) {
    // increment travelStartDate by 8 hours for each additional request
    body.travelStartDate = travelDate.addMinutes(EIGHT_HOURS * i).toISOString();
    requests.push(sendRequest(body));
  }

  return Promise.allSettled(requests).then((results) =>
    results
      // only use results of successful requests
      .filter((res) => res.status === 'fulfilled')
      .map((res) => res.value)
      // join result lists
      .reduce((acc, curr) => acc.concat(curr), [])
      // filter out connections departing after travelStartDate + duration
      .filter(
        (res) =>
          new Date(res.legs[0].departure).getTime() <=
          travelDate.addMinutes(opts.duration).getTime()
      )
  );
};

export { queryPrices };
