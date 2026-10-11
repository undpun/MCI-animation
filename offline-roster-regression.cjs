const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const between=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
function fixture(){
 let now=1000000,token=0,cancelled=0;
 const data={roster:{Pun:{clientId:'old',connectionToken:'t1',station:'TX_RED',tentId:'red1',deploymentStatus:'SCENE',lastSeen:900000},Other:{clientId:'other',station:'PRIMARY'}},gc:{status:'RUNNING'},locks:{a:{clientId:'old'},b:{clientId:'other'}},notice:{name:'Pun',token:'t1',at:now-299999},heartbeat:null};
 const ctx={STATE:{fbConnected:true,me:{name:'Pun',clientId:'old',station:'TX_RED',gmAuthorized:false},positions:{old:{}},ui:{twoD:{activeZone:'TX_RED'}}},KEYS:{roster:'roster',locks:'locks',gc:'gc'},DB_ROOT:'game',fbReady:true,PRESENCE_ROOT:'presence',identitySession:1,twoDLastNavigateScene:'treatment-red',twoDPendingPosition:null,twoDLastPosition:{scene:'treatment-red',x:450,y:350},firebase:{database:{ServerValue:{TIMESTAMP:{'.sv':'timestamp'}}}},makeClientId:()=> 'new-token-'+(++token),sharedNowMs:()=>now,mciDecode:x=>x,
 fbDb:{ref:path=>({onDisconnect:()=>({update:async()=>{}}),once:async()=>({val:()=>path==='game/roster'?data.roster:path.endsWith('/heartbeats/old')?data.heartbeat:data.notice}),transaction:async cb=>{const next=cb(data.notice);if(next!==undefined)data.notice=next;return{};}})},
 kvRootTransaction:async mutator=>{const root=structuredClone({roster:data.roster,gc:data.gc,locks:data.locks}),next=mutator(root);if(next)Object.assign(data,next);return{committed:!!next,root:structuredClone(data)};},kvRosterUpdate:async fn=>{const next=fn(structuredClone(data.roster));if(next)data.roster=next;return next||{};},
 elapsedMinutes:()=>10,gcWithParticipantEvent:(gc)=>gc,cancelActiveTreatmentsAfterStaffDeparture:()=>cancelled++,mciPeerRefresh(){},scheduleCommunicationHeadMaintenance(){},startWorldCancelMovement(){},currentStartWorldScene:()=>null,stopPolling(){},clearLocalSession(){},saveLocalSession(){},mciWriteHeartbeat:async()=>{},queueTwoDPosition(){},render(){},toast(){},console,document:{getElementById:()=>null,createElement:()=>({style:{}}),body:{appendChild(){}}}};ctx.window=ctx;ctx.MCIAudio={update(){}};vm.createContext(ctx);vm.runInContext(between('const MCI_OFFLINE_GRACE_MS=','function mciPeerRefresh('),ctx);
 return{ctx,data,setNow:x=>now=x,cancelled:()=>cancelled};
}
async function test(){
 const a=fixture();await a.ctx.mciRemoveOfflineSession('old',a.data.notice);assert(a.data.roster.Pun,'4:59.999 keeps role');assert.equal(a.cancelled(),0);
 a.setNow(1000001);await a.ctx.mciRemoveOfflineSession('old',a.data.notice);assert(!a.data.roster.Pun,'5 minutes removes role');assert(a.data.roster.Other);assert(!a.data.locks.a);assert(a.data.locks.b);
 const b=fixture();vm.runInContext('mciNeedsResume=true',b.ctx);assert(await b.ctx.mciResumePlayer());assert.equal(b.data.roster.Pun.station,'TX_RED');assert.equal(b.data.roster.Pun.tentId,'red1');assert.equal(b.data.roster.Pun.clientId,'old');assert.notEqual(b.data.roster.Pun.connectionToken,'t1');assert.equal(b.data.notice,null);
 b.setNow(1300000);await b.ctx.mciRemoveOfflineSession('old',{name:'Pun',token:'t1',at:700000});assert(b.data.roster.Pun,'old disconnect cannot remove resumed session');
 const c=fixture();c.setNow(1000001);vm.runInContext('mciNeedsResume=true',c.ctx);assert.equal(await c.ctx.mciResumePlayer(),false);assert.equal(c.ctx.STATE.me.name,null);
 const stale=fixture();stale.data.notice.token='obsolete';stale.data.notice.at=1;stale.data.heartbeat={at:999999};vm.runInContext('mciNeedsResume=true',stale.ctx);assert(await stale.ctx.mciResumePlayer(),'stale notice does not expire current session');
 const saved={name:'Pun',clientId:'old',position:{scene:'treatment-red',x:450,y:350},ui:{twoD:{activeZone:'TX_RED',detailPatientId:'P1'},startPanel:'bag'}};
 const d=fixture();Object.assign(d.ctx,{sessionStorage:{getItem:()=>JSON.stringify(saved)},localStorage:{getItem:()=>null},SESSION_KEY:'session'});vm.runInContext(between('function restoreLocalSession(){','function clearLocalSession(){'),d.ctx);assert(d.ctx.restoreLocalSession());assert.equal(d.ctx.STATE.ui.twoD.detailPatientId,'P1');assert.equal(d.ctx.twoDLastPosition.x,450);
 vm.runInContext(between('function patchTwoDFrameSource(','function decodeTwoDFrameSource('),d.ctx);const encoded=html.match(/const TWO_D_FRAME_SOURCE_B64\s*=\s*['"]([^'"]+)/)[1],source=d.ctx.patchTwoDFrameSource(Buffer.from(encoded,'base64').toString());assert(source.includes('const restored=(m.payload||{}).resumePosition'));for(const m of source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(m[1].trim())new vm.Script(m[1]);
 const sweep=fixture();sweep.data.gc.status='WAITING';
 sweep.data.roster={Old:{clientId:'old',lastSeen:1},OldGM:{clientId:'gm-old',station:'GM',lastSeen:1},Legacy:{lastSeen:1},Live:{clientId:'live',lastSeen:1},Grace:{clientId:'grace',lastSeen:1},Self:{clientId:'self',lastSeen:1}};
 sweep.ctx.STATE.me={name:'Self',clientId:'self'};sweep.ctx.STATE.roster=structuredClone(sweep.data.roster);sweep.ctx.mciOwnsLeader=()=>true;
 sweep.ctx.fbDb.ref=path=>({once:async()=>({val:()=>path==='game/roster'?structuredClone(sweep.data.roster):{heartbeats:{live:{at:999999}},offlineSessions:{grace:{at:999999}}}})});
 vm.runInContext(between('let mciRosterSweepAt=','function mciOwnsLeader()'),sweep.ctx);await sweep.ctx.mciSweepStaleRoster();
 assert(!sweep.data.roster.Old);assert(!sweep.data.roster.OldGM);assert(!sweep.data.roster.Legacy);assert(sweep.data.roster.Live);assert(sweep.data.roster.Grace);assert(sweep.data.roster.Self);
 // A reconnect that races the sweep rotates its token and must survive.
 sweep.data.roster.Race={clientId:'race',lastSeen:1,connectionToken:'before'};sweep.ctx.STATE.roster=structuredClone(sweep.data.roster);sweep.setNow(1020000);
 const originalTxn=sweep.ctx.kvRootTransaction;sweep.ctx.kvRootTransaction=async cb=>{sweep.data.roster.Race.connectionToken='after';return originalTxn(cb);};
 await sweep.ctx.mciSweepStaleRoster();assert(sweep.data.roster.Race);
 console.log(JSON.stringify({withinFiveMinutes:'role and tent preserved',afterFiveMinutes:'expired',oldNotice:'ignored after reconnect',refresh:'screen, patient panel and position restored',iframeSyntax:'pass',staleSweep:'legacy and offline GM removed before game starts; live heartbeat, grace, self and concurrent reconnect preserved'},null,2));
}
test().catch(e=>{console.error(e);process.exitCode=1;});
