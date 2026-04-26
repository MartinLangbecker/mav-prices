import { randomUUID } from 'crypto';

import { parseJourney } from './parse.js';

const MINUTE_IN_MS = 60 * 1000;
const EIGHT_HOURS_IN_MINUTES = 8 * 60;

const addMinutes = (date, minutes) =>
  new Date(date.getTime() + minutes * MINUTE_IN_MS);

// returns search results within 8 hours after departure time or before arrival time
const API_BASE =
  'https://jegy-a.mav.hu/IK_API_PROD/api';
const OFFER_URL = `${API_BASE}/OfferRequestApi/GetOfferRequest`;
const EXCHANGE_RATE_URL = `${API_BASE}/BaseDataApi/GetExchangeRate?currencyKey=EUR`;
const defaults = {
  class: 2,
  seatReservation: false,
  directConnection: false,
  longerTransferTime: false, // >=10 minutes transfer time not guaranteed
  isArrivalDate: false, // date parameter is departure date
  duration: undefined, // use default 8 hour window
  intermediateStations: [],
  // one adult; use `age` (preferred) or `type` (@deprecated) — see docs
  travellers: [{ age: 30, discounts: [] }],
};

// age brackets: [maxAge, apiKey] — first match where age < maxAge wins
const internationalAgeBrackets = [
  [4, '109_000-004'],   // child 0–3
  [6, '11_004-006'],    // child 4–5
  [12, '30'],           // child 6–11
  [14, '11_012-014'],   // child 12–13
  [15, '107_014-015'],  // youth 14
  [16, '58'],           // youth 15
  [18, '59'],           // teenager 16–17
  [26, '107_18-26'],    // young adult 18–25
  [200, '44'],          // adult 26+
];

const domesticAgeBrackets = [
  [3, '110'],                        // child 0–2
  [6, 'HU_109_003-006'],             // child 3–5
  [14, 'HU_31_006-014'],             // child 6–13
  [18, 'HU_107_014-018_20240301'],   // youth 14–17
  [25, 'HU_107_018-025'],            // youth 18–24
  [65, 'HU_44_025-065'],             // adult 25–64
  [200, 'HU_108_065-199'],           // senior 65+
];

// @deprecated type maps — indexed by position in age brackets
const internationalPassengerTypes = Object.fromEntries(
  internationalAgeBrackets.map(([, key], i) => [i, key]),
);
const domesticPassengerTypes = Object.fromEntries(
  domesticAgeBrackets.map(([, key], i) => [i, key]),
);

const resolvePassengerType = (traveller, domestic) => {
  if (traveller.age != null) {
    const brackets = domestic ? domesticAgeBrackets : internationalAgeBrackets;
    const match = brackets.find(([maxAge]) => traveller.age < maxAge);
    if (!match) throw new Error(`Invalid passenger age: ${traveller.age}`);
    return match[1];
  }
  // @deprecated: type IDs differ between domestic and international
  const typeMap = domestic ? domesticPassengerTypes : internationalPassengerTypes;
  const key = typeMap[traveller.type];
  if (!key) throw new Error(`Invalid passenger type: ${traveller.type} (use \`age\` instead of \`type\`; dog/bicycle are not supported)`);
  return key;
};

const HUNGARIAN_PREFIX = '0055';

const inferDomestic = (from, to) =>
  from.startsWith(HUNGARIAN_PREFIX) && to.startsWith(HUNGARIAN_PREFIX);

