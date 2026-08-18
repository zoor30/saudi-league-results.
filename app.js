import * as THREE from 'https://unpkg.com/three@0.169.0/build/three.module.js';
import {GLTFLoader} from 'https://unpkg.com/three@0.169.0/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'https://unpkg.com/three@0.169.0/examples/jsm/utils/SkeletonUtils.js';

const SHEEP_URL='https://raw.githubusercontent.com/lord3nd3r/ffxi-browser/main/public/models/sheep.glb';
const TRUCK_URL='https://raw.githubusercontent.com/KenneyNL/Starter-Kit-Racing/main/models/vehicle-truck-yellow.glb';
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>a+Math.random()*(b-a);

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x95d4eb);
scene.fog=new THREE.FogExp2(0xc8d7ce,.013);
const camera=new THREE.PerspectiveCamera(36,innerWidth/innerHeight,.1,140);
camera.position.set(13,18,22);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.08;
$('#game').appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffefd1,0x7d6040,2.4));
const sun=new THREE.DirectionalLight(0xffdca8,4.2);sun.position.set(-14,24,10);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-30,right:30,top:30,bottom:-30});scene.add(sun);

const mat=(c,r=.8,m=0)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
function mesh(geo,c,p=[0,0,0],r=.8,m=0,parent=scene){const o=new THREE.Mesh(geo,mat(c,r,m));o.position.set(...p);o.castShadow=o.receiveShadow=true;parent.add(o);return o}

const ground=mesh(new THREE.PlaneGeometry(90,90),0xd3ad6b);ground.rotation.x=-Math.PI/2;
for(let i=0;i<90;i++){const d=mesh(new THREE.CircleGeometry(rand(.12,.7),10),Math.random()>.5?0xbc8f50:0xe1bd79,[rand(-26,26),.012,rand(-26,26)]);d.rotation.x=-Math.PI/2;d.scale.y=.45}

for(let x=-12;x<=12;x+=1.5){mesh(new THREE.CylinderGeometry(.08,.1,1.55,8),0x72583d,[x,.78,-11]);mesh(new THREE.CylinderGeometry(.08,.1,1.55,8),0x72583d,[x,.78,11])}
for(let z=-9.5;z<=9.5;z+=1.5){mesh(new THREE.CylinderGeometry(.08,.1,1.55,8),0x72583d,[-12,.78,z]);mesh(new THREE.CylinderGeometry(.08,.1,1.55,8),0x72583d,[12,.78,z])}
for(const z of[-11,11])for(const y of[.4,.85,1.28])mesh(new THREE.BoxGeometry(24,.055,.055),0x62605a,[0,y,z],.45,.55);
for(const x of[-12,12])for(const y of[.4,.85,1.28])mesh(new THREE.BoxGeometry(.055,.055,22),0x62605a,[x,y,0],.45,.55);

for(const x of[-8,-1])for(const z of[-7,-2])mesh(new THREE.CylinderGeometry(.09,.11,3.2,8),0x6d5942,[x,1.6,z]);
const roof=mesh(new THREE.BoxGeometry(7.7,.12,5.8),0x516a59,[-4.5,3.2,-4.5]);roof.rotation.z=-.025;
const feeder=mesh(new THREE.BoxGeometry(5.7,.5,1.15),0x8a8071,[3.4,.27,-5.2]);
const grain=mesh(new THREE.BoxGeometry(5.15,.1,.75),0xc89c3d,[3.4,.56,-5.2]);
const waterTrough=mesh(new THREE.BoxGeometry(3.4,.55,1.45),0x777e7d,[5.4,.3,5.4],.45,.6);
const water=mesh(new THREE.BoxGeometry(3.05,.05,1.08),0x3e9fc4,[5.4,.59,5.4],.18,.1);
for(let i=0;i<5;i++){let h=mesh(new THREE.CylinderGeometry(.65,.65,1.1,20),0xd0a12d,[-8+i*1.2,.68,7]);h.rotation.z=Math.PI/2}

