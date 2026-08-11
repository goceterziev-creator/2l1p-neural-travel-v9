"use strict";

const RULESET_VERSION = "semantic-evidence-v1.0.1";

const FRAME_TYPES = new Set([
  "CURRENT_BASELINE",
  "HISTORICAL_INTERVAL",
  "COMMIT_FRAME",
  "RUNTIME_OBSERVATION_FRAME",
  "DECLARED_FRAME",
  "UNKNOWN_FRAME"
]);

const REQUIRED_FIELDS = new Set([
  "temporalFrameId",
  "scopeId",
  "frameType",
  "start",
  "end",
  "baselineRef",
  "evidenceRefs"
]);

function assertRuleset(rulesetVersion) {
  if (rulesetVersion !== RULESET_VERSION) {
    throw new Error(`UNSUPPORTED_RULESET_VERSION:${rulesetVersion || "null"}`);
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function daysInMonth(year, month) {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isUtcInstant(value) {
  if (typeof value !== "string") {
    return false;
  }
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/);
  if (!match) {
    return false;
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  return month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month) &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59 &&
    second >= 0 &&
    second <= 59;
}

function validateNullableRef(value, fieldName, prefix) {
  if (value === null) {
    return;
  }
  if (typeof value !== "string" || !value.startsWith(prefix) || value.length === prefix.length) {
    throw new Error(`SCHEMA_UNSUPPORTED_VALUE:${fieldName}`);
  }
}

function validateRequiredString(value, fieldName, prefix) {
  if (typeof value !== "string" || !value.startsWith(prefix) || value.length === prefix.length) {
    throw new Error(`SCHEMA_UNSUPPORTED_VALUE:${fieldName}`);
  }
}

function validateTimestamp(value, fieldName) {
  if (value === null) {
    return;
  }
  if (!isUtcInstant(value)) {
    throw new Error(`SCHEMA_UNSUPPORTED_VALUE:${fieldName}`);
  }
}

function validateEvidenceRefs(value) {
  if (!Array.isArray(value)) {
    throw new Error("SCHEMA_UNSUPPORTED_VALUE:evidenceRefs");
  }
  for (const ref of value) {
    if (typeof ref !== "string" || !ref.startsWith("ev:") || ref.length === 3) {
      throw new Error("SCHEMA_UNSUPPORTED_VALUE:evidenceRefs");
    }
  }
}

function validateTemporalFrame(frame, rulesetVersion) {
  assertRuleset(rulesetVersion);
  if (!isPlainObject(frame)) {
    throw new Error("SCHEMA_UNSUPPORTED_FIELD:temporalFrame");
  }
  for (const key of Object.keys(frame)) {
    if (!REQUIRED_FIELDS.has(key)) {
      throw new Error(`SCHEMA_UNSUPPORTED_FIELD:${key}`);
    }
  }
  for (const key of REQUIRED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(frame, key)) {
      throw new Error(`SCHEMA_UNSUPPORTED_FIELD:${key}`);
    }
  }
  validateRequiredString(frame.temporalFrameId, "temporalFrameId", "time:");
  validateRequiredString(frame.scopeId, "scopeId", "scope:");
  if (!FRAME_TYPES.has(frame.frameType)) {
    throw new Error(`SCHEMA_UNSUPPORTED_VALUE:frameType:${frame.frameType}`);
  }
  validateTimestamp(frame.start, "start");
  validateTimestamp(frame.end, "end");
  validateNullableRef(frame.baselineRef, "baselineRef", "baseline:");
  validateEvidenceRefs(frame.evidenceRefs);
  return {
    ok: true,
    frame: {
      temporalFrameId: frame.temporalFrameId,
      scopeId: frame.scopeId,
      frameType: frame.frameType,
      start: frame.start,
      end: frame.end,
      baselineRef: frame.baselineRef,
      evidenceRefs: frame.evidenceRefs.slice().sort()
    }
  };
}

function validateTemporalFrames(frames, rulesetVersion) {
  assertRuleset(rulesetVersion);
  if (!Array.isArray(frames)) {
    throw new Error("SCHEMA_UNSUPPORTED_FIELD:temporalFrames");
  }
  const byId = new Map();
  const normalized = [];
  const duplicatedIds = new Set();
  for (const frame of frames) {
    const result = validateTemporalFrame(frame, rulesetVersion).frame;
    const normalizedId = result.temporalFrameId.normalize("NFC");
    if (byId.has(normalizedId)) {
      duplicatedIds.add(normalizedId);
    } else {
      byId.set(normalizedId, result);
    }
    normalized.push(result);
  }
  if (duplicatedIds.size > 0) {
    const selectedId = Array.from(duplicatedIds)
      .sort((left, right) => left < right ? -1 : left > right ? 1 : 0)[0];
    throw new Error(`SCHEMA_UNSUPPORTED_VALUE:duplicateTemporalFrameId:${selectedId}`);
  }
  normalized.sort((left, right) => left.temporalFrameId < right.temporalFrameId ? -1 : left.temporalFrameId > right.temporalFrameId ? 1 : 0);
  return {
    ok: true,
    frames: normalized
  };
}

function compareTemporalFrameRefs(leftRef, rightRef, temporalFrames, rulesetVersion) {
  assertRuleset(rulesetVersion);
  if (typeof leftRef !== "string" || typeof rightRef !== "string") {
    return "UNKNOWN";
  }
  let validated;
  try {
    validated = validateTemporalFrames(temporalFrames, rulesetVersion).frames;
  } catch (error) {
    return "UNKNOWN";
  }
  const byId = new Map(validated.map((frame) => [frame.temporalFrameId, frame]));
  const left = byId.get(leftRef);
  const right = byId.get(rightRef);
  if (!left || !right) {
    return "UNKNOWN";
  }
  if (left.temporalFrameId === right.temporalFrameId) {
    return "SAME_FRAME";
  }
  if (left.frameType === "UNKNOWN_FRAME" || right.frameType === "UNKNOWN_FRAME") {
    return "UNKNOWN";
  }
  if (left.scopeId === right.scopeId) {
    return "DIFFERENT_FRAME";
  }
  return "UNKNOWN";
}

module.exports = {
  FRAME_TYPES,
  RULESET_VERSION,
  compareTemporalFrameRefs,
  validateTemporalFrame,
  validateTemporalFrames
};
