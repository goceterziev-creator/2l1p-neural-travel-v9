'use strict';
const assert=require('node:assert/strict');
const {RULESET_VERSION,AUTHORITY,createEffectPerformanceObservationCurrentEvidenceBinding,createMemoryLedger}=require('./effect-performance-observation-current-evidence-binding');
const D='sha256:'+'a'.repeat(64),D2='sha256:'+'b'.repeat(64),D3='sha256:'+'c'.repeat(64),D4='sha256:'+'d'.repeat(64),D5='sha256:'+'e'.repeat(64),D6='sha256:'+'f'.repeat(64);
const scope={scopeType:'GATE',interactionId:'i1',fromInteractionRevision:1,throughInteractionRevision:9,gateId:'g1',gateRevision:1,authorityScopeDigest:D,continuationTargetRef:'cont:1'};
const observation={type:'GT63_CONTINUATION_COMPLETION_OBSERVATION',continuationCompletionObservationId:'cco:1',runtimeCompletionEvidenceRef:'rce:1',executionStartObservationId:'eso:1',executionStartId:'es:1',currentExecutionStartEvidenceRef:'ces:1',runtimeStartEvidenceRef:'rs:1',executionStartDigest:D2,executionIntentId:'ei:1',currentExecutionIntentEvidenceRef:'cei:1',executionStartRequirementEvidenceRef:'esr:1',invocationId:'inv:1',invocationDigest:D3,runtimeOccurrenceRef:'occ:1',runtimeOccurrenceDigest:D4,runtimeCompletionRef:'comp:1',runtimeCompletionDigest:D5,principalRef:'p:1',principalRevision:'pr:1',executionTargetRef:'xt:1',contextScope:scope,observationState:'OBSERVED',authority:AUTHORITY,executionStarted:true,executionSucceeded:false,continuationExecuted:true,effectAuthorized:false,effectPerformed:false,effectVerified:false};
const completionWrapper={outcome:'OBSERVED',authority:AUTHORITY,executionStarted:true,executionSucceeded:false,continuationExecuted:true,effectAuthorized:false,effectPerformed:false,effectVerified:false,observation};
const evidence={type:'GT63_RUNTIME_EFFECT_PERFORMANCE_EVIDENCE',runtimeEffectEvidenceRef:'ree:1',continuationCompletionObservationId:'cco:1',runtimeCompletionEvidenceRef:'rce:1',executionStartObservationId:'eso:1',executionStartId:'es:1',currentExecutionStartEvidenceRef:'ces:1',runtimeStartEvidenceRef:'rs:1',executionStartDigest:D2,executionIntentId:'ei:1',currentExecutionIntentEvidenceRef:'cei:1',executionStartRequirementEvidenceRef:'esr:1',invocationId:'inv:1',invocationDigest:D3,runtimeOccurrenceRef:'occ:1',runtimeOccurrenceDigest:D4,runtimeCompletionRef:'comp:1',runtimeCompletionDigest:D5,runtimeEffectRef:'eff:1',runtimeEffectDigest:D6,principalRef:'p:1',principalRevision:'pr:1',executionTargetRef:'xt:1',contextScope:scope,lifecycleState:'CURRENT',freshnessState:'CURRENT',contradictionState:'NONE',authority:AUTHORITY,executionStarted:true,executionSucceeded:false,continuationExecuted:true,effectAuthorized:false,effectPerformed:true,effectVerified:false};
const effectWrapper={outcome:'OBSERVED',authority:AUTHORITY,executionStarted:true,executionSucceeded:false,continuationExecuted:true,effectAuthorized:false,effectPerformed:true,effectVerified:false,evidence};
const request={rulesetVersion:RULESET_VERSION,continuationCompletionObservationId:'cco:1',runtimeEffectEvidenceRef:'ree:1',runtimeCompletionEvidenceRef:'rce:1',executionStartObservationId:'eso:1',executionStartId:'es:1',currentExecutionStartEvidenceRef:'ces:1',runtimeStartEvidenceRef:'rs:1',executionStartDigest:D2,executionIntentId:'ei:1',currentExecutionIntentEvidenceRef:'cei:1',executionStartRequirementEvidenceRef:'esr:1',invocationId:'inv:1',invocationDigest:D3,runtimeOccurrenceRef:'occ:1',runtimeOccurrenceDigest:D4,runtimeCompletionRef:'comp:1',runtimeCompletionDigest:D5,runtimeEffectRef:'eff:1',runtimeEffectDigest:D6,expectedPrincipalRef:'p:1',expectedPrincipalRevision:'pr:1',interactionId:'i1',interactionRevision:5,gateId:'g1',gateRevision:1,authorityScopeDigest:D,continuationTargetRef:'cont:1',executionTargetRef:'xt:1'};
const clone=x=>JSON.parse(JSON.stringify(x));
function make(over={}){return createEffectPerformanceObservationCurrentEvidenceBinding({continuationCompletionObservationPort:over.completionPort||(()=>clone(completionWrapper)),runtimeEffectEvidencePort:over.effectPort||(()=>clone(effectWrapper)),observationLedger:over.ledger||createMemoryLedger()});}
let n=0;function t(name,fn){try{fn();console.log('PASS - '+name);n++;}catch(e){console.error('FAIL - '+name);throw e;}}
function assess(req=request,over={}){return make(over).assess(clone(req));}