const obstacles=[
{x:3.4,z:-5.2,hx:3.25,hz:1.2},
{x:5.4,z:5.4,hx:2.05,hz:1.4},
{x:-8,z:-7,hx:.45,hz:.45},{x:-1,z:-7,hx:.45,hz:.45},{x:-8,z:-2,hx:.45,hz:.45},{x:-1,z:-2,hx:.45,hz:.45}
];
const feedSlots=[],waterSlots=[];
for(let i=0;i<5;i++){feedSlots.push({p:new THREE.Vector3(1.6+i*.9,0,-4.0),owner:null},{p:new THREE.Vector3(1.6+i*.9,0,-6.4),owner:null})}
for(let i=0;i<4;i++){waterSlots.push({p:new THREE.Vector3(4.2+i*.75,0,3.9),owner:null},{p:new THREE.Vector3(4.2+i*.75,0,6.9),owner:null})}

const loader=new GLTFLoader();
const sheep=[];let sheepSource=null,sheepAnims=[];let truck=null,truckOn=false;
let feedStock=12,troughFood=35,waterLevel=100,selected=null;
const mixers=[];
const stateNames={wander:'يتجول',idle:'واقف يراقب',seekFood:'رايح للمعلف',eat:'يأكل',seekWater:'رايح للماء',drink:'يشرب',rest:'يرتاح',social:'يتقرب من القطيع',startled:'مفزوع من الوايت',curious:'فضولي'};

