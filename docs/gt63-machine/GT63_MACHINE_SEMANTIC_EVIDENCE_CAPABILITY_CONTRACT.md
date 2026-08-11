# GT63 Machine Semantic Evidence Layer — Capability Contract V1

## 1. Capability Identity

```yaml
capability:
  id: semantic-evidence
  version: 1
  name: GT63 Machine Semantic Evidence Layer
  authority: NONE
  sideEffects: NONE
```

### Purpose

Given normalized, provenance-bound evidence records, artifact classifications, and direct typed relationships, deterministically state what artifact properties and relationships are:

- ESTABLISHED
- SUPPORTED
- POSSIBLE
- UNKNOWN
- CONTRADICTED

without determining or granting:

- canonical truth
- product authority
- governance authority
- candidate acceptance
- lock status
- constitutional status

### Position

```text
repository-scanner
        ↓
evidence-extractor
        ↓
evidence-classifier
        ↓
relationship-mapper
        ↓
semantic-evidence-resolver
        ↓
authority-resolver
        ↓
authority-aware-review-packet
```

### Explicit non-identity

semantic-evidence is not:

- a numbered workflow
- a Product Knowledge subsystem
- a memory store
- an autonomous agent
- an LLM reasoning loop
- a canonicalization engine
- an authority resolver
- a repository scanner

---

## 2. Ownership Matrix

Every derived semantic concept has exactly one primary owner.

| Semantic responsibility | Primary owner | Others may provide |
|---|---|---|
| filesystem/artifact discovery | repository-scanner | provenance inputs |
| native repository facts | repository-scanner | raw Git facts only |
| directly observable artifact facts | evidence-extractor | bytes/content metadata |
| declared identity | evidence-extractor | classifier consumes |
| observed content signatures | evidence-extractor | classifier consumes |
| artifact class | evidence-classifier | no relation inference |
| declared vs observed semantic type | evidence-classifier | resolver consumes |
| direct REFERENCES fact | relationship-mapper | extractor supplies reference fact |
| direct CONFIGURES fact | relationship-mapper | classifier/extractor supply config fact |
| direct IMPORTS fact | relationship-mapper | extractor supplies parsed import |
| direct CALLS fact | relationship-mapper | extractor supplies parsed call |
| direct SERVES fact | relationship-mapper | extractor supplies route/static fact |
| direct GENERATES fact | relationship-mapper | only with observed producer/output linkage facts |
| direct GIT_ANCESTOR_OF fact | relationship-mapper | scanner supplies native Git ancestry fact |
| direct COEXISTS_WITH fact | relationship-mapper | only when both members are established in one bounded scope |
| identityAlignment | semantic-evidence-resolver | upstream facts only |
| dependency state | semantic-evidence-resolver | mapper graph |
| reachability state | semantic-evidence-resolver | mapper graph + completeness |
| executability-from-capture | semantic-evidence-resolver | graph + completeness |
| historical relation assessment | semantic-evidence-resolver | Git/direct relation facts |
| generator attribution assessment | semantic-evidence-resolver | output/generator evidence |
| binary integration assessment | semantic-evidence-resolver | binary/ref/load evidence |
| relationship threshold/status | semantic-evidence-resolver | direct edges only |
| UNKNOWN determination | semantic-evidence-resolver | completeness/provenance |
| semantic conflict determination | semantic-evidence-resolver | normalized propositions |
| governance/product authority | authority-resolver | semantic evidence is input only |
| final review presentation | authority-aware-review-packet | does not independently derive semantics |

### Locked rule

NO TWO COMPONENTS MAY INDEPENDENTLY DERIVE THE SAME CONTRACT SEMANTIC STATE.

For example, relationship-mapper may say:

```text
A IMPORTS "./b"
```

but only semantic-evidence-resolver may say:

```text
connection = DANGLING_REFERENCE
```

Relationship-mapper emits only direct normalized relation facts. It must not emit semantic relationship assessments using:

```text
PROVEN
STRONGLY_SUPPORTED
SUPPORTED
POSSIBLE
INSUFFICIENT_EVIDENCE
CONTRADICTED
UNKNOWN
```

Those relation statuses are owned only by semantic-evidence-resolver.

Direct relation facts use only this V1 fact status vocabulary:

```text
OBSERVED_FACT
PARSE_FAILED
UNRESOLVED_TARGET
UNSUPPORTED_RELATION_FAMILY
```

For Git ancestry:

```text
repository-scanner -> nativeGitFacts
relationship-mapper -> direct GIT_ANCESTOR_OF fact
semantic-evidence-resolver -> GIT_ANCESTOR_OF relationStatus PROVEN
```

For GENERATES, CALLS, and COEXISTS_WITH:

```text
relationship-mapper -> direct observed fact only
semantic-evidence-resolver -> semantic threshold/status only
```

---

## 3. Input Contract

The resolver accepts normalized data only.

It must not receive:

- externalSourcePath
- arbitrary repositoryPath
- filesystem handles
- unrestricted paths
- network URLs for retrieval
- raw archive traversal instructions

### Exact V1 input envelope

