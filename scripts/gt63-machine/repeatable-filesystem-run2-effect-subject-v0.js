"use strict";
const mat=require("./repeatable-filesystem-effect-material-v0");
const INPUT=Object.freeze({operation:"CREATE_NEW_FILE",authorizedRootIdentity:"GT63_REPEATABLE_EFFECT_TEST/",target:Object.freeze({kind:"RELATIVE_FILE",path:"RUN_2.txt"}),payload:Object.freeze({encoding:"UTF-8",bytesBase64:Buffer.from("GT63 repeatability run 2","utf8").toString("base64")})});
function materializeRun2EffectSubject(){
 const r=mat.validateRepeatableFilesystemEffectMaterialV0(INPUT);
 if(!r||r.state!=="VALID"||!r.material)throw new Error("Run #2 exact effect subject did not validate");
 return Object.freeze({type:"GT63_REPEATABLE_FILESYSTEM_RUN2_EFFECT_SUBJECT",schemaVersion:"1.0",sourceRulesetVersion:mat.RULESET_VERSION,effectSubject:r.material,humanDecisionState:"NOT_CAPTURED",authority:"NONE",authorityEffect:"NONE",effectAuthorized:false,effectPerformed:false});
}
if(require.main===module)process.stdout.write(JSON.stringify(materializeRun2EffectSubject())+"\n");
module.exports=Object.freeze({INPUT,materializeRun2EffectSubject});
