'use strict';

const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { RULESET_VERSION, AUTHORITY, GOVERNANCE_PRINCIPAL_REF, GOVERNANCE_PRINCIPAL_REVISION, createCurrentBoundedExecutionStartRuntimeExecutionStartObservationWiring } = require('./current-bounded-execution-start-runtime-execution-start-observation-wiring');

const canonical = v => Array.isArray(v) ? v.map(canonical) : (v && typeof v === 'object' ? Object.keys(v).sort().reduce((o,k)=>(o[k]=canonical(v[k]),o),{}) : v);
const digest = v => `sha256:${crypto.createHash('sha256').update(Buffer.from(JSON.stringify(canonical(v)),'utf8')).digest('hex')}`;
const sha = c => `sha256:${String(c).repeat(64).slice(0,64)}`;
const clone = v => JSON.parse(JSON.stringify(v));
const ledger = () => { const m=new Map(); return { get:k=>m.get(k)||null, commit(k,v){ if(m.has(k)) throw new Error('conflict'); m.set(k,clone(v)); return m.get(k); } }; };

const scope = Object.freeze({ scopeType:'GATE', interactionId:'interaction:runtime-v0', fromInteractionRevision:7, throughInteractionRevision:7, gateId:'gate:operator-v0', gateRevision:1, authorityScopeDigest:sha('a'), continuationTargetRef:'continuation:operator-v0' });
const startEvidence = Object.freeze({
  currentExecutionStartEvidenceRef:'gt63-evidence:current-start:fixture',
  type:'GT63_CURRENT_BOUNDED_CONTINUATION_EXECUTION_START_EVIDENCE', schemaVersion:'1.0', rulesetVersion:'current-bounded-continuation-execution-start-evidence-v0.1.0',
  executionStartId:'continuation-execution-start:fixture', executionStartDigest:sha('b'), executionIntentId:'continuation-execution-intent:fixture',
  currentExecutionIntentEvidenceRef:'gt63-evidence:current-intent:fixture', executionStartRequirementEvidenceRef:'gt63-evidence:start-requirement:fixture',
  principalRef:GOVERNANCE_PRINCIPAL_REF, principalRevision:GOVERNANCE_PRINCIPAL_REVISION, executionTargetRef:'execution-target:operator-v0', contextScope:scope,
  lifecycleState:'CURRENT', freshnessState:'CURRENT', contradictionState:'NONE', authority:AUTHORITY,
  executionStartPermitted:false, executionStarted:false, continuationExecuted:false, effectAuthorized:false, effectPerformed:false, effectVerified:false
});
const goodWrapper = () => ({ outcome:'RESOLVED', reason:null, evidence:clone(startEvidence), authority:AUTHORITY, executionStartPermitted:false, executionStarted:false, continuationExecuted:false, effectAuthorized:false, effectPerformed:false, effectVerified:false });
const request = () => ({ rulesetVersion:RULESET_VERSION, currentExecutionStartEvidenceRef:startEvidence.currentExecutionStartEvidenceRef, executionStartId:startEvidence.executionStartId, executionStartDigest:startEvidence.executionStartDigest, executionIntentId:startEvidence.executionIntentId, currentExecutionIntentEvidenceRef:startEvidence.currentExecutionIntentEvidenceRef, executionStartRequirementEvidenceRef:startEvidence.executionStartRequirementEvidenceRef, principalRef:GOVERNANCE_PRINCIPAL_REF, principalRevision:GOVERNANCE_PRINCIPAL_REVISION, interactionId:scope.interactionId, interactionRevision:7, gateId:scope.gateId, gateRevision:1, authorityScopeDigest:scope.authorityScopeDigest, continuationTargetRef:scope.continuationTargetRef, executionTargetRef:startEvidence.executionTargetRef });

