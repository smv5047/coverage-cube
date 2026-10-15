import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Edges, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { coverageHue } from '../data/model.js';
import TextSprite from './TextSprite.jsx';

const SPACING = 1.25; // base distance between neighbouring cells
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const noRaycast = () => null;
const tmpColor = new THREE.Color();

function colorFor(coverage) {
  return tmpColor.setHSL(coverageHue(coverage) / 360, 0.8, 0.5).getHex();
}

function axisPos(i, n, step) {
  return (i - (n - 1) / 2) * step;
}

function CellCube({ cell, position, size, dim, pulse, selected, related, onSelect, onDrill, onHover }) {
  const ref = useRef();
  const mat = useRef();
  const color = useMemo(() => colorFor(cell.coverage), [cell.coverage]);

  useFrame((state, dt) => {
    const m = ref.current;
    if (!m) return;
    const k = 1 - Math.pow(0.001, dt); // frame-rate independent ease
    const s = THREE.MathUtils.lerp(m.scale.x, size, k);
    m.scale.setScalar(s);
    if (mat.current) {
      const base = selected ? 0.55 : related ? 0.3 : 0.12;
      mat.current.emissiveIntensity = pulse ? base + 0.35 * (0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 4)) : base;
    }
  });

  return (
    <mesh
      ref={ref}
      position={position}
      geometry={boxGeometry}
      scale={0.001}
      raycast={dim ? noRaycast : THREE.Mesh.prototype.raycast}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(cell);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDrill(cell);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(cell, e.nativeEvent);
      }}
      onPointerOut={() => onHover(null)}
    >
      <meshStandardMaterial
        ref={mat}
        color={color}
        emissive={color}
        roughness={0.45}
        metalness={0.1}
        transparent
        opacity={dim ? 0.07 : 0.93}
        depthWrite={!dim}
      />
      {(selected || related) && !dim && (
        <Edges color={selected ? '#ffffff' : '#9fb4ff'} lineWidth={selected ? 2.5 : 1} />
      )}
    </mesh>
  );
}

function UnaddressedMarker({ item, position, size, dim, selected, onSelect, onHover }) {
  const ref = useRef();
  useFrame((state) => {
    if (ref.current && !dim) {
      const s = size * (1 + 0.1 * Math.sin(state.clock.elapsedTime * 3));
      ref.current.scale.setScalar(s);
    }
  });
  return (
    <mesh
      ref={ref}
      position={position}
      geometry={boxGeometry}
      scale={size}
      raycast={dim ? noRaycast : THREE.Mesh.prototype.raycast}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(item);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(item, e.nativeEvent);
      }}
      onPointerOut={() => onHover(null)}
    >
      <meshBasicMaterial color="#ef4444" transparent opacity={dim ? 0.03 : 0.18} depthWrite={false} />
      <Edges
        color={selected ? '#ffffff' : '#ef4444'}
        lineWidth={selected ? 2.5 : 1.5}
        transparent
        opacity={dim ? 0.15 : 1}
      />
    </mesh>
  );
}

