const getLine = (description) => {
  if (description.startsWith('with U-Bahn')) {
    // example: München Hbf - München Ost
    // example description: "with U-Bahn (U5)."
    return description.substring(
      description.indexOf('(') + 1,
      description.indexOf(')')
    );
  } else if (description.startsWith('By metro line')) {
    // example: Budapest-Kelenföld - Budapest-Keleti
    // example description 1: "By metro line M2 to Déli pályaudvar [30 minutes]"
    // example description 2: "By metro line M3 to Kálvin tér, change for metro line M4 to Keleti pályaudvar [35 minutes]"
    let line = [];
    description.split(', ').forEach((s) => {
      let split = s.split(' ');
      line.push(split[split.indexOf('line') + 1]);
    });
    return line.join('+');
  } else if (description.startsWith('By bus line')) {
    // example: Budapest-Keleti - Zugló
    // example description: "By bus line 5, 7, 7E, 8E, 110, 112 or 133E to Zugló vasútállomás [20 minutes]"
    return description
      .replace(' or', ',')
      .replace('By bus line ', '')
      .replace(description.substr(description.indexOf('to') - 1), '')
      .split(', ')
      .join('/');
  } else {
    return 'UNKNOWN';
  }
};

// convert train names into more commonly used abbreviations
const prettifyTrainName = (name) => {
  if (name === 'railjet xpress') return 'RJX';
  else if (name === 'railjet') return 'RJ';
  else if (name === 'Regional-Express') return 'RE';
  else if (name === 'InterRegio') return 'IR';
  else return name;
  // TODO add more names, e. g. "Sz" (passenger train) => "RE/RB"?
};

const getTrainProduct = (data) =>
  prettifyTrainName(data.trainKind?.sortName ?? data.trainKind?.name);

const getTrainName = (data) => `${getTrainProduct(data)} ${data.trainNumber}`;

const createBaseLeg = (data) => {
  return {
    origin: {
      type: 'station',
      id: data.startStation.code,
      name: data.startStation.name,
      // TODO location, once available
    },
    destination: {
      type: 'station',
      id: data.destionationStation.code,
      name: data.destionationStation.name,
      // TODO location, once available
    },
    departure: data.departure.time,
    arrival: data.arrival.time,
  };
};

const createWalkingLeg = (data) => {
  return { ...createBaseLeg(data), mode: 'walking' };
};

const createLocalTransportBusLeg = (data) => {
  const line = getLine(data.description);

  return {
    ...createBaseLeg(data),
    mode: 'bus',
    line: {
      type: 'line',
      id: `${data.startStation.code}_${data.destionationStation.code}_${line}`,
      name: line,
      mode: 'bus',
    },
  };
};

const createLocalTransportTrainLeg = (data) => {
  const line = getLine(data.description);

  return {
    ...createBaseLeg(data),
    mode: 'train',
    line: {
      type: 'line',
      id: `${data.startStation.code}_${data.destionationStation.code}_${line}`,
      name: line,
      mode: 'train',
    },
  };
};

const createTrainLeg = (data) => {
  return {
    ...createBaseLeg(data),
    mode: 'train',
    departureDelay: data.departure.delayMin,
    departurePlatform: data.departureTrack?.name ?? undefined,
    arrivalDelay: data.arrival.delayMin,
    arrivalPlatform: data.arrivalTrack?.name ?? undefined,
    line: {
      type: 'line',
      id: data.trainDetails.trainId,
      name: getTrainName(data.trainDetails),
      mode: 'train',
      product: getTrainProduct(data.trainDetails),
    },
    schedule: data.trainDetails?.jeId ?? undefined,
  };
};

// create leg based on mode; MAV does not seem to know S-Bahn
const createLeg = (data) => {
  if (data.description?.startsWith('on place')) {
    return createWalkingLeg(data);
  } else if (data.description?.startsWith('By bus line')) {
    return createLocalTransportBusLeg(data);
  } else if (
    data.description?.startsWith('with U-Bahn') ||
    data.description?.startsWith('By metro line')
  ) {
    return createLocalTransportTrainLeg(data);
  } else {
    return createTrainLeg(data);
  }
};

const parseJourney = (journey) => {
  const legs = journey.details.routes.map(createLeg);

  const price = {
    amount: journey.travelClasses[0].price.amount,
    currency: journey.travelClasses[0].price.currency.uicCode,
    name: journey.details.tickets[0]?.name ?? undefined,
  };

  return {
    type: 'journey',
    id: journey.sameOfferId,
    legs,
    price,
  };
};

export { parseJourney };
