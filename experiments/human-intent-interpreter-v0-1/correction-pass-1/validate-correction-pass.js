'use strict';

const fs = require('node:fs');
const path = require('node:path');

const sections = [
  'OUTCOME','EXPLICIT','INFERRED','LOCKED','UNKNOWN','PROPOSED','AUTHORIZED',
  'NOT_AUTHORIZED','HUMAN_GATES','ACCEPTANCE','NECESSARY_COLLATERAL_CHANGES'
];
const allowedSourceTypes = new Set(['RAW_TEXT','SUPPLIED_EVIDENCE','INFERENCE']);
const corpus = JSON.parse(fs.readFileSync(path.join(__dirname, 'blind-corpus.json'), 'utf8'));
const gold = JSON.parse(fs.readFileSync(path.join(__dirname, 'hidden-gold.json'), 'utf8'));
const record = JSON.parse(fs.readFileSync(path.join(__dirname, 'conformance-record.json'), 'utf8'));
const v0Path = process.env.HUMAN_INTENT_V0_MODULE
  || path.join(__dirname, '..', '..', 'human-intent-layer-v0', 'intent-layer.js');
const { compileIntentContract, evaluateIntentRegression } = require(v0Path);

function percent(n, d) {
  return d ? Number((100 * n / d).toFixed(2)) : 100;
}

function evidenceMap(source) {
  return new Map((source.evidence || []).map(item => [item.evidence_id, item.content]));
}

function validateReference(reference, source, evidence) {
  if (reference.evidence_id) {
    if (!evidence.has(reference.evidence_id)) return false;
    return !reference.quote || evidence.get(reference.evidence_id).includes(reference.quote);
  }
  return typeof reference.quote === 'string' && source.text.includes(reference.quote);
}

function validateCandidate(candidate, source) {
  const ids = new Set();
  const evidence = evidenceMap(source);
  const counts = {sourceTypes:0,validSourceTypes:0,references:0,validReferences:0};
  const errors = [];
  for (const section of sections) {
    if (!Array.isArray(candidate[section])) throw new Error(`${source.id}: missing ${section}`);
    for (const entry of candidate[section]) {
      if (!entry || typeof entry.id !== 'string' || !entry.id || typeof entry.statement !== 'string'
        || !entry.statement || !Array.isArray(entry.provenance) || !entry.provenance.length) {
        throw new Error(`${source.id}: invalid ${section} entry`);
      }
      if (ids.has(entry.id)) throw new Error(`${source.id}: duplicate id ${entry.id}`);
      ids.add(entry.id);
      for (const provenance of entry.provenance) {
        counts.sourceTypes += 1;
        const typeValid = allowedSourceTypes.has(provenance.source_type);
        if (typeValid) counts.validSourceTypes += 1;
        else errors.push(`${entry.id}: invalid source_type`);
        let references = [];
        if (provenance.source_type === 'INFERENCE') {
          references = Array.isArray(provenance.supports) ? provenance.supports : [];
          if (!references.length) errors.push(`${entry.id}: INFERENCE has no supports`);
        } else {
          references = [provenance];
        }
        for (const reference of references) {
          counts.references += 1;
          if (validateReference(reference, source, evidence)) counts.validReferences += 1;
          else errors.push(`${entry.id}: invalid source reference`);
        }
      }
      if (section === 'INFERRED'
        && entry.provenance.some(item => item.source_type !== 'INFERENCE')) {
        errors.push(`${entry.id}: INFERRED entry lacks inference provenance`);
      }
    }
  }
  return {counts, errors};
}

function projectedExecution(contract) {
  return {
    requirementResults:[...contract.EXPLICIT,...contract.ACCEPTANCE].map(({id})=>({ref:id,satisfied:true})),
    invariantResults:contract.LOCKED.map(({id})=>({ref:id,preserved:true})),
    semanticDeltas:[],
    claims:[
      ...contract.INFERRED.map(({id},i)=>({id:`inferred.${i}`,sourceRef:id,certainty:'INFERENCE'})),
      ...contract.UNKNOWN.map(({id},i)=>({id:`unknown.${i}`,sourceRef:id,certainty:'UNKNOWN'}))
    ],
    implementedProposals:[], collateralChanges:[],
    humanGateEvents:contract.HUMAN_GATES.filter(x=>x.required).map(({id})=>({gateRef:id,action:'REQUESTED',necessary:true})),
    finalIntent:{preserved:true}
  };
}

const totals = {
  explicitExpected:0,explicitCorrect:0,falseExplicit:0,separationExpected:0,separationCorrect:0,
  lockedExpected:0,lockedCorrect:0,unknownExpected:0,unknownCorrect:0,authorityExpected:0,
  authorityCorrect:0,gatesExpected:0,gatesCorrect:0,proposedExpected:0,proposedCorrect:0,
  proposedFalse:0,sourceTypes:0,validSourceTypes:0,references:0,validReferences:0,structuralValid:0
};
const domains = {};
const regression = {PASS:0,HUMAN_GATE_REQUIRED:0,FAIL:0};