function shadows(root){root.traverse(o=>{if(o.isMesh||o.isSkinnedMesh){o.castShadow=o.receiveShadow=true;o.frustumCulled=false}})}
function normalize(root,h){root.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(root),n=Math.max(.001,b.max.y-b.min.y);root.scale.multiplyScalar(h/n);root.updateMatrixWorld(true);const b2=new THREE.Box3().setFromObject(root);root.position.y-=b2.min.y}
function blackNajdi(root,ram){root.traverse(o=>{if(o.isMesh||o.isSkinnedMesh){o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m.color){const l=m.color.r+m.color.g+m.color.b;l>1.25?m.color.set(ram?0x17130f:0x24201b):m.color.multiplyScalar(.32);m.roughness=.77}}})}
function findClip(rx,fallback){return sheepAnims.find(a=>rx.test(a.name))||fallback}
function setAnim(s,name){const u=s.userData;if(!u.mixer)return;const clip=name==='walk'?u.clips.walk:name==='eat'?u.clips.eat:name==='rest'?u.clips.rest:u.clips.idle;if(!clip||u.anim===name)return;const next=u.mixer.clipAction(clip);next.reset().fadeIn(.2).play();if(u.action)u.action.fadeOut(.2);u.action=next;u.anim=name}
function releaseSlot(s){const u=s.userData;if(u.slot){u.slot.owner=null;u.slot=null}}
function nearestFree(slots,s){let best=null,bd=1e9;for(const sl of slots)if(!sl.owner||sl.owner===s){const d=s.position.distanceToSquared(sl.p);if(d<bd){bd=d;best=sl}}if(best){best.owner=s;s.userData.slot=best}return best}
function validPoint(x,z){if(x<-10.2||x>10.2||z<-9.2||z>9.2)return false;for(const o of obstacles)if(Math.abs(x-o.x)<o.hx+.75&&Math.abs(z-o.z)<o.hz+.75)return false;return true}
function pickWander(s){releaseSlot(s);for(let k=0;k<20;k++){const x=rand(-9,9),z=rand(-8,8);if(validPoint(x,z)){s.userData.target.set(x,0,z);break}}s.userData.state='wander';s.userData.timer=rand(2,6)}
function chooseMate(s){let best=null,bd=1e9;for(const q of sheep)if(q!==s){const d=s.position.distanceToSquared(q.position);if(d<bd){bd=d;best=q}}return best}
function decide(s){const u=s.userData;if(u.startle>0)return;
 if(u.hunger>64&&troughFood>1){const sl=nearestFree(feedSlots,s);if(sl){u.state='seekFood';u.target.copy(sl.p);return}}
 if(u.thirst>61&&waterLevel>2){const sl=nearestFree(waterSlots,s);if(sl){u.state='seekWater';u.target.copy(sl.p);return}}
 if(u.energy<22){releaseSlot(s);u.state='rest';u.timer=rand(4,8);return}
 if(u.social<30){const mate=chooseMate(s);if(mate){releaseSlot(s);u.target.copy(mate.position).add(new THREE.Vector3(rand(-1,1),0,rand(-1,1)));u.state='social';u.timer=4;return}}
 const r=Math.random();if(r<.24){releaseSlot(s);u.state='idle';u.timer=rand(1.4,4)}else if(r<.35){releaseSlot(s);u.state='curious';u.timer=rand(1,2.5)}else pickWander(s)
}
function addNajdiTraits(rig,ram){const g=new THREE.Group();rig.add(g);const earMat=mat(0x17130f,.9);for(const z of[-.28,.28]){const ear=new THREE.Mesh(new THREE.CapsuleGeometry(.05,.33,4,8),earMat);ear.position.set(-.4,1.15,z);ear.rotation.x=Math.PI/2;ear.rotation.z=.35;g.add(ear)}if(ram){for(const z of[-.23,.23]){const horn=new THREE.Mesh(new THREE.TorusGeometry(.18,.045,7,15,Math.PI*1.55),mat(0xc3a06b,.8));horn.position.set(-.35,1.25,z);horn.rotation.x=Math.PI/2;g.add(horn)}}rig.userData.traits=g}
function spawnSheep(i){const ram=i===9,rig=SkeletonUtils.clone(sheepSource);blackNajdi(rig,ram);shadows(rig);normalize(rig,ram?1.46:1.2);rig.scale.multiplyScalar(rand(.92,1.03));do{rig.position.set(rand(-8,8),0,rand(-7,7))}while(!validPoint(rig.position.x,rig.position.z));rig.rotation.y=rand(0,Math.PI*2);addNajdiTraits(rig,ram);
 const mx=new THREE.AnimationMixer(rig),base=sheepAnims[0],clips={walk:findClip(/walk|run/i,base),idle:findClip(/idle|stand|pose/i,base),eat:findClip(/eat|graze|feed|interact/i,findClip(/idle|stand/i,base)),rest:findClip(/sleep|lay|rest/i,findClip(/idle|stand/i,base))};
 rig.userData={index:i,name:ram?'الفحل':'نجدية '+(i+1),target:new THREE.Vector3(),velocity:new THREE.Vector3(),state:'idle',timer:rand(0,3),speed:rand(.58,.82),ram,hunger:rand(22,55),thirst:rand(18,52),energy:rand(55,95),social:rand(45,90),mixer:mx,clips,action:null,anim:'',slot:null,startle:0,phase:rand(0,10),lastBleat:rand(5,25),restTilt:0};
 scene.add(rig);sheep.push(rig);mixers.push(mx);setAnim(rig,'idle');$('#count').textContent=sheep.length}

