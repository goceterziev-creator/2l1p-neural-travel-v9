"use strict";

const assert = require("assert");
const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { RULESET_VERSION, normalizeTargetToken } = require("./gt63-machine/semantic-target-normalization");

const repositoryRoot = __dirname.includes(`${path.sep}scripts`)
  ? path.resolve(__dirname, "..")
  : process.cwd();

const policy = (overrides = {}) => ({
  whitespace: "PRESERVED",
  caseSensitivity: "CASE_SENSITIVE",
  pathNormalization: "NONE",
  ...overrides
});

function assertThrowsMessage(fn, pattern) {
  assert.throws(fn, (error) => pattern.test(error.message));
}

function runNodeCheck(filePath) {
  const run = childProcess.spawnSync(process.execPath, ["--check", filePath], {
    cwd: repositoryRoot,
    encoding: "utf8"
  });
  assert.strictEqual(run.status, 0, run.stderr || run.stdout);
}

function normalize(token, overrides) {
  return normalizeTargetToken(token, policy(overrides));
}

function slash(token) {
  return normalize(token, { pathNormalization: "SLASH_DOT_SEGMENTS" });
}

function backslash(token) {
  return normalize(token, { pathNormalization: "BACKSLASH_DOT_SEGMENTS" });
}

function mixed(token) {
  return normalize(token, { pathNormalization: "SLASH_AND_BACKSLASH_DOT_SEGMENTS" });
}

