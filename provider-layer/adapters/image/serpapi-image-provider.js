"use strict";

const {
  PROVIDER_TYPES
} = require("../../contracts/provider-types");
const {
  providerSuccess,
  providerFailure
} = require("../../contracts/provider-result");
const {
  classifyProviderHttpError
} = require("../../errors/provider-errors");

function uniqueImageUrls(values = [], limit = 3) {
  const seen = new Set();
  const result = [];
  for (const value of Array.isArray(values) ? values : []) {
    const url = String(value || "").trim();
    if (!/^https?:\/\//i.test(url)) continue;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(url);
    if (result.length >= Number(limit || 3)) break;
  }
  return result;
}

function createSerpApiImageProvider(config = {}) {
  const serpApiConfig = config.image?.serpapi || config.serpapi || {};
  const apiKey = serpApiConfig.apiKey || "";

  return {
    id: "serpapi",
    type: PROVIDER_TYPES.IMAGE,
    version: "1.0.0",
    async health() {
      return {
        status: apiKey ? "ready" : "disabled",
        checkedAt: new Date().toISOString(),
        message: apiKey ? "SerpAPI image provider configured" : "SerpAPI image provider is missing an API key"
      };
    },
    async execute(request = {}, context = {}) {
      if (!["hotel_images", "destination_image"].includes(request.entity)) {
        return providerFailure({
          code: "PROVIDER_INVALID_REQUEST",
          category: "invalid_request",
          message: `Unsupported SerpAPI image entity: ${request.entity || "(empty)"}`,
          retryable: false
        }, {
          provenance: provenance(context)
        });
      }

      if (!apiKey) {
        return providerFailure({
          code: "PROVIDER_AUTHENTICATION_FAILED",
          category: "authentication",
          message: "Missing SERPAPI_KEY",
          retryable: false,
          providerStatus: 400
        }, {
          provenance: provenance(context)
        });
      }

      const query = buildQuery(request);
      if (!query) {
        return providerSuccess([], {
          confidence: { score: 0, reasons: ["No image search query was provided"] },
          provenance: provenance(context),
          warnings: [{ code: "IMAGE_QUERY_EMPTY", message: "No image search query was provided" }]
        });
      }

      try {
        const url = new URL("https://serpapi.com/search.json");
        url.searchParams.set("engine", "google_images");
        url.searchParams.set("q", query);
        url.searchParams.set("api_key", apiKey);

        const fetchOptions = {};
        if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
          fetchOptions.signal = AbortSignal.timeout(Number(request.timeoutMs || 8000));
        }

        const response = await fetch(url, fetchOptions);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          return providerFailure(classifyProviderHttpError(response.status, payload?.error || `HTTP ${response.status}`), {
            provenance: provenance(context),
            meta: {
              providerStatus: response.status,
              query
            }
          });
        }

        const candidates = uniqueImageUrls(
          (Array.isArray(payload?.images_results) ? payload.images_results : [])
            .flatMap((item) => [item?.original, item?.thumbnail]),
          request.limit || 3
        );

        return providerSuccess(candidates, {
          confidence: {
            score: candidates.length ? 0.75 : 0,
            reasons: candidates.length ? ["SerpAPI returned image candidates"] : ["SerpAPI returned no image candidates"]
          },
          provenance: provenance(context),
          warnings: candidates.length ? [] : [{ code: "IMAGE_RESULTS_EMPTY", message: "Image provider returned no usable image URLs" }],
          meta: {
            providerStatus: response.status,
            query,
            resultCount: candidates.length
          }
        });
      } catch (error) {
        return providerFailure(classifyProviderHttpError(error.statusCode || error.status || 0, error.message), {
          provenance: provenance(context),
          meta: {
            query,
            thrown: true
          }
        });
      }
    }
  };
}

function buildQuery(request = {}) {
  if (request.entity === "hotel_images") {
    return [request.name, request.destination, "hotel exterior room"]
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(" ");
  }
  if (request.entity === "destination_image") {
    return [request.destination, request.hint || "travel destination landmark landscape"]
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

function provenance(context = {}) {
  return {
    providerId: "serpapi",
    providerType: PROVIDER_TYPES.IMAGE,
    sourceName: "SerpAPI Google Images",
    retrievedAt: new Date().toISOString(),
    requestId: context.requestId || "",
    cached: false,
    fallbackUsed: false
  };
}

module.exports = {
  createSerpApiImageProvider,
  uniqueImageUrls
};
