(function (global) {
  "use strict";

  function cleanText(value) {
    return String(value || "").trim();
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function uniqueStrings(values = []) {
    const seen = new Set();
    const result = [];

    for (const value of safeArray(values)) {
      const text = cleanText(value);
      const key = text.toLowerCase();
      if (!text || seen.has(key)) continue;
      seen.add(key);
      result.push(text);
    }

    return result;
  }

  function normalizeFlight(flight = {}) {
    return {
      ...flight,
      airline: cleanText(flight.airline),
      route: cleanText(flight.route),
      destination: cleanText(flight.destination),
      departure: cleanText(flight.departure),
      arrival: cleanText(flight.arrival),
      baggage: cleanText(flight.baggage),
      notes: cleanText(flight.notes),
      price: toNumber(flight.price, 0),
      segments: safeArray(flight.segments),
      outboundSegments: safeArray(flight.outboundSegments),
      inboundSegments: safeArray(flight.inboundSegments),
      stopoverAirports: safeArray(flight.stopoverAirports),
      transferTimes: safeArray(flight.transferTimes),
      displayBg: flight.displayBg && typeof flight.displayBg === "object" ? flight.displayBg : null
    };
  }

  function normalizeHotel(hotel = {}, index = 0) {
    return {
      ...hotel,
      name: cleanText(hotel.name || hotel.hotelName),
      stars: cleanText(hotel.stars || hotel.category),
      area: cleanText(hotel.area || hotel.location || hotel.city),
      distance: cleanText(hotel.distance),
      room: cleanText(hotel.room),
      meal: cleanText(hotel.meal),
      price: toNumber(hotel.price, 0),
      roomsLeft: cleanText(hotel.roomsLeft),
      description: cleanText(hotel.description),
      images: uniqueStrings(hotel.images || hotel.imageUrls),
      selected: hotel.selected === true || index === 0
    };
  }

  function hasMeaningfulFlight(flight = {}) {
    return Boolean(
      cleanText(flight.airline) ||
      cleanText(flight.route) ||
      cleanText(flight.departure) ||
      cleanText(flight.arrival) ||
      toNumber(flight.price, 0) > 0 ||
      safeArray(flight.segments).length
    );
  }

  function hasMeaningfulHotel(hotel = {}) {
    return Boolean(
      cleanText(hotel.name) ||
      cleanText(hotel.area) ||
      cleanText(hotel.room) ||
      cleanText(hotel.meal) ||
      toNumber(hotel.price, 0) > 0 ||
      safeArray(hotel.images).length
    );
  }

  function buildCanonicalOfferPayload(rawInput = {}, options = {}) {
    const payload = {
      ...rawInput,
      clientName: cleanText(rawInput.clientName),
      clientPhone: cleanText(rawInput.clientPhone),
      destination: cleanText(rawInput.destination),
      travelDates: cleanText(rawInput.travelDates),
      guests: cleanText(rawInput.guests),
      status: cleanText(rawInput.status) || "draft",
      currency: cleanText(rawInput.currency) || "EUR",
      flightAirline: cleanText(rawInput.flightAirline),
      flightRoute: cleanText(rawInput.flightRoute),
      flightDeparture: cleanText(rawInput.flightDeparture),
      flightArrival: cleanText(rawInput.flightArrival),
      flightBaggage: cleanText(rawInput.flightBaggage),
      flightNotes: cleanText(rawInput.flightNotes),
      hotelName: cleanText(rawInput.hotelName),
      hotelStars: cleanText(rawInput.hotelStars),
      hotelArea: cleanText(rawInput.hotelArea),
      hotelDistance: cleanText(rawInput.hotelDistance),
      hotelRoom: cleanText(rawInput.hotelRoom),
      hotelMeal: cleanText(rawInput.hotelMeal),
      hotelRoomsLeft: cleanText(rawInput.hotelRoomsLeft),
      hotelDescription: cleanText(rawInput.hotelDescription),
      hotelImages: uniqueStrings(rawInput.hotelImages),
      destinationDescription: cleanText(rawInput.destinationDescription),
      notes: cleanText(rawInput.notes),
      flightPrice: toNumber(rawInput.flightPrice, 0),
      hotelPrice: toNumber(rawInput.hotelPrice, 0),
      transferPrice: toNumber(rawInput.transferPrice, 0),
      basePrice: toNumber(rawInput.basePrice, 0),
      markupPercent: toNumber(rawInput.markupPercent, 0),
      finalPrice: rawInput.finalPrice === "" || rawInput.finalPrice === undefined ? "" : toNumber(rawInput.finalPrice, 0),
      validForDays: Number(rawInput.validForDays || 1),
      customValidUntil: cleanText(rawInput.customValidUntil),
      validationWarnings: safeArray(rawInput.validationWarnings),
      sourceEvidence: rawInput.sourceEvidence || null,
      importContext: rawInput.importContext || null
    };

    const flightSource = options.flights !== undefined ? options.flights : rawInput.flights;
    const hotelSource = options.hotels !== undefined ? options.hotels : rawInput.hotels;

    payload.flights = safeArray(flightSource).map(normalizeFlight).filter(hasMeaningfulFlight);
    payload.hotels = safeArray(hotelSource).map(normalizeHotel).filter(hasMeaningfulHotel);

    if (!payload.flightPrice && payload.flights[0]?.price) {
      payload.flightPrice = payload.flights[0].price;
    }

    const selectedHotel = payload.hotels.find((hotel) => hotel.selected) || payload.hotels[0] || null;
    if (selectedHotel) {
      payload.hotelName = payload.hotelName || selectedHotel.name;
      payload.hotelStars = payload.hotelStars || selectedHotel.stars;
      payload.hotelArea = payload.hotelArea || selectedHotel.area;
      payload.hotelDistance = payload.hotelDistance || selectedHotel.distance;
      payload.hotelRoom = payload.hotelRoom || selectedHotel.room;
      payload.hotelMeal = payload.hotelMeal || selectedHotel.meal;
      payload.hotelRoomsLeft = payload.hotelRoomsLeft || selectedHotel.roomsLeft;
      payload.hotelDescription = payload.hotelDescription || selectedHotel.description;
      payload.hotelImages = payload.hotelImages.length ? payload.hotelImages : selectedHotel.images;
      if (!payload.hotelPrice && selectedHotel.price) payload.hotelPrice = selectedHotel.price;
    }

    return payload;
  }

  function validateCanonicalOfferPayload(payload, options = {}) {
    if (options.requireDestination !== false && !payload.destination) {
      throw new Error("Destination is required.");
    }

    if (options.requireMeaningfulContent && !payload.flights.length && !payload.hotels.length) {
      throw new Error("GT63 needs detected flight or hotel data before generating a proposal.");
    }
  }

  async function requestJson(url, requestOptions = {}, serviceOptions = {}) {
    const fetchImpl = serviceOptions.fetch || global.fetch;
    if (typeof fetchImpl !== "function") {
      throw new Error("Fetch is not available for canonical offer creation.");
    }

    const response = await fetchImpl(url, requestOptions);
    const text = await response.text();
    let body = {};

    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }

    if (!response.ok) {
      if (response.status === 401 && typeof serviceOptions.onUnauthorized === "function") {
        serviceOptions.onUnauthorized(body);
      }

      const message =
        body?.details?.error?.message ||
        body?.details?.message ||
        body?.error ||
        body?.message ||
        body?.details ||
        `Request failed with status ${response.status}`;

      const error = new Error(message);
      error.status = response.status;
      error.response = body;
      throw error;
    }

    return body;
  }

  async function saveCanonicalOffer(rawInput = {}, options = {}) {
    const payload = buildCanonicalOfferPayload(rawInput, options);
    validateCanonicalOfferPayload(payload, options);

    const offerId = cleanText(options.offerId);
    const method = cleanText(options.method) || (offerId ? "PUT" : "POST");
    const url = offerId ? `/api/offers/${encodeURIComponent(offerId)}` : "/api/offers";

    return requestJson(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }, options);
  }

  global.GT63CanonicalOfferService = {
    buildCanonicalOfferPayload,
    saveCanonicalOffer,
    validateCanonicalOfferPayload
  };
})(typeof window !== "undefined" ? window : globalThis);
