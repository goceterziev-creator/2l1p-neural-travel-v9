"use strict";

const { spawnSync } = require("child_process");

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const CONSOLE_PATH = "scripts/gt63-machine/gt63-machine-console-v0.js";
const SECTION_NAMES = Object.freeze([
  "Repository Identity",
  "Provider-Free Owner",
  "Latest Checkpoints",
  "Governance State",
  "Blocked Frontiers",
  "Next Bounded Action",
  "Not Authorized"
]);
const PERMANENT_BOUNDARY = Object.freeze([
  "NO WORKFLOW EXECUTION",
  "NO ELIGIBILITY EXECUTION",
  "NO GATE ACTION",
  "NO OFFER MUTATION",
  "NO RUNTIME / DB / RAILWAY / LOGIN ACTION",
  "MACHINE AUTHORITY: NONE",
  "authorityEffect: NONE"
]);
const CANDIDATE_BOUNDARY = Object.freeze([
  "candidateScope: EXCLUDED",
  "scope: CANDIDATE_REFERENCE_ONLY",
  "mainFact: false",
  "contentInspected: false"
]);

class HardStopError extends Error {
  constructor(reason) {
    super(reason);
    this.name = "HardStopError";
    this.reason = reason;
  }
}

function countExact(lines, expected) {
  return lines.reduce((count, line) => count + (line === expected ? 1 : 0), 0);
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
    throw new HardStopError("INVALID_GENERATOR_ARGUMENTS");
  }
  return Object.freeze({ repo: argv[1], commit: argv[3] });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeOutput(value) {
  if (typeof value !== "string" || value.includes("\u0000")) {
    throw new HardStopError("CONSOLE_V0_STDOUT_INVALID");
  }
  const normalized = value.replace(/\r\n/g, "\n");
  return normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized;
}

function parseConsoleOutput(stdout, requestedCommit) {
  const normalized = normalizeOutput(stdout);
  const lines = normalized.split("\n");
  if (
    lines[0] !== "GT63 MACHINE CONSOLE V0" ||
    lines[1] !== "PINNED MAIN EVIDENCE SCOPE" ||
    lines[2] !== ""
  ) {
    throw new HardStopError("CONSOLE_V0_HEADER_INVALID");
  }
  if (lines.some((line) => line === "HARD STOP")) {
    throw new HardStopError("CONSOLE_V0_SUCCESS_CONTAINS_HARD_STOP");
  }

  const headers = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^=== (.+) ===$/.exec(lines[index]);
    if (match) {
      headers.push(Object.freeze({ index, name: match[1] }));
    }
  }
  if (
    headers.length !== SECTION_NAMES.length ||
    headers.some((entry, index) => entry.name !== SECTION_NAMES[index])
  ) {
    throw new HardStopError("CONSOLE_V0_SECTION_SET_INVALID");
  }

  const sections = new Map();
  for (let index = 0; index < headers.length; index += 1) {
    const start = headers[index].index + 1;
    const end = index + 1 < headers.length ? headers[index + 1].index : lines.length;
    const sectionLines = lines.slice(start, end);
    if (sectionLines.length > 0 && sectionLines[sectionLines.length - 1] === "") {
      sectionLines.pop();
    }
    sections.set(headers[index].name, Object.freeze(sectionLines));
  }

  const repository = sections.get("Repository Identity");
  if (
    countExact(repository, `commit: ${requestedCommit}`) !== 1 ||
    countExact(repository, "scope: MAIN") !== 1 ||
    countExact(repository, "scopeLabel: PINNED MAIN EVIDENCE SCOPE") !== 1 ||
    repository.filter((line) => /^tree: [0-9a-f]{40}$/.test(line)).length !== 1
  ) {
    throw new HardStopError("CONSOLE_V0_REPOSITORY_IDENTITY_INVALID");
  }

  const blocked = sections.get("Blocked Frontiers");
  for (const line of CANDIDATE_BOUNDARY) {
    if (countExact(blocked, line) !== 1) {
      throw new HardStopError("CONSOLE_V0_CANDIDATE_BOUNDARY_INVALID");
    }
    for (const name of SECTION_NAMES.filter((entry) => entry !== "Blocked Frontiers")) {
      if (sections.get(name).includes(line)) {
        throw new HardStopError("CONSOLE_V0_CANDIDATE_SCOPE_LEAK");
      }
    }
  }

  const notAuthorized = sections.get("Not Authorized");
  if (
    notAuthorized.length !== PERMANENT_BOUNDARY.length ||
    PERMANENT_BOUNDARY.some((line, index) => notAuthorized[index] !== line)
  ) {
    throw new HardStopError("CONSOLE_V0_PERMANENT_BOUNDARY_INVALID");
  }

  return Object.freeze({
    normalized,
    sections,
    commit: requestedCommit,
    tree: repository.find((line) => /^tree: [0-9a-f]{40}$/.test(line)).slice(6)
  });
}

