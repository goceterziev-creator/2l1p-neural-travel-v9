'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {evaluateEvidence,identity}=require('./independent-semantic-evaluator');
const frozenDir=process.env.FROZEN_EVIDENCE_DIR||path.join(__dirname,'..','autonomous-completion-pass-2');
const v0Path=process.env.HUMAN_INTENT_V0_MODULE||path.join(__dirname,'..','..','human-intent-layer-v0','intent-layer.js');
const {compileIntentContract,evaluateIntentRegression}=require(v0Path);

const corpusBytes=fs.readFileSync(path.join(frozenDir,'blind-corpus.json'));
const goldBytes=fs.readFileSync(path.join(frozenDir,'hidden-gold.json'));
const corpus=JSON.parse(corpusBytes);const gold=JSON.parse(goldBytes);
const candidates={};const candidateBytes=[];
for(const {id} of corpus.cases){const bytes=fs.readFileSync(path.join(frozenDir,'candidates',`${id}.json`));candidateBytes.push(bytes);candidates[id]=JSON.parse(bytes);}
const evidenceIdentity={corpus:identity(corpusBytes),candidates:identity(candidateBytes.join('\n')),hiddenGold:identity(goldBytes)};
assert.deepEqual(evidenceIdentity,{
  corpus:'805d9d7bb3ca24304e91de732f62e8f551bf2edbfaecd508e4b1959c111b7e08',
  candidates:'4ed470b4cb4bb0badaa8b40d9ee87154f4fd425ff15ba7f1d75fdad7a13c6132',
  hiddenGold:'51a6631c8f4a3f8fd918508eb00329f6ec4d316c3f190fe66d46fa9185723343'
});

const clone=value=>JSON.parse(JSON.stringify(value));
const evaluate=mutated=>evaluateEvidence({corpus,gold,candidates:mutated,compileIntentContract,evaluateIntentRegression});
const baseline=evaluate(clone(candidates));assert.equal(baseline.status,'PASS');

function removeById(candidate,section,id){
  const before=candidate[section].length;candidate[section]=candidate[section].filter(entry=>entry.id!==id);
  assert.equal(candidate[section].length,before-1,`${id} mutation target`);
}

const tests=[
  {
    id:'remove-required-explicit', metric:'explicitRecall', code:'EXPLICIT_SEMANTIC_MISSING',
    mutate(c){removeById(c.A10,'EXPLICIT','action_update_entrance_surround');}
  },
  {
    id:'add-false-explicit', metric:'falseExplicitRate', direction:'increase', code:'FALSE_EXPLICIT_ADDITION',
    mutate(c){c.S9.EXPLICIT.push({id:'mutation.false-explicit',statement:'Change the public API to GraphQL.',provenance:[{source_type:'RAW_TEXT',quote:'Change the public API to GraphQL.'}]});}
  },
  {
    id:'remove-locked-invariant', metric:'lockedInvariantRecovery', code:'LOCKED_SEMANTIC_MISSING',
    mutate(c){removeById(c.A9,'LOCKED','locked_exact_panel_layout');}
  },
  {
    id:'promote-inference-to-explicit', metric:'explicitInferredSeparation', code:'EXPLICIT_INFERRED_SEPARATION_FAILED',
    mutate(c){const entry=c.K11.INFERRED.find(x=>x.id==='inferred_flag_defined_only');removeById(c.K11,'INFERRED',entry.id);c.K11.EXPLICIT.push(entry);}
  },
  {
    id:'remove-required-unknown', metric:'unknownPreservation', code:'UNKNOWN_SEMANTIC_MISSING',
    mutate(c){removeById(c.S9,'UNKNOWN','unknown_root_cause');}
  },
  {
    id:'add-unauthorized-proposal', metric:'proposedImprovementPrecision', code:'UNAUTHORIZED_PROPOSED_ITEM',
    mutate(c){c.S9.PROPOSED.push({id:'mutation.unauthorized-proposal',statement:'Replace the public upload API.',provenance:[{source_type:'RAW_TEXT',quote:'public upload API'}]});}
  },
  {
    id:'remove-true-proposal', metric:'proposedImprovementRecall', code:'PROPOSED_SEMANTIC_MISSING',
    mutate(c){removeById(c.A10,'PROPOSED','proposal_timber_pergola');}
  },
  {
    id:'remove-required-human-gate', metric:'humanGateAccuracy', code:'HUMAN_GATE_SEMANTIC_MISMATCH',
    mutate(c){removeById(c.T9,'HUMAN_GATES','gate_departure_airport_for_flights');}
  },
  {
    id:'authorize-prohibited-action', metric:'authorityProhibitionAccuracy', code:'AUTHORIZED_PROHIBITION_CONFLICT',
    mutate(c){c.S9.AUTHORIZED.push({id:'mutation.authorize-prohibited',statement:'Dependency and schema changes, merge, and deploy are authorized.',provenance:[{source_type:'RAW_TEXT',quote:'No dependency, schema change, merge or deploy.'}]});}
  }
];

const results=[];
for(const test of tests){
  const mutated=clone(candidates);test.mutate(mutated);const result=evaluate(mutated);
  assert.equal(result.status,'FAIL',test.id);
  if(test.direction==='increase') assert.ok(result.metrics[test.metric]>baseline.metrics[test.metric],test.id);
  else assert.ok(result.metrics[test.metric]<baseline.metrics[test.metric],test.id);
  assert.ok(result.findings.some(f=>f.code===test.code),`${test.id}: ${test.code}`);
  results.push({id:test.id,status:'PASS',sensitiveMetric:test.metric,finding:test.code,observed:result.metrics[test.metric]});
}

const poisoned=JSON.parse(fs.readFileSync(path.join(frozenDir,'conformance-record.json'),'utf8'));
for(const score of Object.values(poisoned.cases))for(const key of Object.keys(score))if(Array.isArray(score[key]))score[key]=score[key].map(()=>0);
const counterIndependent=evaluateEvidence({corpus,gold,candidates:clone(candidates),compileIntentContract,evaluateIntentRegression,conformanceRecord:poisoned});
assert.deepEqual(counterIndependent,baseline,'precomputed counter poison must not affect output');

process.stdout.write(`${JSON.stringify({status:'PASS',caseCount:tests.length,evidenceIdentity,baselineMetrics:baseline.metrics,mutations:results,precomputedCounterIndependence:'PASS'},null,2)}\n`);
