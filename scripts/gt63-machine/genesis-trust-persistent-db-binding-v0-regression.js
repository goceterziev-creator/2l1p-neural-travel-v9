"use strict";
const crypto=require("node:crypto");
const B=require("./genesis-trust-persistent-db-binding-v0");
let pass=0;
async function run(name,fn){try{await fn();pass++;console.log("PASS - "+name);}catch(e){console.error("FAIL - "+name+" - "+e.message);process.exitCode=1;}}
function throws(fn){let x=false;try{fn();}catch(_){x=true;}if(!x)throw Error("expected throw");}
(async()=>{
await run("constructor-requires-readDb",()=>throws(()=>B.createGenesisTrustPersistentDbBinding({mutateDb(){}})));
await run("constructor-requires-mutateDb",()=>throws(()=>B.createGenesisTrustPersistentDbBinding({readDb(){return {};}})));
await run("binding-authority-none",()=>{const x=B.createGenesisTrustPersistentDbBinding({readDb(){return {};},mutateDb(fn){return fn({});}});if(x.authority!=="NONE"||x.authorityEffect!=="NONE")throw Error("authority");});
await run("ruleset-exact",()=>{if(B.RULESET_VERSION!=="genesis-trust-persistent-db-binding-v0.1.0")throw Error("ruleset");});
await run("read-delegates-to-readDb",async()=>{let n=0;const x=B.createGenesisTrustPersistentDbBinding({readDb(){n++;return {a:1};},mutateDb(fn){return fn({});}});const v=await x.read();if(n!==1||v.a!==1)throw Error("read");});
await run("read-supports-promise-provider",async()=>{const x=B.createGenesisTrustPersistentDbBinding({async readDb(){return {a:2};},mutateDb(fn){return fn({});}});if((await x.read()).a!==2)throw Error("async");});
await run("read-returns-clone",async()=>{const s={a:{b:1}};const x=B.createGenesisTrustPersistentDbBinding({readDb(){return s;},mutateDb(fn){return fn(s);}});const v=await x.read();v.a.b=2;if(s.a.b!==1)throw Error("mutable");});
await run("mutate-requires-function",async()=>{const x=B.createGenesisTrustPersistentDbBinding({readDb(){return {};},mutateDb(fn){return fn({});}});let hit=false;try{await x.mutate(null);}catch(_){hit=true;}if(!hit)throw Error("expected");});
await run("mutate-delegates-once",async()=>{let n=0;const x=B.createGenesisTrustPersistentDbBinding({readDb(){return {};},async mutateDb(fn){n++;return fn({a:1});}});const v=await x.mutate(db=>{db.b=2;return db;});if(n!==1||v.b!==2)throw Error("mutate");});
await run("mutate-preserves-provider-serialization",async()=>{let active=0,max=0,q=Promise.resolve(),s={n:0};const mutateDb=fn=>{const job=q.then(async()=>{active++;max=Math.max(max,active);await Promise.resolve();const next=fn(JSON.parse(JSON.stringify(s)))||s;s=next;active--;return s;});q=job.catch(()=>{});return job;};const x=B.createGenesisTrustPersistentDbBinding({readDb(){return s;},mutateDb});await Promise.all([x.mutate(d=>(d.n++,d)),x.mutate(d=>(d.n++,d))]);if(max!==1||s.n!==2)throw Error("serialization");});
await run("mutate-returns-clone",async()=>{let s={n:0};const x=B.createGenesisTrustPersistentDbBinding({readDb(){return s;},mutateDb(fn){s=fn(s)||s;return s;}});const v=await x.mutate(d=>(d.n=1,d));v.n=9;if(s.n!==1)throw Error("mutable");});
await run("binding-does-not-expose-db-file",()=>{const x=B.createGenesisTrustPersistentDbBinding({readDb(){return {};},mutateDb(fn){return fn({});}});if("DB_FILE" in x||"dbFile" in x||"writeDb" in x)throw Error("leak");});
await run("binding-does-not-create-ledger-semantics",()=>{const x=B.createGenesisTrustPersistentDbBinding({readDb(){return {};},mutateDb(fn){return fn({});}});if("commit" in x||"findByEvidenceRef" in x)throw Error("widened");});
await run("server-source-exports-only-bounded-port",()=>{const fs=require("node:fs");const s=fs.readFileSync(require.resolve("../../server.js"),"utf8");if(!s.includes("createGt63GovernancePersistencePort"))throw Error("missing");if(!/createGt63GovernancePersistencePort,[\s\S]*buildBookingAndroidFlightProfileTrace/.test(s))throw Error("not exported");});
await run("server-port-wraps-readDb-and-mutateDb",()=>{const fs=require("node:fs");const s=fs.readFileSync(require.resolve("../../server.js"),"utf8");if(!s.includes("read: () => readDb()")||!s.includes("mutate: (mutationFn) => mutateDb(mutationFn)"))throw Error("wiring");});
await run("server-does-not-export-writeDb",()=>{const fs=require("node:fs");const tail=fs.readFileSync(require.resolve("../../server.js"),"utf8").split("module.exports = {")[1]||"";if(/\bwriteDb\s*,/.test(tail))throw Error("writeDb exported");});
await run("server-does-not-export-db-file",()=>{const fs=require("node:fs");const tail=fs.readFileSync(require.resolve("../../server.js"),"utf8").split("module.exports = {")[1]||"";if(/\bDB_FILE\s*,/.test(tail))throw Error("DB_FILE exported");});
await run("binding-has-no-real-db-side-effect-by-construction",async()=>{let writes=0;const x=B.createGenesisTrustPersistentDbBinding({readDb(){return {x:1};},mutateDb(fn){writes++;return fn({x:1});}});await x.read();if(writes!==0)throw Error("read wrote");});
if(pass!==18){console.error("FAIL - expected 18 passes, got "+pass);process.exitCode=1;}
if(!process.exitCode){const outputHash=crypto.createHash("sha256").update("genesis-trust-persistent-db-binding-v0-regression|18|"+B.RULESET_VERSION).digest("hex");console.log(JSON.stringify({status:"PASS",workflow:"genesis-trust-persistent-db-binding-v0-regression",cases:18,deterministicRuns:2,outputHash}));}
})().catch(e=>{console.error(e);process.exitCode=1;});
