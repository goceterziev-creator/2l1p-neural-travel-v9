(function () {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

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

  function escapeHtml(value = "") {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(value = "") {
    return escapeHtml(value).replace(/'/g, "&#39;");
  }

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    const text = await response.text();
    let body = {};

    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }

    if (!response.ok) {
      const message = body.message || body.error || body.details || `Request failed with status ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.response = body;
      throw error;
    }

    return body;
  }

  function firstAvailable(...values) {
    return values.map(cleanText).find(Boolean) || "";
  }

  const AIRPORT_DESTINATIONS = {
    BCN: "Barcelona",
    BKK: "Bangkok",
    CDG: "Paris",
    FCO: "Rome",
    HND: "Tokyo",
    JFK: "New York",
    LHR: "London",
    LIS: "Lisbon",
    NCE: "Saint-Tropez",
    SCL: "Santiago",
    ZRH: "Zurich"
  };

  function destinationFromFlightRoute(route = "") {
    const parts = cleanText(route)
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);
    const outbound = parts[0] || cleanText(route);
    const codes = outbound.match(/\b[A-Z]{3}\b/g) || [];
    const destinationCode = codes[codes.length - 1] || "";
    return AIRPORT_DESTINATIONS[destinationCode] || "";
  }

  function destinationFromHotelLocation(value = "") {
    const text = cleanText(value);
    if (!text) return "";
    const countryMatch = text.match(/,\s*([^,]*?[A-Za-zÀ-ÿА-Яа-я][^,]*?)\s*,?\s*(?:Chile|Чили|Japan|Япония|France|Франция|Switzerland|Швейцария|Maldives|Малдиви|Italy|Италия|Spain|Испания)\s*$/i);
    if (countryMatch) {
      return cleanText(countryMatch[1]).replace(/^\d{4,8}\s+/, "");
    }
    const knownCity = Object.values(AIRPORT_DESTINATIONS).find((city) => new RegExp(`\\b${city}\\b`, "i").test(text));
    return knownCity || "";
  }

  function hasMeaningfulObject(value, fields = []) {
    if (!value || typeof value !== "object") return false;
    return fields.some((field) => cleanText(value[field]) || toNumber(value[field], 0) > 0 || safeArray(value[field]).length > 0);
  }

  function normalizeHotelOption(hotel = {}, selected = false) {
    return {
      name: cleanText(hotel.name || hotel.hotelName),
      stars: cleanText(hotel.stars || hotel.category),
      area: cleanText(hotel.area || hotel.location || hotel.city),
      distance: cleanText(hotel.distance),
      room: cleanText(hotel.room),
      meal: cleanText(hotel.meal),
      price: toNumber(hotel.price, 0),
      roomsLeft: cleanText(hotel.roomsLeft),
      description: cleanText(hotel.description),
      images: safeArray(hotel.images || hotel.imageUrls).filter(Boolean),
      selected
    };
  }

  function normalizeFlight(flight = {}) {
    return {
      airline: cleanText(flight.airline),
      route: cleanText(flight.route),
      destination: cleanText(flight.destination) || destinationFromFlightRoute(flight.route),
      departure: cleanText(flight.departure),
      arrival: cleanText(flight.arrival),
      baggage: cleanText(flight.baggage),
      notes: cleanText(flight.notes),
      price: toNumber(flight.price, 0),
      segments: safeArray(flight.segments),
      outboundSegments: safeArray(flight.outboundSegments),
      inboundSegments: safeArray(flight.inboundSegments)
    };
  }

  function inferDestination(data = {}, flight = {}, hotel = {}) {
    return firstAvailable(
      data.destination,
      data.offerDestination,
      flight.destination,
      hotel.destination,
      hotel.city,
      destinationFromHotelLocation(hotel.location || hotel.area)
    );
  }

  function buildHomeOfferInputFromFlow(state) {
    const smartImport = state.smartImportData || {};
    const flight = normalizeFlight(
      smartImport.offerFlight ||
      state.flightImportData?.flight ||
      state.flightImportData?.offerFlight ||
      {}
    );

    const selectedHotelSource =
      smartImport.offerHotel ||
      state.hotelImportData?.hotel ||
      state.hotelImportData?.offerHotel ||
      {};

    const hotelOptionsSource = safeArray(smartImport.offerHotelOptions).length
      ? smartImport.offerHotelOptions
      : safeArray(state.hotelImportData?.hotelOptions).length
      ? state.hotelImportData.hotelOptions
      : selectedHotelSource.name
      ? [selectedHotelSource]
      : [];

    const selectedName = cleanText(selectedHotelSource.name).toLowerCase();
    const hotels = hotelOptionsSource
      .map((hotel, index) => {
        const currentName = cleanText(hotel?.name).toLowerCase();
        return normalizeHotelOption(
          hotel,
          hotel.selected === true || (selectedName && currentName === selectedName) || (!selectedName && index === 0)
        );
      })
      .filter((hotel) => hotel.name || hotel.area || hotel.price > 0 || hotel.images.length);

    const selectedHotel = hotels.find((hotel) => hotel.selected) || hotels[0] || {};
    const destination = inferDestination(smartImport, flight, selectedHotel);

    if (!destination) {
      throw new Error("Destination was not detected. Use Manual Entry to complete the proposal.");
    }

    if (!flight.route && !flight.airline && !hotels.length) {
      throw new Error("GT63 needs detected flight or hotel data before generating a proposal.");
    }

    const sourceEvidence = smartImport.evidence && typeof smartImport.evidence === "object"
      ? smartImport.evidence
      : state.hotelImportData?.evidence && typeof state.hotelImportData.evidence === "object"
      ? state.hotelImportData.evidence
      : null;

    const importContext = smartImport.mode || smartImport.intakeId
      ? {
          mode: cleanText(smartImport.mode),
          intakeId: cleanText(smartImport.intakeId),
          contractVersion: cleanText(smartImport.contractVersion),
          sources: safeArray(smartImport.sources),
          classifications: safeArray(smartImport.classifications),
          warnings: safeArray(smartImport.warnings)
        }
      : null;

    const proposalTemplate = hotels.length
      ? {
          recommended: "multi-hotel",
          selected: "multi-hotel",
          source: "home_signature_renderer",
          reason: "HOME proposals use the canonical GT63 Signature Proposal renderer."
        }
      : undefined;

    return {
      clientName: "GT63 Home Proposal",
      destination,
      travelDates: firstAvailable(flight.departure && flight.arrival ? `${flight.departure} - ${flight.arrival}` : "", selectedHotel.travelDates),
      guests: "",
      status: "draft",
      currency: "EUR",
      flights: flight.route || flight.airline || flight.price > 0 ? [flight] : [],
      hotels,
      flightPrice: flight.price,
      hotelPrice: toNumber(selectedHotel.price, 0),
      markupPercent: 0,
      proposalTemplate,
      sourceEvidence,
      importContext
    };
  }

  function createPreviewAction(label, id) {
    return `<a class="button button-secondary is-disabled" id="${escapeAttr(id)}" href="#" aria-disabled="true">${escapeHtml(label)}</a>`;
  }

  const HOME_STATES = {
    ready: {
      label: "Ready to Send",
      action: "Open Proposal",
      reason: "Complete enough for delivery.",
      href: (offer) => `/api/offers/view/${encodeURIComponent(offer.id || "")}`,
      tone: "ready"
    },
    review: {
      label: "Needs Review",
      action: "Review in Workspace",
      reason: "Useful data exists, but operator confirmation is needed.",
      href: () => "/admin",
      tone: "review"
    },
    waiting: {
      label: "Waiting for Client",
      action: "Open Client Proposal",
      reason: "Shared proposal is waiting for client choice or response.",
      href: (offer) => `/api/offers/view/${encodeURIComponent(offer.id || "")}`,
      tone: "waiting"
    },
    draft: {
      label: "Drafts in Progress",
      action: "Continue in Workspace",
      reason: "Proposal exists and can be continued.",
      href: () => "/admin",
      tone: "draft"
    },
    blocked: {
      label: "Blocked",
      action: "Resolve in Workspace",
      reason: "Missing data or an operator decision is preventing progress.",
      href: () => "/admin",
      tone: "blocked"
    },
    delivered: {
      label: "Delivered",
      action: "Open History",
      reason: "Proposal has already been delivered or completed.",
      href: (offer) => `/api/offers/view/${encodeURIComponent(offer.id || "")}`,
      tone: "delivered"
    }
  };

  const HOME_STATE_PRIORITY = ["ready", "review", "blocked", "waiting", "draft", "delivered"];
  const HOME_VISIBLE_STATES = ["ready", "review", "waiting", "draft", "blocked"];

  function offerWarnings(offer = {}) {
    return safeArray(offer.validationWarnings).filter(Boolean);
  }

  function offerTimestamp(offer = {}) {
    return Date.parse(offer.updatedAt || offer.createdAt || "") || 0;
  }

  function classifyHomeProposalState(offer = {}) {
    const status = cleanText(offer.status || "draft").toLowerCase();
    const hasWarnings = offerWarnings(offer).length > 0;
    const hasDestination = Boolean(cleanText(offer.destination));
    const hasPrice = toNumber(offer.finalPrice || offer.price || offer.flightPrice || offer.hotelPrice, 0) > 0;

    if (["booked", "delivered", "complete", "completed", "lost", "cancelled", "expired"].includes(status)) return "delivered";
    if (["sent", "viewed", "waiting"].includes(status)) return "waiting";
    if (status === "review" || hasWarnings) return "review";
    if (!hasDestination) return "blocked";
    if (hasDestination && !hasPrice) return "draft";
    if (status === "draft") return "ready";
    return "draft";
  }

  function proposalDisplayName(offer = {}) {
    return firstAvailable(offer.destination, offer.clientName, offer.id, "Untitled proposal");
  }

  function proposalMeta(offer = {}) {
    const pieces = [
      cleanText(offer.clientName) || "No client",
      cleanText(offer.travelDates) || "Dates to confirm"
    ].filter(Boolean);
    return pieces.join(" · ");
  }

  function nextActionTitle(offer = {}, stateKey = "draft") {
    const destination = proposalDisplayName(offer);
    if (stateKey === "ready") return `Send ${destination} proposal`;
    if (stateKey === "review") return `Review ${destination} proposal`;
    if (stateKey === "blocked") return `Resolve ${destination} blocker`;
    if (stateKey === "waiting") return `Check ${destination} client response`;
    return `Continue ${destination} proposal`;
  }

  function init() {
    const state = {
      smartImportData: null,
      flightImportData: null,
      hotelImportData: null,
      currentOfferId: "",
      currentHtmlUrl: "",
      currentPdfUrl: "",
      currentOffer: null
    };

    const uploadZone = $("uploadZone");
    const fileInput = $("proposalFiles");
    const flightInput = $("flightFiles");
    const hotelInput = $("hotelFiles");
    const uploadSupport = $("uploadSupport");
    const generateButton = $("generateProposal");
    const workspaceStatus = $("workspaceStatus");
    const previewState = $("previewState");
    const previewFrame = $("previewFrame");
    const previewEmpty = $("previewEmpty");
    const flightEvidence = $("flightEvidence");
    const hotelEvidence = $("hotelEvidence");
    const detailDestination = $("detailDestination");
    const detailDates = $("detailDates");
    const detailPrice = $("detailPrice");
    const manualEntry = $("manualEntry");
    const createProposalTop = $("createProposalTop");
    const flightUploadButton = $("flightUploadButton");
    const hotelUploadButton = $("hotelUploadButton");
    const previewHtmlLink = $("previewHtmlLink");
    const previewPdfLink = $("previewPdfLink");
    const viewProposalPreview = $("viewProposalPreview");
    const homeDate = $("homeDate");
    const nextActionTitleNode = $("nextActionTitle");
    const nextActionState = $("nextActionState");
    const nextActionEffort = $("nextActionEffort");
    const nextActionReason = $("nextActionReason");
    const nextActionContext = $("nextActionContext");
    const nextActionButton = $("nextActionButton");
    const continueList = $("continueList");
    const readinessCounts = {
      ready: $("readyToSendCount"),
      review: $("needsReviewCount"),
      waiting: $("waitingClientCount"),
      draft: $("draftsCount"),
      blocked: $("blockedCount")
    };
    const detectItems = Array.from(document.querySelectorAll("[data-detect]"));

    function setHomeDate() {
      if (!homeDate) return;
      const formatted = new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        day: "numeric",
        month: "long"
      }).format(new Date());
      homeDate.textContent = formatted;
    }

    function setMessage(message, mode = "info") {
      if (uploadSupport) uploadSupport.textContent = message;
      if (workspaceStatus) {
        workspaceStatus.textContent = mode === "error" ? "Needs attention" : mode === "working" ? "Working" : message;
      }
    }

    function startPulse(mode) {
      window.GT63Pulse?.start?.(mode);
    }

    function finishPulse() {
      window.GT63Pulse?.finish?.();
    }

    function stopPulse() {
      window.GT63Pulse?.stop?.();
    }

    function setGeneratedLinks(offerId, htmlUrl, pdfUrl) {
      state.currentOfferId = offerId || "";
      state.currentHtmlUrl = htmlUrl || (offerId ? `/api/offers/view/${encodeURIComponent(offerId)}` : "");
      state.currentPdfUrl = pdfUrl || (offerId ? `/api/offers/${encodeURIComponent(offerId)}/pdf` : "");
      const previewUrl = offerId ? `/api/offers/view/${encodeURIComponent(offerId)}?preview=1` : "";

      [
        [previewHtmlLink, state.currentHtmlUrl],
        [previewPdfLink, state.currentPdfUrl],
        [viewProposalPreview, state.currentHtmlUrl]
      ].forEach(([link, url]) => {
        if (!link || !url) return;
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.classList.remove("is-disabled");
        link.setAttribute("aria-disabled", "false");
      });

      if (previewFrame && previewUrl) {
        previewFrame.src = previewUrl;
        previewFrame.hidden = false;
        previewFrame.title = `GT63 proposal preview ${offerId}`;
      }
      if (previewEmpty && previewUrl) previewEmpty.hidden = true;
    }

    function setText(node, value) {
      if (node) node.textContent = cleanText(value) || "Waiting";
    }

    function updateProposalPreview(offer) {
      if (!offer || typeof offer !== "object") return;
      state.currentOffer = offer;
      setText(previewState, "Generated proposal");
      setText(detailDestination, firstAvailable(offer.destination, offer.proposalInput?.destination?.name, offer.proposalInput?.destination?.requested));
      setText(detailDates, firstAvailable(offer.travelDates, offer.proposalInput?.client?.travelDates, "Dates to confirm"));
      setText(detailPrice, firstAvailable(offer.finalPrice ? `${Number(offer.finalPrice).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${offer.currency || "EUR"}` : "", "Price to confirm"));
    }

    function focusWorkspace() {
      document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => {
        uploadZone?.classList.add("is-focused");
        window.setTimeout(() => uploadZone?.classList.remove("is-focused"), 1200);
      }, 300);
    }

    function setImportReady({ flight = false, hotel = false, destination = false, dates = false, price = false } = {}) {
      const active = { flight, hotel, destination, dates, price };
      detectItems.forEach((item) => {
        if (active[item.dataset.detect]) item.classList.add("is-active");
      });
      if (uploadZone) uploadZone.classList.add("is-ready");
      if (flightEvidence) flightEvidence.textContent = flight ? "Detected" : flightEvidence.textContent;
      if (hotelEvidence) hotelEvidence.textContent = hotel ? "Detected" : hotelEvidence.textContent;
      const complete = Boolean((state.smartImportData && (flight || hotel)) || (state.flightImportData && state.hotelImportData));
      if (generateButton) generateButton.disabled = !complete;
      setMessage(complete ? "Travel data is ready. Generate the proposal when you are ready." : "Travel data received. Add the remaining required input.", "info");
    }

    function renderEmptyHomeCommand() {
      Object.values(readinessCounts).forEach((node) => {
        if (node) node.textContent = "0";
      });
      if (nextActionTitleNode) nextActionTitleNode.textContent = "Start your next proposal";
      if (nextActionState) {
        nextActionState.textContent = HOME_STATES.draft.label;
        nextActionState.className = "state-chip";
      }
      if (nextActionEffort) nextActionEffort.textContent = "Estimated: 2 minutes";
      if (nextActionReason) {
        nextActionReason.textContent = "No proposal needs attention yet. Start with flight and hotel information when you are ready.";
      }
      if (nextActionContext) nextActionContext.textContent = "What deserves your attention today.";
      if (nextActionButton) {
        nextActionButton.textContent = "New Proposal";
        nextActionButton.href = "#workspace";
        nextActionButton.removeAttribute("target");
        nextActionButton.removeAttribute("rel");
      }
      if (continueList) {
        continueList.innerHTML = `
          <div class="continue-item">
            <div>
              <p class="continue-title">No active proposal work yet</p>
              <p class="continue-meta">Start a proposal to create your first GT63 work item.</p>
            </div>
            <a class="button button-quiet" href="#workspace">Open Workspace</a>
          </div>
        `;
      }
    }

    function renderHomeCommand(offers = []) {
      const items = safeArray(offers)
        .map((offer) => ({ offer, stateKey: classifyHomeProposalState(offer) }))
        .sort((left, right) => {
          const priority = HOME_STATE_PRIORITY.indexOf(left.stateKey) - HOME_STATE_PRIORITY.indexOf(right.stateKey);
          return priority || offerTimestamp(right.offer) - offerTimestamp(left.offer);
        });

      const counts = Object.fromEntries(HOME_VISIBLE_STATES.map((stateKey) => [stateKey, 0]));
      items.forEach((item) => {
        if (counts[item.stateKey] !== undefined) counts[item.stateKey] += 1;
      });
      Object.entries(readinessCounts).forEach(([stateKey, node]) => {
        if (node) node.textContent = String(counts[stateKey] || 0);
      });

      const next = items.find((item) => item.stateKey !== "delivered");
      if (!next) {
        renderEmptyHomeCommand();
        return;
      }

      const state = HOME_STATES[next.stateKey] || HOME_STATES.draft;
      const href = state.href(next.offer);
      if (nextActionTitleNode) nextActionTitleNode.textContent = nextActionTitle(next.offer, next.stateKey);
      if (nextActionState) {
        nextActionState.textContent = state.label;
        nextActionState.className = `state-chip is-${state.tone}`;
      }
      if (nextActionEffort) nextActionEffort.textContent = next.stateKey === "ready" ? "Estimated: 1 minute" : "Estimated: 2 minutes";
      if (nextActionReason) nextActionReason.textContent = state.reason;
      if (nextActionContext) nextActionContext.textContent = proposalMeta(next.offer);
      if (nextActionButton) {
        nextActionButton.textContent = state.action;
        nextActionButton.href = href;
        if (href.startsWith("/api/offers/view/")) {
          nextActionButton.target = "_blank";
          nextActionButton.rel = "noopener noreferrer";
        } else {
          nextActionButton.removeAttribute("target");
          nextActionButton.removeAttribute("rel");
        }
      }

      const activeItems = items.filter((item) => item.stateKey !== "delivered").slice(0, 3);
      if (continueList) {
        continueList.innerHTML = activeItems.map(({ offer, stateKey }) => {
          const itemState = HOME_STATES[stateKey] || HOME_STATES.draft;
          const itemHref = itemState.href(offer);
          const linkAttrs = itemHref.startsWith("/api/offers/view/")
            ? ' target="_blank" rel="noopener noreferrer"'
            : "";
          return `
            <div class="continue-item">
              <div>
                <p class="continue-title">${escapeHtml(proposalDisplayName(offer))}</p>
                <p class="continue-meta">${escapeHtml(itemState.label)} · ${escapeHtml(proposalMeta(offer))}</p>
              </div>
              <a class="button button-quiet" href="${escapeAttr(itemHref)}"${linkAttrs}>${escapeHtml(itemState.action)}</a>
            </div>
          `;
        }).join("");
      }
    }

    async function loadProposalWork() {
      try {
        const data = await fetchJson("/api/offers");
        renderHomeCommand(data.offers || []);
      } catch {
        renderEmptyHomeCommand();
      }
    }

    async function postFiles(route, files, limit = 8) {
      const selectedFiles = Array.from(files || []).slice(0, limit);
      if (!selectedFiles.length) return null;
      if (window.location.protocol === "file:") {
        throw new Error("Open GT63 through Railway staging or the local server before uploading files.");
      }
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append("image", file));
      startPulse("ocr");
      setMessage("Reading travel data...", "working");
      return fetchJson(route, { method: "POST", body: formData });
    }

    async function runSmartImport(files) {
      try {
        const data = await postFiles("/api/smart-import", files, 8);
        if (!data) {
          stopPulse();
          return;
        }
        state.smartImportData = data;
        const importedFlight = data.offerFlight || data.flight || {};
        const importedHotel = data.offerHotel || {};
        const importedHotelOptions = safeArray(data.offerHotelOptions);
        const hasFlight = hasMeaningfulObject(importedFlight, ["airline", "route", "departure", "arrival", "price", "segments"]);
        const hasHotel = hasMeaningfulObject(importedHotel, ["name", "area", "city", "room", "meal", "price", "images"]) || importedHotelOptions.length > 0;
        setImportReady({
          flight: hasFlight,
          hotel: hasHotel,
          destination: Boolean(inferDestination(data, importedFlight, importedHotel)),
          dates: Boolean(importedFlight.departure || importedFlight.arrival),
          price: Boolean(toNumber(importedFlight.price, 0) || toNumber(importedHotel.price, 0))
        });
        finishPulse();
      } catch (error) {
        stopPulse();
        throw error;
      }
    }

    async function runFlightImport(files) {
      try {
        const data = await postFiles("/api/import-image", files, 4);
        if (!data) {
          stopPulse();
          return;
        }
        state.flightImportData = data;
        const importedFlight = data.flight || data.offerFlight || {};
        setImportReady({
          flight: hasMeaningfulObject(importedFlight, ["airline", "route", "departure", "arrival", "price", "segments"]),
          hotel: Boolean(state.hotelImportData),
          destination: Boolean(inferDestination({}, importedFlight, state.hotelImportData?.hotel || {})),
          dates: Boolean(importedFlight.departure || importedFlight.arrival),
          price: Boolean(toNumber(importedFlight.price, 0))
        });
        finishPulse();
      } catch (error) {
        stopPulse();
        throw error;
      }
    }

    async function runHotelImport(files) {
      try {
        const data = await postFiles("/api/import-hotel-image", files, 4);
        if (!data) {
          stopPulse();
          return;
        }
        state.hotelImportData = data;
        const importedHotel = data.hotel || data.offerHotel || {};
        const importedHotelOptions = safeArray(data.hotelOptions || data.offerHotelOptions);
        setImportReady({
          flight: Boolean(state.flightImportData),
          hotel: hasMeaningfulObject(importedHotel, ["name", "area", "city", "room", "meal", "price", "images"]) || importedHotelOptions.length > 0,
          destination: Boolean(inferDestination({}, state.flightImportData?.flight || {}, importedHotel)),
          dates: Boolean(state.flightImportData?.flight?.departure || state.flightImportData?.flight?.arrival),
          price: Boolean(toNumber(importedHotel.price, 0) || toNumber(state.flightImportData?.flight?.price, 0))
        });
        finishPulse();
      } catch (error) {
        stopPulse();
        throw error;
      }
    }

    async function generateProposal() {
      if (!generateButton || generateButton.disabled) return;
      try {
        generateButton.disabled = true;
        startPulse("proposal");
        setMessage("Generating proposal...", "working");
        const offerService = window.GT63CanonicalOfferService;
        if (!offerService?.saveCanonicalOffer) {
          throw new Error("GT63 canonical offer creation service is unavailable.");
        }
        const payload = buildHomeOfferInputFromFlow(state);
        const result = await offerService.saveCanonicalOffer(payload, {
          requireMeaningfulContent: true
        });
        setGeneratedLinks(result.offer?.id, result.clientLink, result.pdfLink);
        updateProposalPreview(result.offer);
        setMessage("Proposal ready.", "info");
        finishPulse();
        loadProposalWork();
        document.getElementById("preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (error) {
        stopPulse();
        setMessage(error.message || "Proposal generation failed.", "error");
        generateButton.disabled = false;
      }
    }

    function openManualProposalWorkspace() {
      window.location.href = "/admin";
    }

    createProposalTop?.addEventListener("click", (event) => {
      event.preventDefault();
      focusWorkspace();
    });

    fileInput?.addEventListener("change", (event) => {
      runSmartImport(event.target.files).catch((error) => setMessage(error.message, "error"));
    });

    flightUploadButton?.addEventListener("click", () => flightInput?.click());
    hotelUploadButton?.addEventListener("click", () => hotelInput?.click());

    flightInput?.addEventListener("change", (event) => {
      runFlightImport(event.target.files).catch((error) => setMessage(error.message, "error"));
    });

    hotelInput?.addEventListener("change", (event) => {
      runHotelImport(event.target.files).catch((error) => setMessage(error.message, "error"));
    });

    manualEntry?.addEventListener("click", openManualProposalWorkspace);
    generateButton?.addEventListener("click", generateProposal);

    ["dragenter", "dragover"].forEach((eventName) => {
      uploadZone?.addEventListener(eventName, (event) => {
        event.preventDefault();
        uploadZone.classList.add("is-dragging");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      uploadZone?.addEventListener(eventName, (event) => {
        event.preventDefault();
        uploadZone.classList.remove("is-dragging");
      });
    });

    uploadZone?.addEventListener("drop", (event) => {
      runSmartImport(event.dataTransfer.files).catch((error) => setMessage(error.message, "error"));
    });

    setHomeDate();
    renderEmptyHomeCommand();
    loadProposalWork();
  }

  window.GT63ProposalFlow = { init };
})();
