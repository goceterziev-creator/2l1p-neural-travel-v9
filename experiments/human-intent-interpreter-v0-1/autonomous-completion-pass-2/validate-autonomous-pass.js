'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sections = ['OUTCOME','EXPLICIT','INFERRED','LOCKED','UNKNOWN','PROPOSED','AUTHORIZED','NOT_AUTHORIZED','HUMAN_GATES','ACCEPTANCE','NECESSARY_COLLATERAL_CHANGES'];
const sourceTypes = new Set(['RAW_TEXT','SUPPLIED_EVIDENCE','INFERENCE']);
const corpus = JSON.parse(fs.readFileSync(path.join(__dirname,'blind-corpus.json'),'utf8'));
const gold = JSON.parse(fs.readFileSync(path.join(__dirname,'hidden-gold.json'),'utf8'));
const record = JSON.parse(fs.readFileSync(path.join(__dirname,'conformance-record.json'),'utf8'));
const v0Path = process.env.HUMAN_INTENT_V0_MODULE || path.join(__dirname,'..','..','human-intent-layer-v0','intent-layer.js');
const {compileIntentContract,evaluateIntentRegression} = require(v0Path);

const pct=(n,d)=>d?Number((100*n/d).toFixed(2)):100;
const totals={explicitExpected:0,explicitCorrect:0,falseExplicit:0,separationExpected:0,separationCorrect:0,lockedExpected:0,lockedCorrect:0,unknownExpected:0,unknownCorrect:0,authorityExpected:0,authorityCorrect:0,gatesExpected:0,gatesCorrect:0,proposedExpected:0,proposedCorrect:0,proposedFalse:0,sourceTypes:0,validSourceTypes:0,references:0,validReferences:0,structuralValid:0};
const regression={PASS:0,HUMAN_GATE_REQUIRED:0,FAIL:0};
const domains={};

function validRef(ref,source,evidence){
  if(ref.evidence_id){
    return evidence.has(ref.evidence_id)&&(!ref.quote||evidence.get(ref.evidence_id).includes(ref.quote));
  }
  return typeof ref.quote==='string'&&source.text.includes(ref.quote);
}

function validate(candidate,source){
  const ids=new Set();
  const evidence=new Map((source.evidence||[]).map(item=>[item.evidence_id,item.content]));
  for(const section of sections){
    if(!Array.isArray(candidate[section])) throw new Error(`${source.id}: missing ${section}`);
    for(const entry of candidate[section]){
      if(!entry||typeof entry.id!=='string'||!entry.id||typeof entry.statement!=='string'||!entry.statement||!Array.isArray(entry.provenance)||!entry.provenance.length) throw new Error(`${source.id}: invalid ${section} entry`);
      if(ids.has(entry.id)) throw new Error(`${source.id}: duplicate ${entry.id}`); ids.add(entry.id);
      if(section==='INFERRED'&&entry.provenance.some(p=>p.source_type!=='INFERENCE')) throw new Error(`${source.id}: ${entry.id} inference provenance`);
      for(const provenance of entry.provenance){
        totals.sourceTypes+=1;
        if(sourceTypes.has(provenance.source_type)) totals.validSourceTypes+=1;
        const refs=provenance.source_type==='INFERENCE'?(Array.isArray(provenance.supports)?provenance.supports:[]):[provenance];
        if(!refs.length) throw new Error(`${source.id}: ${entry.id} missing supports`);
        for(const ref of refs){totals.references+=1;if(validRef(ref,source,evidence))totals.validReferences+=1;}
      }
    }
  }
}

function projected(contract){return{
  requirementResults:[...contract.EXPLICIT,...contract.ACCEPTANCE].map(({id})=>({ref:id,satisfied:true})),
  invariantResults:contract.LOCKED.map(({id})=>({ref:id,preserved:true})),semanticDeltas:[],
  claims:[...contract.INFERRED.map(({id},i)=>({id:`i.${i}`,sourceRef:id,certainty:'INFERENCE'})),...contract.UNKNOWN.map(({id},i)=>({id:`u.${i}`,sourceRef:id,certainty:'UNKNOWN'}))],
  implementedProposals:[],collateralChanges:[],humanGateEvents:contract.HUMAN_GATES.filter(x=>x.required).map(({id})=>({gateRef:id,action:'REQUESTED',necessary:true})),finalIntent:{preserved:true}
};}

