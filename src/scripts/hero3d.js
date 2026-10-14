// Ported from the Claude Design project "Healthy Xmile Site" (hero3d.js).
// The hero needs public/models/teeth.glb; the single crowns are procedural.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const eio = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const eo = t => 1 - Math.pow(1 - t, 3);
const lerp = (a, b, t) => a + (b - a) * t;

const VENEER = { body: 0xf4f1ea, edge: 0xb9d2df, neck: 0xefe4d0 };

function crownGeo(s, seg, colors, noise, shell) {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * .85), -Math.PI / 2);
  const p = g.attributes.position, n = p.count, col = new Float32Array(n * 3);
  const sq = (a, e) => Math.sign(a) * Math.pow(Math.abs(a), e);
  const cB = new THREE.Color(colors.body), cI = new THREE.Color(colors.edge), cC = new THREE.Color(colors.neck), c = new THREE.Color();
  const bx = s.soft ? .5 : s.k === 'inc' ? .26 : s.k === 'mol' ? .3 : .36;
  const by = s.soft ? .42 : s.k === 'inc' ? .26 : .34;
  for (let i = 0; i < n; i++) {
    const ox = p.getX(i), oy = p.getY(i), oz = p.getZ(i);
    const x = sq(ox, bx), y = sq(oy, by);
    const t = (y + 1) / 2; // 0 = incisal, 1 = cervical
    const wf = 1 - .22 * t * t - (s.k === 'inc' ? 0 : .08 * (1 - t) * (1 - t));
    const df = s.k === 'inc' ? .34 + .66 * sstep(0, .7, t) : .72 + .28 * sstep(0, .6, t);
    const zOf = zz => { let Z = sq(zz, .55) * s.d / 2 * df; if (Z < 0) Z *= .9; Z -= .1 * s.d * x * x; if (Z > 0) Z += .035 * Math.sin(t * Math.PI); return Z; };
    let Z = zOf(oz);
    if (shell && oz < 0) Z = zOf(-oz) - (.05 + .05 * t) - .02 * (1 - Math.abs(x));
    let X = x * s.w / 2 * wf, Y = y * s.h / 2;
    if (s.k === 'inc' && t < .08) Y += .01 * Math.cos(x * Math.PI * 3) * (1 - t / .08);
    if (s.k === 'can' && t < .5) Y -= .13 * s.h * Math.max(0, 1 - Math.pow(Math.abs(x), 1.4)) * (1 - t / .5);
    if (s.k === 'pre' && t < .45) Y -= .07 * s.h * Math.max(0, 1 - Math.pow(Math.abs(x), 1.4)) * (1 - t / .45);
    if (s.k === 'mol' && t < .4) Y -= .05 * s.h * Math.abs(Math.sin(x * Math.PI)) * (1 - t / .4);
    p.setXYZ(i, X, Y, Z);
    const e = s.k === 'inc' ? 1 - sstep(.02, .26, t) : (1 - sstep(0, .16, t)) * .5;
    const nk = sstep(.7, 1, t);
    c.copy(cB).lerp(cI, e * .8).lerp(cC, nk * .6);
    if (noise) { const h = Math.sin(ox * 41.3 + oy * 17.1 + oz * 29.7) * 43758.5453; c.offsetHSL(0, 0, ((h - Math.floor(h)) - .5) * noise); }
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function makeEnv(renderer) {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x0b2138);
  const panel = (w, h, color, k, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); s.add(m);
  };
  panel(8, 3, 0xffffff, 3.2, [0, 6, 5]);
  panel(3, 6, 0xffffff, 1.8, [-7, 1, 4]);
  panel(3, 7, 0x45c1ee, 2.2, [7, 0, 2]);
  panel(7, 2, 0xe82e89, 1.2, [0, -5, 3]);
  panel(10, 4, 0xffffff, .5, [0, 1, -8]);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, .02).texture;
  pm.dispose();
  return tex;
}

