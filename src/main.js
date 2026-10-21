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
  const renderer = new THREE.WebGLRenderer({alpha:true, antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff,0xb7b3c3,1.5));
  const light = new THREE.DirectionalLight(0xfff9f0,1.6); light.position.set(-1,2,3); scene.add(light);
  const camera = new THREE.PerspectiveCamera(27,1,.01,50);
  const pivot = new THREE.Group(); scene.add(pivot);
  const loader = new GLTFLoader(); loader.register(parser => new VRMLoaderPlugin(parser));
  let vrm, base = {}, elapsed = 0, nextBlink = 3, loading = false;
  let framing;
  let names = await fetch(`${import.meta.env.BASE_URL}vrms/models.json`).then(r => {if(!r.ok)throw Error('Model manifest unavailable');return r.json();});
  if (!names.length) { renderer.dispose(); mount.replaceChildren(); return; }
  let index = 0;
  async function load() {
    loading = true;
    try {
      const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}vrms/${encodeURIComponent(names[index])}`);
      const next = gltf.userData.vrm;
      if (!next) throw Error('Not a supported VRM model');
      VRMUtils.rotateVRM0(next);
      if(vrm) {pivot.remove(vrm.scene);VRMUtils.deepDispose(vrm.scene);}
      vrm = next; pivot.add(vrm.scene);
      vrm.humanoid.resetNormalizedPose();
      // VRM normalized bones allow the same gesture across differently rigged avatars.
      const bone = name => vrm.humanoid.getNormalizedBoneNode(name);
      bone('leftUpperArm')?.rotation.set(0,0,-1.25);
      bone('rightUpperArm')?.rotation.set(0,0,1.25);
      base = {};
      for(const name of ['hips','spine','chest','neck','head','leftUpperArm','leftLowerArm','leftHand','rightUpperArm','rightLowerArm','rightHand']) {
        const node=bone(name);if(node)base[name]={node,rotation:node.rotation.clone(),position:node.position.clone()};
      }
      const head = bone('head').getWorldPosition(new THREE.Vector3());
      const hips = bone('hips').getWorldPosition(new THREE.Vector3());
      const scale = Math.max(.2,head.y-hips.y);
      framing = {headY:head.y, scale};
      resize();
      pivot.position.set(0,0,0);
      elapsed=0;nextBlink=2.7;
      mount.dataset.model = names[index];
      mount.dataset.state = 'ready';
    } catch(error) { console.error('Could not load VRM:',names[index],error);mount.dataset.state='error'; }
    finally {loading=false;}
  }
  function resize(){
    const {width,height}=mount.getBoundingClientRect();
    renderer.setSize(width,height);
    camera.aspect=width/Math.max(height,1);
    if(framing){
      const {headY,scale}=framing;
      // Fit both axes: a tall/narrow viewport must not crop the avatar's face.
      const distance=scale*Math.max(4.3,2.9/camera.aspect);
      camera.position.set(0,headY-scale*.16,distance);
      camera.lookAt(0,headY-scale*.19,0);
    }
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(mount);resize();await load();
  const clock = new THREE.Clock();
  const smooth = x => {x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
  function frame(){
    requestAnimationFrame(frame);
    const delta=clock.getDelta();
    const dt=Math.min(delta,.05);
    if(document.hidden || !vrm)return;
    elapsed+=delta;
    const t=elapsed;
    if(!reduced){
      const enter=smooth(t/1.7), leave=names.length>1?smooth((t-17)/1.5):0;
      pivot.position.x= -1.1*(1-enter+leave)-.13;
      pivot.rotation.z= -.12*enter*(1-leave);
      for(const {node,rotation,position} of Object.values(base)){node.rotation.copy(rotation);node.position.copy(position);}
      if(base.spine)base.spine.node.rotation.z=.025*Math.sin(t*.9);
      if(base.chest)base.chest.node.rotation.x=.018*Math.sin(t*1.8);
      if(base.head){base.head.node.rotation.z=.045*Math.sin(t*.65);base.head.node.rotation.y=.05*Math.sin(t*.47);}
      // One greeting: raise, wave gently from the wrist, then lower to rest.
      const greeting=smooth((t-1.1)/.8)*(1-smooth((t-4.8)/1));
      if(base.rightUpperArm){base.rightUpperArm.node.rotation.z=1.25-1.5*greeting;base.rightUpperArm.node.rotation.x=-.25*greeting;}
      if(base.rightLowerArm){base.rightLowerArm.node.rotation.y=-.3*greeting;base.rightLowerArm.node.rotation.z=-1.7*greeting;}
      if(base.rightHand)base.rightHand.node.rotation.x=greeting*(.22+Math.sin((t-1.9)*8)*.3);
      const blink=Math.max(0,1-Math.abs(t-nextBlink)/.085);
      vrm.expressionManager?.setValue('blink',blink);
      if(t>nextBlink+.1)nextBlink=t+2.8+Math.random()*3;
      vrm.expressionManager?.setValue('happy',.3+.08*Math.sin(t*.8));
      if(t>18.6 && names.length>1 && !loading){index=(index+1)%names.length;load();}
    }else {pivot.position.x=-.13;vrm.expressionManager?.setValue('happy',.3);}
    vrm.update(dt);renderer.render(scene,camera);
  }
  frame();
}
setup().catch(error => {mount.dataset.state='error';console.error('Character rendering unavailable:',error);});