function separation(s){const out=new THREE.Vector3();for(const q of sheep){if(q===s)continue;const d=s.position.distanceTo(q.position);if(d>0&&d<1.35)out.add(s.position.clone().sub(q.position).normalize().multiplyScalar((1.35-d)/1.35))}return out}
function cohesion(s){const near=[];for(const q of sheep)if(q!==s&&s.position.distanceTo(q.position)<4.2)near.push(q);if(!near.length)return new THREE.Vector3();const c=new THREE.Vector3();near.forEach(q=>c.add(q.position));c.multiplyScalar(1/near.length);return c.sub(s.position).setY(0).normalize()}
function avoidObstacles(s){const out=new THREE.Vector3();for(const o of obstacles){const cx=clamp(s.position.x,o.x-o.hx,o.x+o.hx),cz=clamp(s.position.z,o.z-o.hz,o.z+o.hz),dx=s.position.x-cx,dz=s.position.z-cz,d=Math.hypot(dx,dz);if(d<1.25){const v=new THREE.Vector3(dx,0,dz);if(v.lengthSq()<.001)v.set(rand(-1,1),0,rand(-1,1));out.add(v.normalize().multiplyScalar((1.25-d)*2.2))}}return out}
function keepInYard(s){const v=new THREE.Vector3();if(s.position.x<-9.7)v.x+=1;if(s.position.x>9.7)v.x-=1;if(s.position.z<-8.7)v.z+=1;if(s.position.z>8.7)v.z-=1;return v.multiplyScalar(2)}
function moveAnimal(s,dt){const u=s.userData,to=u.target.clone().sub(s.position).setY(0),dist=to.length();if(dist<.18)return true;const desired=to.normalize();const steer=desired.multiplyScalar(1.2).add(separation(s).multiplyScalar(1.4)).add(avoidObstacles(s)).add(keepInYard(s));if(u.state==='wander'||u.state==='social')steer.add(cohesion(s).multiplyScalar(.16));if(steer.lengthSq()>.0001)steer.normalize();u.velocity.lerp(steer.multiplyScalar(u.speed),.12);const slow=clamp(dist/1.25,.28,1);s.position.addScaledVector(u.velocity,dt*slow);const ang=Math.atan2(u.velocity.x,u.velocity.z)-Math.PI/2;s.rotation.y=THREE.MathUtils.lerp(s.rotation.y,ang,.09);setAnim(s,'walk');return false}

function proceduralPose(s,t){const u=s.userData;if(!u.traits)return;const g=u.traits;g.rotation.z=0;g.rotation.x=0;if(u.state==='eat'||u.state==='drink'){g.rotation.z=-.22+Math.sin(t*3+u.phase)*.05}else if(u.state==='rest'){g.rotation.z=-.45;g.rotation.x=.08*Math.sin(t+u.phase)}else if(u.state==='curious'){g.rotation.y=.35*Math.sin(t*2+u.phase)}}

let audioCtx=null;function ensureAudio(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)()}
function bleat(vol=.03){try{ensureAudio();const o=audioCtx.createOscillator(),g=audioCtx.createGain(),f=audioCtx.createBiquadFilter();o.type='sawtooth';o.frequency.setValueAtTime(rand(170,220),audioCtx.currentTime);o.frequency.exponentialRampToValueAtTime(rand(110,150),audioCtx.currentTime+.35);f.type='lowpass';f.frequency.value=650;g.gain.setValueAtTime(0,audioCtx.currentTime);g.gain.linearRampToValueAtTime(vol,audioCtx.currentTime+.03);g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+.45);o.connect(f);f.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+.46)}catch{}}

const dust=[];function puff(pos){for(let i=0;i<2;i++){const p=mesh(new THREE.SphereGeometry(.06,6,5),0xc7a06b,[pos.x+rand(-.15,.15),.08,pos.z+rand(-.15,.15)],1);p.material.transparent=true;dust.push({m:p,t:.7,v:new THREE.Vector3(rand(-.08,.08),rand(.08,.16),rand(-.08,.08))})}}

