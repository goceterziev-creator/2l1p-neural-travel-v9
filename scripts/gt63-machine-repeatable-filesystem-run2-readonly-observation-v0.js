"use strict";
const path=require("node:path"),mod=require("./gt63-machine/repeatable-filesystem-run2-readonly-observation-v0");
const rootArg=process.argv[2];
if(!rootArg){process.stderr.write("USAGE: node scripts/gt63-machine-repeatable-filesystem-run2-readonly-observation-v0.js <EXISTING_RUN2_ROOT_PATH>\n");process.exit(2);}
try{
 const out=mod.observeRun2({rootPath:path.resolve(rootArg)});
 process.stdout.write(JSON.stringify(out)+"\n");
}catch(e){process.stderr.write("RUN2_READONLY_OBSERVATION_FAILED: "+e.message+"\n");process.exit(1);}
