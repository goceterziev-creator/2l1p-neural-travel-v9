"use strict";

const { spawnSync } = require("child_process");

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const SAFE_PATH_PATTERN = /^[A-Za-z0-9_./-]+$/;
const DOCS_ROOT = "docs/gt63-machine";

const CHECKPOINTS = Object.freeze({
  design: Object.freeze({
    path: `${DOCS_ROOT}/GT63_MACHINE_CONSOLE_V0_DESIGN_CHECKLIST_ACCEPTED_CHECKPOINT_2026-10-04.md`,
    blob: "3b7c725493bb6fb71233147845215d74694cdefc",
    section: "## Preserved Final States",
    acceptedMarker: "MACHINE CONSOLE V0 DESIGN CHECKLIST: ACCEPTED"
  }),
  plan: Object.freeze({
    path: `${DOCS_ROOT}/GT63_MACHINE_CONSOLE_V0_IMPLEMENTATION_PLAN_ACCEPTED_CHECKPOINT_2026-10-04.md`,
    blob: "2d4ac887090648dba78fc195610596c089c68a6b",
    section: "## Preserved Final States",
    acceptedMarker: "MACHINE CONSOLE V0 IMPLEMENTATION PLAN: ACCEPTED"
  }),
  owner: Object.freeze({
    path: `${DOCS_ROOT}/GT63_AYA_TRUSTED_ELIGIBILITY_QUERY_OWNER_V0_PROVIDER_FREE_IMPLEMENTATION_CANDIDATE_ACCEPTED_CHECKPOINT_2026-10-04.md`,
    blob: "0e1e334a9d23e42d7928a9c4c52c27e7a438b4b3",
    section: "## Preserved Governance States",
    acceptedMarker: "PROVIDER-FREE IMPLEMENTATION CANDIDATE: ACCEPTED"
  })
});

const CANDIDATE_REFERENCE = "7f655b71101eacc4dc6b826b456f5ab9b5419ffb";

const OWNER_LABELS = Object.freeze([
  "IMPLEMENTATION AUTHORIZED: PROVIDER-FREE ONLY",
  "PROVIDER-FREE IMPLEMENTATION CANDIDATE: ACCEPTED",
  "PRINCIPAL ELIGIBILITY: NOT REACHED / NOT ASSESSED",
  "CONCRETE AUTHORITATIVE GATE QUERY: ABSENT",
  "BINDING #1: PROVEN / CLOSED / UNCHANGED",
  "MACHINE AUTHORITY: NONE",
  "authorityEffect: NONE"
]);

const DESIGN_LABELS = Object.freeze([
  "MACHINE CONSOLE V0 DESIGN CHECKLIST: ACCEPTED",
  "MACHINE CONSOLE V0 IMPLEMENTATION: NOT AUTHORIZED",
  "MACHINE AUTHORITY: NONE",
  "authorityEffect: NONE"
]);

const PLAN_LABELS = Object.freeze([
  "MACHINE CONSOLE V0 IMPLEMENTATION PLAN: ACCEPTED",
  "MACHINE CONSOLE V0 IMPLEMENTATION: NOT AUTHORIZED",
  "MACHINE AUTHORITY: NONE",
  "authorityEffect: NONE"
]);

const SECTION_NAMES = Object.freeze([
  "Repository Identity",
  "Provider-Free Owner",
  "Latest Checkpoints",
  "Governance State",
  "Blocked Frontiers",
  "Next Bounded Action",
  "Not Authorized"
]);

class HardStopError extends Error {
  constructor(reason) {
    super(reason);
    this.name = "HardStopError";
    this.reason = reason;
  }
}

function isSafePath(value) {
  return (
    typeof value === "string" &&
    value.startsWith(`${DOCS_ROOT}/`) &&
    !value.includes("..") &&
    SAFE_PATH_PATTERN.test(value)
  );
}