t('constructor-requires-completion-port',()=>assert.throws(()=>createEffectPerformanceObservationCurrentEvidenceBinding({runtimeEffectEvidencePort:()=>{},observationLedger:createMemoryLedger()})));
t('constructor-requires-effect-port',()=>assert.throws(()=>createEffectPerformanceObservationCurrentEvidenceBinding({continuationCompletionObservationPort:()=>{},observationLedger:createMemoryLedger()})));
t('constructor-requires-ledger',()=>assert.throws(()=>createEffectPerformanceObservationCurrentEvidenceBinding({continuationCompletionObservationPort:()=>{},runtimeEffectEvidencePort:()=>{}})));
const r=assess();
t('exact-effect-observed',()=>assert.equal(r.outcome,'OBSERVED'));
t('observation-type-exact',()=>assert.equal(r.observation.type,'GT63_EFFECT_PERFORMANCE_OBSERVATION'));
t('binds-completion-observation',()=>assert.equal(r.observation.continuationCompletionObservationId,'cco:1'));
t('binds-runtime-effect-evidence',()=>assert.equal(r.observation.runtimeEffectEvidenceRef,'ree:1'));
t('binds-runtime-completion-evidence',()=>assert.equal(r.observation.runtimeCompletionEvidenceRef,'rce:1'));
t('binds-start-observation',()=>assert.equal(r.observation.executionStartObservationId,'eso:1'));
t('binds-start-id',()=>assert.equal(r.observation.executionStartId,'es:1'));
t('binds-current-start-ref',()=>assert.equal(r.observation.currentExecutionStartEvidenceRef,'ces:1'));
t('binds-runtime-start-ref',()=>assert.equal(r.observation.runtimeStartEvidenceRef,'rs:1'));
t('binds-start-digest',()=>assert.equal(r.observation.executionStartDigest,D2));
t('binds-intent-id',()=>assert.equal(r.observation.executionIntentId,'ei:1'));
t('binds-current-intent-ref',()=>assert.equal(r.observation.currentExecutionIntentEvidenceRef,'cei:1'));
t('binds-start-requirement-ref',()=>assert.equal(r.observation.executionStartRequirementEvidenceRef,'esr:1'));
t('binds-invocation-id',()=>assert.equal(r.observation.invocationId,'inv:1'));
t('binds-invocation-digest',()=>assert.equal(r.observation.invocationDigest,D3));
t('binds-occurrence-ref',()=>assert.equal(r.observation.runtimeOccurrenceRef,'occ:1'));
t('binds-occurrence-digest',()=>assert.equal(r.observation.runtimeOccurrenceDigest,D4));
t('binds-completion-ref',()=>assert.equal(r.observation.runtimeCompletionRef,'comp:1'));
t('binds-completion-digest',()=>assert.equal(r.observation.runtimeCompletionDigest,D5));
t('binds-effect-ref',()=>assert.equal(r.observation.runtimeEffectRef,'eff:1'));
t('binds-effect-digest',()=>assert.equal(r.observation.runtimeEffectDigest,D6));
t('binds-principal',()=>assert.equal(r.observation.principalRef,'p:1'));
t('binds-principal-revision',()=>assert.equal(r.observation.principalRevision,'pr:1'));
t('binds-execution-target',()=>assert.equal(r.observation.executionTargetRef,'xt:1'));
t('materializes-point-scope',()=>assert.deepEqual(r.observation.contextScope,{...scope,fromInteractionRevision:5,throughInteractionRevision:5}));
t('effect-performed-only',()=>assert.equal(r.observation.effectPerformed,true));
t('does-not-infer-success',()=>assert.equal(r.observation.executionSucceeded,false));
t('does-not-authorize-effect',()=>assert.equal(r.observation.effectAuthorized,false));
t('does-not-verify-effect',()=>assert.equal(r.observation.effectVerified,false));
t('authority-none',()=>assert.equal(r.observation.authority,'NONE'));

