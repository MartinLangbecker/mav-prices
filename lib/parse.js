const getLine = (description) => {
  if (description.startsWith('with U-Bahn')) {
    // example description: "with U-Bahn (U5)."
    return description.substring(
      description.indexOf('(') + 1,
      description.indexOf(')')
    );
  } else if (data.description.startsWith('By metro line')) {
    // example description 1: "By metro line M2 to Déli pályaudvar [30 minutes]"
    // example description 2: "By metro line M3 to Kálvin tér, change for metro line M4 to Keleti pályaudvar [35 minutes]"
    let line = [];
    data.description.split(', ').forEach((s) => {
      let split = s.split(' ');
      line.push(split[split.indexOf('line') + 1]);
    });
    return line.join('_');
  } else {
    return 'UNKNOWN';
  }
};

// TODO prettify train names, e. g. "railjet xpress" => RJX, "Sz" (passenger train) => "RE/RB"?
const getTrainName = (data) =>
  `${data.trainKind.sortName ?? data.trainKind.name} ${data.trainNumber}`;

// create leg based on mode; MAV does not seem to know S-Bahn
const leg = (data) => {
  if (data.description?.startsWith('on place')) {
    // walking leg
    return {
      mode: 'walking',
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
  } else if (
    data.description?.startsWith('with U-Bahn') ||
    data.description?.startsWith('By metro line')
  ) {
    const line = getLine(data.description);

    return {
      mode: 'train',
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
      line: {
        type: 'line',
        id: `${data.startStation.code}_${data.destionationStation.code}_${line}`,
        name: line,
        mode: 'train',
      },
    };
  } else {
    // train leg
    return {
      mode: 'train',
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
      departureDelay: data.departure.delayMin,
      departurePlatform: data.departureTrack.name ?? null,
      arrival: data.arrival.time,
      arrivalDelay: data.arrival.delayMin,
      arrivalPlatform: data.arrivalTrack.name ?? null,
      line: {
        type: 'line',
        id: data.trainDetails.trainId,
        name: getTrainName(data.trainDetails),
        mode: 'train',
      },
    };
  }
};

const parseJourney = (journey) => {
  const legs = journey.details.routes.map(leg);

  const price = {
    amount: journey.travelClasses[0].price.amount,
    currency: journey.travelClasses[0].price.currency.uicCode,
    name: journey.details.tickets[0]?.name ?? null,
  };

  return {
    type: 'journey',
    id: journey.sameOfferId,
    legs,
    price,
  };
};

export { parseJourney };
