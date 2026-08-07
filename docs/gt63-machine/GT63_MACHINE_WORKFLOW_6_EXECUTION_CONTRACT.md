# GT63 Machine - Workflow #6 Execution Contract

## Status

DRAFT - CORRECTION PASS 11

## Workflow

#6 - External Artifact Intake

## Direction Authority

`docs/gt63-machine/GT63_MACHINE_WORKFLOW_6_DIRECTION.md`

## Direction Status

Accepted / Locked Direction

## Authority

NONE

## Purpose

Define the execution boundary for safely ingesting one explicitly supplied external artifact source without weakening the existing workspace-containment guarantees of GT63 Machine Workflows #1-#5B.

This contract defines behavior only.

It does not authorize implementation.

It does not modify existing workflows.

It does not grant canonical, governance, lock, product, candidate-decision, or repository-truth authority.

---

## 1. Problem

Current GT63 Machine workflows intentionally require `repositoryPath` to resolve inside the active workspace.

External artifact sets therefore return:

```text
INPUT_PATH_INVALID
```

This behavior is correct under the existing contracts.

Workflow #6 must not weaken or bypass that protection.

Workflow #6 introduces a separate controlled intake boundary between external evidence and the existing Machine workspace.

---

## 2. Core Principle

External artifacts are evidence.

They are not repository truth.

They are not canonical knowledge.

They are not trusted input merely because a human supplied them.

Workflow #6 transforms one explicitly supplied external source into a deterministic evidence snapshot and manifest when the source passes intake safety rules.

---

## 3. Authority Boundary

Workflow #6 may:

- inspect one explicitly supplied external source;
- validate the external source boundary;
- inventory artifacts;
- stage approved artifacts into the Workflow #6 staging root;
- calculate hashes;
- record provenance;
- report unreadable, unsupported, and rejected artifacts;
- produce one intake manifest JSON document.

Workflow #6 may not:

- create canonical knowledge;
- accept or reject candidate knowledge;
- modify Constitution;
- modify Governance;
- modify Locks;
- modify Product Truth;
- modify existing repository evidence;
- write to the external source;
- authorize implementation decisions;
- infer that external evidence applies to GT63;
- run Workflows #1-#5B directly against arbitrary external paths.

---

## 4. Input Contract

Workflow #6 accepts one explicit external source per execution.

The runtime input field is exactly:

```json
{
  "workflow": "external-artifact-intake",
  "externalSourcePath": "<string>"
}
```

Supported source classes:

1. `directory`
2. `file`
3. `zip`

The `externalSourcePath` value must:

- be a non-empty string;
- resolve successfully with platform-native absolute path resolution;
- exist;
- be readable;
- not be a rejected network-path syntax;
- not be a drive root;
- not be a symlink, junction, or reparse-point root;
- pass safety validation before traversal, copy, or extraction.

Workflow #6 must never perform implicit discovery of arbitrary external folders.

Workflow #6 must never scan parent directories, sibling directories, user home directories, drives, or network locations unless that exact directory or file is supplied as `externalSourcePath` and passes this contract.

Rejected network-path syntax is exact:

- starts with `//`;
- starts with `\\`;
- starts with `//?/UNC/`;
- starts with `\\?\UNC\`;
- starts with `file://`;
- starts with `smb://`;
- starts with `nfs://`.

Mapped drives are not classified as network paths by Workflow #6 because portable network-backed-drive detection is not deterministic. If a mapped drive is supplied and is not a drive root, it is treated by syntax only.

If `externalSourcePath` is missing, non-string, empty, nonexistent, unreadable, rejected network-path syntax, a drive root, root symlink/reparse point, or an unsupported direct input type, the workflow must produce the pre-staging failure manifest defined in the Manifest Contract section.

---

## 5. Source Path Normalization

All path normalization in this contract is deterministic and must occur before source classification, intake ID derivation, manifest serialization, path comparison, and staging-root containment checks.

For external absolute source paths:

1. Resolve the supplied path to an absolute path using platform-native lexical resolution.
2. Do not follow symlinks, junctions, or reparse points to derive identity.
3. Convert all `\` separators to `/`.
4. Remove trailing `/` except when the path is a drive root.
5. On Windows, uppercase the drive letter.
6. Apply Unicode normalization form NFC to the full normalized string.
7. Preserve all other path-segment case exactly.

Examples:

- `c:\Data\Aya\` becomes `C:/Data/Aya`.
- `C:/Data/../Data/Aya` becomes `C:/Data/Aya`.

UNC and rejected network-path syntax are rejected before intake ID derivation.

Drive roots are rejected before intake ID derivation.

For manifest relative paths:

1. Use `/` separators.
2. Apply Unicode normalization form NFC.
3. Preserve segment case exactly.
4. Reject paths with drive letters, UNC prefixes, leading `/`, `..` segments, empty segments, trailing `/`, or backslashes.
5. Reject paths longer than 240 characters after normalization.

---

## 6. Deterministic Discovery Order

Discovery order is defined before applying `maxDiscoveredArtifacts`.

Direct file:

- discovery set contains exactly one candidate artifact;
- `sourceRelativePath` is the basename of the normalized source path.

Directory tree:

- recursively discover entries under the supplied directory without following symlinks, junctions, or reparse points;
- ordinary directory entries are structural only and never become artifact records;
- ordinary directory entries do not contribute to `summary.totalDiscovered`;
- empty ordinary directories are not represented in the manifest;
- if an ordinary structural directory cannot be enumerated because of permissions or I/O error, stop discovery, set status `FAIL`, add one failure record with code `EXTERNAL_INPUT_UNREADABLE`, use the normalized directory-relative path as `failures[].path`, create no artifact record for that structural directory, and remove `snapshot` during failure cleanup;
- symlink, junction, reparse-point, and special-file directory entries are artifact records because they require a disposition;
- compute each candidate artifact's normalized `sourceRelativePath` relative to the supplied source directory;
- sort candidate artifacts by normalized `sourceRelativePath` using the Path Ordering and Collision Rules section.
- process candidates in that sorted order.

Zip archive:

- read the central directory metadata without extracting entries;
- compute a universal ZIP discovery key for every central-directory entry before artifact processing;
- the universal ZIP discovery key is an ordered tuple defined below;
- the universal ZIP discovery key is used for decoded safe entries, decoded unsafe entries, and decoding-failed entries;
- the universal ZIP discovery key is not a manifest field;
- after computing the universal ZIP discovery key, attempt filename decoding and path normalization according to the Archive Safety section;
- archive physical entry order is not semantic;
- sort candidate entries by universal ZIP discovery key before applying any artifact disposition, safety rejection, or `maxDiscoveredArtifacts` boundary.
- process candidates in that sorted order.

Universal ZIP discovery key tuple:

1. raw central-directory filename bytes encoded as lowercase hex;
2. general-purpose bit flags as four lowercase hex digits;
3. compression method as four lowercase hex digits;
4. CRC-32 value as eight lowercase hex digits, or `null` if absent;
5. compressed size as a base-10 integer string, or `null` if absent;
6. uncompressed size as a base-10 integer string, or `null` if absent;
7. internal file attributes as four lowercase hex digits;
8. external file attributes as eight lowercase hex digits;
9. central-directory extra field SHA-256 as lowercase hex, or `null` if absent;
10. central-directory file comment SHA-256 as lowercase hex, or `null` if absent;
11. local-header validation key;
12. compressed entry data SHA-256 as lowercase hex, or `null` if compressed bytes cannot be read before extraction.

The tuple is compared field by field in the exact order above using ordinal Unicode code-point order.

The universal ZIP discovery key must not include:

- physical central-directory index;
- local-header offset;
- extraction order;
- library enumeration order;
- timestamp;
- host OS;
- random value.

Compressed entry data SHA-256 for discovery ordering is computed from the compressed bytes referenced by the ZIP entry without extracting the entry into staging.

If compressed bytes cannot be read for key construction, the key field is `null`; this does not by itself create an artifact failure. Any later artifact unreadability or decompression failure is handled by the artifact disposition rules.

The local-header validation key is computed before `maxDiscoveredArtifacts` selection and before artifact disposition:

- read only the local file header bytes referenced by the central-directory entry;
- do not extract payload bytes into staging for this key;
- if the local header is present, well-formed, and its raw filename bytes, compression method, and general-purpose flags match the central-directory entry, the key is `OK:<sha256>`, where `<sha256>` is the SHA-256 of the exact local header byte sequence consisting of the fixed local file header, local filename bytes, and local extra field bytes;
- if the local header is missing, the key is `ERROR:MISSING`;
- if the local header is truncated, the key is `ERROR:TRUNCATED`;
- if the local header is malformed, the key is `ERROR:MALFORMED`;
- if raw filename bytes disagree, the key is `ERROR:FILENAME_MISMATCH`;
- if compression method disagrees, the key is `ERROR:COMPRESSION_METHOD_MISMATCH`;
- if general-purpose flags disagree, the key is `ERROR:FLAGS_MISMATCH`;
- any selected artifact whose local-header validation key begins with `ERROR:` is later `REJECTED` with reason and failure code `ZIP_MEMBER_INTEGRITY_REJECTED`.

If two or more entries have identical universal ZIP discovery key tuples, they are a deterministic indistinguishable-entry group. Entries in such a group may be internally ordered arbitrarily only because all contract-visible ordering fields, including local-header validation outcome, are identical. If `maxDiscoveredArtifacts` cuts through an indistinguishable-entry group, include as many group members as fit before the boundary; the manifest remains deterministic because the included and excluded members have identical contract-visible ordering keys and cannot later diverge solely because of local-header integrity validation.

Filesystem enumeration order and zip physical-entry order must not affect manifest semantics.

---

## 7. Supported Format Policy

The supported file-extension allowlist is exactly:

- `.css`
- `.csv`
- `.html`
- `.htm`
- `.js`
- `.json`
- `.md`
- `.pdf`
- `.txt`

The supported archive-format allowlist is exactly:

- `.zip`

Extension derivation is deterministic:

1. take the final basename after `/` normalization;
2. if the basename contains no `.` character, the extension is `null`;
3. if the basename begins with exactly one `.` and contains no other `.`, the extension is `null`;
4. otherwise, the extension is the substring from the final `.` character through the end of the basename;
5. if the final `.` is the last character of the basename, the extension is `null`;
6. lowercase the extension using ASCII lowercase for `A` through `Z` only;
7. compare the resulting lowercase extension to the allowlists above.

Examples:

- `.md` has extension `null`;
- `file.` has extension `null`;
- `file..md` has extension `.md`;
- `archive.tar.md` has extension `.md`;
- `README` has extension `null`.

Extension comparison is case-insensitive by the ASCII lowercase rule above.

Manifest extensions are lowercase.

Files without an extension are `UNSUPPORTED` with reason `UNSUPPORTED_EXTENSION`.

Any file extension outside the allowlist is `UNSUPPORTED` with reason `UNSUPPORTED_EXTENSION`.

Nested archives are not extracted. A `.zip` discovered inside a directory or inside another `.zip` archive is recorded as `UNSUPPORTED` with reason `NESTED_ARCHIVE_UNSUPPORTED`.

Unsupported artifacts must not be silently ignored.

Direct-file input behavior:

- if the supplied source is an individual file with an allowed non-archive extension, it is eligible for staging;
- if the supplied source is an individual `.zip`, it is source class `zip`;
- if the supplied source is an individual file with any other extension, the workflow must return `FAIL` with failure code `EXTERNAL_INPUT_TYPE_UNSUPPORTED` and must not create staging.

---

## 8. Resource Limits

The implementation must use these exact constants:

```json
{
  "maxSourceArchiveBytes": 52428800,
  "maxExtractedTotalBytes": 209715200,
  "maxDiscoveredArtifacts": 5000,
  "maxIndividualFileBytes": 26214400,
  "maxArchiveNestingDepth": 1,
  "maxNormalizedRelativePathLength": 240
}
```

Definitions:

- `maxSourceArchiveBytes`: maximum byte size of the supplied `.zip` archive.
- `maxExtractedTotalBytes`: maximum total bytes staged from all staged artifacts.
- `maxDiscoveredArtifacts`: maximum number of artifact records allowed in the manifest.
- `maxIndividualFileBytes`: maximum byte size for one staged artifact.
- `maxArchiveNestingDepth`: outer archive only. Nested archive extraction is not supported.
- `maxNormalizedRelativePathLength`: maximum normalized manifest relative path length in characters.

When discovery would exceed `maxDiscoveredArtifacts`, the workflow must:

1. record exactly the first 5000 artifact records in deterministic discovery order;
2. perform artifact disposition, duplicate normalized path detection, and case-collision detection only within those first 5000 recorded artifact records;
3. do not use candidates beyond the first 5000 to change the status, reason, failure membership, hashes, or byte counts of the first 5000 artifact records;
4. add one failure record with code `FILE_COUNT_LIMIT_EXCEEDED`;
5. set `summary.limitViolations` to include `FILE_COUNT_LIMIT_EXCEEDED`;
6. set status to `FAIL`;
7. remove `snapshot` during failure cleanup.

The manifest is not required to enumerate artifacts beyond the first 5000 once this limit is exceeded.

Any safety or resource-limit violation produces status `FAIL`.

No downstream workflow may consume a failed intake.

Supplied ZIP archive size:

- after source path normalization and source kind detection, read source archive metadata size;
- if source kind is `zip` and `sourceSizeBytes` is greater than `maxSourceArchiveBytes`, do not acquire staging ownership;
- do not parse the central directory;
- do not inspect archive members;
- emit a stdout-only failure manifest;
- `intakeId` is known and must be derived from the normalized source path and archive metadata size;
- status: `FAIL`;
- failure code: `ARCHIVE_SIZE_LIMIT_EXCEEDED`;
- `summary.limitViolations`: [`ARCHIVE_SIZE_LIMIT_EXCEEDED`];
- `summary.totalSourceBytes`: `sourceSizeBytes`;
- this rule overrides the generic pre-staging failure summary numeric-field rule in the Manifest Contract section;
- `artifacts`: `[]`;
- downstream eligibility: `NOT_ELIGIBLE`;
- stop execution.

---

## 9. Resource-Limit Disposition

Artifact classification precedence is deterministic:

1. safety/path/link/special-file rejection;
2. unsupported format classification;
3. unreadable classification;
4. resource-limit checks for artifacts that are otherwise eligible for staging;
5. staging.

Resource-limit checks do not convert an `UNSUPPORTED` artifact into `REJECTED`.

An oversized unsupported file remains `UNSUPPORTED`.

An oversized nested ZIP remains `UNSUPPORTED` with reason `NESTED_ARCHIVE_UNSUPPORTED`.

Unsupported artifacts are never staged.

Ordinary unsupported artifacts are never hashed.

Nested unsupported ZIP artifacts are the only unsupported-artifact hashing exception: if their bytes can be read safely without violating resource limits, `sourceHash` is SHA-256 of the nested ZIP bytes.

Resource-limit detection must occur before reading or staging bytes whenever source metadata provides the required size.

Individual file size:

- if a direct file, directory artifact, or ZIP member has known size greater than `maxIndividualFileBytes`, create one artifact record;
- artifact status: `REJECTED`;
- artifact reason: `FILE_SIZE_LIMIT_EXCEEDED`;
- artifact source size: known size;
- artifact staged size/hash fields: `null`;
- source hash: `null`;
- add one failure record with code `FILE_SIZE_LIMIT_EXCEEDED`;
- status: `FAIL`;
- stop processing additional artifacts.

Total staged bytes:

- before staging an artifact, compute `currentTotalStagedBytes + candidateSizeBytes` when `candidateSizeBytes` is known;
- if the sum would exceed `maxExtractedTotalBytes`, create one artifact record for the candidate;
- artifact status: `REJECTED`;
- artifact reason: `TOTAL_BYTE_LIMIT_EXCEEDED`;
- artifact source size: known size;
- artifact staged size/hash fields: `null`;
- source hash: `null`;
- add one failure record with code `TOTAL_BYTE_LIMIT_EXCEEDED`;
- status: `FAIL`;
- stop processing additional artifacts.

Unknown size while streaming:

- if size is unavailable and a streaming read exceeds `maxIndividualFileBytes`, stop reading immediately and use `FILE_SIZE_LIMIT_EXCEEDED`;
- if cumulative staged bytes exceed `maxExtractedTotalBytes` during streaming, stop reading immediately and use `TOTAL_BYTE_LIMIT_EXCEEDED`;
- partial bytes from the violating artifact must not remain in `snapshot`;
- source hash and staged hash for the violating artifact are `null`.

Portable source-stability policy:

- for every source file that may be staged, capture pre-read byte size;
- read the bytes;
- capture post-read byte size;
- do not inspect platform file identity fields for source-mutation decisions;
- if byte size differs between pre-read and post-read metadata, reject the artifact with reason `SOURCE_MUTATION_DETECTED`;
- same-size source replacement is outside Workflow #6's portable mutation-detection guarantee and must not produce different status solely because platform identity metadata is available;
- source mutation creates one failure record with code `SOURCE_MUTATION_DETECTED`;
- source hash, staged hash, and staged size are `null` for the mutated artifact;
- status: `FAIL`;
- stop processing additional artifacts.

Supplied outer ZIP stability:

- capture supplied ZIP byte size before central-directory parsing;
- if the byte size differs from the metadata size used in the intake ID seed, fail with `SOURCE_MUTATION_DETECTED`;
- capture supplied ZIP byte size again after central-directory parsing and before member processing;
- capture supplied ZIP byte size again after all member processing completes;
- if any captured ZIP byte size differs from the intake ID seed `sourceSizeBytes`, fail with `SOURCE_MUTATION_DETECTED`;
- do not inspect platform file identity fields for ZIP source-mutation decisions;
- do not retry after source mutation.

---

## 10. Source Size Semantics

`sourceSizeBytes` in the intake ID seed is defined exactly:

- for `file`: byte size from the source file metadata;
- for `zip`: byte size from the source archive file metadata;
- for `directory`: `null`.

`summary.totalSourceBytes` is the deterministic sum of source byte contributions:

- `STAGED`: source byte size;
- `UNSUPPORTED`: source byte size from metadata when available, otherwise `0`;
- `UNREADABLE`: `0`;
- metadata-rejected oversized file: source byte size from metadata;
- partially streamed file rejected by a limit: bytes successfully consumed before the limit violation;
- source-mutation rejection: `0`;
- ZIP member `STAGED`: uncompressed member byte size;
- ZIP member `UNSUPPORTED`: uncompressed member byte size from central-directory metadata when available, otherwise `0`;
- ZIP member `UNREADABLE`: `0`;
- ZIP member `REJECTED` before byte streaming: `0`;
- ZIP member `REJECTED` for integrity validation after byte streaming begins: `0`;
- supplied outer ZIP over `maxSourceArchiveBytes`: supplied ZIP metadata byte size;
- supplied outer ZIP within limit: `0`, because supplied outer ZIP is a container and not an artifact.

`summary.totalStagedBytes` is the sum of staged artifact byte sizes only.

---

## 11. Staging Root Policy

The Workflow #6 staging root is inside the active repository workspace at:

```text
tmp/gt63-machine-intake
```

The existing bootstrap config ignores `tmp`; therefore existing Workflows #1-#5B must not scan the staging root during normal repository scans.

Before any cleanup, lock creation, directory creation, copy, extraction, finalization, or manifest write, the implementation must validate the staging-root trust boundary.

The staging-root trust boundary is valid only when:

- repository workspace root is the active repository root;
- `tmp` is absent or is a direct directory;
- `tmp` is not a symlink, junction, reparse point, file, device, or special filesystem object;
- `tmp/gt63-machine-intake` is absent or is a direct directory;
- `tmp/gt63-machine-intake` is not a symlink, junction, reparse point, file, device, or special filesystem object;
- every existing ancestor or target used under `tmp/gt63-machine-intake` is verified with non-following metadata APIs before use.

If the staging-root trust boundary is invalid, the workflow must fail before any staging write or cleanup operation.

Failure result:

- status: `FAIL`;
- failure code: `STAGING_ROOT_UNTRUSTED`;
- stdout-only pre-staging failure manifest;
- no file writes.

Each intake execution uses deterministic directories:

```text
tmp/gt63-machine-intake/incomplete-<intakeId>
tmp/gt63-machine-intake/<intakeId>
tmp/gt63-machine-intake/lock-<intakeId>
```

The active staging directory is:

```text
tmp/gt63-machine-intake/incomplete-<intakeId>
```

The finalized staging directory is:

```text
tmp/gt63-machine-intake/<intakeId>
```

The snapshot directory is:

```text
tmp/gt63-machine-intake/incomplete-<intakeId>/snapshot
```

before finalization and:

```text
tmp/gt63-machine-intake/<intakeId>/snapshot
```

after finalization.

The manifest path is:

```text
tmp/gt63-machine-intake/incomplete-<intakeId>/manifest.json
```

before finalization and:

```text
tmp/gt63-machine-intake/<intakeId>/manifest.json
```

after finalization.

Before creating, deleting, copying, renaming, or writing any path under staging, the implementation must resolve the candidate path and verify that it remains inside:

```text
tmp/gt63-machine-intake
```

No staging operation may occur outside that directory.

---

## 12. Staging Collision and Concurrency Policy

Workflow #6 uses one exact concurrency state machine:

```text
VALIDATE_STAGING_ROOT
-> DETERMINE_INTAKE_ID
-> INSPECT_LOCK_INCOMPLETE_FINALIZED_STATE
-> ACQUIRE_OWNERSHIP_OR_FAIL_CLOSED
-> PREPARE_OWNED_INCOMPLETE_STATE
-> STAGE
-> WRITE_MANIFEST
-> FINALIZE
-> RELEASE_OWNERSHIP
-> CLEAN_UP_ONLY_OWNED_STATE
```

No process may delete, overwrite, rename, or modify another potentially active intake before acquiring ownership.

Ownership is established only by exclusive creation of:

```text
tmp/gt63-machine-intake/lock-<intakeId>
```

Lock state inspection happens after staging-root validation and intake ID determination, but before any cleanup.

State combinations:

| lock | incomplete | finalized | behavior |
|---|---|---|---|
| absent | absent | absent | acquire lock and proceed |
| absent | absent | present | acquire lock, verify finalized path containment, delete finalized, proceed |
| absent | present | absent | acquire lock, verify incomplete path containment, delete incomplete, proceed |
| absent | present | present | acquire lock, verify both paths, delete incomplete then finalized, proceed |
| present | absent | absent | fail closed with `INTAKE_ALREADY_RUNNING` |
| present | absent | present | fail closed with `INTAKE_ALREADY_RUNNING` |
| present | present | absent | fail closed with `INTAKE_ALREADY_RUNNING` |
| present | present | present | fail closed with `INTAKE_ALREADY_RUNNING` |

If lock creation fails for any reason other than pre-existing lock, status is `FAIL` with failure code `STAGING_FAILURE`.

Lock acquisition:

- create `tmp/gt63-machine-intake/lock-<intakeId>` using exclusive directory creation;
- if the lock directory already exists, return the pre-staging failure manifest with status `FAIL`, failure code `INTAKE_ALREADY_RUNNING`, known `intakeId`, known `sourceKind`, known `sourcePath`, and no staging writes;
- remove the lock directory during normal cleanup.

Existing finalized directory policy:

- if `tmp/gt63-machine-intake/<intakeId>` exists before a new non-concurrent run, delete that finalized directory after verifying it is inside `tmp/gt63-machine-intake`;
- then create a fresh `incomplete-<intakeId>` directory;
- never merge with or reuse existing finalized data.

Finalization:

- after manifest finalization, atomically rename `incomplete-<intakeId>` to `<intakeId>`;
- if the rename fails, status is `FAIL` with failure code `STAGING_FINALIZATION_FAILED`;
- failed finalization must remove `snapshot` if possible and keep only a failure manifest where safely possible.

Concurrent identical intakes are not both allowed to proceed. The first lock holder proceeds. Any competing execution that observes the existing lock fails deterministically with `INTAKE_ALREADY_RUNNING`.

No stale-lock recovery is performed by Workflow #6.

Lock directories are never deleted unless they were created by the current execution.

---

## 13. Cleanup Policy

Cleanup is deterministic and outcome-specific.

For `PASS`:

- keep finalized `<intakeId>/snapshot`;
- keep finalized `<intakeId>/manifest.json`;
- remove `lock-<intakeId>`;
- remove temporary extraction workspace if separate from `snapshot`.

For `PASS_WITH_WARNINGS`:

- keep finalized `<intakeId>/snapshot`;
- keep finalized `<intakeId>/manifest.json`;
- remove `lock-<intakeId>`;
- remove temporary extraction workspace if separate from `snapshot`.

For `FAIL` after staging assignment:

- write `manifest.json` inside `incomplete-<intakeId>` if possible;
- remove `snapshot`;
- remove temporary extraction workspace;
- remove `lock-<intakeId>`;
- rename `incomplete-<intakeId>` to `<intakeId>` only if it contains `manifest.json` and no `snapshot`;
- if manifest write fails, remove `incomplete-<intakeId>` and emit stdout-only failure manifest with code `MANIFEST_FAILURE`.

For pre-staging failure:

- do not create `tmp/gt63-machine-intake/<intakeId>`;
- do not create `tmp/gt63-machine-intake/incomplete-<intakeId>`;
- emit stdout-only failure manifest.

For interrupted execution:

- no startup cleanup occurs before ownership;
- orphaned `incomplete-<intakeId>` directories are deleted only after the current execution has acquired `lock-<intakeId>` for that same `intakeId`;
- finalized `<intakeId>` directories are never treated as stale;
- lock directories are never recovered or deleted unless created by the current execution;
- an existing lock always means `INTAKE_ALREADY_RUNNING`, even if the lock is orphaned.

Cleanup must never delete outside:

```text
tmp/gt63-machine-intake
```

---

## 14. Path Ordering and Collision Rules

All manifest paths must use `/`.

All manifest paths must be relative paths unless a field explicitly requires normalized absolute source path.

Ordering must be deterministic:

1. sort artifacts by `sourceRelativePath`;
2. then by `archiveEntryPath`;
3. then by `stagedRelativePath`;
4. then by `status`;
5. then by `reason`;
6. then by universal ZIP discovery key when present;
7. all comparisons use ordinal Unicode code-point order after NFC normalization.

The universal ZIP discovery key is not a manifest field. It is used for deterministic ordering of all ZIP entries, including decoded safe entries, decoded unsafe entries, decoding-failed entries, duplicate raw-name entries, duplicate normalized paths, case-colliding entries, nested ZIP entries, archive links, and archive special entries.

Null sort values are treated as empty strings.

Failure records are sorted by:

1. `code`;
2. then `path`;
3. then `message`;
4. ordinal Unicode code-point order after NFC normalization.

Case-collision policy:

- compare normalized staged paths using Unicode lowercase after NFC normalization;
- if two artifacts have the same lowercased normalized staged path, all colliding artifacts are `REJECTED`;
- reason: `CASE_COLLISION_REJECTED`;
- intake outcome: `FAIL`.

Duplicate normalized path policy:

- if two artifacts have the same exact normalized staged path, all duplicates are `REJECTED`;
- reason: `DUPLICATE_NORMALIZED_PATH_REJECTED`;
- intake outcome: `FAIL`.

---

## 15. Intake ID

The intake execution identifier is deterministic.

`intakeId` must be:

```text
intake-<sha256>
```

`<sha256>` is the lowercase hex SHA-256 hash of this exact canonical seed:

```json
{"contract":"GT63_WORKFLOW_6_EXTERNAL_ARTIFACT_INTAKE_V1","sourceKind":"<directory|file|zip>","sourceIdentity":"<normalizedSourcePath>","sourceSizeBytes":<integer|null>,"limits":{"maxSourceArchiveBytes":52428800,"maxExtractedTotalBytes":209715200,"maxDiscoveredArtifacts":5000,"maxIndividualFileBytes":26214400,"maxArchiveNestingDepth":1,"maxNormalizedRelativePathLength":240}}
```

`normalizedSourcePath` is the external absolute source path after Source Path Normalization.

`sourceSizeBytes` is defined by Source Size Semantics.

The canonical seed must be serialized exactly as shown:

- no insignificant whitespace;
- keys in the exact order shown;
- UTF-8 encoding;
- NFC-normalized string values.

No timestamp, random value, process ID, hostname, username, or temporary absolute path may be used in `intakeId`.

For pre-staging failures that occur before `sourceKind`, `normalizedSourcePath`, or `sourceSizeBytes` can be determined, `intakeId` is `null`.

---

## 16. Hashing

The hash algorithm is exactly:

```text
SHA-256
```

Manifest hash values must be lowercase hex strings.

`sourceHash` is SHA-256 of original file bytes for files that can be read.

`stagedHash` is SHA-256 of staged file bytes for files that are staged.

For `UNREADABLE`, `UNSUPPORTED`, and `REJECTED` artifacts, unavailable hash fields are `null`.

Supplied outer ZIP container bytes are not represented by an artifact record and no outer ZIP hash appears in `artifacts`.

For supplied ZIP input, member artifacts use hashes of member bytes only.

For nested unsupported ZIP artifacts, `sourceHash` is the SHA-256 of the nested ZIP file bytes when those bytes can be read safely.

Platform metadata must not affect hash values.

---

## 17. Read-Only Source Guarantee

Workflow #6 must perform zero writes to the external source.

Forbidden external-source operations include:

- modification;
- rename;
- delete;
- metadata normalization;
- archive rewriting;
- permission changes;
- formatting;
- repair;
- conversion in place.

Workflow #6 does not perform conversion.

---

## 18. Symlink, Junction, Reparse, Hardlink, and Special File Policy

All filesystem indirection is rejected when detectable.

External directory intake:

- symlinks are `REJECTED` with reason `SYMLINK_REJECTED`;
- junctions are `REJECTED` with reason `JUNCTION_REJECTED`;
- Windows reparse points are `REJECTED` with reason `REPARSE_POINT_REJECTED`;
- hardlink identity is not inspected by Workflow #6;
- external hardlinked files are treated as regular files based only on their path, size, bytes, and regular-file metadata;
- no artifact status may differ solely because a platform exposes or hides hardlink identity;
- named pipes, sockets, device files, block devices, character devices, and other special files are `REJECTED` with reason `SPECIAL_FILE_REJECTED`.

Archive intake:

- archive symlink entries are `REJECTED` with reason `ARCHIVE_SYMLINK_REJECTED`;
- archive hardlink entries are `REJECTED` with reason `ARCHIVE_HARDLINK_REJECTED`;
- archive device or special entries are `REJECTED` with reason `ARCHIVE_SPECIAL_FILE_REJECTED`;
- archive directory entries are structural only and do not count as artifacts unless unsafe.

No symlink, junction, reparse point, hardlink metadata entry, or special file may be staged as an active filesystem link or special file.

Regression for platform-specific filesystem objects is required where the platform supports creating the object type.

---

## 19. Archive Safety

Extraction-before-validation is prohibited.

For every archive entry, the implementation must validate the entry name and metadata before writing any bytes.

ZIP entry-name decoding policy:

- use raw filename bytes from the ZIP central directory;
- if the ZIP general-purpose UTF-8 filename flag is set, decode bytes as UTF-8;
- if the UTF-8 flag is absent, decode bytes as IBM Code Page 437;
- no locale-dependent or library-default fallback encoding is allowed;
- if decoding fails or produces replacement characters, reject the entry before normalization;
- decoding-failed entries are artifact records;
- decoding-failed entries count toward `summary.totalDiscovered` and `maxDiscoveredArtifacts`;
- artifact status: `REJECTED`;
- artifact reason: `ZIP_ENTRY_NAME_DECODING_FAILED`;
- failure code: `ZIP_ENTRY_NAME_DECODING_FAILED`;
- `sourceRelativePath`: `null`;
- `archiveEntryPath`: `null`;
- `stagedRelativePath`: `null`;
- `extension`: `null`;
- `sourceSizeBytes`: central-directory uncompressed size when available, otherwise `null`;
- `stagedSizeBytes`: `null`;
- `sourceHash`: `null`;
- `stagedHash`: `null`;
- `provenance.originalRelativePath`: `null`;
- `provenance.archiveContainerPath`: normalized absolute source path of the supplied outer ZIP;
- `failures[].path`: `null`;
- deterministic ordering for multiple decoding-failed entries uses the universal ZIP discovery key defined in Deterministic Discovery Order and Path Ordering and Collision Rules;
- path normalization, traversal checks, duplicate detection, and case collision detection occur only after successful decoding;
- normal decoded-entry artifact membership is determined after successful decoding;
- decoding-failed artifact membership and `maxDiscoveredArtifacts` counting are determined by the decoding-failure rules above.

Archive entries are rejected if they contain or imply:

- `..` traversal;
- absolute path;
- drive-letter path;
- UNC path;
- backslash path separator;
- empty path segment;
- trailing slash for a file entry;
- normalized path length over 240 characters;
- Windows reserved name;
- Windows-hostile path segment;
- duplicate normalized path;
- case-colliding normalized path;
- symlink entry;
- hardlink entry;
- special or device entry;
- extraction outside the assigned staging root.

Windows reserved names are rejected case-insensitively when the basename before extension equals a reserved name.

The following are rejected:

- `CON`
- `CON.txt`
- `con.md`
- `PRN`
- `PRN.csv`
- `AUX`
- `NUL`
- `COM1`
- `COM1.js`
- `LPT1`
- `LPT1.json`

The reserved basename set is:

- `CON`
- `PRN`
- `AUX`
- `NUL`
- `COM1`
- `COM2`
- `COM3`
- `COM4`
- `COM5`
- `COM6`
- `COM7`
- `COM8`
- `COM9`
- `LPT1`
- `LPT2`
- `LPT3`
- `LPT4`
- `LPT5`
- `LPT6`
- `LPT7`
- `LPT8`
- `LPT9`

Windows-hostile path segment policy:

- reject any decoded archive path segment containing `:`;
- reject any decoded archive path segment ending in `.` or space;
- reject these segments before staging on every platform, not only Windows;
- reason: `WINDOWS_HOSTILE_PATH_SEGMENT_REJECTED`;
- failure code: `WINDOWS_HOSTILE_PATH_SEGMENT_REJECTED`;
- `failures[].path` is the safely normalized archive path when available, otherwise `null`.

ZIP member compression and encryption policy:

- supported ZIP compression methods are exactly `0` (stored) and `8` (deflate);
- if the central-directory general-purpose encrypted flag is set, reject the member before reading member bytes;
- encrypted members use reason and failure code `ZIP_MEMBER_ENCRYPTED_REJECTED`;
- no password input is accepted by Workflow #6;
- if the compression method is not `0` or `8`, reject the member before reading member bytes;
- unsupported compression methods use reason and failure code `ZIP_COMPRESSION_METHOD_UNSUPPORTED`;
- these rejections are artifact records, count toward `summary.totalDiscovered`, set intake outcome `FAIL`, and are not staged or hashed.

ZIP member integrity policy:

- for every ZIP member otherwise eligible for byte reading, validate the local file header before reading member payload bytes;
- reject the member if the local file header is missing, truncated, malformed, or disagrees with the central-directory raw filename bytes, compression method, or general-purpose flags;
- while reading member payload bytes, reject the member if compressed data is truncated, malformed, or cannot be decoded by the supported method;
- after member bytes are decoded, reject the member if the decoded byte count differs from the central-directory uncompressed size when that size is available;
- after member bytes are decoded, reject the member if computed CRC-32 differs from the central-directory CRC-32 when that CRC-32 is available;
- reject malformed or inconsistent data descriptors;
- all ZIP integrity rejections use reason and failure code `ZIP_MEMBER_INTEGRITY_REJECTED`;
- integrity rejection sets source hash, staged hash, and staged size to `null`, sets intake outcome `FAIL`, stops processing additional artifacts, and removes partial bytes from `snapshot`;
- `DECOMPRESSION_LIMIT_EXCEEDED` remains only for decompression safety failures that are not encryption, unsupported compression, integrity mismatch, or byte-limit failures.

If an archive entry violates a safety rule:

- artifact status: `REJECTED`;
- intake outcome: `FAIL`.

If a `.zip` entry is found inside a `.zip`, it is `UNSUPPORTED` with reason `NESTED_ARCHIVE_UNSUPPORTED`.

Archive nesting-depth semantics:

- the supplied outer ZIP is depth `1`;
- a `.zip` file discovered as a member of the supplied outer ZIP is a depth `2` nested archive artifact;
- Workflow #6 v1 must not open, parse, inspect, extract, or enumerate the contents of any depth `2` nested archive;
- every depth `2` nested archive artifact is `UNSUPPORTED` with reason `NESTED_ARCHIVE_UNSUPPORTED`;
- depth `2` nested archive artifacts do not create failure records by themselves;
- depth `2` nested archive artifacts may contribute to `PASS_WITH_WARNINGS` through `UNSUPPORTED_ARTIFACTS_PRESENT`;
- `ARCHIVE_DEPTH_LIMIT_EXCEEDED` must not be emitted by Workflow #6 v1;
- `maxArchiveNestingDepth: 1` is enforced by refusing to process nested archive contents, not by converting the nested archive artifact into a failure.

Decompression-bomb policy:

- declared uncompressed size greater than `maxIndividualFileBytes` is rejected before streaming;
- if declared uncompressed size is unavailable, the entry may be streamed only while enforcing `maxIndividualFileBytes` and `maxExtractedTotalBytes`;
- unknown-size ZIP member streaming uses this exact precedence:
  1. if the member's own streamed bytes exceed `maxIndividualFileBytes`, use `FILE_SIZE_LIMIT_EXCEEDED`;
  2. otherwise, if cumulative staged bytes exceed `maxExtractedTotalBytes`, use `TOTAL_BYTE_LIMIT_EXCEEDED`;
  3. use `DECOMPRESSION_LIMIT_EXCEEDED` only when decompression cannot continue safely for a reason other than the two byte-limit conditions above;
- when more than one condition becomes true on the same streamed chunk, `FILE_SIZE_LIMIT_EXCEEDED` takes precedence over `TOTAL_BYTE_LIMIT_EXCEEDED`, and `TOTAL_BYTE_LIMIT_EXCEEDED` takes precedence over `DECOMPRESSION_LIMIT_EXCEEDED`;
- stop processing, mark the entry `REJECTED`, use the selected reason/failure code, and set intake outcome `FAIL`.

---

## 20. Artifact Status and Reason Vocabulary

Allowed artifact statuses are exactly:

- `STAGED`
- `UNSUPPORTED`
- `UNREADABLE`
- `REJECTED`

Allowed artifact reasons are exactly:

- `null`
- `UNSUPPORTED_EXTENSION`
- `NESTED_ARCHIVE_UNSUPPORTED`
- `SOURCE_READ_FAILED`
- `SYMLINK_REJECTED`
- `JUNCTION_REJECTED`
- `REPARSE_POINT_REJECTED`
- `SPECIAL_FILE_REJECTED`
- `ARCHIVE_TRAVERSAL_REJECTED`
- `ARCHIVE_ABSOLUTE_PATH_REJECTED`
- `ARCHIVE_DRIVE_LETTER_REJECTED`
- `ARCHIVE_UNC_PATH_REJECTED`
- `ARCHIVE_BACKSLASH_PATH_REJECTED`
- `ZIP_ENTRY_NAME_DECODING_FAILED`
- `ARCHIVE_SYMLINK_REJECTED`
- `ARCHIVE_HARDLINK_REJECTED`
- `ARCHIVE_SPECIAL_FILE_REJECTED`
- `DECOMPRESSION_LIMIT_EXCEEDED`
- `FILE_SIZE_LIMIT_EXCEEDED`
- `TOTAL_BYTE_LIMIT_EXCEEDED`
- `SOURCE_MUTATION_DETECTED`
- `NORMALIZED_PATH_LENGTH_EXCEEDED`
- `WINDOWS_RESERVED_NAME_REJECTED`
- `DUPLICATE_NORMALIZED_PATH_REJECTED`
- `CASE_COLLISION_REJECTED`
- `STAGING_ROOT_ESCAPE_REJECTED`
- `WINDOWS_HOSTILE_PATH_SEGMENT_REJECTED`
- `ZIP_MEMBER_ENCRYPTED_REJECTED`
- `ZIP_COMPRESSION_METHOD_UNSUPPORTED`
- `ZIP_MEMBER_INTEGRITY_REJECTED`

`STAGED` artifacts always use reason `null`.

`UNSUPPORTED` artifacts use `UNSUPPORTED_EXTENSION` or `NESTED_ARCHIVE_UNSUPPORTED`.

`UNREADABLE` artifacts use `SOURCE_READ_FAILED`.

`REJECTED` artifacts use one of the remaining non-null safety, path, link, resource, collision, or staging reasons.

---

## 21. Warning and Limit-Violation Vocabulary

`summary.warnings` is deterministic and uses this closed vocabulary:

- `UNSUPPORTED_ARTIFACTS_PRESENT`
- `UNREADABLE_ARTIFACTS_PRESENT`

Population rules:

- if one or more artifacts have status `UNSUPPORTED`, include `UNSUPPORTED_ARTIFACTS_PRESENT` exactly once;
- if one or more artifacts have status `UNREADABLE`, include `UNREADABLE_ARTIFACTS_PRESENT` exactly once;
- otherwise `summary.warnings` is `[]`;
- sort warnings alphabetically by ordinal Unicode code-point order.

`PASS_WITH_WARNINGS` requires `summary.warnings` to be non-empty.

`summary.limitViolations` is deterministic and uses this closed vocabulary:

- `ARCHIVE_SIZE_LIMIT_EXCEEDED`
- `FILE_COUNT_LIMIT_EXCEEDED`
- `TOTAL_BYTE_LIMIT_EXCEEDED`
- `FILE_SIZE_LIMIT_EXCEEDED`
- `ARCHIVE_DEPTH_LIMIT_EXCEEDED`
- `NORMALIZED_PATH_LENGTH_EXCEEDED`
- `DECOMPRESSION_LIMIT_EXCEEDED`

Population rules:

- include a limit code exactly once if the corresponding failure or artifact reason occurs;
- do not include non-limit safety codes;
- sort values alphabetically by ordinal Unicode code-point order.

---

## 22. Failure Record Membership and Path Semantics

Every failure record must use an allowed failure code and exact message from the Failure Code and Message Vocabulary section.

Mandatory failure records:

- every `REJECTED` artifact creates exactly one failure record using the same code as its artifact reason when that reason is also an allowed failure code;
- every pre-staging failure creates exactly one failure record;
- every fail-closed stop condition creates exactly one failure record;
- `EMPTY_INPUT` and `NO_STAGED_ARTIFACTS` create exactly one failure record;
- `UNSUPPORTED` and `UNREADABLE` artifacts do not create failure records unless the overall status is `FAIL` due to `NO_STAGED_ARTIFACTS`.

Failure `path` values:

- pre-staging failures: `null`;
- direct file artifact failures: `sourceRelativePath`;
- directory artifact failures: `sourceRelativePath`;
- ZIP member failures after safe entry normalization: `archiveEntryPath`;
- ZIP unsafe path failures before safe normalization: raw archive entry name with `/` separators and NFC normalization when conversion is safe; otherwise `null`;
- ZIP entry-name decoding failures: `null`;
- structural directory traversal failures: normalized directory-relative path;
- supplied outer ZIP source-mutation failures: `null`;
- file-count and total-byte stop failures without a specific artifact: `null`;
- manifest, staging, finalization, and lock failures: `null`.

Rejected unsafe path field semantics:

- if an archive entry is rejected for `ARCHIVE_TRAVERSAL_REJECTED`, `ARCHIVE_ABSOLUTE_PATH_REJECTED`, `ARCHIVE_DRIVE_LETTER_REJECTED`, `ARCHIVE_UNC_PATH_REJECTED`, or `ARCHIVE_BACKSLASH_PATH_REJECTED`, artifact `sourceRelativePath`, `archiveEntryPath`, `stagedRelativePath`, and `provenance.originalRelativePath` are `null`;
- for those unsafe archive path rejections, `failures[].path` stores the raw archive entry name with `\` converted to `/` and NFC normalization when that conversion is possible;
- if raw archive entry name cannot be represented as a valid string, `failures[].path` is `null`;
- if a rejected path can be normalized safely but violates a policy after normalization, populate `sourceRelativePath` and `archiveEntryPath` with the normalized value and set `stagedRelativePath` to `null`.

---

## 23. Manifest Contract

Workflow #6 produces one deterministic manifest JSON document to stdout for every execution.

The logical output document is named:

```text
external-artifact-intake-manifest.json
```

After a staging directory has been safely assigned, the implementation must also write the same manifest to:

```text
tmp/gt63-machine-intake/<intakeId>/manifest.json
```

If execution fails before a staging directory can be safely assigned, the implementation must emit the deterministic failure manifest to stdout only and must not write any file.

Supplied outer ZIP representation:

- the supplied outer ZIP container does not receive an artifact record in `artifacts`;
- the supplied outer ZIP contributes `0` to `summary.totalDiscovered`;
- the supplied outer ZIP byte size is represented in the intake ID seed as `sourceSizeBytes`;
- the supplied outer ZIP SHA-256 is not stored in `artifacts`;
- ZIP members alone populate `artifacts`;
- for every ZIP member, `provenance.archiveContainerPath` is the normalized absolute source path of the supplied outer ZIP.

Nested unsupported ZIP representation:

- a nested `.zip` discovered as a directory file or ZIP member receives one artifact record;
- status: `UNSUPPORTED`;
- reason: `NESTED_ARCHIVE_UNSUPPORTED`;
- it contributes `1` to `summary.totalDiscovered`;
- it is not extracted;
- if its bytes can be read safely, `sourceSizeBytes` and `sourceHash` are populated;
- `stagedRelativePath`, `stagedSizeBytes`, and `stagedHash` are `null`.

Manifest path field semantics:

Direct file input:

- `sourceRelativePath`: basename of normalized source path;
- `archiveEntryPath`: `null`;
- `stagedRelativePath`: `snapshot/<sourceRelativePath>` for `STAGED`, otherwise `null`;
- `provenance.originalRelativePath`: same as `sourceRelativePath`;
- `provenance.archiveContainerPath`: `null`.

Directory artifact:

- `sourceRelativePath`: normalized path relative to supplied source directory;
- `archiveEntryPath`: `null`;
- `stagedRelativePath`: `snapshot/<sourceRelativePath>` for `STAGED`, otherwise `null`;
- `provenance.originalRelativePath`: same as `sourceRelativePath`;
- `provenance.archiveContainerPath`: `null`.

ZIP member:

- `sourceRelativePath`: normalized archive member path;
- `archiveEntryPath`: normalized archive member path;
- `stagedRelativePath`: `snapshot/<archiveEntryPath>` for `STAGED`, otherwise `null`;
- `provenance.originalRelativePath`: same as `archiveEntryPath`;
- `provenance.archiveContainerPath`: normalized absolute source path of the supplied outer ZIP.

Unsupported artifact:

- path fields follow the source-class rules above;
- `stagedRelativePath`: `null`;
- staged byte and hash fields: `null`.

Unreadable artifact:

- path fields follow the source-class rules above;
- `stagedRelativePath`: `null`;
- staged byte and hash fields: `null`;
- source byte and hash fields are `null` if bytes cannot be read.

Rejected artifact:

- path fields are populated when safe normalized path data is known;
- unsafe path fields that cannot be normalized safely are `null`;
- `stagedRelativePath`: `null`;
- staged byte and hash fields: `null`;
- safety-path rejection must not read source bytes.

The manifest JSON schema is exactly:

```json
{
  "status": "PASS|PASS_WITH_WARNINGS|FAIL",
  "workflow": "external-artifact-intake",
  "authority": "NONE",
  "logicalDocumentName": "external-artifact-intake-manifest.json",
  "intake": {
    "intakeId": "intake-<sha256>|null",
    "sourceKind": "directory|file|zip|null",
    "sourcePath": "<normalized absolute external source path|null>",
    "stagingRoot": "tmp/gt63-machine-intake/<intakeId>|null",
    "snapshotRoot": "tmp/gt63-machine-intake/<intakeId>/snapshot|null",
    "manifestPath": "tmp/gt63-machine-intake/<intakeId>/manifest.json|null",
    "downstreamEligibility": "ELIGIBLE|ELIGIBLE_WITH_WARNINGS|NOT_ELIGIBLE"
  },
  "limits": {
    "maxSourceArchiveBytes": 52428800,
    "maxExtractedTotalBytes": 209715200,
    "maxDiscoveredArtifacts": 5000,
    "maxIndividualFileBytes": 26214400,
    "maxArchiveNestingDepth": 1,
    "maxNormalizedRelativePathLength": 240
  },
  "summary": {
    "totalDiscovered": 0,
    "staged": 0,
    "unsupported": 0,
    "unreadable": 0,
    "rejected": 0,
    "totalSourceBytes": 0,
    "totalStagedBytes": 0,
    "limitViolations": [],
    "warnings": []
  },
  "artifacts": [
    {
      "status": "STAGED|UNSUPPORTED|UNREADABLE|REJECTED",
      "reason": null,
      "sourceRelativePath": "example.md",
      "archiveEntryPath": null,
      "stagedRelativePath": "snapshot/example.md",
      "extension": ".md",
      "sourceSizeBytes": 123,
      "stagedSizeBytes": 123,
      "sourceHash": "<sha256|null>",
      "stagedHash": "<sha256|null>",
      "provenance": {
        "sourceKind": "directory|file|zip",
        "originalSourcePath": "<normalized absolute external source path>",
        "originalRelativePath": "example.md",
        "archiveContainerPath": null
      }
    }
  ],
  "failures": [
    {
      "code": "FAILURE_CODE",
      "message": "Deterministic failure message.",
      "path": "relative/path/or/null"
    }
  ]
}
```

All top-level keys and nested object keys must be serialized in the exact order shown.

Arrays must be sorted according to the Path Ordering and Collision Rules section.

Fields that do not apply must be `null`, not omitted.

No timestamp fields are allowed.

No random fields are allowed.

No host-specific temporary paths are allowed except the normalized absolute `sourcePath`, `originalSourcePath`, and source identity values defined in this contract.

Pre-staging failure manifest values are exact:

- `status`: `FAIL`
- `intake.intakeId`: `null` only when failure occurs before `sourceKind`, `sourcePath`, and `sourceSizeBytes` are all determined;
- `intake.intakeId`: deterministic `intake-<sha256>` when those seed fields are determined, including `INTAKE_ALREADY_RUNNING`;
- `intake.sourceKind`: `null` unless source kind was determined before failure;
- `intake.sourcePath`: normalized source path when available, otherwise `null`;
- `intake.stagingRoot`: `null`;
- `intake.snapshotRoot`: `null`;
- `intake.manifestPath`: `null`;
- `intake.downstreamEligibility`: `NOT_ELIGIBLE`;
- all `summary` numeric fields: `0`, except `summary.totalSourceBytes` for `ARCHIVE_SIZE_LIMIT_EXCEEDED`, which equals the supplied ZIP `sourceSizeBytes`;
- `summary.limitViolations`: failure code array if the failure is a limit violation, otherwise `[]`;
- `summary.warnings`: `[]`;
- `artifacts`: `[]`;
- `failures`: one or more sorted failure records.

---

## 24. Failure Code and Message Vocabulary

Allowed failure codes and exact messages are:

- `EXTERNAL_INPUT_MISSING`: `externalSourcePath is required.`
- `EXTERNAL_INPUT_NOT_FOUND`: `External input was not found.`
- `EXTERNAL_INPUT_UNREADABLE`: `External input is unreadable.`
- `EXTERNAL_INPUT_TYPE_UNSUPPORTED`: `External input type is unsupported.`
- `EXTERNAL_INPUT_NETWORK_PATH_REJECTED`: `Network paths are rejected.`
- `EXTERNAL_INPUT_DRIVE_ROOT_REJECTED`: `Drive roots are rejected.`
- `EXTERNAL_INPUT_LINK_ROOT_REJECTED`: `External input root cannot be a link or reparse point.`
- `INTAKE_ALREADY_RUNNING`: `An intake with this deterministic intakeId is already running.`
- `ARCHIVE_SIZE_LIMIT_EXCEEDED`: `Source archive size limit was exceeded.`
- `ARCHIVE_TRAVERSAL_REJECTED`: `Archive entry traversal was rejected.`
- `ARCHIVE_ABSOLUTE_PATH_REJECTED`: `Archive absolute path was rejected.`
- `ARCHIVE_DRIVE_LETTER_REJECTED`: `Archive drive-letter path was rejected.`
- `ARCHIVE_UNC_PATH_REJECTED`: `Archive UNC path was rejected.`
- `ARCHIVE_BACKSLASH_PATH_REJECTED`: `Archive backslash path was rejected.`
- `ZIP_ENTRY_NAME_DECODING_FAILED`: `ZIP entry name decoding failed.`
- `ARCHIVE_SYMLINK_REJECTED`: `Archive symlink entry was rejected.`
- `ARCHIVE_HARDLINK_REJECTED`: `Archive hardlink entry was rejected.`
- `ARCHIVE_SPECIAL_FILE_REJECTED`: `Archive special entry was rejected.`
- `DECOMPRESSION_LIMIT_EXCEEDED`: `Decompression limit was exceeded.`
- `SYMLINK_REJECTED`: `Symlink was rejected.`
- `JUNCTION_REJECTED`: `Junction was rejected.`
- `REPARSE_POINT_REJECTED`: `Reparse point was rejected.`
- `SPECIAL_FILE_REJECTED`: `Special file was rejected.`
- `FILE_COUNT_LIMIT_EXCEEDED`: `File count limit was exceeded.`
- `TOTAL_BYTE_LIMIT_EXCEEDED`: `Total byte limit was exceeded.`
- `FILE_SIZE_LIMIT_EXCEEDED`: `Individual file size limit was exceeded.`
- `SOURCE_MUTATION_DETECTED`: `Source changed during intake.`
- `ARCHIVE_DEPTH_LIMIT_EXCEEDED`: `Archive nesting depth limit was exceeded.`
- `NORMALIZED_PATH_LENGTH_EXCEEDED`: `Normalized path length limit was exceeded.`
- `WINDOWS_RESERVED_NAME_REJECTED`: `Windows reserved name was rejected.`
- `DUPLICATE_NORMALIZED_PATH_REJECTED`: `Duplicate normalized path was rejected.`
- `CASE_COLLISION_REJECTED`: `Case-colliding normalized path was rejected.`
- `STAGING_ROOT_ESCAPE_REJECTED`: `Staging root escape was rejected.`
- `WINDOWS_HOSTILE_PATH_SEGMENT_REJECTED`: `Windows-hostile path segment was rejected.`
- `ZIP_MEMBER_ENCRYPTED_REJECTED`: `Encrypted ZIP member was rejected.`
- `ZIP_COMPRESSION_METHOD_UNSUPPORTED`: `ZIP compression method is unsupported.`
- `ZIP_MEMBER_INTEGRITY_REJECTED`: `ZIP member integrity validation failed.`
- `STAGING_ROOT_UNTRUSTED`: `Staging root is untrusted.`
- `STAGING_FAILURE`: `Staging failed.`
- `STAGING_FINALIZATION_FAILED`: `Staging finalization failed.`
- `MANIFEST_FAILURE`: `Manifest generation failed.`
- `EMPTY_INPUT`: `No artifacts were discovered.`
- `NO_STAGED_ARTIFACTS`: `No artifacts were staged.`

No other failure code or failure message is allowed.

Failure records must use the exact message for their code.

---

## 25. Status and Downstream Eligibility Semantics

Every execution maps to exactly one status.

`PASS`:

- at least one artifact is `STAGED`;
- every discovered artifact is `STAGED`;
- no unsupported artifacts;
- no unreadable artifacts;
- no rejected artifacts;
- no failures;
- no limit violations;
- no warnings;
- downstream eligibility: `ELIGIBLE`.

`PASS_WITH_WARNINGS`:

- at least one artifact is `STAGED`;
- at least one artifact is `UNSUPPORTED` or `UNREADABLE`;
- zero rejected artifacts;
- zero safety violations;
- zero resource-limit violations;
- zero failures;
- downstream eligibility: `ELIGIBLE_WITH_WARNINGS`.

`FAIL`:

- zero artifacts discovered; or
- zero artifacts staged; or
- any rejected artifact exists; or
- any safety violation exists; or
- any resource-limit violation exists; or
- any source mutation is detected; or
- any failure record exists; or
- manifest cannot be finalized; or
- staging cannot be safely completed;
- downstream eligibility: `NOT_ELIGIBLE`.

Only-unsupported or only-unreadable intake is `FAIL` with failure code `NO_STAGED_ARTIFACTS`.

Empty valid directory input is `FAIL` with failure code `EMPTY_INPUT`.

Unsupported direct-file input is `FAIL` with failure code `EXTERNAL_INPUT_TYPE_UNSUPPORTED`.

---

## 26. Partial Intake Rules

Partial intake exists only when status is `PASS_WITH_WARNINGS`.

`PASS_WITH_WARNINGS` includes staged artifacts plus `UNSUPPORTED` or `UNREADABLE` artifacts.

`PASS_WITH_WARNINGS` may be consumed downstream only if downstream workflow input explicitly accepts warning-bearing manifests.

`FAIL` may include a manifest, but its staged snapshot must be removed and it must not be consumed downstream.

Rejected entries appear in the manifest when they were discovered before the workflow stopped or before a count limit prevented further enumeration.

Rejected entries use hash fields `null` unless bytes were safely read before the rejection condition was discovered. Safety-path rejection must not read bytes.

No downstream component may reinterpret intake validity. It must use only `status` and `intake.downstreamEligibility`.

---

## 27. Failure Precedence

When multiple conditions apply before traversal or staging, failure precedence is:

1. `EXTERNAL_INPUT_MISSING`
2. `EXTERNAL_INPUT_NETWORK_PATH_REJECTED`
3. `EXTERNAL_INPUT_DRIVE_ROOT_REJECTED`
4. `EXTERNAL_INPUT_NOT_FOUND`
5. `EXTERNAL_INPUT_UNREADABLE`
6. `EXTERNAL_INPUT_LINK_ROOT_REJECTED`
7. `EXTERNAL_INPUT_TYPE_UNSUPPORTED`
8. `ARCHIVE_SIZE_LIMIT_EXCEEDED`
9. `STAGING_ROOT_UNTRUSTED`
10. `INTAKE_ALREADY_RUNNING`

During traversal, archive validation, staging, hashing, and manifest generation, all safely discovered failures are recorded until a fail-closed stop condition prevents safe continuation.

Fail-closed stop conditions are:

- staging-root trust-boundary violation;
- staging-root escape;
- archive traversal;
- source mutation detected;
- decompression limit exceeded while streaming;
- file count limit exceeded;
- total byte limit exceeded;
- manifest generation failure;
- staging finalization failure.

When a stop condition occurs, the workflow records the stop-condition failure and does not continue discovering additional artifacts.

All recorded failures are sorted by the Path Ordering and Collision Rules section before serialization.

---

## 28. Relationship to Workflows #1-#5B

Workflow #6 is additive.

It does not redefine existing workflow contracts.

Existing behavior must remain valid:

```text
External repositoryPath -> Workflows #1-#5B -> INPUT_PATH_INVALID
```

Workflow #6 creates a separate controlled path:

```text
External Artifact Source -> Workflow #6 Validation -> Safe Staging Snapshot -> Intake Manifest -> Explicit downstream evidence-processing step
```

Existing workflows must not gain direct arbitrary external-path authority.

---

## 29. Evidence Boundary

Successful staging proves only:

- the artifact was supplied;
- the artifact passed intake safety rules;
- the staged copy corresponds to recorded provenance;
- the Machine may inspect the staged evidence.

Successful staging does not prove:

- the artifact is true;
- the artifact is current;
- the artifact is authoritative;
- the artifact belongs to GT63;
- the artifact is canonical;
- claims inside the artifact are correct.

Evidence intake and evidence interpretation remain separate responsibilities.

---

## 30. Determinism Requirements

Given the same normalized input artifact set, source path, configuration constants, and supported-format policy, Workflow #6 must produce byte-for-byte identical normalized JSON output.

Normalized JSON output means:

- object keys in schema order;
- arrays in contract-defined order;
- `/` path separators;
- NFC string normalization;
- exact status semantics;
- exact reason vocabulary;
- exact failure code/message vocabulary;
- exact intake ID seed;
- no timestamps;
- no random values;
- no environment-dependent ordering.

Output equality across different machines is required only when the normalized absolute source path is identical.

---

## 31. Required Regression Coverage

Implementation may not be accepted without regression coverage for at least:

1. valid external directory intake;
2. valid individual file intake;
3. valid `.zip` archive intake;
4. missing external path;
5. unsupported direct file;
6. only unsupported artifacts;
7. empty directory;
8. syntactic UNC, `file://`, `smb://`, and `nfs://` network-path rejection;
9. drive-root rejection;
10. source root symlink/reparse rejection where platform supports it;
11. archive `..` traversal attempt;
12. archive absolute-path attempt;
13. archive drive-letter attempt;
14. archive UNC-path attempt;
15. archive backslash-path attempt;
16. ZIP entry-name decoding with UTF-8 flag present;
17. ZIP entry-name decoding with UTF-8 flag absent using IBM Code Page 437;
18. malformed ZIP entry-name bytes produce `ZIP_ENTRY_NAME_DECODING_FAILED`;
19. archive symlink entry;
20. archive hardlink entry;
21. archive special/device entry;
22. duplicate normalized archive paths;
23. case-colliding archive paths;
24. Unicode NFC path normalization;
25. Windows reserved-name rejection including `CON.txt`;
26. symlink rejection from external directory where platform supports it;
27. junction/reparse-point rejection where platform supports it;
28. external hardlinked files treated as regular files without hardlink-identity inspection;
29. supplied outer ZIP just-under, at, and just-over `maxSourceArchiveBytes`;
30. unknown-size ZIP member precedence for `FILE_SIZE_LIMIT_EXCEEDED`;
31. unknown-size ZIP member precedence for `TOTAL_BYTE_LIMIT_EXCEEDED`;
32. unknown-size ZIP member non-byte decompression failure uses `DECOMPRESSION_LIMIT_EXCEEDED`;
33. oversized unsupported file remains `UNSUPPORTED`;
34. oversized nested ZIP remains `UNSUPPORTED`;
35. file-count limit with exactly 5000 records plus failure;
36. duplicate or case-colliding candidate beyond the first 5000 does not change disposition of an artifact inside the first 5000;
37. duplicate or case-colliding candidates within the first 5000 are rejected deterministically;
38. decoded-but-unsafe ZIP names sorted by universal ZIP discovery key before the 5000-record boundary;
39. duplicate raw ZIP filename bytes with different sizes sorted by universal ZIP discovery key;
40. duplicate raw ZIP filename bytes with different CRC/content sorted by universal ZIP discovery key;
41. duplicate raw ZIP filename bytes with different attributes sorted by universal ZIP discovery key;
42. reordered physical central-directory entries produce identical artifact selection;
43. 4999 / 5000 / 5001 boundary with duplicate raw ZIP names has one expected artifact set;
44. all-universal-key-fields-equal duplicate ZIP entries use indistinguishable-entry group behavior;
45. duplicate ZIP entries with identical universal key fields except local-header validation key are sorted deterministically before the 5000-record boundary;
46. 5000-boundary cut through duplicate ZIP entries with different local-header integrity outcomes has one expected artifact set;
47. encrypted ZIP member produces `ZIP_MEMBER_ENCRYPTED_REJECTED`;
48. unsupported ZIP compression method produces `ZIP_COMPRESSION_METHOD_UNSUPPORTED`;
49. ZIP CRC mismatch produces `ZIP_MEMBER_INTEGRITY_REJECTED`;
50. ZIP central-directory size versus decoded-size mismatch produces `ZIP_MEMBER_INTEGRITY_REJECTED`;
51. ZIP central-directory versus local-header metadata disagreement produces `ZIP_MEMBER_INTEGRITY_REJECTED`;
52. truncated compressed ZIP data produces `ZIP_MEMBER_INTEGRITY_REJECTED`;
53. malformed ZIP data descriptor produces `ZIP_MEMBER_INTEGRITY_REJECTED`;
54. archive path segment containing `:` produces `WINDOWS_HOSTILE_PATH_SEGMENT_REJECTED`;
55. archive path segment ending in `.` or space produces `WINDOWS_HOSTILE_PATH_SEGMENT_REJECTED`;
56. extension derivation for `.md`, `file.`, `file..md`, `archive.tar.md`, and `README`;
57. unreadable structural subdirectory produces `FAIL` with `EXTERNAL_INPUT_UNREADABLE` and no artifact record for the structural directory;
58. total-byte limit;
59. individual-file-size limit;
60. nested ZIP archive at depth `2` is `UNSUPPORTED` with `NESTED_ARCHIVE_UNSUPPORTED`, is not inspected, and does not emit `ARCHIVE_DEPTH_LIMIT_EXCEEDED`;
61. decompression limit enforcement;
62. unreadable artifact reporting;
63. unsupported artifact reporting;
64. normalized path-length rejection;
65. staging-root escape rejection;
66. ordinary directory entries are structural only and excluded from artifact count;
67. deterministic `summary.warnings` vocabulary and ordering;
68. deterministic `summary.limitViolations` vocabulary and ordering;
69. deterministic `summary.totalSourceBytes` for staged, unsupported, unreadable, rejected, partially streamed, source-mutated, ZIP member, and supplied outer ZIP cases;
70. mandatory rejected-artifact to failure-record mapping;
71. exact `failures[].path` semantics for direct file, directory artifact, ZIP member, unsafe ZIP path, ZIP decoding failure, structural directory traversal failure, and pre-staging failure;
72. regular file `FILE_SIZE_LIMIT_EXCEEDED` disposition before hashing/staging;
73. regular file `TOTAL_BYTE_LIMIT_EXCEEDED` disposition before hashing/staging;
74. regular file source mutation detection produces `SOURCE_MUTATION_DETECTED`;
75. supplied outer ZIP source mutation detection produces `SOURCE_MUTATION_DETECTED`;
76. deterministic manifest equality across identical runs;
77. deterministic `intakeId` equality across identical runs;
78. no timestamp or random manifest fields;
79. source remains byte-for-byte unchanged;
80. no writes outside staging root;
81. untrusted `tmp` or `tmp/gt63-machine-intake` symlink/reparse rejection;
82. existing finalized directory replacement only after lock ownership;
83. active lock collision returns `INTAKE_ALREADY_RUNNING`;
84. no incomplete directory deletion before lock ownership;
85. cleanup after `PASS`;
86. cleanup after `PASS_WITH_WARNINGS`;
87. cleanup after `FAIL`;
88. owned stale `incomplete-` cleanup only after lock acquisition;
89. pre-staging failure stdout-only manifest with `intakeId: null` when seed is unknown;
90. pre-staging `INTAKE_ALREADY_RUNNING` manifest with deterministic known `intakeId`;
91. provenance path-field semantics for direct file, directory artifact, ZIP member, unsupported artifact, unreadable artifact, and rejected artifact;
92. supplied outer ZIP not represented as an artifact record and not hashed in `artifacts`;
93. nested unsupported ZIP represented as one `UNSUPPORTED` artifact;
94. failed intake is downstream-ineligible;
95. warning intake is marked `ELIGIBLE_WITH_WARNINGS`;
96. existing Workflow #1-#5B regressions remain PASS;
97. existing external `repositoryPath` rejection remains PASS.