t('runtime-not-observed-propagates',()=>assert.equal(assess(request,{effectPort:()=>({outcome:'NOT_OBSERVED'})}).outcome,'NOT_OBSERVED'));
t('completion-port-throw-unknown',()=>assert.equal(assess(request,{completionPort:()=>{throw Error('x')}}).outcome,'UNKNOWN'));
t('effect-port-throw-unknown',()=>assert.equal(assess(request,{effectPort:()=>{throw Error('x')}}).outcome,'UNKNOWN'));
for(const [name,mut] of [
 ['completion-wrapper-authority',w=>w.authority='X'],['completion-wrapper-success',w=>w.executionSucceeded=true],['completion-wrapper-effect',w=>w.effectPerformed=true],['completion-observation-type',w=>w.observation.type='X'],['completion-observation-state',w=>w.observation.observationState='X'],['completion-observation-authority',w=>w.observation.authority='X'],
 ['effect-wrapper-authority',w=>w.authority='X'],['effect-wrapper-success',w=>w.executionSucceeded=true],['effect-wrapper-no-effect',w=>w.effectPerformed=false],['effect-evidence-type',w=>w.evidence.type='X'],['effect-evidence-stale',w=>w.evidence.lifecycleState='STALE'],['effect-evidence-not-fresh',w=>w.evidence.freshnessState='STALE'],['effect-evidence-contradictory',w=>w.evidence.contradictionState='CONTRADICTED'],['effect-evidence-authority',w=>w.evidence.authority='X'],['effect-evidence-no-performance',w=>w.evidence.effectPerformed=false],['effect-evidence-verified',w=>w.evidence.effectVerified=true]
]) t(name+'-unknown',()=>{const base=name.startsWith('completion')?clone(completionWrapper):clone(effectWrapper);mut(base);const o=name.startsWith('completion')?{completionPort:()=>base}:{effectPort:()=>base};assert.equal(assess(request,o).outcome,'UNKNOWN');});

const mismatchFields=['runtimeCompletionEvidenceRef','executionStartObservationId','executionStartId','currentExecutionStartEvidenceRef','runtimeStartEvidenceRef','executionIntentId','currentExecutionIntentEvidenceRef','executionStartRequirementEvidenceRef','invocationId','runtimeOccurrenceRef','runtimeCompletionRef','expectedPrincipalRef','expectedPrincipalRevision','executionTargetRef'];
for(const f of mismatchFields)t('wrong-'+f+'-not-observed',()=>{const q=clone(request);q[f]+='x';assert.equal(assess(q).outcome,'NOT_OBSERVED');});
for(const f of ['executionStartDigest','invocationDigest','runtimeOccurrenceDigest','runtimeCompletionDigest','runtimeEffectDigest'])t('wrong-'+f+'-not-observed',()=>{const q=clone(request);q[f]=f==='runtimeEffectDigest'?D5:D6;assert.equal(assess(q).outcome,'NOT_OBSERVED');});
t('wrong-runtime-effect-ref-not-observed',()=>{const q=clone(request);q.runtimeEffectRef='eff:x';assert.equal(assess(q).outcome,'NOT_OBSERVED');});
t('wrong-completion-observation-ref-unknown',()=>{const q=clone(request);q.continuationCompletionObservationId='cco:x';assert.equal(assess(q).outcome,'UNKNOWN');});
t('wrong-effect-evidence-ref-unknown',()=>{const q=clone(request);q.runtimeEffectEvidenceRef='ree:x';assert.equal(assess(q).outcome,'UNKNOWN');});
for(const [f,v] of [['interactionId','i2'],['gateId','g2'],['gateRevision',2],['authorityScopeDigest',D2],['continuationTargetRef','cont:2']])t('wrong-scope-'+f+'-not-observed',()=>{const q=clone(request);q[f]=v;assert.equal(assess(q).outcome,'NOT_OBSERVED');});
t('revision-before-scope-not-observed',()=>{const q=clone(request);q.interactionRevision=0;assert.equal(assess(q).outcome,'NOT_OBSERVED');});
t('revision-after-scope-not-observed',()=>{const q=clone(request);q.interactionRevision=10;assert.equal(assess(q).outcome,'NOT_OBSERVED');});
t('scope-disagreement-not-observed',()=>{const w=clone(effectWrapper);w.evidence.contextScope={...scope,throughInteractionRevision:8};assert.equal(assess(request,{effectPort:()=>w}).outcome,'NOT_OBSERVED');});

