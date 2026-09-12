'use strict';

const {
  RULESET_VERSION,
  AUTHORITY,
  OUTCOMES,
  createCurrentBoundedContinuationExecutionStartEvidence
} = require('./current-bounded-continuation-execution-start-evidence');

const crypto = require('node:crypto');
let passed = 0;
const tests = [];
const t = (name, fn) => tests.push([name, fn]);
const clone = value => JSON.parse(JSON.stringify(value));
const assert = (condition, message='assertion failed') => { if(!condition) throw new Error(message); };
const canonical = value => Array.isArray(value) ? value.map(canonical) : (value && typeof value === 'object' ? Object.keys(value).sort().reduce((o,k)=>(o[k]=canonical(value[k]),o),{}) : value);
const dig = value => `sha256:${crypto.createHash('sha256').update(Buffer.from(JSON.stringify(canonical(value)),'utf8')).digest('hex')}`;

const scope={
  scopeType:'GATE',interactionId:'interaction:1',fromInteractionRevision:7,throughInteractionRevision:7,
  gateId:'gate:1',gateRevision:2,authorityScopeDigest:`sha256:${'a'.repeat(64)}`,continuationTargetRef:'continuation:target:1'
};
const start={
  executionStartId:'continuation-execution-start:abc',
  type:'GT63_BOUNDED_CONTINUATION_EXECUTION_START',schemaVersion:'1.0',rulesetVersion:'bounded-continuation-execution-start-current-evidence-binding-v0.1.0',
  executionIntentId:'execution-intent:1',currentExecutionIntentEvidenceRef:'gt63-evidence:current-intent:1',
  executionStartRequirementEvidenceRef:'gt63-evidence:start-requirement:1',principalRef:'gt63-machine:human-principal:goce-v0',principalRevision:'v0',
  executionTargetRef:'execution:target:1',contextScope:scope,startState:'PERMITTED',authority:'NONE',executionStartPermitted:true,
  executionStarted:false,continuationExecuted:false,effectAuthorized:false,effectPerformed:false,effectVerified:false
};
const startDigest=dig(start);
const state={executionStartId:start.executionStartId,executionStartDigest:startDigest,lifecycleState:'CURRENT',freshnessState:'CURRENT',contradictionState:'NONE',authority:'NONE'};
const request={
  rulesetVersion:RULESET_VERSION,executionStartId:start.executionStartId,executionIntentId:start.executionIntentId,
  currentExecutionIntentEvidenceRef:start.currentExecutionIntentEvidenceRef,executionStartRequirementEvidenceRef:start.executionStartRequirementEvidenceRef,
  expectedPrincipalRef:start.principalRef,expectedPrincipalRevision:start.principalRevision,interactionId:scope.interactionId,
  interactionRevision:7,gateId:scope.gateId,gateRevision:scope.gateRevision,authorityScopeDigest:scope.authorityScopeDigest,
  continuationTargetRef:scope.continuationTargetRef,executionTargetRef:start.executionTargetRef
};

function engine(startValue=start,stateValue=state){
  return createCurrentBoundedContinuationExecutionStartEvidence({
    executionStartPort:()=>clone(startValue),
    executionStartStatePort:()=>clone(stateValue)
  });
}
function assessWith({s=start,st=state,r=request,startPort,statePort}={}){
  const e=createCurrentBoundedContinuationExecutionStartEvidence({executionStartPort:startPort||(()=>clone(s)),executionStartStatePort:statePort||(()=>clone(st))});
  return e.assess(clone(r));
}

// constructor
 t('constructor-requires-execution-start-port',()=>{let ok=false;try{createCurrentBoundedContinuationExecutionStartEvidence({executionStartStatePort:()=>state});}catch(_){ok=true;}assert(ok);});
 t('constructor-requires-state-port',()=>{let ok=false;try{createCurrentBoundedContinuationExecutionStartEvidence({executionStartPort:()=>start});}catch(_){ok=true;}assert(ok);});

// happy path / bindings
 t('exact-current-execution-start-resolved',()=>assert(engine().assess(request).outcome===OUTCOMES.RESOLVED));
 t('evidence-binds-exact-start-digest',()=>assert(engine().assess(request).evidence.executionStartDigest===startDigest));
 t('evidence-binds-execution-intent-id',()=>assert(engine().assess(request).evidence.executionIntentId===start.executionIntentId));
 t('evidence-binds-both-upstream-evidence-refs',()=>{const e=engine().assess(request).evidence;assert(e.currentExecutionIntentEvidenceRef===start.currentExecutionIntentEvidenceRef&&e.executionStartRequirementEvidenceRef===start.executionStartRequirementEvidenceRef);});
 t('evidence-binds-principal',()=>{const e=engine().assess(request).evidence;assert(e.principalRef===start.principalRef&&e.principalRevision===start.principalRevision);});
 t('evidence-binds-execution-target',()=>assert(engine().assess(request).evidence.executionTargetRef===start.executionTargetRef));
 t('evidence-binds-exact-scope',()=>assert(JSON.stringify(engine().assess(request).evidence.contextScope)===JSON.stringify(scope)));
 t('deterministic-evidence-identity',()=>assert(engine().assess(request).evidence.currentExecutionStartEvidenceRef===engine().assess(request).evidence.currentExecutionStartEvidenceRef));