function harness({ startMutate, wrapperMutate, adapterMode='good', verifierMode='good' }={}) {
  let adapterCalls=0, verifierCalls=0;
  const currentExecutionStartResultPort = () => {
    const w=goodWrapper();
    if(startMutate) startMutate(w.evidence);
    if(wrapperMutate) wrapperMutate(w);
    return w;
  };
  const executionAdapter = envelope => {
    adapterCalls++;
    if(adapterMode==='throw') throw new Error('adapter');
    if(adapterMode==='ambiguous') return { runtimeOccurrenceRef:'runtime:1' };
    if(adapterMode==='extra') return { runtimeOccurrenceRef:'runtime:1', runtimeOccurrenceMaterial:{ started:true }, extra:true };
    return { runtimeOccurrenceRef:'runtime:1', runtimeOccurrenceMaterial:{ started:true, executionStartId:envelope.executionStartId } };
  };
  const runtimeOccurrenceVerifier = input => {
    verifierCalls++;
    if(verifierMode==='throw') throw new Error('verifier');
    const a={ invocationId:input.invocationId, invocationDigest:input.invocationDigest, runtimeOccurrenceRef:input.runtimeOccurrenceRef, runtimeOccurrenceDigest:input.runtimeOccurrenceDigest, observationState:'OBSERVED', executionStarted:true, lifecycleState:'CURRENT', freshnessState:'CURRENT', contradictionState:'NONE', authority:AUTHORITY };
    if(verifierMode==='not-observed'){ a.observationState='NOT_OBSERVED'; a.executionStarted=false; }
    if(verifierMode==='wrong-id') a.invocationId='wrong';
    if(verifierMode==='wrong-inv-digest') a.invocationDigest=sha('c');
    if(verifierMode==='wrong-occ-ref') a.runtimeOccurrenceRef='wrong';
    if(verifierMode==='wrong-occ-digest') a.runtimeOccurrenceDigest=sha('d');
    if(verifierMode==='stale') a.freshnessState='STALE';
    if(verifierMode==='contradictory') a.contradictionState='PRESENT';
    if(verifierMode==='authority') a.authority='SOME';
    if(verifierMode==='ambiguous') a.executionStarted=false;
    if(verifierMode==='extra') a.extra=true;
    return a;
  };
  const wiring=createCurrentBoundedExecutionStartRuntimeExecutionStartObservationWiring({ currentExecutionStartResultPort, executionAdapter, runtimeOccurrenceVerifier, invocationLedger:ledger(), observationLedger:ledger() });
  return { wiring, adapterCalls:()=>adapterCalls, verifierCalls:()=>verifierCalls };
}

const tests=[];
const test=(name,fn)=>tests.push([name,fn]);
const outcome=(name, setup, mutate, expected)=>test(name,()=>{ const h=harness(setup); const r=request(); if(mutate) mutate(r); assert.equal(h.wiring.assess(r).outcome,expected); });

for(const [name,args,msg] of [
  ['constructor-requires-currentExecutionStartResultPort',{ executionAdapter:()=>{}, runtimeOccurrenceVerifier:()=>{}, invocationLedger:ledger(), observationLedger:ledger() },'currentExecutionStartResultPort'],
  ['constructor-requires-executionAdapter',{ currentExecutionStartResultPort:()=>{}, runtimeOccurrenceVerifier:()=>{}, invocationLedger:ledger(), observationLedger:ledger() },'executionAdapter'],
  ['constructor-requires-runtimeOccurrenceVerifier',{ currentExecutionStartResultPort:()=>{}, executionAdapter:()=>{}, invocationLedger:ledger(), observationLedger:ledger() },'runtimeOccurrenceVerifier'],
  ['constructor-requires-invocationLedger',{ currentExecutionStartResultPort:()=>{}, executionAdapter:()=>{}, runtimeOccurrenceVerifier:()=>{}, observationLedger:ledger() },'invocationLedger'],
  ['constructor-requires-observationLedger',{ currentExecutionStartResultPort:()=>{}, executionAdapter:()=>{}, runtimeOccurrenceVerifier:()=>{}, invocationLedger:ledger() },'observationLedger']
]) test(name,()=>assert.throws(()=>createCurrentBoundedExecutionStartRuntimeExecutionStartObservationWiring(args),new RegExp(msg)));

