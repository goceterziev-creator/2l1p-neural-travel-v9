"use strict";

const assert = require("node:assert/strict");
const wiring = require("./human-governance-approval-server-wiring");

function req(overrides = {}) {
  return {
    user: { id: "USR-GOCE" },
    session: { userId: "USR-GOCE", iat: 100, exp: Date.now() + 60000, sessionVersion: 1 },
    sessionIdentity: { userId: "USR-GOCE", sessionVersion: 1 },
    params: { gateId: "gate:1" },
    body: {},
    ...overrides
  };
}
function res() {
  return {
    statusCode: null, payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };
}
function surface() {
  return {
    present({session, gate}) { return { presentationId: "p:1", sessionRef: session.sessionRef, gateId: gate.gateId, authority: "NONE" }; },
    decide({session, presentationId}) {
      return { type: "HUMAN_SOURCE_EVENT", sourceEventRef: "e:1", sourceEventRevision: "1",
        sourceProviderRef:"gt63-human-governance-approval-surface-v0",sourceProviderRevision:"1",
        providerEventId:"e:1",contentBytesBase64:"e30=",contentEncoding:"utf8",contentMediaType:"application/json",
        contentBindingContractRef:"x",contentBindingContractRevision:"1",channelRef:"c",channelRevision:"1",
        sessionRef:session.sessionRef,sessionRevision:session.sessionRevision,occurredTemporalFrameRef:"t1",
        receivedTemporalFrameRef:"t2",interactionId:presentationId,contextRevision:"1",claimedActorRef:session.authenticatedAccountRef,
        presentationClass:"DIRECT",attributedPrincipalRef:null,sourceEventEvidenceRef:"ev" };
    }
  };
}
const gateProvider = { async getGate(id) { return id === "gate:1" ? { gateId:id } : null; } };

const tests=[];
function test(n,f){tests.push([n,f]);}
test("adapts valid existing signed runtime session",()=>{
 const s=wiring.createExistingSessionAdapter()(req());
 assert.equal(s.authenticationState,"AUTHENTICATED"); assert.equal(s.authenticatedAccountRef,"gt63-runtime-user:USR-GOCE");
});
test("rejects beta auth bypass",()=>assert.throws(()=>wiring.createExistingSessionAdapter()(req({session:{userId:"USR-GOCE",iat:1,exp:Date.now()+1e4,betaAuthBypass:true},sessionIdentity:{userId:"USR-GOCE"}}))));
test("rejects identity mismatch",()=>assert.throws(()=>wiring.createExistingSessionAdapter()(req({sessionIdentity:{userId:"OTHER"}}))));
test("rejects expired session",()=>assert.throws(()=>wiring.createExistingSessionAdapter()(req({session:{userId:"USR-GOCE",iat:1,exp:1}}))));
test("presentation route returns authority NONE",async()=>{const routes=wiring.createHumanGovernanceApprovalRoutes({approvalSurface:surface(),gateProvider});const r=res();await routes.present(req(),r);assert.equal(r.statusCode,200);assert.equal(r.payload.authority,"NONE");});
test("missing gate returns 404",async()=>{const routes=wiring.createHumanGovernanceApprovalRoutes({approvalSurface:surface(),gateProvider});const r=res();await routes.present(req({params:{gateId:"missing"}}),r);assert.equal(r.statusCode,404);});
test("decision accepts only presentationId and decision as trusted client inputs",async()=>{const routes=wiring.createHumanGovernanceApprovalRoutes({approvalSurface:surface(),gateProvider});const r=res();await routes.decide(req({body:{presentationId:"p:1",decision:"APPROVE",approvalPayloadText:"tamper"}}),r);assert.equal(r.statusCode,200);assert.equal(r.payload.sourceEvent.type,"HUMAN_SOURCE_EVENT");assert.equal(r.payload.authority,"NONE");});
test("attach installs protected GET and POST routes",()=>{const calls=[];const app={get(...x){calls.push(["get",...x])},post(...x){calls.push(["post",...x])}};const auth=()=>{};const routes={present(){},decide(){}};const out=wiring.attachHumanGovernanceApprovalRoutes(app,{requireAuthApi:auth,routes});assert.equal(calls.length,2);assert.equal(calls[0][2],auth);assert.equal(out.authority,"NONE");});

(async()=>{let passed=0;for(const [n,f] of tests){try{await f();passed++;console.log("PASS",n)}catch(e){console.error("FAIL",n);throw e}}console.log(`${passed}/${tests.length} PASS`)})().catch(e=>{console.error(e);process.exit(1)});
