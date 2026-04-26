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
      // type: '8', // @deprecated — use `age` instead; type IDs differ between domestic and international
      discounts: [], // discount IDs (different IDs for domestic and international — see below)
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
<summary>Available passenger and discount types for international journeys</summary>

```js
{
  passengerTypes: [
    { '0': 'Child (0-4 years)' },
    { '1': 'Child (4-6 years)' },
    { '2': 'Child (6-12 years)' },
    { '3': 'Child (12-14 years)' },
    { '4': 'Youth (14-15 years)' },
    { '5': 'Youth (15-16 years)' },
    { '6': 'Teenager (16-18 years)' },
    { '7': 'Young adult (18-26 years)' },
    { '8': 'Adult (26+ years)' },
  ],
  discounts: [
    // German
    { '1': 'BahnCard 25' },
    { '3': 'BahnCard 50' },
    { '5': 'BahnCard 100' },
    // Austrian
    { '8': 'Vorteilscard' },
    { '11': 'Klimaticket' },
    { '12': 'Österreichcard' },
    // Swiss
    { '9': 'Generalabonnement' },
    { '10': 'Halbtaxabonnement' },
    { '13': 'SwissPass 50%' },
    { '14': 'SwissPass 100%' },
    // Czech/Slovak
    { '15': 'MAXI KLASIK' },
    { '16': 'InKarta 25' },
    { '17': 'InKarta 50' },
    { '18': 'InKarta 100' },
    // Hungarian
    { '19': 'START Klub' },
    { '20': 'START Klub VIP' },
    { '21': 'Bérlet (season ticket)' },
    // Interrail
    { '22': 'Interrail/Eurail Pass (single-country)' },
    // Companion
    { '23': 'Wheelchair companion' },
    { '24': 'Blind person companion' },
    // Railway employee
    { '25': 'MÁV employee' },
    { '26': 'FIP free pass' },
    { '27': 'FIP single-country free pass' },
    { '28': 'FIP ID card' },
  ],
}
```

</details>

<details>
<summary>Available passenger and discount types for domestic journeys</summary>

```js
{
  passengerTypes: [
    { '0': 'Child (0-3 years)' },
    { '1': 'Child (3-6 years)' },
    { '2': 'Child (6-14 years)' },
    { '3': 'Child (14-18 years)' },
    { '4': 'Youth (18-25 years)' },
    { '5': 'Adult (25-65 years)' },
    { '6': 'Pensioner/Senior (65+ years)' },
  ],
  discounts: [
    // 50% discounts
    { '1': 'START Club card (50%)' },
    { '2': 'START Club fellow traveler (50%)' },
    { '3': 'Civil servants (50%)' },
    { '4': 'FIP 50% domestic 2nd class' },
    { '5': 'FIP 50% domestic 1st class' },
    // Passes
    { '6': 'Hungary Pass' },
    { '7': 'Hungary 24 hour ticket (free)' },
    { '8': 'BKK pass/ticket for HÉV (free)' },
    // Free-of-charge
    { '9': 'International ticket/pass 2nd class (free)' },
    { '10': 'International ticket/pass 1st class (free)' },
    { '11': 'Member of a large family (free)' },
    { '12': 'Persons with disabilities (free)' },
    { '13': 'Pensioners\' Travel Certificate (free)' },
    { '14': 'Hungarian Pass for Foreign Citizen (free)' },
    { '15': 'Certificate of refugees (free)' },
    { '16': 'Military care certificate - family member (free)' },
    // Railway employee
    { '17': 'MÁV-START service card 2nd class (free)' },
    { '18': 'MÁV-START service card 1st class (free)' },
    { '19': 'MÁV-START relatives 2nd class (free)' },
    { '20': 'MÁV-START relatives 1st class (free)' },
    { '21': 'GYSEV service card 2nd class (free)' },
    { '22': 'GYSEV service card 1st class (free)' },
    { '23': 'GYSEV relatives 2nd class (free)' },
    { '24': 'GYSEV relatives 1st class (free)' },
    { '25': 'OSZZSD railway document (free)' },
    { '26': 'U signed service pass (free)' },
    { '27': 'VOLÁN service card (free)' },
    { '28': 'Police Standby Certificate (free)' },
    { '29': 'BKV employee' },
    { '30': 'BKK employee' },
  ],
}
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
    price: { amount: 115, currency: 'EUR', name: 'START Europa DE' },
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
  originalAmount: 5250,   // original HUF price
  originalCurrency: 'HUF',
}
```

## Related

- [`mav-stations`](https://github.com/martinlangbecker/mav-stations#mav-stations) – A list of MAV stations.
- [`db-prices`](https://github.com/juliuste/db-prices#db-prices) – Find journey prices using the DB Sparpreise API.

## Contributing

If you **have a question**, **found a bug** or want to **propose a feature**, have a look at [the issues page](https://github.com/martinlangbecker/mav-prices/issues).
