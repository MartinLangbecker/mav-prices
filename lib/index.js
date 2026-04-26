import { randomUUID } from 'crypto';

import { parseJourney } from './parse.js';

const MINUTE_IN_MS = 60_000;

const addMinutes = (date, minutes) =>
  new Date(date.getTime() + minutes * MINUTE_IN_MS);

const EIGHT_HOURS = 8 * 60;

// returns search results within 8 hours after departure time or before arrival time
const API_URL =
  'https://jegy-a.mav.hu/IK_API_PROD/api/OfferRequestApi/GetOfferRequest';
const INTERNATIONAL_OFFER_KIND = '4'; // seems to be static, but required

const defaults = {
  class: 2,
  seatReservation: false,
  directConnection: false,
  longerTransferTime: false, // >=10 minutes transfer time not guaranteed
  isArrivalDate: false, // date parameter is departure date
  duration: undefined, // use default 8 hour window
  intermediateStations: [],
  // one adult (26+ years), no discounts
  travellers: [{ type: '8', discounts: [] }],
};

const passengerTypes = {
  0: '109_000-004', // child (0-4 years)
  1: '11_004-006', // child (4-6 years)
  2: '30', // child (6-12 years)
  3: '11_012-014', // child (12-14 years)
  4: '107_014-015', // youth (14-15 years)
  5: '58', // youth (15-16 years)
  6: '59', // teenager (16-18 years)
  7: '107_18-26', // young adult (18-26 years)
  8: '44', // adult (26+ years)
  9: 'KUTYA_105', // dog
  10: 'KEREKPAR_106', // bicycle
};

const discountCodes = {
  1: 'BahnCard 25',
  3: 'BahnCard 50',
  5: 'BahnCard 100',
  8: 'VORTEILSCARD',
  9: 'Generalabonnement',
  10: 'Halbtaxabonnement',
  11: 'KLIMATICKET',
  12: 'ÖSTERREICHCARD',
  13: 'SwissPass 50%',
  14: 'SwissPass 100%',
  15: 'MAXI KLASIK',
  16: 'INKARTA 25',
  17: 'INKARTA 50',
  18: 'INKARTA 100',
  19: 'START KLUB',
  20: 'HU_START_KLUB_VIP',
  21: 'BERLET',
  22: 'Interrail/Eurail Pass (egyországos)',
  23: 'KEREKESSZÉKES KÍSÉRŐJE',
  24: 'VAK KÍSÉRŐJE',
  25: 'HU_VASUTAS',
  26: 'FIP_SZABADJEGY',
  27: 'FIP_EGYORSZAGOS_SZABADJEGY',
  28: 'FIP_IGAZOLVANY',
};

const buildPassengerList = (options) =>
  options.travellers.map((traveller, index) => ({
    passengerCount: 1,
    passengerId: index,
    customerTypeKey: passengerTypes[traveller.type],
    customerDiscountsKeys: traveller.discounts
      .filter(Boolean)
      .map((discountId) => discountCodes[discountId]),
  }));

const buildServiceList = (options) => {
  const list = [];
  if (options.class === 1) {
    list.push(49); // first class ticket
    if (options.seatReservation) list.push(61); // first class seat reservation
  } else if (options.class === 2) {
    list.push(50); // second class ticket
    if (options.seatReservation) list.push(62); // second class seat reservation
  }
  return list;
};

const buildSearchServiceList = (options) => {
  const list = [];
  if (options.directConnection) list.push('ATSZALLAS_NELKUL');
  if (options.seatReservation) list.push('HELYBIZTOSITASSAL');
  if (options.longerTransferTime) list.push('MIN_ATSZALLASI_IDO');
  return list;
};

const TIMEOUT_MS = 30_000;

const sendRequest = (body, sessionId) =>
  fetch(API_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      'Content-Type': 'application/json',
      UserSessionId: sessionId,
      Language: 'en',
    },
    body: JSON.stringify(body),
  }).then(async (response) => {
    if (!response.ok) {
      const responseBody = await response.text().catch(() => '');
      const err = new Error(`${response.statusText}: ${responseBody}`);
      err.statusCode = response.status;
      throw err;
    }
    return response.json();
  }).then((data) => {
    if (!Array.isArray(data?.route)) {
      const err = new Error('Unexpected API response: missing route array');
      err.responseData = data;
      throw err;
    }
    return data.route.map(parseJourney);
  });

// remove duplicates (same route, price)
const deduplicateJourneys = (journeys) => {
  const seen = new Set();
  return journeys.filter((journey) => {
    const route = journey.legs.map((leg) => leg.origin.id).join(',');
    const finalDestination = journey.legs.at(-1).destination.id;
    const key = `${route},${finalDestination}|${journey.price.amount}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const buildRequestBody = (from, to, travelDate, options) => ({
  offerkind: INTERNATIONAL_OFFER_KIND,
  startStationCode: from,
  innerStationsCodes: options.intermediateStations,
  endStationCode: to,
  modalities: [100], // 100 = Rail (only modality available for international tickets)
  // note: "passangers" is the actual API field name (their typo)
  passangers: buildPassengerList(options),
  isOneWayTicket: true,
  isTravelEndTime: options.isArrivalDate, // false = departure time, true = arrival time
  travelStartDate: travelDate.toISOString(),
  selectedServices: buildServiceList(options),
  selectedSearchServices: buildSearchServiceList(options),
  isOfDetailedSearch: true,
});

const querySingle = (from, to, travelDate, options, sessionId) =>
  sendRequest(buildRequestBody(from, to, travelDate, options), sessionId);

const queryDuration = (from, to, travelDate, options, sessionId) => {
  const requestCount = Math.ceil(options.duration / EIGHT_HOURS);
  const deadline = addMinutes(travelDate, options.duration).getTime();

  // always treat travelDate as departure time when duration is given
  const baseOptions = { ...options, isArrivalDate: false };

  // send one request per 8-hour window to cover the full duration
  const requests = Array.from({ length: requestCount }, (_, i) => {
    const windowStart = addMinutes(travelDate, EIGHT_HOURS * i);
    return sendRequest(buildRequestBody(from, to, windowStart, baseOptions), sessionId);
  });

  return Promise.allSettled(requests).then((results) => {
    const journeys = results
      .filter((result) => result.status === 'fulfilled')
      .flatMap((result) => result.value)
      // filter out connections departing after travelDate + duration
      .filter((journey) => new Date(journey.legs[0].departure).getTime() <= deadline);
    return deduplicateJourneys(journeys);
  });
};

/**
 * Query international railway connection prices from the MAV API.
 * @param {string} from - MAV station ID (e.g., "008099970")
 * @param {string} to - MAV station ID
 * @param {Date} [date] - Departure/arrival date (default: now)
 * @param {object} [opt] - Override defaults (class, duration, travellers, etc.)
 * @returns {Promise<object[]>} FPTF journey objects with price
 */
export const queryPrices = (from, to, date, opt) => {
  const options = { ...defaults, ...opt };
  const travelDate = date ?? new Date();
  const sessionId = randomUUID();

  return options.duration
    ? queryDuration(from, to, travelDate, options, sessionId)
    : querySingle(from, to, travelDate, options, sessionId);
};
