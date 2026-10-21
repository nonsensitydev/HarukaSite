import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip, VRMLookAtQuaternionProxy } from '@pixiv/three-vrm-animation';

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
  const animationLoader=new GLTFLoader();
  animationLoader.register(parser=>new VRMAnimationLoaderPlugin(parser));
  async function manifest(folder){
    const response=await fetch(`${import.meta.env.BASE_URL}${folder}/models.json`);
    if(!response.ok)throw Error(`${folder} manifest unavailable`);
    return response.json();
  }
  const [names,animations]=await Promise.all([manifest('vrms'),manifest('vrmas')]);
  if(!names.length){renderer.dispose();mount.replaceChildren();return;}
  if(!animations.length)throw Error('Add a .vrma file to public/vrmas and rebuild.');
  const animationName=animations[Math.floor(Math.random()*animations.length)];
  const animationAsset=await animationLoader.loadAsync(`${import.meta.env.BASE_URL}vrmas/${encodeURIComponent(animationName)}`);
  const animation=animationAsset.userData.vrmAnimations?.[0];
  if(!animation)throw Error(`No VRM animation in ${animationName}`);
  const order=[...names];
  for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  const bocchi=names.find(name=>/^bocchi\.vrm$/i.test(name));
  if(bocchi && order.at(-1)!==bocchi)order.push(bocchi);
  if(reduced && bocchi)order.splice(0,order.length,bocchi);
  let vrm,framing,mixer,clip,index=0,elapsed=0,lastSwitch=0,finishAt=Infinity;
  let prepared=null,preparing=false;
  mount.dataset.animation=animationName;
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
    preparing=true;
    prepare(order[index+1]).then(model=>{prepared={model};},error=>{prepared={error};}).finally(()=>{preparing=false;});
  }
  function activate(next){
    if(vrm){mixer.stopAllAction();mixer.uncacheRoot(vrm.scene);pivot.remove(vrm.scene);VRMUtils.deepDispose(vrm.scene);}
    vrm=next;pivot.add(vrm.scene);vrm.humanoid.resetNormalizedPose();vrm.scene.updateMatrixWorld(true);
    if(vrm.lookAt){const proxy=new VRMLookAtQuaternionProxy(vrm.lookAt);proxy.name='VRMLookAtQuaternionProxy';vrm.scene.add(proxy);}
    const bone=name=>vrm.humanoid.getNormalizedBoneNode(name);
    const head=bone('head').getWorldPosition(new THREE.Vector3());const hips=bone('hips').getWorldPosition(new THREE.Vector3());
    framing={headY:head.y,scale:Math.max(.2,head.y-hips.y)};resize();
    clip=createVRMAnimationClip(animation,vrm);
    mixer=new THREE.AnimationMixer(vrm.scene);
    const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
    // Sample every avatar at the same global timestamp; switching never restarts a spin.
    mixer.setTime(reduced?Math.max(0,clip.duration-.001):elapsed%clip.duration);
    if(index===order.length-1)finishAt=(Math.floor(elapsed/clip.duration)+1)*clip.duration;
    lastSwitch=elapsed;
    mount.dataset.model=order[index];mount.dataset.state='ready';mount.dataset.final=String(index===order.length-1);
    prefetch();
  }
  activate(await prepare(order[0]));
  const clock=new THREE.Clock();
  function frame(){
    requestAnimationFrame(frame);const delta=clock.getDelta();if(document.hidden||!vrm)return;
    elapsed+=delta;
    // Fetch one avatar ahead instead of decoding every large VRM on a phone at once.
    // If the network is slow, the current avatar keeps dancing until the next is ready.
    if(!reduced && elapsed-lastSwitch>=.8 && prepared && !preparing){
      const result=prepared;prepared=null;index++;
      if(result.model)activate(result.model);
      else {console.error('Could not load VRM:',order[index],result.error);prefetch();if(index===order.length-1)finishAt=(Math.floor(elapsed/clip.duration)+1)*clip.duration;}
    }
    const finished=reduced||elapsed>=finishAt;
    const time=finished?Math.max(0,clip.duration-.001):elapsed%clip.duration;
    // A clamped action must be unpaused when seeking back to the next loop.
    mixer.clipAction(clip).paused=false;
    mixer.setTime(time);
    mount.dataset.motion=finished?'finished':'playing';
    mount.dataset.animationTime=time.toFixed(3);
    vrm.update(Math.min(delta,.05));renderer.render(scene,camera);
  }
  frame();
}
setup().catch(error=>{mount.dataset.state='error';console.error('Character rendering unavailable:',error);});