const BG_FRAG = `
precision highp float; varying vec2 vUv;
uniform float uT, uC; uniform vec2 uRes, uM;
float caustic(vec2 uv, float t){
  vec2 p = mod(uv*6.28318, 6.28318) - 250.; vec2 i = p; float c = 1.; float inten = .005;
  for(int n=0;n<4;n++){ float tt = t*(1.-(3.5/float(n+1)));
    i = p + vec2(cos(tt-i.x)+sin(tt+i.y), sin(tt-i.y)+cos(tt+i.x));
    c += 1./length(vec2(p.x/(sin(i.x+tt)/inten), p.y/(cos(i.y+tt)/inten))); }
  c /= 4.; c = 1.17 - pow(c, 1.4); return pow(abs(c), 8.);
}
void main(){
  vec2 uv = vUv; float asp = uRes.x/uRes.y; vec2 q = vec2((uv.x-.5)*asp, uv.y-.5);
  vec3 cyan = vec3(.27,.757,.933), pink = vec3(.91,.18,.537);
  vec3 col = mix(vec3(.018,.06,.115), vec3(.043,.129,.22), clamp(uv.y*.7+.25,0.,1.));
  float gc = exp(-pow(length(q - vec2(.32*asp, .22) + uM*.06), 2.)*3.2); col = mix(col, vec3(.05,.33,.48), gc*.6);
  float gb = exp(-pow(length(q - vec2(-.05, -.7)), 2.)*2.4); col += cyan*gb*.22;
  float gp = exp(-pow(length(q - vec2(-.42*asp, -.38) - uM*.04), 2.)*4.5); col += pink*gp*.26;
  float ca = caustic(q*1.1 + vec2(uT*.006, uT*.003), uT*.32);
  float mask = .25 + .75*smoothstep(.85, .0, uv.y);
  col += vec3(.55,.9,1.)*ca*.2*uC*mask;
  col *= 1. - .38*pow(length(q*vec2(.75,1.05)), 2.);
  float g = fract(sin(dot(gl_FragCoord.xy + uT, vec2(12.9898,78.233)))*43758.5453); col += (g-.5)*.03;
  gl_FragColor = vec4(col, 1.);
}`;


const MODEL_URL = '/models/teeth.glb';
let modelP = null; const progressCbs = new Set();

function shrink(tex, size) {
  const img = tex && tex.image; if (!img || !img.width || img.width <= size) return;
  const c = document.createElement('canvas'); c.width = c.height = size;
  c.getContext('2d').drawImage(img, 0, 0, size, size);
  tex.image = c; tex.needsUpdate = true;
}

// Load once, classify vertices once (bracket / tooth) from the base-color texture.
function loadModel() {
  if (modelP) return modelP;
  modelP = new Promise((res, rej) => {
    const l = new GLTFLoader(); l.setMeshoptDecoder(MeshoptDecoder);
    l.load(MODEL_URL, gltf => {
      const sceneRoot = gltf.scene; sceneRoot.updateMatrixWorld(true);
      let mesh = null; sceneRoot.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
      const mat = mesh.material, geo = mesh.geometry;
      const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S;
      const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(mat.map.image, 0, 0, S, S);
      const px = cx.getImageData(0, 0, S, S).data;
      let mpx = null; const mt = mat.metalnessMap || mat.roughnessMap; if (mt && mt.image) { cx.clearRect(0, 0, S, S); cx.drawImage(mt.image, 0, 0, S, S); mpx = cx.getImageData(0, 0, S, S).data; }
      [mat.map, mat.normalMap, mat.roughnessMap, mat.metalnessMap].forEach(t => shrink(t, 2048));
      const pos = geo.attributes.position, uv = geo.attributes.uv, nrm = geo.attributes.normal, n = pos.count;
      const aBr = new Float32Array(n);
      geo.computeBoundingBox(); const bb = geo.boundingBox, ctr = bb.getCenter(new THREE.Vector3());
      const inc = { min: new THREE.Vector3(1e9, 1e9, 1e9), max: new THREE.Vector3(-1e9, -1e9, -1e9), n: new THREE.Vector3(), c: 0 };
      const ls = new THREE.Vector3(); mesh.getWorldScale(ls); const sc = ls.x;
      const w = bb.max.x - bb.min.x, front = bb.max.z;
      for (let i = 0; i < n; i++) {
        const u = uv.getX(i), v = uv.getY(i);
        const k = ((Math.min(S - 1, Math.max(0, (v * S) | 0)) * S) + Math.min(S - 1, Math.max(0, (u * S) | 0))) * 4;
        const r = px[k] / 255, g = px[k + 1] / 255, b = px[k + 2] / 255;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), lum = .2126 * r + .7152 * g + .0722 * b, sat = (mx - mn) / (mx + 1e-4);
        const metal = mpx ? mpx[k + 2] / 255 : 0;
        if (metal > .5 || (lum < .2 && sat < .35)) aBr[i] = 1;
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        // upper right central incisor: white, upper half, front, just right of midline
        if (!aBr[i] && lum > .55 && sat < .3 && y > ctr.y && z > front - .12 * (bb.max.z - bb.min.z) && x > .012 * w && x < .085 * w) {
          inc.min.min(ls.set(x, y, z)); inc.max.max(ls); inc.n.x += nrm.getX(i); inc.n.y += nrm.getY(i); inc.n.z += nrm.getZ(i); inc.c++;
        }
      }
      // flatten target: project each bracket vertex onto the local plane of the enamel around it
      const idx = geo.index.array, T = idx.length;
      for (let ring = 0; ring < 1; ring++) {
        const add = new Uint8Array(n);
        for (let t = 0; t < T; t += 3) { const i0 = idx[t], i1 = idx[t + 1], i2 = idx[t + 2]; if (aBr[i0] || aBr[i1] || aBr[i2]) { add[i0] = add[i1] = add[i2] = 1; } }
        for (let i = 0; i < n; i++) if (add[i]) aBr[i] = 1;
      }
      geo.setAttribute('aBr', new THREE.BufferAttribute(aBr, 1));
      const incC = inc.min.clone().add(inc.max).multiplyScalar(.5), incS = inc.max.clone().sub(inc.min);
      res({ sceneRoot, mesh, ctr, size: bb.getSize(new THREE.Vector3()), sc, inc: { c: incC, s: incS, n: inc.n.normalize(), found: inc.c > 50 } });
    }, e => { if (e.total) progressCbs.forEach(f => f(e.loaded / e.total)); }, rej);
  });
  return modelP;
}

