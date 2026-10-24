import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Edges, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { STATUS_LABEL, coverageHue, pct } from '../data/model.js';
import TextSprite from './TextSprite.jsx';

const SPACING = 1.25; // base distance between neighbouring cells
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const noRaycast = () => null;
const tmpColor = new THREE.Color();
const INK = '#0b1020';

// Each axis has its own identity colour (kept clear of the red→green coverage
// scale) so a label, its guide line and its axis title read as one family.
export const AXIS_COLOR = { x: '#7dd3fc', y: '#c4b5fd', z: '#f9a8d4' };

function colorFor(coverage) {
  return tmpColor.setHSL(coverageHue(coverage) / 360, 0.8, 0.5).getHex();
}

function axisPos(i, n, step) {
  return (i - (n - 1) / 2) * step;
}

function CellCube({ cell, position, size, opacity, pulse, selected, related, onSelect, onDrill, onHover }) {
  const ref = useRef();
  const mat = useRef();
  const color = useMemo(() => colorFor(cell.coverage), [cell.coverage]);
  const faded = opacity < 0.5;

  useFrame((state, dt) => {
    const m = ref.current;
    if (!m) return;
    const k = 1 - Math.pow(0.001, dt); // frame-rate independent ease
    m.scale.setScalar(THREE.MathUtils.lerp(m.scale.x, size, k));
    if (mat.current) {
      const base = selected ? 0.6 : related ? 0.3 : faded ? 0.02 : 0.12;
      mat.current.emissiveIntensity = pulse ? base + 0.35 * (0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 4)) : base;
    }
  });

  return (
    <mesh
      ref={ref}
      position={position}
      geometry={boxGeometry}
      scale={0.001}
      raycast={opacity < 0.1 ? noRaycast : THREE.Mesh.prototype.raycast}
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
        opacity={opacity}
        depthWrite={!faded}
      />
      {(selected || related) && <Edges color={selected ? '#ffffff' : '#9fb4ff'} lineWidth={selected ? 3 : 1} />}
    </mesh>
  );
}

function UnaddressedMarker({ item, position, size, faded, selected, onSelect, onHover }) {
  const ref = useRef();
  useFrame((state) => {
    if (ref.current) ref.current.scale.setScalar(size * (1 + 0.1 * Math.sin(state.clock.elapsedTime * 3)));
  });
  return (
    <mesh
      ref={ref}
      position={position}
      geometry={boxGeometry}
      scale={size}
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
      <meshBasicMaterial color="#ef4444" transparent opacity={faded ? 0.04 : 0.18} depthWrite={false} />
      <Edges
        color={selected ? '#ffffff' : '#ef4444'}
        lineWidth={selected ? 3 : 1.5}
        transparent
        opacity={faded ? 0.2 : 1}
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

  // Floor grid lines that line up with the cell positions.
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
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [w, h, d, nx, nz, sx, sz]);
  useEffect(() => () => grid.dispose(), [grid]);

  return (
    <group>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#5b6b9a" transparent opacity={0.5} />
      </lineSegments>
      <lineSegments geometry={grid}>
        <lineBasicMaterial color="#334066" transparent opacity={0.35} />
      </lineSegments>
    </group>
  );
}

// One translucent floor lane per Z item (environment / provider / account), so
// every cube visibly sits in a named slice of the cube.
function Lanes({ zItems, nz, sz, width, bottom, focusZi }) {
  return zItems.map((z, k) => (
    <mesh
      key={z.id}
      position={[0, bottom + 0.004, axisPos(k, nz, sz)]}
      rotation={[-Math.PI / 2, 0, 0]}
      raycast={noRaycast}
    >
      <planeGeometry args={[width, sz * 0.94]} />
      <meshBasicMaterial
        color={AXIS_COLOR.z}
        transparent
        opacity={focusZi === k ? 0.16 : k % 2 ? 0.035 : 0.06}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  ));
}

// Dashed guides from the focused cube to the label on each axis.
function Guides({ p, left, bottom, front, right }) {
  const [x, y, z] = p;
  const common = { dashed: true, dashSize: 0.18, gapSize: 0.12, lineWidth: 1.6, transparent: true, opacity: 0.95 };
  return (
    <group>
      <Line points={[p, [x, bottom, z]]} color="#e6ebff" {...common} />
      <Line
        points={[
          [x, bottom, z],
          [x, bottom, front],
        ]}
        color={AXIS_COLOR.x}
        {...common}
      />
      <Line points={[p, [left, y, z], [left, y, front]]} color={AXIS_COLOR.y} {...common} />
      <Line
        points={[
          [x, bottom, z],
          [right, bottom, z],
        ]}
        color={AXIS_COLOR.z}
        {...common}
      />
    </group>
  );
}