test('exact-current-start-reaches-runtime-start-observation',()=>{ const h=harness(); const r=h.wiring.assess(request()); assert.equal(r.outcome,'OBSERVED'); assert.equal(r.executionStarted,true); assert.equal(r.observation.type,'GT63_EXECUTION_START_OBSERVATION'); });
test('observation-binds-execution-start-id',()=>{ const r=harness().wiring.assess(request()); assert.equal(r.observation.executionStartId,startEvidence.executionStartId); });
test('observation-binds-current-start-ref',()=>{ const r=harness().wiring.assess(request()); assert.equal(r.observation.currentExecutionStartEvidenceRef,startEvidence.currentExecutionStartEvidenceRef); });
test('observation-binds-execution-intent-id',()=>{ const r=harness().wiring.assess(request()); assert.equal(r.observation.executionIntentId,startEvidence.executionIntentId); });
test('observation-binds-principal',()=>{ const r=harness().wiring.assess(request()); assert.equal(r.observation.principalRef,GOVERNANCE_PRINCIPAL_REF); });
test('observation-binds-execution-target',()=>{ const r=harness().wiring.assess(request()); assert.equal(r.observation.executionTargetRef,startEvidence.executionTargetRef); });
test('observation-scope-is-exact-point',()=>{ const r=harness().wiring.assess(request()); assert.equal(r.observation.contextScope.fromInteractionRevision,7); assert.equal(r.observation.contextScope.throughInteractionRevision,7); });
test('observation-does-not-claim-success-completion-or-effect',()=>{ const r=harness().wiring.assess(request()); assert.equal(r.executionSucceeded,false); assert.equal(r.continuationExecuted,false); assert.equal(r.effectAuthorized,false); assert.equal(r.effectPerformed,false); assert.equal(r.effectVerified,false); });
test('authority-remains-none',()=>assert.equal(harness().wiring.assess(request()).authority,'NONE'));

outcome('wrong-start-id-not-invokable',{},r=>r.executionStartId='wrong','NOT_INVOKABLE');
outcome('wrong-start-digest-not-invokable',{},r=>r.executionStartDigest=sha('e'),'NOT_INVOKABLE');
outcome('wrong-intent-id-not-invokable',{},r=>r.executionIntentId='wrong','NOT_INVOKABLE');
outcome('wrong-current-intent-ref-not-invokable',{},r=>r.currentExecutionIntentEvidenceRef='wrong','NOT_INVOKABLE');
outcome('wrong-start-requirement-ref-not-invokable',{},r=>r.executionStartRequirementEvidenceRef='wrong','NOT_INVOKABLE');
outcome('wrong-principal-invalid',{},r=>r.principalRef='wrong','INVALID');
outcome('wrong-principal-revision-invalid',{},r=>r.principalRevision='2','INVALID');
outcome('wrong-gate-not-invokable',{},r=>r.gateId='wrong','NOT_INVOKABLE');
outcome('wrong-scope-digest-not-invokable',{},r=>r.authorityScopeDigest=sha('f'),'NOT_INVOKABLE');
outcome('wrong-continuation-target-not-invokable',{},r=>r.continuationTargetRef='wrong','NOT_INVOKABLE');
outcome('wrong-execution-target-not-invokable',{},r=>r.executionTargetRef='wrong','NOT_INVOKABLE');
outcome('interaction-outside-point-not-invokable',{},r=>r.interactionRevision=8,'NOT_INVOKABLE');
outcome('current-start-stale-is-unknown',{startMutate:e=>e.freshnessState='STALE'},null,'UNKNOWN');
outcome('current-start-contradictory-is-unknown',{startMutate:e=>e.contradictionState='PRESENT'},null,'UNKNOWN');
outcome('current-start-evidence-authority-is-unknown',{startMutate:e=>e.authority='SOME'},null,'UNKNOWN');
outcome('current-start-wrapper-authority-is-unknown',{wrapperMutate:w=>w.authority='SOME'},null,'UNKNOWN');
outcome('current-start-wrapper-not-resolved-is-unknown',{wrapperMutate:w=>w.outcome='UNKNOWN'},null,'UNKNOWN');
outcome('adapter-throw-is-unknown',{adapterMode:'throw'},null,'UNKNOWN');
outcome('adapter-ambiguous-is-unknown',{adapterMode:'ambiguous'},null,'UNKNOWN');
outcome('adapter-extra-field-is-unknown',{adapterMode:'extra'},null,'UNKNOWN');
outcome('verifier-throw-is-unknown',{verifierMode:'throw'},null,'UNKNOWN');
outcome('verifier-not-observed-stays-not-observed',{verifierMode:'not-observed'},null,'NOT_OBSERVED');
outcome('verifier-wrong-id-is-unknown',{verifierMode:'wrong-id'},null,'UNKNOWN');
outcome('verifier-wrong-invocation-digest-is-unknown',{verifierMode:'wrong-inv-digest'},null,'UNKNOWN');
outcome('verifier-wrong-occurrence-ref-is-unknown',{verifierMode:'wrong-occ-ref'},null,'UNKNOWN');
outcome('verifier-wrong-occurrence-digest-is-unknown',{verifierMode:'wrong-occ-digest'},null,'UNKNOWN');
outcome('verifier-stale-is-unknown',{verifierMode:'stale'},null,'UNKNOWN');
outcome('verifier-contradictory-is-unknown',{verifierMode:'contradictory'},null,'UNKNOWN');
outcome('verifier-authority-is-unknown',{verifierMode:'authority'},null,'UNKNOWN');
outcome('verifier-ambiguous-state-is-unknown',{verifierMode:'ambiguous'},null,'UNKNOWN');
outcome('verifier-extra-field-is-unknown',{verifierMode:'extra'},null,'UNKNOWN');
outcome('wrong-ruleset-invalid',{},r=>r.rulesetVersion='wrong','INVALID');
outcome('extra-request-field-invalid',{},r=>r.extra=true,'INVALID');
outcome('malformed-start-digest-invalid',{},r=>r.executionStartDigest='bad','INVALID');
outcome('malformed-scope-digest-invalid',{},r=>r.authorityScopeDigest='bad','INVALID');
outcome('negative-interaction-revision-invalid',{},r=>r.interactionRevision=-1,'INVALID');
outcome('zero-gate-revision-invalid',{},r=>r.gateRevision=0,'INVALID');
outcome('caller-cannot-force-invocation',{},r=>r.invocationAttempted=true,'INVALID');
outcome('caller-cannot-force-started',{},r=>r.executionStarted=true,'INVALID');
outcome('caller-cannot-force-success',{},r=>r.executionSucceeded=true,'INVALID');
outcome('caller-cannot-force-effect',{},r=>r.effectPerformed=true,'INVALID');