function patchMaterial(m, U) {
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uZc, uLS; attribute float aBr; varying float vLX; varying float vBr; varying vec3 vRadV;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vLX = position.x * uLS; vBr = aBr;
        vRadV = normalMatrix * normalize(vec3(position.x, position.y * .15, position.z - uZc) + 1e-5);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSweep, uStain, uBand, uFlash; varying float vLX; varying float vBr; varying vec3 vRadV;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n vec3 tc = diffuseColor.rgb;')
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        float lum = dot(tc, vec3(.2126,.7152,.0722));
        float mxc = max(tc.r, max(tc.g, tc.b)), mnc = min(tc.r, min(tc.g, tc.b)); float sat = (mxc - mnc) / (mxc + 1e-4);
        float brk = max(step(.5, vBr), smoothstep(.35, .65, metalnessFactor));
        float clB = 1. - smoothstep(uSweep - .03, uSweep, abs(vLX));
        float nz = fract(sin(dot(floor(gl_FragCoord.xy / 1.5), vec2(12.9898, 78.233))) * 43758.5453);
        bool back = false;
        float tooth = back ? 1. : smoothstep(.12, .3, lum) * (1. - smoothstep(.2, .4, sat)) * (1. - brk);
        if (back) { tc = vec3(.7); brk = 0.; }
        float enamel = max(tooth, brk);
        float cl = 1. - smoothstep(uSweep - .025, uSweep + .004, abs(vLX));
        vec3 stain = tc * vec3(1., .8, .52) * .85;
        vec3 porc = mix(vec3(.8,.8,.78), vec3(.94,.94,.92), smoothstep(.15, .6, lum));
        if (back) porc = vec3(.9,.9,.88);
        diffuseColor.rgb = mix(mix(tc, stain, tooth * uStain), mix(tc, porc, enamel), cl);
        roughnessFactor = mix(mix(roughnessFactor, max(roughnessFactor, .45), tooth * uStain), .15, cl * enamel);
        metalnessFactor = mix(metalnessFactor, 0., cl * enamel);
        float band = exp(-pow((abs(vLX) - uSweep) / .014, 2.)) * enamel * uBand;
        float edge = 0.;`)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n if (back) normal = normalize(vRadV);')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(.55,.9,1.) * (band * 2.2 + edge * 3.) + vec3(1.) * uFlash * enamel * cl * .5;`);
  };
  m.customProgramCacheKey = () => 'hx-smile-2';
}