const internationalDiscountCodes = {
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

const domesticDiscountCodes = {
  // 50% discounts
  1: 'HU_START_KLUB_50',                    // START Club card (50%)
  2: 'HU_START_KLUB_UTITARS_20240301',      // START Club fellow traveler (50%)
  3: 'HU_ALKALMAZASBAN_ALLOK',              // Civil servants (50%)
  4: 'HU_FIP_IGAZOLVANY_2O',               // FIP 50% domestic 2nd class
  5: 'HU_FIP_IGAZOLVANY_1O',               // FIP 50% domestic 1st class
  // passes
  6: 'HU_ORSZAGBERLET',                     // Hungary Pass
  7: 'HU_MAGYARORSZAG24',                   // Hungary 24 hour ticket (free)
  8: 'HU_BKK_BERLET_JEGY_HEVHEZ',          // BKK pass/ticket for HÉV (free)
  // free-of-charge
  9: 'HU_NEMZETKOZI_BERLET_JEGY_2_OSZTALY', // International ticket/pass 2nd class (free)
  10: 'HU_NEMZETKOZI_BERLET_JEGY_1_OSZTALY', // International ticket/pass 1st class (free)
  11: 'HU_NAGYCSALAD_TAGJA',                // Member of a large family (free)
  12: 'HU_FOGYATEKKAL_ELOK_KEDVEZMENYE',    // Persons with disabilities (free)
  13: 'HU_ELLATOTTAK_UTAZASI_UTALVANYA_JEGYHEZ', // Pensioners' Travel Certificate (free)
  14: 'HU_MAGYAR_IGAZOLVANY',               // Hungarian Pass for Foreign Citizen (free)
  15: 'HU_MENEKULTEK_IGAZOLASA',            // Certificate of refugees (free)
  16: 'HU_HADIROKKANT_CSALADTAG',           // Military care certificate - family member (free)
  // railway employee
  17: 'HU_MAV_START_VASUTI_UTAZASI_IG_2O',  // MÁV-START service card 2nd class (free)
  18: 'HU_MAV_START_VASUTI_UTAZASI_IG_1O',  // MÁV-START service card 1st class (free)
  19: 'HU_MAV_START_VASUTI_UTAZASI_IG_CSALADTAG_2O', // MÁV-START relatives 2nd class (free)
  20: 'HU_MAV_START_VASUTI_UTAZASI_IG_CSALADTAG_1O', // MÁV-START relatives 1st class (free)
  21: 'HU_GYSEV_VASUTI_UTAZASI_IG_2O',      // GYSEV service card 2nd class (free)
  22: 'HU_GYSEV_VASUTI_UTAZASI_IG_1O',      // GYSEV service card 1st class (free)
  23: 'HU_GYSEV_VASUTI_UTAZASI_IG_CSALADTAG_2O', // GYSEV relatives 2nd class (free)
  24: 'HU_GYSEV_VASUTI_UTAZASI_IG_CSALADTAG_1O', // GYSEV relatives 1st class (free)
  25: 'HU_OSZZSD_IGAZOLVANY_MAGAN',         // OSZZSD railway document (free)
  26: 'HU_HEV_U_IGAZOLVÁNY',                // U signed service pass (free)
  27: 'HU_VOLAN_SZABADJEGY_ORSZAGOS',        // VOLÁN service card (free)
  28: 'HU_RENDOR_KESZENLETI_IGAZOLVANY',     // Police Standby Certificate (free)
  29: 'HU_BKV MUNKAVÁLLALO_2OSZT',           // BKV employee
  30: 'HU_BKK MUNKAVÁLLALO_2OSZT',           // BKK employee
};

const buildPassengerList = (options) => {
  const discountMap = options.domestic ? domesticDiscountCodes : internationalDiscountCodes;
  return options.travellers.map((traveller, index) => ({
    passengerCount: 1,
    passengerId: index,
    customerTypeKey: resolvePassengerType(traveller, options.domestic),
    customerDiscountsKeys: traveller.discounts
      .filter(Boolean)
      .map((discountId) => discountMap[discountId]),
  }));
};

// service codes: [ticket, seat reservation] per class
//                international: 1st=[49,61] 2nd=[50,62]
//                domestic:      1st=[51,63] 2nd=[52,64]
const buildServiceList = (options) => {
  const list = [];
  if (options.domestic) {
    list.push(options.class === 1 ? 51 : 52);
    if (options.seatReservation) list.push(options.class === 1 ? 63 : 64);
  } else {
    list.push(options.class === 1 ? 49 : 50);
    if (options.seatReservation) list.push(options.class === 1 ? 61 : 62);
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
  fetch(OFFER_URL, {
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
    return data.route.map(parseJourney)
      .filter((journey) => journey.price.amount > 0);
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
  offerkind: options.domestic ? '1' : '4',
  startStationCode: from,
  innerStationsCodes: options.intermediateStations,
  endStationCode: to,
  modalities: options.domestic ? [100, 200, 109] : [100],
  // note: "passangers" is the actual API field name (their typo)
  passangers: buildPassengerList(options),
  isOneWayTicket: true,
  isTravelEndTime: options.isArrivalDate, // false = departure time, true = arrival time
  travelStartDate: travelDate.toISOString(),
  selectedServices: buildServiceList(options),
  selectedSearchServices: buildSearchServiceList(options),
  isOfDetailedSearch: true,
});

const fetchExchangeRate = async (sessionId) => {
  const res = await fetch(EXCHANGE_RATE_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'Content-Type': 'application/json', UserSessionId: sessionId, Language: 'en' },
    body: null,
  });
  if (!res.ok) throw new Error(`Failed to fetch exchange rate: ${res.statusText}`);
  return res.json(); // returns HUF per EUR, e.g. 380
};

const convertToEur = (journeys, hufPerEur) =>
  journeys.map((journey) => ({
    ...journey,
    price: {
      ...journey.price,
      amount: Math.round(journey.price.amount / hufPerEur * 100) / 100,
      currency: 'EUR',
      originalAmount: journey.price.amount,
      originalCurrency: 'HUF',
    },
  }));

const querySingle = (from, to, travelDate, options, sessionId) =>
  sendRequest(buildRequestBody(from, to, travelDate, options), sessionId);

const queryDuration = (from, to, travelDate, options, sessionId) => {
  const requestCount = Math.ceil(options.duration / EIGHT_HOURS_IN_MINUTES);
  const deadline = addMinutes(travelDate, options.duration).getTime();

  // always treat travelDate as departure time when duration is given
  const baseOptions = { ...options, isArrivalDate: false };

  // send one request per 8-hour window to cover the full duration
  const requests = Array.from({ length: requestCount }, (_, i) => {
    const windowStart = addMinutes(travelDate, EIGHT_HOURS_IN_MINUTES * i);
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
 * Query railway connection prices from the MAV API.
 * Supports both international and domestic Hungarian connections.
 * @param {string} from - MAV station ID (e.g., "008099970")
 * @param {string} to - MAV station ID
 * @param {Date} [date] - Departure/arrival date (default: now)
 * @param {object} [opt] - Override defaults (class, duration, travellers, etc.)
 * @returns {Promise<object[]>} FPTF journey objects with price
 */
export const queryPrices = async (from, to, date, opt = {}) => {
  const options = { ...defaults, ...opt, domestic: inferDomestic(from, to) };
  const travelDate = date ?? new Date();
  const sessionId = randomUUID();

  const journeys = await (options.duration
    ? queryDuration(from, to, travelDate, options, sessionId)
    : querySingle(from, to, travelDate, options, sessionId));

  if (!options.domestic) return journeys;

  const hufPerEur = await fetchExchangeRate(sessionId);
  return convertToEur(journeys, hufPerEur);
};
