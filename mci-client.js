/* Small DOM reconciler. Reuses controls and scene nodes instead of replacing #app. */
(function(){
'use strict';
const lastAttrs=new WeakMap(),dirtyInputs=new WeakSet();
document.addEventListener('input',function(e){if(/^(INPUT|TEXTAREA)$/.test(e.target.tagName||'')&&!e.target.hasAttribute('data-case-field')&&!e.target.hasAttribute('data-act'))dirtyInputs.add(e.target);},true);
function key(n){
 if(n.nodeType!==1)return '';
 if(n.id)return '#'+n.id;
 // Managed avatar layers cannot be reused as unrelated DIVs when entering a vehicle.
 if(n.matches('.start-world-players'))return 'managed:start-world-players';
 for(const a of ['data-field-slot','data-start-world','data-start-client','data-id','data-patient','data-tent-id','data-vehicle','data-name'])if(n.hasAttribute(a))return n.tagName+'|'+a+'='+n.getAttribute(a);
 if(n.hasAttribute('data-act'))return n.tagName+'|act='+n.getAttribute('data-act')+'|'+['data-item','data-zone','data-id','data-slot','data-tab','data-name','data-color','data-station'].map(a=>n.getAttribute(a)||'').join('|');
 return '';
}
function compatible(a,b){return a.nodeType===b.nodeType&&(a.nodeType!==1||(a.tagName===b.tagName&&key(a)===key(b)));}
function patchNode(a,b){
 if(a.nodeType===3||a.nodeType===8){if(a.nodeValue!==b.nodeValue)a.nodeValue=b.nodeValue;return;}
 if(a.nodeType!==1)return;
 const managed=a.matches('.start-world-players,canvas,iframe')||a.id==='scRoot'&&a.children.length;
 if(managed)return;
 const input=/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName),focus=a===document.activeElement,editing=input&&(focus||dirtyInputs.has(a));
 if(dirtyInputs.has(a)&&a.value===b.value)dirtyInputs.delete(a);
 const prior=lastAttrs.get(a)||new Set(Array.from(a.attributes,x=>x.name)),next=new Set(Array.from(b.attributes,x=>x.name));
 for(const name of prior){if(!next.has(name)&&!/^data-(movement-bound|ready|mci-|dispatching)/.test(name))a.removeAttribute(name);}
 for(const attr of b.attributes){if(editing&&attr.name==='value')continue;if(a.getAttribute(attr.name)!==attr.value)a.setAttribute(attr.name,attr.value);}
 lastAttrs.set(a,next);
 if(a.tagName==='TEXTAREA'){if(!editing&&a.value!==b.value)a.value=b.value;return;}
 if(a.tagName==='SELECT'&&editing)return;
 patchChildren(a,b);
 if(input&&!editing){if(a.value!==b.value)a.value=b.value;if(a.tagName==='INPUT')a.checked=b.checked;}
}
function patchChildren(a,b){
 const children=Array.from(a.childNodes),keyed=new Map();children.forEach(n=>{const k=key(n);if(k&&!keyed.has(k))keyed.set(k,n);});
 const used=new Set();let cursor=a.firstChild;
 for(const desired of Array.from(b.childNodes)){
  const k=key(desired);let node=k?keyed.get(k):cursor;
  if(node&&(used.has(node)||!compatible(node,desired)))node=null;
  if(!node&&!k)node=children.find(n=>!used.has(n)&&!key(n)&&compatible(n,desired));
  if(node){used.add(node);if(node!==cursor)a.insertBefore(node,cursor);patchNode(node,desired);cursor=node.nextSibling;}
  else{node=desired.cloneNode(true);a.insertBefore(node,cursor);used.add(node);}
 }
 for(const n of children)if(!used.has(n)&&n.parentNode===a)n.remove();
}
window.MCIStableDOM={patch:function(root,html){const t=document.createElement('template');t.innerHTML=html;patchChildren(root,t.content);}};
/* Buffered interpolation works in either parent or embedded game frame. */
const tracks=new Map();let animation=0;
function tick(now){
 let active=false;for(const [el,t] of tracks){if(!el.isConnected){tracks.delete(el);if(window.MCIWalk)MCIWalk.detach(el);continue;}
  const renderAt=now-120;while(t.samples.length>2&&t.samples[1].time<renderAt)t.samples.shift();
  const a=t.samples[0],b=t.samples[1]||a,ratio=b.time>a.time?Math.max(0,Math.min(1,(renderAt-a.time)/(b.time-a.time))):1;
  const x=a.x+(b.x-a.x)*ratio,y=a.y+(b.y-a.y)*ratio;el.style.left=x+t.unit;el.style.top=y+t.unit;
  t.x=x;t.y=y;if(window.MCIWalk)MCIWalk.observe(el,x,y,t.unit,now);
  if(renderAt<b.time)active=true;
 }
 animation=active?requestAnimationFrame(tick):0;
}
window.MCIMotion={push:function(el,x,y,stamp,unit){
 if(!Number.isFinite(x)||!Number.isFinite(y))return;
 let t=tracks.get(el);const time=performance.now(),changed=t&&(t.unit!==unit||t.parent!==el.parentNode);
 if(t&&!changed&&(t.stamp===stamp||Number(stamp)<Number(t.stamp)))return;
 if(!t||changed){t={unit:unit,parent:el.parentNode,stamp:stamp,x:x,y:y,received:time,samples:[{x:x,y:y,time:time-120}]};tracks.set(el,t);if(window.MCIWalk)MCIWalk.reset(el);}
 if(time-t.received>350){t.samples=[{x:t.x,y:t.y,time:time-120},{x:x,y:y,time:time+80}];}
 else{const last=t.samples[t.samples.length-1];t.samples.push({x:x,y:y,time:Math.max(time,last.time+1)});}
 t.received=time;t.stamp=stamp;if(t.samples.length>20)t.samples.shift();el.style.transition='none';
 if(!animation)animation=requestAnimationFrame(tick);
},forget:function(el){tracks.delete(el);if(window.MCIWalk)MCIWalk.detach(el);if(!tracks.size&&animation){cancelAnimationFrame(animation);animation=0;}}};
/* Preflight all playable images. Four workers bound decode/network pressure on phones. */
let loaded=false,inflight=null;
window.MCIAssets={prepare:function(){
 if(loaded)return Promise.resolve(true);if(inflight)return inflight;
 inflight=(async function(){
  const overlay=document.createElement('div');overlay.id='mciAssetLoader';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-label','กำลังเตรียมเกม');
  overlay.style.cssText='position:fixed;inset:0;z-index:999999;background:#08131bf5;display:grid;place-items:center;color:#eafaff;font:16px system-ui;padding:24px';
  overlay.innerHTML='<div style="width:min(430px,100%);text-align:center"><div style="color:#59dfcf;font-size:12px;letter-spacing:4px">MCI MULTIPLAYER</div><h2>เตรียมทรัพยากรก่อนเข้าเกม</h2><p data-load-text>กำลังตรวจสอบภาพ…</p><progress max="100" value="0" style="width:100%;height:12px;accent-color:#59dfcf"></progress><p style="font-size:13px;opacity:.7">ครั้งแรกอาจใช้เวลาสักครู่</p><button data-retry hidden>ลองใหม่</button></div>';
  document.body.appendChild(overlay);
  try{
   const response=await fetch('asset-manifest.json');if(!response.ok)throw new Error('ไม่พบรายการภาพ');const manifest=await response.json();
   let pending=manifest.assets.slice(),done=0;const total=pending.length,bar=overlay.querySelector('progress'),label=overlay.querySelector('[data-load-text]');
   while(pending.length){
    const failed=[];let index=0;
    await Promise.all(Array.from({length:Math.min(4,pending.length)},async function(){while(index<pending.length){const path=pending[index++];try{
     const img=new Image();img.decoding='async';await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error(path)),20000);img.onload=()=>{clearTimeout(timer);resolve();};img.onerror=()=>{clearTimeout(timer);reject(new Error(path));};img.src=path;});
     if(img.decode)await img.decode();done++;bar.value=Math.round(done/total*100);label.textContent='โหลดแล้ว '+done+' / '+total+' ภาพ · '+bar.value+'%';
    }catch(e){failed.push(path);}}}));
    pending=failed;if(pending.length){label.textContent='โหลดภาพไม่สำเร็จ '+pending.length+' ภาพ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่';const button=overlay.querySelector('[data-retry]');button.hidden=false;await new Promise(resolve=>button.onclick=()=>{button.hidden=true;resolve();});}
   }
   loaded=true;overlay.remove();return true;
  }catch(e){overlay.querySelector('[data-load-text]').textContent='เตรียมเกมไม่สำเร็จ กรุณาลองใหม่';const button=overlay.querySelector('[data-retry]');button.hidden=false;await new Promise(resolve=>button.onclick=resolve);overlay.remove();return false;}
 })().finally(()=>{inflight=null;});return inflight;
}};
})();