function CameraRig({ extent, fitKey }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  const size = useThree((s) => s.size);
  const aspect = size.width / Math.max(1, size.height);
  const homeDist = extent * 2.35 * Math.max(1, 1 / aspect);

  // Snap to the overview pose whenever the cube's shape changes or on reset.
  useEffect(() => {
    camera.position.set(homeDist * 0.62, homeDist * 0.42, homeDist * 0.78);
    camera.near = 0.1;
    camera.far = homeDist * 20;
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
    if (w > 900) camera.setViewOffset(w, h, 0, 0, w, h);
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
  const labelH = Math.max(0.36, L * 0.045);

  const maxMetric = useMemo(() => {
    let m = 0;
    for (const c of cells) m = Math.max(m, metric === 'assets' ? c.assets : c.magnitude);
    return m || 1;
  }, [cells, metric]);

  const isHighlighted = (status) =>
    filter === 'all' || (filter === 'gaps' ? status !== 'ok' : status === 'none' || status === 'unaddressed');

  const pos = (xi, yi, zi) => [axisPos(xi, nx, sx), axisPos(yi + yOffset, ny, sy), axisPos(zi, nz, sz)];
  const sizeOf = (c) =>
    cellUnit * (0.28 + 0.5 * Math.sqrt(Math.max(0, metric === 'assets' ? c.assets : c.magnitude) / maxMetric));

  const half = L / 2;
  const left = -half;
  const right = half;
  const bottom = -half;
  const top = half;
  const front = half;
  const xLabelTilt = Math.PI / 6;

  // The one cube the user has pinned (all three coordinates chosen).
  const focus = useMemo(() => {
    if (!selection?.riskId || !selection?.zId) return null;
    if (selection.toolId) {
      const c = cells.find(
        (c) => c.risk.id === selection.riskId && c.tool.id === selection.toolId && c.z.id === selection.zId,
      );
      if (c) return { cell: c, p: pos(c.xi, c.yi, c.zi), size: sizeOf(c) };
      // Combination exists on the axes but has no control mapped there.
      const xi = risks.findIndex((r) => r.id === selection.riskId);
      const yi = tools.findIndex((t) => t.id === selection.toolId);
      const zi = zItems.findIndex((z) => z.id === selection.zId);
      if (xi < 0 || yi < 0 || zi < 0) return null;
      return {
        empty: true,
        risk: risks[xi],
        tool: tools[yi],
        z: zItems[zi],
        xi,
        yi,
        zi,
        p: pos(xi, yi, zi),
        size: cellUnit * 0.4,
      };
    }
    const u = unaddressed.find((u) => u.risk.id === selection.riskId && u.z.id === selection.zId);
    if (u && hasNoControlRow) {
      return {
        unaddressed: u,
        p: [axisPos(u.xi, nx, sx), axisPos(0, ny, sy), axisPos(u.zi, nz, sz)],
        size: cellUnit * 0.42,
      };
    }
    return null;
  }, [selection, cells, unaddressed, hasNoControlRow, nx, ny, nz, sx, sy, sz, cellUnit, metric, maxMetric]);

  const fx = focus ? (focus.cell?.xi ?? focus.unaddressed?.xi ?? focus.xi) : -1;
  const fy = focus ? (focus.cell ? focus.cell.yi : focus.empty ? focus.yi : -1) : -1;
  const fz = focus ? (focus.cell?.zi ?? focus.unaddressed?.zi ?? focus.zi) : -1;

  const calloutTitle = focus
    ? [
        (focus.cell?.risk || focus.unaddressed?.risk || focus.risk).name,
        focus.cell?.tool?.name || focus.tool?.name || 'No control',
        (focus.cell?.z || focus.unaddressed?.z || focus.z).name,
      ].join('  ·  ')
    : '';
  const calloutSub = focus?.cell
    ? `${pct(focus.cell.coverage)} covered · ${STATUS_LABEL[focus.cell.status]}`
    : focus?.empty
      ? 'Not mapped here'
      : focus
        ? 'No control mapped'
        : '';
  const calloutColor = focus?.cell ? `hsl(${coverageHue(focus.cell.coverage)}, 85%, 60%)` : '#fca5a5';

  const labelStyle = (axis, active) =>
    active
      ? { color: INK, background: AXIS_COLOR[axis], weight: 700 }
      : { color: AXIS_COLOR[axis], background: 'rgba(11,16,32,0.62)', weight: 500 };

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
      <Lanes zItems={zItems} nz={nz} sz={sz} width={L} bottom={bottom} focusZi={fz} />

      {cells.map((c) => {
        const highlighted = isHighlighted(c.status);
        const selected = focus?.cell === c;
        const related =
          !selected && selection && selection.riskId === c.risk.id && selection.toolId === c.tool.id && !selection.zId;
        // With a cube pinned, everything else steps back so it stands out.
        const opacity = !highlighted ? 0.07 : focus && !selected ? 0.22 : 0.93;
        return (
          <CellCube
            key={c.key}
            cell={c}
            position={pos(c.xi, c.yi, c.zi)}
            size={sizeOf(c)}
            opacity={opacity}
            pulse={filter !== 'all' && highlighted && !focus}
            selected={selected}
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
            faded={!!focus && focus.unaddressed !== u}
            selected={focus?.unaddressed === u}
            onSelect={onSelect}
            onHover={onHover}
          />
        ))}

      {focus && (
        <>
          {focus.empty && (
            <mesh position={focus.p} scale={focus.size} geometry={boxGeometry} raycast={noRaycast}>
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              <Edges color="#e6ebff" lineWidth={2} />
            </mesh>
          )}
          <Guides p={focus.p} left={left} bottom={bottom} front={front} right={right} />
          <TextSprite
            text={calloutTitle}
            position={[focus.p[0], focus.p[1] + focus.size / 2 + labelH * 2.3, focus.p[2]]}
            height={labelH * 1.25}
            color="#ffffff"
            background="rgba(11,16,32,0.9)"
            weight={700}
          />
          <TextSprite
            text={calloutSub}
            position={[focus.p[0], focus.p[1] + focus.size / 2 + labelH * 1.05, focus.p[2]]}
            height={labelH * 1.05}
            color={calloutColor}
            background="rgba(11,16,32,0.9)"
            weight={600}
          />
        </>
      )}

      {/* X axis: risks (front-bottom edge, slanted) */}
      {risks.map((r, i) => (
        <TextSprite
          key={r.id}
          text={r.name}
          position={[axisPos(i, nx, sx), bottom - labelH * 0.6, front + labelH]}
          height={labelH * (i === fx ? 1.15 : 1)}
          anchor="right"
          rotation={xLabelTilt}
          {...labelStyle('x', i === fx)}
        />
      ))}
      <TextSprite
        text="RISK →"
        position={[right + sx * 0.5, bottom - labelH * 0.6, front + labelH]}
        height={labelH * 1.2}
        anchor="right"
        rotation={xLabelTilt}
        color={AXIS_COLOR.x}
        background={null}
        weight={800}
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
          text={t.kind === 'process' ? `${t.name} (process)` : t.name}
          position={[left - labelH * 0.6, axisPos(j + yOffset, ny, sy), front]}
          height={labelH * (j === fy ? 1.15 : 1)}
          anchor="right"
          {...labelStyle('y', j === fy)}
        />
      ))}
      <TextSprite
        text="↑ TOOL / PROCESS"
        position={[left - labelH * 0.6, top + labelH * 1.4, front]}
        anchor="right"
        height={labelH * 1.2}
        color={AXIS_COLOR.y}
        background={null}
        weight={800}
      />

      {/* Z axis: environment → provider → account (right-bottom edge) */}
      {zItems.map((z, k) => (
        <TextSprite
          key={z.id}
          text={z.tag ? `${z.name} · ${z.tag}` : z.name}
          position={[right + labelH * 0.6, bottom - labelH * 0.6, axisPos(k, nz, sz)]}
          height={labelH * (k === fz ? 1.3 : 1.15)}
          anchor="left"
          {...labelStyle('z', k === fz)}
        />
      ))}
      <TextSprite
        text={`${zAxis.title.toUpperCase()} →`}
        position={[right + labelH * 1.2, bottom - labelH * 2.8, 0]}
        height={labelH * 1.2}
        anchor="left"
        color={AXIS_COLOR.z}
        background={null}
        weight={800}
      />
    </Canvas>
  );
}
