import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export function createScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa8cde0);
  scene.fog = new THREE.Fog(0xcfe3ee, 80, 180);

  // 白天天空：上蓝下白的渐变穹顶
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x74a9cf) },
      bottom: { value: new THREE.Color(0xeaf5fa) },
    },
    vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y*0.5+0.5,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, pow(h,0.9)), 1.0); }",
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(200, 24, 16), skyMat));

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
  camera.position.set(17, 10, 23);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 2.4, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 8;
  controls.maxDistance = 60;

  // 日光
  const hemi = new THREE.HemisphereLight(0xeaf5fb, 0x5d6a4f, 1.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff6e6, 2.6);
  sun.position.set(-22, 30, 16);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xbcd8e8, 0.5);
  rim.position.set(20, 8, -18);
  scene.add(rim);

  // 地面
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 0x5d6650, roughness: 0.98 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---------- 尺寸 ----------
  const W = 12, L = 24;          // 跨度、长度
  const EAVE = 3.2, RIDGE = 5.0; // 檐高、脊高（脊必须高于檐）
  const s2 = W / 2;
  const roofRun = s2, roofRise = RIDGE - EAVE;

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x46545a, roughness: 0.45, metalness: 0.55 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xcfe4ea, transparent: true, opacity: 0.14, roughness: 0.05,
    metalness: 0.0, side: THREE.DoubleSide, depthWrite: false,
  });

  const gh = new THREE.Group();
  scene.add(gh);

  // 由两点生成一根方杆
  function strut(x1, y1, z1, x2, y2, z2, thick = 0.11) {
    const a = new THREE.Vector3(x1, y1, z1), b = new THREE.Vector3(x2, y2, z2);
    const len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.BoxGeometry(thick, len, thick), frameMat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    gh.add(m);
    return m;
  }

  // 立柱与檐梁
  for (const z of [-L / 2, 0, L / 2]) {
    for (const x of [-s2, s2]) strut(x, 0, z, x, EAVE, z, 0.14);
  }
  for (const x of [-s2, s2]) strut(x, EAVE, -L / 2, x, EAVE, L / 2, 0.12);
  // 脊梁
  strut(0, RIDGE, -L / 2, 0, RIDGE, L / 2, 0.13);
  // 山墙斜梁：从檐到脊
  for (const z of [-L / 2, 0, L / 2]) {
    for (const sgn of [-1, 1]) strut(sgn * s2, EAVE, z, 0, RIDGE, z, 0.12);
  }
  // 檩条：沿坡度取两处，横向连起来
  for (const t of [0.34, 0.67]) {
    for (const sgn of [-1, 1]) {
      const x = sgn * s2 * (1 - t), y = EAVE + roofRise * t;
      strut(x, y, -L / 2, x, y, L / 2, 0.08);
    }
  }

  // ---------- 屋面：四边形顶点直接构造（脊高檐低，绝不反向） ----------
  function quad(a, b, c, d, mat) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat);
    gh.add(m);
    return m;
  }

  for (const sgn of [-1, 1]) {
    quad(
      [sgn * s2, EAVE, -L / 2],
      [sgn * s2, EAVE, L / 2],
      [0, RIDGE, L / 2],
      [0, RIDGE, -L / 2],
      glassMat
    );
  }

  // ---------- 覆盖带（光伏板）----------
  // 沿坡度参数 t（0=檐口，1=脊）铺；覆盖比 f 决定 t 区间长度，两坡对称。
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x2f5d6b, roughness: 0.18, metalness: 0.2, transparent: true, opacity: 0.9,
    side: THREE.DoubleSide, emissive: 0x0a1418, emissiveIntensity: 0.3,
  });
  const panels = [];
  const roofNormal = (sgn) => new THREE.Vector3(sgn * roofRise, roofRun, 0).normalize();

  for (const sgn of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.BufferGeometry(), panelMat.clone());
    gh.add(m);
    panels.push({ mesh: m, sgn });
  }

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 0.92, L * 0.96),
    new THREE.MeshBasicMaterial({ color: 0x0a1014, transparent: true, opacity: 0.2, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, 0.02, 0);
  gh.add(shadow);

  function layoutPanels(f) {
    const t0 = 0.03, span = 0.94 * Math.max(0, Math.min(1, f));
    const t1 = t0 + span;
    const z0 = -L / 2 + 0.25, z1 = L / 2 - 0.25;
    for (const { mesh, sgn } of panels) {
      const n = roofNormal(sgn), off = 0.05;
      const p = (t, z) => {
        const x = sgn * s2 * (1 - t), y = EAVE + roofRise * t;
        return [x + n.x * off, y + n.y * off, z];
      };
      const a = p(t0, z0), b = p(t0, z1), c = p(t1, z1), d = p(t1, z0);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
      g.computeVertexNormals();
      mesh.geometry.dispose();
      mesh.geometry = g;
      mesh.visible = f > 0.001;
    }
    shadow.material.opacity = 0.06 + 0.3 * f;
    shadow.visible = f > 0.001;
  }

  // ---------- 作物 ----------
  const cropGeo = new THREE.IcosahedronGeometry(0.34, 1);
  const cropMat = new THREE.MeshStandardMaterial({ color: 0x4f8a52, roughness: 0.85 });
  const rows = 6, perRow = 46;
  const crops = new THREE.InstancedMesh(cropGeo, cropMat, rows * perRow);
  const dummy = new THREE.Object3D();
  let idx = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < perRow; c++) {
      const x = -s2 + 2.0 + (r % 3) * 3.2 + (c % 2) * 0.25;
      const z = -L / 2 + 1.2 + c * ((L - 2.4) / perRow) + (r >= 3 ? 0.12 : 0);
      dummy.position.set(x + (r >= 3 ? 0.1 : 0), 0.36 + (r % 2) * 0.04, z);
      dummy.rotation.y = Math.random() * Math.PI;
      dummy.scale.setScalar(0.85 + (r % 3) * 0.12);
      dummy.updateMatrix();
      crops.setMatrixAt(idx++, dummy.matrix);
    }
  }
  crops.instanceMatrix.needsUpdate = true;
  gh.add(crops);

  layoutPanels(0.25);

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(container);

  let raf = 0;
  function loop() {
    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  loop();

  return {
    scene, camera, renderer,
    setCoverage(f) { layoutPanels(f); },
    setTransmission(hex, strength) {
      panels.forEach(({ mesh }) => {
        mesh.material.color.set(hex);
        mesh.material.opacity = 0.62 + 0.3 * Math.min(strength, 1);
      });
      // 透射色同时影响室内主光，让“看到的颜色”和“算出的颜色”一致
      sun.color.set(hex).lerp(new THREE.Color(0xfff6e6), 0.55);
      sun.intensity = 1.9 + 0.9 * Math.min(strength, 1);
    },
    dispose() { cancelAnimationFrame(raf); renderer.dispose(); },
  };
}
