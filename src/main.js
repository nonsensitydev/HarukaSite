import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip, VRMLookAtQuaternionProxy } from '@pixiv/three-vrm-animation';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const title = document.querySelector('#title');
const letters = 'HARUKA';
const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function revealTitle() {
  if(reduced)return;
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
  if(!names.length)throw Error('No VRM models available.');
  if(!animations.length)throw Error('Add a .vrma file to public/vrmas and rebuild.');
  const animationName=animations[Math.floor(Math.random()*animations.length)];
  let previous;
  try {previous=sessionStorage.getItem('haruka-model');}catch { /* Storage may be disabled. */ }
  const candidates=names.length>1?names.filter(name=>name!==previous):names;
  const modelName=candidates[Math.floor(Math.random()*candidates.length)];
  const [animationAsset,vrm]=await Promise.all([
    animationLoader.loadAsync(`${import.meta.env.BASE_URL}vrmas/${encodeURIComponent(animationName)}`),
    prepare(modelName)
  ]);
  const animation=animationAsset.userData.vrmAnimations?.[0];
  if(!animation)throw Error(`No VRM animation in ${animationName}`);
  let framing;
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
    VRMUtils.rotateVRM0(next);
    // Skinned face parts move beyond their original bounds during a VRMA.
    // Only one avatar is drawn, so keep its meshes visible instead of using stale bounds.
    next.scene.traverse(node=>{if(node.isMesh)node.frustumCulled=false;});
    return next;
  }
  pivot.add(vrm.scene);vrm.humanoid.resetNormalizedPose();vrm.scene.updateMatrixWorld(true);
  if(vrm.lookAt){const proxy=new VRMLookAtQuaternionProxy(vrm.lookAt);proxy.name='VRMLookAtQuaternionProxy';vrm.scene.add(proxy);}
  const bone=name=>vrm.humanoid.getNormalizedBoneNode(name);
  const head=bone('head').getWorldPosition(new THREE.Vector3());const hips=bone('hips').getWorldPosition(new THREE.Vector3());
  framing={headY:head.y,scale:Math.max(.2,head.y-hips.y)};resize();
  const clip=createVRMAnimationClip(animation,vrm);
  // Capture the avatar's normalized rest rig before the VRMA changes any bones.
  // Animate a relaxed standing pose on every bone so hips/fingers also leave the final gesture.
  const idleTracks=[];
  const leftAxis=Math.sign(bone('leftLowerArm').position.x)||1;
  for(const [name,{node}]of Object.entries(vrm.humanoid.normalizedHumanBones)){
    const rotation=node.quaternion.clone();
    if(name==='leftUpperArm')rotation.setFromAxisAngle(new THREE.Vector3(0,0,1),-leftAxis*1.35);
    if(name==='rightUpperArm')rotation.setFromAxisAngle(new THREE.Vector3(0,0,1),leftAxis*1.35);
    const middle=rotation.clone();
    if(name==='chest')middle.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),.009));
    idleTracks.push(new THREE.QuaternionKeyframeTrack(`${node.name}.quaternion`,[0,2.4,4.8],[...rotation.toArray(),...middle.toArray(),...rotation.toArray()]));
    idleTracks.push(new THREE.VectorKeyframeTrack(`${node.name}.position`,[0,4.8],[...node.position.toArray(),...node.position.toArray()]));
  }
  const idleClip=new THREE.AnimationClip('Standing idle',4.8,idleTracks);
  const mixer=new THREE.AnimationMixer(vrm.scene);
  const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;
  const idleAction=mixer.clipAction(idleClip);
  let settling=reduced;
  if(reduced){idleAction.play();mixer.update(0);}else action.play();
  vrm.update(0);
  // Compile shaders and upload textures while the page is still invisibly loading.
  await Promise.all([renderer.compileAsync(scene,camera),document.fonts.ready]);
  renderer.render(scene,camera);
  await new Promise(requestAnimationFrame);
  mount.dataset.model=modelName;mount.dataset.state='ready';
  try {sessionStorage.setItem('haruka-model',modelName);}catch { /* Optional refresh history. */ }
  document.documentElement.classList.remove('loading');
  revealTitle();
  const clock=new THREE.Clock();let elapsed=0;
  function frame(){
    requestAnimationFrame(frame);const delta=clock.getDelta();if(document.hidden)return;
    if(!reduced){
      elapsed+=delta;
      if(!settling && elapsed>=clip.duration){
        settling=true;
        idleAction.reset().play().fadeIn(.9);
        action.fadeOut(.9);
      }
      mixer.update(delta);
      if(settling && elapsed>=clip.duration+.9)action.stop();
    }
    mount.dataset.motion=reduced||elapsed>=clip.duration+.9?'idle':settling?'settling':'playing';
    mount.dataset.animationTime=action.time.toFixed(3);
    vrm.update(Math.min(delta,.05));renderer.render(scene,camera);
  }
  frame();
}
setup().catch(error=>{
  mount.dataset.state='error';mount.replaceChildren();
  document.documentElement.classList.remove('loading');
  revealTitle();
  console.error('Character rendering unavailable:',error);
});
