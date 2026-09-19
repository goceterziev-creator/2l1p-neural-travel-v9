"use strict";

const RULESET_VERSION="genesis-trust-persistent-db-binding-v0.1.0";
const AUTHORITY="NONE";
const AUTHORITY_EFFECT="NONE";

function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function createGenesisTrustPersistentDbBinding({readDb,mutateDb}={}){
  if(typeof readDb!=="function")throw new TypeError("readDb required");
  if(typeof mutateDb!=="function")throw new TypeError("mutateDb required");
  return Object.freeze({
    rulesetVersion:RULESET_VERSION,
    authority:AUTHORITY,
    authorityEffect:AUTHORITY_EFFECT,
    async read(){return clone(await Promise.resolve(readDb()));},
    async mutate(mutationFn){
      if(typeof mutationFn!=="function")throw new TypeError("mutationFn required");
      return clone(await mutateDb(db=>mutationFn(db)||db));
    }
  });
}
module.exports=Object.freeze({RULESET_VERSION,AUTHORITY,AUTHORITY_EFFECT,createGenesisTrustPersistentDbBinding});
