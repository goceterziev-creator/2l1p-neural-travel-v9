"use strict";

const { spawnSync } = require("child_process");
const vm = require("vm");

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const CLI_PATH = "scripts/gt63-machine/gt63-machine-console-v0.js";

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function parseArguments(argv) {
  if (
    !Array.isArray(argv) ||
    argv.length !== 4 ||
    argv[0] !== "--repo" ||
    typeof argv[1] !== "string" ||
    argv[1].length === 0 ||
    argv[1].includes("\u0000") ||
    argv[2] !== "--main-commit" ||
    !SHA_PATTERN.test(argv[3])
  ) {
    fail("usage: node scripts/gt63-machine/gt63-machine-console-v0-regression.js --repo . --main-commit <exact-sha>");
  }
  return Object.freeze({ repo: argv[1], commit: argv[3] });
}

function runGit(repo, args) {
  const allowed =
    (args.length === 3 &&
      args[0] === "cat-file" &&
      args[1] === "-e" &&
      /^[0-9a-f]{40}\^\{commit\}$/.test(args[2])) ||
    (args.length === 2 &&
      args[0] === "show" &&
      args[1].startsWith(`${args[1].slice(0, 40)}:`) &&
      SHA_PATTERN.test(args[1].slice(0, 40)) &&
      args[1].slice(41) === CLI_PATH);

  if (!allowed) {
    fail("UNSAFE_GIT_OPERATION_REQUESTED");
  }

  const result = spawnSync("git", args, {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true
  });
  if (result.status !== 0 || result.error) {
    fail("required exact Git object is unavailable");
  }
  return result.stdout;
}

function loadConsoleModule(repo, commit) {
  runGit(repo, ["cat-file", "-e", `${commit}^{commit}`]);
  const source = runGit(repo, ["show", `${commit}:${CLI_PATH}`]);
  const moduleRecord = { exports: {} };
  function boundedRequire(identifier) {
    if (identifier === "child_process") {
      return Object.freeze({
        spawnSync() {
          fail("real Git execution is forbidden inside synthetic regression cases");
        }
      });
    }
    fail(`unexpected import: ${identifier}`);
  }
  boundedRequire.main = null;
  const wrapper = vm.runInNewContext(
    `(function(require, module, exports) {\n${source}\n})`,
    Object.create(null),
    { timeout: 1000 }
  );
  wrapper(boundedRequire, moduleRecord, moduleRecord.exports);
  return Object.freeze({ source, api: moduleRecord.exports });
}

function makeFixture(api, overrides = {}) {
  const commit = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const parent = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const tree = "cccccccccccccccccccccccccccccccccccccccc";
  const paths = api.CHECKPOINTS;

  const designContent = overrides.designContent || [
    "# Design",
    "",
    `Candidate reference ${api.CANDIDATE_REFERENCE}`,
    "",
    "## Preserved Final States",
    "",
    "MACHINE CONSOLE V0 DESIGN CHECKLIST: ACCEPTED",
    "",
    "MACHINE CONSOLE V0 IMPLEMENTATION: NOT AUTHORIZED",
    "",
    "MACHINE AUTHORITY: NONE",
    "",
    "authorityEffect: NONE",
    ""
  ].join("\n");

  const planContent = overrides.planContent || [
    "# Plan",
    "",
    "## Preserved Final States",
    "",
    "MACHINE CONSOLE V0 IMPLEMENTATION PLAN: ACCEPTED",
    "",
    "MACHINE CONSOLE V0 IMPLEMENTATION: NOT AUTHORIZED",
    "",
    "MACHINE AUTHORITY: NONE",
    "",
    "authorityEffect: NONE",
    ""
  ].join("\n");

  const ownerContent = overrides.ownerContent || [
    "# Owner",
    "",
    "## Remaining Deferred Frontiers",
    "",
    "- authoritative production Gate source;",
    "- trusted production snapshot provider;",
    "",
    "## Preserved Governance States",
    "",
    "IMPLEMENTATION AUTHORIZED: PROVIDER-FREE ONLY",
    "",
    "PROVIDER-FREE IMPLEMENTATION CANDIDATE: ACCEPTED",
    "",
    "PRINCIPAL ELIGIBILITY: NOT REACHED / NOT ASSESSED",
    "",
    "CONCRETE AUTHORITATIVE GATE QUERY: ABSENT",
    "",
    "BINDING #1: PROVEN / CLOSED / UNCHANGED",
    "",
    "MACHINE AUTHORITY: NONE",
    "",
    "authorityEffect: NONE",
    ""
  ].join("\n");

  const content = new Map([
    [paths.design.path, designContent],
    [paths.plan.path, planContent],
    [paths.owner.path, ownerContent]
  ]);
  const blobs = new Map([
    [paths.design.path, overrides.designBlob || paths.design.blob],
    [paths.plan.path, paths.plan.blob],
    [paths.owner.path, paths.owner.blob]
  ]);
  if (overrides.missingOwner) {
    content.delete(paths.owner.path);
    blobs.delete(paths.owner.path);
  }

  const stalePointer = "docs/gt63-machine/GT63_LATEST_CONTINUITY_POINTER.md";
  const docs = [...content.keys(), stalePointer];

  return Object.freeze({
    commit,
    argv: ["--repo", ".", "--main-commit", commit],
    git: Object.freeze({
      root() {
        return "/fixture/repository";
      },
      ensureCommit(value) {
        assert(value === commit, "unexpected fixture commit");
      },
      metadata(value) {
        assert(value === commit, "unexpected metadata commit");
        return Object.freeze({
          commit,
          parents: [parent],
          tree,
          date: "2026-10-04T12:00:00+03:00",
          subject: "fixture main"
        });
      },
      listDocs(value) {
        assert(value === commit, "unexpected docs commit");
        return docs.slice();
      },
      treeEntry(value, path) {
        assert(value === commit, "unexpected tree commit");
        if (path === stalePointer) {
          return Object.freeze({
            mode: "100644",
            type: "blob",
            blob: "dddddddddddddddddddddddddddddddddddddddd",
            path
          });
        }
        const blob = blobs.get(path);
        return blob
          ? Object.freeze({ mode: "100644", type: "blob", blob, path })
          : null;
      },
      showPath(value, path) {
        assert(value === commit, "unexpected show commit");
        const result = content.get(path);
        assert(typeof result === "string", `unexpected show path: ${path}`);
        return result;
      },
      logPath(value, path) {
        assert(value === commit, "unexpected log commit");
        assert(content.has(path), `unexpected log path: ${path}`);
        const order = path === paths.plan.path ? "03" : path === paths.design.path ? "02" : "01";
        return Object.freeze({
          commit: `${order}${"e".repeat(38)}`,
          date: `2026-10-04T${order}:00:00+03:00`,
          subject: `fixture checkpoint ${order}`
        });
      }
    })
  });
}

