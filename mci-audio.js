/* Local-only MCI sound layer. It reads the existing rendered game snapshot; no network or Firebase writes. */
(function(root){'use strict';
const DIR='assets-sound/', FILES={ambient:'scene_ambience.mp3',siren:'siren.mp3',engine:'vehicle_engine.mp3',radio:'radio_chirp.mp3',step:'footstep.mp3',gear:'treatment_gear.mp3',moans:['patient_moan_1.mp3','patient_moan_2.mp3','patient_moan_3.mp3']};
const KEY='mci-sound-v1', defaults={enabled:false,master:.7,scene:.65,effects:.75,intense:true};
let settings={...defaults};try{settings={...settings,...JSON.parse(localStorage.getItem(KEY)||'{}')};}catch(_){}
let unlocked=false, last=null, lastMoan=0,lastStep=0,lastRadio=0,seenMessages=new Set(),loops={},panel=null,latest=null;
const clamp=n=>Math.max(0,Math.min(1,Number(n)||0));
function save(){try{localStorage.setItem(KEY,JSON.stringify(settings));}catch(_){}}
function sound(file){const a=new Audio(DIR+file);a.preload='auto';return a;}
function loop(name,file){const a=sound(file);a.loop=true;a.volume=0;loops[name]=a;return a;}
function gain(name,value){const a=loops[name];if(!a)return;a.volume=clamp(value);if(unlocked&&settings.enabled&&a.volume>.001&&a.paused)a.play().catch(()=>{});if((!settings.enabled||a.volume<=.001)&&!a.paused)a.pause();}
function one(file,volume){if(!unlocked||!settings.enabled||document.hidden)return;const a=sound(file);a.volume=clamp(volume*settings.master);a.play().catch(()=>{});a.addEventListener('ended',()=>{a.src='';},{once:true});}
function init(){if(panel)return;loop('ambient',FILES.ambient);loop('siren',FILES.siren);loop('engine',FILES.engine);
 panel=document.createElement('aside');panel.id='mciAudioDock';panel.setAttribute('aria-label','Game audio settings');
 panel.innerHTML='<button type="button" id="mciAudioToggle" aria-expanded="false">🔇 <span>เปิดเสียง</span></button><div id="mciAudioSettings" hidden><label>เสียงรวม <input data-sound="master" type="range" min="0" max="100"></label><label>บรรยากาศ <input data-sound="scene" type="range" min="0" max="100"></label><label>ไซเรน / เอฟเฟกต์ <input data-sound="effects" type="range" min="0" max="100"></label><label><input data-sound="intense" type="checkbox"> โหมดกดดัน / Intense</label><small>เสียงเล่นในเครื่องนี้เท่านั้น</small></div>';
 document.body.appendChild(panel);const btn=panel.querySelector('#mciAudioToggle'),box=panel.querySelector('#mciAudioSettings');
 btn.addEventListener('click',()=>{settings.enabled=!settings.enabled;unlocked=true;save();btn.setAttribute('aria-expanded',settings.enabled?'true':'false');box.hidden=!settings.enabled;refreshLabel();update(latest);});
 panel.querySelectorAll('input[data-sound]').forEach(input=>{const k=input.dataset.sound;if(input.type==='checkbox')input.checked=!!settings[k];else input.value=Math.round(clamp(settings[k])*100);input.addEventListener('input',()=>{settings[k]=input.type==='checkbox'?input.checked:Number(input.value)/100;save();update(latest);});});
 // Browsers unlock audio only after a user gesture. A saved preference resumes on the next gesture.
 document.addEventListener('pointerdown',()=>{if(settings.enabled&&!unlocked){unlocked=true;update(latest);}}, {capture:true});
 document.addEventListener('visibilitychange',()=>update(latest));refreshLabel();}
function refreshLabel(){if(!panel)return;panel.querySelector('#mciAudioToggle').innerHTML=(settings.enabled?'🔊 <span>เสียงเปิด':'🔇 <span>เปิดเสียง')+'</span>';}
function update(s){latest=s;if(!panel)init();const active=!!(s&&s.status==='RUNNING'&&!s.paused&&!document.hidden&&settings.enabled&&unlocked);
 const scene=!!(s&&s.station&&s.station!=='HOSPITAL'&&s.station!=='GM'&&s.station!=='COMMANDER');
 const pressure=settings.intense?1:.56, master=settings.master;
 gain('ambient',active?master*settings.scene*(scene?.22:.09)*pressure:0);
 const coming=active&&s.vehicles&&s.vehicles.some(v=>v.state==='TO_PARKING'||v.state==='TO_LOADING');
 gain('siren',coming?master*settings.effects*(scene?.24:.13)*pressure:0);
 gain('engine',coming?master*settings.effects*(scene?.16:.08)*pressure:0);
 if(!active){last=null;return;}
 const now=Date.now();
 if(s.messages){for(const m of s.messages){if(!m||!m.id)continue;if(!seenMessages.has(m.id)&&last&&m.at>last.when&&m.incoming&&now-lastRadio>900){one(FILES.radio,settings.effects*(m.urgent?.48:.24));lastRadio=now;}seenMessages.add(m.id);}if(seenMessages.size>500)seenMessages=new Set(s.messages.map(m=>m.id));}
 const nearby=(s.patients||[]).filter(p=>!p.dead&&p.conscious&&p.nearby);
 if(nearby.length&&now-lastMoan>(settings.intense?6500:11500)){one(FILES.moans[Math.floor(Math.random()*FILES.moans.length)],settings.scene*(settings.intense?.33:.18));lastMoan=now+Math.random()*3800;}
 if(last&&s.position&&last.position&&s.position.scene===last.position.scene&&now-lastStep>410){const dx=Number(s.position.x)-Number(last.position.x),dy=Number(s.position.y)-Number(last.position.y);if(dx*dx+dy*dy>.000025&&dx*dx+dy*dy<2500){one(FILES.step,settings.effects*.13);lastStep=now;}}
 last={...s,when:now};
}
function cue(kind){if(kind==='treatment')one(FILES.gear,settings.effects*.28);}
root.MCIAudio={update,cue};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
