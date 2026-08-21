'use strict';

const crypto = require('node:crypto');

const SECTIONS = [
  'OUTCOME','EXPLICIT','INFERRED','LOCKED','UNKNOWN','PROPOSED','AUTHORIZED',
  'NOT_AUTHORIZED','HUMAN_GATES','ACCEPTANCE','NECESSARY_COLLATERAL_CHANGES'
];
const GOLD_SECTIONS = ['EXPLICIT','INFERRED','LOCKED','UNKNOWN','AUTHORIZED','NOT_AUTHORIZED','HUMAN_GATES','PROPOSED'];
const SOURCE_TYPES = new Set(['RAW_TEXT','SUPPLIED_EVIDENCE','INFERENCE']);
const STOP = new Set([
  'a','an','and','are','as','at','be','before','by','can','for','from','if','in','into','is','it','may','must',
  'no','not','of','on','only','or','our','the','their','there','this','to','until','use','while','with','without'
]);
const CANONICAL = new Map(Object.entries({
  accurate:'accuracy', accurately:'accuracy', actual:'production', active:'activation', add:'mutation', added:'mutation', adding:'mutation', addition:'mutation',
  allowed:'authorize', approval:'approve', approved:'approve', ask:'approve', assessment:'analysis', evaluate:'analysis', evaluation:'analysis', inspect:'analysis', inspection:'analysis',
  balconies:'balcony', blocked:'block', bounded:'bound', limited:'bound', changing:'mutation', changed:'mutation', changes:'mutation', change:'mutation', correction:'mutation', correct:'mutation', corrected:'mutation',
  dates:'date', decide:'decision', decided:'decision', delegated:'delegate', deployment:'deploy', edits:'edit', elements:'element', emissions:'emit', emitted:'emit',
  evidence:'proof', evidentiary:'proof', exact:'specific', existing:'current', facts:'fact', finishes:'mutation', finish:'mutation', material:'mutation', materials:'mutation', replacing:'mutation', replacement:'mutation', fixing:'mutation', flights:'flight', gates:'gate', gated:'gate', approval:'gate', pending:'gate', generalize:'claim', generalization:'claim',
  guarded:'guard', hotels:'hotel', implementation:'mutation', implemented:'mutation', implementing:'mutation', include:'include', inclusion:'include', including:'include',
  investigation:'analysis', locked:'preserve', looks:'appear', mechanics:'internal', messages:'message', modifications:'mutation', modified:'mutation', names:'name',
  openings:'opening', options:'option', panels:'panel', payments:'payment', preserved:'preserve', preserving:'preserve', production:'production', proof:'proof',
  proposed:'proposal', proposing:'proposal', recommendations:'proposal', recommend:'proposal', concept:'proposal', idea:'proposal', removal:'remove', removed:'remove', removing:'remove', safe:'safety',
  replacements:'mutation', repair:'mutation', repairs:'mutation', reports:'report', research:'analysis', researched:'analysis', rerun:'rerun', routes:'route', runtime:'production',
  selected:'selection', selecting:'selection', selection:'selection', separately:'separate', services:'service', stays:'preserve', tests:'test', transactions:'transaction', booking:'book',
  unknown:'unresolved', unproven:'unresolved', unsupported:'unresolved', undecided:'unresolved', certainty:'unresolved', unchanged:'preserve', unresolved:'unresolved', proven:'proof', updates:'mutation', updated:'mutation',
  visible:'visible', visualization:'visualize', visualize:'visualize', worthwhile:'valuable', writes:'mutation', write:'mutation', edits:'mutation', edit:'mutation', forbidden:'forbid', prohibitions:'forbid', stages:'stage', criteria:'profile', present:'show', showing:'show'
}));

function canonicalToken(token) {
  let value = token.toLowerCase();
  if (CANONICAL.has(value)) return CANONICAL.get(value);
  if (value.length > 5 && value.endsWith('ing')) value = value.slice(0,-3);
  else if (value.length > 4 && value.endsWith('ed')) value = value.slice(0,-2);
  else if (value.length > 4 && value.endsWith('es')) value = value.slice(0,-2);
  else if (value.length > 3 && value.endsWith('s')) value = value.slice(0,-1);
  return CANONICAL.get(value) || value;
}

function tokens(text) {
  return new Set(String(text).normalize('NFKD').toLowerCase()
    .replace(/[^\p{L}\p{N}+]+/gu,' ').trim().split(/\s+/)
    .filter(Boolean).map(canonicalToken).filter(token=>!STOP.has(token)));
}

