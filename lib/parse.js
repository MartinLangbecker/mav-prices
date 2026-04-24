const BY_BUS_LINE = 'By bus line';

const trainNameMap = {
  'railjet xpress': 'RJX',
  'railjet': 'RJ',
  'Regional-Express': 'RE',
  'InterRegio': 'IR',
  'S-Bahn': 'S',
  'Night Jet': 'NJ',
  'EuroRegio': 'ER',
  // TODO add more, e.g. "Sz" (passenger train) => "RE/RB"?
};

const getLine = (description) => {
  if (description.startsWith('with U-Bahn')) {
    return description.substring(
      description.indexOf('(') + 1,
      description.indexOf(')'),
    );
  }

  if (description.startsWith('By metro line')) {
    return description
      .split(', ')
      .map((segment) => {
        const words = segment.split(' ');
        return words[words.indexOf('line') + 1];
      })
      .join('+');
  }

  if (description.startsWith(BY_BUS_LINE)) {
    return description
      .replace(/\bor\b/g, ',') // word boundary to avoid matching "or" inside station names
      .replace(`${BY_BUS_LINE} `, '')
      .replace(description.substring(description.indexOf('to') - 1), '')
      .split(', ')
      .join('/');
  }

  return 'UNKNOWN';
};

const prettifyTrainName = (name) => trainNameMap[name] ?? name;

const getTrainProduct = (routeSegment) =>
  prettifyTrainName(routeSegment.trainKind?.sortName ?? routeSegment.trainKind?.name);

const getTrainName = (routeSegment) =>
  `${getTrainProduct(routeSegment)} ${routeSegment.trainNumber}`;

// note: "destionationStation" is the actual API field name (their typo)
const createBaseLeg = (routeSegment) => ({
  origin: {
    type: 'station',
    id: routeSegment.startStation.code,
    name: routeSegment.startStation.name,
  },
  destination: {
    type: 'station',
    id: routeSegment.destionationStation.code,
    name: routeSegment.destionationStation.name,
  },
  departure: routeSegment.departure.time,
  arrival: routeSegment.arrival.time,
});

const createLocalTransportLeg = (routeSegment, mode) => {
  const line = getLine(routeSegment.description);
  return {
    ...createBaseLeg(routeSegment),
    mode,
    line: {
      type: 'line',
      id: `${routeSegment.startStation.code}_${routeSegment.destionationStation.code}_${line}`,
      name: line,
      mode,
    },
  };
};

const createTrainLeg = (routeSegment) => ({
  ...createBaseLeg(routeSegment),
  mode: 'train',
  departureDelay: routeSegment.departure.delayMin,
  departurePlatform: routeSegment.departureTrack?.name,
  arrivalDelay: routeSegment.arrival.delayMin,
  arrivalPlatform: routeSegment.arrivalTrack?.name,
  line: {
    type: 'line',
    id: routeSegment.trainDetails.trainId,
    name: getTrainName(routeSegment.trainDetails),
    mode: 'train',
    product: getTrainProduct(routeSegment.trainDetails),
  },
  schedule: routeSegment.trainDetails?.jeId,
});

const createLeg = (routeSegment) => {
  if (routeSegment.description?.startsWith('on place'))
    return { ...createBaseLeg(routeSegment), mode: 'walking' };
  if (routeSegment.description?.startsWith(BY_BUS_LINE))
    return createLocalTransportLeg(routeSegment, 'bus');
  if (routeSegment.description?.startsWith('with U-Bahn') || routeSegment.description?.startsWith('By metro line'))
    return createLocalTransportLeg(routeSegment, 'train');
  return createTrainLeg(routeSegment);
};

/** Parse a raw MAV API route into an FPTF journey object. */
export const parseJourney = (journey) => ({
  type: 'journey',
  id: journey.sameOfferId,
  legs: journey.details.routes.map(createLeg),
  price: {
    amount: journey.travelClasses[0].price.amount,
    currency: journey.travelClasses[0].price.currency.uicCode,
    name: journey.details.tickets[0]?.name,
  },
});
