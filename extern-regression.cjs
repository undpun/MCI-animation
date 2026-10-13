const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const between=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
async function run(){
 let now=1000,root={gc:{gameMode:'EXTERN',status:'NOT_STARTED',scenarioId:'CASE',allowPlayerTentMove:true},roster:{Pun:{clientId:'p',station:'HOSPITAL_BASE',deploymentStatus:'HOSPITAL'}},patients:[{id:'P1',tentId:'original'}],fieldZones:{instances:{}}};
 const ctx={STATE:{gc:root.gc,roster:root.roster,me:{name:'Pun',clientId:'p'},ui:{twoD:{}},resources:[]},KEYS:{gc:'gc',roster:'roster',fieldZones:'fieldZones',resources:'resources',scene:'scene'},identitySession:1,sharedNowMs:()=>now,normalizeGameControl:x=>x,selectedGameMode:gc=>(gc||ctx.STATE.gc).gameMode,startScenario:x=>!!x,sceneReadyFor:()=>true,provisionDirectStartFieldZones:x=>x,normalizeFieldZones:x=>x,elapsedMinutes:()=>0,toast(){},render(){},applyRosterIdentity(){ctx.STATE.me.station=ctx.STATE.roster.Pun.station;},saveLocalSession(){},twoDLastPosition:{},twoDLastNavigateScene:'',setTimeout,clearTimeout,startPlayerRecord:()=>ctx.STATE.roster.Pun,kvRootTransaction:async cb=>{const n=cb(structuredClone(root));if(n)root=n;return{committed:!!n,root};}};
 vm.createContext(ctx);vm.runInContext(between('let hospitalReadyPending=false;','async function toggleHospitalStagingReady()'),ctx);
 assert(await ctx.externDepartHospital());assert.equal(root.roster.Pun.deploymentStatus,'SCENE');assert.equal(root.roster.Pun.station,null);assert.equal(root.roster.Pun.sceneArrivalAtMs,6000);assert.equal(root.patients[0].tentId,'original');assert(ctx.playerSceneJourneyActive());
 assert.equal(await ctx.externDepartHospital(),false,'duplicate ready cannot restart journey');
 vm.runInContext(between('function playerTentMoveAllowed()','function restoreLockedPlayerZone()'),ctx);
 assert.equal(ctx.playerTentMoveAllowed(),false,'movement blocked in transit');now=6000;assert(!ctx.playerSceneJourneyActive());assert(ctx.playerTentMoveAllowed());
 ctx.STATE.gc.allowPlayerTentMove=false;assert(!ctx.playerTentMoveAllowed());ctx.STATE.me.station='GM';assert(ctx.playerTentMoveAllowed());
 ctx.activeCommanderName=()=>null;ctx.hospitalStartEnabled=()=>false;vm.runInContext(between('function startSetupReady(','function startDeploymentReady('),ctx);
 assert(ctx.startSetupReady({gameMode:'EXTERN',scenarioId:'CASE'},{}));assert(!ctx.startSetupReady({gameMode:'RESIDENT',scenarioId:'CASE'},{}));assert(!ctx.startSetupReady({gameMode:'EXTERN'},{}));
 ctx.STATE.me={name:'GM',station:'GM',clientId:'gm'};
 Object.assign(ctx,{transportCombined:()=>false,activeFieldTents:z=>[{id:'tent-'+z,logicalZone:z}],fieldReturnPositionForTent:t=>({x:100,y:200,tentId:t.id}),cancelActiveTreatmentsAfterStaffDeparture:()=>[],scheduleCommunicationHeadMaintenance(){},applyRosterIdentity(){}});
 vm.runInContext(between('async function gmAssignStation(','async function claimCommanderRole('),ctx);
 assert(await ctx.gmAssignStation('Pun','TX_RED'));assert.equal(root.roster.Pun.tentId,'tent-TX_RED');assert.equal(root.roster.Pun.deploymentStatus,'SCENE');
 assert(await ctx.gmAssignStation('Pun','TX_YELLOW'));assert.equal(root.roster.Pun.tentId,'tent-TX_YELLOW');assert.equal(root.roster.Pun.fieldReturnPos.tentId,'tent-TX_YELLOW');assert.equal(root.patients[0].tentId,'original');
 assert(html.includes("if(location==='EN_ROUTE')return viewFirstArrival(startVehicleForPlayer())"));
 console.log('PASS: Extern ready without Command; journey timestamps and duplicate guard; free/GM-only movement; patients unchanged; resident Command requirement preserved; existing road scene reused.');
}
run().catch(e=>{console.error(e);process.exitCode=1});
