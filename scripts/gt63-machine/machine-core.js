"use strict";

const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");
const { scanRepository } = require("./repository-scanner");
const { extractEvidence } = require("./evidence-extractor");
const { classifyEvidence } = require("./evidence-classifier");
const { discoverDocuments } = require("./document-discovery");
const { classifyDocuments } = require("./document-classifier");
const { mapDocumentRelationships } = require("./relationship-mapper");
const { generateSummary } = require("./summary-generator");
const { buildCanonicalCandidateModel } = require("./canonical-candidate-builder");
const { buildCanonicalReview } = require("./candidate-reviewer");
const { executeExternalArtifactIntake } = require("./external-artifact-intake");
const { executeIntakeProcessingBridge } = require("./intake-processing-bridge");

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

function workflowFailurePayload(workflow, code, message) {
  if (workflow === "candidate-review-resolution") {
    return {
      status: "FAIL",
      workflow,
      authority: "NONE",
      failures: [
        {
          code,
          message
        }
      ]
    };
  }
  return failurePayload(workflow, code, message);
}

function executeWorkflow(config, input, workspaceRoot) {
  const workflow = input && input.workflow;

  if (workflow === "external-artifact-intake") {
    return executeExternalArtifactIntake(input, workspaceRoot);
  }

  if (workflow === "intake-processing-bridge") {
    return executeIntakeProcessingBridge(config, input, workspaceRoot, (repositoryPath) => executeWorkflow(config, {
      workflow: "local-repository-bootstrap",
      repositoryPath
    }, workspaceRoot));
  }

  const configuredPath = input && input.repositoryPath;

  if (!configuredPath || typeof configuredPath !== "string") {
    return workflowFailurePayload(workflow, "INPUT_PATH_INVALID", "Input repositoryPath must be a string.");
  }

  const repositoryRoot = path.resolve(workspaceRoot, configuredPath);
  const relativeToWorkspace = path.relative(workspaceRoot, repositoryRoot);
  const leavesWorkspace = relativeToWorkspace.startsWith("..") || path.isAbsolute(relativeToWorkspace);

  if (leavesWorkspace || !fs.existsSync(repositoryRoot) || !fs.statSync(repositoryRoot).isDirectory()) {
    return workflowFailurePayload(workflow, "INPUT_PATH_INVALID", "Input repositoryPath must resolve to an existing workspace directory.");
  }

  const repository = {
    root: normalizePath(repositoryRoot),
    ...readGitMetadata(repositoryRoot)
  };

  let scanResult;
  try {
    scanResult = scanRepository(repositoryRoot, config);
  } catch (error) {
    return workflowFailurePayload(workflow, "REPOSITORY_SCAN_FAILED", "Repository scan failed.");
  }

  let evidence;
  try {
    evidence = extractEvidence(scanResult.files);
  } catch (error) {
    return workflowFailurePayload(workflow, "EVIDENCE_EXTRACTION_FAILED", "Evidence extraction failed.");
  }

  let classifications;
  try {
    classifications = classifyEvidence(evidence);
  } catch (error) {
    return workflowFailurePayload(workflow, "EVIDENCE_CLASSIFICATION_FAILED", "Evidence classification failed.");
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

  if (workflow === "document-relationship-map") {
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

    let graphReport;
    try {
      graphReport = mapDocumentRelationships(repositoryRoot, documentClassification.documents);
    } catch (error) {
      return failurePayload(workflow, "EVIDENCE_CLASSIFICATION_FAILED", "Relationship mapping failed.");
    }

    return {
      status: "PASS",
      workflow,
      repository,
      scan: scanResult.scan,
      summary: graphReport.summary,
      nodes: graphReport.nodes,
      relationships: graphReport.relationships,
      warnings: graphReport.warnings,
      failures: []
    };
  }

  if (workflow === "machine-graph-summary") {
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

    let graphReport;
    try {
      graphReport = mapDocumentRelationships(repositoryRoot, documentClassification.documents);
    } catch (error) {
      return failurePayload(workflow, "EVIDENCE_CLASSIFICATION_FAILED", "Relationship mapping failed.");
    }

    let machineSummary;
    try {
      machineSummary = generateSummary(graphReport);
    } catch (error) {
      return failurePayload(workflow, "EVIDENCE_CLASSIFICATION_FAILED", "Summary generation failed.");
    }

    return {
      status: "PASS",
      workflow,
      repository,
      scan: scanResult.scan,
      summary: machineSummary,
      warnings: graphReport.warnings,
      failures: []
    };
  }

  if (workflow === "canonical-candidate-builder") {
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

    let graphReport;
    try {
      graphReport = mapDocumentRelationships(repositoryRoot, documentClassification.documents);
    } catch (error) {
      return failurePayload(workflow, "EVIDENCE_CLASSIFICATION_FAILED", "Relationship mapping failed.");
    }

    let machineSummary;
    try {
      machineSummary = generateSummary(graphReport);
    } catch (error) {
      return failurePayload(workflow, "EVIDENCE_CLASSIFICATION_FAILED", "Summary generation failed.");
    }

    let candidateModel;
    try {
      candidateModel = buildCanonicalCandidateModel({
        ...graphReport,
        summary: machineSummary
      });
    } catch (error) {
      return failurePayload(workflow, "EVIDENCE_CLASSIFICATION_FAILED", "Canonical candidate build failed.");
    }

    return {
      status: "PASS",
      workflow,
      repository,
      scan: scanResult.scan,
      candidateModel,
      failures: []
    };
  }

  if (workflow === "candidate-review-resolution") {
    let candidateModel;
    if (Object.prototype.hasOwnProperty.call(input, "candidateModel")) {
      candidateModel = input.candidateModel;
    } else {
      let discoveryResult;
      try {
        discoveryResult = discoverDocuments(evidence);
      } catch (error) {
        return workflowFailurePayload(workflow, "EVIDENCE_EXTRACTION_FAILED", "Document discovery failed.");
      }

      let documentClassification;
      try {
        documentClassification = classifyDocuments(discoveryResult.documents);
      } catch (error) {
        return workflowFailurePayload(workflow, "EVIDENCE_CLASSIFICATION_FAILED", "Document classification failed.");
      }

      let graphReport;
      try {
        graphReport = mapDocumentRelationships(repositoryRoot, documentClassification.documents);
      } catch (error) {
        return workflowFailurePayload(workflow, "EVIDENCE_CLASSIFICATION_FAILED", "Relationship mapping failed.");
      }

      let machineSummary;
      try {
        machineSummary = generateSummary(graphReport);
      } catch (error) {
        return workflowFailurePayload(workflow, "EVIDENCE_CLASSIFICATION_FAILED", "Summary generation failed.");
      }

      try {
        candidateModel = buildCanonicalCandidateModel({
          ...graphReport,
          summary: machineSummary
        });
      } catch (error) {
        return workflowFailurePayload(workflow, "CANDIDATE_MODEL_BUILD_FAILED", "Canonical candidate build failed.");
      }
    }

    const reviewResult = buildCanonicalReview(candidateModel);
    if (!reviewResult.ok) {
      return workflowFailurePayload(workflow, reviewResult.failure, "Candidate model input is invalid.");
    }

    return {
      status: "PASS",
      workflow,
      repository,
      scan: scanResult.scan,
      authority: "NONE",
      canonicalReview: reviewResult.review,
      failures: []
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