function isAllowedGitArguments(args) {
  if (!Array.isArray(args) || args.some((value) => typeof value !== "string")) {
    return false;
  }

  if (args.length === 2 && args[0] === "rev-parse" && args[1] === "--show-toplevel") {
    return true;
  }

  if (
    args.length === 3 &&
    args[0] === "cat-file" &&
    args[1] === "-e" &&
    /^[0-9a-f]{40}\^\{commit\}$/.test(args[2])
  ) {
    return true;
  }

  if (
    args.length === 4 &&
    args[0] === "show" &&
    args[1] === "-s" &&
    args[2] === "--format=%H%x00%P%x00%T%x00%cI%x00%s" &&
    SHA_PATTERN.test(args[3])
  ) {
    return true;
  }

  if (
    args.length === 4 &&
    args[0] === "ls-tree" &&
    SHA_PATTERN.test(args[1]) &&
    args[2] === "--" &&
    isSafePath(args[3])
  ) {
    return true;
  }

  if (
    args.length === 6 &&
    args[0] === "ls-tree" &&
    args[1] === "-r" &&
    args[2] === "--name-only" &&
    SHA_PATTERN.test(args[3]) &&
    args[4] === "--" &&
    args[5] === DOCS_ROOT
  ) {
    return true;
  }

  if (args.length === 2 && args[0] === "show") {
    const separator = args[1].indexOf(":");
    if (separator === 40) {
      const commit = args[1].slice(0, separator);
      const path = args[1].slice(separator + 1);
      return SHA_PATTERN.test(commit) && isSafePath(path);
    }
  }

  if (
    args.length === 6 &&
    args[0] === "log" &&
    args[1] === "-1" &&
    args[2] === "--format=%H%x00%cI%x00%s" &&
    SHA_PATTERN.test(args[3]) &&
    args[4] === "--" &&
    isSafePath(args[5])
  ) {
    return true;
  }

  return false;
}

function createGitReader(repo) {
  function invoke(args) {
    if (!isAllowedGitArguments(args)) {
      throw new HardStopError("UNSAFE_GIT_OPERATION_REQUESTED");
    }

    const result = spawnSync("git", args, {
      cwd: repo,
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true
    });

    return Object.freeze({
      ok: result.status === 0 && !result.error,
      status: result.status,
      stdout: typeof result.stdout === "string" ? result.stdout : "",
      stderr: typeof result.stderr === "string" ? result.stderr : ""
    });
  }

  return Object.freeze({
    root() {
      const result = invoke(["rev-parse", "--show-toplevel"]);
      if (!result.ok || result.stdout.trim().length === 0) {
        throw new HardStopError("UNALLOWLISTED_DATA_SOURCE");
      }
      return result.stdout.trim();
    },

    ensureCommit(commit) {
      const result = invoke(["cat-file", "-e", `${commit}^{commit}`]);
      if (!result.ok) {
        throw new HardStopError("COMMIT_OBJECT_TYPE_MISMATCH");
      }
    },

    metadata(commit) {
      const result = invoke([
        "show",
        "-s",
        "--format=%H%x00%P%x00%T%x00%cI%x00%s",
        commit
      ]);
      if (!result.ok) {
        throw new HardStopError("COMMIT_OBJECT_TYPE_MISMATCH");
      }
      const fields = result.stdout.trimEnd().split("\u0000");
      const parents = fields.length === 5 && fields[1].length > 0 ? fields[1].split(" ") : [];
      if (
        fields.length !== 5 ||
        !SHA_PATTERN.test(fields[0]) ||
        !SHA_PATTERN.test(fields[2]) ||
        parents.some((value) => !SHA_PATTERN.test(value))
      ) {
        throw new HardStopError("INVALID_COMMIT_IDENTITY");
      }
      return Object.freeze({
        commit: fields[0],
        parents,
        tree: fields[2],
        date: fields[3],
        subject: fields[4]
      });
    },

    listDocs(commit) {
      const result = invoke(["ls-tree", "-r", "--name-only", commit, "--", DOCS_ROOT]);
      if (!result.ok) {
        throw new HardStopError("UNALLOWLISTED_DATA_SOURCE");
      }
      return result.stdout
        .split(/\r?\n/)
        .filter((value) => value.length > 0)
        .map((value) => {
          if (!isSafePath(value)) {
            throw new HardStopError("UNALLOWLISTED_DATA_SOURCE");
          }
          return value;
        });
    },

    treeEntry(commit, path) {
      if (!isSafePath(path)) {
        throw new HardStopError("UNALLOWLISTED_DATA_SOURCE");
      }
      const result = invoke(["ls-tree", commit, "--", path]);
      if (!result.ok) {
        throw new HardStopError("UNALLOWLISTED_DATA_SOURCE");
      }
      const text = result.stdout.trim();
      if (text.length === 0) {
        return null;
      }
      const match = /^(\d+) (blob|tree) ([0-9a-f]{40})\t(.+)$/.exec(text);
      if (!match || match[4] !== path || match[2] !== "blob") {
        throw new HardStopError("CHECKPOINT_BLOB_MISMATCH");
      }
      return Object.freeze({ mode: match[1], type: match[2], blob: match[3], path: match[4] });
    },

    showPath(commit, path) {
      if (!isSafePath(path)) {
        throw new HardStopError("UNALLOWLISTED_DATA_SOURCE");
      }
      const result = invoke(["show", `${commit}:${path}`]);
      if (!result.ok) {
        throw new HardStopError("CHECKPOINT_BLOB_MISMATCH");
      }
      return result.stdout;
    },

    logPath(commit, path) {
      if (!isSafePath(path)) {
        throw new HardStopError("UNALLOWLISTED_DATA_SOURCE");
      }
      const result = invoke([
        "log",
        "-1",
        "--format=%H%x00%cI%x00%s",
        commit,
        "--",
        path
      ]);
      if (!result.ok) {
        throw new HardStopError("UNALLOWLISTED_DATA_SOURCE");
      }
      const fields = result.stdout.trimEnd().split("\u0000");
      if (fields.length !== 3 || !SHA_PATTERN.test(fields[0])) {
        throw new HardStopError("INVALID_COMMIT_IDENTITY");
      }
      return Object.freeze({ commit: fields[0], date: fields[1], subject: fields[2] });
    }
  });
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
    throw new HardStopError("INVALID_COMMIT_IDENTITY");
  }

  return Object.freeze({ repo: argv[1], commit: argv[3] });
}

