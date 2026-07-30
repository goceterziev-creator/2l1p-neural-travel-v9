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
      hotel.area
    );
  }

  function buildOfferPayloadFromFlow(state) {
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

    const proposalTemplate = hotels.length > 1
      ? {
          recommended: "multi-hotel",
          selected: "multi-hotel",
          source: "home_hotel_options",
          reason: "HOME import contains multiple hotel options for client comparison."
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

  function createShowcaseAction(label, url) {
    if (!url) return "";
    return `<a class="button button-quiet" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
  }

  function createPreviewAction(label, id) {
    return `<a class="button button-secondary is-disabled" id="${escapeAttr(id)}" href="#" aria-disabled="true">${escapeHtml(label)}</a>`;
  }

  function init(config = {}) {
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
    const showcaseGrid = $("showcaseGrid");
    const showcaseCta = $("showcaseCreateProposal");
    const previewHtmlLink = $("previewHtmlLink");
    const previewPdfLink = $("previewPdfLink");
    const viewProposalPreview = $("viewProposalPreview");
    const detectItems = Array.from(document.querySelectorAll("[data-detect]"));

    function setMessage(message, mode = "info") {
      if (uploadSupport) uploadSupport.textContent = message;
      if (workspaceStatus) {
        workspaceStatus.textContent = mode === "error" ? "Needs attention" : mode === "working" ? "Working" : message;
      }
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

    async function postFiles(route, files, limit = 8) {
      const selectedFiles = Array.from(files || []).slice(0, limit);
      if (!selectedFiles.length) return null;
      if (window.location.protocol === "file:") {
        throw new Error("Open GT63 through Railway staging or the local server before uploading files.");
      }
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append("image", file));
      setMessage("Reading travel data...", "working");
      return fetchJson(route, { method: "POST", body: formData });
    }

    async function runSmartImport(files) {
      const data = await postFiles("/api/smart-import", files, 8);
      if (!data) return;
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
    }

    async function runFlightImport(files) {
      const data = await postFiles("/api/import-image", files, 4);
      if (!data) return;
      state.flightImportData = data;
      const importedFlight = data.flight || data.offerFlight || {};
      setImportReady({
        flight: hasMeaningfulObject(importedFlight, ["airline", "route", "departure", "arrival", "price", "segments"]),
        hotel: Boolean(state.hotelImportData),
        destination: Boolean(inferDestination({}, importedFlight, state.hotelImportData?.hotel || {})),
        dates: Boolean(importedFlight.departure || importedFlight.arrival),
        price: Boolean(toNumber(importedFlight.price, 0))
      });
    }

    async function runHotelImport(files) {
      const data = await postFiles("/api/import-hotel-image", files, 4);
      if (!data) return;
      state.hotelImportData = data;
      const importedHotel = data.hotel || data.offerHotel || {};
      setImportReady({
        flight: Boolean(state.flightImportData),
        hotel: hasMeaningfulObject(importedHotel, ["name", "area", "city", "room", "meal", "price", "images"]),
        destination: Boolean(inferDestination({}, state.flightImportData?.flight || {}, importedHotel)),
        dates: Boolean(state.flightImportData?.flight?.departure || state.flightImportData?.flight?.arrival),
        price: Boolean(toNumber(importedHotel.price, 0) || toNumber(state.flightImportData?.flight?.price, 0))
      });
    }

    async function generateProposal() {
      if (!generateButton || generateButton.disabled) return;
      try {
        generateButton.disabled = true;
        setMessage("Generating proposal...", "working");
        const payload = buildOfferPayloadFromFlow(state);
        const result = await fetchJson("/api/offers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        setGeneratedLinks(result.offer?.id, result.clientLink, result.pdfLink);
        updateProposalPreview(result.offer);
        setMessage("Proposal ready.", "info");
        document.getElementById("preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (error) {
        setMessage(error.message || "Proposal generation failed.", "error");
        generateButton.disabled = false;
      }
    }

    function openManualProposalWorkspace() {
      window.location.href = "/admin";
    }

    function renderShowcaseProposals() {
      if (!showcaseGrid) return;
      const proposals = safeArray(config.showcaseProposals).filter((proposal) => proposal.htmlUrl || proposal.pdfUrl).slice(0, 3);
      if (!proposals.length) {
        showcaseGrid.innerHTML = '<p class="showcase-empty">No verified example proposals are available yet.</p>';
        return;
      }
      showcaseGrid.innerHTML = proposals.map((proposal) => `
        <article class="recent-card">
          <div class="recent-thumb">
            <img src="${escapeAttr(proposal.image)}" alt="${escapeAttr(proposal.destination)} proposal thumbnail" />
          </div>
          <div class="recent-body">
            <div>
              <h3 class="recent-destination">${escapeHtml(proposal.destination)}</h3>
              <p class="recent-client">${escapeHtml(proposal.subtitle)}</p>
            </div>
            <div class="recent-meta">
              <span class="status-ready">${escapeHtml(proposal.status || "Ready")}</span>
              <strong>${escapeHtml(proposal.offerId || "")}</strong>
            </div>
            <span class="recent-actions">
              ${createShowcaseAction("View HTML", proposal.htmlUrl)}
              ${createShowcaseAction("View PDF", proposal.pdfUrl)}
            </span>
          </div>
        </article>
      `).join("");
    }

    createProposalTop?.addEventListener("click", (event) => {
      event.preventDefault();
      focusWorkspace();
    });

    showcaseCta?.addEventListener("click", (event) => {
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

    renderShowcaseProposals();
  }

  window.GT63ProposalFlow = { init };
})();