// start record absence / corruption
 t('missing-start-not-resolved',()=>assert(assessWith({startPort:()=>null}).outcome===OUTCOMES.NOT_RESOLVED));
 t('start-port-failure-unknown',()=>assert(assessWith({startPort:()=>{throw new Error('x');}}).outcome===OUTCOMES.UNKNOWN));
 t('wrong-start-id-not-resolved',()=>{const s=clone(start);s.executionStartId='wrong';assert(assessWith({s}).outcome===OUTCOMES.NOT_RESOLVED);});
 t('start-must-be-permitted',()=>{const s=clone(start);s.startState='DENIED';assert(assessWith({s}).outcome===OUTCOMES.UNKNOWN);});
 t('start-authority-must-be-none',()=>{const s=clone(start);s.authority='EXECUTE';assert(assessWith({s}).outcome===OUTCOMES.UNKNOWN);});
 t('start-record-cannot-already-be-started',()=>{const s=clone(start);s.executionStarted=true;assert(assessWith({s}).outcome===OUTCOMES.UNKNOWN);});
 t('start-record-cannot-be-continuation-executed',()=>{const s=clone(start);s.continuationExecuted=true;assert(assessWith({s}).outcome===OUTCOMES.UNKNOWN);});
 t('start-record-cannot-have-effect-authorized',()=>{const s=clone(start);s.effectAuthorized=true;assert(assessWith({s}).outcome===OUTCOMES.UNKNOWN);});
 t('start-record-cannot-have-effect-performed',()=>{const s=clone(start);s.effectPerformed=true;assert(assessWith({s}).outcome===OUTCOMES.UNKNOWN);});
 t('start-record-cannot-have-effect-verified',()=>{const s=clone(start);s.effectVerified=true;assert(assessWith({s}).outcome===OUTCOMES.UNKNOWN);});

// request mismatch
 t('wrong-execution-intent-id-not-resolved',()=>{const r=clone(request);r.executionIntentId='wrong';assert(assessWith({r}).outcome===OUTCOMES.NOT_RESOLVED);});
 t('wrong-current-intent-evidence-ref-not-resolved',()=>{const r=clone(request);r.currentExecutionIntentEvidenceRef='wrong';assert(assessWith({r}).outcome===OUTCOMES.NOT_RESOLVED);});
 t('wrong-start-requirement-ref-not-resolved',()=>{const r=clone(request);r.executionStartRequirementEvidenceRef='wrong';assert(assessWith({r}).outcome===OUTCOMES.NOT_RESOLVED);});
 t('wrong-principal-not-resolved',()=>{const r=clone(request);r.expectedPrincipalRef='wrong';assert(assessWith({r}).outcome===OUTCOMES.NOT_RESOLVED);});
 t('wrong-principal-revision-not-resolved',()=>{const r=clone(request);r.expectedPrincipalRevision='wrong';assert(assessWith({r}).outcome===OUTCOMES.NOT_RESOLVED);});
 t('wrong-interaction-not-resolved',()=>{const r=clone(request);r.interactionId='wrong';assert(assessWith({r}).outcome===OUTCOMES.NOT_RESOLVED);});
 t('wrong-gate-id-not-resolved',()=>{const r=clone(request);r.gateId='wrong';assert(assessWith({r}).outcome===OUTCOMES.NOT_RESOLVED);});
 t('wrong-gate-revision-not-resolved',()=>{const r=clone(request);r.gateRevision=3;assert(assessWith({r}).outcome===OUTCOMES.NOT_RESOLVED);});
 t('wrong-scope-digest-not-resolved',()=>{const r=clone(request);r.authorityScopeDigest=`sha256:${'b'.repeat(64)}`;assert(assessWith({r}).outcome===OUTCOMES.NOT_RESOLVED);});
 t('wrong-continuation-target-not-resolved',()=>{const r=clone(request);r.continuationTargetRef='wrong';assert(assessWith({r}).outcome===OUTCOMES.NOT_RESOLVED);});
 t('wrong-execution-target-not-resolved',()=>{const r=clone(request);r.executionTargetRef='wrong';assert(assessWith({r}).outcome===OUTCOMES.NOT_RESOLVED);});
 t('revision-before-scope-not-resolved',()=>{const r=clone(request);r.interactionRevision=6;assert(assessWith({r}).outcome===OUTCOMES.NOT_RESOLVED);});
 t('revision-after-scope-not-resolved',()=>{const r=clone(request);r.interactionRevision=8;assert(assessWith({r}).outcome===OUTCOMES.NOT_RESOLVED);});