---

## 32. Security Invariants

The following invariants are mandatory:

### Invariant A

External evidence never expands repository authority.

### Invariant B

External source remains unchanged.

### Invariant C

No archive entry may be written before validation.

### Invariant D

No archive entry may escape staging.

### Invariant E

No symlink, junction, reparse point, archive link entry, or special file may become an active staged filesystem object.

### Invariant F

Every discovered artifact receives a manifest disposition unless `FILE_COUNT_LIMIT_EXCEEDED` stops enumeration after exactly 5000 artifact records.

### Invariant G

Partial intake is never represented as complete intake.

### Invariant H

Existing Workflows #1-#5B retain their current containment behavior.

### Invariant I

Workflow #6 grants no canonical authority.

---

## 33. Explicit Non-Goals

Workflow #6 does not:

- analyze product truth;
- decide canonical status;
- resolve historical conflicts;
- approve knowledge;
- modify source artifacts;
- repair source artifacts;
- deploy anything;
- execute supplied source code;
- validate credentials;
- contact external services;
- establish GT63 continuity;
- replace Operational Validation reasoning.

Its responsibility ends at safe, traceable evidence intake.

---

## 34. Implementation Boundary

No implementation is authorized by this draft.

Before implementation:

1. review this corrected contract;
2. correct any remaining ambiguities;
3. approve the contract;
4. lock and commit the approved contract.

