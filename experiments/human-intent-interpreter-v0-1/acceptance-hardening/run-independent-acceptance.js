'use strict';

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
const result=evaluateEvidence({corpus,gold,candidates,compileIntentContract,evaluateIntentRegression});
process.stdout.write(`${JSON.stringify({
  ...result,
  evidenceIdentity:{corpus:identity(corpusBytes),candidates:identity(candidateBytes.join('\n')),hiddenGold:identity(goldBytes)},
  authority:{semanticCounters:'DERIVED_AT_RUNTIME',conformanceRecordLoaded:false,conformanceRecordUsedForVerdict:false}
},null,2)}\n`);
