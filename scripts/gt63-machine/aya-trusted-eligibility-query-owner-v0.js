"use strict";

const { createHash } = require("node:crypto");
const { TextDecoder, types: { isProxy } } = require("node:util");

const RESULT_TYPE = "GT63_AYA_TRUSTED_ELIGIBILITY_QUERY_OWNER_RESULT";
const RESULT_SCHEMA_VERSION = "1.0";
const RULESET_VERSION = "aya-trusted-eligibility-query-owner-v0.1.0";
const CANDIDATE_SET_TYPE = "GT63_AYA_ELIGIBILITY_CANDIDATE_SET";
const CANDIDATE_SET_SCHEMA_VERSION = "1.0";
const ASSOCIATION_TYPE = "AYA_AUTHENTICATED_ACCOUNT_INTERACTION_ASSOCIATION";
const DOMAIN = "GT63:AYA:TRUSTED_ELIGIBILITY_QUERY_OWNER:V0:AUTHORITY_SCOPE";
const MAX_SNAPSHOT_BYTES = 1_048_576;
const MAX_DEPTH = 64;

const LIFECYCLE_STATES = new Set([
  "CURRENT",
  "STALE",
  "SUPERSEDED",
  "REVOKED",
  "DEACTIVATED",
  "UNKNOWN"
]);
const FRESHNESS_STATES = new Set(["CURRENT", "STALE", "UNKNOWN"]);
const CONTRADICTION_STATES = new Set(["NONE", "CONFLICT"]);
const GATE_STATES = new Set(["PENDING", "SATISFIED", "CONSUMED", "SUPERSEDED"]);

const NON_CLAIMS = deepFreeze({
  principalEligibilityInferredByOwner: false,
  roleCreated: false,
  assignmentCreated: false,
  delegationCreated: false,
  humanAuthorizationCreated: false,
  humanGateCreated: false,
  humanGateSatisfied: false,
  continuationAuthorityCreated: false,
  executionAuthorityCreated: false,
  effectAuthorized: false,
  offerMutationPerformed: false
});

const DANGEROUS_FLAGS = new Set([
  "roleCreated",
  "assignmentCreated",
  "delegationCreated",
  "humanAuthorizationCreated",
  "humanGateCreated",
  "humanGateSatisfied",
  "continuationAuthorityCreated",
  "executionAuthorityCreated",
  "effectAuthorized",
  "offerMutationPerformed"
]);

class ContractError extends Error {
  constructor(reason) {
    super(reason);
    this.name = "ContractError";
    this.reason = reason;
  }
}

const CALLBACK_VIOLATION = Symbol("GT63_AYA_SNAPSHOT_CALLBACK_VIOLATION");

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const key of Object.keys(value)) {
      deepFreeze(value[key]);
    }
    Object.freeze(value);
  }
  return value;
}

function makeResult({
  outcome,
  reason,
  queryState = "NOT_DERIVED",
  portState = "NOT_INVOKED",
  invocationCount = 0,
  eligibilityResult = null
}) {
  return deepFreeze({
    type: RESULT_TYPE,
    schemaVersion: RESULT_SCHEMA_VERSION,
    rulesetVersion: RULESET_VERSION,
    outcome,
    reason,
    queryState,
    portState,
    invocationCount,
    eligibilityResult,
    authority: "NONE",
    authorityEffect: "NONE",
    nonClaims: { ...NON_CLAIMS }
  });
}

function rejected(reason, state = {}) {
  return makeResult({ outcome: "QUERY_REJECTED", reason, ...state });
}

function notDerived(reason) {
  return makeResult({ outcome: "QUERY_NOT_DERIVED", reason });
}

function evaluationError(reason, state) {
  return makeResult({ outcome: "EVALUATION_ERROR", reason, ...state, eligibilityResult: null });
}

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value) || isProxy(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertConstructorDependencies(dependencies) {
  if (!isPlainRecord(dependencies)) {
    throw new TypeError("dependencies must be a non-proxy plain object");
  }
  const keys = Reflect.ownKeys(dependencies);
  if (
    keys.length !== 2 ||
    !keys.includes("withEligibilityCandidateSetSnapshot") ||
    !keys.includes("principalEligibilityPort") ||
    keys.some((key) => typeof key !== "string")
  ) {
    throw new TypeError("dependencies must contain exactly the two contract ports");
  }
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(dependencies, key);
    if (
      !descriptor ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true ||
      typeof descriptor.value !== "function"
    ) {
      throw new TypeError(`${key} must be an enumerable own data-property function`);
    }
  }
}