function runRegression(source, api) {
  const results = [];
  function test(name, operation) {
    try {
      operation();
      results.push(Object.freeze({ name, passed: true, error: null }));
    } catch (error) {
      results.push(
        Object.freeze({
          name,
          passed: false,
          error: error && error.message ? error.message : String(error)
        })
      );
    }
  }

  const fixture = makeFixture(api);
  const first = api.executeConsoleV0({ argv: fixture.argv, git: fixture.git });
  const second = api.executeConsoleV0({ argv: fixture.argv, git: fixture.git });

  test("bounded output exits zero", () => assert(first.exitCode === 0, "expected exit code 0"));
  test("output is deterministic", () => assert(first.output === second.output, "output drift"));
  test("exactly seven sections render", () => {
    const headings = first.output.match(/^=== .* ===$/gm) || [];
    assert(headings.length === 7, `expected 7 sections, got ${headings.length}`);
    assert(
      headings.join("\n") === api.SECTION_NAMES.map((name) => `=== ${name} ===`).join("\n"),
      "section order mismatch"
    );
  });
  test("pinned main scope renders", () =>
    assert(first.output.includes("PINNED MAIN EVIDENCE SCOPE"), "missing pinned scope")
  );
  test("remote currentness remains unassessed", () =>
    assert(
      first.output.includes("reason: CURRENT_REMOTE_STATE_NOT_ASSESSED"),
      "remote currentness was not preserved as unknown"
    )
  );
  test("provider-free state renders", () =>
    assert(
      first.output.includes("PROVIDER-FREE IMPLEMENTATION CANDIDATE: ACCEPTED"),
      "missing provider-free state"
    )
  );
  test("governance state renders", () =>
    assert(
      first.output.includes("MACHINE CONSOLE V0 IMPLEMENTATION PLAN: ACCEPTED"),
      "missing plan acceptance"
    )
  );
  test("candidate remains reference only", () => {
    assert(first.output.includes("scope: CANDIDATE_REFERENCE_ONLY"), "missing candidate scope");
    assert(first.output.includes("mainFact: false"), "candidate became a main fact");
    assert(first.output.includes("contentInspected: false"), "candidate content was not excluded");
  });
  test("stale continuity pointer does not drive latest state", () =>
    assert(!first.output.includes("GT63_LATEST_CONTINUITY_POINTER.md"), "stale pointer rendered")
  );
  test("permanent boundary renders", () => {
    assert(first.output.includes("NO WORKFLOW EXECUTION"), "missing workflow boundary");
    assert(first.output.includes("NO ELIGIBILITY EXECUTION"), "missing eligibility boundary");
    assert(first.output.includes("NO GATE ACTION"), "missing Gate boundary");
    assert(first.output.includes("NO OFFER MUTATION"), "missing offer boundary");
  });

  test("missing optional checkpoint renders unknown with exit zero", () => {
    const unknownFixture = makeFixture(api, { missingOwner: true });
    const result = api.executeConsoleV0({ argv: unknownFixture.argv, git: unknownFixture.git });
    assert(result.exitCode === 0, "UNKNOWN must exit 0");
    assert(result.output.includes("STATUS: UNKNOWN"), "UNKNOWN was not rendered");
    assert(result.output.includes("reason: CHECKPOINT_NOT_PRESENT"), "missing reason code");
  });

  test("invalid commit identity hard stops with exit two", () => {
    const result = api.executeConsoleV0({
      argv: ["--repo", ".", "--main-commit", "not-a-sha"],
      git: fixture.git
    });
    assert(result.exitCode === 2, "HARD STOP must exit 2");
    assert(result.output.startsWith("HARD STOP\n"), "HARD STOP was not rendered");
    assert(result.output.includes("reason: INVALID_COMMIT_IDENTITY"), "wrong reason code");
  });

  test("checkpoint blob mismatch hard stops", () => {
    const mismatch = makeFixture(api, {
      designBlob: "ffffffffffffffffffffffffffffffffffffffff"
    });
    const result = api.executeConsoleV0({ argv: mismatch.argv, git: mismatch.git });
    assert(result.exitCode === 2, "blob mismatch did not hard stop");
    assert(result.output.includes("reason: CHECKPOINT_BLOB_MISMATCH"), "wrong blob reason");
  });

  test("duplicate authoritative label hard stops", () => {
    const duplicateDesign = [
      "# Design",
      "## Preserved Final States",
      "MACHINE CONSOLE V0 DESIGN CHECKLIST: ACCEPTED",
      "MACHINE CONSOLE V0 DESIGN CHECKLIST: ACCEPTED",
      "MACHINE CONSOLE V0 IMPLEMENTATION: NOT AUTHORIZED",
      "MACHINE AUTHORITY: NONE",
      "authorityEffect: NONE"
    ].join("\n");
    const duplicate = makeFixture(api, { designContent: duplicateDesign });
    const result = api.executeConsoleV0({ argv: duplicate.argv, git: duplicate.git });
    assert(result.exitCode === 2, "duplicate label did not hard stop");
    assert(
      result.output.includes("reason: DUPLICATE_AUTHORITATIVE_LABELS"),
      "wrong duplicate reason"
    );
  });

  test("conflicting authoritative label hard stops", () => {
    const conflictingDesign = [
      "# Design",
      "## Preserved Final States",
      "MACHINE CONSOLE V0 DESIGN CHECKLIST: ACCEPTED",
      "MACHINE CONSOLE V0 IMPLEMENTATION: AUTHORIZED",
      "MACHINE AUTHORITY: NONE",
      "authorityEffect: NONE"
    ].join("\n");
    const conflict = makeFixture(api, { designContent: conflictingDesign });
    const result = api.executeConsoleV0({ argv: conflict.argv, git: conflict.git });
    assert(result.exitCode === 2, "conflicting label did not hard stop");
    assert(
      result.output.includes("reason: CONFLICTING_AUTHORITATIVE_LABELS"),
      "wrong conflict reason"
    );
  });

  test("primary source imports only child_process", () => {
    const imports = [...source.matchAll(/require\((['"])([^'"]+)\1\)/g)].map((match) => match[2]);
    assert(imports.length === 1 && imports[0] === "child_process", `unexpected imports: ${imports}`);
  });
  test("primary source has no filesystem evidence import", () =>
    assert(!/require\((['"])fs\1\)/.test(source), "filesystem import found")
  );
  test("primary source has no remote discovery operation", () =>
    assert(!/["']ls-remote["']/.test(source), "remote discovery operation found")
  );
  test("primary source has no mutating Git operation", () => {
    const forbidden = [
      "fetch",
      "pull",
      "push",
      "add",
      "commit",
      "checkout",
      "switch",
      "branch",
      "worktree",
      "update-ref",
      "reset",
      "clean",
      "merge",
      "rebase",
      "cherry-pick",
      "apply",
      "am"
    ];
    for (const operation of forbidden) {
      assert(!source.includes(`["${operation}"`), `forbidden Git operation found: ${operation}`);
    }
  });
  test("hard stop preserves non-authority", () => {
    const result = api.executeConsoleV0({ argv: [], git: fixture.git });
    assert(result.output.includes("MACHINE AUTHORITY: NONE"), "missing MACHINE boundary");
    assert(result.output.includes("authorityEffect: NONE"), "missing authorityEffect boundary");
  });

  return results;
}

function main() {
  const parsed = parseArguments(process.argv.slice(2));
  const loaded = loadConsoleModule(parsed.repo, parsed.commit);
  const results = runRegression(loaded.source, loaded.api);
  const failures = results.filter((result) => !result.passed);
  for (const result of results) {
    process.stdout.write(`${result.passed ? "PASS" : "FAIL"} ${result.name}`);
    if (!result.passed) {
      process.stdout.write(` :: ${result.error}`);
    }
    process.stdout.write("\n");
  }
  process.stdout.write(`${failures.length === 0 ? "PASS" : "FAIL"} ${results.length - failures.length}/${results.length}\n`);
  process.exitCode = failures.length === 0 ? 0 : 1;
}

if (require.main === module) {
  main();
}
