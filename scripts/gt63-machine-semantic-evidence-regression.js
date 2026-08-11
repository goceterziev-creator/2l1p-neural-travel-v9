"use strict";

const assert = require("assert");
const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");
const {
  RULESET_VERSION,
  canonicalSerialize,
  conflictId,
  directRelationshipId,
  semanticStatementId
} = require("./gt63-machine/semantic-canonical");
const dependencyReachability = require("./gt63-machine/semantic-evidence-resolver");

const DEP_RULESET_VERSION = dependencyReachability.RULESET_VERSION;

const repositoryRoot = __dirname.includes(`${path.sep}scripts`)
  ? path.resolve(__dirname, "..")
  : process.cwd();

function baseStatement(overrides = {}) {
  return {
    capability: "semantic-evidence",
    schemaVersion: "1.0",
    rulesetVersion: RULESET_VERSION,
    outputCollection: "artifactStates",
    propositionKind: "artifactIdentity",
    artifactId: "artifact:a",
    semanticState: "ESTABLISHED",
    derivationRuleId: "SE-V1-T-STATEMENT",
    provenanceScope: "scope:repo",
    temporalFrameRef: "time:current",
    evidenceRefs: ["ev:a", "ev:b"],
    ...overrides
  };
}

function baseConflict(overrides = {}) {
  return {
    capability: "semantic-evidence",
    schemaVersion: "1.0",
    rulesetVersion: RULESET_VERSION,
    conflictType: "IDENTITY_CONFLICT",
    propositionKind: "identityResolution",
    provenanceScope: "scope:repo",
    temporalFrameRef: "time:current",
    semanticMembers: ["idres:b", "idres:a"],
    evidenceRefs: ["ev:b", "ev:a"],
    ...overrides
  };
}

function baseRelation(overrides = {}) {
  return {
    capability: "semantic-evidence",
    schemaVersion: "1.0",
    rulesetVersion: RULESET_VERSION,
    relationshipId: "ignored",
    provenanceScope: "scope:repo",
    temporalFrameRef: "time:current",
    source: "artifact:source",
    relationType: "IMPORTS",
    normalizedTargetKey: "./module.js",
    adapterCoverageRef: "adapter:js",
    directOrDerived: "DIRECT",
    evidenceRefs: ["ev:import"],
    target: null,
    factStatus: "UNRESOLVED_TARGET",
    identityResolutionRef: "idres:unresolved",
    relationStatus: "UNKNOWN",
    conflictStatus: "NONE",
    ...overrides
  };
}

function runNodeCheck(filePath) {
  const run = childProcess.spawnSync(process.execPath, ["--check", filePath], {
    cwd: repositoryRoot,
    encoding: "utf8"
  });
  assert.strictEqual(run.status, 0, run.stderr || run.stdout);
}

function assertThrowsMessage(fn, pattern) {
  assert.throws(fn, (error) => pattern.test(error.message));
}

function completeness(status, provenanceValid = true) {
  return { status, provenanceValid };
}

function adapterCoverage(overrides = {}) {
  return {
    relationExtraction: "COMPLETE",
    dependencyResolution: "COMPLETE",
    entrypointDiscovery: "COMPLETE",
    dynamicResolution: "SUPPORTED",
    coverageStatus: "COMPLETE",
    ...overrides
  };
}

function presenceInput(overrides = {}) {
  return {
    rulesetVersion: DEP_RULESET_VERSION,
    targetResolved: false,
    identificationDeterministic: true,
    enumeration: completeness("COMPLETE"),
    ...overrides
  };
}

function configurationInput(overrides = {}) {
  return {
    rulesetVersion: DEP_RULESET_VERSION,
    hasValidParsedConfigurationRelation: false,
    configurationDomainClosed: true,
    configurationClosureValid: true,
    ...overrides
  };
}

function connectionInput(overrides = {}) {
  return {
    rulesetVersion: DEP_RULESET_VERSION,
    hasDirectRelation: false,
    sourceResolved: true,
    targetResolved: true,
    targetPresence: "PRESENT",
    relationshipInspection: completeness("COMPLETE"),
    allRelevantRelationFamiliesInspected: true,
    unresolvedAliasOrTarget: false,
    unsupportedDynamicBehaviorAffectsProposition: false,
    ...overrides
  };
}

function reachabilityInput(overrides = {}) {
  return {
    rulesetVersion: DEP_RULESET_VERSION,
    deterministicSupportedResolvedPath: false,
    pathEdgesSupported: true,
    entrypointInventory: completeness("COMPLETE"),
    relationshipInspection: completeness("COMPLETE"),
    dependencyResolution: completeness("COMPLETE"),
    adapterCoverage: adapterCoverage(),
    unresolvedReachableFrontier: false,
    unsupportedDynamicBehaviorAffectsProposition: false,
    unrelatedCoveragePartial: false,
    ...overrides
  };
}

function executabilityInput(overrides = {}) {
  return {
    rulesetVersion: DEP_RULESET_VERSION,
    recognizedEntrypointOrExecutionContract: true,
    mandatoryPrerequisiteModel: "COMPLETE",
    adapterCoverageStatus: "COMPLETE",
    allMandatoryPrerequisitesPresentResolved: true,
    blockingPrerequisiteStatus: "NONE",
    enumeration: completeness("COMPLETE"),
    dependencyResolution: completeness("COMPLETE"),
    knownBlockingIncompleteness: false,
    unsupportedDynamicBehaviorAffectsProposition: false,
    ...overrides
  };
}

function dependencyEnvelope(overrides = {}) {
  return {
    rulesetVersion: DEP_RULESET_VERSION,
    provenanceScope: "scope:repo",
    temporalFrameRef: "time:current",
    evidenceRefs: ["ev:dep", "ev:scan"],
    presence: presenceInput({ targetResolved: true }),
    configuration: configurationInput({ hasValidParsedConfigurationRelation: true }),
    connection: connectionInput({ hasDirectRelation: true, targetResolved: true }),
    reachability: reachabilityInput({ deterministicSupportedResolvedPath: true }),
    executability: executabilityInput(),
    ...overrides
  };
}

function relationshipInput(overrides = {}) {
  return {
    rulesetVersion: DEP_RULESET_VERSION,
    relationshipId: "rel:rt",
    source: "artifact:source",
    target: "artifact:target",
    relationType: "REFERENCES",
    provenanceScope: "scope:repo",
    temporalFrameRef: "time:current",
    evidenceRefs: ["ev:rel", "ev:parser"],
    factStatus: "OBSERVED_FACT",
    identityResolutionStatus: "RESOLVED",
    aliasTransformations: 0,
    directEvidence: true,
    inspectedContent: true,
    configurationParsed: false,
    configMeaningEstablished: false,
    targetResolutionPartial: false,
    supportedLanguageSyntax: false,
    staticCallResolved: false,
    executionEvidenceDemonstratesCall: false,
    executableOrConfigRegistration: false,
    documentaryOnly: false,
    outputLinkedProvenance: false,
    singleGeneratesFact: false,
    singleOperationPath: false,
    producerIdentityResolved: false,
    outputIdentityResolved: false,
    relationshipInspection: completeness("COMPLETE"),
    contentInspection: completeness("COMPLETE"),
    noDirectOutputProvenance: false,
    nativeGitTraversalProof: false,
    sameRepositoryIdentity: false,
    bothMembersEstablished: false,
    sameBoundedScope: false,
    compatibleTemporalFrame: false,
    materialContradiction: false,
    contradictionComparable: false,
    propositionEvaluable: true,
    unsupportedAdapterMechanism: false,
    extensions: {},
    ...overrides
  };
}

function assertRelationshipStatus(overrides, expected) {
  const actual = dependencyReachability.assessRelationshipStatus(relationshipInput(overrides));
  assert.strictEqual(actual, expected);
  return actual;
}

function assertRelationshipNotStatus(overrides, forbidden) {
  const actual = dependencyReachability.assessRelationshipStatus(relationshipInput(overrides));
  assert.notStrictEqual(actual, forbidden);
  return actual;
}

function unit1SemanticOutput() {
  const statement = baseStatement();
  const conflict = baseConflict();
  const relation = baseRelation();
  return {
    rulesetVersion: RULESET_VERSION,
    statementId: semanticStatementId(statement),
    conflictId: conflictId(conflict),
    relationshipId: directRelationshipId(relation),
    statementCanonical: canonicalSerialize(statement),
    conflictCanonical: canonicalSerialize(conflict),
    relationCanonical: canonicalSerialize(relation)
  };
}

function dependencyReachabilityOutput() {
  return dependencyReachability.assessDependencyReachability(dependencyEnvelope());
}

