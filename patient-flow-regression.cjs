const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(__dirname+'/index.html','utf8'),sw=fs.readFileSync(__dirname+'/service-worker.js','utf8');
const part=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(m[1].trim())new vm.Script(m[1]);
assert(!html.includes('MCIAudio'));assert(!html.includes('mci-audio'));assert(!sw.includes("'./assets-sound/"));
async function run(){
 let patients=[],now=100000,elapsed=10;
 const ctx={STATE:{patients:[],cases:[],gc:{},me:{name:'Pun'},roster:{}},normU:x=>String(x||'').toUpperCase(),sharedNowMs:()=>now,elapsedMinutes:()=>elapsed,activeFieldTents:z=>[{id:z,capacity:20}],effectiveCanWalk:()=> 'yes',patientIsDead:()=>false,computeTxStatus:()=> 'STABILIZED',findCase:()=>({}),maxOrder:()=>0,TX_ZONE_TENT_TYPE:{GREEN:'green',YELLOW:'yellow'},transitMinutes:()=>1,kvPatientsTransaction:async cb=>{const next=cb(structuredClone(patients));if(next){patients=next;ctx.STATE.patients=next;}return{committed:!!next,patients};}};
 vm.createContext(ctx);vm.runInContext(part('function txSlotStatus(','function requiredTxComplete('),ctx);
 vm.runInContext(part('async function completeTreatmentWalkOut(','async function resolveTreatmentWalkOuts('),ctx);
 // Extract just the resolver, excluding unrelated following functions.
 const start=html.indexOf('async function resolveTreatmentWalkOuts('),end=html.indexOf('\n}',start)+2;vm.runInContext(html.slice(start,end),ctx);
 const set=p=>{patients=[p];ctx.STATE.patients=patients;};
 const base={id:'P',stage:'TX',txZone:'GREEN',secondary:'GREEN',tx:[{location:'TX',startedAt:1,durationSec:10}]};
 set(base);await ctx.resolveTreatmentWalkOuts(elapsed);assert(!patients[0].treatmentWalkOutStartedAtMs,'completed treatment cannot auto-depart');
 set({...base,treatmentWalkOutStartedAtMs:1,treatmentWalkOutManual:false});await ctx.resolveTreatmentWalkOuts(elapsed);assert.equal(patients[0].stage,'TX');assert(!patients[0].treatmentWalkOutStartedAtMs,'legacy auto departure cancelled');
 set({...base,tx:[{startedAt:9,durationSec:120}],treatmentWalkOutStartedAtMs:1,treatmentWalkOutManual:true});assert.equal(await ctx.completeTreatmentWalkOut('P'),false);await ctx.resolveTreatmentWalkOuts(elapsed);assert.equal(patients[0].stage,'TX');assert(!patients[0].treatmentWalkOutStartedAtMs,'new treatment blocks pending departure');
 set({...base,treatmentWalkOutStartedAtMs:1,treatmentWalkOutManual:true});assert(await ctx.completeTreatmentWalkOut('P'));assert.equal(patients[0].stage,'TRANSFER');
 assert(ctx.hasAnyTxInProgress({tx:[{startedAt:11,durationSec:10}]},10),'scheduled treatment blocks transfer');
 assert.equal(ctx.txSlotStatus({startedAt:'9',durationSec:'120'},10),'IN_PROGRESS');
 assert.equal(ctx.txSlotStatus({startedAt:1},10),'PENDING');
 vm.runInContext(part('function resolveTransits(','function elapsedMinutes('),ctx);
 const resolved=ctx.resolveTransits([{...base,stage:'TRANSIT',tentId:'TX_YELLOW',transit:{fromStage:'SECONDARY',toStage:'TX',txZone:'YELLOW',destinationTentId:'TX_YELLOW',arriveElapsed:5}}],10).patients[0];
 assert.equal(resolved.txZone,'GREEN');assert.equal(resolved.tentId,'TX_GREEN');
 const waiting=[{id:'W',stage:'SECONDARY',secondary:'GREEN',txHoldZone:'YELLOW',tx:[]}];ctx.releaseNextTreatmentWaiter(waiting,'YELLOW',10);assert.equal(waiting[0].stage,'SECONDARY','stale yellow queue cannot route a green patient');
 Object.assign(ctx,{canEditLockedPatient:()=>true,toast(){},triageHasFreeStaff:()=>true,mkPatch:(k,v)=>({[k]:v}),captureTriageSnapshot:()=>({}),calculateSecondarySort:()=>({valid:true,color:'RED',score:1}),mutatePatients:async cb=>{const n=cb(patients);if(n)patients=n;}});
 vm.runInContext(part('async function secondarySetField(','async function secondaryRegisterOrOpen('),ctx);
 set({id:'P',stage:'SECONDARY',secondary:'YELLOW',txHoldZone:'YELLOW',overflowTarget:'TX_YELLOW',pendingTentId:'yellow',tx:[]});await ctx.secondarySetField('P','secondary','GREEN');
 assert.equal(patients[0].txHoldZone,'GREEN');assert.equal(patients[0].overflowTarget,'TX_GREEN');assert.equal(patients[0].pendingTentId,null);assert.equal(patients[0].secondary,'GREEN');assert.equal(patients[0].secondaryCorrect,'RED','answer key never overrides player choice');
 console.log('PASS: no automatic exit; explicit completed transfer succeeds; ongoing/pending/malformed treatments block transfer; legacy exit cancelled; changed triage updates queue and arrival; audio runtime removed; inline syntax valid.');
}
run().catch(e=>{console.error(e);process.exitCode=1});