```json
{
  "capability": "semantic-evidence",
  "schemaVersion": "1.0",
  "rulesetVersion": "semantic-evidence-v1.0.1",
  "provenanceScopes": [
    {
      "scopeId": "scope:<stable-id>",
      "parentScopeId": null,
      "scopeType": "CAPTURE|REPOSITORY|COMMIT|ARCHIVE|NESTED_ARCHIVE|RUNTIME_OBSERVATION",
      "sourceEvidenceRef": "ev:<id>"
    }
  ],
  "temporalFrames": [
    {
      "temporalFrameId": "time:<stable-id>",
      "scopeId": "scope:<stable-id>",
      "frameType": "CURRENT_BASELINE|HISTORICAL_INTERVAL|COMMIT_FRAME|RUNTIME_OBSERVATION_FRAME|DECLARED_FRAME|UNKNOWN_FRAME",
      "start": "ISO_8601_UTC_INSTANT|null",
      "end": "ISO_8601_UTC_INSTANT|null",
      "baselineRef": "baseline:<stable-id>|null",
      "evidenceRefs": ["ev:<id>"]
    }
  ],
  "captureCompleteness": [
    {
      "scopeId": "scope:<stable-id>",
      "enumeration": "COMPLETE|PARTIAL|UNKNOWN",
      "contentInspection": "COMPLETE|PARTIAL|UNKNOWN",
      "relationshipInspection": "COMPLETE|PARTIAL|UNKNOWN",
      "entrypointInventory": "COMPLETE|PARTIAL|NOT_APPLICABLE|UNKNOWN",
      "dependencyResolution": "COMPLETE|PARTIAL|NOT_APPLICABLE|UNKNOWN",
      "executionEvidenceInspection": "COMPLETE|PARTIAL|NOT_APPLICABLE|UNKNOWN",
      "gitInspection": "COMPLETE|PARTIAL|NOT_APPLICABLE|UNKNOWN",
      "declaredBy": "repository-scanner|evidence-extractor|relationship-mapper",
      "provenanceRefs": ["ev:<id>"],
      "completenessRuleId": "SE-V1-COMP-..."
    }
  ],
  "adapterCoverage": [
    {
      "adapterId": "adapter:<stable-id>",
      "adapterVersion": "string",
      "scopeId": "scope:<stable-id>",
      "artifactFamily": "EXECUTABLE_SOURCE|CONFIGURATION|DOCUMENT|BINARY|ARCHIVE|GIT_HISTORY|GENERATED_OUTPUT",
      "supportedLanguageOrFormat": "string",
      "relationExtraction": "COMPLETE|PARTIAL|NOT_APPLICABLE|UNKNOWN",
      "dependencyResolution": "COMPLETE|PARTIAL|NOT_APPLICABLE|UNKNOWN",
      "entrypointDiscovery": "COMPLETE|PARTIAL|NOT_APPLICABLE|UNKNOWN",
      "mandatoryPrerequisiteModel": "COMPLETE|PARTIAL|NOT_APPLICABLE|UNKNOWN",
      "dynamicResolution": "SUPPORTED|UNSUPPORTED|NOT_APPLICABLE|UNKNOWN",
      "targetNormalizationPolicy": {
        "whitespace": "PRESERVED|TRIM_SURROUNDING",
        "caseSensitivity": "CASE_SENSITIVE|CASE_INSENSITIVE_ASCII",
        "pathNormalization": "NONE|SLASH_DOT_SEGMENTS|BACKSLASH_DOT_SEGMENTS|SLASH_AND_BACKSLASH_DOT_SEGMENTS"
      },
      "coverageStatus": "COMPLETE|PARTIAL|UNKNOWN",
      "evidenceRefs": ["ev:<id>"]
    }
  ],
  "identityResolution": [
    {
      "resolutionId": "idres:<stable-id>",
      "scopeId": "scope:<stable-id>",
      "temporalFrameRef": "time:<stable-id>",
      "sourceId": "<artifact-or-entity-id>",
      "adapterCoverageRef": "adapter:<stable-id>",
      "normalizedTargetKey": "string",
      "resolvedTargetId": "<artifact-or-entity-id>|null",
      "aliases": ["string"],
      "resolutionStatus": "RESOLVED|UNRESOLVED|AMBIGUOUS|CONTRADICTED",
      "crossScopeBridge": {
        "fromScopeId": "scope:<stable-id>",
        "toScopeId": "scope:<stable-id>",
        "bridgeStatus": "BRIDGED|NOT_BRIDGED|AMBIGUOUS|CONTRADICTED",
        "evidenceRefs": ["ev:<id>"]
      },
      "evidenceRefs": ["ev:<id>"]
    }
  ],
  "currentBaselines": [
    {
      "baselineId": "baseline:<stable-id>",
      "scopeId": "scope:<stable-id>",
      "baselineStatus": "CURRENT_BASELINE|NOT_CURRENT_BASELINE|UNKNOWN",
      "evidenceRefs": ["ev:<id>"]
    }
  ],
  "evidenceRecords": [
    {
      "evidenceId": "ev:<stable-id>",
      "scopeId": "scope:<stable-id>",
      "artifactId": "artifact:<stable-id>",
      "evidenceType": "CONTENT_OBSERVATION|FORMAT_SIGNATURE|PARSER_RESULT|CONFIGURATION_FACT|CODE_REFERENCE|CODE_CALL|ROUTE_OR_SERVE_FACT|GIT_HISTORY_FACT|EXECUTION_OBSERVATION|EXECUTION_CLAIM|OUTPUT_PROVENANCE_FACT|BINARY_REFERENCE_FACT|AUTHORITY_CLAIM|IDENTITY_CLAIM|TEMPORAL_FACT|OTHER_SUPPORTED_OBSERVATION",
      "value": {},
      "sourceLocatorRef": "<already-approved provenance locator>",
      "observationStatus": "OBSERVED|PARSE_FAILED|UNREADABLE|UNSUPPORTED"
    }
  ],
  "artifactClassifications": [
    {
      "artifactId": "artifact:<stable-id>",
      "scopeId": "scope:<stable-id>",
      "declaredIdentity": {},
      "observedIdentity": {},
      "classification": "EXECUTABLE_SOURCE|CONFIGURATION|DOCUMENTATION|HTML_DOCUMENT|GENERATED_OUTPUT|BINARY_ARTIFACT|ARCHIVE|REPOSITORY_METADATA|RUNTIME_LOG|DATA_FILE|UNKNOWN_ARTIFACT",
      "evidenceRefs": ["ev:<id>"]
    }
  ],
  "directRelationships": [
    {
      "relationshipId": "rel:<stable-id>",
      "source": "<entity-or-artifact-id>",
      "target": "<entity-or-artifact-id>|null",
      "temporalFrameRef": "time:<stable-id>|null",
      "adapterCoverageRef": "adapter:<stable-id>|null",
      "normalizedTargetKey": "<deterministically-normalized-target-token>|null",
      "identityResolutionRef": "idres:<stable-id>|null",
      "relationType": "<V1 relation>",
      "evidenceRefs": ["ev:<id>"],
      "provenanceScope": "scope:<stable-id>",
      "directOrDerived": "DIRECT",
      "factStatus": "OBSERVED_FACT|PARSE_FAILED|UNRESOLVED_TARGET|UNSUPPORTED_RELATION_FAMILY"
    }
  ]
}
```

### Input invariants

1. All referenced evidence IDs must exist.
2. All scopes must exist.
3. Every relationship must belong to one explicit provenance scope.
4. Every positive direct relationship requires at least one evidence ref.
5. rulesetVersion must equal a supported exact value.
6. Input ordering has no semantic effect.
7. Unknown or unsupported top-level fields cause input validation failure with `SCHEMA_UNSUPPORTED_FIELD`.
8. Unknown or unsupported fields inside V1 objects cause input validation failure with `SCHEMA_UNSUPPORTED_FIELD`.
9. Unknown or unsupported enum values in V1 fields cause input validation failure with `SCHEMA_UNSUPPORTED_VALUE`.
10. The only extension namespace permitted in V1 is `extensions`, and semantic-evidence-resolver must ignore `extensions` entirely for semantic derivation.
11. Resolver cannot open new files or inspect external sources.
12. Same-name alone must not create identity equivalence.
13. Cross-scope identity requires an identityResolution record whose crossScopeBridge.bridgeStatus is BRIDGED.
14. Multiple valid targets for one normalizedTargetKey must produce AMBIGUOUS; the resolver must not choose one arbitrarily.
15. When two or more valid identityResolution records are materially incompatible for the same normalized identity proposition, applicable scope, and temporal frame, resolutionStatus MUST equal CONTRADICTED, a semantic conflict record MUST also be emitted, no target may be selected, all qualifying evidenceRefs MUST be preserved, and conflict identity/order MUST follow Section 14. CONTRADICTED is the resolution status and the conflict record is the required explanatory structural record; they are not alternatives.
16. Every identityResolution record with a normalizedTargetKey must reference one adapterCoverage record through adapterCoverageRef.
17. Every directRelationship with a non-null normalizedTargetKey must reference one adapterCoverage record through adapterCoverageRef.
18. Every identityResolution record must reference exactly one temporalFrames record through temporalFrameRef.
19. Any directRelationship whose semantic assessment depends on temporal comparability must reference a temporalFrames record through temporalFrameRef.

### Temporal Frames

Temporal frames are normalized input. The resolver MUST NOT infer temporal frame from filesystem modification time, ZIP timestamp, filename version, newest-looking document, lexical ordering, process clock, or current system date.

`temporalFrameId` is a stable normalized identifier for one caller-supplied temporal frame. A normalized `temporalFrames` collection MUST NOT contain the same `temporalFrameId` more than once. Any duplicate `temporalFrameId` in one normalized collection is schema-invalid whether the duplicate records are semantically identical, materially conflicting, repeated twice, or repeated three or more times.

Duplicate `temporalFrameId` failure is deterministic:

1. Inspect the complete normalized `temporalFrames` collection.
2. Identify every `temporalFrameId` occurring more than once.
3. Normalize duplicated IDs using the normalized string assumptions already applicable to normalized input.
4. Sort duplicated IDs by frozen canonical Unicode code-point ordering.
5. Select the first canonical duplicated ID.
6. Emit exactly `SCHEMA_UNSUPPORTED_VALUE:duplicateTemporalFrameId:<selected-id>`.

Implementations MUST NOT deduplicate, choose first record, choose last record, merge records, or make duplicate handling depend on array order, first duplicate encountered, last duplicate encountered, record contents, filesystem order, locale, or host environment.

Duplicate-ID adversarial table:

```text
[A, A] -> SCHEMA_UNSUPPORTED_VALUE:duplicateTemporalFrameId:A
[A1, A2 conflicting] -> SCHEMA_UNSUPPORTED_VALUE:duplicateTemporalFrameId:A
[A, A, A] -> SCHEMA_UNSUPPORTED_VALUE:duplicateTemporalFrameId:A
[A, B, A] -> SCHEMA_UNSUPPORTED_VALUE:duplicateTemporalFrameId:A
[A, B, A, B] -> SCHEMA_UNSUPPORTED_VALUE:duplicateTemporalFrameId:<canonical-min(A,B)>
[B, A, B, A] -> same exact error as [A, B, A, B]
[C, B, A, C, B, A] -> SCHEMA_UNSUPPORTED_VALUE:duplicateTemporalFrameId:<canonical-min(A,B,C)>
```

`start` and `end`, when present, MUST be UTC ISO-8601 instants using `YYYY-MM-DDTHH:mm:ssZ`. V1 does not support local time zones, partial dates, relative dates, or implementation-local date parsing inside temporalFrames. Unsupported temporal values produce `SCHEMA_UNSUPPORTED_VALUE`.

Temporal frame comparison is a closed V1.0.1 result:

- `SAME_FRAME`: both references resolve to the same valid `temporalFrameId` in a duplicate-free normalized `temporalFrames` collection.
- `DIFFERENT_FRAME`: both references resolve to valid temporal frames in the same duplicate-free normalized `temporalFrames` collection, their `temporalFrameId` values differ, neither resolved frame has `frameType = UNKNOWN_FRAME`, and `left.scopeId == right.scopeId`.
- `NOT_COMPARABLE`: both references resolve to valid temporal frames and the normalized comparison input explicitly establishes a V1-defined non-comparability condition. Under the closed Unit 3 V1.0.1 comparison input, no positive `NOT_COMPARABLE` condition is currently reachable.
- `UNKNOWN`: either reference is null where required, missing, invalid, not resolvable, the `temporalFrames` collection is invalid at the comparison boundary, either resolved frame has `frameType = UNKNOWN_FRAME` after the resolved IDs are known to differ, or the normalized input lacks information required to determine comparability.

For Unit 3 V1.0.1 temporal-frame comparison, the comparison input is only:

```text
left temporalFrameRef
right temporalFrameRef
temporalFrames[]
rulesetVersion
```

Unit 3 comparison does not consume `provenanceScopes` and MUST NOT infer provenance-scope relationship beyond the raw fields present in the referenced temporal frames. Raw `scopeId` equality establishes that both normalized records belong to the same caller-supplied scope identifier for this comparison. Raw `scopeId` inequality does not establish comparability and does not establish explicit non-comparability. If provenance-scope relationship would be required and no normalized provenance-scope relationship is supplied to this Unit 3 input, the required result is `UNKNOWN`.

Reference identity is evaluated before frame-type comparability. If both references resolve to the same valid `temporalFrameId`, the result is `SAME_FRAME` regardless of `frameType`; this includes `UNKNOWN_FRAME X` compared with `UNKNOWN_FRAME X`. The `UNKNOWN_FRAME` rule applies only after the resolved `temporalFrameId` values are known to be different. Therefore `UNKNOWN_FRAME X` compared with `UNKNOWN_FRAME Y` returns `UNKNOWN`, and `CURRENT_BASELINE X` compared with `UNKNOWN_FRAME Y` returns `UNKNOWN`.

Temporal comparison evaluation order is deterministic:

1. Validate `rulesetVersion`.
2. Validate the duplicate-free `temporalFrames` collection.
3. Resolve both refs.
4. If either ref is unresolved, null where required, or invalid, return `UNKNOWN`.
5. If both refs resolve to the same valid `temporalFrameId`, return `SAME_FRAME`.
6. If resolved IDs differ and either frame has `frameType = UNKNOWN_FRAME`, return `UNKNOWN`.
7. If resolved IDs differ and `left.scopeId == right.scopeId`, return `DIFFERENT_FRAME`.
8. If resolved IDs differ and `left.scopeId != right.scopeId`, return `UNKNOWN`.
9. `NOT_COMPARABLE` is unreachable under the current Unit 3 V1.0.1 normalized input unless a future ruleset introduces an explicit normalized non-comparability condition.

Temporal comparison table:

```text
same valid non-UNKNOWN frame ref vs itself -> SAME_FRAME
same valid UNKNOWN_FRAME ref vs itself -> SAME_FRAME
different valid frame IDs + same scopeId + neither frameType UNKNOWN_FRAME -> DIFFERENT_FRAME
different valid frame IDs + different scopeId -> UNKNOWN
different valid frame IDs + same scopeId + one UNKNOWN_FRAME -> UNKNOWN
different valid frame IDs + same scopeId + both UNKNOWN_FRAME -> UNKNOWN
missing/null/unresolvable reference -> UNKNOWN
invalid temporalFrames collection -> comparison prerequisite invalid; comparison result must not be guessed; UNKNOWN at comparison boundary where comparison API handles invalid collection
explicit NOT_COMPARABLE -> currently UNREACHABLE in Unit 3 V1.0.1 closed input domain unless a future ruleset introduces an explicit normalized non-comparability condition
```

Identity contradiction may be emitted only when temporal comparison for the affected identityResolution records is `SAME_FRAME`. `DIFFERENT_FRAME` does not automatically create conflict. `NOT_COMPARABLE` and `UNKNOWN` preserve UNKNOWN for temporal comparability and MUST NOT be upgraded to same-frame by implementation judgment.

### Closed V1 Input Vocabularies

`evidenceType` is a closed V1 vocabulary:

- CONTENT_OBSERVATION
- FORMAT_SIGNATURE
- PARSER_RESULT
- CONFIGURATION_FACT
- CODE_REFERENCE
- CODE_CALL
- ROUTE_OR_SERVE_FACT
- GIT_HISTORY_FACT
- EXECUTION_OBSERVATION
- EXECUTION_CLAIM
- OUTPUT_PROVENANCE_FACT
- BINARY_REFERENCE_FACT
- AUTHORITY_CLAIM
- IDENTITY_CLAIM
- TEMPORAL_FACT
- OTHER_SUPPORTED_OBSERVATION

`classification` is a closed V1 vocabulary:

- EXECUTABLE_SOURCE
- CONFIGURATION
- DOCUMENTATION
- HTML_DOCUMENT
- GENERATED_OUTPUT
- BINARY_ARTIFACT
- ARCHIVE
- REPOSITORY_METADATA
- RUNTIME_LOG
- DATA_FILE
- UNKNOWN_ARTIFACT

Unsupported enum values are not coerced to UNKNOWN and are not ignored. They produce `SCHEMA_UNSUPPORTED_VALUE`. Unsupported fields remain `SCHEMA_UNSUPPORTED_FIELD`.

### Direct Relationship Target Representation

For `factStatus = OBSERVED_FACT`, `target` MUST contain the resolved entity or artifact ID. `identityResolutionRef` MUST reference the identityResolution record that resolved the target when target resolution was required; otherwise it is null. `normalizedTargetKey` MUST preserve the originally observed normalized token when the source text declares one, including after resolution.

For `factStatus = UNRESOLVED_TARGET`, `target` MUST be null, `normalizedTargetKey` MUST contain the deterministically normalized unresolved token, and `identityResolutionRef` MUST reference the relevant identityResolution record whose resolutionStatus is UNRESOLVED, AMBIGUOUS, or CONTRADICTED. The unresolved token MUST NOT be represented as a synthetic entity ID, artifact ID, guessed target, or alternate target field.

`normalizedTargetKey` is formed as a Unicode NFC UTF-8 semantic string by applying the referenced adapterCoverage.targetNormalizationPolicy. Cross-scope resolution is forbidden unless bridge evidence is present in identityResolution.