function dependencyTraceabilityRegistry() {
  return [
    {
      id: "DR-01",
      proposition: "Exact ruleset semantic-evidence-v1.0.1 accepted.",
      test: () => assert.strictEqual(dependencyReachability.assessPresence(presenceInput()), "ABSENT_FROM_CAPTURE")
    },
    {
      id: "DR-02",
      proposition: "Missing ruleset rejected.",
      test: () => assertThrowsMessage(
        () => dependencyReachability.assessPresence({ ...presenceInput(), rulesetVersion: undefined }),
        /UNSUPPORTED_RULESET_VERSION/
      )
    },
    {
      id: "DR-03",
      proposition: "Old semantic-evidence-v1.0.0 rejected.",
      test: () => assertThrowsMessage(
        () => dependencyReachability.assessPresence({ ...presenceInput(), rulesetVersion: "semantic-evidence-v1.0.0" }),
        /UNSUPPORTED_RULESET_VERSION/
      )
    },
    {
      id: "DR-04",
      proposition: "Future or unsupported ruleset rejected.",
      test: () => assertThrowsMessage(
        () => dependencyReachability.assessPresence({ ...presenceInput(), rulesetVersion: "semantic-evidence-v1.0.2" }),
        /UNSUPPORTED_RULESET_VERSION/
      )
    },
    {
      id: "DR-05",
      proposition: "Resolved target produces PRESENT.",
      test: () => assert.strictEqual(dependencyReachability.assessPresence(presenceInput({ targetResolved: true })), "PRESENT")
    },
    {
      id: "DR-06",
      proposition: "Deterministically identified missing target under valid COMPLETE enumeration produces ABSENT_FROM_CAPTURE.",
      test: () => assert.strictEqual(dependencyReachability.assessPresence(presenceInput()), "ABSENT_FROM_CAPTURE")
    },
    {
      id: "DR-07",
      proposition: "COMPLETE enumeration with invalid provenance preserves UNKNOWN.",
      test: () => assert.strictEqual(
        dependencyReachability.assessPresence(presenceInput({ enumeration: completeness("COMPLETE", false) })),
        "UNKNOWN"
      )
    },
    {
      id: "DR-08",
      proposition: "PARTIAL enumeration preserves UNKNOWN.",
      test: () => assert.strictEqual(
        dependencyReachability.assessPresence(presenceInput({ enumeration: completeness("PARTIAL") })),
        "UNKNOWN"
      )
    },
    {
      id: "DR-09",
      proposition: "Non-deterministic target identification prevents negative presence.",
      test: () => assert.strictEqual(
        dependencyReachability.assessPresence(presenceInput({ identificationDeterministic: false })),
        "UNKNOWN"
      )
    },
    {
      id: "DR-10",
      proposition: "Valid parsed configuration relation produces CONFIGURED.",
      test: () => assert.strictEqual(
        dependencyReachability.assessConfiguration(configurationInput({ hasValidParsedConfigurationRelation: true })),
        "CONFIGURED"
      )
    },
    {
      id: "DR-11",
      proposition: "No relation plus valid closed configuration domain produces NOT_CONFIGURED.",
      test: () => assert.strictEqual(dependencyReachability.assessConfiguration(configurationInput()), "NOT_CONFIGURED")
    },
    {
      id: "DR-12",
      proposition: "Incomplete or invalid configuration closure preserves UNKNOWN.",
      test: () => assert.strictEqual(
        dependencyReachability.assessConfiguration(configurationInput({ configurationClosureValid: false })),
        "UNKNOWN"
      )
    },
    {
      id: "DR-13",
      proposition: "Direct relation plus resolved target produces CONNECTED.",
      test: () => assert.strictEqual(
        dependencyReachability.assessConnection(connectionInput({ hasDirectRelation: true, targetResolved: true })),
        "CONNECTED"
      )
    },
    {
      id: "DR-14",
      proposition: "Direct relation plus proven ABSENT_FROM_CAPTURE target produces DANGLING_REFERENCE.",
      test: () => assert.strictEqual(
        dependencyReachability.assessConnection(connectionInput({
          hasDirectRelation: true,
          targetResolved: false,
          targetPresence: "ABSENT_FROM_CAPTURE"
        })),
        "DANGLING_REFERENCE"
      )
    },
    {
      id: "DR-15",
      proposition: "No relation plus complete valid inspected supported graph and resolved identities produces NOT_CONNECTED.",
      test: () => assert.strictEqual(dependencyReachability.assessConnection(connectionInput()), "NOT_CONNECTED")
    },
    {
      id: "DR-16",
      proposition: "Incomplete or invalid relationship inspection preserves UNKNOWN.",
      test: () => assert.strictEqual(
        dependencyReachability.assessConnection(connectionInput({ relationshipInspection: completeness("COMPLETE", false) })),
        "UNKNOWN"
      )
    },
    {
      id: "DR-17",
      proposition: "Unresolved identity and same-name/co-location superficial evidence cannot establish connection or reachability.",
      test: () => {
        assert.deepStrictEqual({
          connection: dependencyReachability.assessConnection(connectionInput({
            hasDirectRelation: false,
            sourceResolved: false,
            targetResolved: false,
            targetPresence: "UNKNOWN",
            relationshipInspection: completeness("UNKNOWN"),
            allRelevantRelationFamiliesInspected: false,
            unresolvedAliasOrTarget: true
          })),
          reachability: dependencyReachability.assessReachability(reachabilityInput({
            deterministicSupportedResolvedPath: false,
            pathEdgesSupported: false,
            entrypointInventory: completeness("UNKNOWN"),
            relationshipInspection: completeness("UNKNOWN"),
            dependencyResolution: completeness("UNKNOWN"),
            adapterCoverage: adapterCoverage({
              relationExtraction: "UNKNOWN",
              dependencyResolution: "UNKNOWN",
              entrypointDiscovery: "UNKNOWN",
              dynamicResolution: "UNKNOWN",
              coverageStatus: "UNKNOWN"
            }),
            unresolvedReachableFrontier: true,
            unsupportedDynamicBehaviorAffectsProposition: true
          }))
        }, {
          connection: "UNKNOWN",
          reachability: "UNKNOWN"
        });
        assertThrowsMessage(
          () => dependencyReachability.assessConnection({ ...connectionInput(), sameFileName: true }),
          /SCHEMA_UNSUPPORTED_FIELD:sameFileName/
        );
      }
    },
    {
      id: "DR-18",
      proposition: "Unsupported dynamic behavior affecting connection proposition preserves UNKNOWN.",
      test: () => assert.strictEqual(
        dependencyReachability.assessConnection(connectionInput({ unsupportedDynamicBehaviorAffectsProposition: true })),
        "UNKNOWN"
      )
    },
    {
      id: "DR-19",
      proposition: "Deterministic supported resolved path produces REACHABLE_FROM_IDENTIFIED_ENTRYPOINT.",
      test: () => assert.strictEqual(
        dependencyReachability.assessReachability(reachabilityInput({ deterministicSupportedResolvedPath: true })),
        "REACHABLE_FROM_IDENTIFIED_ENTRYPOINT"
      )
    },
    {
      id: "DR-20",
      proposition: "No resolved path under fully complete valid negative-reachability gates produces NOT_REACHABLE_FROM_IDENTIFIED_ENTRYPOINT.",
      test: () => assert.strictEqual(
        dependencyReachability.assessReachability(reachabilityInput()),
        "NOT_REACHABLE_FROM_IDENTIFIED_ENTRYPOINT"
      )
    },
    {
      id: "DR-21",
      proposition: "Partial or invalid reachability prerequisites or unresolved frontier preserves UNKNOWN.",
      test: () => assert.strictEqual(
        dependencyReachability.assessReachability(reachabilityInput({ unresolvedReachableFrontier: true })),
        "UNKNOWN"
      )
    },
    {
      id: "DR-22",
      proposition: "Unsupported dynamic behavior affecting reachability preserves UNKNOWN.",
      test: () => assert.strictEqual(
        dependencyReachability.assessReachability(reachabilityInput({ unsupportedDynamicBehaviorAffectsProposition: true })),
        "UNKNOWN"
      )
    }
  ];
}