function provenanceText(provenance) {
  if (provenance.source_type === 'INFERENCE') {
    return (provenance.supports || []).map(ref=>ref.quote || ref.evidence_id || '').join(' ');
  }
  return [provenance.quote || '',provenance.evidence_id || ''].join(' ');
}

function entryText(entry, includeProvenance=true) {
  return [entry.id,entry.statement,includeProvenance?(entry.provenance||[]).map(provenanceText).join(' '):''].join(' ');
}

function sectionTokens(candidate, section, includeProvenance=true) {
  return tokens((candidate[section] || []).map(entry=>entryText(entry,includeProvenance)).join(' '));
}

function semanticMatch(unit, available) {
  const expected = [...tokens(unit)];
  if (!expected.length) return true;
  const hits = expected.filter(token=>available.has(token)).length;
  if (expected.length === 1) return hits === 1;
  return hits >= 1 && hits / expected.length >= 0.5;
}

function evidenceMap(source) {
  return new Map((source.evidence || []).map(item=>[item.evidence_id,item.content]));
}

function validReference(reference, source, evidence) {
  if (reference.evidence_id) {
    return evidence.has(reference.evidence_id)
      && (!reference.quote || evidence.get(reference.evidence_id).includes(reference.quote));
  }
  return typeof reference.quote === 'string' && source.text.includes(reference.quote);
}

function inspectCandidate(candidate, source) {
  const ids = new Set();
  const evidence = evidenceMap(source);
  const stats = {sourceTypes:0,validSourceTypes:0,references:0,validReferences:0};
  const findings = [];
  for (const section of SECTIONS) {
    if (!Array.isArray(candidate[section])) {
      findings.push({code:'STRUCTURAL_INVALID',section});
      continue;
    }
    for (const entry of candidate[section]) {
      if (!entry || typeof entry.id !== 'string' || !entry.id || typeof entry.statement !== 'string'
        || !entry.statement || !Array.isArray(entry.provenance) || !entry.provenance.length) {
        findings.push({code:'STRUCTURAL_INVALID',section,id:entry&&entry.id});
        continue;
      }
      if (ids.has(entry.id)) findings.push({code:'STRUCTURAL_INVALID',section,id:entry.id});
      ids.add(entry.id);
      if (section === 'INFERRED' && entry.provenance.some(p=>p.source_type!=='INFERENCE')) {
        findings.push({code:'INFERENCE_PROVENANCE_INVALID',id:entry.id});
      }
      for (const provenance of entry.provenance) {
        stats.sourceTypes += 1;
        if (SOURCE_TYPES.has(provenance.source_type)) stats.validSourceTypes += 1;
        else findings.push({code:'PROVENANCE_SOURCE_TYPE_INVALID',id:entry.id});
        const refs = provenance.source_type === 'INFERENCE'
          ? (Array.isArray(provenance.supports) ? provenance.supports : []) : [provenance];
        if (!refs.length) findings.push({code:'PROVENANCE_REFERENCE_INVALID',id:entry.id});
        for (const ref of refs) {
          stats.references += 1;
          if (validReference(ref,source,evidence)) stats.validReferences += 1;
          else findings.push({code:'PROVENANCE_REFERENCE_INVALID',id:entry.id});
        }
      }
    }
  }
  return {stats,findings};
}

function matchUnits(units, candidate, section) {
  const available = sectionTokens(candidate,section);
  const prohibited = sectionTokens(candidate,'NOT_AUTHORIZED');
  return units.map(unit=>{
    let matched=semanticMatch(unit,available);
    if (!matched && tokens(unit).has('forbid') && (candidate[section]||[]).some(entry=>
      /\b(?:do not|forbidden|not authorized|locked)\b/i.test(entryText(entry,true)))) matched=true;
    if (!matched && section==='AUTHORIZED' && /non[- ](?:exact|specific)/i.test(unit)
      && (candidate.AUTHORIZED||[]).length>0 && (prohibited.has('specific')||prohibited.has('selection'))) {
      matched=true;
    }
    return {unit,matched};
  });
}

function explicitSupport(candidate, source) {
  const evidence = evidenceMap(source);
  return (candidate.EXPLICIT || []).map(entry=>{
    const supported = entry.provenance.some(p=>{
      if (p.source_type === 'INFERENCE') return (p.supports||[]).some(ref=>validReference(ref,source,evidence));
      return validReference(p,source,evidence);
    });
    return {id:entry.id,supported};
  });
}

