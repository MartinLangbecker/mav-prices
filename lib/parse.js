// TODO prettify train names, e. g. "railjet xpress" => RJX, "Sz" (passenger train) => "RE/RB"?
const getTrainName = (data) =>
  `${data.trainKind.sortName ?? data.trainKind.name} ${data.trainNumber}`;

const leg = (data) => {
  if (!data.trainDetails.trainId) {
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
  } else {
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
      departurePlatform: data.departureTrack.name ?? undefined,
      arrival: data.arrival.time,
      arrivalDelay: data.arrival.delayMin,
      arrivalPlatform: data.arrivalTrack.name ?? undefined,
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
    amount: journey.travelClasses.price.amount,
    currency: journey.travelClasses.price.currency.uicCode,
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