function isValidScalarString(value, nonEmpty = false) {
  if (typeof value !== "string" || (nonEmpty && value.length === 0)) {
    return false;
  }
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const low = value.charCodeAt(index + 1);
      if (!(low >= 0xdc00 && low <= 0xdfff)) {
        return false;
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function isSafeIntegerInRange(value, minimum) {
  return Number.isSafeInteger(value) && !Object.is(value, -0) && value >= minimum;
}

function parseCandidateSet(raw) {
  if (!Buffer.isBuffer(raw) || raw.length < 1 || raw.length > MAX_SNAPSHOT_BYTES) {
    throw new ContractError("SNAPSHOT_BYTES_INVALID");
  }
  if (raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) {
    throw new ContractError("SNAPSHOT_BYTES_INVALID");
  }

  let source;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(raw);
  } catch {
    throw new ContractError("SNAPSHOT_BYTES_INVALID");
  }

  let cursor = 0;

  function reasonFor(path) {
    return path.includes("authorityScope")
      ? "AUTHORITY_SCOPE_INVALID"
      : "SNAPSHOT_SCHEMA_INVALID";
  }

  function fail(path) {
    throw new ContractError(reasonFor(path));
  }

  function skipWhitespace() {
    while (
      source[cursor] === " " ||
      source[cursor] === "\t" ||
      source[cursor] === "\n" ||
      source[cursor] === "\r"
    ) {
      cursor += 1;
    }
  }

  function parseString(path) {
    if (source[cursor] !== "\"") {
      fail(path);
    }
    cursor += 1;
    let output = "";
    while (cursor < source.length) {
      const code = source.charCodeAt(cursor);
      if (code === 0x22) {
        cursor += 1;
        return output;
      }
      if (code === 0x5c) {
        cursor += 1;
        const escaped = source[cursor];
        const simple = {
          "\"": "\"",
          "\\": "\\",
          "/": "/",
          b: "\b",
          f: "\f",
          n: "\n",
          r: "\r",
          t: "\t"
        };
        if (Object.prototype.hasOwnProperty.call(simple, escaped)) {
          output += simple[escaped];
          cursor += 1;
          continue;
        }
        if (escaped !== "u") {
          fail(path);
        }
        const firstHex = source.slice(cursor + 1, cursor + 5);
        if (!/^[0-9a-fA-F]{4}$/.test(firstHex)) {
          fail(path);
        }
        const first = Number.parseInt(firstHex, 16);
        cursor += 5;
        if (first >= 0xd800 && first <= 0xdbff) {
          if (source.slice(cursor, cursor + 2) !== "\\u") {
            fail(path);
          }
          const secondHex = source.slice(cursor + 2, cursor + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(secondHex)) {
            fail(path);
          }
          const second = Number.parseInt(secondHex, 16);
          if (second < 0xdc00 || second > 0xdfff) {
            fail(path);
          }
          output += String.fromCodePoint(0x10000 + ((first - 0xd800) << 10) + (second - 0xdc00));
          cursor += 6;
        } else if (first >= 0xdc00 && first <= 0xdfff) {
          fail(path);
        } else {
          output += String.fromCharCode(first);
        }
        continue;
      }
      if (code < 0x20) {
        fail(path);
      }
      if (code >= 0xd800 && code <= 0xdbff) {
        const low = source.charCodeAt(cursor + 1);
        if (!(low >= 0xdc00 && low <= 0xdfff)) {
          fail(path);
        }
        output += source[cursor] + source[cursor + 1];
        cursor += 2;
        continue;
      }
      if (code >= 0xdc00 && code <= 0xdfff) {
        fail(path);
      }
      output += source[cursor];
      cursor += 1;
    }
    fail(path);
  }

  function parseNumber(path) {
    const remainder = source.slice(cursor);
    const match = /^-?(?:0|[1-9][0-9]*)/.exec(remainder);
    if (!match) {
      fail(path);
    }
    const token = match[0];
    if (token === "-0") {
      fail(path);
    }
    cursor += token.length;
    const value = Number(token);
    if (!Number.isSafeInteger(value)) {
      fail(path);
    }
    return value;
  }

  function parseValue(depth, path) {
    skipWhitespace();
    const character = source[cursor];
    if (character === "{") {
      if (depth + 1 > MAX_DEPTH) {
        fail(path);
      }
      cursor += 1;
      const object = Object.create(null);
      const keys = new Set();
      skipWhitespace();
      if (source[cursor] === "}") {
        cursor += 1;
        return object;
      }
      while (cursor < source.length) {
        const key = parseString(path);
        if (keys.has(key)) {
          fail(path);
        }
        keys.add(key);
        skipWhitespace();
        if (source[cursor] !== ":") {
          fail(path);
        }
        cursor += 1;
        object[key] = parseValue(depth + 1, path.concat(key));
        skipWhitespace();
        if (source[cursor] === "}") {
          cursor += 1;
          return object;
        }
        if (source[cursor] !== ",") {
          fail(path);
        }
        cursor += 1;
        skipWhitespace();
      }
      fail(path);
    }
    if (character === "[") {
      if (depth + 1 > MAX_DEPTH) {
        fail(path);
      }
      cursor += 1;
      const array = [];
      skipWhitespace();
      if (source[cursor] === "]") {
        cursor += 1;
        return array;
      }
      let index = 0;
      while (cursor < source.length) {
        array.push(parseValue(depth + 1, path.concat(String(index))));
        index += 1;
        skipWhitespace();
        if (source[cursor] === "]") {
          cursor += 1;
          return array;
        }
        if (source[cursor] !== ",") {
          fail(path);
        }
        cursor += 1;
      }
      fail(path);
    }
    if (character === "\"") {
      return parseString(path);
    }
    if (source.startsWith("true", cursor)) {
      cursor += 4;
      return true;
    }
    if (source.startsWith("false", cursor)) {
      cursor += 5;
      return false;
    }
    if (source.startsWith("null", cursor)) {
      cursor += 4;
      return null;
    }
    if (character === "-" || (character >= "0" && character <= "9")) {
      return parseNumber(path);
    }
    fail(path);
  }

  skipWhitespace();
  const parsed = parseValue(0, []);
  skipWhitespace();
  if (cursor !== source.length) {
    throw new ContractError("SNAPSHOT_SCHEMA_INVALID");
  }
  return parsed;
}

function hasExactKeys(record, expected) {
  if (!isPlainRecord(record)) {
    return false;
  }
  const keys = Reflect.ownKeys(record);
  return (
    keys.length === expected.length &&
    keys.every((key) => typeof key === "string" && expected.includes(key))
  );
}

function hasStateShape(record) {
  return (
    LIFECYCLE_STATES.has(record.lifecycleState) &&
    FRESHNESS_STATES.has(record.freshnessState) &&
    CONTRADICTION_STATES.has(record.contradictionState) &&
    typeof record.authority === "string" &&
    typeof record.authorityEffect === "string"
  );
}

function assertCandidateSchema(snapshot) {
  const topKeys = [
    "type",
    "schemaVersion",
    "snapshotRef",
    "snapshotRevision",
    "authenticatedAccount",
    "associations",
    "interactions",
    "gateCandidates",
    "continuationTargets",
    "authority",
    "authorityEffect"
  ];
  if (
    !hasExactKeys(snapshot, topKeys) ||
    snapshot.type !== CANDIDATE_SET_TYPE ||
    snapshot.schemaVersion !== CANDIDATE_SET_SCHEMA_VERSION ||
    !isValidScalarString(snapshot.snapshotRef, true) ||
    snapshot.snapshotRevision !== 1 ||
    !Array.isArray(snapshot.associations) ||
    !Array.isArray(snapshot.interactions) ||
    !Array.isArray(snapshot.gateCandidates) ||
    !Array.isArray(snapshot.continuationTargets) ||
    typeof snapshot.authority !== "string" ||
    typeof snapshot.authorityEffect !== "string"
  ) {
    throw new ContractError("SNAPSHOT_SCHEMA_INVALID");
  }

  const account = snapshot.authenticatedAccount;
  const accountKeys = [
    "accountRef",
    "accountRevision",
    "principalRef",
    "principalRevision",
    "principalEvidenceRef",
    "lifecycleState",
    "freshnessState",
    "contradictionState",
    "authority",
    "authorityEffect"
  ];
  if (
    !hasExactKeys(account, accountKeys) ||
    !isValidScalarString(account.accountRef, true) ||
    !isValidScalarString(account.accountRevision, true) ||
    !isValidScalarString(account.principalRef, true) ||
    !isValidScalarString(account.principalRevision, true) ||
    !isValidScalarString(account.principalEvidenceRef, true) ||
    !hasStateShape(account)
  ) {
    throw new ContractError("SNAPSHOT_SCHEMA_INVALID");
  }

  const associationKeys = [
    "type",
    "associationRef",
    "associationRevision",
    "accountRef",
    "accountRevision",
    "interactionId",
    "interactionRevision",
    "lifecycleState",
    "freshnessState",
    "contradictionState",
    "authority",
    "authorityEffect"
  ];
  for (const association of snapshot.associations) {
    if (
      !hasExactKeys(association, associationKeys) ||
      association.type !== ASSOCIATION_TYPE ||
      !isValidScalarString(association.associationRef, true) ||
      !isValidScalarString(association.associationRevision, true) ||
      !isValidScalarString(association.accountRef, true) ||
      !isValidScalarString(association.accountRevision, true) ||
      !isValidScalarString(association.interactionId, true) ||
      !isSafeIntegerInRange(association.interactionRevision, 0) ||
      !hasStateShape(association)
    ) {
      throw new ContractError("SNAPSHOT_SCHEMA_INVALID");
    }
  }

  const interactionKeys = [
    "interactionId",
    "interactionRevision",
    "lifecycleState",
    "freshnessState",
    "contradictionState",
    "authority",
    "authorityEffect"
  ];
  for (const interaction of snapshot.interactions) {
    if (
      !hasExactKeys(interaction, interactionKeys) ||
      !isValidScalarString(interaction.interactionId, true) ||
      !isSafeIntegerInRange(interaction.interactionRevision, 0) ||
      !hasStateShape(interaction)
    ) {
      throw new ContractError("SNAPSHOT_SCHEMA_INVALID");
    }
  }

  const gateKeys = [
    "gateId",
    "gateRevision",
    "interactionId",
    "registeredInteractionRevision",
    "status",
    "authorityScope",
    "continuationTargetRef",
    "continuationTargetRevision",
    "lifecycleState",
    "freshnessState",
    "contradictionState",
    "authority",
    "authorityEffect"
  ];
  for (const gate of snapshot.gateCandidates) {
    if (
      !hasExactKeys(gate, gateKeys) ||
      !isValidScalarString(gate.gateId, true) ||
      !isSafeIntegerInRange(gate.gateRevision, 1) ||
      !isValidScalarString(gate.interactionId, true) ||
      !isSafeIntegerInRange(gate.registeredInteractionRevision, 0) ||
      !GATE_STATES.has(gate.status) ||
      !isPlainRecord(gate.authorityScope) ||
      !isValidScalarString(gate.continuationTargetRef, true) ||
      !isValidScalarString(gate.continuationTargetRevision, true) ||
      !hasStateShape(gate)
    ) {
      throw new ContractError("SNAPSHOT_SCHEMA_INVALID");
    }
  }

  const targetKeys = [
    "continuationTargetRef",
    "continuationTargetRevision",
    "lifecycleState",
    "freshnessState",
    "contradictionState",
    "authority",
    "authorityEffect"
  ];
  for (const target of snapshot.continuationTargets) {
    if (
      !hasExactKeys(target, targetKeys) ||
      !isValidScalarString(target.continuationTargetRef, true) ||
      !isValidScalarString(target.continuationTargetRevision, true) ||
      !hasStateShape(target)
    ) {
      throw new ContractError("SNAPSHOT_SCHEMA_INVALID");
    }
  }
}

function assertNoAuthority(snapshot) {
  const records = [
    snapshot,
    snapshot.authenticatedAccount,
    ...snapshot.associations,
    ...snapshot.interactions,
    ...snapshot.gateCandidates,
    ...snapshot.continuationTargets
  ];
  if (records.some((record) => record.authority !== "NONE" || record.authorityEffect !== "NONE")) {
    throw new ContractError("SNAPSHOT_AUTHORITY_MISMATCH");
  }
}

function assertNfcCompatibility(snapshot) {
  const values = [];
  for (const association of snapshot.associations) {
    values.push(association.interactionId);
  }
  for (const interaction of snapshot.interactions) {
    values.push(interaction.interactionId);
  }
  for (const gate of snapshot.gateCandidates) {
    values.push(gate.gateId, gate.interactionId, gate.continuationTargetRef);
  }
  for (const target of snapshot.continuationTargets) {
    values.push(target.continuationTargetRef);
  }
  if (values.some((value) => value !== value.normalize("NFC"))) {
    throw new ContractError("NFC_REQUIREMENT_VIOLATION");
  }
}

function isCurrent(record) {
  return (
    record.lifecycleState === "CURRENT" &&
    record.freshnessState === "CURRENT" &&
    record.contradictionState === "NONE" &&
    record.authority === "NONE" &&
    record.authorityEffect === "NONE"
  );
}

function selectCandidate(snapshot) {
  const account = snapshot.authenticatedAccount;
  if (!isCurrent(account)) {
    throw new ContractError("AUTHENTICATED_ACCOUNT_NOT_CURRENT");
  }

  const accountAssociations = snapshot.associations.filter(
    (association) => association.accountRef === account.accountRef
  );
  const exactAssociations = accountAssociations.filter(
    (association) => association.accountRevision === account.accountRevision
  );
  if (exactAssociations.some((association) => association.contradictionState === "CONFLICT")) {
    throw new ContractError("CANDIDATE_IDENTITY_CONFLICT");
  }
  if (exactAssociations.length === 0 && accountAssociations.length > 0) {
    throw new ContractError("ASSOCIATION_MISMATCH");
  }
  const currentAssociations = exactAssociations.filter(isCurrent);
  if (currentAssociations.length > 1) {
    throw new ContractError("CANDIDATE_IDENTITY_CONFLICT");
  }
  if (currentAssociations.length === 0) {
    throw new ContractError("ASSOCIATION_NOT_CURRENT");
  }
  const association = currentAssociations[0];

  const identityInteractions = snapshot.interactions.filter(
    (interaction) => interaction.interactionId === association.interactionId
  );
  if (identityInteractions.some((interaction) => interaction.contradictionState === "CONFLICT")) {
    throw new ContractError("CANDIDATE_IDENTITY_CONFLICT");
  }
  const currentIdentityInteractions = identityInteractions.filter(isCurrent);
  if (currentIdentityInteractions.length > 1) {
    throw new ContractError("CANDIDATE_IDENTITY_CONFLICT");
  }
  const exactInteractions = identityInteractions.filter(
    (interaction) => interaction.interactionRevision === association.interactionRevision
  );
  if (exactInteractions.length === 0 && identityInteractions.length > 0) {
    throw new ContractError("INTERACTION_MISMATCH");
  }
  const currentInteractions = exactInteractions.filter(isCurrent);
  if (currentInteractions.length > 1) {
    throw new ContractError("CANDIDATE_IDENTITY_CONFLICT");
  }
  if (currentInteractions.length === 0) {
    throw new ContractError("INTERACTION_NOT_CURRENT");
  }
  const interaction = currentInteractions[0];

  const gates = snapshot.gateCandidates.filter(
    (gate) => gate.interactionId === interaction.interactionId
  );
  if (gates.some((gate) => gate.contradictionState === "CONFLICT")) {
    throw new ContractError("CANDIDATE_IDENTITY_CONFLICT");
  }
  const currentGates = gates.filter(isCurrent);
  if (currentGates.length > 1) {
    throw new ContractError("MULTIPLE_CURRENT_GATES");
  }
  if (currentGates.length === 0) {
    throw new ContractError("NO_CURRENT_GATE");
  }
  const gate = currentGates[0];
  if (gate.registeredInteractionRevision > interaction.interactionRevision) {
    throw new ContractError("INTERACTION_MISMATCH");
  }
  if (gate.status !== "PENDING") {
    throw new ContractError("CURRENT_GATE_NOT_PENDING");
  }

  const targetIdentity = snapshot.continuationTargets.filter(
    (target) => target.continuationTargetRef === gate.continuationTargetRef
  );
  if (targetIdentity.some((target) => target.contradictionState === "CONFLICT")) {
    throw new ContractError("CANDIDATE_IDENTITY_CONFLICT");
  }
  const currentTargetIdentity = targetIdentity.filter(isCurrent);
  if (currentTargetIdentity.length > 1) {
    throw new ContractError("CANDIDATE_IDENTITY_CONFLICT");
  }
  const exactTargets = targetIdentity.filter(
    (target) => target.continuationTargetRevision === gate.continuationTargetRevision
  );
  if (exactTargets.length === 0) {
    throw new ContractError("CONTINUATION_TARGET_MISMATCH");
  }
  const currentTargets = exactTargets.filter(isCurrent);
  if (currentTargets.length > 1) {
    throw new ContractError("CANDIDATE_IDENTITY_CONFLICT");
  }
  if (currentTargets.length === 0) {
    throw new ContractError("CONTINUATION_TARGET_NOT_CURRENT");
  }

  return { account, interaction, gate };
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function canonicalString(value) {
  let output = "\"";
  for (const character of value) {
    const point = character.codePointAt(0);
    if (character === "\"") {
      output += "\\\"";
    } else if (character === "\\") {
      output += "\\\\";
    } else if (point === 0x08) {
      output += "\\b";
    } else if (point === 0x09) {
      output += "\\t";
    } else if (point === 0x0a) {
      output += "\\n";
    } else if (point === 0x0c) {
      output += "\\f";
    } else if (point === 0x0d) {
      output += "\\r";
    } else if (point <= 0x1f) {
      output += `\\u00${point.toString(16).padStart(2, "0")}`;
    } else {
      output += character;
    }
  }
  return `${output}\"`;
}

function canonicalize(value) {
  if (value === null) {
    return "null";
  }
  if (value === true) {
    return "true";
  }
  if (value === false) {
    return "false";
  }
  if (typeof value === "string") {
    if (!isValidScalarString(value)) {
      throw new ContractError("AUTHORITY_SCOPE_INVALID");
    }
    return canonicalString(value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new ContractError("AUTHORITY_SCOPE_INVALID");
    }
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  if (isPlainRecord(value)) {
    const keys = Object.keys(value).sort(compareUtf8);
    return `{${keys.map((key) => `${canonicalString(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  throw new ContractError("AUTHORITY_SCOPE_INVALID");
}

function authorityScopeDigest(authorityScope) {
  const canonical = canonicalize(authorityScope);
  const material = Buffer.concat([
    Buffer.from(DOMAIN, "ascii"),
    Buffer.from([0x00]),
    Buffer.from(canonical, "utf8")
  ]);
  return `sha256:${createHash("sha256").update(material).digest("hex")}`;
}

function queryObjectReferences(query) {
  const references = new WeakSet();
  (function visit(value) {
    if (value && typeof value === "object" && !references.has(value)) {
      references.add(value);
      for (const key of Object.keys(value)) {
        visit(value[key]);
      }
    }
  }(query));
  return references;
}

function copyEligibilityResult(value, query) {
  const queryReferences = queryObjectReferences(query);
  const seen = new Set();

  function copy(node, keyContext = null) {
    if (node === null || typeof node === "boolean") {
      return node;
    }
    if (typeof node === "string") {
      if (!isValidScalarString(node)) {
        throw new ContractError("PRINCIPAL_ELIGIBILITY_PORT_RETURNED_MALFORMED");
      }
      return node;
    }
    if (typeof node === "number") {
      if (!Number.isSafeInteger(node) || Object.is(node, -0)) {
        throw new ContractError("PRINCIPAL_ELIGIBILITY_PORT_RETURNED_MALFORMED");
      }
      return node;
    }
    if (node === undefined || typeof node !== "object" || isProxy(node)) {
      throw new ContractError("PRINCIPAL_ELIGIBILITY_PORT_RETURNED_MALFORMED");
    }
    if (queryReferences.has(node) || seen.has(node)) {
      throw new ContractError("PRINCIPAL_ELIGIBILITY_PORT_RETURNED_MALFORMED");
    }
    seen.add(node);

    if (Array.isArray(node)) {
      const ownKeys = Reflect.ownKeys(node);
      if (
        Object.getPrototypeOf(node) !== Array.prototype ||
        ownKeys.some((key) => typeof key === "symbol") ||
        ownKeys.some((key) => key !== "length" && !/^(?:0|[1-9][0-9]*)$/.test(key)) ||
        ownKeys.filter((key) => key !== "length").length !== node.length ||
        ownKeys.some((key) => key !== "length" && Number(key) >= node.length) ||
        node.length > Number.MAX_SAFE_INTEGER
      ) {
        throw new ContractError("PRINCIPAL_ELIGIBILITY_PORT_RETURNED_MALFORMED");
      }
      const output = [];
      for (let index = 0; index < node.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(node, String(index));
        if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
          throw new ContractError("PRINCIPAL_ELIGIBILITY_PORT_RETURNED_MALFORMED");
        }
        output.push(copy(descriptor.value));
      }
      return output;
    }

    if (!isPlainRecord(node)) {
      throw new ContractError("PRINCIPAL_ELIGIBILITY_PORT_RETURNED_MALFORMED");
    }
    const keys = Reflect.ownKeys(node);
    if (keys.some((key) => typeof key === "symbol")) {
      throw new ContractError("PRINCIPAL_ELIGIBILITY_PORT_RETURNED_MALFORMED");
    }
    const output = Object.create(null);
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(node, key);
      if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
        throw new ContractError("PRINCIPAL_ELIGIBILITY_PORT_RETURNED_MALFORMED");
      }
      if (key === "authority" && descriptor.value !== "NONE") {
        throw new ContractError("PRINCIPAL_ELIGIBILITY_PORT_RETURNED_MALFORMED");
      }
      if (key === "authorityEffect" && descriptor.value !== "NONE") {
        throw new ContractError("PRINCIPAL_ELIGIBILITY_PORT_RETURNED_MALFORMED");
      }
      if (DANGEROUS_FLAGS.has(key) && descriptor.value !== false) {
        throw new ContractError("PRINCIPAL_ELIGIBILITY_PORT_RETURNED_MALFORMED");
      }
      if (keyContext === "nonClaims" && descriptor.value !== false) {
        throw new ContractError("PRINCIPAL_ELIGIBILITY_PORT_RETURNED_MALFORMED");
      }
      output[key] = copy(descriptor.value, key === "nonClaims" ? "nonClaims" : null);
    }
    return output;
  }

  if (!isPlainRecord(value)) {
    throw new ContractError("PRINCIPAL_ELIGIBILITY_PORT_RETURNED_MALFORMED");
  }
  const authorityDescriptor = Object.getOwnPropertyDescriptor(value, "authority");
  if (!authorityDescriptor || !("value" in authorityDescriptor) || authorityDescriptor.value !== "NONE") {
    throw new ContractError("PRINCIPAL_ELIGIBILITY_PORT_RETURNED_MALFORMED");
  }
  return deepFreeze(copy(value));
}

function isThenable(value) {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) {
    return false;
  }
  try {
    return typeof value.then === "function";
  } catch {
    return true;
  }
}

function evaluateRawCandidateSet(raw, principalEligibilityPort) {
  let queryState = "NOT_DERIVED";
  let portState = "NOT_INVOKED";
  let invocationCount = 0;

  try {
    const snapshot = parseCandidateSet(raw);
    assertCandidateSchema(snapshot);
    assertNoAuthority(snapshot);
    assertNfcCompatibility(snapshot);

    let selected;
    try {
      selected = selectCandidate(snapshot);
    } catch (error) {
      if (!(error instanceof ContractError)) {
        throw error;
      }
      const notDerivedReasons = new Set([
        "AUTHENTICATED_ACCOUNT_NOT_CURRENT",
        "ASSOCIATION_NOT_CURRENT",
        "INTERACTION_NOT_CURRENT",
        "NO_CURRENT_GATE",
        "CONTINUATION_TARGET_NOT_CURRENT"
      ]);
      return notDerivedReasons.has(error.reason)
        ? notDerived(error.reason)
        : rejected(error.reason);
    }

    const digest = authorityScopeDigest(selected.gate.authorityScope);
    const query = deepFreeze({
      principalRef: selected.account.principalRef,
      principalRevision: selected.account.principalRevision,
      governanceAct: "GATE_AUTHORIZATION",
      contextScope: {
        scopeType: "GATE",
        interactionId: selected.interaction.interactionId,
        fromInteractionRevision: selected.gate.registeredInteractionRevision,
        throughInteractionRevision: selected.interaction.interactionRevision,
        gateId: selected.gate.gateId,
        gateRevision: selected.gate.gateRevision,
        authorityScopeDigest: digest,
        continuationTargetRef: selected.gate.continuationTargetRef
      }
    });
    queryState = "DERIVED";
    invocationCount = 1;

    let eligibilityResult;
    try {
      eligibilityResult = principalEligibilityPort(query);
    } catch {
      portState = "THREW";
      return evaluationError("PRINCIPAL_ELIGIBILITY_PORT_THREW", {
        queryState,
        portState,
        invocationCount
      });
    }

    if (eligibilityResult === null) {
      portState = "RETURNED_NULL";
      return makeResult({
        outcome: "RETURNED_NULL",
        reason: null,
        queryState,
        portState,
        invocationCount,
        eligibilityResult: null
      });
    }
    if (isThenable(eligibilityResult)) {
      portState = "RETURNED_ASYNC";
      return evaluationError("PRINCIPAL_ELIGIBILITY_PORT_RETURNED_ASYNC", {
        queryState,
        portState,
        invocationCount
      });
    }

    let safeResult;
    try {
      safeResult = copyEligibilityResult(eligibilityResult, query);
    } catch (error) {
      if (!(error instanceof ContractError)) {
        throw error;
      }
      portState = "RETURNED_MALFORMED";
      return evaluationError("PRINCIPAL_ELIGIBILITY_PORT_RETURNED_MALFORMED", {
        queryState,
        portState,
        invocationCount
      });
    }
    portState = "RETURNED_VALUE";
    return makeResult({
      outcome: "ELIGIBILITY_RESULT_RETURNED",
      reason: null,
      queryState,
      portState,
      invocationCount,
      eligibilityResult: safeResult
    });
  } catch (error) {
    if (error instanceof ContractError) {
      return rejected(error.reason, { queryState, portState, invocationCount });
    }
    return evaluationError("INTERNAL_EVALUATION_FAILURE", {
      queryState,
      portState,
      invocationCount
    });
  }
}

function createAyaTrustedEligibilityQueryOwnerV0(dependencies) {
  assertConstructorDependencies(dependencies);
  const { withEligibilityCandidateSetSnapshot, principalEligibilityPort } = dependencies;

  function evaluate() {
    if (arguments.length !== 0) {
      return rejected("PUBLIC_ARGUMENTS_FORBIDDEN");
    }

    let active = true;
    let used = false;
    let callbackCardinalityViolation = false;
    let provisionalResult = null;
    let providerReturn;
    let providerThrew = false;

    function consume(rawCandidateSet) {
      if (!active || used) {
        callbackCardinalityViolation = true;
        throw CALLBACK_VIOLATION;
      }
      used = true;
      provisionalResult = evaluateRawCandidateSet(rawCandidateSet, principalEligibilityPort);
      return provisionalResult;
    }

    try {
      providerReturn = withEligibilityCandidateSetSnapshot(consume);
    } catch {
      providerThrew = true;
    } finally {
      active = false;
    }

    const preservedState = provisionalResult
      ? {
          queryState: provisionalResult.queryState,
          portState: provisionalResult.portState,
          invocationCount: provisionalResult.invocationCount
        }
      : {};

    if (callbackCardinalityViolation) {
      return evaluationError("SNAPSHOT_CALLBACK_CARDINALITY_VIOLATION", preservedState);
    }
    if (providerThrew) {
      return evaluationError("SNAPSHOT_PROVIDER_THREW", preservedState);
    }
    if (!used) {
      return evaluationError("SNAPSHOT_CALLBACK_CARDINALITY_VIOLATION", preservedState);
    }
    if (isThenable(providerReturn)) {
      return evaluationError("SNAPSHOT_PROVIDER_RETURNED_ASYNC", preservedState);
    }
    if (providerReturn !== provisionalResult) {
      return evaluationError("SNAPSHOT_RETURN_CONTRACT_VIOLATION", preservedState);
    }
    return provisionalResult;
  }

  return Object.freeze({ evaluate });
}

module.exports = Object.freeze({ createAyaTrustedEligibilityQueryOwnerV0 });
