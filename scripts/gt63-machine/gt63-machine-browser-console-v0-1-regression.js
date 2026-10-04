"use strict";

const { spawnSync } = require("child_process");
const vm = require("vm");

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const GENERATOR_PATH = "scripts/gt63-machine/gt63-machine-browser-console-v0-1.js";
const TEST_NODE = "C:/bounded/node.exe";

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
    fail("usage: node scripts/gt63-machine/gt63-machine-browser-console-v0-1-regression.js --repo . --main-commit <exact-sha>");
  }
  return Object.freeze({ repo: argv[1], commit: argv[3] });
}

function runGit(repo, args) {
  const allowed =
    (args.length === 3 &&
      args[0] === "cat-file" &&
      args[1] === "-e" &&
      /^[0-9a-f]{40}\^\{commit\}$/.test(args[2])) ||
    (args.length === 4 &&
      args[0] === "ls-tree" &&
      SHA_PATTERN.test(args[1]) &&
      args[2] === "--" &&
      args[3] === GENERATOR_PATH) ||
    (args.length === 3 &&
      args[0] === "cat-file" &&
      args[1] === "blob" &&
      SHA_PATTERN.test(args[2]));
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

function loadGeneratorModule(repo, commit) {
  runGit(repo, ["cat-file", "-e", `${commit}^{commit}`]);
  const treeText = runGit(repo, ["ls-tree", commit, "--", GENERATOR_PATH]).trim();
  const treeMatch = /^(\d+) blob ([0-9a-f]{40})\t(.+)$/.exec(treeText);
  if (!treeMatch || treeMatch[3] !== GENERATOR_PATH) {
    fail("required generator blob identity is unavailable");
  }
  const generatorBlob = treeMatch[2];
  const source = runGit(repo, ["cat-file", "blob", generatorBlob]);
  const moduleRecord = { exports: {} };
  function boundedRequire(identifier) {
    if (identifier === "child_process") {
      return Object.freeze({
        spawnSync() {
          fail("unmocked subprocess execution is forbidden in regression cases");
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
  return Object.freeze({
    source,
    api: moduleRecord.exports,
    loadEvidence: Object.freeze({ path: GENERATOR_PATH, blob: generatorBlob, reader: "cat-file blob" })
  });
}

function renderConsoleOutput(commit, overrides = {}) {
  const tree = overrides.tree || "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const subject = overrides.subject || "fixture <script>alert(\"x\") & 'z'</script>";
  const repository = overrides.repository || [
    "scope: MAIN",
    "scopeLabel: PINNED MAIN EVIDENCE SCOPE",
    "repositoryRoot: C:/fixture/repository",
    `commit: ${commit}`,
    "parents: cccccccccccccccccccccccccccccccccccccccc",
    `tree: ${tree}`,
    "commitDate: 2026-10-04T12:00:00+03:00",
    `commitSubject: ${subject}`,
    "remoteCurrentness: NOT_ASSESSED",
    "STATUS: UNKNOWN",
    "reason: CURRENT_REMOTE_STATE_NOT_ASSESSED",
    "source: remote refs",
    "authorityEffect: NONE"
  ];
  const sections = overrides.sections || [
    ["Repository Identity", repository],
    [
      "Provider-Free Owner",
      [
        "IMPLEMENTATION AUTHORIZED: PROVIDER-FREE ONLY",
        "PROVIDER-FREE IMPLEMENTATION CANDIDATE: ACCEPTED",
        "literalAmpersand: A&B",
        "PRINCIPAL ELIGIBILITY: NOT REACHED / NOT ASSESSED",
        "CONCRETE AUTHORITATIVE GATE QUERY: ABSENT",
        "BINDING #1: PROVEN / CLOSED / UNCHANGED",
        "MACHINE AUTHORITY: NONE",
        "authorityEffect: NONE"
      ]
    ],
    [
      "Latest Checkpoints",
      [
        "scope: MAIN",
        "path: docs/gt63-machine/FIXTURE_CHECKPOINT.md",
        "commit: dddddddddddddddddddddddddddddddddddddddd",
        "blob: eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        "commitDate: 2026-10-04T11:00:00+03:00",
        "classification: ACCEPTED_CHECKPOINT"
      ]
    ],
    [
      "Governance State",
      [
        "BROWSER CONSOLE V0.1 DESIGN PLAN: ACCEPTED",
        "BROWSER CONSOLE V0.1 IMPLEMENTATION: NOT AUTHORIZED",
        "MACHINE AUTHORITY: NONE",
        "authorityEffect: NONE"
      ]
    ],
    [
      "Blocked Frontiers",
      [
        "- runtime wiring;",
        "- real eligibility execution;",
        "- any authority-bearing behavior.",
        "candidateScope: EXCLUDED",
        "scope: CANDIDATE_REFERENCE_ONLY",
        "mainFact: false",
        "commit: ffffffffffffffffffffffffffffffffffffffff",
        "contentInspected: false"
      ]
    ],
    [
      "Next Bounded Action",
      [
        "classification: NON-AUTHORITATIVE RECOMMENDATION",
        "recommendation: Separate human authorization is required before Browser Console V0.1 coding.",
        "authorityEffect: NONE"
      ]
    ],
    [
      "Not Authorized",
      [
        "NO WORKFLOW EXECUTION",
        "NO ELIGIBILITY EXECUTION",
        "NO GATE ACTION",
        "NO OFFER MUTATION",
        "NO RUNTIME / DB / RAILWAY / LOGIN ACTION",
        "MACHINE AUTHORITY: NONE",
        "authorityEffect: NONE"
      ]
    ]
  ];
  return [
    "GT63 MACHINE CONSOLE V0",
    "PINNED MAIN EVIDENCE SCOPE",
    "",
    ...sections.flatMap(([name, lines]) => [`=== ${name} ===`, ...lines, ""])
  ].join("\n");
}

function createSpawn(resultFactory) {
  const calls = [];
  return Object.freeze({
    calls,
    spawn(command, args, options) {
      calls.push(Object.freeze({ command, args: args.slice(), options: { ...options } }));
      return resultFactory(command, args, options);
    }
  });
}

function normalChild(stdout) {
  return Object.freeze({ status: 0, stdout, stderr: "", error: undefined });
}

function execute(api, commit, spawn, argv) {
  return api.executeBrowserConsoleV01({
    argv: argv || ["--repo", ".", "--main-commit", commit],
    spawn,
    nodeExecutable: TEST_NODE
  });
}

function mutateSections(commit, operation) {
  const names = [
    "Repository Identity",
    "Provider-Free Owner",
    "Latest Checkpoints",
    "Governance State",
    "Blocked Frontiers",
    "Next Bounded Action",
    "Not Authorized"
  ];
  const original = renderConsoleOutput(commit);
  const blocks = new Map();
  for (let index = 0; index < names.length; index += 1) {
    const header = `=== ${names[index]} ===`;
    const start = original.indexOf(header);
    const next = index + 1 < names.length ? original.indexOf(`=== ${names[index + 1]} ===`) : original.length;
    blocks.set(names[index], original.slice(start, next).trimEnd());
  }
  const ordered = operation(names.slice(), blocks);
  return ["GT63 MACHINE CONSOLE V0", "PINNED MAIN EVIDENCE SCOPE", "", ...ordered].join("\n\n");
}

function runRegression(source, api, loadEvidence) {
  const results = [];
  function test(name, operation) {
    try {
      operation();
      results.push(Object.freeze({ name, passed: true, error: "" }));
    } catch (error) {
      results.push(Object.freeze({
        name,
        passed: false,
        error: error && error.message ? error.message : String(error)
      }));
    }
  }

  const commit = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const stdout = renderConsoleOutput(commit);
  const firstSpawn = createSpawn(() => normalChild(stdout));
  const secondSpawn = createSpawn(() => normalChild(stdout));
  const first = execute(api, commit, firstSpawn.spawn);
  const second = execute(api, commit, secondSpawn.spawn);

  test("generator source loads through exact Git blob identity", () => {
    assert(loadEvidence.path === GENERATOR_PATH, "unexpected generator path");
    assert(SHA_PATTERN.test(loadEvidence.blob), "invalid generator blob identity");
    assert(loadEvidence.reader === "cat-file blob", "generator was not loaded by exact blob");
  });
  test("bounded normal output exits zero", () => assert(first.exitCode === 0, "expected exit 0"));
  test("normal output is deterministic", () => assert(first.html === second.html, "HTML drift"));
  test("diagnostics remain empty on success", () => assert(first.diagnostic === "", "unexpected diagnostic"));
  test("subprocess invocation is exact and shell free", () => {
    assert(firstSpawn.calls.length === 1, "unexpected subprocess call count");
    const call = firstSpawn.calls[0];
    assert(call.command === TEST_NODE, "unexpected executable");
    assert(
      JSON.stringify(call.args) === JSON.stringify([
        api.CONSOLE_PATH,
        "--repo",
        ".",
        "--main-commit",
        commit
      ]),
      "unexpected subprocess arguments"
    );
    assert(call.options.cwd === ".", "unexpected subprocess cwd");
    assert(call.options.shell === false, "shell must be false");
    assert(call.options.encoding === "utf8", "encoding must be utf8");
  });
  test("normal dashboard renders exactly seven evidence sections", () => {
    const count = (first.html.match(/<section class="panel /g) || []).length;
    assert(count === 7, `unexpected section count: ${count}`);
    for (const name of api.SECTION_NAMES) {
      assert(first.html.includes(`>${name}</h2>`), `missing section: ${name}`);
    }
  });
  test("pinned commit and tree render", () => {
    assert(first.html.includes(commit), "commit missing");
    assert(first.html.includes("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"), "tree missing");
  });
  test("UNKNOWN remains explicit", () => {
    assert(first.html.includes("STATUS: UNKNOWN"), "UNKNOWN missing");
    assert(first.html.includes("CURRENT_REMOTE_STATE_NOT_ASSESSED"), "UNKNOWN reason missing");
  });
  test("candidate reference remains separately rendered", () => {
    assert(first.html.includes('class="candidate-reference"'), "candidate container missing");
    assert(first.html.includes("scope: CANDIDATE_REFERENCE_ONLY"), "candidate scope missing");
    assert(first.html.includes("mainFact: false"), "candidate mainFact missing");
    assert(first.html.includes("contentInspected: false"), "candidate inspection boundary missing");
  });
  test("permanent boundary remains visible", () => {
    assert(first.html.includes("permanent-boundary"), "permanent boundary class missing");
    for (const line of api.PERMANENT_BOUNDARY) {
      assert(first.html.includes(line), `missing boundary line: ${line}`);
    }
  });
  test("CLI values are escaped exactly once", () => {
    assert(
      first.html.includes("fixture &lt;script&gt;alert(&quot;x&quot;) &amp; &#39;z&#39;&lt;/script&gt;"),
      "script-like value was not escaped"
    );
    assert(first.html.includes("literalAmpersand: A&amp;B"), "ampersand was not escaped");
    assert(!first.html.includes("literalAmpersand: A&amp;amp;B"), "ampersand was double escaped");
  });
  test("normal dashboard contains restrictive CSP", () => {
    assert(first.html.includes("default-src 'none'"), "default CSP missing");
    assert(first.html.includes("connect-src 'none'"), "connect CSP missing");
    assert(first.html.includes("form-action 'none'"), "form CSP missing");
  });
  test("normal dashboard contains no client JavaScript or controls", () => {
    assert(!/<script(?:\s|>)/i.test(first.html), "script element found");
    assert(!/<form(?:\s|>)/i.test(first.html), "form element found");
    assert(!/<button(?:\s|>)/i.test(first.html), "button element found");
    assert(!/<input(?:\s|>)/i.test(first.html), "input element found");
    assert(!/\son[a-z]+=/i.test(first.html), "event handler found");
  });
  test("normal dashboard contains no external resource URL", () => {
    assert(!/https?:\/\//i.test(first.html), "network URL found");
    assert(!/<link(?:\s|>)/i.test(first.html), "external link element found");
    assert(!/<iframe(?:\s|>)/i.test(first.html), "iframe found");
  });
  test("invalid arguments hard stop before subprocess", () => {
    const state = createSpawn(() => fail("subprocess must not run"));
    const result = execute(api, commit, state.spawn, []);
    assert(result.exitCode === 2, "invalid arguments did not hard stop");
    assert(result.html.includes("reason: INVALID_GENERATOR_ARGUMENTS"), "wrong argument reason");
    assert(state.calls.length === 0, "subprocess ran for invalid arguments");
  });
  test("Console V0 hard stop is preserved without partial dashboard", () => {
    const hardStop = [
      "HARD STOP",
      "reason: CHECKPOINT_CONTENT_UNAVAILABLE",
      "no further state rendered",
      "MACHINE AUTHORITY: NONE",
      "authorityEffect: NONE",
      ""
    ].join("\n");
    const state = createSpawn(() => Object.freeze({ status: 2, stdout: hardStop, stderr: "" }));
    const result = execute(api, commit, state.spawn);
    assert(result.exitCode === 2, "HARD STOP exit was not preserved");
    assert(result.html.includes("reason: CHECKPOINT_CONTENT_UNAVAILABLE"), "reason missing");
    assert(!result.html.includes("Repository Identity"), "partial dashboard rendered");
  });
  test("malformed Console V0 hard stop is rejected", () => {
    const state = createSpawn(() => Object.freeze({ status: 2, stdout: "HARD STOP\n", stderr: "" }));
    const result = execute(api, commit, state.spawn);
    assert(result.exitCode === 2, "malformed hard stop did not exit 2");
    assert(result.html.includes("reason: CONSOLE_V0_HARD_STOP_INVALID"), "wrong malformed reason");
  });
  test("unexpected subprocess exit is rejected", () => {
    const state = createSpawn(() => Object.freeze({ status: 1, stdout: "", stderr: "usage" }));
    const result = execute(api, commit, state.spawn);
    assert(result.exitCode === 2, "unexpected exit did not hard stop");
    assert(result.html.includes("reason: CONSOLE_V0_EXIT_CODE_INVALID"), "wrong exit reason");
  });
  test("subprocess execution error is rejected", () => {
    const state = createSpawn(() => Object.freeze({ status: null, stdout: "", stderr: "", error: new Error("x") }));
    const result = execute(api, commit, state.spawn);
    assert(result.exitCode === 2, "execution error did not hard stop");
    assert(result.html.includes("reason: CONSOLE_V0_EXECUTION_FAILED"), "wrong execution reason");
  });
  test("stderr on normal exit is rejected", () => {
    const state = createSpawn(() => Object.freeze({ status: 0, stdout, stderr: "unexpected" }));
    const result = execute(api, commit, state.spawn);
    assert(result.exitCode === 2, "stderr did not hard stop");
    assert(result.html.includes("reason: CONSOLE_V0_STDERR_NOT_EMPTY"), "wrong stderr reason");
  });
  test("missing section is rejected", () => {
    const changed = mutateSections(commit, (names, blocks) => names.slice(0, -1).map((name) => blocks.get(name)));
    const result = execute(api, commit, createSpawn(() => normalChild(changed)).spawn);
    assert(result.exitCode === 2, "missing section was accepted");
  });
  test("duplicate section is rejected", () => {
    const changed = mutateSections(commit, (names, blocks) => [
      blocks.get(names[0]),
      blocks.get(names[0]),
      ...names.slice(1).map((name) => blocks.get(name))
    ]);
    const result = execute(api, commit, createSpawn(() => normalChild(changed)).spawn);
    assert(result.exitCode === 2, "duplicate section was accepted");
  });
  test("unexpected section is rejected", () => {
    const changed = `${stdout}\n=== Operator Controls ===\nexecute: true\n`;
    const result = execute(api, commit, createSpawn(() => normalChild(changed)).spawn);
    assert(result.exitCode === 2, "unexpected section was accepted");
  });
  test("section reordering is rejected", () => {
    const changed = mutateSections(commit, (names, blocks) => {
      const swapped = names.slice();
      [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
      return swapped.map((name) => blocks.get(name));
    });
    const result = execute(api, commit, createSpawn(() => normalChild(changed)).spawn);
    assert(result.exitCode === 2, "reordered sections were accepted");
  });
  test("pinned commit mismatch is rejected", () => {
    const changed = stdout.replace(`commit: ${commit}`, "commit: ffffffffffffffffffffffffffffffffffffffff");
    const result = execute(api, commit, createSpawn(() => normalChild(changed)).spawn);
    assert(result.exitCode === 2, "commit mismatch was accepted");
  });
  test("malformed tree is rejected", () => {
    const changed = stdout.replace(
      "tree: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "tree: not-a-tree"
    );
    const result = execute(api, commit, createSpawn(() => normalChild(changed)).spawn);
    assert(result.exitCode === 2, "malformed tree was accepted");
  });
  test("permanent boundary mutation is rejected", () => {
    const changed = stdout.replace("NO OFFER MUTATION", "OFFER MUTATION AVAILABLE");
    const result = execute(api, commit, createSpawn(() => normalChild(changed)).spawn);
    assert(result.exitCode === 2, "boundary mutation was accepted");
  });
  test("candidate scope leakage is rejected", () => {
    const changed = stdout.replace(
      "=== Governance State ===",
      "=== Governance State ===\nscope: CANDIDATE_REFERENCE_ONLY"
    );
    const result = execute(api, commit, createSpawn(() => normalChild(changed)).spawn);
    assert(result.exitCode === 2, "candidate leakage was accepted");
  });
  test("generator source imports only child_process", () => {
    const imports = [...source.matchAll(/require\((['"])([^'"]+)\1\)/g)].map((match) => match[2]);
    assert(imports.length === 1 && imports[0] === "child_process", `unexpected imports: ${imports}`);
  });
  test("generator source contains no filesystem repository read", () => {
    assert(!/require\((['"])fs\1\)/.test(source), "filesystem import found");
    assert(!/\breadFile(?:Sync)?\b/.test(source), "filesystem read found");
  });
  test("generator source contains no direct Git invocation", () => {
    assert(!/spawnSync\(\s*['"]git['"]/.test(source), "direct Git invocation found");
    assert(!/spawn\(\s*['"]git['"]/.test(source), "direct Git spawn found");
  });
  test("generator source contains no snapshot write", () => {
    assert(!/\bwriteFile(?:Sync)?\b/.test(source), "snapshot write found");
    assert(!/\bmkdir(?:Sync)?\b/.test(source), "directory creation found");
  });
  test("generator source contains no server or network import", () => {
    const forbidden = ["http", "https", "net", "tls", "express", "ws"];
    for (const identifier of forbidden) {
      assert(!source.includes(`require(\"${identifier}\")`), `forbidden import: ${identifier}`);
      assert(!source.includes(`require('${identifier}')`), `forbidden import: ${identifier}`);
    }
  });
  test("hard stop preserves non-authority", () => {
    const result = execute(api, commit, createSpawn(() => Object.freeze({ status: 1, stdout: "", stderr: "" })).spawn);
    assert(result.html.includes("MACHINE AUTHORITY: NONE"), "MACHINE boundary missing");
    assert(result.html.includes("authorityEffect: NONE"), "authority effect missing");
  });

  return results;
}

function main() {
  const parsed = parseArguments(process.argv.slice(2));
  const loaded = loadGeneratorModule(parsed.repo, parsed.commit);
  const results = runRegression(loaded.source, loaded.api, loaded.loadEvidence);
  const failures = results.filter((result) => !result.passed);
  for (const result of results) {
    process.stdout.write(`${result.passed ? "PASS" : "FAIL"} ${result.name}`);
    if (!result.passed) {
      process.stdout.write(`: ${result.error}`);
    }
    process.stdout.write("\n");
  }
  process.stdout.write(`${failures.length === 0 ? "PASS" : "FAIL"} ${results.length - failures.length}/${results.length}\n`);
  process.exitCode = failures.length === 0 ? 0 : 1;
}

if (require.main === module) {
  main();
}
