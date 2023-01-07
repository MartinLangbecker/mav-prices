# mav-prices

JavaScript module for finding railway connections prices using the MAV API. Inofficial, using an endpoint by _MAV_. Ask them for permission before using this module in production.

[![npm version](https://img.shields.io/npm/v/mav-prices.svg)](https://www.npmjs.com/package/mav-prices)
![ISC-licensed](https://img.shields.io/github/license/martinlangbecker/mav-prices.svg)

## Installation

```bash
npm install mav-prices
```

## Usage

`prices()` returns a `Promise` that will resolve with a list of offers.

```javascript
const prices = require('mav-prices')

prices(from, to, [date], [opt]).then(…)
```

`from` and `to` must be MAV station IDs like `"008099970"`.

`date` must be a `Date` object; if empty, the current datetime will be used.

With `opt`, you can override the default options, which look like this:

```js
{
  class: 2, // 1 or 2 for first or second class
  seatReservation: false,
  directConnection: false,
  longerTransferTime: false, // >=10 minutes transfer time guaranteed
  isArrivalDate: false, // specify whether date parameter is arrival or departure date (default: departure)
  duration: 1440, // search for routes in the next n minutes (parameter date will be ignored)
  intermediateStations: [ // 0-3 objects for intermediate stations
    {
      stationCode: "008062648",
      durationOfStay: 5 // set to 0 if train should just pass through
    }
  ],
  travellers: [ // one or more objects; up to six people and six dogs
    {
      type: '8',
      discounts: ["1", "8", "10"], // discount IDs
    }
  ],
}
```

The following traveller and discount types are available:

```json
passengerTypes:
	0: "Child (0-4 years)",
	1: "Child (4-6 years)",
	2: "Child (6-12 years)",
	3: "Child (12-14 years)",
	4: "Youth (14-15 years)",
	5: "Youth (15-16 years)",
	6: "Teenager (16-18 years)",
	7: "Young adult (18-26 years)",
	8: "Adult (26+ years)",
	9: "Dog"

discounts:
	1: "BAHNCARD25/RAILPLUS"
	3: "BAHNCARD50/RAILPLUS"
	5: "BAHNCARD100/RAILPLUS"
	8: "VORTEILSCARD/RAILPLUS"
	9: "Generalabonnement"
	10: "Halbtaxabonnement"
```

## Response

TODO adjust to MAV output

The result will be a list of [_Friendly Public Transport Format_](https://github.com/public-transport/friendly-public-transport-format) `journey` objects.

With `from = '008000105'`, `to = '008011160'` and `date = new Date('2016-08-17T00:00:00.000Z')`, the result looked like this:

```javascript
[
  {
    type: 'journey',
    id: '0',
    origin: {
      type: 'station',
      id: '8000105',
      name: 'Frankfurt(Main)Hbf',
    },
    destination: {
      type: 'station',
      id: '8098160',
      name: 'Berlin Hbf (tief)',
    },
    legs: [
      {
        origin: {
          type: 'station',
          id: '8000105',
          name: 'Frankfurt(Main)Hbf',
        },
        departure: '2017-06-05T08:53:00.000Z',
        departurePlatform: '13',
        destination: {
          type: 'station',
          id: '8098160',
          name: 'Berlin Hbf (tief)',
        },
        arrival: '2017-06-05T13:17:00.000Z',
        arrivalPlatform: '7',
        line: {
          type: 'line',
          id: 'ice-1537',
          name: 'ICE 1537',
          product: 'ICE',
        },
      },
    ],
    price: {
      currency: 'EUR',
      amount: 126,
      discount: false,
      name: 'Flexpreis',
      description:
        'Fully flexible (not bound to a specific train / not dependent on the connection indicated on the selected route). Exchanges and refunds free of charge; on or after the first day of validity subject to a fee.',
    },
    nightTrain: false,
  },
  // …
];
```

## Similar Projects

- [`mav-stations`](https://github.com/martinlangbecker/mav-stations#mav-stations) – A list of MAV stations.

## Contributing

If you **have a question**, **found a bug** or want to **propose a feature**, have a look at [the issues page](https://github.com/martinlangbecker/mav-prices/issues).