function updateNeeds(s,dt){const u=s.userData;u.hunger=clamp(u.hunger+dt*.72,0,100);u.thirst=clamp(u.thirst+dt*.9,0,100);u.social=clamp(u.social-dt*.12,0,100);if(['wander','seekFood','seekWater','social','startled'].includes(u.state))u.energy=clamp(u.energy-dt*.22,0,100);else if(u.state==='rest')u.energy=clamp(u.energy+dt*3.5,0,100)}
function handleState(s,dt,t){const u=s.userData;updateNeeds(s,dt);u.lastBleat-=dt;if(u.lastBleat<0){if(Math.random()<.4)bleat(.018);u.lastBleat=rand(12,28)}
 if(truck&&truckOn){const d=s.position.distanceTo(truck.position);if(d<4.2&&u.startle<=0){releaseSlot(s);u.startle=rand(2.2,4);u.state='startled';const away=s.position.clone().sub(truck.position).setY(0).normalize().multiplyScalar(4);u.target.copy(s.position).add(away);u.speed=1.25;bleat(.035)}}
 if(u.startle>0){u.startle-=dt;if(moveAnimal(s,dt)){u.startle=0;u.speed=rand(.58,.82);decide(s)}return}
 if(u.state==='wander'||u.state==='social'||u.state==='seekFood'||u.state==='seekWater'){
   const arrived=moveAnimal(s,dt);if(!arrived)return;
   if(u.state==='seekFood'){u.state='eat';u.timer=rand(4.5,7);setAnim(s,'eat');return}
   if(u.state==='seekWater'){u.state='drink';u.timer=rand(4,6);setAnim(s,'eat');return}
   if(u.state==='social'){u.social=clamp(u.social+18,0,100);u.state='idle';u.timer=rand(1,3);setAnim(s,'idle');return}
   u.timer-=dt;if(u.timer<=0)decide(s);return
 }
 if(u.state==='eat'){setAnim(s,'eat');u.timer-=dt;if(troughFood>0){u.hunger=clamp(u.hunger-dt*8.5,0,100);troughFood=clamp(troughFood-dt*.85,0,100)}if(u.timer<=0||u.hunger<18||troughFood<=.5){releaseSlot(s);u.state='idle';u.timer=rand(1,3);setAnim(s,'idle')}return}
 if(u.state==='drink'){setAnim(s,'eat');u.timer-=dt;if(waterLevel>0){u.thirst=clamp(u.thirst-dt*10,0,100);waterLevel=clamp(waterLevel-dt*.65,0,100)}if(u.timer<=0||u.thirst<16||waterLevel<=.5){releaseSlot(s);u.state='idle';u.timer=rand(1,3);setAnim(s,'idle')}return}
 if(u.state==='rest'){setAnim(s,'rest');u.timer-=dt;if(u.timer<=0||u.energy>78){u.state='idle';u.timer=rand(1,3);setAnim(s,'idle')}return}
 if(u.state==='curious'){setAnim(s,'idle');u.timer-=dt;if(u.timer<=0)decide(s);return}
 setAnim(s,'idle');u.timer-=dt;if(u.timer<=0)decide(s)
}

function updateUI(){grain.scale.y=.25+.75*(troughFood/100);grain.material.color.setHSL(.115,.55,.42+.12*(troughFood/100));water.scale.y=1;water.material.opacity=.45+.55*(waterLevel/100);water.material.transparent=true;$('#feed').textContent=feedStock;$('#trough').textContent=Math.round(troughFood);$('#waterLevel').textContent=Math.round(waterLevel);if(selected){const u=selected.userData;$('#aname').textContent=u.name;$('#astate').textContent=stateNames[u.state]||u.state;$('#hunger').style.width=(100-u.hunger)+'%';$('#thirst').style.width=(100-u.thirst)+'%';$('#energy').style.width=u.energy+'%';$('#social').style.width=u.social+'%'}}
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('on');clearTimeout(window.tt);window.tt=setTimeout(()=>e.classList.remove('on'),1800)}

$('#feedBtn').onclick=()=>{ensureAudio();if(feedStock<=0)return toast('خلص مخزون الشعير');const add=Math.min(35,100-troughFood);if(add<=0)return toast('المعلف ممتلئ');feedStock--;troughFood+=add;toast('عبّيت المعلف بالشعير 🌾')};
$('#waterBtn').onclick=()=>{ensureAudio();waterLevel=100;toast('عبّيت حوض الماء 💧')};
$('#truckBtn').onclick=()=>{ensureAudio();truckOn=!truckOn;toast(truckOn?'شغلت الوايت 🛻':'طفيت الوايت')};
$('#marketBtn').onclick=()=>toast('السوق بنكمّله بعد نظام الحياة');
$('#pet').onclick=()=>{if(!selected)return;selected.userData.social=clamp(selected.userData.social+14,0,100);bleat(.025);toast('تفاعلت مع '+selected.userData.name+' 🤚')};