function extractSection(content, heading) {
  const lines = content.split(/\r?\n/);
  const positions = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index] === heading) {
      positions.push(index);
    }
  }

  if (positions.length > 1) {
    throw new HardStopError("DUPLICATE_AUTHORITATIVE_LABELS");
  }
  if (positions.length === 0) {
    return null;
  }

  const start = positions[0] + 1;
  let end = lines.length;
  for (let index = start; index < lines.length; index += 1) {
    if (lines[index].startsWith("## ")) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end);
}

function readExpectedLabels(sectionLines, expectedLabels) {
  const values = new Map();
  for (const expected of expectedLabels) {
    if (!sectionLines) {
      values.set(expected, null);
      continue;
    }
    const separator = expected.indexOf(":");
    const key = separator === -1 ? expected : expected.slice(0, separator + 1);
    const matchingKey = sectionLines.filter((line) => line.startsWith(key));
    if (matchingKey.length > 1) {
      throw new HardStopError("DUPLICATE_AUTHORITATIVE_LABELS");
    }
    if (matchingKey.length === 1 && matchingKey[0] !== expected) {
      throw new HardStopError("CONFLICTING_AUTHORITATIVE_LABELS");
    }
    values.set(expected, matchingKey.length === 1 ? expected : null);
  }
  return values;
}

function readCheckpoint(git, commit, descriptor) {
  const entry = git.treeEntry(commit, descriptor.path);
  if (!entry) {
    return Object.freeze({ descriptor, present: false, entry: null, content: null, section: null });
  }
  if (entry.blob !== descriptor.blob) {
    throw new HardStopError("CHECKPOINT_BLOB_MISMATCH");
  }
  const content = git.showPath(commit, descriptor.path);
  const section = extractSection(content, descriptor.section);
  return Object.freeze({ descriptor, present: true, entry, content, section });
}

function unknownLines(reason, source) {
  return [
    "STATUS: UNKNOWN",
    `reason: ${reason}`,
    `source: ${source}`,
    "authorityEffect: NONE"
  ];
}

function appendLabels(lines, labels, values, source) {
  for (const label of labels) {
    if (values.get(label)) {
      lines.push(label);
    } else {
      lines.push(...unknownLines("LABEL_NOT_PRESENT", `${source} :: ${label}`));
    }
  }
}

function checkpointClassification(path, checkpointState, checkpointValues) {
  const state = checkpointState.get(path);
  if (!state || !state.present) {
    return "OBJECT_PRESENT_ONLY";
  }
  const values = checkpointValues.get(path);
  return values && values.get(state.descriptor.acceptedMarker)
    ? "ACCEPTED_CHECKPOINT"
    : "CHECKPOINT_IDENTITY_VALID_LABEL_UNKNOWN";
}

