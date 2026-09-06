# GT63 MACHINE — EXTERNAL DNA CASE #010

## PSER / PHYSICAL EFFECT EVIDENCE RECEIPT

> Status: EXTERNAL CONVERGENT EVIDENCE / CANDIDATE DNA
>
> Source class: IETF Internet-Draft / work in progress
>
> This record preserves an external architectural convergence relevant to GT63 MACHINE physical-world evidence. It is not an accepted MACHINE primitive, not evidence of standards adoption, and not implementation authority.

> **EXTERNAL EVIDENCE ≠ CANONICAL MACHINE TRUTH**  
> **INTERNET-DRAFT ≠ ADOPTED STANDARD**  
> **EXECUTION EVIDENCE ≠ CORRECTNESS EVIDENCE ≠ OUTCOME EVIDENCE**

## 1. Primary source

- IETF Internet-Draft: `draft-wilder-scitt-physical-site-engage-receipt-02`
- Title: *Physical-Site Engagement Receipts (PSER)*
- Source: https://www.ietf.org/ietf-ftp/internet-drafts/draft-wilder-scitt-physical-site-engage-receipt-02.html

The draft proposes a tamper-evident, signed, offline-verifiable receipt for a bounded physical engagement. The receipt binds evidence about a site, an actor, a responsible operator, an engagement window, an operating envelope, sealed observation/evidence material, and a write-in to a separate operational system.

## 2. Material mechanism

The important architectural signal is epistemic rather than merely cryptographic. A receipt can support a narrow claim that a particular physical engagement occurred under an identified actor/operator/site/envelope context without proving that the action was safe, correct, wise, causally effective, or outcome-successful.

```text
PHYSICAL ACTION / ENGAGEMENT
        ↓
ACTOR + RESPONSIBLE OPERATOR + SITE
        ↓
BOUND OPERATING ENVELOPE
        ↓
SEALED OBSERVATION / EVIDENCE
        ↓
TAMPER-EVIDENT RECEIPT
        ↓
INDEPENDENT VERIFICATION
```

## 3. Candidate invariants

> **PHYSICAL EXECUTION ≠ SAFE EXECUTION**
>
> **PHYSICAL EXECUTION ≠ DESIRED OUTCOME**
>
> **EXECUTION EVIDENCE ≠ CORRECTNESS EVIDENCE**
>
> **EXECUTION EVIDENCE ≠ CAUSAL SUCCESS**
>
> **ACTOR ≠ RESPONSIBLE OPERATOR ≠ EVIDENCE ISSUER**
>
> **ENVELOPE CONFORMANCE MUST BE OBSERVED / EVALUATED, NOT ASSUMED**
>
> **PHYSICAL EFFECT CLAIMS SHOULD BE NARROW, SIGNED, AND INDEPENDENTLY VERIFIABLE**

## 4. Outcome and conformance separation

The draft separates engagement outcome from envelope conformance. Candidate values include outcome classes such as `COMPLETED`, `ABORTED`, `REFUSED`, `ERRORED`, and `OBSERVED_ONLY`, while conformance is represented separately through states such as `WITHIN`, exceeded-envelope variants, or `UNKNOWN`.

This separation is materially aligned with MACHINE evidence discipline:

```text
WHAT HAPPENED
    ≠
WHETHER IT WAS WITHIN BOUNDS
    ≠
WHETHER IT WAS CORRECT
    ≠
WHETHER THE DESIRED OUTCOME OCCURRED
    ≠
WHETHER THE ACTION CAUSED THAT OUTCOME
```

A `WITHIN`-style conformance claim should require actual evaluation against the bound envelope rather than being inferred from intent, configuration, or the mere absence of a reported exception.

## 5. MACHINE physical-world relation

The external convergence is especially relevant to future physical-world MACHINE architecture because it separates two problems that are easy to collapse:

```text
PHYSICAL-WORLD INTEROPERABILITY / CONTROL
        ≠
VERIFIABLE PROOF THAT A PHYSICAL ENGAGEMENT OCCURRED
```

A hardware/control interoperability layer may let an agent reach and operate heterogeneous physical systems. That does not itself establish trustworthy post-effect evidence about what physically happened.

PSER-like evidence therefore maps to a distinct potential layer:

```text
physical action
      ↓
actor/operator identity
      ↓
bounded operating envelope
      ↓
sealed observation evidence
      ↓
tamper-evident receipt
      ↓
independent verification
```

This is a convergence signal, not a decision to adopt PSER or SCITT.

## 6. Relation to existing MACHINE evidence boundaries

This case externally reinforces distinctions already present in MACHINE work around Runtime Result / Output Observation, outcome evaluation, causal backtrace, and the rule that delivery/execution success is not the same as outcome success.

The strongest architectural value is the narrowness of the claim: evidence that an effect/engagement happened should remain evidence of that fact only unless additional evidence supports safety, correctness, outcome, or causality.

Candidate preservation rule:

> **A RECEIPT FOR EFFECT MUST NOT BE PROMOTED INTO A RECEIPT FOR CORRECTNESS OR SUCCESS.**

## 7. Strength / limitations

Strength:

- concrete physical-world evidence object;
- signed/tamper-evident and independently verifiable;
- explicit actor/operator distinction;
- explicit bound-envelope semantics;
- explicit separation of execution outcome from conformance;
- narrow evidential claim discipline.

Limitations:

- Internet-Draft / work in progress;
- not an adopted IETF standard;
- not evidence of broad physical-world deployment;
- a valid receipt cannot by itself prove sensor truth, safety, correctness, downstream outcome, or causality;
- no MACHINE implementation decision follows from this record.

## 8. Candidate lifecycle relation

Together with External DNA Case #009, this case creates a research question worth monitoring without promoting it to canonical architecture:

```text
HUMAN INTENT
    ↓
VERIFIABLE AUTHORIZATION OBJECT
    ↓
PRE-EFFECT ENFORCEMENT
    ↓
PHYSICAL EFFECT / EXECUTION
    ↓
VERIFIABLE EFFECT RECEIPT
    ↓
OUTCOME OBSERVATION
    ↓
CAUSAL / SUCCESS ASSESSMENT
```

The conjunction of before-effect human authority binding and after-effect verifiable physical receipts is currently an **observed cross-case hypothesis**, not a proven lifecycle standard and not an accepted MACHINE architecture change.

## 9. Authority boundary

This file creates no authority to:

- modify `docs/MACHINE_CANONICAL_STATE.md`;
- promote candidate invariants to canonical invariants;
- implement PSER, SCITT, TEE, or physical-control mechanisms;
- change Human Gate semantics;
- alter accepted, implementation, or semantic frontiers;
- merge this candidate into `main`;
- deploy or execute effectful physical operations.

> **DNA RECORDING ≠ ARCHITECTURAL ACCEPTANCE**  
> **PHYSICAL EFFECT EVIDENCE ≠ PHYSICAL EFFECT AUTHORITY**  
> **ARCHITECTURAL ACCEPTANCE ≠ IMPLEMENTATION AUTHORITY**