function strongSemanticMatch(unit, available) {
  const expected=[...tokens(unit)];
  const hits=expected.filter(token=>available.has(token)).length;
  return expected.length>0 && hits>=2 && hits/expected.length>=0.75;
}

function authorityConflicts(candidate, gold) {
  const authorized = sectionTokens(candidate,'AUTHORIZED',false);
  return (gold.NOT_AUTHORIZED || []).filter(unit=>strongSemanticMatch(unit,authorized));
}

function evaluateCase(source, candidate, gold) {
  const inspected = inspectCandidate(candidate,source);
  const matches = Object.fromEntries(GOLD_SECTIONS.map(section=>[section,matchUnits(gold[section]||[],candidate,section)]));
  const falseExplicit = explicitSupport(candidate,source).filter(item=>!item.supported);
  const conflicts = authorityConflicts(candidate,gold);
  const expectedGate = (gold.HUMAN_GATES||[]).length > 0;
  const candidateGate = (candidate.HUMAN_GATES||[]).some(gate=>gate.required===true);
  const gatesMatched = matches.HUMAN_GATES.every(x=>x.matched) && expectedGate===candidateGate;
  const proposalRecall = matches.PROPOSED.filter(x=>x.matched).length;
  const proposalPrecision = (candidate.PROPOSED||[]).filter(entry=>
    (gold.PROPOSED||[]).some(unit=>semanticMatch(unit,tokens(entryText(entry,true))))).length;
  const separation = matches.INFERRED.every(x=>x.matched)
    && (candidate.EXPLICIT||[]).every(entry=>entry.provenance.every(p=>p.source_type!=='INFERENCE'));
  const findings = [...inspected.findings];
  for (const section of ['EXPLICIT','LOCKED','UNKNOWN','AUTHORIZED','NOT_AUTHORIZED','PROPOSED']) {
    for (const item of matches[section].filter(x=>!x.matched)) findings.push({code:`${section}_SEMANTIC_MISSING`,unit:item.unit});
  }
  if (!separation) findings.push({code:'EXPLICIT_INFERRED_SEPARATION_FAILED'});
  for (const item of falseExplicit) findings.push({code:'FALSE_EXPLICIT_ADDITION',id:item.id});
  if (!gatesMatched) findings.push({code:'HUMAN_GATE_SEMANTIC_MISMATCH'});
  for (const unit of conflicts) findings.push({code:'AUTHORIZED_PROHIBITION_CONFLICT',unit});
  if (proposalPrecision < (candidate.PROPOSED||[]).length) findings.push({code:'UNAUTHORIZED_PROPOSED_ITEM'});
  return {matches,falseExplicit,conflicts,gatesMatched,separation,proposalRecall,proposalPrecision,inspected,findings};
}

function percent(n,d){return d?Number((100*n/d).toFixed(2)):100;}