Only after those steps may implementation authority be considered.

---

## 35. Acceptance Criteria

Workflow #6 may be considered contract-ready only when human review confirms that:

- existing workspace containment remains unchanged;
- external evidence cannot escape its intake boundary;
- external sources remain read-only;
- archive traversal is safely rejected;
- symlink/junction/reparse escape is safely rejected;
- resource limits are explicit;
- supported formats are explicit;
- staging root is explicit;
- cleanup behavior is explicit;
- concurrency behavior is explicit;
- provenance is deterministic;
- manifest schema is exact;
- staging-root trust boundary is explicit;
- lock ownership and concurrency behavior are explicit;
- manifest path-field semantics are exact for every source class;
- supplied outer ZIP representation is exact;
- every artifact receives a disposition or the file-count exception applies;
- partial processing is visible and bounded;
- downstream authority remains NONE;
- required regressions are defined;
- no existing Machine workflow is weakened.

---

## Final Contract State

Current status:

```text
DRAFT - CORRECTION PASS 11
```

Direction:

```text
ACCEPTED / LOCKED
```

Implementation:

```text
NOT AUTHORIZED
```

Runtime changes:

```text
NONE
```

Regression changes:

```text
NONE
```

Canonical authority:

```text
NONE
```

Governance authority:

```text
NONE
```

Lock authority:

```text
NONE
```
