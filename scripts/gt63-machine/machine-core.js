"use strict";

const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");
const { scanRepository } = require("./repository-scanner");
const { extractEvidence } = require("./evidence-extractor");
const { classifyEvidence } = require("./evidence-classifier");
const { discoverDocuments } = require("./document-discovery");
const { classifyDocuments } = require("./document-classifier");

function normalizePath(absolutePath) {
  return path.resolve(absolutePath).split(path.sep).join("/");
}

function readGitMetadata(repositoryRoot) {
  try {
    const gitRoot = childProcess.execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    const branch = childProcess.execFileSync("git", ["branch", "--show-current"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    const head = childProcess.execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();

    if (path.resolve(gitRoot) !== path.resolve(repositoryRoot)) {
      return {
        gitStatus: "NOT_AVAILABLE",
        branch: null,
        head: null
      };
    }

    return {
      gitStatus: "AVAILABLE",
      branch: branch || null,
      head: head || null
    };
  } catch (error) {
    return {
      gitStatus: "NOT_AVAILABLE",
      branch: null,
      head: null
    };
  }
}

function failurePayload(workflow, code, message) {
  return {
    status: "FAIL",
    workflow: workflow || null,
    repository: null,
    scan: null,
    evidence: [],
    classifications: {
      documentation: 0,
      runtimeCode: 0,
      testScript: 0,
      configuration: 0,
      unknown: 0
    },
    logs: [],
    failures: [
      {
        code,
        message
      }
    ]
  };
}

function executeWorkflow(config, input, workspaceRoot) {
  const workflow = input && input.workflow;
  const configuredPath = input && input.repositoryPath;

  if (!configuredPath || typeof configuredPath !== "string") {
    return failurePayload(workflow, "INPUT_PATH_INVALID", "Input repositoryPath must be a string.");
  }

  const repositoryRoot = path.resolve(workspaceRoot, configuredPath);
  const relativeToWorkspace = path.relative(workspaceRoot, repositoryRoot);
  const leavesWorkspace = relativeToWorkspace.startsWith("..") || path.isAbsolute(relativeToWorkspace);

  if (leavesWorkspace || !fs.existsSync(repositoryRoot) || !fs.statSync(repositoryRoot).isDirectory()) {
    return failurePayload(workflow, "INPUT_PATH_INVALID", "Input repositoryPath must resolve to an existing workspace directory.");
  }

  const repository = {
    root: normalizePath(repositoryRoot),
    ...readGitMetadata(repositoryRoot)
  };

  let scanResult;
  try {
    scanResult = scanRepository(repositoryRoot, config);
  } catch (error) {
    return failurePayload(workflow, "REPOSITORY_SCAN_FAILED", "Repository scan failed.");
  }

  let evidence;
  try {
    evidence = extractEvidence(scanResult.files);
  } catch (error) {
    return failurePayload(workflow, "EVIDENCE_EXTRACTION_FAILED", "Evidence extraction failed.");
  }

  let classifications;
  try {
    classifications = classifyEvidence(evidence);
  } catch (error) {
    return failurePayload(workflow, "EVIDENCE_CLASSIFICATION_FAILED", "Evidence classification failed.");
  }

  if (workflow === "local-document-report") {
    let discoveryResult;
    try {
      discoveryResult = discoverDocuments(evidence);
    } catch (error) {
      return failurePayload(workflow, "EVIDENCE_EXTRACTION_FAILED", "Document discovery failed.");
    }

    let documentClassification;
    try {
      documentClassification = classifyDocuments(discoveryResult.documents);
    } catch (error) {
      return failurePayload(workflow, "EVIDENCE_CLASSIFICATION_FAILED", "Document classification failed.");
    }

    return {
      status: "PASS",
      workflow,
      repository,
      scan: scanResult.scan,
      logs: [
        {
          level: "INFO",
          message: "GT63 Machine document report workflow completed."
        }
      ],
      failures: [],
      machineReport: {
        documentsFound: documentClassification.documents.length,
        categories: documentClassification.categories,
        duplicates: discoveryResult.duplicates,
        warnings: discoveryResult.warnings,
        documents: documentClassification.documents
      }
    };
  }

  return {
    status: "PASS",
    workflow,
    repository,
    scan: scanResult.scan,
    evidence,
    classifications,
    logs: [
      {
        level: "INFO",
        message: "GT63 Machine bootstrap workflow completed."
      }
    ],
    failures: []
  };
}

module.exports = {
  executeWorkflow,
  failurePayload
};