export function mountHero({ canvas, stage, scroller, track, mode = 'center', opts = {} }) {
  const O = Object.assign({ caustics: true, particles: true, reduced: false }, opts);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.autoClear = false;
  const mobile = (stage.clientWidth || 1000) < 700;

  const scene = new THREE.Scene();
  scene.environment = makeEnv(renderer);
  const cam = new THREE.PerspectiveCamera(30, 1, .1, 100);
  scene.add(new THREE.HemisphereLight(0xcfefff, 0x0b2138, .5));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2.5, 4, 7); scene.add(key);
  const rim = new THREE.DirectionalLight(0x45c1ee, 2.2); rim.position.set(-5, 2, -4); scene.add(rim);
  const pinkL = new THREE.PointLight(0xe82e89, 6, 14, 2); pinkL.position.set(-3, -2, 3); scene.add(pinkL);
  const flashL = new THREE.PointLight(0xffffff, 0, 6, 2); scene.add(flashL);

  const bgScene = new THREE.Scene();
  const bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const bgMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uC: { value: 1 }, uRes: { value: new THREE.Vector2(1, 1) }, uM: { value: new THREE.Vector2() } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: BG_FRAG, depthWrite: false, depthTest: false,
  });
  bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat));

  let rnd = 7; const rand = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
  const root = new THREE.Group(); root.visible = false; scene.add(root);
  const U = { uSweep: { value: 0 }, uDepth: { value: .05 }, uZc: { value: 0 }, uLS: { value: 1 }, uStain: { value: 1 }, uBand: { value: 1 }, uFlash: { value: 0 } };
  let M = null, marker = null, veneer = null, venMat = null, ready = 0, loadP = 0;
  const VS = 2.7; // world scale applied to the model

  const loadEl = stage.querySelector('[data-load]');
  const onProg = f => { loadP = f; };
  progressCbs.add(onProg);
  loadModel().then(m => {
    M = m;
    const inst = m.sceneRoot.clone(true);
    let mesh = null; inst.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
    const mat = mesh.material.clone(); mesh.material = mat; patchMaterial(mat, U);
    const inner = new THREE.Mesh(mesh.geometry, new THREE.MeshPhysicalMaterial({ name: 'porcelain-fill', color: 0xe9e8e3, roughness: .2, clearcoat: 1, clearcoatRoughness: .08, sheen: .4, sheenColor: new THREE.Color(0xbfe9ff), envMapIntensity: 1 }));
    inner.material.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uZc; varying vec3 vRadV;').replace('#include <begin_vertex>', '#include <begin_vertex>\n vRadV = normalMatrix * normalize(vec3(position.x, position.y * .1, position.z - uZc) + 1e-5);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vRadV;').replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n normal = normalize(vRadV);');
    };
    inner.material.customProgramCacheKey = () => 'hx-fill';
    inner.name = 'enamel-fill';
    inner.position.copy(mesh.position); inner.quaternion.copy(mesh.quaternion); inner.scale.copy(mesh.scale).multiply(new THREE.Vector3(.965, 1, .965));

    U.uZc.value = m.ctr.z; U.uLS.value = m.sc; U.uDepth.value = .045 / m.sc;
    const holder = new THREE.Group(); holder.add(inst);
    inst.updateMatrixWorld(true);
    const wb = new THREE.Box3().setFromObject(inst), wc = wb.getCenter(new THREE.Vector3()), wsz = wb.getSize(new THREE.Vector3());
    inst.position.sub(wc);
    holder.scale.setScalar(VS * 2 / wsz.x);
    root.add(holder);
    // veneer shell on the upper right central incisor
    const ic = m.inc.found ? m.inc : { c: new THREE.Vector3(.06, m.ctr.y + .25, m.ctr.z + m.size.z * .45), s: new THREE.Vector3(.15, .2, .05), n: new THREE.Vector3(0, 0, 1) };
    marker = new THREE.Object3D(); marker.position.copy(ic.c); marker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), ic.n);
    mesh.add(marker);
    venMat = new THREE.MeshPhysicalMaterial({ name: 'porcelain', vertexColors: true, roughness: .14, clearcoat: 1, clearcoatRoughness: .05, ior: 1.6, sheen: .5, sheenColor: new THREE.Color(0xbfe9ff), envMapIntensity: 1.1, emissive: 0xffffff, emissiveIntensity: 0, transparent: true });
    const vw = Math.max(ic.s.x, .05) * 1.08, vh = Math.max(ic.s.y, .07) * 1.04;
    veneer = new THREE.Mesh(crownGeo({ w: vw, h: vh, d: vw * .55, k: 'inc' }, mobile ? 28 : 56, VENEER, .01, true), venMat);
    veneer.name = 'veneer';
    marker.add(veneer);
    veneer.userData.u = vw;
    ready = performance.now();
    root.visible = true;
  }).catch(e => { console.error('model: ' + (e && (e.message || e.type || String(e)))); if (loadEl) loadEl.style.display = 'none'; });

  // particles
  const N = mobile ? 110 : 320;
  const pg = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3), spd = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = (rand() - .5) * 16; pos[i * 3 + 1] = (rand() - .5) * 10; pos[i * 3 + 2] = -6 + rand() * 9; spd[i] = .05 + rand() * .2; }
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pc = document.createElement('canvas'); pc.width = pc.height = 64;
  const pcx = pc.getContext('2d'); const gr = pcx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  pcx.fillStyle = gr; pcx.fillRect(0, 0, 64, 64);
  const pts = new THREE.Points(pg, new THREE.PointsMaterial({ size: .07, map: new THREE.CanvasTexture(pc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0x9fe4ff, opacity: .75 }));
  scene.add(pts);

  const fx = [...stage.querySelectorAll('[data-fx]')].map(el => { const [a, b] = el.dataset.fx.split(',').map(Number); return { el, a, b }; });
  const prog = stage.querySelector('[data-progress]');
  const flashEl = stage.querySelector('[data-flash]');

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = e => {
    const r = stage.getBoundingClientRect();
    mouse.tx = ((e.clientX - r.left) / r.width) * 2 - 1; mouse.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
  };
  const onLeave = () => { mouse.tx = 0; mouse.ty = 0; };
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerleave', onLeave);

  const resize = () => {
    const W = stage.clientWidth || 1, H = stage.clientHeight || 1;
    renderer.setSize(W, H, false);
    cam.aspect = W / H; cam.fov = W / H < .8 ? 44 : 30; cam.updateProjectionMatrix();
    bgMat.uniforms.uRes.value.set(W, H);
  };
  const ro = new ResizeObserver(resize); ro.observe(stage); resize();
  let visible = true;
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }); io.observe(stage);

  let pS = 0, last = performance.now(), time = 0, raf, to, lp = 0;
  const v = new THREE.Vector3(), tw = new THREE.Vector3(), camP = new THREE.Vector3(), camT = new THREE.Vector3();
  const tick = () => { if (document.hidden) to = setTimeout(() => frame(performance.now()), 50); else raf = requestAnimationFrame(frame); };
  const VOFF = new THREE.Vector3(), VROT = new THREE.Vector3(1.1, -2.6, .5);

  const frame = now => {
    tick();
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (!visible) return;
    const red = O.reduced;
    if (!red) time += dt;
    let pT = 0;
    if (track) pT = clamp(-track.getBoundingClientRect().top / Math.max(1, track.offsetHeight - stage.offsetHeight));
    else { const max = scroller.scrollHeight - scroller.clientHeight; pT = max > 0 ? scroller.scrollTop / max : 0; }
    pS += (pT - pS) * (1 - Math.pow(.0009, dt));
    const p = red ? 1 : pS, pf = red ? 0 : pS;

    const k = 1 - Math.pow(.02, dt);
    mouse.x += (mouse.tx - mouse.x) * k * .5; mouse.y += (mouse.ty - mouse.y) * k * .5;

    lp += ((ready ? 1 : loadP * .95) - lp) * k;
    if (loadEl) { loadEl.style.opacity = ready ? Math.max(0, 1 - (now - ready) / 500).toFixed(2) : '1'; if (ready && now - ready > 600) loadEl.style.display = 'none'; const t = loadEl.querySelector('[data-load-pct]'); if (t) t.textContent = Math.round(lp * 100) + '%'; }
    const appear = ready ? (red ? 1 : eo(clamp((now - ready) / 1400))) : 0;

    // story: veneer lands .14→.36, then the clean sweep runs outward .38→.84
    let flash = 0;
    if (M) {
      const sx = M.size.x * M.sc / 2;
      const incX = M.inc.found ? (M.inc.c.x + M.inc.s.x / 2) * M.sc : .1;
      const sweep = lerp(0, incX + .01, sstep(.33, .4, p)) + (sx - incX + .05) * sstep(.42, .86, p);
      U.uSweep.value = sweep;
      U.uStain.value = 1;
      U.uBand.value = p > .3 && p < .9 ? 1 : 0;
      const t = clamp((p - .12) / .24), e = eio(t), r = 1 - eo(t);
      const u = veneer.userData.u;
      VOFF.set(u * 2.2, u * 2.8, u * 9);
      const bob = (1 - e) * u * .25 * Math.sin(time * 1.4);
      veneer.position.set(VOFF.x * (1 - e), VOFF.y * (1 - e) + bob, VOFF.z * (1 - e) + .004);
      veneer.rotation.set(VROT.x * r + (1 - e) * time * .5, VROT.y * r, VROT.z * r);
      veneer.scale.setScalar(1 + .5 * (1 - e));
      veneer.visible = p > .02 || mode === 'macro';
      flash = p >= .36 && !red ? clamp(1 - (p - .36) / .06) : 0;
      venMat.emissiveIntensity = flash * 1.1;
      venMat.opacity = 1 - sstep(.4, .46, p);
      U.uFlash.value = flash * .6;
    }

    const m = sstep(.03, .35, p), show = sstep(.86, 1, p);
    const sway = red ? 0 : Math.sin(time * .25) * .08;
    root.scale.setScalar(.82 + .18 * appear);
    if (mode === 'center') {
      root.position.set(0, lerp(-1.9, -.25, m), 0);
      root.rotation.set(.04 + mouse.y * .1, sway + mouse.x * .34 + show * .2 * Math.sin(time * .4) + (1 - appear) * .6, 0);
      camP.set(0, .3, lerp(14.5, 12.4, m)); camT.set(0, lerp(-.4, 0, m), 0);
    } else if (mode === 'side') {
      const nar = cam.aspect < .9;
      root.position.set(nar ? 0 : lerp(2.9, 2.5, m), nar ? lerp(-2.6, -2.1, m) : -.05, 0);
      root.rotation.set(.04 + mouse.y * .1, (nar ? -.2 : lerp(-.62, -.3, m)) + sway + mouse.x * .3 + (1 - appear) * .6, 0);
      camP.set(0, .3, nar ? 15 : 14); camT.set(0, 0, 0);
    } else {
      root.position.set(0, 0, 0);
      root.rotation.set(.03 + mouse.y * .05, -.1 + sway * .5 + mouse.x * .1, 0);
      if (marker) marker.getWorldPosition(tw); else tw.set(.2, .6, 2);
      const out = sstep(.42, .8, p);
      camP.set(tw.x + .4 + mouse.x * .2, tw.y + .02 - mouse.y * .12, tw.z + 3.1 + (1 - appear) * 1.5).lerp(v.set(.4, .3, 13.5), out);
      camT.set(tw.x - .6, tw.y - .05, tw.z).lerp(v.set(.4, -.05, 0), out);
    }
    cam.position.copy(camP); cam.lookAt(camT);

    if (marker) marker.getWorldPosition(tw);
    flashL.position.set(tw.x, tw.y, tw.z + 1.2);
    flashL.intensity = flash * 40;
    pinkL.position.x = -3 + mouse.x * 1.5;

    pts.visible = O.particles;
    if (!red) {
      for (let i = 0; i < N; i++) { pos[i * 3 + 1] += spd[i] * dt; if (pos[i * 3 + 1] > 5) pos[i * 3 + 1] = -5; }
      pg.attributes.position.needsUpdate = true;
    }

    fx.forEach(({ el, a, b }) => {
      const vv = (a <= 0 ? 1 : sstep(a - .05, a, pf)) * (b >= 1 ? 1 : 1 - sstep(b, b + .05, pf));
      el.style.opacity = vv.toFixed(3);
      el.style.transform = `translateY(${((1 - vv) * 26).toFixed(1)}px)`;
      el.style.filter = vv < .99 ? `blur(${((1 - vv) * 10).toFixed(1)}px)` : 'none';
      el.style.pointerEvents = vv > .5 ? 'auto' : 'none';
    });
    if (prog) prog.style.strokeDashoffset = (1 - pf).toFixed(4);
    if (flashEl) flashEl.style.opacity = (flash * .5).toFixed(3);

    bgMat.uniforms.uT.value = time;
    bgMat.uniforms.uC.value = O.caustics ? 1 : 0;
    bgMat.uniforms.uM.value.set(mouse.x, -mouse.y);
    renderer.clear();
    renderer.render(bgScene, bgCam);
    renderer.render(scene, cam);
  };
  tick();

  return {
    set(o) { Object.assign(O, o); },
    dispose() {
      cancelAnimationFrame(raf); clearTimeout(to); ro.disconnect(); io.disconnect(); progressCbs.delete(onProg);
      stage.removeEventListener('pointermove', onMove); stage.removeEventListener('pointerleave', onLeave);
      renderer.dispose();
    },
  };
}


