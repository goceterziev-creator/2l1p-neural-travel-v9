# GT63 MACHINE — EXTERNAL RESEARCH EVIDENCE — 2026-09-03

> Status: EXTERNAL CONVERGENT EVIDENCE / CANDIDATE REGRESSIONS
>
> This record preserves externally published research relevant to GT63 MACHINE. It is not canonical MACHINE truth, an accepted architectural primitive, or implementation authority.
>
> **EXTERNAL EVIDENCE ≠ CANONICAL MACHINE TRUTH**  
> **RESEARCH SIGNAL ≠ IMPLEMENTATION DECISION**

## 1. Intake scope

Source: GT63 MACHINE research briefing dated 2026-09-03, subsequently checked against the primary arXiv records.

Authoritative MACHINE baseline at intake:

- `refs/heads/main`: `b9a76c77157990054adf363a2c03ec419fb04e75`
- tree: `2015a6b3de22b6baf9de69e320834f69ae79fc3f`
- canonical navigation index: `docs/MACHINE_CANONICAL_STATE.md`
- current recorded semantic frontier: `Authenticated Governance Authorization Binding V0`

No accepted, implementation, or semantic frontier change is asserted by this record.

## 2. External evidence A — endogenous authorization laundering through memory

Primary source:

- arXiv:2609.01836
- *Agent Memory Is a Surface for Endogenous Authorization Laundering*
- Tommaso Cerruti, Mika Okamoto, Ansel Kaplan Erol

Reported result:

EAL-Bench studies persistent memory carrying evolving permissions, restrictions, and revocations. Five models are evaluated as memory writers and two as executors across procurement, cybersecurity, and finance. Under incremental memory updates, writers create false authority for up to 50.2% of unauthorized requests. Once false authority is present, executors act on it in 98.6% of trials. Requiring stored permissions to be backed by valid source events and using bounded event sourcing substantially reduce laundering, while increasing rejection of some legitimate actions.

Evidence assessment:

- strong external convergent signal for controlled benchmark behavior;
- does not establish production incidence;
- synthetic authorization histories and simulated domains limit ecological validity;
- does not by itself establish a new MACHINE primitive.

Candidate invariants:

> **MEMORY OF AUTHORITY ≠ AUTHORITY**
>
> **RECORDED PERMISSION ≠ VALID PERMISSION**

MACHINE relation:

Persistent memory may help locate or summarize authorization evidence, but must not create authorization. Current authorization truth should remain bound to valid source events, principal identity, current eligibility/delegation/lifecycle evidence, the exact authorization event, and the exact governed Gate/resource/context.

High-priority candidate adversarial regression:

```text
VALID GRANT
  → NARROW / REVOKE
  → INCORRECT MEMORY SUMMARY
  → EFFECTFUL REQUEST
  → EXPECTED: FAIL-CLOSED or HUMAN GATE
```

This regression is a candidate only. Recording it here does not authorize implementation or acceptance.

## 3. External evidence B — long-horizon reliability degradation

Primary source:

- arXiv:2609.01660
- *How Fast Do Agents Rot? An Empirical Study of Long-Horizon Degradation in LLM Agents for Production Decision-Making*
- Shubhra Mittal

Reported result:

The study analyzes 10,664 trajectories across nine models, four task families, five horizons, and three context regimes. Task success approximately follows geometric degradation governed by per-step reliability. In the agentic tool-use family, tested models fall from near-perfect success to near zero within sixteen steps. The authors report degradation driven more by dependent step count than context length and project lower success at production-scale horizons.

Evidence assessment:

- useful controlled evidence for horizon-aware evaluation;
- primarily synthetic/oracle-scored tasks;
- does not establish a new governance layer or primitive.

Candidate evaluation invariants:

> **PER-STEP RELIABILITY ≠ END-TO-END RELIABILITY**
>
> **SHORT-HORIZON PASS ≠ PRODUCTION-HORIZON RELIABILITY**

Candidate evaluation consequences:

- stratify results by dependent-step horizon;
- measure conditional per-step reliability where meaningful;
- use reliability budgets and independently verifiable checkpoints for long trajectories;
- distinguish context-loss failure from accumulated local-step error.

## 4. External evidence C — provenance-conserving corroboration

Primary source:

- arXiv:2609.01662
- *Not All Agreement Counts as Corroboration: Provenance-Conserving Multi-View Fusion for Typed Action Admission in Human-Robot Collaboration*
- Zekai Jin, Hanrong Zhang, Yihong Tang, Fei Hu, Zhen Dong, Yi Shao

Reported result:

PACT distinguishes computational multiplicity from evidential multiplicity. A supplied provenance partition defines separately countable evidence units, and evidence budget grows only across those units. Across 31,200 evaluations, provenance reassignment changes evidence budgets as predicted. In the reported offline human-robot study, eightfold within-camera duplication leaves typed responses unchanged; camera-grouped PACT admits 47 of 57 reference-consistent candidates with no observed reference-inconsistent admission in 60 episodes.