function parseHardStop(stdout) {
  const lines = normalizeOutput(stdout).split("\n");
  if (
    lines.length !== 5 ||
    lines[0] !== "HARD STOP" ||
    !/^reason: [A-Z0-9_]+$/.test(lines[1]) ||
    lines[2] !== "no further state rendered" ||
    lines[3] !== "MACHINE AUTHORITY: NONE" ||
    lines[4] !== "authorityEffect: NONE"
  ) {
    throw new HardStopError("CONSOLE_V0_HARD_STOP_INVALID");
  }
  return lines[1].slice("reason: ".length);
}

function lineClass(line) {
  if (line.includes("NOT AUTHORIZED") || line.startsWith("NO ")) {
    return "not-authorized";
  }
  if (line.includes("UNKNOWN") || line.includes("NOT_ASSESSED")) {
    return "unknown";
  }
  if (line.includes("BLOCKED") || line.startsWith("- ")) {
    return "blocked";
  }
  if (line.includes("ACCEPTED")) {
    return "accepted";
  }
  if (line.includes("PASS")) {
    return "pass";
  }
  if (line.endsWith(": NONE") || line === "authorityEffect: NONE") {
    return "none";
  }
  return "evidence";
}

function renderLines(lines) {
  return lines
    .map((line) =>
      line.length === 0
        ? '<div class="evidence-line blank" aria-hidden="true">&nbsp;</div>'
        : `<div class="evidence-line ${lineClass(line)}">${escapeHtml(line)}</div>`
    )
    .join("\n");
}

function valueFor(lines, key) {
  const prefix = `${key}: `;
  const line = lines.find((entry) => entry.startsWith(prefix));
  return line ? line.slice(prefix.length) : "UNKNOWN";
}

function renderPanel(name, lines, extraClass = "") {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return [
    `<section class="panel ${slug} ${extraClass}" aria-labelledby="${slug}-title">`,
    `  <h2 id="${slug}-title">${escapeHtml(name)}</h2>`,
    `  <div class="panel-body">${renderLines(lines)}</div>`,
    "</section>"
  ].join("\n");
}

function renderBlockedPanel(lines) {
  const candidateStart = lines.indexOf("candidateScope: EXCLUDED");
  if (candidateStart < 0) {
    throw new HardStopError("CONSOLE_V0_CANDIDATE_BOUNDARY_INVALID");
  }
  const frontierLines = lines.slice(0, candidateStart);
  const candidateLines = lines.slice(candidateStart);
  return [
    '<section class="panel blocked-frontiers wide" aria-labelledby="blocked-frontiers-title">',
    '  <h2 id="blocked-frontiers-title">Blocked Frontiers</h2>',
    `  <div class="panel-body">${renderLines(frontierLines)}</div>`,
    '  <aside class="candidate-reference" aria-label="Candidate reference only">',
    '    <div class="candidate-label">CANDIDATE REFERENCE ONLY</div>',
    `    <div class="panel-body">${renderLines(candidateLines)}</div>`,
    "  </aside>",
    "</section>"
  ].join("\n");
}