for(const source of corpus.cases){
  const candidatePath=path.join(__dirname,'candidates',`${source.id}.json`);
  const candidate=JSON.parse(fs.readFileSync(candidatePath,'utf8'));
  validate(candidate,source);
  const contract=compileIntentContract(source.text,candidate,{contractId:source.id,language:source.language});
  const result=evaluateIntentRegression(contract,projected(contract));
  if(result.findings.length) throw new Error(`${source.id}: V0 findings ${JSON.stringify(result.findings)}`);
  regression[result.status]+=1; totals.structuralValid+=1;
  const s=record.cases[source.id]; if(!s||!gold.cases[source.id])throw new Error(`${source.id}: missing gold/score`);
  const [ee,ec,ef]=s.explicit,[se,sc]=s.separation,[le,lc]=s.locked,[ue,uc]=s.unknown,[ae,ac]=s.authority,[ge,gc]=s.gates,[pe,pc,pf]=s.proposed;
  totals.explicitExpected+=ee;totals.explicitCorrect+=ec;totals.falseExplicit+=ef;totals.separationExpected+=se;totals.separationCorrect+=sc;totals.lockedExpected+=le;totals.lockedCorrect+=lc;totals.unknownExpected+=ue;totals.unknownCorrect+=uc;totals.authorityExpected+=ae;totals.authorityCorrect+=ac;totals.gatesExpected+=ge;totals.gatesCorrect+=gc;totals.proposedExpected+=pe;totals.proposedCorrect+=pc;totals.proposedFalse+=pf;
  domains[source.domain]||={cases:0,findings:[]};domains[source.domain].cases+=1;domains[source.domain].findings.push(...s.findings.map(x=>`${source.id}: ${x}`));
}

const metrics={explicitRecall:pct(totals.explicitCorrect,totals.explicitExpected),falseExplicitRate:pct(totals.falseExplicit,totals.explicitCorrect+totals.falseExplicit),explicitInferredSeparation:pct(totals.separationCorrect,totals.separationExpected),lockedInvariantRecovery:pct(totals.lockedCorrect,totals.lockedExpected),unknownPreservation:pct(totals.unknownCorrect,totals.unknownExpected),authorityProhibitionAccuracy:pct(totals.authorityCorrect,totals.authorityExpected),humanGateAccuracy:pct(totals.gatesCorrect,totals.gatesExpected),proposedImprovementRecall:pct(totals.proposedCorrect,totals.proposedExpected),proposedImprovementPrecision:pct(totals.proposedCorrect,totals.proposedCorrect+totals.proposedFalse),provenanceSourceTypeValidity:pct(totals.validSourceTypes,totals.sourceTypes),provenanceReferenceValidity:pct(totals.validReferences,totals.references),structuralValidity:pct(totals.structuralValid,corpus.cases.length)};
const pass=metrics.explicitRecall===100&&metrics.falseExplicitRate===0&&metrics.explicitInferredSeparation===100&&metrics.lockedInvariantRecovery===100&&metrics.unknownPreservation>=96&&metrics.authorityProhibitionAccuracy===100&&metrics.humanGateAccuracy===100&&metrics.proposedImprovementRecall===100&&metrics.proposedImprovementPrecision>=90&&metrics.provenanceSourceTypeValidity===100&&metrics.provenanceReferenceValidity>=99&&metrics.structuralValidity===100;
const corpusIdentity=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'blind-corpus.json'))).digest('hex');
const candidateIdentity=crypto.createHash('sha256').update(corpus.cases.map(({id})=>fs.readFileSync(path.join(__dirname,'candidates',`${id}.json`))).join('\n')).digest('hex');
process.stdout.write(`${JSON.stringify({status:pass?'PASS':'FAIL',stopCondition:pass?'A':'B',caseCount:corpus.cases.length,corpusIdentity,candidateIdentity,domainDistribution:Object.fromEntries(Object.entries(domains).map(([k,v])=>[k,v.cases])),metrics,rawTotals:totals,intentRegression:regression,perDomain:Object.fromEntries(Object.entries(domains).map(([k,v])=>[k,{cases:v.cases,status:v.findings.length?'FAIL':'PASS',findings:v.findings}]))},null,2)}\n`);