for(const [name,mut] of [['wrong-ruleset',q=>q.rulesetVersion='x'],['extra-field',q=>q.extra=true],['negative-revision',q=>q.interactionRevision=-1],['zero-gate-revision',q=>q.gateRevision=0],['missing-effect-ref',q=>q.runtimeEffectRef=''],['malformed-start-digest',q=>q.executionStartDigest='x'],['malformed-invocation-digest',q=>q.invocationDigest='x'],['malformed-occurrence-digest',q=>q.runtimeOccurrenceDigest='x'],['malformed-completion-digest',q=>q.runtimeCompletionDigest='x'],['malformed-effect-digest',q=>q.runtimeEffectDigest='x']])t(name+'-invalid',()=>{const q=clone(request);mut(q);assert.equal(assess(q).outcome,'INVALID');});

t('ledger-get-failure-unknown',()=>assert.equal(assess(request,{ledger:{get(){throw Error('x')},commit(){}}}).outcome,'UNKNOWN'));
t('ledger-commit-failure-unknown',()=>assert.equal(assess(request,{ledger:{get(){return null},commit(){throw Error('x')}}}).outcome,'UNKNOWN'));
t('ledger-commit-conflict-unknown',()=>assert.equal(assess(request,{ledger:{get(){return null},commit(){return {x:1}}}}).outcome,'UNKNOWN'));
t('deterministic-idempotent-observation',()=>{const ledger=createMemoryLedger();const a=assess(request,{ledger});const b=assess(request,{ledger});assert.equal(a.outcome,'OBSERVED');assert.equal(b.outcome,'OBSERVED');assert.equal(a.observation.effectPerformanceObservationId,b.observation.effectPerformanceObservationId);});
t('prior-ledger-identity-conflict-unknown',()=>{let saved;const ledger={get(){return saved?{...saved,executionTargetRef:'other'}:null},commit(k,v){saved=v;return v}};assert.equal(assess(request,{ledger}).outcome,'OBSERVED');assert.equal(assess(request,{ledger}).outcome,'UNKNOWN');});
for(const [name,key,val] of [['observed-result-started','executionStarted',true],['observed-result-completed','continuationExecuted',true],['observed-result-effect','effectPerformed',true],['observed-result-no-success','executionSucceeded',false],['observed-result-no-effect-authority','effectAuthorized',false],['observed-result-no-verification','effectVerified',false]])t(name,()=>assert.equal(r[key],val));
for(const outcome of ['NOT_OBSERVED','UNKNOWN','INVALID'])t(outcome.toLowerCase()+'-no-authority-promotion',()=>{const x=outcome==='NOT_OBSERVED'?assess({...request,runtimeEffectRef:'bad'}):outcome==='UNKNOWN'?assess(request,{effectPort:()=>{throw Error('x')}}):assess({...request,rulesetVersion:'x'});assert.equal(x.authority,'NONE');assert.equal(x.effectAuthorized,false);assert.equal(x.effectVerified,false);});
console.log(`${n}/${n} PASS`);