function renderNormalHtml(parsed) {
  const repository = parsed.sections.get("Repository Identity");
  const remoteCurrentness = valueFor(repository, "remoteCurrentness");
  const panels = [
    renderPanel("Repository Identity", repository, "wide"),
    renderPanel("Provider-Free Owner", parsed.sections.get("Provider-Free Owner")),
    renderPanel("Latest Checkpoints", parsed.sections.get("Latest Checkpoints"), "wide ledger"),
    renderPanel("Governance State", parsed.sections.get("Governance State")),
    renderBlockedPanel(parsed.sections.get("Blocked Frontiers")),
    renderPanel("Next Bounded Action", parsed.sections.get("Next Bounded Action"), "wide advisory")
  ].join("\n");
  const boundary = renderPanel(
    "Not Authorized",
    parsed.sections.get("Not Authorized"),
    "wide permanent-boundary"
  );

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'">
  <title>GT63 MACHINE CONSOLE — Evidence Snapshot</title>
  <style>
    :root { color-scheme: dark; --bg: #050712; --panel: rgba(15, 21, 45, .78); --line: rgba(96, 140, 255, .34); --cyan: #5ee7ff; --violet: #ad7cff; --text: #e8edff; --muted: #9aa8ce; --green: #62f5bb; --blue: #69a8ff; --amber: #ffc766; --orange: #ff9c64; --red: #ff5875; --none: #b8acd9; }
    * { box-sizing: border-box; }
    html { background: var(--bg); }
    body { margin: 0; min-height: 100vh; color: var(--text); background: radial-gradient(circle at 50% -10%, rgba(86, 74, 220, .24), transparent 36rem), linear-gradient(180deg, #080b1b 0%, var(--bg) 52%, #09050d 100%); font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
    body::before { content: ""; position: fixed; inset: 0; pointer-events: none; background-image: linear-gradient(rgba(111, 145, 255, .035) 1px, transparent 1px), linear-gradient(90deg, rgba(111, 145, 255, .035) 1px, transparent 1px); background-size: 42px 42px; mask-image: linear-gradient(to bottom, black, transparent 88%); }
    .shell { position: relative; width: min(1440px, calc(100% - 32px)); margin: 0 auto; padding: 48px 0 28px; }
    .identity-core { position: relative; margin: 0 auto 34px; max-width: 760px; padding: 30px; text-align: center; border: 1px solid rgba(113, 151, 255, .55); border-radius: 28px; background: linear-gradient(145deg, rgba(19, 29, 65, .92), rgba(12, 13, 34, .86)); box-shadow: 0 0 70px rgba(65, 99, 255, .18), inset 0 0 34px rgba(117, 85, 255, .08); }
    .identity-core::before, .identity-core::after { content: ""; position: absolute; top: 50%; width: min(22vw, 300px); height: 1px; background: linear-gradient(90deg, transparent, var(--cyan), var(--violet)); opacity: .62; }
    .identity-core::before { right: 100%; transform: rotate(8deg); transform-origin: right; }
    .identity-core::after { left: 100%; transform: rotate(-8deg) scaleX(-1); transform-origin: left; }
    .eyebrow { color: var(--cyan); font-size: .72rem; letter-spacing: .28em; text-transform: uppercase; }
    h1 { margin: 10px 0 4px; font-size: clamp(2rem, 5vw, 4rem); line-height: .95; letter-spacing: -.045em; }
    .subtitle { margin: 9px 0 22px; color: var(--violet); letter-spacing: .2em; font-size: .82rem; }
    .identity-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; text-align: left; }
    .identity-item { padding: 11px 13px; border: 1px solid rgba(114, 145, 255, .2); border-radius: 12px; background: rgba(4, 8, 24, .62); }
    .identity-item span { display: block; color: var(--muted); font-size: .68rem; letter-spacing: .12em; text-transform: uppercase; }
    .identity-item code { display: block; margin-top: 5px; overflow-wrap: anywhere; color: var(--text); font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-size: .78rem; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
    .panel { position: relative; min-width: 0; padding: 22px; overflow: hidden; border: 1px solid var(--line); border-radius: 20px; background: linear-gradient(145deg, rgba(17, 25, 52, .86), var(--panel)); box-shadow: 0 18px 50px rgba(0, 0, 0, .22), inset 0 1px rgba(255, 255, 255, .035); backdrop-filter: blur(18px); }
    .panel::before { content: ""; position: absolute; inset: 0 auto auto 0; width: 72%; height: 1px; background: linear-gradient(90deg, var(--cyan), var(--violet), transparent); opacity: .7; }
    .wide { grid-column: 1 / -1; }
    h2 { margin: 0 0 18px; color: #f5f7ff; font-size: .84rem; letter-spacing: .14em; text-transform: uppercase; }
    .panel-body { min-width: 0; }
    .evidence-line { margin: 5px 0; overflow-wrap: anywhere; color: #ced8f7; font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-size: .78rem; line-height: 1.55; }
    .evidence-line.blank { height: 8px; margin: 0; }
    .evidence-line.accepted, .evidence-line.pass, .evidence-line.unknown, .evidence-line.blocked, .evidence-line.not-authorized, .evidence-line.none { width: fit-content; max-width: 100%; padding: 3px 8px; border-radius: 999px; border: 1px solid currentColor; }
    .evidence-line.accepted { color: var(--green); background: rgba(32, 202, 145, .08); }
    .evidence-line.pass { color: var(--blue); background: rgba(70, 132, 255, .08); }
    .evidence-line.unknown { color: var(--amber); background: rgba(255, 186, 68, .08); }
    .evidence-line.blocked { color: var(--orange); background: rgba(255, 129, 72, .07); }
    .evidence-line.not-authorized { color: var(--red); background: rgba(255, 63, 94, .1); }
    .evidence-line.none { color: var(--none); background: rgba(151, 119, 205, .08); }
    .candidate-reference { margin-top: 22px; padding: 18px; border: 1px dashed rgba(173, 124, 255, .7); border-radius: 16px; background: rgba(78, 45, 130, .1); }
    .candidate-label { margin-bottom: 12px; color: var(--violet); font-size: .69rem; letter-spacing: .16em; }
    .advisory { border-color: rgba(255, 199, 102, .36); }
    .permanent-boundary { margin-top: 18px; border: 1px solid rgba(255, 72, 103, .85); background: linear-gradient(135deg, rgba(79, 9, 26, .92), rgba(35, 8, 22, .96)); box-shadow: 0 0 54px rgba(255, 52, 91, .16), inset 0 0 35px rgba(255, 42, 79, .08); }
    .permanent-boundary::before { height: 2px; width: 100%; background: linear-gradient(90deg, transparent, var(--red), transparent); }
    .permanent-boundary h2 { color: #ff9aac; }
    .footer-note { margin-top: 18px; text-align: center; color: var(--muted); font-size: .7rem; letter-spacing: .12em; text-transform: uppercase; }
    @media (max-width: 820px) { .shell { width: min(100% - 20px, 720px); padding-top: 20px; } .grid { grid-template-columns: 1fr; } .wide { grid-column: auto; } .identity-grid { grid-template-columns: 1fr; } .identity-core::before, .identity-core::after { display: none; } .panel { padding: 17px; border-radius: 16px; } }
  </style>
</head>
<body>
  <main class="shell">
    <header class="identity-core">
      <div class="eyebrow">GT63</div>
      <h1>MACHINE CONSOLE</h1>
      <div class="subtitle">EVIDENCE SNAPSHOT</div>
      <div class="identity-grid">
        <div class="identity-item"><span>Commit</span><code>${escapeHtml(parsed.commit)}</code></div>
        <div class="identity-item"><span>Tree</span><code>${escapeHtml(parsed.tree)}</code></div>
        <div class="identity-item"><span>Scope</span><code>PINNED MAIN EVIDENCE SCOPE</code></div>
        <div class="identity-item"><span>Remote currentness</span><code>${escapeHtml(remoteCurrentness)}</code></div>
        <div class="identity-item"><span>Machine authority</span><code>MACHINE AUTHORITY: NONE</code></div>
        <div class="identity-item"><span>Authority effect</span><code>authorityEffect: NONE</code></div>
      </div>
    </header>
    <div class="grid">
${panels}
    </div>
${boundary}
    <div class="footer-note">Offline · Static HTML · Evidence display only</div>
  </main>
</body>
</html>`;
}

function renderHardStopHtml(reason) {
  const safeReason = escapeHtml(reason);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'">
  <title>GT63 MACHINE CONSOLE — HARD STOP</title>
  <style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#09050a;color:#ffe9ed;font-family:ui-monospace,"Cascadia Mono",Consolas,monospace}.stop{width:min(760px,100%);padding:32px;border:2px solid #ff5875;border-radius:20px;background:linear-gradient(145deg,#390914,#16060d);box-shadow:0 0 70px rgba(255,52,91,.22)}h1{margin:0 0 22px;color:#ff718a;letter-spacing:.08em}.line{margin:9px 0;overflow-wrap:anywhere}.boundary{color:#ff9aad}</style>
</head>
<body>
  <main class="stop">
    <h1>HARD STOP</h1>
    <div class="line">reason: ${safeReason}</div>
    <div class="line">no further state rendered</div>
    <div class="line boundary">MACHINE AUTHORITY: NONE</div>
    <div class="line boundary">authorityEffect: NONE</div>
  </main>
</body>
</html>`;
}

function hardStopResult(reason) {
  return Object.freeze({
    exitCode: 2,
    html: renderHardStopHtml(reason),
    diagnostic: `HARD STOP: ${reason}`
  });
}

function executeBrowserConsoleV01({ argv, spawn = spawnSync, nodeExecutable } = {}) {
  try {
    const parsed = parseArguments(argv);
    const executable = nodeExecutable === undefined ? process.execPath : nodeExecutable;
    if (typeof executable !== "string" || executable.length === 0 || executable.includes("\u0000")) {
      throw new HardStopError("INVALID_NODE_EXECUTABLE");
    }
    const childArguments = [
      CONSOLE_PATH,
      "--repo",
      parsed.repo,
      "--main-commit",
      parsed.commit
    ];
    const result = spawn(executable, childArguments, {
      cwd: parsed.repo,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
      shell: false
    });
    const stdout = result && typeof result.stdout === "string" ? result.stdout : "";
    const stderr = result && typeof result.stderr === "string" ? result.stderr : "";

    if (!result || result.error || !Number.isInteger(result.status)) {
      throw new HardStopError("CONSOLE_V0_EXECUTION_FAILED");
    }
    if (result.status === 2) {
      return hardStopResult(parseHardStop(stdout));
    }
    if (result.status !== 0) {
      throw new HardStopError("CONSOLE_V0_EXIT_CODE_INVALID");
    }
    if (stderr.length !== 0) {
      throw new HardStopError("CONSOLE_V0_STDERR_NOT_EMPTY");
    }
    const consoleOutput = parseConsoleOutput(stdout, parsed.commit);
    return Object.freeze({ exitCode: 0, html: renderNormalHtml(consoleOutput), diagnostic: "" });
  } catch (error) {
    const reason = error instanceof HardStopError ? error.reason : "BROWSER_GENERATOR_FAILURE";
    return hardStopResult(reason);
  }
}

module.exports = Object.freeze({
  executeBrowserConsoleV01,
  parseArguments,
  parseConsoleOutput,
  parseHardStop,
  escapeHtml,
  renderNormalHtml,
  renderHardStopHtml,
  SECTION_NAMES,
  PERMANENT_BOUNDARY,
  CANDIDATE_BOUNDARY,
  CONSOLE_PATH
});

if (require.main === module) {
  const result = executeBrowserConsoleV01({ argv: process.argv.slice(2) });
  process.stdout.write(`${result.html}\n`);
  if (result.diagnostic.length > 0) {
    process.stderr.write(`${result.diagnostic}\n`);
  }
  process.exitCode = result.exitCode;
}