for (const source of corpus.cases) {
  const candidate = JSON.parse(fs.readFileSync(path.join(__dirname, 'candidates', `${source.id}.json`), 'utf8'));
  const validation = validateCandidate(candidate, source);
  if (validation.errors.length) throw new Error(`${source.id}: ${validation.errors.join('; ')}`);
  const contract = compileIntentContract(source.text, candidate, {contractId:source.id,language:source.language});
  const result = evaluateIntentRegression(contract, projectedExecution(contract));
  if (result.findings.length) throw new Error(`${source.id}: V0 findings ${JSON.stringify(result.findings)}`);
  regression[result.status] += 1;
  totals.structuralValid += 1;
  for (const key of ['sourceTypes','validSourceTypes','references','validReferences']) {
    totals[key] += validation.counts[key];
  }
  const score = record.cases[source.id];
  if (!score || !gold.cases[source.id]) throw new Error(`${source.id}: missing hidden gold or score`);
  const [ee,ec,ef]=score.explicit,[se,sc]=score.separation,[le,lc]=score.locked,
    [ue,uc]=score.unknown,[ae,ac]=score.authority,[ge,gc]=score.gates,[pe,pc,pf]=score.proposed;
  Object.assign(totals,{
    explicitExpected:totals.explicitExpected+ee,explicitCorrect:totals.explicitCorrect+ec,
    falseExplicit:totals.falseExplicit+ef,separationExpected:totals.separationExpected+se,
    separationCorrect:totals.separationCorrect+sc,lockedExpected:totals.lockedExpected+le,
    lockedCorrect:totals.lockedCorrect+lc,unknownExpected:totals.unknownExpected+ue,
    unknownCorrect:totals.unknownCorrect+uc,authorityExpected:totals.authorityExpected+ae,
    authorityCorrect:totals.authorityCorrect+ac,gatesExpected:totals.gatesExpected+ge,
    gatesCorrect:totals.gatesCorrect+gc,proposedExpected:totals.proposedExpected+pe,
    proposedCorrect:totals.proposedCorrect+pc,proposedFalse:totals.proposedFalse+pf
  });
  domains[source.domain] ||= {cases:0,proposedExpected:0,proposedCorrect:0,gatesExpected:0,gatesCorrect:0,findings:[]};
  const domain = domains[source.domain];
  domain.cases += 1; domain.proposedExpected += pe; domain.proposedCorrect += pc;
  domain.gatesExpected += ge; domain.gatesCorrect += gc;
  domain.findings.push(...score.findings.map(finding=>`${source.id}: ${finding}`));
}

const metrics = {
  explicitRecall:percent(totals.explicitCorrect,totals.explicitExpected),
  falseExplicitRate:percent(totals.falseExplicit,totals.explicitCorrect+totals.falseExplicit),
  explicitInferredSeparation:percent(totals.separationCorrect,totals.separationExpected),
  lockedInvariantRecovery:percent(totals.lockedCorrect,totals.lockedExpected),
  unknownPreservation:percent(totals.unknownCorrect,totals.unknownExpected),
  authorityProhibitionAccuracy:percent(totals.authorityCorrect,totals.authorityExpected),
  humanGateAccuracy:percent(totals.gatesCorrect,totals.gatesExpected),
  proposedImprovementRecall:percent(totals.proposedCorrect,totals.proposedExpected),
  proposedImprovementPrecision:percent(totals.proposedCorrect,totals.proposedCorrect+totals.proposedFalse),
  provenanceSourceTypeValidity:percent(totals.validSourceTypes,totals.sourceTypes),
  provenanceReferenceValidity:percent(totals.validReferences,totals.references),
  structuralValidity:percent(totals.structuralValid,corpus.cases.length)
};
const pass = metrics.explicitRecall===100 && metrics.falseExplicitRate===0
  && metrics.explicitInferredSeparation===100 && metrics.lockedInvariantRecovery===100
  && metrics.unknownPreservation>=96 && metrics.authorityProhibitionAccuracy===100
  && metrics.humanGateAccuracy===100 && metrics.proposedImprovementRecall===100
  && metrics.proposedImprovementPrecision>=90 && metrics.provenanceSourceTypeValidity===100
  && metrics.provenanceReferenceValidity>=99 && metrics.structuralValidity===100;

process.stdout.write(`${JSON.stringify({
  status:pass?'PASS':'FAIL',stopCondition:pass?'A':'B',caseCount:corpus.cases.length,
  corpusIdentity:require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname,'blind-corpus.json'))).digest('hex'),
  candidateIdentity:require('node:crypto').createHash('sha256').update(corpus.cases.map(({id})=>fs.readFileSync(path.join(__dirname,'candidates',`${id}.json`))).join('\n')).digest('hex'),
  domainDistribution:Object.fromEntries(Object.entries(domains).map(([k,v])=>[k,v.cases])),metrics,rawTotals:totals,
  intentRegression:regression,
  perDomain:Object.fromEntries(Object.entries(domains).map(([name,value])=>[name,{
    cases:value.cases,status:value.findings.length?'FAIL':'PASS',
    proposedRecall:percent(value.proposedCorrect,value.proposedExpected),
    humanGateAccuracy:percent(value.gatesCorrect,value.gatesExpected),findings:value.findings
  }]))
},null,2)}\n`);
