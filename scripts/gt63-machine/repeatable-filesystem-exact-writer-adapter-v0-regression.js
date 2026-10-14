"use strict";
const assert=require("node:assert/strict");
const {createExactCreateNewFileAdapterV0,safeRelative,OUTCOMES}=require("./repeatable-filesystem-exact-writer-adapter-v0");
let cases=0;
function check(name,fn){fn();cases++;}
check("reject traversal",()=>assert.equal(safeRelative("../escape.txt"),false));
check("reject absolute",()=>assert.equal(safeRelative("/tmp/escape.txt"),false));
check("allow relative leaf",()=>assert.equal(safeRelative("GT63_SECOND_GOVERNED_EFFECT.txt"),true));
check("ports required",()=>assert.throws(()=>createExactCreateNewFileAdapterV0(),TypeError));
const request={authorizationId:"auth",executionPreparationId:"prep",executionStartId:"start"};
const a={authorizationId:"auth",authorizationState:"AUTHORIZED",consumptionState:"UNCONSUMED",operation:"CREATE_NEW_FILE",precondition:{mustNotExist:true},authorityEffect:"NONE"};
const s={executionStartId:"start",startState:"PERMITTED",executionStartPermitted:true,executionTargetRef:"prep",executionStarted:false,effectPerformed:false};
const p={executionPreparationId:"prep",authorizationId:"auth",executionState:"READY",operation:"CREATE_NEW_FILE",mustNotExist:true,effectPerformed:false,authorityEffect:"NONE",rootPath:"C:/GT63_SANDBOX",relativeTargetPath:"GT63_SECOND_GOVERNED_EFFECT.txt",payload:{encoding:"UTF-8",bytesBase64:"SGVsbG8gZnJvbSBHVDYz",digest:"sha256:241d88cea11b71564b4aa1597ecf6cc49cb06a3dca4044d0afddd9ca2116f3f9"}};
const make=(aa=a,ss=s,pp=p)=>createExactCreateNewFileAdapterV0({currentAuthorizationPort:()=>aa,currentMachineStartPort:()=>ss,currentPreparationPort:()=>pp});
check("missing request denied",()=>assert.equal(make().invokeExactEffect({}).outcome,OUTCOMES.DENIED));
check("unavailable evidence unknown",()=>assert.equal(createExactCreateNewFileAdapterV0({currentAuthorizationPort:()=>{throw Error("offline")},currentMachineStartPort:()=>s,currentPreparationPort:()=>p}).invokeExactEffect(request).outcome,OUTCOMES.UNKNOWN));
check("mismatched machine target denied",()=>assert.equal(make(a,{...s,executionTargetRef:"other"}).invokeExactEffect(request).outcome,OUTCOMES.DENIED));
check("no claim means no effect even for valid-looking inputs",()=>assert.equal(make().invokeExactEffect(request).reason,"NOT_CONNECTED: durable one-shot claim and trusted root binding required"));
process.stdout.write(JSON.stringify({status:"PASS",cases,scope:"FAIL_CLOSED_ONLY",effectPerformed:false})+"\\n");
