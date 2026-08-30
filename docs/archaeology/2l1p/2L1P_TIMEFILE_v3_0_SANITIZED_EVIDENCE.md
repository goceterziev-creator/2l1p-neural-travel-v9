# 2L1P TimeFile v3.0 — SANITIZED ARCHAEOLOGY PRESERVATION

## Provenance
Source: user-supplied HTML pasted in chat during GT63 / 2L1P archaeology.
Preservation mode: SANITIZED DERIVATIVE, not byte-identical source.
Reason: source contains strings presented as API credentials. Those values are intentionally NOT committed.

## Source identity claims
- Title: `2L1P TimeFile - Пълна Документация`
- Version claim: `Version 3.0 - 100% Real Data`
- System claim: travel search + flights + hotels + charts + offers + Google Maps
- Source dates embedded in the document are NOT treated as chronology proof.

## Architecture documented by source
```
User Input
  -> Search API
  -> Display Results
  -> Select Flight
  -> Select Hotel
  -> Generate Offer
  -> Export
```

Documented file decomposition:
```
index.html
style.css
js/
  config.js
  travel-system.js
  display-functions.js
  platforms.js
  offers.js
  notifications.js
  init.js
README.md
```

## Significant functions documented / supplied

### Search and provider/fallback layer
- `searchAllRealTime()`
- `searchRealFlights()`
- `searchRealHotels()`
- `getRealisticFlightData()`
- `getRealisticHotels()`

### Selection
- `selectDepartingFlight()`
- `selectReturningFlight()`
- `selectHotel()`

### Presentation / analysis
- `displayRealFlights()`
- `displayRealHotels()`
- `generateRealTimeCharts()`
- `updateComparisonPrices()`

### External platform bridges
- `generateBookingUrl()`
- `generateMapUrl()`
- `openGoogleFlights()`
- `openSkyscanner()`

### Offer / export
- `generateOffer()`
- `downloadPDF()`
- `downloadWord()`
- `viewOnline()`

### Runtime / UI
- `showNotification()`
- `initializeDates()`
- `setFlightType()`
- `testSystem()`

## Key source mechanics

### 1. Parallel search fan-out
Source supplies a `Promise.allSettled` orchestration pattern:
```js
const [flightsResult, hotelsResult] = await Promise.allSettled([
    travelSystem.searchRealFlights(fromCode, toCode, departDate, returnDate),
    travelSystem.searchRealHotels(destination, departDate, returnDate)
]);
```

### 2. Preserve loaded results instead of re-querying
Source explicitly documents:
```js
travelSystem.currentFlights = flightsResult.value;
```
and selection uses already loaded state:
```js
const existingFlights = travelSystem.currentFlights;
const selectedFlight = existingFlights.departing.find(f => f.id === flightId);
travelSystem.selectedDepartingFlight = selectedFlight;
await displayRealFlights(existingFlights);
```

### 3. Stable displayed price preservation
Source introduces:
```js
price: price,
originalPrice: price
```
with an explicit rationale that selection must not mutate/re-randomize the displayed result price.

### 4. Flight provider + fallback
The supplied `searchRealFlights()` attempts AviationStack, parses successful data, and falls back to `getRealisticFlightData()` on non-OK, empty results, or exceptions.

Credential-bearing URL value is redacted here:
```js
const url =
  "https://api.aviationstack.com/v1/flights?access_key=[REDACTED]" +
  "&dep_iata=" + fromCode +
  "&arr_iata=" + toCode +
  "&flight_date=" + departDate;
```

### 5. Hotel provider + fallback
The supplied `searchRealHotels()` attempts a RapidAPI / Booking.com endpoint and falls back to `getRealisticHotels()`.

Credential values are redacted:
```js
headers: {
  "X-RapidAPI-Key": "[REDACTED]",
  "X-RapidAPI-Host": "booking-com.p.rapidapi.com"
}
```

### 6. Provider result normalization
Flight results are normalized to objects including:
- id
- airline
- flightNumber
- from / to
- date
- departureTime / arrivalTime
- price / originalPrice
- currency
- duration
- realData
- source
- bookingUrl

Hotel results are normalized to:
- id
- name
- price
- currency
- rating
- location
- realData
- source
- bookingUrl
- mapUrl

### 7. Offer object assembly
Source supplies:
```js
const offer = {
  offerId: `2L1P-${Date.now()}`,
  timestamp: new Date().toLocaleString('bg-BG'),
  departingFlight,
  returningFlight,
  hotel,
  clientEmail: email,
  currency: 'EUR',
  source: 'Реални данни'
};
```
and calculates a total from selected components.

### 8. Export semantics anomaly
Despite UI/documentation wording:
- `downloadPDF()` actually creates a `text/plain` Blob and downloads a `.txt` file.
- `downloadWord()` only reports "В разработка...".
- `viewOnline()` opens generated HTML in a new window.

Therefore:
DOCUMENTED PDF/WORD SUPPORT != IMPLEMENTED PDF/WORD EXPORT.

### 9. "ZIP" anomaly
The button is labeled as a ZIP download, but `downloadSystem()` actually concatenates generated file contents into one `text/plain` blob and downloads a `.txt` TimeFile.

Therefore:
DOCUMENTED ZIP EXPORT != IMPLEMENTED ZIP ARCHIVE.

### 10. "100% real data" anomaly
Source contains both:
- claims of "100% Real Data / без симулации"
and
- explicit fallback generators `getRealisticFlightData()` and `getRealisticHotels()`.

The fallback flight generator also uses random prices/times and marks:
```js
realData: true,
source: 'Realistic Data'
```

Therefore the "100% real data" claim is internally contradicted by the supplied implementation.

## Security preservation note
The original chat source contains multiple strings presented as API keys / access keys. None are preserved in this GitHub derivative. No claim is made that those credentials are valid or active.

## Archaeology status
This file is a SANITIZED DERIVATIVE used to preserve architecture and lineage evidence while avoiding credential publication.
