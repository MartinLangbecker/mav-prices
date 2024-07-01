# mav-prices

JavaScript module for **finding railway connections prices** using the [Magyar Államvasutak](https://jegy.mav.hu/) (MÁV, Hungarian State Railways) API. Inofficial, using an endpoint by _Magyar Államvasutak_. Please ask them for permission before using this module in production.

Currently only supports international railway connections from/to Hungary.

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
  travellers: [ // one or more objects; up to six people and six dogs/bicycles
    {
      type: '8', // passengerType
      discounts: [], // discount IDs
    }
  ],
}
```

The following passenger and discount types are available for international journeys:

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
    { '9': 'Dog' },
    { '10': 'Bicylce' },
  ],
  discounts: [
    { '1': 'BahnCard 25' },
    { '3': 'BahnCard 50' },
    { '5': 'BahnCard 100' },
    { '8': 'Vorteilscard' },
    { '9': 'Generalabonnement' },
    { '10': 'Halbtaxabonnement' },
    { '11': 'Klimaticket' },
  ],
}
```

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

## Similar Projects

- [`mav-stations`](https://github.com/martinlangbecker/mav-stations#mav-stations) – A list of MAV stations.
- [`db-prices`](https://github.com/juliuste/db-prices#db-prices) – Find journey prices using the DB Sparpreise API.

## Contributing

If you **have a question**, **found a bug** or want to **propose a feature**, have a look at [the issues page](https://github.com/martinlangbecker/mav-prices/issues).