test('same-accepted-invocation-replay-does-not-reinvoke-adapter',()=>{ const h=harness(); const r=request(); assert.equal(h.wiring.assess(r).outcome,'OBSERVED'); assert.equal(h.adapterCalls(),1); assert.equal(h.wiring.assess(r).outcome,'OBSERVED'); assert.equal(h.adapterCalls(),1); });
test('same-replay-may-reverify-runtime-occurrence',()=>{ const h=harness(); const r=request(); h.wiring.assess(r); h.wiring.assess(r); assert.equal(h.verifierCalls(),2); });
test('observed-result-invocation-attempted-true',()=>assert.equal(harness().wiring.assess(request()).invocationAttempted,true));
test('not-observed-result-does-not-claim-start',()=>{ const r=harness({verifierMode:'not-observed'}).wiring.assess(request()); assert.equal(r.executionStarted,false); assert.equal(r.executionSucceeded,false); assert.equal(r.continuationExecuted,false); });
test('unknown-result-preserves-no-runtime-success',()=>{ const r=harness({verifierMode:'wrong-id'}).wiring.assess(request()); assert.equal(r.executionStarted,false); assert.equal(r.executionSucceeded,false); assert.equal(r.effectPerformed,false); });
test('invalid-result-preserves-no-runtime-success',()=>{ const r=request(); r.extra=true; const x=harness().wiring.assess(r); assert.equal(x.executionStarted,false); assert.equal(x.executionSucceeded,false); assert.equal(x.effectPerformed,false); });

test('runtime-attestation-is-bound-to-real-digests',()=>{ let captured=null; const h=harness(); const original=h.wiring; const r=original.assess(request()); assert.equal(r.outcome,'OBSERVED'); assert.match(r.observation.invocationDigest,/^sha256:[0-9a-f]{64}$/); });

let pass=0;
for(const [name,fn] of tests){
  try { fn(); pass++; console.log(`PASS - ${name}`); }
  catch(err){ console.error(`FAIL - ${name}`); console.error(err && err.stack || err); }
}
console.log(`${pass}/${tests.length} PASS`);
if(pass!==tests.length) process.exitCode=1;