function main() {
  const mandatory = {
    "TN-01": normalize("./Foo ", { whitespace: "PRESERVED", caseSensitivity: "CASE_SENSITIVE", pathNormalization: "NONE" }),
    "TN-02": normalize("./Foo ", { whitespace: "TRIM_SURROUNDING", caseSensitivity: "CASE_SENSITIVE", pathNormalization: "NONE" }),
    "TN-03": normalize("Foo", { caseSensitivity: "CASE_SENSITIVE", pathNormalization: "NONE" }),
    "TN-04": normalize("Foo", { caseSensitivity: "CASE_INSENSITIVE_ASCII", pathNormalization: "NONE" }),
    "TN-05": normalize("ÉFoo", { caseSensitivity: "CASE_INSENSITIVE_ASCII", pathNormalization: "NONE" }),
    "TN-06": slash("a//b"),
    "TN-07": slash("a//b/"),
    "TN-08": slash("//a///b/"),
    "TN-09": slash("/"),
    "TN-10": slash("//"),
    "TN-11": slash("a//./b"),
    "TN-12": slash("a//../b"),
    "TN-13": slash("a/../"),
    "TN-14": backslash("a\\b\\"),
    "TN-15": backslash("a\\\\b"),
    "TN-16": backslash("a\\..\\b"),
    "TN-17": mixed("a\\b/c"),
    "TN-18": mixed("a\\\\b//c/"),
    "TN-19-NONE": normalize("", { pathNormalization: "NONE" }),
    "TN-19-SLASH": slash(""),
    "TN-19-BACKSLASH": backslash(""),
    "TN-19-MIXED": mixed(""),
    "TN-20": mixed("/\\")
  };

  assert.deepStrictEqual(mandatory, {
    "TN-01": "./Foo ",
    "TN-02": "./Foo",
    "TN-03": "Foo",
    "TN-04": "foo",
    "TN-05": "Éfoo",
    "TN-06": "a/b",
    "TN-07": "a/b",
    "TN-08": "/a/b",
    "TN-09": "/",
    "TN-10": "/",
    "TN-11": "a/b",
    "TN-12": "b",
    "TN-13": "",
    "TN-14": "a\\b",
    "TN-15": "a\\b",
    "TN-16": "b",
    "TN-17": "a/b/c",
    "TN-18": "a/b/c",
    "TN-19-NONE": "",
    "TN-19-SLASH": "",
    "TN-19-BACKSLASH": "",
    "TN-19-MIXED": "",
    "TN-20": "/"
  });

  const adversarial = {
    nfc: normalize("e\u0301", {}),
    internalWhitespace: normalize(" a  b ", { whitespace: "TRIM_SURROUNDING" }),
    leadingDotDot: slash("../a"),
    multipleDotDot: slash("a/b/../../c"),
    dotAtRoot: slash("/../a"),
    mixedSeparators: mixed("\\a//b\\"),
    repeatedSeparators: slash("a////b"),
    trailingSeparators: mixed("a/b\\\\"),
    repeatedA: mixed("A\\B//C/"),
    repeatedB: mixed("A\\B//C/"),
    conceptualPlatformEquivalence: mixed("a\\b/c"),
    nbspPreserved: normalize("\u00a0a\u00a0", { whitespace: "TRIM_SURROUNDING" }),
    emSpacePreserved: normalize("\u2003a\u2003", { whitespace: "TRIM_SURROUNDING" }),
    slashOnlyBackslashIsolation: slash("a\\..\\b"),
    backslashOnlySlashIsolation: backslash("a/../b")
  };

  assert.deepStrictEqual(adversarial, {
    nfc: "é",
    internalWhitespace: "a  b",
    leadingDotDot: "../a",
    multipleDotDot: "c",
    dotAtRoot: "/../a",
    mixedSeparators: "/a/b",
    repeatedSeparators: "a/b",
    trailingSeparators: "a/b",
    repeatedA: "A/B/C",
    repeatedB: "A/B/C",
    conceptualPlatformEquivalence: "a/b/c",
    nbspPreserved: "\u00a0a\u00a0",
    emSpacePreserved: "\u2003a\u2003",
    slashOnlyBackslashIsolation: "a\\..\\b",
    backslashOnlySlashIsolation: "a/../b"
  });

  assertThrowsMessage(() => normalizeTargetToken(null, policy()), /SCHEMA_UNSUPPORTED_FIELD:token/);
  assertThrowsMessage(() => normalizeTargetToken({}, policy()), /SCHEMA_UNSUPPORTED_FIELD:token/);
  assertThrowsMessage(() => normalizeTargetToken("a", null), /SCHEMA_UNSUPPORTED_FIELD:targetNormalizationPolicy/);
  assertThrowsMessage(() => normalizeTargetToken("a", { caseSensitivity: "CASE_SENSITIVE", pathNormalization: "NONE" }), /SCHEMA_UNSUPPORTED_FIELD:whitespace/);
  assertThrowsMessage(() => normalizeTargetToken("a", { whitespace: "PRESERVED", pathNormalization: "NONE" }), /SCHEMA_UNSUPPORTED_FIELD:caseSensitivity/);
  assertThrowsMessage(() => normalizeTargetToken("a", { whitespace: "PRESERVED", caseSensitivity: "CASE_SENSITIVE" }), /SCHEMA_UNSUPPORTED_FIELD:pathNormalization/);
  assertThrowsMessage(() => normalizeTargetToken("a", policy({ whitespace: "COLLAPSE" })), /SCHEMA_UNSUPPORTED_VALUE:whitespace/);
  assertThrowsMessage(() => normalizeTargetToken("a", policy({ caseSensitivity: "UNICODE" })), /SCHEMA_UNSUPPORTED_VALUE:caseSensitivity/);
  assertThrowsMessage(() => normalizeTargetToken("a", policy({ pathNormalization: "HOST_PATH" })), /SCHEMA_UNSUPPORTED_VALUE:pathNormalization/);
  assertThrowsMessage(() => normalizeTargetToken("a", { ...policy(), defaultPath: "." }), /SCHEMA_UNSUPPORTED_FIELD:defaultPath/);

  const source = fs.readFileSync(path.join(repositoryRoot, "scripts", "gt63-machine", "semantic-target-normalization.js"), "utf8");
  assert(!source.includes("localeCompare"), "target normalization must not use localeCompare");
  assert(!source.includes("require(\"path\")"), "target normalization must not import path APIs");
  assert(!source.includes("path."), "target normalization must not use path APIs");
  assert(!source.includes("Date"), "target normalization must not use wall-clock APIs");
  assert(!source.includes("Math.random"), "target normalization must not use randomness");

  runNodeCheck("scripts/gt63-machine/semantic-target-normalization.js");
  runNodeCheck("scripts/gt63-machine-semantic-target-normalization-regression.js");
  assert.strictEqual(fs.existsSync(path.join(repositoryRoot, "canonical.json")), false);
  assert.strictEqual(fs.existsSync(path.join(repositoryRoot, "canonical-review.json")), false);

  const output = {
    status: "PASS",
    workflow: "semantic-evidence-unit-2-target-normalization-regression",
    trace: {
      rulesetVersion: RULESET_VERSION,
      derivationRuleId: "SE-V1-UNIT-2",
      fixtureId: "unit2-target-normalization"
    },
    outputs: {
      mandatory,
      adversarial,
      outputHash: crypto.createHash("sha256").update(JSON.stringify({ mandatory, adversarial })).digest("hex")
    }
  };
  console.log(JSON.stringify(output, null, 2));
}

main();
