'use strict';

const fs = require('node:fs');
const path = require('node:path');

const requiredSections = [
  'OUTCOME','EXPLICIT','INFERRED','LOCKED','UNKNOWN','PROPOSED','AUTHORIZED',
  'NOT_AUTHORIZED','HUMAN_GATES','ACCEPTANCE','NECESSARY_COLLATERAL_CHANGES'
];

const corpus = JSON.parse(fs.readFileSync(path.join(__dirname, 'blind-corpus.json'), 'utf8'));
const gold = JSON.parse(fs.readFileSync(path.join(__dirname, 'hidden-gold.json'), 'utf8'));
const record = JSON.parse(fs.readFileSync(path.join(__dirname, 'conformance-record.json'), 'utf8'));
const v0Path = process.env.HUMAN_INTENT_V0_MODULE || path.join(__dirname, '..', 'human-intent-layer-v0', 'intent-layer.js');
const { compileIntentContract, evaluateIntentRegression } = require(v0Path);

function percent(numerator, denominator) {
  return denominator ? Number((100 * numerator / denominator).toFixed(2)) : 100;
}

function validateCandidate(candidate, source) {
  const provenanceErrors = [];
  for (const section of requiredSections) {
    if (!Array.isArray(candidate[section])) throw new Error(`${source.id}: missing ${section}`);
  }
  const ids = new Set();
  for (const section of requiredSections) {
    for (const entry of candidate[section]) {
      if (!entry.id || !entry.statement || !Array.isArray(entry.provenance) || !entry.provenance.length) {
        throw new Error(`${source.id}: invalid ${section} entry`);
      }
      if (ids.has(entry.id)) throw new Error(`${source.id}: duplicate id ${entry.id}`);
      ids.add(entry.id);
      for (const provenance of entry.provenance) {
        if (provenance.quote && !source.text.includes(provenance.quote)) {
          provenanceErrors.push(`non-source quote: ${provenance.quote}`);
        }
        if (!provenance.quote && provenance.kind !== 'absence_or_ambiguity') {
          throw new Error(`${source.id}: invalid provenance`);
        }
      }
    }
  }
  return provenanceErrors;
}

function projectedExecution(contract) {
  return {
    requirementResults: [...contract.EXPLICIT, ...contract.ACCEPTANCE].map(({id}) => ({ref:id,satisfied:true})),
    invariantResults: contract.LOCKED.map(({id}) => ({ref:id,preserved:true})),
    semanticDeltas: [],
    claims: [
      ...contract.INFERRED.map(({id}, index) => ({id:`projection.inferred.${index}`,sourceRef:id,certainty:'INFERENCE'})),
      ...contract.UNKNOWN.map(({id}, index) => ({id:`projection.unknown.${index}`,sourceRef:id,certainty:'UNKNOWN'}))
    ],
    implementedProposals: [],
    collateralChanges: contract.NECESSARY_COLLATERAL_CHANGES.filter(x => x.required).map(({id}) => ({
      ref:id,performed:true,necessary:true,minimal:true,withinAuthority:true,preservesExplicit:true,
      preservesLocked:true,violatesExplicitProhibition:false,userFacing:false,scopeExpanding:false
    })),
    humanGateEvents: contract.HUMAN_GATES.filter(x => x.required).map(({id}) => ({gateRef:id,action:'REQUESTED',necessary:true})),
    finalIntent:{preserved:true}
  };
}

const totals = {
  explicitExpected:0, explicitCorrect:0, falseExplicit:0,
  separationExpected:0, separationCorrect:0,
  lockedExpected:0, lockedCorrect:0,
  unknownExpected:0, unknownCorrect:0,
  authorityExpected:0, authorityCorrect:0,
  gatesExpected:0, gatesCorrect:0,
  proposedExpected:0, proposedCorrect:0, proposedFalse:0,
  structuralValid:0, provenanceEntries:0, provenanceErrors:0
};
const domains = {};
const regression = {PASS:0,HUMAN_GATE_REQUIRED:0,FAIL:0};

