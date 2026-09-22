/* Visual walking layer: no Firebase, postMessage, pathfinding, or actor position writes. */
(function(root){'use strict';
 const DIR={south:0,west:1,east:2,north:3},STRIDE=128;
 const actors=new Map(),images=new Map(),active=new Set();let raf=0,lastTick=0;
 const time=()=>performance.now();
 function direction(dx,dy,last='south'){if(Math.hypot(dx,dy)<.001)return last;return Math.abs(dx)>Math.abs(dy)?(dx>0?'east':'west'):(dy>0?'south':'north');}
 function frameAt(distance){return 1+Math.floor(Math.max(0,distance)/STRIDE*4)%4;}
 function sheet(gender){const g=String(gender).toUpperCase()==='FEMALE'?'female':'male';let record=images.get(g);if(!record){const img=new Image();record={url:'assets-walk-v68/doctor-'+g+'-walk.webp',ok:false,promise:null};record.promise=new Promise(resolve=>{img.onload=()=>{record.ok=true;resolve(true);};img.onerror=()=>resolve(false);img.src=record.url;});images.set(g,record);}return record;}
 function draw(s,moving){
  if(!s.sprite)return;
  let f=moving&&!s.reduced?frameAt(s.distance):0;
  // Generated male west frame 4 turns the wrong way: use its neutral passing pose.
  if(s.gender==='MALE'&&s.facing==='west'&&f===4)f=0;
  const row=DIR[s.facing]??0,key=row+':'+f;if(key===s.drawn)return;s.drawn=key;
  s.sprite.style.backgroundPosition=(f*25)+'% '+(row*100/3)+'%';
 }
 function attach(el,gender,facing){
  if(!el||!el.matches('.start-world-player,.doctor'))return null;
  const g=String(gender||'MALE').toUpperCase()==='FEMALE'?'FEMALE':'MALE';let s=actors.get(el);
  if(!s){s={el,gender:g,facing:facing||el.dataset.facing||'south',distance:0,sprite:null,drawn:'',speed:0,prev:null,observed:false,until:0,reduced:!!(root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches)};actors.set(el,s);}
  s.facing=facing||s.facing;
  if(s.gender!==g){s.gender=g;s.drawn='';s.readyFor=null;el.classList.remove('mci-walk-ready');}
  if(s.readyFor!==g){s.readyFor=g;const data=sheet(g);data.promise.then(ok=>{if(!ok||actors.get(el)!==s||s.gender!==g)return;const sprite=s.sprite||document.createElement('span');if(!s.sprite){sprite.className='mci-walk-sprite';sprite.setAttribute('aria-hidden','true');el.appendChild(sprite);s.sprite=sprite;}sprite.style.backgroundImage='url("'+data.url+'")';el.classList.add('mci-walk-ready');s.drawn='';draw(s,active.has(el));});}
  draw(s,active.has(el));return s;
 }
 function ensure(){if(!raf&&active.size&&!document.hidden){lastTick=time();raf=requestAnimationFrame(tick);}}
 function tick(now){raf=0;const dt=Math.max(0,Math.min(64,now-lastTick));lastTick=now;for(const el of Array.from(active)){const s=actors.get(el);if(!s||!el.isConnected){detach(el);continue;}if(s.observed&&now>s.until){stop(el);continue;}if(!s.observed)s.distance+=s.speed*dt/1000;draw(s,true);}if(active.size&&!document.hidden)raf=requestAnimationFrame(tick);}
 function start(el,facing,speed=300){const s=actors.get(el);if(!s)return;s.facing=facing||s.facing;s.speed=Math.max(0,Math.min(2000,Number(speed)||0));s.observed=false;if(!active.has(el))s.distance=0;active.add(el);draw(s,true);ensure();}
 function stop(el){const s=actors.get(el);active.delete(el);if(s){s.speed=0;draw(s,false);}if(!active.size&&raf){cancelAnimationFrame(raf);raf=0;}}
 function face(el,facing){const s=actors.get(el);if(s&&facing in DIR){s.facing=facing;draw(s,active.has(el));}}
 function observe(el,x,y,unit,now=time()){
  const s=actors.get(el);if(!s||!Number.isFinite(x)||!Number.isFinite(y))return;
  const px=unit==='%'?x*16:x,py=unit==='%'?y*9:y,prev=s.prev;s.prev={x:px,y:py};
  if(!prev)return;
  const dx=px-prev.x,dy=py-prev.y,d=Math.hypot(dx,dy);
  if(d>.02){s.distance+=d;s.facing=direction(dx,dy,s.facing);s.observed=true;s.until=now+280;active.add(el);draw(s,true);ensure();}
 }
 function reset(el){const s=actors.get(el);stop(el);if(s){s.prev=null;s.distance=0;}}
 function detach(el){stop(el);const s=actors.get(el);if(s&&s.sprite)s.sprite.remove();if(el&&el.classList)el.classList.remove('mci-walk-ready');actors.delete(el);}
 document.addEventListener('visibilitychange',()=>{if(document.hidden){if(raf)cancelAnimationFrame(raf);raf=0;for(const el of active){const s=actors.get(el);if(s)draw(s,false);}}else ensure();});
 root.MCIWalk={attach,start,stop,face,observe,reset,detach,prepare:()=>Promise.all([sheet('MALE').promise,sheet('FEMALE').promise]),direction,frameAt};
})(window);
