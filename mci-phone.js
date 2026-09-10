/* Local camera only: never sends position or writes game state. */
(()=>{'use strict';
const query='(max-width:600px), (max-width:1000px) and (max-height:500px) and (pointer:coarse)';
const isPhone=()=>matchMedia(query).matches;
const cameras=new WeakMap();let current=null,toolbar=null,pan=false,drag=null,scheduled=false;
let sendHome=null;
function placeSendPanel(){
 const panel=document.getElementById('vehicleSendModal');if(!panel)return;
 if(isPhone()&&panel.parentElement!==document.body){sendHome={parent:panel.parentNode,next:panel.nextSibling};document.body.appendChild(panel);}
 else if(!isPhone()&&sendHome){sendHome.parent.insertBefore(panel,sendHome.next&&sendHome.next.parentNode===sendHome.parent?sendHome.next:null);sendHome=null;}
}
function state(st){if(!cameras.has(st))cameras.set(st,{zoom:1,dx:0,dy:0});return cameras.get(st);}
function geometry(w,h,W,H,zoom,dx,dy,top=64,bottom=76){
 const ah=Math.max(40,h-top-bottom),sc=Math.min((w-12)/W,ah/H)*zoom,sw=W*sc,sh=H*sc;
 const x=sw<=w?(w-sw)/2:Math.max(w-sw,Math.min(0,(w-sw)/2+dx));
 const y=sh<=ah?top+(ah-sh)/2:Math.max(h-bottom-sh,Math.min(top,top+(ah-sh)/2+dy));
 return {sc,x,y};
}
function fitFrame(st){
 placeSendPanel();
 if(!isPhone())return false;
 current=st;const c=state(st),W=+st.dataset.w||parseFloat(getComputedStyle(st).width),H=+st.dataset.h||parseFloat(getComputedStyle(st).height);
 const bar=document.querySelector('.globalbar'),top=bar?Math.max(64,bar.getBoundingClientRect().bottom+8):64;
 const g=geometry(innerWidth,innerHeight,W,H,c.zoom,c.dx,c.dy,top,88);
 st.style.left=g.x+'px';st.style.top=g.y+'px';st.style.transform=`scale(${g.sc})`;
 Object.assign(st.dataset,{scale:g.sc,panx:g.x,pany:g.y});ensureTools();return true;
}
function ensureTools(){
 if(!toolbar){toolbar=document.createElement('nav');toolbar.className='mci-map-tools';toolbar.setAttribute('aria-label','มุมมองแผนที่');toolbar.innerHTML='<button type="button" data-camera="fit" aria-label="ดูแผนที่ทั้งหมด">เต็มแมพ</button><button type="button" data-camera="zoom" aria-label="ขยายแผนที่">ขยาย</button><button type="button" data-camera="pan" aria-pressed="false">เลื่อน</button>';document.body.appendChild(toolbar);toolbar.addEventListener('click',e=>{const b=e.target.closest('[data-camera]');if(!b||!current)return;const c=state(current);if(b.dataset.camera==='pan'){pan=!pan;}else{c.zoom=b.dataset.camera==='fit'?1:c.zoom>=3?1:Math.min(3,c.zoom+.5);c.dx=c.dy=0;}refresh();});}
 toolbar.hidden=!isPhone()||!current||!current.isConnected;
 toolbar.querySelector('[data-camera="pan"]').setAttribute('aria-pressed',String(pan));
 toolbar.querySelector('[data-camera="pan"]').textContent=pan?'เดิน / แตะ':'เลื่อน';
 document.documentElement.classList.toggle('mci-camera-pan',pan&&isPhone());
 if(current)current.style.touchAction=pan?'none':'';
}
function refresh(){
 if(document.body.classList.contains('mci-frame')){if(current&&isPhone())fitFrame(current);if(toolbar)toolbar.hidden=!isPhone();return;}
 const previous=current;current=document.querySelector('[data-start-world]');
 if(current&&current!==previous){const viewport=current.closest('.startgame-world-viewport'),shell=current.closest('.startgame-shell');if(viewport){viewport.scrollLeft=0;viewport.scrollTop=0;}if(shell)shell.scrollTop=0;}
 if(current){const c=state(current),viewport=current.closest('.startgame-world-viewport');if(isPhone()){current.style.setProperty('--mci-world-width',Math.round(viewport.clientWidth*c.zoom)+'px');}else current.style.removeProperty('--mci-world-width');}
 if(current||toolbar)ensureTools();
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;refresh();});}
document.addEventListener('pointerdown',e=>{
 if(!isPhone()||!pan||!current||!current.contains(e.target)||e.target.closest('.mci-map-tools'))return;
 e.preventDefault();e.stopImmediatePropagation();const c=state(current),v=current.closest('.startgame-world-viewport');drag={id:e.pointerId,x:e.clientX,y:e.clientY,dx:c.dx,dy:c.dy,left:v?v.scrollLeft:0,top:v?v.scrollTop:0,v};current.setPointerCapture(e.pointerId);
},true);
document.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;e.preventDefault();e.stopImmediatePropagation();if(drag.v){drag.v.scrollLeft=drag.left-(e.clientX-drag.x);drag.v.scrollTop=drag.top-(e.clientY-drag.y);}else{const c=state(current);c.dx=drag.dx+e.clientX-drag.x;c.dy=drag.dy+e.clientY-drag.y;fitFrame(current);}},true);
for(const type of ['pointerup','pointercancel'])document.addEventListener(type,e=>{if(!drag||drag.id!==e.pointerId)return;e.stopImmediatePropagation();if(current.hasPointerCapture(e.pointerId))current.releasePointerCapture(e.pointerId);drag=null;},true);
document.addEventListener('click',e=>{if(isPhone()&&pan&&current&&current.contains(e.target)){e.preventDefault();e.stopImmediatePropagation();}},true);
function viewport(){document.documentElement.style.setProperty('--mci-visible-height',(window.visualViewport?visualViewport.height:innerHeight)+'px');schedule();}
addEventListener('resize',viewport);if(window.visualViewport)visualViewport.addEventListener('resize',viewport);
addEventListener('DOMContentLoaded',()=>{document.documentElement.style.setProperty('--mci-safe-top','env(safe-area-inset-top,0px)');const app=document.getElementById('app');if(app)new MutationObserver(schedule).observe(app,{childList:true,subtree:true});viewport();});
window.MCIPhone={isPhone,fitFrame,geometry,refresh:schedule};
})();