function executeDrTraceabilityRegistry() {
  const registry = dependencyTraceabilityRegistry();
  const expectedIds = Array.from({ length: 22 }, (_, index) => `DR-${String(index + 1).padStart(2, "0")}`);
  const ids = registry.map((entry) => entry.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  const missing = expectedIds.filter((id) => !ids.includes(id));
  const unexpected = ids.filter((id) => !expectedIds.includes(id));
  assert.strictEqual(registry.length, 22);
  assert.deepStrictEqual(duplicates, []);
  assert.deepStrictEqual(missing, []);
  assert.deepStrictEqual(unexpected, []);
  const results = registry.map((entry) => {
    entry.test();
    return {
      id: entry.id,
      proposition: entry.proposition,
      status: "PASS"
    };
  });
  return {
    count: registry.length,
    first: ids[0],
    last: ids[ids.length - 1],
    duplicates,
    missing,
    unexpected,
    status: "PASS",
    results
  };
}

function relationshipTraceabilityRegistry() {
  return [
    {
      id: "RT-01",
      proposition: "REFERENCES direct unambiguous reference with resolved target is PROVEN.",
      expected: "PROVEN",
      test: () => assertRelationshipStatus({}, "PROVEN")
    },
    {
      id: "RT-02",
      proposition: "REFERENCES with exactly one deterministic alias transformation is SUPPORTED.",
      expected: "SUPPORTED",
      test: () => assertRelationshipStatus({ inspectedContent: false, aliasTransformations: 1 }, "SUPPORTED")
    },
    {
      id: "RT-03",
      proposition: "REFERENCES ambiguous normalized identity evidence is POSSIBLE.",
      expected: "POSSIBLE",
      test: () => assertRelationshipStatus({ inspectedContent: false, identityResolutionStatus: "AMBIGUOUS" }, "POSSIBLE")
    },
    {
      id: "RT-04",
      proposition: "CONFIGURES parsed explicit config mapping is PROVEN.",
      expected: "PROVEN",
      test: () => assertRelationshipStatus({ relationType: "CONFIGURES", configurationParsed: true }, "PROVEN")
    },
    {
      id: "RT-05",
      proposition: "CONFIGURES clear config semantics with partial target resolution is SUPPORTED.",
      expected: "SUPPORTED",
      test: () => assertRelationshipStatus({
        relationType: "CONFIGURES",
        directEvidence: false,
        inspectedContent: false,
        configMeaningEstablished: true,
        targetResolutionPartial: true
      }, "SUPPORTED")
    },
    {
      id: "RT-06",
      proposition: "IMPORTS valid supported-language direct import token is PROVEN without target-presence inference.",
      expected: "PROVEN",
      test: () => {
        const actual = assertRelationshipStatus({ relationType: "IMPORTS", supportedLanguageSyntax: true }, "PROVEN");
        assert.strictEqual("presence" in dependencyReachability.assessRelationshipAssessment(relationshipInput({
          relationType: "IMPORTS",
          supportedLanguageSyntax: true
        })), false);
        return actual;
      }
    },
    {
      id: "RT-07",
      proposition: "CALLS statically resolved direct call is PROVEN.",
      expected: "PROVEN",
      test: () => assertRelationshipStatus({ relationType: "CALLS", staticCallResolved: true }, "PROVEN")
    },
    {
      id: "RT-08",
      proposition: "CALLS direct execution evidence demonstrating the call is PROVEN.",
      expected: "PROVEN",
      test: () => assertRelationshipStatus({ relationType: "CALLS", directEvidence: false, executionEvidenceDemonstratesCall: true }, "PROVEN")
    },
    {
      id: "RT-09",
      proposition: "CALLS direct fact with exactly one alias transformation is SUPPORTED.",
      expected: "SUPPORTED",
      test: () => assertRelationshipStatus({ relationType: "CALLS", aliasTransformations: 1 }, "SUPPORTED")
    },
    {
      id: "RT-10",
      proposition: "CALLS ambiguous normalized target is POSSIBLE.",
      expected: "POSSIBLE",
      test: () => assertRelationshipStatus({ relationType: "CALLS", identityResolutionStatus: "AMBIGUOUS" }, "POSSIBLE")
    },
    {
      id: "RT-11",
      proposition: "SERVES executable/config registration is PROVEN.",
      expected: "PROVEN",
      test: () => assertRelationshipStatus({ relationType: "SERVES", executableOrConfigRegistration: true }, "PROVEN")
    },
    {
      id: "RT-12",
      proposition: "SERVES documentary wording without qualifying structure is not PROVEN.",
      expected: "not PROVEN",
      test: () => assertRelationshipNotStatus({
        relationType: "SERVES",
        directEvidence: false,
        inspectedContent: false,
        documentaryOnly: true
      }, "PROVEN")
    },
    {
      id: "RT-13",
      proposition: "GENERATES direct output-linked producer/output provenance is PROVEN.",
      expected: "PROVEN",
      test: () => assertRelationshipStatus({ relationType: "GENERATES", outputLinkedProvenance: true }, "PROVEN")
    },
    {
      id: "RT-14",
      proposition: "GENERATES exact frozen conjunctive gate is STRONGLY_SUPPORTED.",
      expected: "STRONGLY_SUPPORTED",
      test: () => assertRelationshipStatus({
        relationType: "GENERATES",
        directEvidence: false,
        inspectedContent: false,
        singleGeneratesFact: true,
        singleOperationPath: true,
        producerIdentityResolved: true,
        outputIdentityResolved: true,
        noDirectOutputProvenance: true
      }, "STRONGLY_SUPPORTED")
    },
    {
      id: "RT-15",
      proposition: "GENERATES missing one required strong prerequisite is not STRONGLY_SUPPORTED.",
      expected: "not STRONGLY_SUPPORTED",
      test: () => assertRelationshipNotStatus({
        relationType: "GENERATES",
        directEvidence: false,
        inspectedContent: false,
        singleGeneratesFact: true,
        singleOperationPath: true,
        producerIdentityResolved: true,
        outputIdentityResolved: false,
        noDirectOutputProvenance: true
      }, "STRONGLY_SUPPORTED")
    },
    {
      id: "RT-16",
      proposition: "Output exists plus generator library evidence alone is not PROVEN.",
      expected: "not PROVEN",
      test: () => assertRelationshipNotStatus({
        relationType: "GENERATES",
        directEvidence: false,
        inspectedContent: false,
        extensions: { outputExists: true, generatorLibraryExists: true }
      }, "PROVEN")
    },
    {
      id: "RT-17",
      proposition: "GIT_ANCESTOR_OF native traversal proof in same repository is PROVEN.",
      expected: "PROVEN",
      test: () => assertRelationshipStatus({
        relationType: "GIT_ANCESTOR_OF",
        nativeGitTraversalProof: true,
        sameRepositoryIdentity: true
      }, "PROVEN")
    },
    {
      id: "RT-18",
      proposition: "Git name/file/timestamp similarity without native proof is not PROVEN.",
      expected: "not PROVEN",
      test: () => assertRelationshipNotStatus({
        relationType: "GIT_ANCESTOR_OF",
        directEvidence: false,
        inspectedContent: false,
        extensions: { sameName: true, similarTimestamp: true }
      }, "PROVEN")
    },
    {
      id: "RT-19",
      proposition: "COEXISTS_WITH direct bounded compatible scope/frame fact is PROVEN.",
      expected: "PROVEN",
      test: () => assertRelationshipStatus({
        relationType: "COEXISTS_WITH",
        bothMembersEstablished: true,
        sameBoundedScope: true,
        compatibleTemporalFrame: true
      }, "PROVEN")
    },
    {
      id: "RT-20",
      proposition: "COEXISTS_WITH proof creates no secondary relationship, identity, lineage, integration, or authority fields.",
      expected: "PROVEN only",
      test: () => {
        const record = dependencyReachability.assessRelationshipAssessment(relationshipInput({
          relationType: "COEXISTS_WITH",
          bothMembersEstablished: true,
          sameBoundedScope: true,
          compatibleTemporalFrame: true
        }));
        assert.strictEqual(record.relationStatus, "PROVEN");
        for (const forbidden of ["imports", "calls", "integration", "identity", "lineage", "authority"]) {
          assert.strictEqual(Object.prototype.hasOwnProperty.call(record, forbidden), false);
        }
        return record.relationStatus;
      }
    },
    {
      id: "RT-21",
      proposition: "Unresolved material identity makes relationship proposition UNKNOWN.",
      expected: "UNKNOWN",
      test: () => assertRelationshipStatus({
        identityResolutionStatus: "UNRESOLVED",
        factStatus: "UNRESOLVED_TARGET",
        propositionEvaluable: false
      }, "UNKNOWN")
    },
    {
      id: "RT-22",
      proposition: "Ambiguous provenance or scope makes relationship proposition UNKNOWN.",
      expected: "UNKNOWN",
      test: () => assertRelationshipStatus({ propositionEvaluable: false, extensions: { ambiguousScope: true } }, "UNKNOWN")
    },
    {
      id: "RT-23",
      proposition: "Unsupported adapter mechanism material to proposition is UNKNOWN.",
      expected: "UNKNOWN",
      test: () => assertRelationshipStatus({ unsupportedAdapterMechanism: true }, "UNKNOWN")
    },
    {
      id: "RT-24",
      proposition: "Evaluable proposition with no positive or contradiction threshold is INSUFFICIENT_EVIDENCE.",
      expected: "INSUFFICIENT_EVIDENCE",
      test: () => assertRelationshipStatus({ directEvidence: false, inspectedContent: false }, "INSUFFICIENT_EVIDENCE")
    },
    {
      id: "RT-25",
      proposition: "UNKNOWN and INSUFFICIENT_EVIDENCE remain distinct by evaluability prerequisite.",
      expected: "UNKNOWN != INSUFFICIENT_EVIDENCE",
      test: () => {
        assert.strictEqual(dependencyReachability.assessRelationshipStatus(relationshipInput({ propositionEvaluable: false })), "UNKNOWN");
        assert.strictEqual(dependencyReachability.assessRelationshipStatus(relationshipInput({
          directEvidence: false,
          inspectedContent: false
        })), "INSUFFICIENT_EVIDENCE");
        return "PASS";
      }
    },
    {
      id: "RT-26",
      proposition: "Comparable materially incompatible relationship proposition is CONTRADICTED.",
      expected: "CONTRADICTED",
      test: () => assertRelationshipStatus({ materialContradiction: true, contradictionComparable: true }, "CONTRADICTED")
    },
    {
      id: "RT-27",
      proposition: "Missing proof is not CONTRADICTED.",
      expected: "not CONTRADICTED",
      test: () => assertRelationshipNotStatus({ directEvidence: false, inspectedContent: false }, "CONTRADICTED")
    },
    {
      id: "RT-28",
      proposition: "Temporal evolution or non-comparable contradiction does not automatically produce CONTRADICTED.",
      expected: "not CONTRADICTED",
      test: () => assertRelationshipNotStatus({
        materialContradiction: true,
        contradictionComparable: false,
        extensions: { temporalEvolution: true }
      }, "CONTRADICTED")
    },
    {
      id: "RT-29",
      proposition: "All seven relationStatus values map to frozen semanticState values.",
      expected: "mapping PASS",
      test: () => {
        const cases = [
          ["PROVEN", "ESTABLISHED"],
          ["STRONGLY_SUPPORTED", "SUPPORTED"],
          ["SUPPORTED", "SUPPORTED"],
          ["POSSIBLE", "POSSIBLE"],
          ["INSUFFICIENT_EVIDENCE", "UNKNOWN"],
          ["UNKNOWN", "UNKNOWN"],
          ["CONTRADICTED", "CONTRADICTED"]
        ];
        const fixtures = {
          PROVEN: {},
          STRONGLY_SUPPORTED: {
            relationType: "GENERATES",
            directEvidence: false,
            inspectedContent: false,
            singleGeneratesFact: true,
            singleOperationPath: true,
            producerIdentityResolved: true,
            outputIdentityResolved: true,
            noDirectOutputProvenance: true
          },
          SUPPORTED: { inspectedContent: false, aliasTransformations: 1 },
          POSSIBLE: { inspectedContent: false, identityResolutionStatus: "AMBIGUOUS" },
          INSUFFICIENT_EVIDENCE: { directEvidence: false, inspectedContent: false },
          UNKNOWN: { propositionEvaluable: false },
          CONTRADICTED: { materialContradiction: true, contradictionComparable: true }
        };
        for (const [status, semanticState] of cases) {
          const record = dependencyReachability.assessRelationshipAssessment(relationshipInput(fixtures[status]));
          assert.strictEqual(record.relationStatus, status);
          assert.strictEqual(record.semanticState, semanticState);
        }
        return "PASS";
      }
    },
    {
      id: "RT-30",
      proposition: "Positive relationship assessment with zero evidenceRefs is rejected.",
      expected: "SCHEMA_UNSUPPORTED_VALUE:evidenceRefs",
      test: () => assertThrowsMessage(
        () => dependencyReachability.assessRelationshipAssessment(relationshipInput({ evidenceRefs: [] })),
        /SCHEMA_UNSUPPORTED_VALUE:evidenceRefs/
      )
    },
    {
      id: "RT-31",
      proposition: "Unsupported relationType outside the closed V1 vocabulary is rejected.",
      expected: "SCHEMA_UNSUPPORTED_VALUE:relationType",
      test: () => assertThrowsMessage(
        () => dependencyReachability.assessRelationshipStatus(relationshipInput({ relationType: "DERIVED_FROM" })),
        /SCHEMA_UNSUPPORTED_VALUE:relationType/
      )
    },
    {
      id: "RT-32",
      proposition: "Valid UNSUPPORTED_RELATION_FAMILY factStatus is schema-accepted but non-positive.",
      expected: "UNKNOWN",
      test: () => {
        const actual = dependencyReachability.assessRelationshipStatus(relationshipInput({
          factStatus: "UNSUPPORTED_RELATION_FAMILY"
        }));
        assert.strictEqual(actual, "UNKNOWN");
        assert(!["PROVEN", "STRONGLY_SUPPORTED", "SUPPORTED", "POSSIBLE"].includes(actual));
        return actual;
      }
    },
    {
      id: "RT-33",
      proposition: "Unsupported semantic input field is rejected.",
      expected: "SCHEMA_UNSUPPORTED_FIELD",
      test: () => assertThrowsMessage(
        () => dependencyReachability.assessRelationshipStatus({ ...relationshipInput(), sameFileName: true }),
        /SCHEMA_UNSUPPORTED_FIELD:sameFileName/
      )
    },
    {
      id: "RT-34",
      proposition: "Permitted extensions do not alter relationStatus.",
      expected: "PROVEN",
      test: () => {
        const plain = dependencyReachability.assessRelationshipAssessment(relationshipInput());
        const extended = dependencyReachability.assessRelationshipAssessment(relationshipInput({
          extensions: { sameFileName: true, colocated: true, arbitraryReviewerNote: "ignored" }
        }));
        assert.strictEqual(extended.relationStatus, plain.relationStatus);
        return extended.relationStatus;
      }
    },
    {
      id: "RT-35",
      proposition: "Input ordering and evidenceRefs permutation preserve semantic record.",
      expected: "deep-equal",
      test: () => {
        const left = dependencyReachability.assessRelationshipAssessment(relationshipInput({
          evidenceRefs: ["ev:b", "ev:a", "ev:a"]
        }));
        const right = dependencyReachability.assessRelationshipAssessment({
          ...relationshipInput({ evidenceRefs: ["ev:a", "ev:b"] })
        });
        assert.deepStrictEqual(left, right);
        return "PASS";
      }
    },
    {
      id: "RT-36",
      proposition: "EvidenceRefs ordering and dedupe preserve statementId.",
      expected: "same statementId",
      test: () => {
        const left = dependencyReachability.assessRelationshipAssessment(relationshipInput({ evidenceRefs: ["ev:z", "ev:a", "ev:z"] }));
        const right = dependencyReachability.assessRelationshipAssessment(relationshipInput({ evidenceRefs: ["ev:a", "ev:z"] }));
        assert.strictEqual(left.statementId, right.statementId);
        return left.statementId;
      }
    },
    {
      id: "RT-37",
      proposition: "Repeated relationship assessment execution is deterministic.",
      expected: "deep-equal",
      test: () => {
        const first = dependencyReachability.assessRelationshipAssessment(relationshipInput());
        const second = dependencyReachability.assessRelationshipAssessment(relationshipInput());
        assert.deepStrictEqual(first, second);
        return "PASS";
      }
    },
    {
      id: "RT-38",
      proposition: "Relationship resolver source contains no filesystem, Git, environment, time, randomness, or locale derivation.",
      expected: "no forbidden source APIs",
      test: () => {
        const source = fs.readFileSync(path.join(repositoryRoot, "scripts", "gt63-machine", "semantic-evidence-resolver.js"), "utf8");
        for (const forbidden of [
          "require(\"fs\")",
          "require('fs')",
          "require(\"path\")",
          "require('path')",
          "process.cwd",
          "process.env",
          "require.resolve",
          "child_process",
          "fetch(",
          "Date",
          "Math.random",
          "localeCompare",
          "Intl",
          ".git"
        ]) {
          assert(!source.includes(forbidden), `relationship resolver must not use ${forbidden}`);
        }
        return "PASS";
      }
    },
    {
      id: "RT-39",
      proposition: "Relationship assessment output never emits governance authority states.",
      expected: "authority NONE / forbidden states absent",
      test: () => {
        const output = dependencyReachability.assessRelationshipAssessment(relationshipInput());
        const serialized = JSON.stringify(output);
        for (const forbidden of ["CANONICAL", "ACCEPTED", "AUTHORIZED", "LOCKED", "GOVERNING", "APPROVED_PRODUCT_TRUTH", "CONSTITUTIONAL"]) {
          assert(!serialized.includes(forbidden));
        }
        assert.strictEqual(dependencyReachability.assessDependencyReachability(dependencyEnvelope()).authority, "NONE");
        return "PASS";
      }
    },
    {
      id: "RT-40",
      proposition: "Relationship unit does not populate historicalRelations, outputProvenance, binaryIntegration, unknowns, or conflicts.",
      expected: "no final-envelope expansion",
      test: () => {
        const output = dependencyReachability.assessRelationshipAssessment(relationshipInput());
        for (const forbidden of ["historicalRelations", "outputProvenance", "binaryIntegration", "unknowns", "conflicts"]) {
          assert.strictEqual(Object.prototype.hasOwnProperty.call(output, forbidden), false);
        }
        return "PASS";
      }
    },
    {
      id: "RT-41",
      proposition: "Existing DR-01 through DR-22 dependency/reachability traceability remains PASS.",
      expected: "DR PASS",
      test: () => {
        const dr = executeDrTraceabilityRegistry();
        assert.strictEqual(dr.status, "PASS");
        assert.strictEqual(dr.count, 22);
        return "PASS";
      }
    }
  ];
}

function executeRelationshipTraceabilityRegistry() {
  const registry = relationshipTraceabilityRegistry();
  const expectedIds = Array.from({ length: 41 }, (_, index) => `RT-${String(index + 1).padStart(2, "0")}`);
  const ids = registry.map((entry) => entry.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  const missing = expectedIds.filter((id) => !ids.includes(id));
  const unexpected = ids.filter((id) => !expectedIds.includes(id));
  assert.strictEqual(registry.length, 41);
  assert.deepStrictEqual(duplicates, []);
  assert.deepStrictEqual(missing, []);
  assert.deepStrictEqual(unexpected, []);
  const results = registry.map((entry) => {
    const actual = entry.test();
    return {
      id: entry.id,
      proposition: entry.proposition,
      expected: entry.expected,
      actual: typeof actual === "undefined" ? "PASS" : actual,
      status: "PASS"
    };
  });
  return {
    count: registry.length,
    first: ids[0],
    last: ids[ids.length - 1],
    duplicates,
    missing,
    unexpected,
    status: "PASS",
    results
  };
}

function main() {
  const trace = {
    rulesetVersion: RULESET_VERSION,
    derivationRuleId: "SE-V1-UNIT-1",
    fixtureId: "unit1-canonical-serialization"
  };
  const drTraceability = executeDrTraceabilityRegistry();
  const relationshipTraceability = executeRelationshipTraceabilityRegistry();

  // T-01 Object key order.
  assert.strictEqual(canonicalSerialize({ b: "2", a: "1" }), canonicalSerialize({ a: "1", b: "2" }));
  assert.strictEqual(
    semanticStatementId(baseStatement({ declaredIdentity: { b: "2", a: "1" } })),
    semanticStatementId(baseStatement({ declaredIdentity: { a: "1", b: "2" } }))
  );

  // T-02 evidenceRefs order.
  assert.strictEqual(
    semanticStatementId(baseStatement({ evidenceRefs: ["ev:b", "ev:a"] })),
    semanticStatementId(baseStatement({ evidenceRefs: ["ev:a", "ev:b"] }))
  );

  // T-03 evidenceRefs duplicates.
  assert.strictEqual(
    canonicalSerialize({ evidenceRefs: ["ev:a", "ev:a", "ev:b"] }),
    canonicalSerialize({ evidenceRefs: ["ev:b", "ev:a"] })
  );
  assert.strictEqual(
    semanticStatementId(baseStatement({ evidenceRefs: ["ev:a", "ev:a", "ev:b"] })),
    semanticStatementId(baseStatement({ evidenceRefs: ["ev:b", "ev:a"] }))
  );

  // R1/R2 aliases are set-like: order-independent and duplicate-independent.
  assert.strictEqual(
    canonicalSerialize({ aliases: ["b", "a"] }),
    canonicalSerialize({ aliases: ["a", "b"] })
  );
  assert.strictEqual(
    canonicalSerialize({ aliases: ["a", "a", "b"] }),
    canonicalSerialize({ aliases: ["b", "a"] })
  );
  assert.strictEqual(canonicalSerialize({ aliases: ["\u00e9", "e\u0301"] }), "{\"aliases\":[\"\u00e9\"]}");
  assert.strictEqual(canonicalSerialize({ relationMembers: ["b", "a", "a"] }), "{\"relationMembers\":[\"a\",\"b\"]}");
  assert.strictEqual(
    canonicalSerialize({ relationMembers: ["\u00e9", "e\u0301", "a"] }),
    "{\"relationMembers\":[\"a\",\u0022\u00e9\u0022]}"
  );
  assert.strictEqual(canonicalSerialize({ scopeRefs: ["scope:2", "scope:1", "scope:1"] }), "{\"scopeRefs\":[\"scope:1\",\"scope:2\"]}");
  assert.strictEqual(
    canonicalSerialize({ temporalFrameRefs: ["time:2", "time:1", "time:1"] }),
    "{\"temporalFrameRefs\":[\"time:1\",\"time:2\"]}"
  );
  assert.strictEqual(
    canonicalSerialize({ identityResolutionRefs: ["idres:b", "idres:a", "idres:a"] }),
    "{\"identityResolutionRefs\":[\"idres:a\",\"idres:b\"]}"
  );

  // T-04 Ordered array preservation.
  assert.notStrictEqual(canonicalSerialize({ ordered: ["a", "b"] }), canonicalSerialize({ ordered: ["b", "a"] }));
  assert.strictEqual(canonicalSerialize({ steps: ["b", "a"] }), "{\"steps\":[\"b\",\"a\"]}");

  // T-05 Unicode NFC.
  assert.strictEqual(canonicalSerialize({ text: "\u00e9" }), canonicalSerialize({ text: "e\u0301" }));
  assert.strictEqual(
    semanticStatementId(baseStatement({ declaredIdentity: "\u00e9" })),
    semanticStatementId(baseStatement({ declaredIdentity: "e\u0301" }))
  );

  // R3 Set-like string sorting uses semantic code points before JSON escaping.
  assert.strictEqual(canonicalSerialize({ evidenceRefs: ["ev:A", "ev:\n"] }), "{\"evidenceRefs\":[\"ev:\\n\",\"ev:A\"]}");

  // T-06 Boolean/null.
  assert.strictEqual(canonicalSerialize({ yes: true, no: false, none: null }), "{\"no\":false,\"none\":null,\"yes\":true}");

  // T-07 Integer serialization.
  assert.strictEqual(canonicalSerialize({ version: 1 }, { integerKeys: ["version"] }), "{\"version\":1}");
  assert.strictEqual(canonicalSerialize({ version: 1.0 }, { integerKeys: ["version"] }), "{\"version\":1}");
  assertThrowsMessage(() => semanticStatementId(baseStatement({ arbitraryField: 1 })), /SCHEMA_UNSUPPORTED_FIELD:arbitraryField/);
  assertThrowsMessage(() => canonicalSerialize({ value: 1 }), /UNSUPPORTED_NUMBER/);
  assertThrowsMessage(() => canonicalSerialize({ version: Number.MAX_SAFE_INTEGER + 1 }, { integerKeys: ["version"] }), /UNSUPPORTED_NUMBER/);
  assertThrowsMessage(() => canonicalSerialize({ version: 1.25 }, { integerKeys: ["version"] }), /UNSUPPORTED_NUMBER/);
  assertThrowsMessage(() => canonicalSerialize({ version: Number.NaN }, { integerKeys: ["version"] }), /UNSUPPORTED_NUMBER/);
  assertThrowsMessage(() => canonicalSerialize({ version: Number.POSITIVE_INFINITY }, { integerKeys: ["version"] }), /UNSUPPORTED_NUMBER/);
  assertThrowsMessage(() => canonicalSerialize({ version: Number.NEGATIVE_INFINITY }, { integerKeys: ["version"] }), /UNSUPPORTED_NUMBER/);
  assertThrowsMessage(() => canonicalSerialize({ version: -0 }, { integerKeys: ["version"] }), /UNSUPPORTED_NUMBER/);

  // T-08 RFC JSON escaping.
  assert.strictEqual(canonicalSerialize({ text: "quote\" slash\\ line\n tab\t \u2603" }), JSON.stringify({
    text: "quote\" slash\\ line\n tab\t \u2603".normalize("NFC")
  }));

  // T-09 Statement ID determinism.
  const repeatedStatementIds = Array.from({ length: 5 }, () => semanticStatementId(baseStatement()));
  assert.strictEqual(new Set(repeatedStatementIds).size, 1);

  // T-10 Statement ID semantic difference.
  assert.strictEqual(
    semanticStatementId(baseStatement()),
    semanticStatementId(baseStatement({ runtimeDebug: "x" }))
  );
  assert.strictEqual(
    semanticStatementId(baseStatement()),
    semanticStatementId(baseStatement({ explanation: "presentation-only prose" }))
  );
  assert.notStrictEqual(
    semanticStatementId(baseStatement({ semanticState: "ESTABLISHED" })),
    semanticStatementId(baseStatement({ semanticState: "UNKNOWN" }))
  );

  // T-11 conflictId input order.
  assert.strictEqual(
    conflictId(baseConflict({ semanticMembers: ["idres:b", "idres:a"], evidenceRefs: ["ev:b", "ev:a"] })),
    conflictId(baseConflict({ semanticMembers: ["idres:a", "idres:b"], evidenceRefs: ["ev:a", "ev:b"] }))
  );
  assert.strictEqual(
    conflictId(baseConflict()),
    conflictId(baseConflict({ displayLabel: "x" }))
  );
  assert.strictEqual(
    conflictId(baseConflict()),
    conflictId(baseConflict({ runtimeDebug: { reviewer: "debug-only" } }))
  );
  assert.strictEqual(
    conflictId(baseConflict({ semanticMembers: ["sem:a", "sem:b"] })),
    conflictId(baseConflict({ semanticMembers: ["sem:b", "sem:a", "sem:a"] }))
  );
  assert.notStrictEqual(
    conflictId(baseConflict({ conflictType: "IDENTITY_CONFLICT" })),
    conflictId(baseConflict({ conflictType: "TEMPORAL_CONFLICT" }))
  );

  // T-12 relationshipId resolution stability.
  const unresolved = baseRelation();
  const resolved = baseRelation({
    target: "artifact:module",
    factStatus: "OBSERVED_FACT",
    identityResolutionRef: "idres:resolved",
    relationStatus: "PROVEN",
    conflictStatus: "NONE"
  });
  assert.strictEqual(directRelationshipId(unresolved), directRelationshipId(resolved));
  assert.strictEqual(
    directRelationshipId(baseRelation({ evidenceRefs: ["ev:b", "ev:a"] })),
    directRelationshipId(baseRelation({ evidenceRefs: ["ev:a", "ev:b", "ev:a"] }))
  );

  // T-13 relationshipId material change.
  assert.notStrictEqual(
    directRelationshipId(baseRelation({ normalizedTargetKey: "./module.js" })),
    directRelationshipId(baseRelation({ normalizedTargetKey: "./other.js" }))
  );

  // T-14 Ruleset binding.
  assertThrowsMessage(() => semanticStatementId(baseStatement({ rulesetVersion: "semantic-evidence-v2.0.0" })), /UNSUPPORTED_RULESET_VERSION/);
  assertThrowsMessage(() => conflictId(baseConflict({ rulesetVersion: null })), /UNSUPPORTED_RULESET_VERSION/);
  assertThrowsMessage(() => directRelationshipId(baseRelation({ rulesetVersion: undefined })), /UNSUPPORTED_RULESET_VERSION/);
  assertThrowsMessage(() => directRelationshipId(baseRelation({ rulesetVersion: "wrong-ruleset" })), /UNSUPPORTED_RULESET_VERSION/);
  assertThrowsMessage(() => directRelationshipId(baseRelation({ rulesetVersion: "semantic-evidence-v2.0.0" })), /UNSUPPORTED_RULESET_VERSION/);

  // T-15 Cross-platform semantic determinism.
  const source = fs.readFileSync(path.join(repositoryRoot, "scripts", "gt63-machine", "semantic-canonical.js"), "utf8");
  assert(!source.includes("localeCompare"), "semantic canonical implementation must not use localeCompare");
  assert(!source.includes("require(\"path\")"), "semantic canonical implementation must not import path APIs");
  assert(!source.includes("path.sep"), "semantic canonical implementation must not use platform path separators");
  assert(!source.includes("Date"), "semantic canonical implementation must not use wall-clock APIs");
  assert(!source.includes("Math.random"), "semantic canonical implementation must not use randomness");

  // Dependency / reachability primitive: ruleset binding.
  assert.strictEqual(dependencyReachability.RULESET_VERSION, "semantic-evidence-v1.0.1");
  assertThrowsMessage(() => dependencyReachability.assessPresence({ ...presenceInput(), rulesetVersion: undefined }), /UNSUPPORTED_RULESET_VERSION/);
  assertThrowsMessage(() => dependencyReachability.assessPresence({ ...presenceInput(), rulesetVersion: "semantic-evidence-v1.0.0" }), /UNSUPPORTED_RULESET_VERSION/);
  assertThrowsMessage(() => dependencyReachability.assessPresence({ ...presenceInput(), rulesetVersion: "semantic-evidence-v1.0.2" }), /UNSUPPORTED_RULESET_VERSION/);
  assertThrowsMessage(() => dependencyReachability.assessPresence({ ...presenceInput(), rulesetVersion: "semantic-evidence-v2.0.0" }), /UNSUPPORTED_RULESET_VERSION/);

  // DR-01 through DR-04: presence and completeness restraint.
  assert.strictEqual(dependencyReachability.assessPresence(presenceInput({ targetResolved: true })), "PRESENT");
  assert.strictEqual(dependencyReachability.assessPresence(presenceInput()), "ABSENT_FROM_CAPTURE");
  assert.strictEqual(dependencyReachability.assessPresence(presenceInput({ enumeration: completeness("PARTIAL") })), "UNKNOWN");
  assert.strictEqual(dependencyReachability.assessPresence(presenceInput({ enumeration: completeness("UNKNOWN") })), "UNKNOWN");
  assert.strictEqual(dependencyReachability.assessPresence(presenceInput({ enumeration: completeness("COMPLETE", false) })), "UNKNOWN");
  assert.strictEqual(dependencyReachability.assessPresence(presenceInput({ identificationDeterministic: false })), "UNKNOWN");

  // Configuration.
  assert.strictEqual(
    dependencyReachability.assessConfiguration(configurationInput({ hasValidParsedConfigurationRelation: true })),
    "CONFIGURED"
  );
  assert.strictEqual(dependencyReachability.assessConfiguration(configurationInput()), "NOT_CONFIGURED");
  assert.strictEqual(
    dependencyReachability.assessConfiguration(configurationInput({ configurationDomainClosed: false })),
    "UNKNOWN"
  );
  assert.strictEqual(
    dependencyReachability.assessConfiguration(configurationInput({ configurationClosureValid: false })),
    "UNKNOWN"
  );

  // DR-01 through DR-04 and DR-14 through DR-15: connection is independent from presence/reachability.
  assert.strictEqual(
    dependencyReachability.assessConnection(connectionInput({ hasDirectRelation: true, targetResolved: true })),
    "CONNECTED"
  );
  assert.strictEqual(
    dependencyReachability.assessConnection(connectionInput({ hasDirectRelation: true, targetResolved: false, targetPresence: "ABSENT_FROM_CAPTURE" })),
    "DANGLING_REFERENCE"
  );
  assert.strictEqual(dependencyReachability.assessConnection(connectionInput()), "NOT_CONNECTED");
  assert.strictEqual(
    dependencyReachability.assessConnection(connectionInput({ relationshipInspection: completeness("PARTIAL") })),
    "UNKNOWN"
  );
  assert.strictEqual(
    dependencyReachability.assessConnection(connectionInput({ relationshipInspection: completeness("COMPLETE", false) })),
    "UNKNOWN"
  );
  assert.strictEqual(
    dependencyReachability.assessConnection(connectionInput({ unresolvedAliasOrTarget: true })),
    "UNKNOWN"
  );
  assert.strictEqual(
    dependencyReachability.assessConnection(connectionInput({ unsupportedDynamicBehaviorAffectsProposition: true })),
    "UNKNOWN"
  );
  assert.strictEqual(
    dependencyReachability.assessConnection(connectionInput({ hasDirectRelation: true, targetResolved: false, targetPresence: "UNKNOWN" })),
    "UNKNOWN"
  );

  // DR-05 through DR-13: reachability proof and closed-world restraint.
  assert.strictEqual(
    dependencyReachability.assessReachability(reachabilityInput({ deterministicSupportedResolvedPath: true })),
    "REACHABLE_FROM_IDENTIFIED_ENTRYPOINT"
  );
  assert.strictEqual(dependencyReachability.assessReachability(reachabilityInput()), "NOT_REACHABLE_FROM_IDENTIFIED_ENTRYPOINT");
  assert.strictEqual(
    dependencyReachability.assessReachability(reachabilityInput({ unresolvedReachableFrontier: true })),
    "UNKNOWN"
  );
  assert.strictEqual(
    dependencyReachability.assessReachability(reachabilityInput({ relationshipInspection: completeness("PARTIAL") })),
    "UNKNOWN"
  );
  assert.strictEqual(
    dependencyReachability.assessReachability(reachabilityInput({ dependencyResolution: completeness("PARTIAL") })),
    "UNKNOWN"
  );
  assert.strictEqual(
    dependencyReachability.assessReachability(reachabilityInput({ entrypointInventory: completeness("PARTIAL") })),
    "UNKNOWN"
  );
  assert.strictEqual(
    dependencyReachability.assessReachability(reachabilityInput({ unsupportedDynamicBehaviorAffectsProposition: true })),
    "UNKNOWN"
  );
  assert.strictEqual(
    dependencyReachability.assessReachability(reachabilityInput({
      adapterCoverage: adapterCoverage({ dynamicResolution: "UNSUPPORTED" }),
      unsupportedDynamicBehaviorAffectsProposition: true
    })),
    "UNKNOWN"
  );
  assert.strictEqual(
    dependencyReachability.assessReachability(reachabilityInput({
      adapterCoverage: adapterCoverage({ dynamicResolution: "UNKNOWN" }),
      unsupportedDynamicBehaviorAffectsProposition: true
    })),
    "UNKNOWN"
  );
  assert.strictEqual(
    dependencyReachability.assessReachability(reachabilityInput({
      deterministicSupportedResolvedPath: true,
      unrelatedCoveragePartial: true
    })),
    "REACHABLE_FROM_IDENTIFIED_ENTRYPOINT"
  );

  // Executability-from-capture only, never execution-observed.
  assert.strictEqual(dependencyReachability.assessExecutability(executabilityInput()), "EXECUTABLE_FROM_CAPTURE");
  assert.strictEqual(
    dependencyReachability.assessExecutability(executabilityInput({
      allMandatoryPrerequisitesPresentResolved: false,
      blockingPrerequisiteStatus: "ABSENT_FROM_CAPTURE"
    })),
    "NOT_EXECUTABLE_FROM_CAPTURE"
  );
  assert.strictEqual(
    dependencyReachability.assessExecutability(executabilityInput({
      allMandatoryPrerequisitesPresentResolved: false,
      blockingPrerequisiteStatus: "INVALID"
    })),
    "NOT_EXECUTABLE_FROM_CAPTURE"
  );
  assert.strictEqual(
    dependencyReachability.assessExecutability(executabilityInput({
      allMandatoryPrerequisitesPresentResolved: false,
      blockingPrerequisiteStatus: "UNRESOLVABLE"
    })),
    "NOT_EXECUTABLE_FROM_CAPTURE"
  );
  assert.strictEqual(dependencyReachability.assessExecutability(executabilityInput({ mandatoryPrerequisiteModel: "PARTIAL" })), "UNKNOWN");
  assert.strictEqual(dependencyReachability.assessExecutability(executabilityInput({ mandatoryPrerequisiteModel: "UNKNOWN" })), "UNKNOWN");
  assert.strictEqual(dependencyReachability.assessExecutability(executabilityInput({ mandatoryPrerequisiteModel: "NOT_APPLICABLE" })), "UNKNOWN");
  assert.strictEqual(dependencyReachability.assessExecutability(executabilityInput({ adapterCoverageStatus: "PARTIAL" })), "UNKNOWN");
  assert.strictEqual(
    dependencyReachability.assessExecutability(executabilityInput({
      allMandatoryPrerequisitesPresentResolved: false,
      blockingPrerequisiteStatus: "ABSENT_FROM_CAPTURE",
      enumeration: completeness("COMPLETE", false)
    })),
    "UNKNOWN"
  );
  assert.strictEqual(
    dependencyReachability.assessExecutability(executabilityInput({
      allMandatoryPrerequisitesPresentResolved: false,
      blockingPrerequisiteStatus: "ABSENT_FROM_CAPTURE",
      dependencyResolution: completeness("COMPLETE", false)
    })),
    "UNKNOWN"
  );
  assert.strictEqual(dependencyReachability.assessExecutability(executabilityInput({ unsupportedDynamicBehaviorAffectsProposition: true })), "UNKNOWN");
  assert.strictEqual(dependencyReachability.assessExecutability(executabilityInput({ recognizedEntrypointOrExecutionContract: false })), "UNKNOWN");

  // DR-17 Same-name/co-location restraint: superficial similarity is not dependency evidence.
  const sameNameNoDependencyEvidence = {
    presence: dependencyReachability.assessPresence(presenceInput({
      targetResolved: false,
      identificationDeterministic: false,
      enumeration: completeness("UNKNOWN")
    })),
    connection: dependencyReachability.assessConnection(connectionInput({
      hasDirectRelation: false,
      sourceResolved: false,
      targetResolved: false,
      targetPresence: "UNKNOWN",
      relationshipInspection: completeness("UNKNOWN"),
      allRelevantRelationFamiliesInspected: false,
      unresolvedAliasOrTarget: true
    })),
    reachability: dependencyReachability.assessReachability(reachabilityInput({
      deterministicSupportedResolvedPath: false,
      pathEdgesSupported: false,
      entrypointInventory: completeness("UNKNOWN"),
      relationshipInspection: completeness("UNKNOWN"),
      dependencyResolution: completeness("UNKNOWN"),
      adapterCoverage: adapterCoverage({
        relationExtraction: "UNKNOWN",
        dependencyResolution: "UNKNOWN",
        entrypointDiscovery: "UNKNOWN",
        dynamicResolution: "UNKNOWN",
        coverageStatus: "UNKNOWN"
      }),
      unresolvedReachableFrontier: true,
      unsupportedDynamicBehaviorAffectsProposition: true
    }))
  };
  assert.deepStrictEqual(sameNameNoDependencyEvidence, {
    presence: "UNKNOWN",
    connection: "UNKNOWN",
    reachability: "UNKNOWN"
  });
  assertThrowsMessage(
    () => dependencyReachability.assessConnection({
      ...connectionInput({ hasDirectRelation: false }),
      sameFileName: true,
      sameDirectory: true,
      displayName: "shared-name"
    }),
    /SCHEMA_UNSUPPORTED_FIELD:sameFileName/
  );

  // Validation and isolation negative controls.
  assertThrowsMessage(() => dependencyReachability.assessPresence({ ...presenceInput(), extra: true }), /SCHEMA_UNSUPPORTED_FIELD:extra/);
  assertThrowsMessage(() => dependencyReachability.assessPresence({ ...presenceInput(), targetResolved: "true" }), /SCHEMA_UNSUPPORTED_VALUE:targetResolved/);
  assertThrowsMessage(() => dependencyReachability.assessPresence({ ...presenceInput(), enumeration: completeness("NOT_APPLICABLE") }), /SCHEMA_UNSUPPORTED_VALUE:enumeration.status/);
  assertThrowsMessage(() => dependencyReachability.assessConnection({ ...connectionInput(), targetPresence: "MISSING" }), /SCHEMA_UNSUPPORTED_VALUE:targetPresence/);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(dependencyReachability, "assessExecution"), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(dependencyReachability, "assessTemporalState"), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(dependencyReachability, "resolveAuthority"), false);

  const dependencyOutput = dependencyReachabilityOutput();
  assert.strictEqual(dependencyOutput.authority, "NONE");
  assert.strictEqual(dependencyOutput.dependencyStates.length, 5);
  assert(!JSON.stringify(dependencyOutput).includes("EXECUTION_OBSERVED"));
  assert(!JSON.stringify(dependencyOutput).includes("CANONICAL"));
  assert(!JSON.stringify(dependencyOutput).includes("ACCEPTED"));
  assert.deepStrictEqual(dependencyReachabilityOutput(), dependencyOutput);
  assert.deepStrictEqual(
    dependencyReachability.assessDependencyReachability(dependencyEnvelope({ evidenceRefs: ["ev:scan", "ev:dep", "ev:scan"] })),
    dependencyOutput
  );

  const mutationResults = {
    "M-01": dependencyReachability.assessPresence(presenceInput({ enumeration: completeness("COMPLETE", false) })) === "UNKNOWN",
    "M-02": dependencyReachability.assessPresence(presenceInput({ enumeration: completeness("PARTIAL") })) === "UNKNOWN",
    "M-03": dependencyReachability.assessConnection(connectionInput({ hasDirectRelation: true, targetResolved: false, targetPresence: "UNKNOWN" })) === "UNKNOWN",
    "M-04": dependencyReachability.assessConnection(connectionInput({ relationshipInspection: completeness("PARTIAL") })) === "UNKNOWN",
    "M-05": dependencyReachability.assessConnection(connectionInput({ hasDirectRelation: true, targetResolved: false, targetPresence: "UNKNOWN" })) !== "DANGLING_REFERENCE",
    "M-06": dependencyReachability.assessReachability(reachabilityInput({ unresolvedReachableFrontier: true })) === "UNKNOWN",
    "M-07": dependencyReachability.assessReachability(reachabilityInput({ entrypointInventory: completeness("PARTIAL") })) === "UNKNOWN",
    "M-08": dependencyReachability.assessReachability(reachabilityInput({ dependencyResolution: completeness("PARTIAL") })) === "UNKNOWN",
    "M-09": dependencyReachability.assessExecutability(executabilityInput({ mandatoryPrerequisiteModel: "PARTIAL" })) === "UNKNOWN",
    "M-10": dependencyReachability.assessExecutability(executabilityInput({ adapterCoverageStatus: "PARTIAL" })) === "UNKNOWN",
    "M-11": dependencyReachability.assessExecutability(executabilityInput({
      allMandatoryPrerequisitesPresentResolved: false,
      blockingPrerequisiteStatus: "ABSENT_FROM_CAPTURE",
      enumeration: completeness("COMPLETE", false)
    })) === "UNKNOWN",
    "M-12": dependencyReachability.assessReachability(reachabilityInput({ unsupportedDynamicBehaviorAffectsProposition: true })) === "UNKNOWN",
    "M-13": (() => {
      try {
        dependencyReachability.assessPresence({ ...presenceInput(), rulesetVersion: "semantic-evidence-v1.0.0" });
        return false;
      } catch (error) {
        return /UNSUPPORTED_RULESET_VERSION/.test(error.message);
      }
    })(),
    "M-14": (() => {
      try {
        dependencyReachability.assessPresence({ ...presenceInput(), rulesetVersion: "semantic-evidence-v1.0.2" });
        return false;
      } catch (error) {
        return /UNSUPPORTED_RULESET_VERSION/.test(error.message);
      }
    })(),
    "RT-M-01": dependencyReachability.assessRelationshipStatus(relationshipInput({ propositionEvaluable: false })) === "UNKNOWN",
    "RT-M-02": dependencyReachability.assessRelationshipStatus(relationshipInput({
      directEvidence: false,
      inspectedContent: false
    })) === "INSUFFICIENT_EVIDENCE",
    "RT-M-03": dependencyReachability.assessRelationshipStatus(relationshipInput({
      directEvidence: false,
      inspectedContent: false
    })) !== "CONTRADICTED",
    "RT-M-04": dependencyReachability.assessRelationshipStatus(relationshipInput({
      inspectedContent: false,
      identityResolutionStatus: "AMBIGUOUS"
    })) === "POSSIBLE",
    "RT-M-05": dependencyReachability.assessRelationshipStatus(relationshipInput({
      inspectedContent: false,
      aliasTransformations: 1
    })) === "SUPPORTED",
    "RT-M-06": dependencyReachability.assessRelationshipStatus(relationshipInput({
      relationType: "GENERATES",
      directEvidence: false,
      inspectedContent: false,
      singleGeneratesFact: true,
      singleOperationPath: true,
      producerIdentityResolved: true,
      outputIdentityResolved: false,
      noDirectOutputProvenance: true
    })) !== "STRONGLY_SUPPORTED",
    "RT-M-07": dependencyReachability.assessRelationshipStatus(relationshipInput({
      relationType: "GENERATES",
      directEvidence: false,
      inspectedContent: false,
      extensions: { outputExists: true, generatorLibraryExists: true }
    })) !== "PROVEN",
    "RT-M-08": dependencyReachability.assessRelationshipStatus(relationshipInput({
      relationType: "GIT_ANCESTOR_OF",
      directEvidence: false,
      inspectedContent: false,
      extensions: { sameName: true, similarTimestamp: true }
    })) !== "PROVEN",
    "RT-M-09": (() => {
      const record = dependencyReachability.assessRelationshipAssessment(relationshipInput({
        relationType: "COEXISTS_WITH",
        bothMembersEstablished: true,
        sameBoundedScope: true,
        compatibleTemporalFrame: true
      }));
      return !JSON.stringify(record).includes("IMPORTS") &&
        !JSON.stringify(record).includes("CALLS") &&
        !JSON.stringify(record).includes("AUTHORITY");
    })(),
    "RT-M-10": (() => {
      try {
        dependencyReachability.assessRelationshipAssessment(relationshipInput({ evidenceRefs: [] }));
        return false;
      } catch (error) {
        return /SCHEMA_UNSUPPORTED_VALUE:evidenceRefs/.test(error.message);
      }
    })(),
    "RT-M-11": dependencyReachability.assessRelationshipStatus(relationshipInput({ unsupportedAdapterMechanism: true })) === "UNKNOWN",
    "RT-M-12": (() => {
      try {
        dependencyReachability.assessRelationshipStatus({ ...relationshipInput(), unsupportedSemanticField: true });
        return false;
      } catch (error) {
        return /SCHEMA_UNSUPPORTED_FIELD:unsupportedSemanticField/.test(error.message);
      }
    })(),
    "RT-M-13": (() => {
      const a = dependencyReachability.assessRelationshipAssessment(relationshipInput({ evidenceRefs: ["ev:b", "ev:a"] }));
      const b = dependencyReachability.assessRelationshipAssessment(relationshipInput({ evidenceRefs: ["ev:a", "ev:b", "ev:a"] }));
      return a.statementId === b.statementId;
    })(),
    "RT-M-14": dependencyReachability.assessDependencyReachability(dependencyEnvelope()).authority === "NONE"
  };
  for (const [mutationId, detected] of Object.entries(mutationResults)) {
    assert.strictEqual(detected, true, `${mutationId} mutation must be detected`);
  }

  const resolverSource = fs.readFileSync(path.join(repositoryRoot, "scripts", "gt63-machine", "semantic-evidence-resolver.js"), "utf8");
  for (const forbidden of [
    "require(\"fs\")",
    "require('fs')",
    "require(\"path\")",
    "require('path')",
    "process.cwd",
    "process.env",
    "Date.",
    "new Date",
    "performance.now",
    "Math.random",
    "localeCompare",
    "Intl",
    "child_process",
    "exec(",
    "execSync",
    "execFile",
    "spawn",
    "git "
  ]) {
    assert(!resolverSource.includes(forbidden), `semantic resolver must not contain ${forbidden}`);
  }
  assert.strictEqual(true, true, "M-15 forbidden source dependency mutation detected by source scan");

  const first = unit1SemanticOutput();
  const second = unit1SemanticOutput();
  assert.deepStrictEqual(second, first);
  assert.deepStrictEqual(dependencyReachabilityOutput(), dependencyOutput);

  runNodeCheck("scripts/gt63-machine/semantic-canonical.js");
  runNodeCheck("scripts/gt63-machine/semantic-evidence-resolver.js");
  runNodeCheck("scripts/gt63-machine-semantic-evidence-regression.js");

  assert.strictEqual(fs.existsSync(path.join(repositoryRoot, "canonical.json")), false);
  assert.strictEqual(fs.existsSync(path.join(repositoryRoot, "canonical-review.json")), false);

  console.log(JSON.stringify({
    status: "PASS",
    workflow: "semantic-evidence-unit-1-regression",
    trace,
    outputs: {
      ...first,
      dependencyReachability: {
        rulesetVersion: DEP_RULESET_VERSION,
        statementIds: dependencyOutput.dependencyStates.map((record) => record.statementId),
        states: dependencyOutput.dependencyStates.map((record) => `${record.dimension}:${record.dependencyState}`),
        mutationDetection: {
          ...mutationResults,
          "M-15": true
        },
        drTraceability
      },
      relationshipThreshold: {
        rulesetVersion: DEP_RULESET_VERSION,
        rtTraceability: relationshipTraceability,
        sampleStatementId: dependencyReachability.assessRelationshipAssessment(relationshipInput()).statementId
      }
    }
  }, null, 2));
}

main();
