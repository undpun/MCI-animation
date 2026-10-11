const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(__dirname+'/index.html','utf8'),client=fs.readFileSync(__dirname+'/mci-client.js','utf8');
function between(a,b){return html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));}
function motionTest(){
 let now=0,id=0;const raf=new Map(),ctx={document:{addEventListener(){}},performance:{now:()=>now},requestAnimationFrame:f=>{raf.set(++id,f);return id;},cancelAnimationFrame:id=>raf.delete(id)};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(client,ctx);
 const el={isConnected:true,parentNode:{},style:{}};const push=(x,stamp,time)=>{now=time;ctx.MCIMotion.push(el,x,0,stamp,'px');};const tick=time=>{now=time;const pending=[...raf.values()];raf.clear();pending.forEach(f=>f(time));};
 push(0,1000,0);tick(0);push(10,1100,200);push(20,1200,200);tick(280);assert.equal(parseFloat(el.style.left),10,'sender spacing survives burst');
 push(99,1100,290);tick(380);assert.equal(parseFloat(el.style.left),20,'old packet ignored');
 push(100,2000,900);tick(900);assert.equal(parseFloat(el.style.left),20,'gap recovery starts at visible pose');tick(1180);assert.equal(parseFloat(el.style.left),100);
 ctx.MCIMotion.forget(el);assert.equal(raf.size,0);
 for(let i=0;i<1000;i++)ctx.MCIPerf.record('render',i);const stats=ctx.MCIPerf.report();assert.equal(stats.render.samples,256);assert.equal(stats.render.count,1000);
 return{burstPosition:10,stalePacket:'ignored',gapRecovery:'pass',timingSamplesBound:256};
}
async function commandTest(){
 let reads=0,transactions=0,mode='normal',raw=JSON.stringify({a:{ready:false},b:{ready:true}});
 const ref={once:async()=>{reads++;return{val:()=>raw};},transaction:async cb=>{transactions++;let next;if(mode==='null')next=cb(null);else if(mode==='conflict'){cb(null);raw=JSON.stringify({a:{ready:false},b:{ready:true},c:{ready:true}});next=cb(raw);}else next=cb(raw);if(next!==undefined)raw=next;return{committed:next!==undefined,snapshot:{val:()=>raw}};}};
 const ctx={fbReady:true,fbDb:{ref:()=>ref},DB_ROOT:'game',Date,performance,mciRecordTime(){},mciConfirmedValues:{roster:{a:{ready:false}}},mciConfirmedAt:{roster:Date.now()},mciDecode:x=>typeof x==='string'?JSON.parse(x):x,cloneDatabaseValue:x=>JSON.parse(JSON.stringify(x))};vm.createContext(ctx);vm.runInContext(between('async function kvUpdate(','async function kvRosterUpdate('),ctx);
 const change=r=>{r.a.ready=true;return r;};let r=await ctx.kvUpdate('roster',{},change);assert.equal(reads,0);assert(r.b.ready,'current Firebase value wins over seed');
 mode='conflict';r=await ctx.kvUpdate('roster',{},change);assert(r.c.ready,'conflict retry preserves other player');assert.equal(reads,0);
 mode='normal';const before=transactions;await assert.rejects(()=>ctx.kvUpdate('roster',{},()=>null));assert.equal(transactions-before,1);assert.equal(reads,0);
 mode='null';await assert.rejects(()=>ctx.kvUpdate('roster',{},()=>null));assert.equal(reads,1,'aborted seed fallback rereads once');
 ctx.mciConfirmedAt.roster=0;mode='normal';await ctx.kvUpdate('roster',{},change);assert.equal(reads,2,'expired confirmation reads fresh');
 return{confirmedCommandExtraReads:0,conflictPreservesPeers:true,fallbackRetry:'pass'};
}
function deltaTest(){
 const ctx={};vm.createContext(ctx);vm.runInContext(between('function patchTwoDFrameSource(','function decodeTwoDFrameSource('),ctx);
 const encoded=html.match(/const TWO_D_FRAME_SOURCE_B64\s*=\s*['"]([^'"]+)/)[1],source=ctx.patchTwoDFrameSource(Buffer.from(encoded,'base64').toString());
 for(const m of source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(m[1].trim())new vm.Script(m[1]);
 assert(source.includes('mci-client.js?v=6.20'));let listener,refreshes=0;const parent={};Object.assign(ctx,{parent,snap:{positions:{a:{x:1},b:{x:2}}},peers:()=>refreshes++,addEventListener:(type,f)=>{listener=f;}});
 const line=source.split('\n').find(l=>l.startsWith("addEventListener('message',e=>")&&l.includes('presenceDelta'));assert(line);vm.runInContext(line,ctx);listener({source:parent,data:{source:'mci2d-parent',type:'presenceDelta',payload:{positions:{a:{x:3}},removed:['b']}}});assert.equal(ctx.snap.positions.a.x,3);assert(!ctx.snap.positions.b);assert.equal(refreshes,1);
 return{patchedFrameSyntax:'pass',mergeAndRemove:'pass'};
}
(async()=>console.log(JSON.stringify({motion:motionTest(),commands:await commandTest(),presence:deltaTest()},null,2)))().catch(e=>{console.error(e);process.exitCode=1;});