Evidence assessment:

- medium-strength external signal for provenance-aware evidence aggregation;
- supplied provenance partitions and a narrow robotics setting limit generalization;
- no claim is made here that PACT itself should be adopted by MACHINE.

Candidate invariants:

> **MULTIPLE OUTPUTS ≠ MULTIPLE SOURCES**
>
> **AGREEMENT ≠ INDEPENDENT CORROBORATION**
>
> **EVIDENCE COUNT ≠ SOURCE INDEPENDENCE**

Candidate MACHINE consequence:

Repeated model calls, agents, summaries, or derived artifacts sharing one primary provenance root should not automatically increase evidential weight merely because their outputs agree.

## 5. External evidence D — attribute before memorizing outcomes

Primary source:

- arXiv:2609.02074
- *CHIME: Credit-Aware Hierarchical Memory Evolution for Long-Horizon Agentic Planning*
- Yongshi Ye et al.

Reported result:

CHIME separates planning memory from execution memory and follows an `attribute-before-memorize` principle: a final outcome is first attributed to planning, execution, both, or neither, and only the corresponding memory bank is updated. The paper reports improvements over evaluated baselines across four long-horizon agent benchmarks and substantially more compact accumulated memory.

Evidence assessment:

- useful external corroboration for typed memory and credit assignment;
- attribution is itself model-mediated and should not be treated as causal truth merely because it is stable or useful;
- preprint evidence does not authorize automated MACHINE learning or mutation.

Candidate invariants:

> **SUCCESSFUL OUTCOME ≠ GOOD PLAN**
>
> **FAILED OUTCOME ≠ BAD PLAN**
>
> **OUTCOME ≠ CAUSE**

MACHINE relation:

Model-generated attribution should remain a proposal/claim requiring evidence appropriate to its consequence. A successful or failed final result alone should not automatically teach MACHINE that a plan, execution step, tool, or memory item was causally responsible.

## 6. Cross-paper architectural assessment

These papers provide external convergent evidence for already emerging MACHINE concerns around authorization provenance, evidence independence, causal attribution, memory discipline, and long-horizon evaluation.

They do **not** establish that GT63 MACHINE should adopt a new primitive, framework, benchmark, memory architecture, or authorization mechanism.

The strongest immediate candidate is the authorization-laundering regression because it directly challenges the separation between remembered permission and currently valid authorization.

Candidate preservation rules from this intake:

> **MEMORY MAY INFORM A DECISION; MEMORY MUST NOT CREATE AUTHORITY.**
>
> **EXTERNAL CONVERGENCE ≠ INTERNAL VALIDATION.**

## 7. MACHINE_STATE_DELTA assessment

```text
MACHINE_STATE_DELTA

BASELINE_BEFORE:
  main_commit: b9a76c77157990054adf363a2c03ec419fb04e75
  main_tree: 2015a6b3de22b6baf9de69e320834f69ae79fc3f

SOURCE_IDENTITY:
  - arXiv:2609.01836
  - arXiv:2609.01660
  - arXiv:2609.01662
  - arXiv:2609.02074

NEW_EVIDENCE:
  external convergent evidence and candidate regressions/evaluation rules

STATUS_CHANGE:
  from: NONE
  to: EXTERNAL EVIDENCE / CANDIDATE REGRESSIONS

FRONTIER_CHANGE:
  accepted_frontier: unchanged
  implementation_frontier: unchanged
  semantic_frontier: unchanged

NEW_INVARIANTS:
  candidate only; none promoted to canonical MACHINE invariant by this record

UNRESOLVED:
  - whether any candidate invariant should later become canonical
  - whether the authorization-laundering regression should enter a governance adversarial test pack
  - whether horizon-resolved evaluation should become a formal MACHINE evaluation contract
  - whether provenance-independent corroboration requires a formal evidence contract

AUTHORITY_CREATED: NONE
MAIN_MUTATED: false
```

## 8. Authority boundary

This file is a research/evidence intake record only.

It creates no authority to:

- alter `docs/MACHINE_CANONICAL_STATE.md`;
- implement or integrate a capability;
- modify a Human Gate;
- promote candidate invariants to canonical invariants;
- change accepted, implementation, or semantic frontiers;
- merge this candidate into `main`;
- deploy or execute effectful operations.

> **RESEARCH RECORDING ≠ ARCHITECTURAL ACCEPTANCE**
>
> **ARCHITECTURAL ACCEPTANCE ≠ IMPLEMENTATION AUTHORITY**

---

Creation authority: explicit Human Gate for a bounded external-evidence record on a non-main branch.  
STOP after candidate creation and read-back verification; no merge, no movement of `main`, no deploy.