function buildLatestCheckpoints(git, commit, docs, checkpointState, checkpointValues) {
  const paths = docs.filter((path) => /CHECKPOINT.*\.md$/.test(path));
  const entries = paths.map((path) => {
    const treeEntry = git.treeEntry(commit, path);
    if (!treeEntry) {
      throw new HardStopError("CHECKPOINT_BLOB_MISMATCH");
    }
    const log = git.logPath(commit, path);
    return Object.freeze({
      scope: "MAIN",
      path,
      commit: log.commit,
      blob: treeEntry.blob,
      date: log.date,
      classification: checkpointClassification(path, checkpointState, checkpointValues)
    });
  });

  entries.sort((left, right) => {
    if (left.date !== right.date) {
      return left.date < right.date ? 1 : -1;
    }
    return left.path < right.path ? -1 : left.path > right.path ? 1 : 0;
  });
  return entries;
}

function renderConsole(git, commit) {
  const root = git.root();
  git.ensureCommit(commit);
  const metadata = git.metadata(commit);
  if (metadata.commit !== commit || !SHA_PATTERN.test(metadata.tree)) {
    throw new HardStopError("INVALID_COMMIT_IDENTITY");
  }

  const docs = git.listDocs(commit);
  const design = readCheckpoint(git, commit, CHECKPOINTS.design);
  const plan = readCheckpoint(git, commit, CHECKPOINTS.plan);
  const owner = readCheckpoint(git, commit, CHECKPOINTS.owner);

  const designValues = readExpectedLabels(design.section, DESIGN_LABELS);
  const planValues = readExpectedLabels(plan.section, PLAN_LABELS);
  const ownerValues = readExpectedLabels(owner.section, OWNER_LABELS);

  const checkpointState = new Map([
    [CHECKPOINTS.design.path, design],
    [CHECKPOINTS.plan.path, plan],
    [CHECKPOINTS.owner.path, owner]
  ]);
  const checkpointValues = new Map([
    [CHECKPOINTS.design.path, designValues],
    [CHECKPOINTS.plan.path, planValues],
    [CHECKPOINTS.owner.path, ownerValues]
  ]);
  const latest = buildLatestCheckpoints(
    git,
    commit,
    docs,
    checkpointState,
    checkpointValues
  );

  const sections = [];

  const repositoryLines = [
    "scope: MAIN",
    "scopeLabel: PINNED MAIN EVIDENCE SCOPE",
    `repositoryRoot: ${root}`,
    `commit: ${metadata.commit}`,
    `parents: ${metadata.parents.length === 0 ? "NONE" : metadata.parents.join(",")}`,
    `tree: ${metadata.tree}`,
    `commitDate: ${metadata.date}`,
    `commitSubject: ${metadata.subject}`,
    "remoteCurrentness: NOT_ASSESSED",
    ...unknownLines("CURRENT_REMOTE_STATE_NOT_ASSESSED", "remote refs")
  ];
  for (const checkpoint of [design, plan, owner]) {
    repositoryLines.push(`checkpointPath: ${checkpoint.descriptor.path}`);
    repositoryLines.push(
      `checkpointBlob: ${checkpoint.present ? checkpoint.entry.blob : "UNKNOWN"}`
    );
  }
  sections.push(Object.freeze({ name: SECTION_NAMES[0], lines: repositoryLines }));

  const ownerLines = [];
  if (!owner.present) {
    ownerLines.push(...unknownLines("CHECKPOINT_NOT_PRESENT", CHECKPOINTS.owner.path));
  } else {
    appendLabels(ownerLines, OWNER_LABELS, ownerValues, CHECKPOINTS.owner.path);
  }
  sections.push(Object.freeze({ name: SECTION_NAMES[1], lines: ownerLines }));

  const latestLines = [];
  if (latest.length === 0) {
    latestLines.push(...unknownLines("CHECKPOINT_NOT_PRESENT", DOCS_ROOT));
  } else {
    for (const entry of latest) {
      latestLines.push(`scope: ${entry.scope}`);
      latestLines.push(`path: ${entry.path}`);
      latestLines.push(`commit: ${entry.commit}`);
      latestLines.push(`blob: ${entry.blob}`);
      latestLines.push(`commitDate: ${entry.date}`);
      latestLines.push(`classification: ${entry.classification}`);
      latestLines.push("");
    }
    if (latestLines[latestLines.length - 1] === "") {
      latestLines.pop();
    }
  }
  sections.push(Object.freeze({ name: SECTION_NAMES[2], lines: latestLines }));

  const governanceLines = [];
  if (!design.present) {
    governanceLines.push(...unknownLines("CHECKPOINT_NOT_PRESENT", CHECKPOINTS.design.path));
  } else {
    appendLabels(governanceLines, DESIGN_LABELS, designValues, CHECKPOINTS.design.path);
  }
  if (!plan.present) {
    governanceLines.push(...unknownLines("CHECKPOINT_NOT_PRESENT", CHECKPOINTS.plan.path));
  } else {
    appendLabels(governanceLines, PLAN_LABELS, planValues, CHECKPOINTS.plan.path);
  }
  sections.push(Object.freeze({ name: SECTION_NAMES[3], lines: governanceLines }));

  const frontierLines = [];
  if (!owner.present) {
    frontierLines.push(...unknownLines("CHECKPOINT_NOT_PRESENT", CHECKPOINTS.owner.path));
  } else {
    const frontierSection = extractSection(owner.content, "## Remaining Deferred Frontiers");
    const frontiers = frontierSection
      ? frontierSection.filter((line) => line.startsWith("- "))
      : [];
    if (frontiers.length === 0) {
      frontierLines.push(
        ...unknownLines("LABEL_NOT_PRESENT", `${CHECKPOINTS.owner.path} :: Remaining Deferred Frontiers`)
      );
    } else {
      frontierLines.push(...frontiers);
    }
  }
  frontierLines.push("candidateScope: EXCLUDED");
  if (design.present && design.content.includes(CANDIDATE_REFERENCE)) {
    frontierLines.push("scope: CANDIDATE_REFERENCE_ONLY");
    frontierLines.push("mainFact: false");
    frontierLines.push(`commit: ${CANDIDATE_REFERENCE}`);
    frontierLines.push("contentInspected: false");
  } else {
    frontierLines.push(...unknownLines("CANDIDATE_SCOPE_EXCLUDED", CANDIDATE_REFERENCE));
  }
  sections.push(Object.freeze({ name: SECTION_NAMES[4], lines: frontierLines }));

  sections.push(
    Object.freeze({
      name: SECTION_NAMES[5],
      lines: [
        "classification: NON-AUTHORITATIVE RECOMMENDATION",
        "recommendation: Separate human authorization is required before Console V0 coding.",
        "authorityEffect: NONE"
      ]
    })
  );

  sections.push(
    Object.freeze({
      name: SECTION_NAMES[6],
      lines: [
        "NO WORKFLOW EXECUTION",
        "NO ELIGIBILITY EXECUTION",
        "NO GATE ACTION",
        "NO OFFER MUTATION",
        "NO RUNTIME / DB / RAILWAY / LOGIN ACTION",
        "MACHINE AUTHORITY: NONE",
        "authorityEffect: NONE"
      ]
    })
  );

  const output = ["GT63 MACHINE CONSOLE V0", "PINNED MAIN EVIDENCE SCOPE"];
  for (const section of sections) {
    output.push("");
    output.push(`=== ${section.name} ===`);
    output.push(...section.lines);
  }
  return output.join("\n");
}

function renderHardStop(reason) {
  return [
    "HARD STOP",
    `reason: ${reason}`,
    "no further state rendered",
    "MACHINE AUTHORITY: NONE",
    "authorityEffect: NONE"
  ].join("\n");
}

function executeConsoleV0({ argv, git } = {}) {
  try {
    const parsed = parseArguments(argv);
    const reader = git || createGitReader(parsed.repo);
    return Object.freeze({ exitCode: 0, output: renderConsole(reader, parsed.commit) });
  } catch (error) {
    const reason = error instanceof HardStopError ? error.reason : "UNALLOWLISTED_DATA_SOURCE";
    return Object.freeze({ exitCode: 2, output: renderHardStop(reason) });
  }
}

module.exports = Object.freeze({
  executeConsoleV0,
  SECTION_NAMES,
  CHECKPOINTS,
  CANDIDATE_REFERENCE
});

if (require.main === module) {
  const result = executeConsoleV0({ argv: process.argv.slice(2) });
  process.stdout.write(`${result.output}\n`);
  process.exitCode = result.exitCode;
}