// state attestation
 t('state-missing-unknown',()=>assert(assessWith({statePort:()=>null}).outcome===OUTCOMES.UNKNOWN));
 t('state-port-failure-unknown',()=>assert(assessWith({statePort:()=>{throw new Error('x');}}).outcome===OUTCOMES.UNKNOWN));
 t('state-must-bind-exact-start-id',()=>{const st=clone(state);st.executionStartId='wrong';assert(assessWith({st}).outcome===OUTCOMES.UNKNOWN);});
 t('state-must-bind-exact-start-digest',()=>{const st=clone(state);st.executionStartDigest=`sha256:${'c'.repeat(64)}`;assert(assessWith({st}).outcome===OUTCOMES.UNKNOWN);});
 t('stale-lifecycle-unknown',()=>{const st=clone(state);st.lifecycleState='STALE';assert(assessWith({st}).outcome===OUTCOMES.UNKNOWN);});
 t('stale-freshness-unknown',()=>{const st=clone(state);st.freshnessState='STALE';assert(assessWith({st}).outcome===OUTCOMES.UNKNOWN);});
 t('contradictory-state-unknown',()=>{const st=clone(state);st.contradictionState='CONTRADICTORY';assert(assessWith({st}).outcome===OUTCOMES.UNKNOWN);});
 t('state-authority-must-be-none',()=>{const st=clone(state);st.authority='EXECUTE';assert(assessWith({st}).outcome===OUTCOMES.UNKNOWN);});
 t('state-extra-field-unknown',()=>{const st=clone(state);st.extra=true;assert(assessWith({st}).outcome===OUTCOMES.UNKNOWN);});

// request schema / authority non-escalation
 t('wrong-ruleset-invalid',()=>{const r=clone(request);r.rulesetVersion='wrong';assert(engine().assess(r).outcome===OUTCOMES.INVALID);});
 t('extra-request-field-invalid',()=>{const r=clone(request);r.extra=true;assert(engine().assess(r).outcome===OUTCOMES.INVALID);});
 t('negative-interaction-revision-invalid',()=>{const r=clone(request);r.interactionRevision=-1;assert(engine().assess(r).outcome===OUTCOMES.INVALID);});
 t('zero-gate-revision-invalid',()=>{const r=clone(request);r.gateRevision=0;assert(engine().assess(r).outcome===OUTCOMES.INVALID);});
 t('caller-cannot-force-execution-start',()=>{const r=clone(request);r.executionStarted=true;assert(engine().assess(r).outcome===OUTCOMES.INVALID);});
 t('resolved-result-has-no-start-or-effect-authority',()=>{const x=engine().assess(request);assert(x.authority===AUTHORITY&&!x.executionStartPermitted&&!x.executionStarted&&!x.continuationExecuted&&!x.effectAuthorized&&!x.effectPerformed&&!x.effectVerified);});
 t('resolved-evidence-has-no-start-or-effect-authority',()=>{const e=engine().assess(request).evidence;assert(e.authority===AUTHORITY&&!e.executionStartPermitted&&!e.executionStarted&&!e.continuationExecuted&&!e.effectAuthorized&&!e.effectPerformed&&!e.effectVerified);});
 t('resolved-evidence-is-current-fresh-noncontradictory',()=>{const e=engine().assess(request).evidence;assert(e.lifecycleState==='CURRENT'&&e.freshnessState==='CURRENT'&&e.contradictionState==='NONE');});
 t('unknown-result-has-no-downstream-authority',()=>{const x=assessWith({statePort:()=>null});assert(!x.executionStartPermitted&&!x.executionStarted&&!x.continuationExecuted&&!x.effectAuthorized&&!x.effectPerformed&&!x.effectVerified);});
 t('not-resolved-result-has-no-downstream-authority',()=>{const x=assessWith({startPort:()=>null});assert(!x.executionStartPermitted&&!x.executionStarted&&!x.continuationExecuted&&!x.effectAuthorized&&!x.effectPerformed&&!x.effectVerified);});
 t('invalid-result-has-no-downstream-authority',()=>{const r=clone(request);r.extra=1;const x=engine().assess(r);assert(!x.executionStartPermitted&&!x.executionStarted&&!x.continuationExecuted&&!x.effectAuthorized&&!x.effectPerformed&&!x.effectVerified);});

for(const [name,fn] of tests){
  try{fn();passed+=1;console.log(`PASS - ${name}`);}catch(error){console.error(`FAIL - ${name}: ${error.message}`);process.exitCode=1;}
}
console.log(`${passed}/${tests.length} PASS`);
if(passed!==tests.length) process.exitCode=1;
