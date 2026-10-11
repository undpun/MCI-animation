const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(__dirname+'/index.html','utf8'),audio=fs.readFileSync(__dirname+'/mci-audio.js','utf8');
// Function extraction by explicit stable boundaries for code containing string braces.
function between(a,b){return html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));}
for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(m[1].trim())new vm.Script(m[1]);
function harness(){
 const timers=[],players=[],nodes={},listeners={};let now=10000,calls=0;
 const node=id=>nodes[id]||(nodes[id]={hidden:true,dataset:{},setAttribute(){},addEventListener(k,f){this[k]=f;},querySelector:node,querySelectorAll(){return[];},contains(x){return Object.values(nodes).includes(x);}});
 class Audio{constructor(src){this.src=src;this.volume=1;this.paused=true;this.events={};players.push(this);}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}addEventListener(k,f){this.events[k]=f;}}
 const document={hidden:false,readyState:'complete',createElement:()=>node('panel'),body:{appendChild(){}},addEventListener(k,f){(listeners[k]||(listeners[k]=[])).push(f);}};
 const ctx={Audio,document,localStorage:{getItem(){return null;},setItem(){}},setInterval(f,ms){timers.push({f,ms});},Date:{now:()=>now},console};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(audio,ctx);
 let snapshot={status:'RUNNING',station:'TX_RED',voiceCount:40,monitorCount:40,messages:[]},vehicles={status:'RUNNING',station:'PARKING',vehicles:[],now,sirenSources:[]};
 ctx.MCIAudio.setProviders(()=>{calls++;return snapshot;},()=>vehicles);
 const tick=ms=>timers.filter(t=>t.ms===ms).forEach(t=>t.f());
 tick(2200);assert.equal(calls,0,'muted avoids snapshot');
 nodes['#mciAudioToggle'].click();assert.equal(calls,1,'enable refreshes immediately');
 const levels40=players.map(a=>a.volume);snapshot={...snapshot,voiceCount:5,monitorCount:5};tick(2200);assert.deepEqual(players.map(a=>a.volume),levels40,'5 and 40 same audio budget');
 const siren=players.find(a=>a.src.endsWith('/siren.mp3')),engine=players.find(a=>a.src.endsWith('/vehicle_engine.mp3'));
 tick(250);assert.equal(siren.volume,0);assert.equal(engine.volume,0);
 vehicles.vehicles=[{workflowState:'INCOMING',parkingEntryStartMs:14000,parkingEntryDurationMs:2000}];
 const gains=[];for(const t of [10000,12000,14000,16000]){vehicles.now=t;tick(250);gains.push(siren.volume);}assert.equal(gains[0],0);assert(gains.every((x,i)=>!i||x>gains[i-1]));
 vehicles.station='LOADING';vehicles.vehicles=[{workflowState:'HOSPITAL_TRIP',loadingDepartureStartMs:16000,loadingDepartureDurationMs:1800}];
 const fades=[];for(const t of [16000,16900,17800]){vehicles.now=t;tick(250);fades.push(siren.volume);}assert(fades[0]>fades[1]&&fades[1]>fades[2]);assert.equal(fades[2],0);
 for(let i=0;i<100;i++)ctx.MCIAudio.cue('treatment');assert.equal(players.length,10,'8 persistent plus at most 2 gear effects');
 document.hidden=true;listeners.visibilitychange.forEach(f=>f());const before=calls;tick(2200);assert.equal(calls,before);assert(players.every(a=>a.paused),'hidden stops all sounds');
 document.hidden=false;listeners.visibilitychange.forEach(f=>f());nodes['#mciAudioMute'].click();assert(players.every(a=>a.paused));
 return {players:players.length,gains,fades};
}
async function rootTest(){
 let reads=0,txs=0,root={data:'{}'},useNull=false;
 const ref={once:async()=>{reads++;return{val:()=>root};},transaction:async(cb)=>{txs++;const next=cb(useNull?null:root);if(next)root=next;return{committed:!!next,snapshot:{val:()=>root}};}};
 const ctx={fbReady:true,fbDb:{ref:()=>ref},DB_ROOT:'game',Date,STATE:{},KEYS:{},ARCHIVE_ROOT:'archives',mciStockSnapshot(){},mciReconcileStock(){},console};vm.createContext(ctx);
 vm.runInContext(between('let mciRootSeed=null','async function kvPatientsTransaction'),ctx);
 await ctx.kvRootTransaction(r=>r);const before={reads,txs};for(let i=0;i<5;i++)await ctx.kvRootTransaction(()=>null);
 assert.equal(reads-before.reads,0);assert.equal(txs-before.txs,5);
 useNull=true;const r=reads;await ctx.kvRootTransaction(()=>null);assert.equal(reads-r,1,'stale fallback still refreshes once');
 return{noOpExtraReads:0,noOpTransactions:5};
}
function snapshotTest(){
 let derived=0;const ctx={STATE:{ready:true,gc:{status:'RUNNING'},me:{station:'TX_RED'},patients:Array.from({length:40},(_,id)=>({id,stage:'TX',txZone:'RED'})),cases:[],vehicles:[]},elapsedMinutes:()=>20,findCase:()=>({}),dynamicPhysiologyAt:()=>{derived++;return{status:'ALIVE',vitals:{gcs:15}};},patientPhysiologyTreatmentEvents:()=>[],physiologyModel:()=>true,computeTxStatus:()=>'',communicationZoneForStation:()=>null,activeFieldTents:()=>[],vehicleDeploymentState:()=>'',twoDLastPosition:null};vm.createContext(ctx);
 vm.runInContext(between('function mciLocalAudioSnapshot(){','function mciVehicleAudioSnapshot(){'),ctx);const s=ctx.mciLocalAudioSnapshot();assert.equal(s.voiceCount,5);assert.equal(s.monitorCount,5);assert.equal(derived,5);ctx.STATE.gc.clockPaused=true;ctx.mciLocalAudioSnapshot();assert.equal(derived,5);return{patients:40,physiologyCalls:derived};
}
function realModelsTest(){
 const models=JSON.parse(html.match(/const APPROVED_PHYSIOLOGY_MODELS = (.*);/)[1]);
 const cases=Object.values(models).map((m,i)=>({...m.initialCasePatch,id:i,physiologyModel:m.physiologyModel}));let minute=0;
 const ctx={STATE:{ready:true,gc:{status:'RUNNING'},me:{station:'TX_RED'},patients:[],cases,vehicles:[]},elapsedMinutes:()=>minute,findCase:(cs,id)=>cs.find(c=>c.id===id),normU:v=>String(v||'').trim().toUpperCase(),uniq:a=>[...new Set(a)],round1:n=>Math.round(n*10)/10,communicationZoneForStation:()=>null,activeFieldTents:()=>[],twoDLastPosition:null};vm.createContext(ctx);
 vm.runInContext(between('function triagePhysiologySource(','function triageNumber(')+between('function triageNumber(','function physiologyIssue(')+between('function mciLocalAudioSnapshot(){','function mciVehicleAudioSnapshot(){'),ctx);
 let checks=0;
 for(const time of [0,5,20,40,60])for(const station of ['TX_RED','PRIMARY','SECONDARY','LOADING','PARKING'])for(const overrides of [false,true]){
  minute=time;ctx.STATE.me.station=station;ctx.STATE.patients=cases.map((c,i)=>({id:c.id,stage:station==='TX_RED'?'TX':station==='LOADING'?'TRANSFER':station,txZone:'RED',tx:[{item:'IV fluid',startedAt:1,durationSec:30}],currentVitals:overrides?{gcs:i%2?6:15,breathing:i%3!==0}:{}}));
  let voices=0,monitors=0;if(station!=='PARKING')for(const p of ctx.STATE.patients){const c=cases[p.id];if(ctx.dynamicPhysiologyAt(c,time,ctx.patientPhysiologyTreatmentEvents(p)).status==='DEAD')continue;if(station==='TX_RED')monitors++;const v=ctx.triagePhysiologySource(p,c,time);if(Number(v.gcs||15)>=10&&Number(v.gcs||15)<=15&&v.breathing!==false)voices++;}
  const actual=ctx.mciLocalAudioSnapshot();assert.equal(actual.voiceCount,Math.min(5,voices));assert.equal(actual.monitorCount,Math.min(5,monitors));checks++;
 }
 return{models:cases.length,comparisons:checks};
}
(async()=>{const clients=Array.from({length:15},harness);console.log(JSON.stringify({syntax:'pass',audioClients:clients.length,audio:clients[0],root:await rootTest(),snapshot:snapshotTest(),realModels:realModelsTest()},null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
