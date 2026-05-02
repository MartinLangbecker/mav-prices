const BY_BUS_LINE = 'By bus line';

const trainNameMap = {
  'railjet xpress': 'RJX',
  railjet: 'RJ',
  'Regional-Express': 'RE',
  InterRegio: 'IR',
  'S-Bahn': 'S',
  'Night Jet': 'NJ',
  EuroRegio: 'ER',
  // TODO add more, e.g. "Sz" (passenger train) => "RE/RB"?
};

const getLine = (description) => {
  if (description.startsWith('with U-Bahn')) {
    return description.substring(
      description.indexOf('(') + 1,
      description.indexOf(')'),
    );
  }

  // only parse the first alternative (split on "] By " which separates route options)
  const firstAlternative = description.split('] By ')[0];
  const isBus = description.startsWith(BY_BUS_LINE);

  // split into segments at "change for" boundaries
  const segments = firstAlternative.split(/,?\s*change for\s*/i);
  const lines = [];
  for (const segment of segments) {
    // only include lines from segments matching the primary mode
    const isMatchingMode = isBus
      ? /\bbus\b/i.test(segment) || segment === segments[0]
      : /\bmetro\b/i.test(segment) ||
        /^M\d/.test(segment) ||
        segment === segments[0];
    if (!isMatchingMode) continue;

    // "line M4", "lines 5", "Line M4"
    const lineMatches = segment.match(/\blines?\s+(\w+)/gi);
    if (lineMatches)
      lines.push(...lineMatches.map((m) => m.replace(/^lines?\s+/i, '')));
    // "for M4 to ..." — line ID directly after "for" without "line" keyword
    else {
      const forMatch = segment.match(/^(M\d\w*)\b/);
      if (forMatch) lines.push(forMatch[1]);
    }
  }

  return lines.length > 0 ? lines.join('+') : 'UNKNOWN';
};

const prettifyTrainName = (name) => trainNameMap[name] ?? name;

const getTrainProduct = (routeSegment) =>
  prettifyTrainName(
    routeSegment.trainKind?.sortName ?? routeSegment.trainKind?.name,
  );

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
  if (
    routeSegment.description?.startsWith('with U-Bahn') ||
    routeSegment.description?.startsWith('By metro line')
  )
    return createLocalTransportLeg(routeSegment, 'train');
  // transfer leg with description but no train data (e.g. "5 stops by metro U5 ...")
  if (!routeSegment.trainDetails?.trainNumber && routeSegment.description)
    return {
      ...createBaseLeg(routeSegment),
      mode: 'walking',
      description: routeSegment.description,
    };
  return createTrainLeg(routeSegment);
};

/** Parse a raw MAV API route into an FPTF journey object. */
export const parseJourney = (journey) => {
  if (!journey?.details?.routes) {
    throw new Error(
      `Invalid journey: missing details.routes (id: ${journey?.sameOfferId})`,
    );
  }
  const travelClass = journey.travelClasses?.[0];
  if (!travelClass?.price) {
    throw new Error(
      `Invalid journey: missing price data (id: ${journey?.sameOfferId})`,
    );
  }
  return {
    type: 'journey',
    id: journey.sameOfferId,
    legs: journey.details.routes.map(createLeg),
    price: {
      amount: travelClass.price.amount,
      currency: travelClass.price.currency?.uicCode,
      name: journey.details.tickets?.[0]?.name,
      trainDependent: journey.details.tickets?.[0]?.trainDependent ?? null,
      refundable: journey.details.tickets?.[0]?.refundable ?? null,
    },
  };
};
