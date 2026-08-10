"use strict";

const RULESET_VERSION = "semantic-evidence-v1.0.0";

const WHITESPACE_VALUES = new Set(["PRESERVED", "TRIM_SURROUNDING"]);
const CASE_VALUES = new Set(["CASE_SENSITIVE", "CASE_INSENSITIVE_ASCII"]);
const PATH_VALUES = new Set([
  "NONE",
  "SLASH_DOT_SEGMENTS",
  "BACKSLASH_DOT_SEGMENTS",
  "SLASH_AND_BACKSLASH_DOT_SEGMENTS"
]);
const POLICY_KEYS = new Set(["whitespace", "caseSensitivity", "pathNormalization"]);
const ASCII_SURROUNDING_WHITESPACE = /^[\u0009\u000a\u000b\u000c\u000d\u0020]+|[\u0009\u000a\u000b\u000c\u000d\u0020]+$/g;

function assertPolicy(policy) {
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) {
    throw new Error("SCHEMA_UNSUPPORTED_FIELD:targetNormalizationPolicy");
  }

  for (const key of Object.keys(policy)) {
    if (!POLICY_KEYS.has(key)) {
      throw new Error(`SCHEMA_UNSUPPORTED_FIELD:${key}`);
    }
  }

  for (const key of POLICY_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(policy, key)) {
      throw new Error(`SCHEMA_UNSUPPORTED_FIELD:${key}`);
    }
  }

  if (!WHITESPACE_VALUES.has(policy.whitespace)) {
    throw new Error(`SCHEMA_UNSUPPORTED_VALUE:whitespace:${policy.whitespace}`);
  }
  if (!CASE_VALUES.has(policy.caseSensitivity)) {
    throw new Error(`SCHEMA_UNSUPPORTED_VALUE:caseSensitivity:${policy.caseSensitivity}`);
  }
  if (!PATH_VALUES.has(policy.pathNormalization)) {
    throw new Error(`SCHEMA_UNSUPPORTED_VALUE:pathNormalization:${policy.pathNormalization}`);
  }
}

function applyWhitespace(value, whitespace) {
  if (whitespace === "TRIM_SURROUNDING") {
    return value.replace(ASCII_SURROUNDING_WHITESPACE, "");
  }
  return value;
}

function applyAsciiCase(value, caseSensitivity) {
  if (caseSensitivity !== "CASE_INSENSITIVE_ASCII") {
    return value;
  }
  return value.replace(/[A-Z]/g, (letter) => String.fromCharCode(letter.charCodeAt(0) + 32));
}

function separatorConfig(pathNormalization) {
  if (pathNormalization === "SLASH_DOT_SEGMENTS") {
    return { canonical: "/", isSeparator: (char) => char === "/" };
  }
  if (pathNormalization === "BACKSLASH_DOT_SEGMENTS") {
    return { canonical: "\\", isSeparator: (char) => char === "\\" };
  }
  if (pathNormalization === "SLASH_AND_BACKSLASH_DOT_SEGMENTS") {
    return { canonical: "/", isSeparator: (char) => char === "/" || char === "\\" };
  }
  return null;
}

function normalizeDotSegments(value, pathNormalization) {
  const config = separatorConfig(pathNormalization);
  if (!config || value === "") {
    return value;
  }

  const chars = Array.from(value);
  const hasLeadingSeparator = chars.length > 0 && config.isSeparator(chars[0]);
  const hasOnlySeparators = chars.length > 0 && chars.every(config.isSeparator);
  if (hasOnlySeparators) {
    return config.canonical;
  }

  const rawSegments = [];
  let current = "";
  for (const char of chars) {
    if (config.isSeparator(char)) {
      rawSegments.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  rawSegments.push(current);

  const retained = [];
  for (const segment of rawSegments) {
    if (segment === "" || segment === ".") {
      continue;
    }
    if (segment === "..") {
      const previous = retained[retained.length - 1];
      if (previous && previous !== "..") {
        retained.pop();
      } else {
        retained.push(segment);
      }
      continue;
    }
    retained.push(segment);
  }

  let rebuilt = retained.join(config.canonical);
  if (hasLeadingSeparator) {
    rebuilt = config.canonical + rebuilt;
  }
  if (rebuilt.length > 1 && rebuilt.endsWith(config.canonical)) {
    rebuilt = rebuilt.slice(0, -config.canonical.length);
  }
  return rebuilt;
}

function normalizeTargetToken(token, targetNormalizationPolicy) {
  if (typeof token !== "string") {
    throw new Error("SCHEMA_UNSUPPORTED_FIELD:token");
  }
  assertPolicy(targetNormalizationPolicy);

  const nfc = token.normalize("NFC");
  const whitespaceNormalized = applyWhitespace(nfc, targetNormalizationPolicy.whitespace);
  const caseNormalized = applyAsciiCase(whitespaceNormalized, targetNormalizationPolicy.caseSensitivity);
  if (targetNormalizationPolicy.pathNormalization === "NONE") {
    return caseNormalized;
  }
  return normalizeDotSegments(caseNormalized, targetNormalizationPolicy.pathNormalization);
}

module.exports = {
  RULESET_VERSION,
  normalizeTargetToken
};