// Single rotating crown for cards, product pages and the 404.
export function mountTooth({ canvas, stage, kind = 'porcelain', lost = false }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene(); scene.environment = makeEnv(renderer);
  const cam = new THREE.PerspectiveCamera(28, 1, .1, 50); cam.position.set(0, 0, 3.6);
  const key = new THREE.DirectionalLight(0xffffff, 2); key.position.set(2, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x45c1ee, 3); rim.position.set(-3, 1, -2); scene.add(rim);
  const pink = new THREE.PointLight(0xe82e89, 1.2, 8, 2); pink.position.set(-1.5, -1.2, 1.6); scene.add(pink);
  const comp = kind === 'composite';
  const mat = new THREE.MeshPhysicalMaterial({ name: kind, vertexColors: true, color: comp ? 0xfff4e4 : 0xffffff, roughness: comp ? .34 : .12, clearcoat: comp ? .45 : 1, clearcoatRoughness: comp ? .3 : .04, ior: 1.6, sheen: .25, sheenColor: new THREE.Color(0xdff4ff), envMapIntensity: comp ? .8 : 1.05 });
  const tooth = new THREE.Mesh(crownGeo({ w: .82, h: 1.16, d: .62, k: 'inc', soft: true }, 72, VENEER, comp ? .03 : .012, false), mat);
  tooth.name = kind + '-veneer';
  const g = new THREE.Group(); g.add(tooth); scene.add(g);
  const m = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = e => { const r = stage.getBoundingClientRect(); m.tx = ((e.clientX - r.left) / r.width) * 2 - 1; m.ty = ((e.clientY - r.top) / r.height) * 2 - 1; };
  window.addEventListener('pointermove', onMove);
  const resize = () => { const W = stage.clientWidth || 1, H = stage.clientHeight || 1; renderer.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(stage); resize();
  let vis = true; const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; }); io.observe(stage);
  const red = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let t = 0, last = performance.now(), raf, to;
  const tick = () => { if (document.hidden) to = setTimeout(() => frame(performance.now()), 60); else raf = requestAnimationFrame(frame); };
  const frame = now => {
    tick(); const dt = Math.min(.05, (now - last) / 1000); last = now; if (!vis) return;
    if (!red) t += dt;
    m.x += (m.tx - m.x) * .06; m.y += (m.ty - m.y) * .06;
    if (lost) {
      g.position.set(Math.sin(t * .5) * .35 + m.x * .25, Math.sin(t * .9) * .12 - m.y * .15, 0);
      g.rotation.set(Math.sin(t * .7) * .4 + m.y * .3, t * .6 + m.x * .8, Math.sin(t * .4) * .5);
    } else {
      g.rotation.set(.12 + m.y * .25, -.5 + Math.sin(t * .5) * .9 + m.x * .9, .06);
      g.position.y = Math.sin(t * 1.1) * .04;
    }
    pink.position.x = -1.5 + m.x;
    renderer.render(scene, cam);
  };
  tick();
  return { set() {}, dispose() { cancelAnimationFrame(raf); clearTimeout(to); ro.disconnect(); io.disconnect(); window.removeEventListener('pointermove', onMove); renderer.dispose(); } };
}