If the same observed token later resolves in the same normalized input set, the direct relationship representation changes only by setting `target` to the resolved entity or artifact ID, setting `factStatus = OBSERVED_FACT`, and preserving `normalizedTargetKey` as the originally observed normalized token.

`relationshipId` is the stable direct relation fact identity. It MUST NOT be derived from `target` alone and MUST NOT change merely because target resolution changes. `relationshipId` is derived as:

```text
rel:<sha256-lowerhex(canonical-direct-relation-fact-identity)>
```

The canonical direct relation fact identity uses the Section 4 canonical serialization rules and includes exactly:

- capability = `semantic-evidence`;
- schemaVersion = `1.0`;
- rulesetVersion;
- provenanceScope;
- temporalFrameRef or null;
- source;
- relationType;
- normalizedTargetKey;
- adapterCoverageRef or null;
- directOrDerived;
- canonical sorted evidenceRefs that support the original observed direct relation token.

The canonical direct relation fact identity excludes `relationshipId`, `target`, `factStatus`, `identityResolutionRef`, semantic relationStatus, conflict status, and identityResolution evidenceRefs. Evidence that supports target resolution belongs in identityResolution and MUST NOT change the direct relationship identity.

Resolution transitions:

- Unique later resolution: the same `relationshipId` is retained; `target` becomes the resolved entity or artifact ID; `normalizedTargetKey` remains unchanged; `factStatus` becomes `OBSERVED_FACT`.
- Ambiguous later resolution: the same `relationshipId` is retained; `target` remains null; `normalizedTargetKey` remains unchanged; `factStatus` remains `UNRESOLVED_TARGET`; identityResolutionRef points to an AMBIGUOUS identityResolution record.
- Contradicted later resolution: the same `relationshipId` is retained; `target` remains null; `normalizedTargetKey` remains unchanged; `factStatus` remains `UNRESOLVED_TARGET`; identityResolutionRef points to a CONTRADICTED identityResolution record and conflict semantics apply.
- Cross-scope bridge resolution: the same `relationshipId` is retained only when the normalizedTargetKey, provenanceScope, temporalFrameRef, source, relationType, adapterCoverageRef, directOrDerived, and original direct relation evidenceRefs are unchanged and identityResolution.crossScopeBridge.bridgeStatus is BRIDGED.
- Resolution later revoked by contradictory evidence: the same `relationshipId` is retained; `target` returns to null; `normalizedTargetKey` remains unchanged; `factStatus` becomes `UNRESOLVED_TARGET`; the contradictory identityResolution and conflict records preserve all qualifying evidence. Prior evidence MUST NOT be arbitrarily deleted.

### Target Normalization Policy

normalizedTargetKey derivation is a pure deterministic function of:

```text
rulesetVersion
+ observed target token
+ adapterCoverageRef
+ the complete targetNormalizationPolicy contained in that exact adapterCoverage record
+ provenanceScope
+ temporalFrameRef where present
+ Section 4 canonical serialization rules
```

adapterCoverage MUST contain the complete applicable targetNormalizationPolicy as normalized input data. identityResolution and directRelationships MUST reference the exact adapterCoverage record used for key derivation. No resolver may consult external adapter implementation, runtime environment, operating system, filesystem, hidden registry, language defaults, installed adapter library, process working directory, locale, or hidden adapter policy to determine whitespace, case, or path normalization.

If two adapterCoverage records contain different targetNormalizationPolicy values, they are different normalized semantic inputs. Two conforming implementations receiving the same adapterCoverage object MUST derive the same normalizedTargetKey.

The derivation order is fixed:

1. Interpret the observed target token as a normalized V1 semantic string and normalize it to Unicode NFC.
2. Apply whitespace policy.
3. Apply case policy.
4. Apply path-normalization policy.
5. The resulting string is normalizedTargetKey.

Whitespace policy:

- `PRESERVED`: preserve all leading, trailing, and internal code points after NFC.
- `TRIM_SURROUNDING`: remove only surrounding ASCII whitespace code points U+0009, U+000A, U+000B, U+000C, U+000D, and U+0020. Internal whitespace is preserved.

Case policy:

- `CASE_SENSITIVE`: preserve code points after whitespace normalization.
- `CASE_INSENSITIVE_ASCII`: convert only ASCII `A` through `Z` to `a` through `z`. All non-ASCII code points remain unchanged after NFC. Generic locale-dependent case folding is forbidden.

Path-normalization policy:

- `NONE`: no path separator conversion, dot-segment processing, root handling, drive handling, or filesystem resolution is performed.
- `SLASH_DOT_SEGMENTS`: treat only U+002F `/` as a recognized separator and emit U+002F `/` as the canonical output separator. U+005C `\` is ordinary content.
- `BACKSLASH_DOT_SEGMENTS`: treat only U+005C `\` as a recognized separator and emit U+005C `\` as the canonical output separator. U+002F `/` is ordinary content.
- `SLASH_AND_BACKSLASH_DOT_SEGMENTS`: treat U+002F `/` and U+005C `\` as recognized separators and emit U+002F `/` as the canonical output separator.

For every pathNormalization mode other than `NONE`, path normalization is purely lexical and uses this exact operation order:

1. Apply configured whitespace policy.
2. Apply configured caseSensitivity policy.
3. Determine recognized separators for the selected pathNormalization mode.
4. Record whether the token begins with one or more recognized separators.
5. Split lexically on recognized separators.
6. Remove empty segments created by repeated recognized separators.
7. Remove empty segments created by trailing recognized separators.
8. Remove `.` segments.
9. Process `..` segments by removing the immediately preceding retained normal segment when one exists; preserve unresolved leading `..` segments.
10. Rebuild using exactly one canonical separator between retained segments.
11. If the token began with one or more recognized separators, preserve this as exactly one leading canonical separator.
12. Remove any trailing canonical separator unless the entire normalized result is exactly the single root separator.
13. Empty input remains the empty string.
14. A token containing only recognized separators normalizes to exactly one canonical root separator.
15. Derive normalizedTargetKey only after lexical normalization is complete.

Empty segments caused by repeated recognized separators, leading separators beyond the first, or trailing separators do not survive as semantic path segments.

Examples for `SLASH_DOT_SEGMENTS`:

```text
a//b -> a/b
a//b/ -> a/b
//a///b/ -> /a/b
/ -> /
// -> /
a//./b -> a/b
a//../b -> b
a/../ -> ""
/a//../b/ -> /b
```

Examples for `BACKSLASH_DOT_SEGMENTS`:

```text
a\\b\\ -> a\b
a\\\\b -> a\b
\\a\\b\\ -> \a\b
\ -> \
\\ -> \
a\\.\b -> a\b
a\\..\b -> b
a\..\ -> ""
\a\\..\b\ -> \b
```

Examples for `SLASH_AND_BACKSLASH_DOT_SEGMENTS`:

```text
a\b/c -> a/b/c
a\\b//c/ -> a/b/c
\\a//b\ -> /a/b
/ -> /
\ -> /
// -> /
\\ -> /
/\ -> /
\/ -> /
```

For all four pathNormalization modes, empty input `""` normalizes to `""`; it MUST NOT become `.`, `/`, `\`, null, or any other value. Under `NONE`, no separator parsing or dot-segment normalization occurs and the token remains unchanged after whitespace/case normalization.

Leading recognized separators are lexical only. One or more leading recognized separators become exactly one leading canonical separator and MUST NOT imply POSIX root semantics, Windows root semantics, UNC path semantics, network share semantics, filesystem existence, or authority.

Dot-segment processing is purely lexical. It must not use host path APIs, filesystem casing, symlink resolution, current working directory, drive-current-directory rules, UNC handling, home-directory expansion, URL decoding, environment variables, or platform defaults.

If normalizedTargetKey derivation requires targetNormalizationPolicy and the policy is missing, invalid, unsupported, ambiguous, or not referenced by adapterCoverageRef, schema validation fails before semantic derivation. Missing required policy fields use `SCHEMA_UNSUPPORTED_FIELD`; invalid or unsupported enum values use `SCHEMA_UNSUPPORTED_VALUE`. The resolver MUST NOT invent a default and MUST NOT derive a key from local environment behavior.

### Completeness Declaration Ownership

Completeness declarations are normalized upstream evidence.

Ownership:

- `repository-scanner` may declare `enumeration`, `gitInspection`, and repository-scope `entrypointInventory`.
- `evidence-extractor` may declare `contentInspection` and adapter-observed parse coverage.
- `relationship-mapper` may declare `relationshipInspection` and dependency graph coverage only from normalized relation facts.
- No other component may declare COMPLETE, PARTIAL, UNKNOWN, or NOT_APPLICABLE for V1 completeness dimensions.

Every completeness declaration must include:

- `declaredBy`;
- `provenanceRefs`;
- `completenessRuleId`;
- the exact scopeId.

semantic-evidence-resolver must validate completeness schema, owner, scope, and provenance references. It trusts valid upstream completeness declarations as normalized input, but it must not independently upgrade PARTIAL or UNKNOWN to COMPLETE.

If completeness provenance is missing, invalid, owned by the wrong component, or references missing evidence, that dimension is treated as UNKNOWN for semantic derivation and the resolver emits an UNKNOWN record with derivationRuleId `SE-V1-COMP-INVALID`.

Unproven completeness must not enable any negative semantic conclusion.

### Adapter Coverage

Adapter coverage is normalized input, not implementation environment knowledge.

semantic-evidence-resolver must derive reachability and executability only from `adapterCoverage` records supplied in the input. It must not infer adapter capability from installed packages, runtime platform, file extension, filename, or local implementation behavior.

If a required language, dependency mechanism, entrypoint model, mandatory prerequisite model, or dynamic resolution behavior is outside declared adapter coverage, the affected reachability or executability proposition is UNKNOWN.

Two conforming implementations receiving identical adapterCoverage, evidence, relationships, identityResolution, captureCompleteness, provenanceScopes, and rulesetVersion must produce identical semantic states.

---

## 4. Output Contract

### Exact V1 output envelope

```json
{
  "capability": "semantic-evidence",
  "schemaVersion": "1.0",
  "rulesetVersion": "semantic-evidence-v1.0.1",
  "authority": "NONE",
  "artifactStates": [],
  "dependencyStates": [],
  "historicalRelations": [],
  "outputProvenance": [],
  "binaryIntegration": [],
  "relationshipAssessments": [],
  "unknowns": [],
  "conflicts": []
}
```

Every derived record must contain:

```json
{
  "statementId": "sem:<deterministic-id>",
  "semanticState": "ESTABLISHED|SUPPORTED|POSSIBLE|UNKNOWN|CONTRADICTED",
  "evidenceRefs": ["ev:<id>"],
  "provenanceScope": "scope:<id>",
  "temporalFrameRef": "time:<id>|null",
  "derivationRuleId": "SE-V1-...",
  "rulesetVersion": "semantic-evidence-v1.0.1"
}
```

No numeric confidence score exists in V1.

### Deterministic Statement IDs

`statementId` is derived as:

```text
sem:<sha256-lowerhex(canonical-semantic-statement)>
```

Canonical semantic statement serialization:

1. Use UTF-8 bytes.
2. Normalize all strings to Unicode NFC before serialization.
3. Object keys sort by ascending Unicode code point.
4. Null serializes as JSON `null`.
5. Booleans serialize as JSON `true` or `false`.
6. Numbers are not permitted in V1 semantic identity material unless a field explicitly defines an integer; permitted integers serialize as base-10 without leading zeroes.
7. Arrays that are semantically ordered preserve order only when the field explicitly states ordered semantics.
8. Set-like arrays, including `evidenceRefs`, `aliases`, relation member sets, and scope reference sets, sort by ascending Unicode code point after NFC normalization and deduplicate exact strings.
9. Strings use JSON string escaping exactly as RFC 8259 JSON, with no optional escaping except required control characters and quotation/backslash.
10. The hash algorithm is SHA-256.
11. Hex output is lowercase.

The canonical semantic statement used for `statementId` excludes `statementId` itself and includes:

- capability;
- schemaVersion;
- rulesetVersion;
- output collection name;
- semantic proposition kind;
- source/target/artifact/entity identifiers;
- semanticState;
- relationStatus where present;
- derivationRuleId;
- provenanceScope;
- sorted evidenceRefs;
- normalized state-specific fields.

Implementation-specific JSON serialization must not influence statementId.

For relation-specific assessments, add:

```json
{
  "relationStatus": "PROVEN|STRONGLY_SUPPORTED|SUPPORTED|POSSIBLE|INSUFFICIENT_EVIDENCE|CONTRADICTED|UNKNOWN"
}
```

Mapping:

- PROVEN → ESTABLISHED
- STRONGLY_SUPPORTED → SUPPORTED
- SUPPORTED → SUPPORTED
- POSSIBLE → POSSIBLE
- INSUFFICIENT_EVIDENCE → UNKNOWN
- UNKNOWN → UNKNOWN
- CONTRADICTED → CONTRADICTED

Freeform explanation may be added by Review Packet presentation later, but freeform text cannot be the only representation of a semantic conclusion.

---

## 5. Artifact Identity Rules

Each artifact identity record contains declaredIdentity, observedIdentity, and identityAlignment.

Allowed alignment states:

- MATCH
- MISMATCH
- PARTIAL_MATCH
- NOT_COMPARABLE
- UNKNOWN

Semantic type precedence:

```text
validated parser / structural signature
>
magic bytes / format signature
>
validated content syntax
>
declared MIME
>
extension
>
filename label
```

The declared identity remains evidence of declaration even when observed identity differs.

`declaredIdentity` has this V1 shape:

```json
{
  "declaredType": "string|null",
  "declaredMime": "string|null",
  "extension": "string|null",
  "filenameLabel": "string|null",
  "evidenceRefs": ["ev:<id>"]
}
```

`observedIdentity` has this V1 shape:

```json
{
  "observedType": "string|null",
  "observationKind": "VALIDATED_PARSER|MAGIC_BYTES|VALIDATED_SYNTAX|DECLARED_MIME|EXTENSION|FILENAME_LABEL",
  "parserId": "adapter:<stable-id>|null",
  "parserVersion": "string|null",
  "observationStatus": "OBSERVED|PARSE_FAILED|UNREADABLE|UNSUPPORTED|CONFLICTING|UNKNOWN",
  "evidenceRefs": ["ev:<id>"]
}
```

For different precedence observations, the highest qualifying observed evidence determines `observedIdentity.observedType`; lower-precedence declarations remain preserved and may create `identityAlignment = MISMATCH`.

For equal-precedence incompatible qualifying observations, the resolver must not choose one parser arbitrarily. It must:

- set `observedIdentity.observationStatus = CONFLICTING`;
- set `observedIdentity.observedType = null`;
- set `identityAlignment = UNKNOWN`;
- create one conflict record with all incompatible evidenceRefs;
- sort conflict evidenceRefs by canonical evidence-ref order.

If one parser result is later invalidated in normalized input with `observationStatus = PARSE_FAILED`, it is not a qualifying observation and the remaining qualifying observation may determine observedIdentity.

Example:

```text
extension = .json
observed semanticType = HTML
identityAlignment = MISMATCH
```

---

## 6. Dependency / Reachability Rules

These dimensions are independent.

Presence:
PRESENT | ABSENT_FROM_CAPTURE | UNKNOWN

Configuration:
CONFIGURED | NOT_CONFIGURED | UNKNOWN

Connection:
CONNECTED | DANGLING_REFERENCE | NOT_CONNECTED | UNKNOWN

Reachability:
REACHABLE_FROM_IDENTIFIED_ENTRYPOINT | NOT_REACHABLE_FROM_IDENTIFIED_ENTRYPOINT | UNKNOWN

Executability:
EXECUTABLE_FROM_CAPTURE | NOT_EXECUTABLE_FROM_CAPTURE | UNKNOWN

Execution:
EXECUTION_OBSERVED | EXECUTION_CLAIMED | EXECUTION_NOT_OBSERVED | UNKNOWN

Temporal state:
CURRENT | HISTORICAL | SUPERSEDED | CONFLICTING | UNKNOWN

Rules:

- PRESENT requires target resolution inside the relevant scope.
- ABSENT_FROM_CAPTURE requires the capture-completeness gate.
- CONFIGURED requires a valid parsed configuration relation.
- CONNECTED requires a direct relation plus target resolution.
- DANGLING_REFERENCE requires a direct dependency/reference whose target is ABSENT_FROM_CAPTURE under sufficiently complete capture.
- NOT_CONNECTED is only a scoped graph conclusion and never a historical-global conclusion.
- REACHABLE requires a deterministic path composed only of supported resolved executable/configuration edges.
- NOT_REACHABLE requires complete entrypoint inventory, relationship inspection, and dependency resolution, with no unresolved frontier capable of changing the result.
- EXECUTABLE_FROM_CAPTURE requires all mandatory local prerequisites declared by matching adapterCoverage.mandatoryPrerequisiteModel == COMPLETE to be present/resolved, adapterCoverage.coverageStatus == COMPLETE for the relevant artifact family/scope, and no known blocking incompleteness.
- NOT_EXECUTABLE_FROM_CAPTURE requires a deterministically mandatory execution prerequisite defined by adapterCoverage to be missing/invalid/unresolvable under a closed enough capture.
- Unsupported dynamic dependency behavior forces UNKNOWN for any proposition whose truth depends on that dynamic behavior.
- EXECUTION_OBSERVED requires direct execution evidence tied to artifact/version/scope.
- EXECUTION_CLAIMED is claim-only evidence.
- EXECUTION_NOT_OBSERVED means not observed in the inspected execution-evidence scope, never never-executed.
- CURRENT requires a `currentBaselines` record with `baselineStatus = CURRENT_BASELINE` for the same scope and supporting evidenceRefs.
- SUPERSEDED requires explicit replacement/supersession evidence; newer timestamp alone is insufficient.

---

## 7. Capture Completeness Rules

Negative conclusions require sufficiently closed inspected scope.

ABSENT_FROM_CAPTURE may be emitted only when capture.enumeration == COMPLETE for the relevant scope and target identification is deterministic; otherwise UNKNOWN.

NOT_CONNECTED requires relationshipInspection == COMPLETE for all relevant V1 relation families and resolved source/target identities; otherwise UNKNOWN.

NOT_REACHABLE_FROM_IDENTIFIED_ENTRYPOINT requires:

```text
entrypointInventory == COMPLETE
relationshipInspection == COMPLETE
dependencyResolution == COMPLETE
```

with no unresolved reachable-frontier edges.

NOT_EXECUTABLE_FROM_CAPTURE requires:

1. recognized entrypoint/execution contract;
2. matching adapterCoverage.mandatoryPrerequisiteModel == COMPLETE;
3. sufficient enumeration/resolution completeness;
4. deterministic blocking prerequisite missing/invalid.

Completeness values are usable only when the corresponding captureCompleteness record has valid `declaredBy`, `provenanceRefs`, `completenessRuleId`, and scope. Invalid completeness provenance downgrades only that dimension to UNKNOWN for semantic derivation.

Never infer:

```text
ABSENT_FROM_CAPTURE → NEVER_EXISTED
NOT_REACHABLE_IN_CAPTURE → NEVER_RAN
NO_ANCESTRY_IN_INSPECTED_REPOSITORY → NO_HISTORICAL_RELATIONSHIP ANYWHERE
```

---

## 8. Relationship Vocabulary

V1 is locked to exactly:

- REFERENCES
- CONFIGURES
- IMPORTS
- CALLS
- SERVES
- GENERATES
- GIT_ANCESTOR_OF
- COEXISTS_WITH

Not included in V1:

- DERIVED_FROM
- RENAMED_TO
- SUPERSEDES

Every positive relationship requires evidenceRefs and an explicit provenanceScope.

No evidence refs → no positive relation.

---

## 9. Relationship Thresholds

There is no universal confidence algorithm.

All statuses in this section are assigned only by semantic-evidence-resolver. relationship-mapper provides direct normalized facts with `factStatus`, not semantic relationStatus.

REFERENCES:
- PROVEN when direct unambiguous reference to resolved target appears in inspected content.
- SUPPORTED when resolution relies on one identityResolution record with resolutionStatus RESOLVED and exactly one alias transformation.
- POSSIBLE when token/name similarity is not uniquely resolvable.

CONFIGURES:
- PROVEN when parsed configuration explicitly maps to a target/entrypoint.
- SUPPORTED when config meaning is clear but target resolution partial.

IMPORTS:
- PROVEN as a declared code relation when syntactically valid supported-language import/require explicitly names the target token.
- Target presence is separately resolved.

CALLS:
- PROVEN when a statically resolved direct call unambiguously targets the callable or direct execution evidence demonstrates the call.
- SUPPORTED when a direct call fact exists and identityResolution has exactly one RESOLVED target through one alias transformation.
- POSSIBLE when a direct call-like token exists but identityResolution is AMBIGUOUS.

SERVES:
- PROVEN when executable/config structure explicitly registers route/static root/handler/equivalent.

GENERATES:
- PROVEN for a specific output only with direct output-linked provenance.
- STRONGLY_SUPPORTED only when all are true: exactly one GENERATES direct fact names the output class or output locator; exactly one CONFIGURES or CALLS path connects the producer artifact to the output-producing operation; identityResolution for producer and output is RESOLVED; capture completeness for relationshipInspection and contentInspection is COMPLETE; no direct output-linked execution/provenance record exists.
- Claimed generator alone never reaches PROVEN.
- If any one of those STRONGLY_SUPPORTED conditions is missing, the state is GENERATOR_UNKNOWN unless another exact V1 threshold applies.

GIT_ANCESTOR_OF:
- PROVEN when valid native Git traversal establishes A ∈ ancestors(B) inside the same validated repository identity.

COEXISTS_WITH:
- PROVEN when both entities/artifacts are independently established within the same sufficiently bounded provenance/temporal scope.
- Coexistence does not imply import, call, integration, identity, lineage, or authority.
- COEXISTS_WITH requires a direct fact emitted from one bounded scope; resolver must not synthesize all-pairs coexistence.

Generic statuses:
PROVEN | STRONGLY_SUPPORTED | SUPPORTED | POSSIBLE | INSUFFICIENT_EVIDENCE | CONTRADICTED | UNKNOWN

---

## 10. Git / Historical Rules

Repository-history quality:
VALID_NATIVE_HISTORY | PARTIAL_NATIVE_HISTORY | INVALID_OR_UNREADABLE | UNKNOWN

Git relationship states:
SAME_COMMIT | GIT_ANCESTOR_OF | GIT_DESCENDANT_OF | DIVERGED_FROM_COMMON_ANCESTOR | NO_ANCESTRY_IN_INSPECTED_REPOSITORY | UNKNOWN

Rules:

- SAME_COMMIT requires commit identity equality.
- GIT_ANCESTOR_OF requires native traversal proof.
- GIT_DESCENDANT_OF is the inverse of proven ancestry.
- DIVERGED_FROM_COMMON_ANCESTOR requires valid common ancestor and neither commit being ancestor of the other.
- NO_ANCESTRY_IN_INSPECTED_REPOSITORY requires sufficiently complete inspected history.
- Every Git statement includes repositoryScopeId.
- Git ancestry does not automatically become product lineage.

---

## 11. Generated Output Rules

Output existence:
OUTPUT_EXISTS | OUTPUT_CLAIMED | OUTPUT_NOT_FOUND | UNKNOWN

Generator attribution:
GENERATOR_PROVEN | GENERATOR_STRONGLY_SUPPORTED | GENERATOR_CLAIMED | GENERATOR_UNKNOWN | GENERATOR_CONFLICTING

GENERATOR_PROVEN requires direct producer/output linkage.

GENERATOR_STRONGLY_SUPPORTED requires the exact threshold defined in Section 9. No numeric confidence or freeform judgment may produce this state.

Explicit prohibition:

```text
output exists + library exists ≠ generator proven
```

---

## 12. Binary Integration Rules

Presence:
BINARY_PRESENT | BINARY_NOT_FOUND | UNKNOWN

Inspectability:
IDENTIFIED | PARTIALLY_IDENTIFIED | OPAQUE

Integration:
REFERENCED | LOADED_BY_CODE | EXECUTION_OBSERVED | NO_INTEGRATION_EVIDENCE | UNKNOWN

NO_INTEGRATION_EVIDENCE means no qualifying integration edge was found in the relevant inspected evidence; it does not mean historically unused.

If relevant binary integration inspection is PARTIAL and the missing portion could contain a qualifying reference, load, or execution observation, integration state MUST be UNKNOWN.

NO_INTEGRATION_EVIDENCE may be emitted only when the relevant integration evidence domain has relationshipInspection == COMPLETE, contentInspection == COMPLETE where source references matter, executionEvidenceInspection == COMPLETE or NOT_APPLICABLE for execution-specific claims, and matching adapterCoverage does not report unsupported integration mechanisms.

---

## 13. Unknown Rules

Machine MUST emit UNKNOWN when a material prerequisite for deterministic classification is absent, including:

- evidence class not inspected;
- insufficient capture completeness;
- ambiguous provenance;
- parse failure without deterministic fallback;
- opaque binary for the proposition;
- unresolved relation target;
- unavailable execution evidence;
- unresolved current/historical applicability;
- insufficient output-producer linkage;
- unsafe same-name identity unification;
- unbridged nested provenance scope;
- unsupported dynamic dependency behavior.

Locked invariants:

```text
UNKNOWN != false
UNKNOWN != contradiction
UNKNOWN != candidate
UNKNOWN != unsupported fact
```

UNKNOWN alone must never create candidate knowledge.

INSUFFICIENT_EVIDENCE is for an evaluated proposition whose threshold is not met.
UNKNOWN is for a proposition that cannot be sufficiently evaluated.

---

## 14. Conflict Rules

A semantic conflict exists only when all are true:

1. same relevant semantic entity/proposition;
2. same applicable provenance scope or explicitly comparable scopes;
3. temporal comparison is SAME_FRAME when temporal comparability affects the proposition;
4. materially incompatible evidence states;
5. incompatibility is not merely a difference in evidence strength.

DIFFERENT_FRAME does not automatically create conflict. NOT_COMPARABLE and UNKNOWN temporal comparisons must not produce conflict unless another non-temporal V1 conflict rule independently applies.

Conflict IDs and ordering must be deterministic.

Equal-precedence parser disagreement for one artifact semantic identity is a semantic conflict when two or more qualifying observations have the same precedence level and incompatible observedType values.

Conflict record ordering:

1. provenanceScope;
2. proposition kind;
3. artifactId/entityId;
4. conflict type;
5. canonical sorted evidenceRefs.

Conflict IDs use the same canonical serialization and SHA-256 lowerhex rule as statementId, with prefix `conflict:`.

---

## 15. Positive Proof Rules

A. Native Git ancestry:
If valid native traversal establishes A ∈ ancestors(B), emit GIT_ANCESTOR_OF with status PROVEN and semanticState ESTABLISHED within the validated repository scope. No caution downgrade is permitted.

B. Configuration:
If successfully parsed configuration explicitly maps an execution/configuration target, CONFIGURES = PROVEN. Reachability remains independent.

C. Static import:
If supported executable syntax contains a valid direct import/require, IMPORTS = PROVEN as a declared code relation.

Then independently:

```text
target present → CONNECTED
target absent under closed capture → DANGLING_REFERENCE
scope incomplete → UNKNOWN
```

---

## 16. Negative Restraint Rules

The resolver MUST reject these implications:

```text
filename -X→ observed semantic identity
code exists -X→ execution observed
UI says PRODUCTION -X→ deployed
PDF exists + PDF library exists -X→ generator proven
same name -X→ same entity
same name + later timestamp -X→ lineage
binary exists -X→ integrated
binary referenced -X→ execution observed
runtime control -X→ governance authority
Git ancestry -X→ product lineage outside validated identity scope
MASTER/CANON/LOCKED/FINAL/SOURCE OF TRUTH -X→ established authority
no evidence found -X→ proposition false
```

---

## 17. Evidence Precedence

There is no global source ranking. Precedence is proposition-specific.

Artifact semantic identity:
validated parser/structural signature > magic bytes/format signature > validated content syntax > declared MIME > extension > filename label.

Different-precedence disagreement is handled by precedence, not by semantic conflict. The lower-precedence observation remains preserved as evidence and may produce `identityAlignment = MISMATCH`.

Equal-precedence incompatible qualifying observations are handled by Section 5 and Section 14 conflict behavior; no parser may win solely because of adapter order, filesystem order, array order, or implementation preference.

Runtime execution:
version-bound runtime observation/telemetry > version-bound execution/test record > reachable executable implementation + runtime configuration > executable source existence > documentation/UI execution claim > filename.

Dependency:
version-bound runtime call trace > direct parsed executable/config relation > supported static relation inference > documentation claim > same-name/co-location.

Git/history for repository ancestry:
validated native Git graph > contemporary migration evidence corroborated by code identity > file-hash/code continuity > artifact timestamp ordering > retrospective history > name similarity.

Deployment:
provider/deployment record tied to version > CI/CD deployment record > deployment log > deployment configuration > UI/document production claim.

Generator attribution:
output-linked execution/provenance record > validated producer/output trace > strong unique code-path correlation > documentary generator claim > library co-presence.

Mandatory invariant:

```text
EVIDENTIARY STRENGTH != GOVERNANCE AUTHORITY
```

---

## 18. Determinism / Ruleset Versioning

semantic-evidence-resolver is a pure function of:

- normalized evidence records
- artifact classifications
- direct relationship graph
- capture completeness metadata
- provenance scopes
- temporal frames
- completeness provenance
- adapter coverage
- identity resolution records
- target normalization policy records through adapterCoverage
- current baseline records
- ruleset version

Same normalized input + same supported ruleset must produce semantically and structurally identical output.

No wall-clock time, randomness, environment-dependent lookup, network access, LLM judgment, freeform model classification, or unordered filesystem behavior may determine V1 foundational semantic states.

All output arrays and evidence refs sort deterministically.

Ruleset:

```text
semantic-evidence-v1.0.1
```

Any change that alters evidence threshold, state derivation, relation semantics, precedence, negative-conclusion rule, or UNKNOWN policy requires a new ruleset version.

---

## 19. Workflow #8 Compatibility

```text
WORKFLOW_8_COMPATIBILITY_REVIEW_REQUIRED
```

Repository evidence inspected for this contract correction:

- `docs/gt63-machine/GT63_MACHINE_AUTHORITY_AWARE_EVIDENCE_REVIEW_EXECUTION_CONTRACT.md` defines Workflow #8's Review Packet output fields.
- The inspected contract does not explicitly authorize additive `semanticEvidence` output.
- The inspected contract also does not contain a dedicated semantic-evidence compatibility clause.

Conclusion:

The repository evidence is sufficient to require a compatibility review before adding semanticEvidence to Workflow #8 output, but it is not sufficient to prove that a narrow amendment is already mandatory.

If a future review determines that Workflow #8's locked output schema is closed, the future amendment may only permit Workflow #8 to consume semantic-evidence-v1 output and expose it under one defined semanticEvidence member.

It must not alter Workflow #8 authority, reviewRequired semantics, candidate safety, canonical behavior, or existing status semantics.

---

## 20. Workflow #6/#7 Preservation

No semantic capability rule may alter Workflow #6 or #7.

Workflow #6 remains owner of external source validation, supported/unsupported intake policy, containment, staging, archive safety, source immutability, hashing, intake manifest, and eligibility.

Workflow #7 remains owner of manifest validation, staged snapshot validation, eligibility bridge, downstream Machine invocation, provenance preservation, and scanner truncation reporting.

Git inspection, if later implemented, must operate only on already approved/staged evidence scope.

Never:

```text
semantic resolver → arbitrary filesystem Git discovery
```

---

## 21. Regression Contract

Mandatory positive assertions:

```text
DECLARED_AND_OBSERVED_IDENTITY_CAN_DIFFER == true
SEMANTIC_MISMATCH_CAN_BE_ESTABLISHED == true
VALID_CONFIG_CAN_PROVE_CONFIGURES == true
VALID_STATIC_IMPORT_CAN_PROVE_IMPORTS == true
MISSING_TARGET_IN_COMPLETE_CAPTURE_CAN_CREATE_DANGLING_REFERENCE == true
NATIVE_GIT_ANCESTRY_CAN_BE_PROVEN == true
INCOMPATIBLE_IDENTITY_RESOLUTION_EMITS_CONTRADICTED_AND_CONFLICT == true
UNRESOLVED_TARGET_HAS_NULL_TARGET_AND_NORMALIZED_TARGET_KEY == true
UNSUPPORTED_ENUM_VALUE_FAILS_SCHEMA_VALIDATION == true
IDENTITY_CONTRADICTION_REQUIRES_SAME_TEMPORAL_FRAME == true
TARGET_NORMALIZATION_POLICY_IS_BOUND_TO_ADAPTER_COVERAGE == true
DIRECT_RELATION_ID_STABLE_ACROSS_TARGET_RESOLUTION == true
PATH_NORMALIZATION_EMPTY_SEGMENTS_ARE_DETERMINISTIC == true
```

Mandatory restraint assertions:

```text
CODE_EXISTS_IMPLIES_EXECUTION == false
GIT_SCOPE_ESCAPES_REPOSITORY == false
SAME_NAME_PROVES_LINEAGE == false
OUTPUT_EXISTS_PROVES_GENERATOR == false
BINARY_EXISTS_PROVES_INTEGRATION == false
RUNTIME_CONTROL_GRANTS_AUTHORITY == false
UNKNOWN_COLLAPSES_TO_FALSE == false
```

Regression is semantic, not prose-based. Positive and negative mutation tests must demonstrate state transitions without filename-specific hardcoding.

---

## 22. Overfitting Controls

V1 semantic rules MUST NOT contain fixture-specific conditions involving real fixture filenames, product/brand names, specific commit hashes, or specific libraries.

Language/file-format adapters may be syntax-specific but must emit generic normalized facts.

The semantic resolver itself remains language-neutral.

Any semantic rule referring to a real test fixture filename or brand name fails contract conformance.

---

## 23. Relationship Explosion Controls

No all-pairs inference.

A relationship candidate may exist only when at least one trigger is present:

- direct reference
- resolved dependency token
- native Git relationship
- explicit migration statement
- output provenance link
- configured path

No trigger → NO RELATION CANDIDATE.

No unrestricted transitivity.

No product-lineage derivation exists in V1.

---

## 24. Authority Firewall

semantic-evidence-resolver may never emit governance states such as:

- CANONICAL
- ACCEPTED
- AUTHORIZED
- LOCKED
- GOVERNING
- APPROVED_PRODUCT_TRUTH
- CONSTITUTIONAL

Forbidden authority transformations:

```text
PROVEN runtime relationship -X→ governance authority
VALID Git history -X→ canonical authority
CURRENT runtime -X→ current product truth
MASTER/CANON content -X→ authority
```

Authority processing remains outside this capability in authority-resolver.

```text
semantic-evidence authority = NONE
Machine Authority = NONE
```

---

## 25. Side-Effect Boundary

The capability is pure/read-only.

Forbidden side effects include Product Knowledge write, Historical Knowledge write, Travel Knowledge write, runtime business-state write, canonical promotion, candidate acceptance/rejection, Constitution modification, Governance modification, Lock modification, repository mutation, Git checkout/reset/commit, push, deploy, network request, external source read outside approved normalized input, and filesystem discovery.

The resolver may not create canonical.json or canonical-review.json.

---

## 26. Future Implementation Surface

No implementation is authorized.

Smallest plausible future surface:

CREATE:

```text
scripts/gt63-machine/semantic-evidence-resolver.js
```

Possible modifications only after ownership review:

- evidence-extractor.js
- evidence-classifier.js
- relationship-mapper.js
- authority-aware-review-packet.js
- repository-scanner.js only if safe staged Git fact extraction is otherwise impossible

Must not modify for this capability:

- Workflow #6 implementation semantics
- Workflow #7 implementation semantics
- Product Knowledge
- GT63 Core
- HOME
- Travel Knowledge Layer

---

## 27. Remaining Ambiguities

A. Supported-language completeness: NOT_REACHABLE depends on declared adapterCoverage input. This is a caller/upstream coverage responsibility, not resolver-discovered policy.

B. Dynamic loading: unresolved dynamic dependency paths force UNKNOWN unless deterministically modeled.

C. GENERATES specificity: generator-can-produce-type-X and generator-produced-artifact-Y remain separate propositions. V1 thresholds define only output-specific attribution states.

D. Temporal CURRENT: caller must provide currentBaselines input. Resolver must not choose current by newest timestamp.

E. Workflow #8 exact schema: repository evidence does not prove additive compatibility or mandatory amendment. `WORKFLOW_8_COMPATIBILITY_REVIEW_REQUIRED` is the V1 conclusion until a separate Workflow #8 compatibility decision is authorized.

---

## 28. Contract Review Questions

1. Can two conforming implementations disagree on artifact identity state? No, given identical normalized facts, parser outcomes, and ruleset version.
2. Can they disagree on dependency completeness? No, given identical valid provenance-bound captureCompleteness metadata, adapterCoverage, identityResolution, and relationship graph.
3. Can they disagree on Git ancestry? No, for valid identical native repository facts under same scope/ruleset and valid completeness provenance.
4. Can they disagree on output generator attribution? No, if normalized producer/output evidence is identical.
5. Can they disagree on binary integration? No, given the same normalized reference/load/execution facts and integration-inspection completeness.
6. Can they disagree on UNKNOWN vs negative conclusion? No; provenance-bound capture completeness and UNKNOWN gates define this.
7. Can they produce different relation status for the same normalized evidence? No, for V1 relation types and same ruleset.
8. Can runtime evidence gain authority accidentally? Not in a conforming implementation.
9. Can nested Git evidence escape provenance scope? No.
10. Can relationship generation explode? Not in a conforming implementation; trigger required and unrestricted transitivity prohibited.
11. Can implementation begin without inventing semantic policy? After targeted independent re-review and approval: yes.
12. Is Workflow #8 amendment required? Not established by current repository evidence. Workflow #8 compatibility review is required before adding semanticEvidence to Workflow #8 output.

---

## 29. Final Verdict

```text
PASS — READY_FOR_TARGETED_RE_REVIEW_6
```

The V1 contract defines a bounded capability that can deterministically move GT63 Machine from observed files and direct relationships to evidence-semantic statements about what is established, supported, possible, unknown, or contradicted, while preserving:

```text
Authority = NONE

Evidence != Inference
Inference != Candidate
Candidate != Accepted Knowledge

Execution != Authority
Filename != Semantic Identity
Coexistence != Lineage
Absence of Evidence != Evidence of Absence

No canonical promotion
No uncontrolled writes
```

Implementation authorization: NONE.
Machine Authority: NONE.