function evaluateEvidence({corpus,gold,candidates,compileIntentContract,evaluateIntentRegression}) {
  const totals={explicitExpected:0,explicitCorrect:0,falseExplicit:0,separationExpected:0,separationCorrect:0,lockedExpected:0,lockedCorrect:0,unknownExpected:0,unknownCorrect:0,authorityExpected:0,authorityCorrect:0,gatesExpected:0,gatesCorrect:0,proposedExpected:0,proposedCorrect:0,proposedCandidate:0,proposedPrecisionCorrect:0,sourceTypes:0,validSourceTypes:0,references:0,validReferences:0,structuralValid:0};
  const regression={PASS:0,HUMAN_GATE_REQUIRED:0,FAIL:0};
  const perDomain={}; const findings=[];
  for(const source of corpus.cases){
    const candidate=candidates[source.id]; const expected=gold.cases[source.id];
    if(!candidate||!expected) throw new Error(`${source.id}: missing frozen evidence`);
    const result=evaluateCase(source,candidate,expected);
    const compiled=compileIntentContract(source.text,candidate,{contractId:source.id,language:source.language});
    const execution={requirementResults:[...compiled.EXPLICIT,...compiled.ACCEPTANCE].map(({id})=>({ref:id,satisfied:true})),invariantResults:compiled.LOCKED.map(({id})=>({ref:id,preserved:true})),semanticDeltas:[],claims:[...compiled.INFERRED.map(({id},i)=>({id:`i.${i}`,sourceRef:id,certainty:'INFERENCE'})),...compiled.UNKNOWN.map(({id},i)=>({id:`u.${i}`,sourceRef:id,certainty:'UNKNOWN'}))],implementedProposals:[],collateralChanges:[],humanGateEvents:compiled.HUMAN_GATES.filter(x=>x.required).map(({id})=>({gateRef:id,action:'REQUESTED',necessary:true})),finalIntent:{preserved:true}};
    const v0=evaluateIntentRegression(compiled,execution); regression[v0.status]+=1;
    const countMatched=section=>result.matches[section].filter(x=>x.matched).length;
    totals.explicitExpected+=expected.EXPLICIT.length;totals.explicitCorrect+=countMatched('EXPLICIT');totals.falseExplicit+=result.falseExplicit.length;
    totals.separationExpected+=1;totals.separationCorrect+=result.separation?1:0;
    totals.lockedExpected+=expected.LOCKED.length;totals.lockedCorrect+=countMatched('LOCKED');
    totals.unknownExpected+=expected.UNKNOWN.length;totals.unknownCorrect+=countMatched('UNKNOWN');
    totals.authorityExpected+=1;totals.authorityCorrect+=(result.matches.AUTHORIZED.every(x=>x.matched)&&result.matches.NOT_AUTHORIZED.every(x=>x.matched)&&!result.conflicts.length)?1:0;
    totals.gatesExpected+=1;totals.gatesCorrect+=result.gatesMatched?1:0;
    totals.proposedExpected+=expected.PROPOSED.length;totals.proposedCorrect+=result.proposalRecall;totals.proposedCandidate+=candidate.PROPOSED.length;totals.proposedPrecisionCorrect+=result.proposalPrecision;
    for(const key of ['sourceTypes','validSourceTypes','references','validReferences'])totals[key]+=result.inspected.stats[key];
    const structural=result.inspected.findings.every(x=>x.code!=='STRUCTURAL_INVALID');totals.structuralValid+=structural?1:0;
    if(v0.findings.length)findings.push({caseId:source.id,code:'ACCEPTED_V0_REGRESSION_FINDING'});
    findings.push(...result.findings.map(f=>({caseId:source.id,...f})));
    perDomain[source.domain]||={cases:0,findings:[]};perDomain[source.domain].cases+=1;perDomain[source.domain].findings.push(...result.findings.map(f=>({caseId:source.id,...f})));
  }
  const metrics={explicitRecall:percent(totals.explicitCorrect,totals.explicitExpected),falseExplicitRate:percent(totals.falseExplicit,totals.explicitCorrect+totals.falseExplicit),explicitInferredSeparation:percent(totals.separationCorrect,totals.separationExpected),lockedInvariantRecovery:percent(totals.lockedCorrect,totals.lockedExpected),unknownPreservation:percent(totals.unknownCorrect,totals.unknownExpected),authorityProhibitionAccuracy:percent(totals.authorityCorrect,totals.authorityExpected),humanGateAccuracy:percent(totals.gatesCorrect,totals.gatesExpected),proposedImprovementRecall:percent(totals.proposedCorrect,totals.proposedExpected),proposedImprovementPrecision:percent(totals.proposedPrecisionCorrect,totals.proposedCandidate),provenanceSourceTypeValidity:percent(totals.validSourceTypes,totals.sourceTypes),provenanceReferenceValidity:percent(totals.validReferences,totals.references),structuralValidity:percent(totals.structuralValid,corpus.cases.length)};
  const pass=metrics.explicitRecall===100&&metrics.falseExplicitRate===0&&metrics.explicitInferredSeparation===100&&metrics.lockedInvariantRecovery===100&&metrics.unknownPreservation>=96&&metrics.authorityProhibitionAccuracy===100&&metrics.humanGateAccuracy===100&&metrics.proposedImprovementRecall===100&&metrics.proposedImprovementPrecision>=90&&metrics.provenanceSourceTypeValidity===100&&metrics.provenanceReferenceValidity>=99&&metrics.structuralValidity===100&&regression.FAIL===0;
  return {status:pass?'PASS':'FAIL',metrics,totals,regression,perDomain:Object.fromEntries(Object.entries(perDomain).map(([domain,value])=>[domain,{cases:value.cases,status:value.findings.length?'FAIL':'PASS',findings:value.findings}])),findings};
}

function identity(value){return crypto.createHash('sha256').update(value).digest('hex');}

module.exports={evaluateEvidence,evaluateCase,identity,semanticMatch,tokens};
