import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const title = document.querySelector('#title');
const letters = 'HARUKA';
const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
if (!reduced) {
  const start = performance.now();
  let last = 0;
  function reveal(now) {
    if (now-last > 65) {
      const locked = Math.max(0, Math.floor((now-start-400)/340));
      title.textContent = [...letters].map((letter,i) => i < locked ? letter : glyphs[Math.floor(Math.random()*glyphs.length)]).join('');
      last = now;
    }
    if (now-start < 2600) requestAnimationFrame(reveal); else title.textContent = letters;
  }
  requestAnimationFrame(reveal);
}

const mount = document.querySelector('#character');
async function setup() {
  const renderer = new THREE.WebGLRenderer({alpha:true,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff,0xb7b3c3,1.5));
  const light=new THREE.DirectionalLight(0xfff9f0,1.6);light.position.set(-1,2,3);scene.add(light);
  const camera=new THREE.PerspectiveCamera(27,1,.01,50);
  const pivot=new THREE.Group();scene.add(pivot);
  const loader=new GLTFLoader();loader.register(parser=>new VRMLoaderPlugin(parser));
  const [names,motions]=await Promise.all([
    fetch(`${import.meta.env.BASE_URL}vrms/models.json`).then(r=>{if(!r.ok)throw Error('Model manifest unavailable');return r.json();}),
    fetch(`${import.meta.env.BASE_URL}animations/motions.json`).then(r=>{if(!r.ok)throw Error('Motion clips unavailable');return r.json();})
  ]);
  if(!names.length){renderer.dispose();mount.replaceChildren();return;}
  // Fisher-Yates gives every model a chance to be first on a fresh page load.
  const order=[...names];
  for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  const bocchi=names.find(name=>/^bocchi\.vrm$/i.test(name));
  if(bocchi && order.at(-1)!==bocchi)order.push(bocchi);
  let vrm,framing,index=0,elapsed=0,loading=false,nextBlink=3;
  let bones={},pending=null,rigSign=1;
  const parents={hips:null,spine:'hips',chest:'spine',neck:'chest',head:'neck',leftUpperArm:'chest',leftLowerArm:'leftUpperArm',leftHand:'leftLowerArm',rightUpperArm:'chest',rightLowerArm:'rightUpperArm',rightHand:'rightLowerArm',leftUpperLeg:'hips',leftLowerLeg:'leftUpperLeg',rightUpperLeg:'hips',rightLowerLeg:'rightUpperLeg'};
  const up=new THREE.Vector3(0,1,0), direction=new THREE.Vector3();
  function resize(){
    const {width,height}=mount.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/Math.max(height,1);
    if(framing){const {headY,scale}=framing;camera.position.set(0,headY-scale*.16,scale*Math.max(4.3,2.9/camera.aspect));camera.lookAt(0,headY-scale*.19,0);}
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(mount);resize();
  async function prepare(name){
    const gltf=await loader.loadAsync(`${import.meta.env.BASE_URL}vrms/${encodeURIComponent(name)}`);
    const next=gltf.userData.vrm;if(!next)throw Error(`Unsupported VRM: ${name}`);
    VRMUtils.rotateVRM0(next);return next;
  }
  function prefetch(){
    if(index+1>=order.length || reduced)return;
    // Keep at most the current and next model in memory. Failures advance the queue.
    pending=prepare(order[index+1]).then(model=>({model}),error=>({error}));
  }
  function activate(next){
    if(vrm){pivot.remove(vrm.scene);VRMUtils.deepDispose(vrm.scene);}
    vrm=next;pivot.position.set(0,0,0);pivot.rotation.set(0,0,0);pivot.add(vrm.scene);
    vrm.humanoid.resetNormalizedPose();vrm.scene.updateMatrixWorld(true);
    const bone=name=>vrm.humanoid.getNormalizedBoneNode(name);
    const head=bone('head').getWorldPosition(new THREE.Vector3());const hips=bone('hips').getWorldPosition(new THREE.Vector3());
    framing={headY:head.y,scale:Math.max(.2,head.y-hips.y)};resize();
    rigSign=Math.sign(bone('leftLowerArm').position.x)||1;
    bones={};for(const name of Object.keys(parents)){const node=bone(name);if(node)bones[name]=node;}
    elapsed=0;nextBlink=2.7;
    mount.dataset.model=order[index];mount.dataset.state='ready';mount.dataset.final=String(index===order.length-1);
    prefetch();
  }
  activate(await prepare(order[0]));
  function sample(clip,time,name){
    const motion=motions[clip],position=(time%motion.duration)*motion.fps;
    const i=Math.floor(position),a=motion.frames[i][name],b=motion.frames[Math.min(i+1,motion.frames.length-1)][name];
    return direction.fromArray(a).lerp(new THREE.Vector3().fromArray(b),position-i).multiply(new THREE.Vector3(rigSign,1,rigSign)).normalize();
  }
  const clock=new THREE.Clock();const smooth=x=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
  async function advance(){
    loading=true;const result=await pending;index++;
    if(result?.model)activate(result.model);
    else {console.error('Could not load VRM:',order[index],result?.error);prefetch();elapsed=8;}
    loading=false;
  }
  function frame(){
    requestAnimationFrame(frame);const delta=clock.getDelta();if(document.hidden||!vrm)return;
    const dt=Math.min(delta,.05);elapsed+=delta;
    const t=reduced?8:elapsed,walkEnd=2.2,waveEnd=walkEnd+motions.Wave.duration;
    const clip=t<walkEnd?'Walking':t<waveEnd?'Wave':'Idle';
    const clipTime=t<walkEnd?t:t<waveEnd?t-walkEnd:t-waveEnd;
    mount.dataset.motion=clip;
    const previous=t<walkEnd+.3?'Walking':'Wave';
    const blend=t<walkEnd?1:t<walkEnd+.3?smooth((t-walkEnd)/.3):t<waveEnd?1:smooth((t-waveEnd)/.35);
    const world={};
    for(const [name,node]of Object.entries(bones)){
      const axis=name.startsWith('left')&&/Arm|Hand/.test(name)?new THREE.Vector3(rigSign,0,0):name.startsWith('right')&&/Arm|Hand/.test(name)?new THREE.Vector3(-rigSign,0,0):/Leg/.test(name)?new THREE.Vector3(0,-1,0):up;
      const desired=sample(clip,clipTime,name).clone();
      if(blend<1)desired.copy(sample(previous,t<walkEnd+.3?t:motions.Wave.duration-.001,name)).lerp(sample(clip,clipTime,name).clone(),blend).normalize();
      const rotation=new THREE.Quaternion().setFromUnitVectors(axis,desired);world[name]=rotation;
      const parent=world[parents[name]];
      node.quaternion.copy(parent?parent.clone().invert().multiply(rotation):rotation);
    }
    // Authored walk motion plus a short translation into the frame; no leaning/swaying overlay.
    pivot.position.x=reduced?0:-framing.scale*1.8*(1-smooth(t/walkEnd));
    pivot.rotation.y=t<walkEnd?-.25*(1-smooth((t-1.5)/.7)):0;
    const blink=reduced?0:Math.max(0,1-Math.abs(t-nextBlink)/.09);
    vrm.expressionManager?.setValue('blink',blink);vrm.expressionManager?.setValue('happy',.12);
    if(t>nextBlink+.1)nextBlink=t+3+Math.random()*3;
    if(!reduced && t>8 && index<order.length-1 && !loading)advance();
    vrm.update(dt);renderer.render(scene,camera);
  }
  frame();
}
setup().catch(error=>{mount.dataset.state='error';console.error('Character rendering unavailable:',error);});