for (const source of corpus.cases) {
  const candidatePath = path.join(__dirname, 'candidates', `${source.id}.json`);
  const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
  const provenanceErrors = validateCandidate(candidate, source);
  const provenanceEntries = requiredSections.reduce((sum, section) => sum
    + candidate[section].reduce((entrySum, entry) => entrySum + entry.provenance.length, 0), 0);
  const contract = compileIntentContract(source.text, candidate, {contractId:source.id,language:source.language});
  const intentResult = evaluateIntentRegression(contract, projectedExecution(contract));
  regression[intentResult.status] += 1;
  if (intentResult.findings.length) throw new Error(`${source.id}: V0 findings ${JSON.stringify(intentResult.findings)}`);

  const scored = record.cases[source.id];
  if (!scored || !gold.cases[source.id]) throw new Error(`${source.id}: missing gold or score`);
  const [ee,ec,ef] = scored.explicit;
  const [se,sc] = scored.separation;
  const [le,lc] = scored.locked;
  const [ue,uc] = scored.unknown;
  const [ae,ac] = scored.authority;
  const [ge,gc] = scored.gates;
  const [pe,pc,pf] = scored.proposed;
  Object.assign(totals, {
    explicitExpected:totals.explicitExpected+ee, explicitCorrect:totals.explicitCorrect+ec,
    falseExplicit:totals.falseExplicit+ef, separationExpected:totals.separationExpected+se,
    separationCorrect:totals.separationCorrect+sc, lockedExpected:totals.lockedExpected+le,
    lockedCorrect:totals.lockedCorrect+lc, unknownExpected:totals.unknownExpected+ue,
    unknownCorrect:totals.unknownCorrect+uc, authorityExpected:totals.authorityExpected+ae,
    authorityCorrect:totals.authorityCorrect+ac, gatesExpected:totals.gatesExpected+ge,
    gatesCorrect:totals.gatesCorrect+gc, proposedExpected:totals.proposedExpected+pe,
    proposedCorrect:totals.proposedCorrect+pc, proposedFalse:totals.proposedFalse+pf,
    structuralValid:totals.structuralValid+1,
    provenanceEntries:totals.provenanceEntries+provenanceEntries,
    provenanceErrors:totals.provenanceErrors+provenanceErrors.length
  });
  domains[source.domain] ||= {cases:0,proposedFalse:0,findings:[]};
  domains[source.domain].cases += 1;
  domains[source.domain].proposedFalse += pf;
  domains[source.domain].findings.push(...scored.findings.map(finding => `${source.id}: ${finding}`));
  domains[source.domain].findings.push(...provenanceErrors.map(finding => `${source.id}: ${finding}`));
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
  provenanceValidity:percent(totals.provenanceEntries-totals.provenanceErrors,totals.provenanceEntries),
  structuralValidity:percent(totals.structuralValid,corpus.cases.length)
};

const pass = metrics.explicitRecall >= 90
  && metrics.falseExplicitRate <= 5
  && metrics.explicitInferredSeparation >= 90
  && metrics.lockedInvariantRecovery >= 90
  && metrics.unknownPreservation >= 90
  && metrics.authorityProhibitionAccuracy >= 90
  && metrics.humanGateAccuracy >= 85
  && metrics.proposedImprovementRecall >= 80
  && metrics.proposedImprovementPrecision >= 90
  && metrics.provenanceValidity === 100
  && metrics.structuralValidity === 100;

process.stdout.write(`${JSON.stringify({
  status:pass?'PASS':'FAIL',
  stopCondition:pass?'A':'B',
  caseCount:corpus.cases.length,
  domainDistribution:Object.fromEntries(Object.entries(domains).map(([name,value])=>[name,value.cases])),
  metrics,
  rawTotals:totals,
  intentRegression:regression,
  perDomain:Object.fromEntries(Object.entries(domains).map(([name,value])=>[name,{
    cases:value.cases,
    status:value.proposedFalse===0?'PASS':'FAIL',
    proposedFalse:value.proposedFalse,
    findings:value.findings
  }]))
},null,2)}\n`);
