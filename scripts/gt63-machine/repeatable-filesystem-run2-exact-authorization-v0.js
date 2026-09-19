"use strict";
const subject=require("./repeatable-filesystem-run2-effect-subject-v0");
const decision=require("./repeatable-filesystem-run2-human-decision-v0");
const auth=require("./repeatable-filesystem-exact-effect-authorization-v0");
function ledger(){const rows=[];return{findByEffectContractId:id=>rows.filter(x=>x.effectContractId===id).map(x=>JSON.parse(JSON.stringify(x))),commit:x=>(rows.push(JSON.parse(JSON.stringify(x))),JSON.parse(JSON.stringify(x)))}}
function authorizeRun2(){
 const m=subject.materializeRun2EffectSubject().effectSubject,h=decision.materializeRun2HumanDecision();
 if(h.effectContractId!==m.effectContractId||h.effectContractDigest!==m.effectContractDigest)throw new Error("Run #2 human decision does not bind exact effect subject");
 const sys=auth.createRepeatableFilesystemExactEffectAuthorizationV0({materialPort:({effectContractId})=>{if(effectContractId!==m.effectContractId)throw Error("material unavailable");return m;},humanDecisionPort:({humanDecisionEvidenceRef})=>{if(humanDecisionEvidenceRef!==h.humanDecisionEvidenceRef)throw Error("decision unavailable");return h;},authorizationLedger:ledger()});
 const r=sys.authorize({rulesetVersion:auth.RULESET_VERSION,effectContractId:m.effectContractId,humanDecisionEvidenceRef:h.humanDecisionEvidenceRef});
 if(r.outcome!==auth.OUTCOMES.AUTHORIZED||!r.authorization)throw new Error("Run #2 exact authorization failed: "+r.outcome);
 return Object.freeze({...r,run2EvidenceMode:"EXACT_MATERIAL_PLUS_EXPLICIT_HUMAN_DECISION",effectPerformed:false});
}
if(require.main===module)process.stdout.write(JSON.stringify(authorizeRun2())+"\n");
module.exports=Object.freeze({authorizeRun2});