function Frame({ nx, ny, nz, sx, sy, sz }) {
  const w = nx * sx;
  const h = ny * sy;
  const d = nz * sz;
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), [w, h, d]);
  useEffect(() => () => edges.dispose(), [edges]);

  // Floor + back-wall grid lines that line up with the cell positions.
  const grid = useMemo(() => {
    const pts = [];
    const y = -h / 2;
    for (let i = 0; i <= nx; i++) {
      const x = -w / 2 + i * sx;
      pts.push(x, y, -d / 2, x, y, d / 2);
    }
    for (let k = 0; k <= nz; k++) {
      const z = -d / 2 + k * sz;
      pts.push(-w / 2, y, z, w / 2, y, z);
    }
    for (let j = 0; j <= ny; j++) {
      const yy = -h / 2 + j * sy;
      pts.push(-w / 2, yy, -d / 2, w / 2, yy, -d / 2);
      pts.push(-w / 2, yy, -d / 2, -w / 2, yy, d / 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [w, h, d, nx, ny, nz, sx, sy, sz]);
  useEffect(() => () => grid.dispose(), [grid]);

  return (
    <group>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#5b6b9a" transparent opacity={0.55} />
      </lineSegments>
      <lineSegments geometry={grid}>
        <lineBasicMaterial color="#334066" transparent opacity={0.3} />
      </lineSegments>
    </group>
  );
}

function CameraRig({ extent, fitKey }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  const size = useThree((s) => s.size);
  const aspect = size.width / Math.max(1, size.height);

  // Reframe whenever the cube's shape changes (drill / data) or on demand.
  useEffect(() => {
    const dist = extent * 2.35 * Math.max(1, 1 / aspect);
    camera.position.set(dist * 0.62, dist * 0.42, dist * 0.78);
    camera.near = 0.1;
    camera.far = dist * 20;
    camera.updateProjectionMatrix();
    if (controls) {
      controls.target.set(0, 0, 0);
      controls.update();
    }
  }, [camera, controls, extent, fitKey]);

  // On wide screens, nudge the projection so the cube centres in the space
  // between the left control stack and the right detail panel.
  useEffect(() => {
    const { width: w, height: h } = size;
    if (w > 900) camera.setViewOffset(w, h, -(464 - 384) / 2, 0, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

export default function Scene({
  data,
  zAxis,
  cells,
  unaddressed,
  showUnaddressed,
  metric,
  filter,
  selection,
  fitKey,
  onSelect,
  onDrill,
  onHover,
  onClear,
}) {
  const risks = data.risks;
  const tools = data.tools;
  const zItems = zAxis.items;
  const hasNoControlRow = showUnaddressed && unaddressed.length > 0;
  const yOffset = hasNoControlRow ? 1 : 0;
  const nx = Math.max(1, risks.length);
  const ny = Math.max(1, tools.length + yOffset);
  const nz = Math.max(1, zItems.length);
  // Every axis spans the same length so the scatter reads as a cube; the cell
  // size is driven by the tightest axis spacing so cubes never overlap.
  const L = Math.max(4, nx, ny, nz) * SPACING;
  const sx = L / nx;
  const sy = L / ny;
  const sz = L / nz;
  const cellUnit = Math.min(sx, sy, sz);
  const extent = L;
  const labelH = L * 0.042;

  const maxMetric = useMemo(() => {
    let m = 0;
    for (const c of cells) m = Math.max(m, metric === 'assets' ? c.assets : c.magnitude);
    return m || 1;
  }, [cells, metric]);

  const isHighlighted = (status) =>
    filter === 'all' || (filter === 'gaps' ? status !== 'ok' : status === 'none' || status === 'unaddressed');

  const pos = (xi, yi, zi) => [axisPos(xi, nx, sx), axisPos(yi + yOffset, ny, sy), axisPos(zi, nz, sz)];

  const half = L / 2;
  const left = -half;
  const right = half;
  const bottom = -half;
  const top = half;
  const front = half;
  const back = -half;
  const xLabelTilt = Math.PI / 6;

  return (
    <Canvas
      camera={{ fov: 45, position: [10, 8, 12] }}
      dpr={[1, 2]}
      onPointerMissed={(e) => {
        if (e.type === 'click') onClear();
      }}
      style={{ touchAction: 'none' }}
    >
      <color attach="background" args={['#0b1020']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[8, 14, 10]} intensity={1.1} />
      <directionalLight position={[-10, -4, -8]} intensity={0.35} color="#7aa2ff" />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.7}
        zoomSpeed={0.9}
        minDistance={2}
        maxDistance={extent * 6}
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
      />
      <CameraRig extent={extent} fitKey={fitKey} />

      <Frame nx={nx} ny={ny} nz={nz} sx={sx} sy={sy} sz={sz} />

      {cells.map((c) => {
        const value = metric === 'assets' ? c.assets : c.magnitude;
        const size = cellUnit * (0.16 + 0.62 * Math.sqrt(Math.max(0, value) / maxMetric));
        const highlighted = isHighlighted(c.status);
        const selected =
          selection && selection.riskId === c.risk.id && selection.toolId === c.tool.id && selection.zId === c.z.id;
        const related =
          !selected && selection && selection.riskId === c.risk.id && selection.toolId === c.tool.id && !selection.zId;
        return (
          <CellCube
            key={c.key}
            cell={c}
            position={pos(c.xi, c.yi, c.zi)}
            size={size}
            dim={!highlighted}
            pulse={filter !== 'all' && highlighted}
            selected={!!selected}
            related={!!related}
            onSelect={onSelect}
            onDrill={onDrill}
            onHover={onHover}
          />
        );
      })}

      {hasNoControlRow &&
        unaddressed.map((u) => (
          <UnaddressedMarker
            key={u.key}
            item={u}
            position={[axisPos(u.xi, nx, sx), axisPos(0, ny, sy), axisPos(u.zi, nz, sz)]}
            size={cellUnit * 0.42}
            dim={false}
            selected={selection && selection.riskId === u.risk.id && !selection.toolId && selection.zId === u.z.id}
            onSelect={onSelect}
            onHover={onHover}
          />
        ))}

      {/* X axis: risks (front-bottom edge, slanted) */}
      {risks.map((r, i) => (
        <TextSprite
          key={r.id}
          text={r.name}
          position={[axisPos(i, nx, sx), bottom - labelH * 0.6, front + labelH]}
          height={labelH}
          anchor="right"
          rotation={xLabelTilt}
        />
      ))}
      <TextSprite
        text="X · RISK"
        position={[right + sx * 0.5, bottom - labelH * 0.6, front + labelH]}
        height={labelH * 1.15}
        anchor="right"
        rotation={xLabelTilt}
        color="#8fa6ff"
        background={null}
        weight={700}
      />

      {/* Y axis: tools & processes (left-front vertical edge) */}
      {hasNoControlRow && (
        <TextSprite
          text="∅ No control mapped"
          position={[left - labelH * 0.6, axisPos(0, ny, sy), front]}
          height={labelH}
          anchor="right"
          color="#fca5a5"
        />
      )}
      {tools.map((t, j) => (
        <TextSprite
          key={t.id}
          text={t.name}
          position={[left - labelH * 0.6, axisPos(j + yOffset, ny, sy), front]}
          height={labelH}
          anchor="right"
          color={t.kind === 'process' ? '#d8b4fe' : '#c9d3f5'}
        />
      ))}
      <TextSprite
        text="Y · TOOL / PROCESS"
        position={[left + labelH * 2, top + labelH * 1.4, front]}
        anchor="left"
        height={labelH * 1.15}
        color="#8fa6ff"
        background={null}
        weight={700}
      />

      {/* Z axis: environment → provider → account (right-bottom edge) */}
      {zItems.map((z, k) => (
        <TextSprite
          key={z.id}
          text={z.tag ? `${z.name} · ${z.tag}` : z.name}
          position={[right + labelH * 0.6, bottom - labelH * 0.6, axisPos(k, nz, sz)]}
          height={labelH}
          anchor="left"
          color={z.tag ? '#d8b4fe' : '#c9d3f5'}
        />
      ))}
      <TextSprite
        text={`Z · ${zAxis.title.toUpperCase()}`}
        position={[right + labelH * 1.2, bottom - labelH * 2.6, 0]}
        height={labelH * 1.15}
        anchor="left"
        color="#8fa6ff"
        background={null}
        weight={700}
      />
    </Canvas>
  );
}
