# mav-prices

JavaScript module for **finding railway connection prices** using the [Magyar Államvasutak](https://jegy.mav.hu/) (MÁV, Hungarian State Railways) API. Inofficial, using an endpoint by _Magyar Államvasutak_. Please ask them for permission before using this module in production.

Supports both **international** connections from/to Hungary and **domestic** Hungarian connections. The MAV API requires at least one Hungarian station as departure or destination for international queries.

[![npm version](https://img.shields.io/npm/v/mav-prices.svg)](https://www.npmjs.com/package/mav-prices)
![ISC-licensed](https://img.shields.io/github/license/martinlangbecker/mav-prices.svg)

## Installation

```bash
npm install mav-prices
```

## Usage

`queryPrices()` returns a `Promise` that will resolve with a list of offers.

```javascript
import { queryPrices } from 'mav-prices';

queryPrices(from, to, [date], [opt]).then(…)
```

`from` and `to` must be MAV station IDs like `"008099970"`.

`date` must be a `Date` object; if empty, the current datetime will be used.

With `opt`, you can override the default options, which look like this:

```js
{
  class: 2, // 1 or 2 for first or second class
  seatReservation: false,
  directConnection: false,
  duration: 480, // search for connections within n minutes after departure date (default: undefined; note: 1 API request per 480 minutes will be sent)
  longerTransferTime: false, // >=10 minutes transfer time guaranteed
  isArrivalDate: false, // specify whether date parameter is arrival or departure date; ignored if duration is set
  raw: false, // include raw API data (offerIdentity, serializedOfferData, trainIds) for booking workflows
  intermediateStations: [ // 0-3 objects for intermediate stations (sample object is not set as default)
    {
      stationCode: "008062648", // station ID
      durationOfStay: 5 // in minutes (max: 59 (officially), but more seems to work as well);
                        // set to 0 if train should at least pass through station
    }
  ],
  travellers: [ // one or more objects; up to six people
    {
      age: 30, // passenger age — automatically selects the correct type for domestic/international
      discounts: [], // discount IDs — see below; inapplicable discounts are silently ignored
    }
  ],
}
```

Domestic mode is detected automatically when both station codes start with `0055` (Hungarian). Prices are converted to EUR using the MÁV exchange rate; the original HUF amount is included as `originalAmount`/`originalCurrency`.

```js
// Budapest-Keleti to Debrecen, one adult — domestic is auto-detected
queryPrices('005510017', '005513912', when).then(…)
```

<details>
<summary>Available passenger types (auto-selected via `age`)</summary>

Passenger types are resolved automatically from the `age` field. The correct type for domestic or international is selected based on the detected route.

**International:**
| Type | Age range |
|------|-----------|
| Child | 0–3 |
| Child | 4–5 |
| Child | 6–11 |
| Child | 12–13 |
| Youth | 14 |
| Youth | 15 |
| Teenager | 16–17 |
| Young adult | 18–25 |
| Adult | 26+ |

**Domestic:**
| Type | Age range |
|------|-----------|
| Child | 0–2 |
| Child | 3–5 |
| Child | 6–13 |
| Youth | 14–17 |
| Youth | 18–24 |
| Adult | 25–64 |
| Senior | 65+ |

</details>

<details>
<summary>Available discount IDs</summary>

Discounts that don't apply to the detected mode (domestic/international) are silently ignored.

```js
discounts: [
  // German
  { '1': 'BahnCard 25' },                              // international only
  { '3': 'BahnCard 50' },                              // international only
  { '5': 'BahnCard 100' },                             // international only
  // Austrian
  { '8': 'Vorteilscard' },                             // international only
  { '11': 'Klimaticket' },                             // international only
  { '12': 'Österreichcard' },                          // international only
  // Swiss
  { '9': 'Generalabonnement' },                        // international only
  { '10': 'Halbtaxabonnement' },                       // international only
  { '13': 'SwissPass 50%' },                           // international only
  { '14': 'SwissPass 100%' },                          // international only
  // Czech/Slovak
  { '15': 'MAXI KLASIK' },                             // international only
  { '16': 'InKarta 25' },                              // international only
  { '17': 'InKarta 50' },                              // international only
  { '18': 'InKarta 100' },                             // international only
  // Hungarian
  { '19': 'START Klub' },                              // both
  { '20': 'START Klub VIP' },                          // international only
  { '21': 'Bérlet (season ticket)' },                  // international only
  // Interrail
  { '22': 'Interrail/Eurail Pass (single-country)' },  // international only
  // Companion
  { '23': 'Wheelchair companion' },                    // international only
  { '24': 'Blind person companion' },                  // international only
  // Railway employee / FIP
  { '25': 'MÁV employee' },                            // international only
  { '26': 'FIP free pass' },                           // international only
  { '27': 'FIP single-country free pass' },            // international only
  { '28': 'FIP ID card' },                             // both (2nd class domestic)
  // Domestic discounts
  { '29': 'START Club fellow traveler (50%)' },        // domestic only
  { '30': 'Civil servants (50%)' },                    // domestic only
  { '31': 'FIP 50% domestic 1st class' },              // domestic only
  // Domestic passes
  { '32': 'Hungary Pass' },                            // domestic only
  { '33': 'Hungary 24 hour ticket (free)' },           // domestic only
  { '34': 'BKK pass/ticket for HÉV (free)' },         // domestic only
  // Domestic free-of-charge
  { '35': 'International ticket/pass 2nd class (free)' }, // domestic only
  { '36': 'International ticket/pass 1st class (free)' }, // domestic only
  { '37': 'Member of a large family (free)' },         // domestic only
  { '38': 'Persons with disabilities (free)' },        // domestic only
  { '39': 'Pensioners\' Travel Certificate (free)' },  // domestic only
  { '40': 'Hungarian Pass for Foreign Citizen (free)' }, // domestic only
  { '41': 'Certificate of refugees (free)' },          // domestic only
  { '42': 'Military care certificate - family member (free)' }, // domestic only
  // Domestic railway employee
  { '43': 'MÁV-START service card 2nd class (free)' }, // domestic only
  { '44': 'MÁV-START service card 1st class (free)' }, // domestic only
  { '45': 'MÁV-START relatives 2nd class (free)' },    // domestic only
  { '46': 'MÁV-START relatives 1st class (free)' },    // domestic only
  { '47': 'GYSEV service card 2nd class (free)' },     // domestic only
  { '48': 'GYSEV service card 1st class (free)' },     // domestic only
  { '49': 'GYSEV relatives 2nd class (free)' },        // domestic only
  { '50': 'GYSEV relatives 1st class (free)' },        // domestic only
  { '51': 'OSZZSD railway document (free)' },          // domestic only
  { '52': 'U signed service pass (free)' },            // domestic only
  { '53': 'VOLÁN service card (free)' },               // domestic only
  { '54': 'Police Standby Certificate (free)' },       // domestic only
  { '55': 'BKV employee' },                            // domestic only
  { '56': 'BKK employee' },                            // domestic only
]
```

</details>

## Response

The result will be a list of [_Friendly Public Transport Format_](https://github.com/public-transport/friendly-public-transport-format) `journey` objects.

With `from = '008099970'`, `to = '005501362'` and `date = new Date('2023-01-09T09:30:00.000Z')`, the result looked like this:

```js
[
  {
    type: 'journey',
    id: 181926962,
    legs: [
      {
        mode: 'train',
        origin: { type: 'station', id: '008001071', name: 'Hamburg Hbf' },
        destination: { type: 'station', id: '008022534', name: 'Würzburg Hbf' },
        departure: '2023-01-09T12:01:00+01:00',
        departureDelay: 0,
        departurePlatform: undefined,
        arrival: '2023-01-09T15:28:00+01:00',
        arrivalDelay: 0,
        arrivalPlatform: undefined,
        line: {
          type: 'line',
          id: '6528402',
          name: 'ICE 789',
          mode: 'train',
          product: 'ICE',
        },
        schedule: '683163',
      },
      {
        mode: 'train',
        origin: { type: 'station', id: '008022534', name: 'Würzburg Hbf' },
        destination: { type: 'station', id: '008101073', name: 'Linz Hbf' },
        departure: '2023-01-09T15:35:00+01:00',
        departureDelay: 0,
        departurePlatform: undefined,
        arrival: '2023-01-09T19:26:00+01:00',
        arrivalDelay: 0,
        arrivalPlatform: undefined,
        line: {
          type: 'line',
          id: '6525223',
          name: 'ICE 29',
          mode: 'train',
          product: 'ICE',
        },
        schedule: '690816',
      },
      {
        mode: 'train',
        origin: { type: 'station', id: '008101073', name: 'Linz Hbf' },
        destination: { type: 'station', id: '005501362', name: 'Hegyeshalom' },
        departure: '2023-01-09T20:17:00+01:00',
        departureDelay: 0,
        departurePlatform: undefined,
        arrival: '2023-01-09T22:25:00+01:00',
        arrivalDelay: 0,
        arrivalPlatform: undefined,
        line: {
          type: 'line',
          id: '6493390',
          name: 'RJX 261',
          mode: 'train',
          product: 'RJX',
        },
        schedule: '658654',
      },
    ],
    price: { amount: 115, currency: 'EUR', name: 'START Europa DE', trainDependent: true, refundable: false },
  },
  // ...
];
```

For domestic connections, prices are converted from HUF to EUR using the MÁV exchange rate. The original amount is preserved:

```js
price: {
  amount: 13.82,          // converted to EUR
  currency: 'EUR',
  name: 'Ticket',
  trainDependent: true,
  refundable: false,
  originalAmount: 5250,   // original HUF price
  originalCurrency: 'HUF',
}
```

## Related

- [`mav-stations`](https://github.com/martinlangbecker/mav-stations#mav-stations) – A list of MAV stations.
- [`db-prices`](https://github.com/juliuste/db-prices#db-prices) – Find journey prices using the DB Sparpreise API.

## Contributing

If you **have a question**, **found a bug** or want to **propose a feature**, have a look at [the issues page](https://github.com/martinlangbecker/mav-prices/issues).
