"use strict";
const subject=require("./repeatable-filesystem-run2-effect-subject-v0");
const DECISION_REF="gt63-human-decision:run2-exact-effect-subject:2026-09-19@1";
function materializeRun2HumanDecision(){
 const s=subject.materializeRun2EffectSubject(),m=s.effectSubject;
 return Object.freeze({type:"GT63_HUMAN_EXACT_EFFECT_DECISION_EVIDENCE",schemaVersion:"1.0",humanDecisionEvidenceRef:DECISION_REF,decision:"APPROVE",effectContractId:m.effectContractId,effectContractDigest:m.effectContractDigest,lifecycleState:"CURRENT",freshnessState:"CURRENT",contradictionState:"NONE",decisionBasis:"EXPLICIT_HUMAN_APPROVAL_OF_EXACT_RUN_2_EFFECT_SUBJECT",authority:"NONE",authorityEffect:"NONE",effectPerformed:false});
}
if(require.main===module)process.stdout.write(JSON.stringify(materializeRun2HumanDecision())+"\n");
module.exports=Object.freeze({DECISION_REF,materializeRun2HumanDecision});
