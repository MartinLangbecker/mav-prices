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

// unified discount map — each entry has an API key per mode (international/domestic)
// discounts only valid for one mode have null for the other;
// IDs 1–28 preserve the old international discount IDs for backwards compatibility
const discountCodes = {
  // German
  1: { international: 'BahnCard 25', domestic: null },
  3: { international: 'BahnCard 50', domestic: null },
  5: { international: 'BahnCard 100', domestic: null },
  // Austrian
  8: { international: 'VORTEILSCARD', domestic: null },
  11: { international: 'KLIMATICKET', domestic: null },
  12: { international: 'ÖSTERREICHCARD', domestic: null },
  // Swiss
  9: { international: 'Generalabonnement', domestic: null },
  10: { international: 'Halbtaxabonnement', domestic: null },
  13: { international: 'SwissPass 50%', domestic: null },
  14: { international: 'SwissPass 100%', domestic: null },
  // Czech/Slovak
  15: { international: 'MAXI KLASIK', domestic: null },
  16: { international: 'INKARTA 25', domestic: null },
  17: { international: 'INKARTA 50', domestic: null },
  18: { international: 'INKARTA 100', domestic: null },
  // Hungarian
  19: { international: 'START KLUB', domestic: 'HU_START_KLUB_50' },
  20: { international: 'HU_START_KLUB_VIP', domestic: null },
  21: { international: 'BERLET', domestic: null },
  // Interrail
  22: { international: 'Interrail/Eurail Pass (egyországos)', domestic: null },
  // Companion
  23: { international: 'KEREKESSZÉKES KÍSÉRŐJE', domestic: null },
  24: { international: 'VAK KÍSÉRŐJE', domestic: null },
  // Railway employee / FIP
  25: { international: 'HU_VASUTAS', domestic: null },
  26: { international: 'FIP_SZABADJEGY', domestic: null },
  27: { international: 'FIP_EGYORSZAGOS_SZABADJEGY', domestic: null },
  28: { international: 'FIP_IGAZOLVANY', domestic: 'HU_FIP_IGAZOLVANY_2O' },
  // --- new IDs for domestic-only discounts (29+) ---
  29: { international: null, domestic: 'HU_START_KLUB_UTITARS_20240301' },
  30: { international: null, domestic: 'HU_ALKALMAZASBAN_ALLOK' },
  31: { international: null, domestic: 'HU_FIP_IGAZOLVANY_1O' },
  // Domestic passes
  32: { international: null, domestic: 'HU_ORSZAGBERLET' },
  33: { international: null, domestic: 'HU_MAGYARORSZAG24' },
  34: { international: null, domestic: 'HU_BKK_BERLET_JEGY_HEVHEZ' },
  // Domestic free-of-charge
  35: { international: null, domestic: 'HU_NEMZETKOZI_BERLET_JEGY_2_OSZTALY' },
  36: { international: null, domestic: 'HU_NEMZETKOZI_BERLET_JEGY_1_OSZTALY' },
  37: { international: null, domestic: 'HU_NAGYCSALAD_TAGJA' },
  38: { international: null, domestic: 'HU_FOGYATEKKAL_ELOK_KEDVEZMENYE' },
  39: { international: null, domestic: 'HU_ELLATOTTAK_UTAZASI_UTALVANYA_JEGYHEZ' },
  40: { international: null, domestic: 'HU_MAGYAR_IGAZOLVANY' },
  41: { international: null, domestic: 'HU_MENEKULTEK_IGAZOLASA' },
  42: { international: null, domestic: 'HU_HADIROKKANT_CSALADTAG' },
  // Domestic railway employee
  43: { international: null, domestic: 'HU_MAV_START_VASUTI_UTAZASI_IG_2O' },
  44: { international: null, domestic: 'HU_MAV_START_VASUTI_UTAZASI_IG_1O' },
  45: { international: null, domestic: 'HU_MAV_START_VASUTI_UTAZASI_IG_CSALADTAG_2O' },
  46: { international: null, domestic: 'HU_MAV_START_VASUTI_UTAZASI_IG_CSALADTAG_1O' },
  47: { international: null, domestic: 'HU_GYSEV_VASUTI_UTAZASI_IG_2O' },
  48: { international: null, domestic: 'HU_GYSEV_VASUTI_UTAZASI_IG_1O' },
  49: { international: null, domestic: 'HU_GYSEV_VASUTI_UTAZASI_IG_CSALADTAG_2O' },
  50: { international: null, domestic: 'HU_GYSEV_VASUTI_UTAZASI_IG_CSALADTAG_1O' },
  51: { international: null, domestic: 'HU_OSZZSD_IGAZOLVANY_MAGAN' },
  52: { international: null, domestic: 'HU_HEV_U_IGAZOLVÁNY' },
  53: { international: null, domestic: 'HU_VOLAN_SZABADJEGY_ORSZAGOS' },
  54: { international: null, domestic: 'HU_RENDOR_KESZENLETI_IGAZOLVANY' },
  55: { international: null, domestic: 'HU_BKV MUNKAVÁLLALO_2OSZT' },
  56: { international: null, domestic: 'HU_BKK MUNKAVÁLLALO_2OSZT' },
};

const buildPassengerList = (options) => {
  const mode = options.domestic ? 'domestic' : 'international';
  return options.travellers.map((traveller, index) => ({
    passengerCount: 1,
    passengerId: index,
    customerTypeKey: resolvePassengerType(traveller, options.domestic),
    customerDiscountsKeys: traveller.discounts
      .filter(Boolean)
      .map((discountId) => discountCodes[discountId]?.[mode])
      .filter(Boolean),
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

const sendRequest = (body, sessionId, raw) =>
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
    return data.route.map((route) => {
      const journey = parseJourney(route);
      if (raw) {
        journey.raw = {
          offerIdentity: route.offerIdentity,
          serializedOfferData: route.serializedOfferData,
          trainIds: route.details?.routes
            ?.map((r) => r.trainDetails?.trainId)
            .filter(Boolean),
        };
      }
      return journey;
    }).filter((journey) => journey.price.amount > 0);
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
  sendRequest(buildRequestBody(from, to, travelDate, options), sessionId, options.raw);

const queryDuration = (from, to, travelDate, options, sessionId) => {
  const requestCount = Math.ceil(options.duration / EIGHT_HOURS_IN_MINUTES);
  const deadline = addMinutes(travelDate, options.duration).getTime();

  // always treat travelDate as departure time when duration is given
  const baseOptions = { ...options, isArrivalDate: false };

  // send one request per 8-hour window to cover the full duration
  const requests = Array.from({ length: requestCount }, (_, i) => {
    const windowStart = addMinutes(travelDate, EIGHT_HOURS_IN_MINUTES * i);
    return sendRequest(buildRequestBody(from, to, windowStart, baseOptions), sessionId, options.raw);
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
