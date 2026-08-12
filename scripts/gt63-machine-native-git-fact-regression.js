"use strict";

const assert = require("assert");
const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const scanner = require("./gt63-machine/repository-scanner");

const RULESET_VERSION = "semantic-evidence-v1.0.1";
const FORBIDDEN_GIT_SUBCOMMANDS = new Set([
  "add",
  "commit",
  "checkout",
  "switch",
  "reset",
  "clean",
  "restore",
  "stash",
  "merge",
  "rebase",
  "cherry-pick",
  "revert",
  "tag",
  "push",
  "pull",
  "fetch",
  "update-ref"
]);

function runGit(repositoryRoot, args) {
  return childProcess.execFileSync("git", ["-C", repositoryRoot, ...args], {
    encoding: "utf8",
    env: {
      GIT_AUTHOR_NAME: "GT63 Fixture",
      GIT_AUTHOR_EMAIL: "gt63@example.invalid",
      GIT_AUTHOR_DATE: "2020-01-01T00:00:00Z",
      GIT_COMMITTER_NAME: "GT63 Fixture",
      GIT_COMMITTER_EMAIL: "gt63@example.invalid",
      GIT_COMMITTER_DATE: "2020-01-01T00:00:00Z",
      GIT_CONFIG_NOSYSTEM: "1",
      PATH: process.env.PATH
    },
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function writeFixtureFile(repositoryRoot, name, content) {
  fs.writeFileSync(path.join(repositoryRoot, name), content);
}

function commit(repositoryRoot, name, content) {
  writeFixtureFile(repositoryRoot, "fixture.txt", content);
  runGit(repositoryRoot, ["add", "fixture.txt"]);
  runGit(repositoryRoot, ["commit", "-m", name]);
  return runGit(repositoryRoot, ["rev-parse", "HEAD"]);
}

function makeRepository() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gt63-native-git-"));
  runGit(root, ["init", "--initial-branch=main"]);
  const a = commit(root, "A", "A\n");
  const b = commit(root, "B", "B\n");
  const c = commit(root, "C", "C\n");
  runGit(root, ["checkout", "-b", "branch-d", b]);
  const d = commit(root, "D", "D\n");
  runGit(root, ["checkout", "main"]);
  return { root, a, b, c, d };
}

function makeDisconnectedRepository() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gt63-native-git-disconnected-"));
  runGit(root, ["init", "--initial-branch=main"]);
  const a = commit(root, "A", "A\n");
  runGit(root, ["checkout", "--orphan", "other"]);
  fs.rmSync(path.join(root, "fixture.txt"), { force: true });
  const z = commit(root, "Z", "Z\n");
  return { root, a, z };
}

function makeShallowRepository(sourceRoot) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gt63-native-git-shallow-"));
  fs.rmSync(root, { recursive: true, force: true });
  childProcess.execFileSync("git", ["clone", "--depth", "1", `file://${sourceRoot.replace(/\\/gu, "/")}`, root], {
    encoding: "utf8",
    env: {
      GIT_CONFIG_NOSYSTEM: "1",
      PATH: process.env.PATH
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  return root;
}

function request(leftCommit, rightCommit, repositoryScopeId = "scope:fixture") {
  return {
    rulesetVersion: RULESET_VERSION,
    repositoryScopeId,
    leftCommit,
    rightCommit
  };
}

function inspect(repositoryRoot, leftCommit, rightCommit, repositoryScopeId) {
  return scanner.inspectNativeGitFacts(repositoryRoot, request(leftCommit, rightCommit, repositoryScopeId));
}

function withFailingGitInspection(shouldFail, action) {
  const originalExecFileSync = childProcess.execFileSync;
  childProcess.execFileSync = (command, args, options) => {
    if (command === "git" && Array.isArray(args) && args[0] === "-C" && shouldFail(args.slice(2))) {
      const error = new Error("forced native Git inspection failure");
      error.status = 128;
      error.stdout = "";
      error.stderr = "forced failure";
      throw error;
    }
    return originalExecFileSync(command, args, options);
  };
  try {
    return action();
  } finally {
    childProcess.execFileSync = originalExecFileSync;
  }
}

function assertThrowsMessage(fn, pattern) {
  assert.throws(fn, (error) => pattern.test(error.message));
}

function forbiddenStructuredGitCommands(source) {
  const matches = [];
  const pattern = /runGit\([^,\n]+,\s*\[\s*"([^"]+)"/gu;
  let match = pattern.exec(source);
  while (match) {
    if (FORBIDDEN_GIT_SUBCOMMANDS.has(match[1])) {
      matches.push(match[1]);
    }
    match = pattern.exec(source);
  }
  return matches;
}

function stripIdentity(record) {
  return {
    historyStatus: record.historyStatus,
    comparisonResult: record.comparisonResult,
    repositoryScopeId: record.repositoryScopeId,
    hasRelationType: Object.prototype.hasOwnProperty.call(record, "relationType"),
    hasHistoricalRelations: Object.prototype.hasOwnProperty.call(record, "historicalRelations"),
    hasRelationStatus: Object.prototype.hasOwnProperty.call(record, "relationStatus"),
    hasAuthority: Object.prototype.hasOwnProperty.call(record, "authority")
  };
}

function buildRecords(fixtures) {
  return {
    nonGit: scanner.inspectNativeGitFacts(os.tmpdir(), request(fixtures.a, fixtures.b)),
    same: inspect(fixtures.root, fixtures.a, fixtures.a),
    ancestor: inspect(fixtures.root, fixtures.a, fixtures.b),
    descendant: inspect(fixtures.root, fixtures.b, fixtures.a),
    diverged: inspect(fixtures.root, fixtures.c, fixtures.d),
    reversed: inspect(fixtures.root, fixtures.b, fixtures.a),
    invalidLeft: inspect(fixtures.root, "not-a-commit", fixtures.b),
    invalidRight: inspect(fixtures.root, fixtures.a, "not-a-commit"),
    sameName: inspect(fixtures.root, "same-name.js", "same-name.js"),
    callerScope: inspect(fixtures.root, fixtures.a, fixtures.b, "scope:caller"),
    pathScope: inspect(fixtures.root, fixtures.a, fixtures.b, "scope:not-path-derived"),
    shallowNegative: inspect(fixtures.shallowRoot, fixtures.a, fixtures.b),
    shallowPositive: inspect(fixtures.shallowRoot, fixtures.c, fixtures.c),
    unreadable: scanner.inspectNativeGitFacts(path.join(fixtures.root, "missing"), request(fixtures.a, fixtures.b)),
    pathSpelling: inspect(path.resolve(fixtures.root), fixtures.a, fixtures.b),
    disconnected: inspect(fixtures.disconnectedRoot, fixtures.a2, fixtures.z),
    leftInspectionFailure: withFailingGitInspection((args) => {
      return args[0] === "merge-base" && args[1] === "--is-ancestor" && args[2] === fixtures.a && args[3] === fixtures.b;
    }, () => inspect(fixtures.root, fixtures.a, fixtures.b)),
    rightInspectionFailure: withFailingGitInspection((args) => {
      return args[0] === "merge-base" && args[1] === "--is-ancestor" && args[2] === fixtures.a && args[3] === fixtures.b;
    }, () => inspect(fixtures.root, fixtures.b, fixtures.a)),
    commonAncestorInspectionFailure: withFailingGitInspection((args) => {
      return args[0] === "merge-base" && args.length === 3;
    }, () => inspect(fixtures.root, fixtures.c, fixtures.d)),
    ignoredExecutorOption: scanner.inspectNativeGitFacts(fixtures.root, request(fixtures.a, fixtures.b), {
      gitExecutor: () => {
        throw new Error("public executor seam must not be reachable");
      }
    })
  };
}

function runTraceability(fixtures, records) {
  const cases = [
    ["NG-01", () => assert.strictEqual(scanner.RULESET_VERSION, RULESET_VERSION)],
    ["NG-02", () => assertThrowsMessage(() => scanner.inspectNativeGitFacts(fixtures.root, { repositoryScopeId: "scope:x", leftCommit: fixtures.a, rightCommit: fixtures.b }), /SCHEMA_UNSUPPORTED_FIELD:rulesetVersion/)],
    ["NG-03", () => assertThrowsMessage(() => scanner.inspectNativeGitFacts(fixtures.root, { ...request(fixtures.a, fixtures.b), rulesetVersion: "semantic-evidence-v1.0.0" }), /SCHEMA_UNSUPPORTED_VALUE:rulesetVersion/)],
    ["NG-04", () => assertThrowsMessage(() => scanner.inspectNativeGitFacts(fixtures.root, { ...request(fixtures.a, fixtures.b), rulesetVersion: "semantic-evidence-v1.0.2" }), /SCHEMA_UNSUPPORTED_VALUE:rulesetVersion/)],
    ["NG-05", () => assert.strictEqual(records.nonGit.comparisonResult, "UNKNOWN")],
    ["NG-06", () => assert.strictEqual(records.same.comparisonResult, "SAME_COMMIT")],
    ["NG-07", () => assert.strictEqual(records.ancestor.comparisonResult, "GIT_ANCESTOR_OF")],
    ["NG-08", () => assert.strictEqual(records.descendant.comparisonResult, "GIT_DESCENDANT_OF")],
    ["NG-09", () => assert.strictEqual(records.diverged.comparisonResult, "DIVERGED_FROM_COMMON_ANCESTOR")],
    ["NG-10", () => assert.notStrictEqual(records.ancestor.comparisonResult, records.reversed.comparisonResult)],
    ["NG-11", () => assert.strictEqual(records.invalidLeft.comparisonResult, "UNKNOWN")],
    ["NG-12", () => assert.strictEqual(records.invalidRight.comparisonResult, "UNKNOWN")],
    ["NG-13", () => assert.strictEqual(records.sameName.comparisonResult, "UNKNOWN")],
    ["NG-14", () => assert.strictEqual(records.descendant.comparisonResult, "GIT_DESCENDANT_OF")],
    ["NG-15", () => assert.strictEqual(records.callerScope.repositoryScopeId, "scope:caller")],
    ["NG-16", () => assert.strictEqual(records.pathScope.repositoryScopeId, "scope:not-path-derived")],
    ["NG-17", () => assert.strictEqual(records.shallowNegative.comparisonResult, "UNKNOWN")],
    ["NG-18", () => assert.strictEqual(records.shallowPositive.comparisonResult, "SAME_COMMIT")],
    ["NG-19", () => assert.strictEqual(records.unreadable.comparisonResult, "UNKNOWN")],
    ["NG-20", () => assert.strictEqual(Object.prototype.hasOwnProperty.call(records.ancestor, "relationType"), false)],
    ["NG-21", () => assert.strictEqual(Object.prototype.hasOwnProperty.call(records.ancestor, "historicalRelations"), false)],
    ["NG-22", () => assert.strictEqual(Object.prototype.hasOwnProperty.call(records.ancestor, "relationStatus"), false)],
    ["NG-23", () => assert.strictEqual(Object.prototype.hasOwnProperty.call(records.ancestor, "authority"), false)],
    ["NG-24", () => assert.deepStrictEqual(records.ancestor, inspect(fixtures.root, fixtures.a, fixtures.b))],
    ["NG-25", () => assert.strictEqual(records.pathSpelling.comparisonResult, records.ancestor.comparisonResult)],
    ["NG-26", () => assert.deepStrictEqual(records.ancestor, inspect(fixtures.root, fixtures.a, fixtures.b))],
    ["NG-27", () => {
      const source = fs.readFileSync(path.join(__dirname, "gt63-machine", "repository-scanner.js"), "utf8");
      assert.deepStrictEqual(forbiddenStructuredGitCommands(source), []);
      assert(!/git\s+(add|commit|checkout|switch|reset|clean|restore|stash|merge|rebase|cherry-pick|revert|tag|push|pull|fetch)|writeFile|appendFile|unlink|rename|mkdir/u.test(source));
    }],
    ["NG-28", () => {
      const result = scanner.scanRepository(fixtures.root, { includeExtensions: [".txt"], ignoreDirectories: [".git"], maxFiles: 10, maxFileBytes: 1000 });
      assert.strictEqual(result.scan.filesScanned >= 1, true);
      assert(Array.isArray(result.files));
    }],
    ["NG-29", () => {
      assert.strictEqual(records.leftInspectionFailure.comparisonResult, "UNKNOWN");
    }],
    ["NG-30", () => {
      assert.strictEqual(records.rightInspectionFailure.comparisonResult, "UNKNOWN");
    }],
    ["NG-31", () => {
      assert.strictEqual(records.commonAncestorInspectionFailure.comparisonResult, "UNKNOWN");
    }],
    ["NG-32", () => {
      assert.strictEqual(records.ignoredExecutorOption.comparisonResult, "GIT_ANCESTOR_OF");
    }],
    ["NG-33", () => {
      assert.deepStrictEqual(Object.keys(scanner).sort(), ["RULESET_VERSION", "inspectNativeGitFacts", "scanRepository"]);
    }]
  ];

  const expected = Array.from({ length: 33 }, (_, index) => `NG-${String(index + 1).padStart(2, "0")}`);
  assert.deepStrictEqual(cases.map(([id]) => id), expected);
  return cases.map(([id, test]) => {
    test();
    return { id, status: "PASS" };
  });
}

function runMutations(fixtures, records) {
  const same = records.same;
  const ancestor = records.ancestor;
  const descendant = records.descendant;
  const diverged = records.diverged;
  const disconnected = records.disconnected;
  const invalid = records.invalidLeft;
  const shallowNegative = records.shallowNegative;
  const output = records.ancestor;
  return {
    "NG-M-01": same.comparisonResult === "SAME_COMMIT",
    "NG-M-02": ancestor.comparisonResult === "GIT_ANCESTOR_OF" && descendant.comparisonResult === "GIT_DESCENDANT_OF",
    "NG-M-03": disconnected.comparisonResult === "NO_ANCESTRY_IN_INSPECTED_REPOSITORY",
    "NG-M-04": shallowNegative.comparisonResult === "UNKNOWN",
    "NG-M-05": invalid.comparisonResult === "UNKNOWN",
    "NG-M-06": descendant.comparisonResult !== "GIT_ANCESTOR_OF",
    "NG-M-07": records.sameName.comparisonResult === "UNKNOWN",
    "NG-M-08": Boolean(diverged.nativeEvidence.commonAncestorCommit) && diverged.comparisonResult === "DIVERGED_FROM_COMMON_ANCESTOR",
    "NG-M-09": output.repositoryScopeId === "scope:fixture",
    "NG-M-10": shallowNegative.historyStatus === "PARTIAL_NATIVE_HISTORY",
    "NG-M-11": (() => { try { scanner.inspectNativeGitFacts(fixtures.root, { ...request(fixtures.a, fixtures.b), rulesetVersion: "semantic-evidence-v1.0.0" }); return false; } catch { return true; } })(),
    "NG-M-12": (() => { try { scanner.inspectNativeGitFacts(fixtures.root, { ...request(fixtures.a, fixtures.b), rulesetVersion: "semantic-evidence-v1.0.2" }); return false; } catch { return true; } })(),
    "NG-M-13": !Object.prototype.hasOwnProperty.call(output, "relationType"),
    "NG-M-14": !Object.prototype.hasOwnProperty.call(output, "semanticState") && !Object.prototype.hasOwnProperty.call(output, "historicalRelations"),
    "NG-M-15": (() => {
      const source = fs.readFileSync(path.join(__dirname, "gt63-machine", "repository-scanner.js"), "utf8");
      const mutated = `${source}\nfunction __mutation(repositoryRoot) { return runGit(repositoryRoot, [\"add\", \".\"]); }\n`;
      return forbiddenStructuredGitCommands(source).length === 0 &&
        forbiddenStructuredGitCommands(mutated).includes("add");
    })(),
    "NG-M-16": (() => {
      const source = fs.readFileSync(path.join(__dirname, "gt63-machine", "repository-scanner.js"), "utf8");
      const mutated = `${source}\nfunction __mutation(repositoryRoot) { return runGit(repositoryRoot, [\"checkout\", \"main\"]); }\n`;
      return forbiddenStructuredGitCommands(mutated).includes("checkout");
    })(),
    "NG-M-17": records.leftInspectionFailure.comparisonResult === "UNKNOWN" &&
      records.leftInspectionFailure.comparisonResult !== "NO_ANCESTRY_IN_INSPECTED_REPOSITORY",
    "NG-M-18": records.rightInspectionFailure.comparisonResult === "UNKNOWN" &&
      records.rightInspectionFailure.comparisonResult !== "NO_ANCESTRY_IN_INSPECTED_REPOSITORY",
    "NG-M-19": records.commonAncestorInspectionFailure.comparisonResult === "UNKNOWN" &&
      records.commonAncestorInspectionFailure.comparisonResult !== "NO_ANCESTRY_IN_INSPECTED_REPOSITORY",
    "NG-M-20": (() => {
      const source = fs.readFileSync(path.join(__dirname, "gt63-machine", "repository-scanner.js"), "utf8");
      const mutated = source.replace(
        "function inspectNativeGitFacts(repositoryRoot, request) {",
        "function inspectNativeGitFacts(repositoryRoot, request, options) { const gitExecutor = options && options.gitExecutor; void gitExecutor;"
      );
      return !/inspectNativeGitFacts\s*\([^)]*options/u.test(source) &&
        /options\s*&&\s*options\.gitExecutor/u.test(mutated);
    })(),
    "NG-M-21": (() => {
      const exportedNames = Object.keys(scanner);
      const forbiddenExport = /^(gitExecutor|runGit|defaultGitExecutor|setGitExecutor|configureGitExecutor|inspectNativeGitFactsWithExecutor)$/u;
      const mutatedExports = [...exportedNames, "setGitExecutor"];
      return exportedNames.every((name) => !forbiddenExport.test(name)) &&
        mutatedExports.some((name) => forbiddenExport.test(name));
    })()
  };
}

function main() {
  const cleanup = [];
  try {
    const repository = makeRepository();
    cleanup.push(repository.root);
    const disconnected = makeDisconnectedRepository();
    cleanup.push(disconnected.root);
    const shallowRoot = makeShallowRepository(repository.root);
    cleanup.push(shallowRoot);
    const fixtures = {
      ...repository,
      shallowRoot,
      disconnectedRoot: disconnected.root,
      a2: disconnected.a,
      z: disconnected.z
    };

    const records = buildRecords(fixtures);
    const ngResults = runTraceability(fixtures, records);
    const mutations = runMutations(fixtures, records);
    for (const [id, passed] of Object.entries(mutations)) {
      assert.strictEqual(passed, true, `${id} failed`);
    }

    const sample = records.ancestor;
    const output = {
      status: "PASS",
      workflow: "native-git-fact-capture-regression",
      rulesetVersion: RULESET_VERSION,
      traceability: {
        count: ngResults.length,
        first: ngResults[0].id,
        last: ngResults[ngResults.length - 1].id,
        results: ngResults
      },
      mutationDetection: mutations,
      sample: stripIdentity(sample),
      outputHash: crypto.createHash("sha256").update(JSON.stringify({ ngResults, mutations, sample: stripIdentity(sample) })).digest("hex")
    };
    console.log(JSON.stringify(output, null, 2));
  } finally {
    for (const directory of cleanup.reverse()) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
}

main();