const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=null;
renderer.domElement.addEventListener('pointerdown',e=>{ensureAudio();down={x:e.clientX,y:e.clientY}});
renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>12)return;pointer.x=e.clientX/innerWidth*2-1;pointer.y=-(e.clientY/innerHeight)*2+1;raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(sheep,true);if(hits.length){let o=hits[0].object;while(o.parent&&!sheep.includes(o))o=o.parent;if(sheep.includes(o)){selected=o;$('#animal').classList.add('on');updateUI();bleat(.014)}}else{$('#animal').classList.remove('on');selected=null}});

let pointers=new Map(),last=null,lastD=0,target=new THREE.Vector3(),zoom=1;
renderer.domElement.addEventListener('pointerdown',e=>{renderer.domElement.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY})});
renderer.domElement.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const a=[...pointers.values()];if(a.length===1){if(last){target.x-=(a[0].x-last.x)*.017*zoom;target.z-=(a[0].y-last.y)*.017*zoom;target.x=clamp(target.x,-8,8);target.z=clamp(target.z,-8,8)}last={...a[0]}}else if(a.length>=2){const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(lastD)zoom=clamp(zoom-(d-lastD)*.004,.58,1.5);lastD=d}});
const end=e=>{pointers.delete(e.pointerId);last=null;lastD=0};renderer.domElement.addEventListener('pointerup',end);renderer.domElement.addEventListener('pointercancel',end);

loader.load(SHEEP_URL,g=>{sheepSource=g.scene;sheepAnims=g.animations||[];for(let i=0;i<10;i++)spawnSheep(i);done()},undefined,()=>$('#loading').textContent='تعذر تحميل موديل النجديات');
loader.load(TRUCK_URL,g=>{truck=g.scene;shadows(truck);normalize(truck,2);truck.traverse(o=>{if(o.isMesh){o.material=o.material.clone();const n=(o.name||'').toLowerCase();if(n.includes('body'))o.material.color.set(0xeee9dd)}});truck.scale.multiplyScalar(1.65);truck.position.set(-6,0,8);truck.rotation.y=-.35;scene.add(truck);done()},undefined,()=>$('#loading').textContent='تعذر تحميل موديل الوايت');
let loaded=0;function done(){loaded++;if(loaded>=2)setTimeout(()=>$('#loading')?.remove(),500)}

const clock=new THREE.Clock();let truckPhase=0,uiAcc=0;
function loop(){requestAnimationFrame(loop);const dt=Math.min(clock.getDelta(),.04),t=performance.now()/1000;for(const s of sheep){handleState(s,dt,t);proceduralPose(s,t)}mixers.forEach(m=>m.update(dt));
 if(truck&&truckOn){truckPhase+=dt*.22;const p=new THREE.Vector3(Math.sin(truckPhase)*7,0,7+Math.cos(truckPhase*.7)*1.8);const d=p.clone().sub(truck.position);if(d.length()>.2){d.normalize();truck.position.addScaledVector(d,1.45*dt);truck.rotation.y=THREE.MathUtils.lerp(truck.rotation.y,Math.atan2(d.x,d.z)-Math.PI/2,.06);if(Math.random()<dt*5)puff(truck.position)}}
 for(let i=dust.length-1;i>=0;i--){const q=dust[i];q.t-=dt;q.m.position.addScaledVector(q.v,dt);q.m.scale.multiplyScalar(1+dt*1.8);q.m.material.opacity=clamp(q.t/.7,0,1);if(q.t<=0){scene.remove(q.m);dust.splice(i,1)}}
 uiAcc+=dt;if(uiAcc>.15){uiAcc=0;updateUI()}
 const cp=new THREE.Vector3(target.x+13*zoom,18*zoom,target.z+22*zoom);camera.position.lerp(cp,.055);camera.lookAt(target);renderer.render(scene,camera)}
loop();
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
