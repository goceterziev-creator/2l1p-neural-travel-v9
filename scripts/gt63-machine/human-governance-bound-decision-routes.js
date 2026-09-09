"use strict";

function createHumanGovernanceBoundDecisionRoutes({ routes, bindingRuntime }) {
  if (!routes || typeof routes.present !== "function" || typeof routes.decide !== "function") {
    throw new TypeError("routes.present and routes.decide must be functions");
  }
  if (!bindingRuntime || typeof bindingRuntime.acceptSourceEvent !== "function") {
    throw new TypeError("bindingRuntime.acceptSourceEvent must be a function");
  }

  async function present(req, res) {
    return routes.present(req, res);
  }

  async function decide(req, res) {
    const capture = createCaptureResponse(res);
    await routes.decide(req, capture.response);

    if (!capture.sent) return;
    if (capture.statusCode < 200 || capture.statusCode >= 300) {
      return sendCaptured(res, capture);
    }

    const body = capture.body;
    if (!body || body.outcome !== "HUMAN_SOURCE_EVENT_CREATED" || !body.sourceEvent) {
      return sendCaptured(res, capture);
    }

    const bindingResult = bindingRuntime.acceptSourceEvent(body.sourceEvent);
    return res.status(capture.statusCode).json(Object.freeze({
      ...body,
      bindingResult,
      authority: "NONE"
    }));
  }

  return Object.freeze({ present, decide, authority: "NONE" });
}

function createCaptureResponse(original) {
  const capture = { statusCode: 200, body: null, sent: false, headers: new Map() };
  const response = {
    status(code) { capture.statusCode = code; return response; },
    json(body) { capture.body = body; capture.sent = true; return response; },
    send(body) { capture.body = body; capture.sent = true; return response; },
    set(field, value) { capture.headers.set(field, value); return response; },
    setHeader(field, value) { capture.headers.set(field, value); },
    getHeader(field) { return capture.headers.get(field); },
    cookie(...args) { if (typeof original.cookie === "function") original.cookie(...args); return response; },
    clearCookie(...args) { if (typeof original.clearCookie === "function") original.clearCookie(...args); return response; }
  };
  return { ...capture, response, get statusCode() { return capture.statusCode; }, get body() { return capture.body; }, get sent() { return capture.sent; } };
}

function sendCaptured(res, capture) {
  if (typeof capture.body === "object" && capture.body !== null) {
    return res.status(capture.statusCode).json(capture.body);
  }
  return res.status(capture.statusCode).send(capture.body);
}

module.exports = Object.freeze({ createHumanGovernanceBoundDecisionRoutes });
