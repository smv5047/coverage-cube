import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

const PX = 64; // canvas font size; higher = crisper text

// Camera-facing text label drawn to a canvas texture. Works fully offline (no
// font fetching) and lives inside the WebGL scene, so it never fights React DOM.
export default function TextSprite({
  text,
  position,
  height = 0.3,
  color = '#c9d3f5',
  background = 'rgba(11,16,32,0.62)',
  weight = 500,
  anchor = 'center', // 'left' | 'center' | 'right'
  rotation = 0,
}) {
  const { texture, aspect } = useMemo(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const font = `${weight} ${PX}px Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
    ctx.font = font;
    const padX = PX * 0.35;
    const padY = PX * 0.22;
    const w = Math.ceil(ctx.measureText(text).width + padX * 2);
    const h = Math.ceil(PX * 1.25 + padY * 2);
    canvas.width = w;
    canvas.height = h;
    ctx.font = font;
    if (background) {
      ctx.fillStyle = background;
      const r = PX * 0.25;
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, r);
      ctx.fill();
    }
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, padX, h / 2 + PX * 0.04);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return { texture: tex, aspect: w / h };
  }, [text, color, background, weight]);

  useEffect(() => () => texture.dispose(), [texture]);

  const center = useMemo(() => new THREE.Vector2(anchor === 'left' ? 0 : anchor === 'right' ? 1 : 0.5, 0.5), [anchor]);

  return (
    <sprite
      position={position}
      scale={[height * aspect, height, 1]}
      center={center}
      renderOrder={10}
      raycast={() => null}
    >
      <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} rotation={rotation} />
    </sprite>
  );
}
