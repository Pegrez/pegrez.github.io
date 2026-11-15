import {
  AIRLOCK_BOUNDS,
  HAB_BOUNDS,
  MAP_HEIGHT,
  MAP_WIDTH,
  CAVE_SHELTERS,
  LAB_STATION,
  LAB_STATION_RADIUS,
  SUIT_STATION,
  SUIT_STATION_RADIUS,
  ROVER_BOARD_RADIUS,
  WORLD,
  ZONES,
  ZONE_H,
  ZONE_W,
  getZoneAt,
  SCAN_COOLDOWN_SECONDS,
  SCAN_RADIUS,
  WALLS,
  getLmstFromElapsed,
  isPointInAirlock,
  isPointInsideHabitat,
  BUNKS,
  NPC_INTERACT_RADIUS,
  PANEL_FIELD,
  PANEL_INTERACT_RADIUS,
  QUARTERS,
} from './constants';
import { CrewRole, EngineState, FieldSite, IceDeposit, ModuleState, PlantBed, ZoneInfo } from './types';

// ---------------------------------------------------------------------------
// Exploration zones: each outer zone gets a half-resolution terrain canvas
// ---------------------------------------------------------------------------
const zoneCanvasCache = new Map<string, HTMLCanvasElement>();

function zoneRand(seed: number): number {
  const v = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

function buildZoneCanvas(z: ZoneInfo): HTMLCanvasElement {
  const W = ZONE_W / 2;
  const H = ZONE_H / 2;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = z.tint;
  g.fillRect(0, 0, W, H);
  const seed = (z.col + 2) * 13 + (z.row + 2) * 7;
  // Soft tonal patches
  for (let i = 0; i < 70; i++) {
    const x = zoneRand(seed + i) * W;
    const y = zoneRand(seed + i * 3.1) * H;
    const r = 10 + zoneRand(seed + i * 5.7) * 40;
    g.fillStyle = zoneRand(seed + i * 9.3) > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
    g.beginPath();
    g.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2);
    g.fill();
  }
  // Wind ripples
  g.strokeStyle = 'rgba(255,255,255,0.07)';
  g.lineWidth = 1;
  for (let y = 12; y < H; y += 18) {
    g.beginPath();
    for (let x = 0; x <= W; x += 24) {
      const yy = y + Math.sin((x + seed * 10) * 0.05) * 3;
      if (x === 0) g.moveTo(x, yy);
      else g.lineTo(x, yy);
    }
    g.stroke();
  }
  const crater = (x: number, y: number, r: number) => {
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.beginPath();
    g.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(255,220,190,0.22)';
    g.lineWidth = 2;
    g.stroke();
  };
  const rocks = (n: number, color: string) => {
    for (let i = 0; i < n; i++) {
      const x = zoneRand(seed + 50 + i) * W;
      const y = zoneRand(seed + 80 + i * 2.3) * H;
      const r = 3 + zoneRand(seed + 20 + i) * 7;
      g.fillStyle = color;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  };
  switch (z.id) {
    case 'ICE_PLAINS':
      for (let i = 0; i < 26; i++) {
        g.fillStyle = 'rgba(224,242,254,0.16)';
        g.beginPath();
        g.ellipse(zoneRand(seed + i) * W, zoneRand(seed + i * 7) * H, 30, 14, 0, 0, Math.PI * 2);
        g.fill();
      }
      // polygonal frost cracks (patterned ground)
      g.strokeStyle = 'rgba(240,249,255,0.18)';
      for (let x = 0; x < W; x += 46) for (let y = 0; y < H; y += 40) g.strokeRect(x + (y % 80 ? 20 : 0), y, 46, 40);
      rocks(40, 'rgba(60,20,10,0.35)');
      break;
    case 'POLAR_CAP':
      g.fillStyle = 'rgba(241,245,249,0.75)';
      g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(148,163,184,0.45)';
      g.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        g.beginPath();
        const y0 = 30 + i * 55;
        g.moveTo(0, y0);
        for (let x = 0; x <= W; x += 40) g.lineTo(x, y0 + Math.sin(x * 0.02 + i) * 14);
        g.stroke();
      }
      break;
    case 'CRATER_FIELD':
      crater(150, 120, 70);
      crater(520, 330, 90);
      crater(640, 110, 40);
      crater(260, 380, 50);
      crater(420, 180, 28);
      rocks(50, 'rgba(50,16,8,0.4)');
      break;
    case 'VOLCANO':
      g.strokeStyle = 'rgba(234,88,12,0.25)';
      g.lineWidth = 10;
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.moveTo(W, 40 + i * 30);
        g.quadraticCurveTo(W * 0.5, 120 + i * 70, 0, 200 + i * 60);
        g.stroke();
      }
      rocks(90, 'rgba(20,12,10,0.6)');
      break;
    case 'LAVA_TUBES':
      g.strokeStyle = 'rgba(30,10,5,0.35)';
      g.lineWidth = 26;
      g.beginPath();
      g.moveTo(0, 170);
      g.quadraticCurveTo(300, 100, W, 260);
      g.stroke();
      rocks(60, 'rgba(30,10,5,0.45)');
      break;
    case 'RIVER_DELTA':
      // fan of old channels spreading south
      g.strokeStyle = 'rgba(148,163,184,0.28)';
      g.lineWidth = 8;
      for (let i = 0; i < 7; i++) {
        g.beginPath();
        g.moveTo(W / 2, 0);
        g.quadraticCurveTo(W / 2 + (i - 3) * 30, H * 0.4, W / 2 + (i - 3) * 110, H);
        g.stroke();
      }
      for (let y = 40; y < H; y += 32) {
        g.fillStyle = 'rgba(214,180,150,0.08)';
        g.fillRect(0, y, W, 8);
      }
      break;
    case 'DUST_BASIN':
      g.fillStyle = 'rgba(253,230,138,0.12)';
      for (let y = 0; y < H; y += 26) {
        g.beginPath();
        for (let x = 0; x <= W; x += 20) g.lineTo(x, y + Math.sin(x * 0.03 + y) * 8);
        g.lineTo(W, y + 14);
        g.lineTo(0, y + 14);
        g.fill();
      }
      break;
    case 'CARGO_ZONE':
      for (const [x, y] of [
        [200, 180],
        [560, 330],
      ]) {
        g.strokeStyle = 'rgba(253,224,71,0.5)';
        g.lineWidth = 4;
        g.beginPath();
        g.arc(x, y, 60, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = 'rgba(0,0,0,0.2)';
        g.beginPath();
        g.arc(x, y, 56, 0, Math.PI * 2);
        g.fill();
      }
      rocks(30, 'rgba(60,20,10,0.35)');
      break;
    default:
      break;
  }
  return c;
}

function getZoneCanvas(z: ZoneInfo): HTMLCanvasElement {
  let c = zoneCanvasCache.get(z.id);
  if (!c) {
    c = buildZoneCanvas(z);
    zoneCanvasCache.set(z.id, c);
  }
  return c;
}

function renderZones(ctx: CanvasRenderingContext2D, camX: number, camY: number, w: number, h: number) {
  for (const z of ZONES) {
    if (z.id === 'BASE') continue;
    const zx = z.col * ZONE_W;
    const zy = z.row * ZONE_H;
    if (zx > camX + w || zx + ZONE_W < camX || zy > camY + h || zy + ZONE_H < camY) continue;
    ctx.drawImage(getZoneCanvas(z), zx, zy, ZONE_W, ZONE_H);
  }
  // Zone borders + name signs
  ctx.save();
  ctx.setLineDash([14, 10]);
  ctx.strokeStyle = 'rgba(253, 230, 138, 0.25)';
  ctx.lineWidth = 2;
  for (const z of ZONES) {
    const zx = z.col * ZONE_W;
    const zy = z.row * ZONE_H;
    ctx.strokeRect(zx, zy, ZONE_W, ZONE_H);
  }
  ctx.setLineDash([]);
  ctx.font = '700 22px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  for (const z of ZONES) {
    if (z.id === 'BASE') continue;
    const cx = z.col * ZONE_W + ZONE_W / 2;
    const cy = z.row * ZONE_H + 70;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillText(z.name.toUpperCase(), cx + 2, cy + 2);
    ctx.fillStyle = z.roverOnly ? '#fca5a5' : '#fde68a';
    ctx.fillText(z.name.toUpperCase(), cx, cy);
    ctx.font = '600 13px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(z.blurb, cx, cy + 22);
    ctx.font = '700 22px "Chakra Petch", sans-serif';
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Hand-placed landmarks so each zone feels like a real place
// ---------------------------------------------------------------------------
function landmarkLabel(ctx: CanvasRenderingContext2D, x: number, y: number, text: string) {
  ctx.font = '700 12px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = '#fef3c7';
  ctx.fillText(text, x, y);
}

function drawLander(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(6, 30, 70, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  // solar wings (dusty)
  ctx.fillStyle = '#334155';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(sx * 58, 0, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(214, 140, 90, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // legs
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 4;
  for (const [lx, ly] of [[-26, 26], [26, 26], [0, -30]]) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(lx, ly);
    ctx.stroke();
  }
  // deck
  ctx.fillStyle = '#cbd5e1';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.lineTo(Math.cos(a) * 24, Math.sin(a) * 24);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(180, 90, 50, 0.35)';
  ctx.fill();
  ctx.restore();
}

function drawBoulder(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x + 14, y + r * 0.6, r * 1.1, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5b2414';
  ctx.beginPath();
  ctx.moveTo(x - r, y + r * 0.3);
  ctx.lineTo(x - r * 0.7, y - r * 0.6);
  ctx.lineTo(x - r * 0.1, y - r);
  ctx.lineTo(x + r * 0.8, y - r * 0.5);
  ctx.lineTo(x + r, y + r * 0.4);
  ctx.lineTo(x + r * 0.2, y + r * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 200, 160, 0.18)';
  ctx.beginPath();
  ctx.moveTo(x - r * 0.7, y - r * 0.6);
  ctx.lineTo(x - r * 0.1, y - r);
  ctx.lineTo(x + r * 0.3, y - r * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function renderLandmarks(ctx: CanvasRenderingContext2D, camX: number, camY: number, w: number, h: number) {
  const visible = (x: number, y: number, pad = 300) =>
    x > camX - pad && x < camX + w + pad && y > camY - pad && y < camY + h + pad;

  // Ice Plains: a lander from an earlier robotic mission, and frost-covered dunes
  if (visible(300, -860)) {
    drawLander(ctx, 300, -860);
    landmarkLabel(ctx, 300, -920, 'OLD ROBOTIC LANDER (2030s)');
  }
  if (visible(1250, -780)) {
    ctx.fillStyle = 'rgba(241, 245, 249, 0.22)';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(1150 + i * 50, -800 + i * 22, 90, 16, -0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    landmarkLabel(ctx, 1250, -860, 'FROSTED DUNES');
  }
  // Crater Field: a giant boulder and the cargo landing pad
  if (visible(2550, 150)) {
    drawBoulder(ctx, 2550, 150, 70);
    landmarkLabel(ctx, 2550, 60, 'GIANT BOULDER');
  }
  if (visible(2850, 820)) {
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.55)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(2850, 820, 130, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = '900 64px "Chakra Petch", sans-serif';
    ctx.fillStyle = 'rgba(253, 224, 71, 0.25)';
    ctx.textAlign = 'center';
    ctx.fillText('H', 2850, 842);
    landmarkLabel(ctx, 2850, 670, 'CARGO LANDING PAD');
  }
  // Lava Tube Caves: a collapsed skylight pit
  if (visible(-320, 220)) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.beginPath();
    ctx.ellipse(-320, 220, 70, 46, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3f1d12';
    ctx.lineWidth = 10;
    ctx.stroke();
    landmarkLabel(ctx, -320, 150, 'COLLAPSED SKYLIGHT (DO NOT ENTER)');
  }
  // Polar Ice Cap: layered ice cliffs
  if (visible(-1300, -700, 500)) {
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(226, 232, 240, 0.85)' : 'rgba(148, 163, 184, 0.75)';
      ctx.fillRect(-1550, -960 + i * 14, 500, 14);
    }
    landmarkLabel(ctx, -1300, -860, 'LAYERED ICE CLIFFS · LAYERS RECORD PAST CLIMATE');
  }
  // Volcano Slope: caldera rim and an old lava channel
  if (visible(2950, -860, 500)) {
    ctx.strokeStyle = 'rgba(30, 12, 8, 0.8)';
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.arc(3200, -1000, 330, Math.PI * 0.5, Math.PI);
    ctx.stroke();
    landmarkLabel(ctx, 2930, -720, 'CALDERA RIM');
  }
}

function renderCaves(ctx: CanvasRenderingContext2D) {
  for (const c of CAVE_SHELTERS) {
    ctx.save();
    ctx.fillStyle = 'rgba(10, 4, 2, 0.78)';
    ctx.beginPath();
    ctx.ellipse(c.x + c.w / 2, c.y + c.h / 2, c.w / 2, c.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3f1d12';
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.fillStyle = '#fde68a';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LAVA TUBE · RADIATION SHELTER', c.x + c.w / 2, c.y - 10);
    ctx.restore();
  }
}

const SITE_STYLE: Record<FieldSite['kind'], { color: string; tag: string }> = {
  SAMPLE: { color: '#fcd34d', tag: 'SAMPLE' },
  MINERAL: { color: '#f97316', tag: 'MINERAL' },
  METEORITE: { color: '#cbd5e1', tag: 'METEORITE' },
};

function renderFieldSite(ctx: CanvasRenderingContext2D, f: FieldSite, nowMs: number, near: boolean) {
  if (f.collected) return;
  const st = SITE_STYLE[f.kind];
  const bob = Math.sin(nowMs * 0.004 + f.id) * 2;
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(2, 8, 20, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = f.kind === 'METEORITE' ? '#52525b' : f.kind === 'MINERAL' ? '#292524' : '#a16207';
  ctx.beginPath();
  ctx.moveTo(-16, 6);
  ctx.lineTo(-10, -10);
  ctx.lineTo(4, -14);
  ctx.lineTo(16, -2);
  ctx.lineTo(12, 8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = st.color;
  ctx.lineWidth = 2;
  ctx.stroke();
  // beacon
  ctx.strokeStyle = st.color;
  ctx.globalAlpha = 0.5 + 0.3 * Math.sin(nowMs * 0.006 + f.id);
  ctx.beginPath();
  ctx.arc(0, -2, 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.font = '700 10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = st.color;
  ctx.fillText(`${st.tag}: ${f.label.toUpperCase()}`, 0, -34 + bob);
  if (near) {
    ctx.fillStyle = '#fde047';
    ctx.fillText('[E] COLLECT', 0, 30);
  }
  ctx.restore();
}

const ROLE_COLORS: Record<string, string> = {
  ENGINEER: '#f97316',
  GEOLOGIST: '#a16207',
  BOTANIST: '#16a34a',
  DOCTOR: '#dc2626',
};

function renderLabStation(ctx: CanvasRenderingContext2D, eng: EngineState, nowMs: number) {
  const { x, y } = LAB_STATION;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-46, -26, 96, 60);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(-48, -28, 96, 56);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.strokeRect(-48, -28, 96, 56);
  // microscope + spectrometer + sample rack
  ctx.fillStyle = '#334155';
  ctx.fillRect(-38, -18, 22, 30);
  ctx.fillStyle = '#0ea5e9';
  ctx.fillRect(-34, -14, 14, 10);
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(6, -2, 12, 0, Math.PI * 2);
  ctx.fill();
  const running = eng.labProgress !== null;
  ctx.fillStyle = running ? `rgba(52, 211, 153, ${0.6 + 0.4 * Math.sin(nowMs * 0.01)})` : '#64748b';
  ctx.beginPath();
  ctx.arc(6, -2, 6, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i < eng.sampleQueue.length ? '#fcd34d' : '#94a3b8';
    ctx.fillRect(24 + (i % 3) * 7, -16 + Math.floor(i / 3) * 16, 5, 12);
  }
  ctx.fillStyle = '#a7f3d0';
  ctx.font = '700 10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SAMPLE LAB', 0, -36);
  if (running && eng.labProgress !== null) {
    const pct = 1 - eng.labProgress / 8;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-40, 34, 80, 6);
    ctx.fillStyle = '#34d399';
    ctx.fillRect(-40, 34, 80 * Math.max(0, Math.min(1, pct)), 6);
  }
  const near = !eng.player.inEvaSuit && Math.hypot(eng.player.x - x, eng.player.y - y) < LAB_STATION_RADIUS;
  if (near && !running) {
    ctx.fillStyle = '#fde047';
    ctx.fillText(
      eng.sampleQueue.length > 0 ? `[E] ANALYZE (${eng.sampleQueue.length} WAITING)` : 'NO SAMPLES YET',
      0,
      52
    );
  }
  ctx.restore();
}

function renderFootprints(ctx: CanvasRenderingContext2D, eng: EngineState) {
  for (const f of eng.footprints) {
    const a = Math.min(1, f.life / 25) * 0.35;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.a);
    ctx.fillStyle = `rgba(60, 20, 8, ${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function renderTrail(ctx: CanvasRenderingContext2D, eng: EngineState) {
  for (const t of eng.trail) {
    ctx.fillStyle = `rgba(214, 140, 90, ${(Math.max(0, t.life / 1.2) * 0.35).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Warm light spilling from habitat windows onto the regolith at night.
function renderWindowGlow(ctx: CanvasRenderingContext2D, camX: number, camY: number, strength: number) {
  if (strength <= 0.05) return;
  const windows = [
    { x: 250, y: 120 },
    { x: 620, y: 120 },
    { x: 250, y: 880 },
    { x: 620, y: 880 },
    { x: 80, y: 300 },
    { x: 80, y: 700 },
    { x: 820, y: 250 },
    { x: 820, y: 760 },
  ];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const w of windows) {
    const sx = w.x - camX;
    const sy = w.y - camY;
    const g = ctx.createRadialGradient(sx, sy, 4, sx, sy, 120);
    g.addColorStop(0, `rgba(253, 186, 116, ${(0.35 * strength).toFixed(3)})`);
    g.addColorStop(1, 'rgba(253, 186, 116, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(sx - 120, sy - 120, 240, 240);
  }
  ctx.restore();
}

function renderSuitStation(ctx: CanvasRenderingContext2D, eng: EngineState, nowMs: number) {
  const { x, y } = SUIT_STATION;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-30, -34, 64, 74);
  ctx.fillStyle = '#334155';
  ctx.fillRect(-32, -36, 64, 72);
  ctx.strokeStyle = '#7dd3fc';
  ctx.lineWidth = 2;
  ctx.strokeRect(-32, -36, 64, 72);
  // hanging suit silhouette
  ctx.fillStyle = '#f1f5f9';
  ctx.beginPath();
  ctx.arc(0, -18, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-11, -9, 22, 26);
  ctx.fillRect(-17, -7, 6, 18);
  ctx.fillRect(11, -7, 6, 18);
  ctx.fillRect(-9, 17, 7, 14);
  ctx.fillRect(2, 17, 7, 14);
  ctx.fillStyle = '#0ea5e9';
  ctx.beginPath();
  ctx.arc(0, -18, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7dd3fc';
  ctx.font = '700 10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SUIT STATION', 0, -44);
  const near =
    !eng.player.inEvaSuit && Math.hypot(eng.player.x - x, eng.player.y - y) < SUIT_STATION_RADIUS;
  if (near) {
    ctx.fillStyle = '#fde047';
    ctx.fillText(`[E] REPAIR SUIT (${Math.round(eng.suit)}%)`, 0, 52);
  } else if (eng.suit < 50) {
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(nowMs * 0.008);
    ctx.fillStyle = '#f87171';
    ctx.fillText(`SUIT ${Math.round(eng.suit)}%`, 0, 52);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// Mission guidance: an arrow around the player pointing at the objective.
function renderMissionArrow(
  ctx: CanvasRenderingContext2D,
  eng: EngineState,
  camX: number,
  camY: number,
  width: number,
  height: number,
  nowMs: number
) {
  const t = eng.missionTarget;
  if (!t) return;
  const px = eng.player.x - camX;
  const py = eng.player.y - camY;
  const tx = t.x - camX;
  const ty = t.y - camY;
  const dist = Math.hypot(t.x - eng.player.x, t.y - eng.player.y);
  const onScreen = tx > 40 && tx < width - 40 && ty > 40 && ty < height - 40;
  ctx.save();
  // Bouncing marker over the target when it's visible
  if (onScreen) {
    const bob = Math.sin(nowMs * 0.008) * 6;
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#422006';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx, ty - 34 + bob);
    ctx.lineTo(tx - 11, ty - 52 + bob);
    ctx.lineTo(tx + 11, ty - 52 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.7)';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(tx, ty, 30 + Math.sin(nowMs * 0.006) * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // Arrow orbiting the player whenever the target is not right here
  if (dist > 70) {
    const ang = Math.atan2(ty - py, tx - px);
    const r = eng.player.inRover ? 70 : 54;
    const ax = px + Math.cos(ang) * r;
    const ay = py + Math.sin(ang) * r;
    ctx.translate(ax, ay);
    ctx.rotate(ang);
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#422006';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-8, -11);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-8, 11);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.rotate(-ang);
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000';
    ctx.fillText(`${Math.round(dist / 10)} m`, 1, 25);
    ctx.fillStyle = '#fde047';
    ctx.fillText(`${Math.round(dist / 10)} m`, 0, 24);
  }
  ctx.restore();
}

function renderMinimap(ctx: CanvasRenderingContext2D, eng: EngineState, width: number, height: number) {
  const cw = 54;
  const ch = 34;
  const pad = 12;
  const mw = cw * 3;
  const mh = ch * 2;
  const x0 = width - mw - pad;
  const y0 = height - mh - pad - 18;
  ctx.save();
  ctx.fillStyle = 'rgba(22, 13, 11, 0.88)';
  ctx.fillRect(x0 - 6, y0 - 20, mw + 12, mh + 26);
  ctx.strokeStyle = '#54291c';
  ctx.strokeRect(x0 - 6, y0 - 20, mw + 12, mh + 26);
  ctx.fillStyle = '#fcd34d';
  ctx.font = '700 10px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  const here = getZoneAt(eng.player.x, eng.player.y);
  ctx.fillText(here.name.toUpperCase().slice(0, 26), x0, y0 - 7);
  for (const z of ZONES) {
    const zx = x0 + (z.col + 1) * cw;
    const zy = y0 + (z.row + 1) * ch;
    const known = eng.discoveredZones.includes(z.id);
    ctx.fillStyle = known ? z.tint : '#1c1917';
    ctx.fillRect(zx + 1, zy + 1, cw - 2, ch - 2);
    ctx.strokeStyle = z.roverOnly ? 'rgba(252,165,165,0.6)' : 'rgba(253,230,138,0.35)';
    ctx.strokeRect(zx + 1, zy + 1, cw - 2, ch - 2);
    if (!known) {
      ctx.fillStyle = '#78716c';
      ctx.textAlign = 'center';
      ctx.fillText('?', zx + cw / 2, zy + ch / 2 + 4);
    }
  }
  const toMini = (wx: number, wy: number) => ({
    x: x0 + ((wx - WORLD.minX) / (WORLD.maxX - WORLD.minX)) * mw,
    y: y0 + ((wy - WORLD.minY) / (WORLD.maxY - WORLD.minY)) * mh,
  });
  // Known ice + uncollected sites
  for (const d of eng.iceDeposits) {
    if (d.scanLevel === 0 || d.amountKg <= 0) continue;
    const m = toMini(d.x, d.y);
    ctx.fillStyle = '#7dd3fc';
    ctx.fillRect(m.x - 1.5, m.y - 1.5, 3, 3);
  }
  for (const f of eng.fieldSites) {
    if (f.collected || !eng.discoveredZones.includes(getZoneAt(f.x, f.y).id)) continue;
    const m = toMini(f.x, f.y);
    ctx.fillStyle = SITE_STYLE[f.kind].color;
    ctx.fillRect(m.x - 1.5, m.y - 1.5, 3, 3);
  }
  if (eng.missionTarget) {
    const mt = toMini(eng.missionTarget.x, eng.missionTarget.y);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mt.x, mt.y, 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Habitat, rover, player
  const hab = toMini(450, 500);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(hab.x - 3, hab.y - 3, 6, 6);
  if (!eng.player.inRover) {
    const r = toMini(eng.rover.x, eng.rover.y);
    ctx.fillStyle = '#f97316';
    ctx.fillRect(r.x - 2.5, r.y - 2, 5, 4);
  }
  const p = toMini(eng.player.x, eng.player.y);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

const ICE_COLORS: Record<IceDeposit['quality'], string> = {
  PURE: '#bae6fd',
  DIRTY: '#a8a29e',
  PERCHLORATE: '#bef264',
};

function renderIceDeposit(
  ctx: CanvasRenderingContext2D,
  d: IceDeposit,
  nowMs: number,
  drilling: boolean,
  near: boolean
) {
  if (d.scanLevel === 0) return;
  ctx.save();
  ctx.translate(d.x, d.y);
  const depleted = d.amountKg <= 0;

  if (d.scanLevel === 1) {
    // Unconfirmed radar echo: pulsing dashed ring
    const pulse = 1 + Math.sin(nowMs * 0.004 + d.id) * 0.12;
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.85)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, d.r * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(125, 211, 252, 0.12)';
    ctx.fill();
    ctx.fillStyle = '#e0f2fe';
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('RADAR ECHO ?', 0, -d.r - 8);
    if (near) ctx.fillText('[E] CORE SAMPLE', 0, d.r + 16);
    ctx.restore();
    return;
  }

  // Core-sampled deposit: ice patch sized by remaining kg
  const frac = d.maxKg > 0 ? d.amountKg / d.maxKg : 0;
  const r = Math.max(8, d.r * (0.45 + 0.55 * frac));
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(2, 4, r + 4, (r + 4) * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = depleted ? 0.35 : 0.9;
  ctx.fillStyle = ICE_COLORS[d.quality];
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = d.depth === 'DEEP' ? '#0ea5e9' : '#e0f2fe';
  ctx.lineWidth = d.depth === 'DEEP' ? 3 : 1.5;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Drill rig / Rodwell derrick
  if (d.rigInstalled || drilling) {
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, 6);
    ctx.lineTo(0, -26);
    ctx.lineTo(10, 6);
    ctx.moveTo(-6, -8);
    ctx.lineTo(6, -8);
    ctx.stroke();
    ctx.fillStyle = '#f97316';
    ctx.fillRect(-3, -30, 6, 6);
  }
  if (drilling) {
    for (let i = 0; i < 6; i++) {
      const a = (nowMs * 0.006 + i * 1.05) % (Math.PI * 2);
      const rr = 6 + ((nowMs * 0.03 + i * 9) % 18);
      ctx.fillStyle = 'rgba(224, 242, 254, 0.7)';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr * 0.6 - 4, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.font = '700 10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#090d16';
  const label = depleted
    ? `ICE #${d.id} EXHAUSTED`
    : `ICE #${d.id} · ${Math.round(d.amountKg)}kg · ${d.depth}`;
  ctx.fillText(label, 1, -r - 11);
  ctx.fillStyle = depleted ? '#94a3b8' : ICE_COLORS[d.quality];
  ctx.fillText(label, 0, -r - 12);
  if (near && !depleted) {
    ctx.fillStyle = '#fde047';
    ctx.fillText(
      drilling
        ? '[E] PAUSE DRILL'
        : d.depth === 'DEEP' && !d.rigInstalled
        ? '[E] INSTALL RIG (1 PART)'
        : '[E] DRILL',
      0,
      r + 18
    );
  }
  ctx.restore();
}

let cachedStaticCanvas: HTMLCanvasElement | null = null;

function pseudoRand(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function drawRockCluster(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number
) {
  // Base deep rust shadow
  ctx.fillStyle = '#471209';
  ctx.beginPath();
  ctx.ellipse(cx + 3, cy + 4, rx * 1.05, ry * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mid crimson-ochre rock facets
  const lobes = 5;
  for (let i = 0; i < lobes; i++) {
    const ang = (i / lobes) * Math.PI * 2 + pseudoRand(seed + i) * 0.6;
    const ox = Math.cos(ang) * rx * 0.42;
    const oy = Math.sin(ang) * ry * 0.38;
    const r = Math.min(rx, ry) * (0.48 + pseudoRand(seed + i * 7) * 0.25);

    ctx.fillStyle = i % 2 === 0 ? '#7d2411' : '#963118';
    ctx.beginPath();
    ctx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ba4821';
    ctx.beginPath();
    ctx.arc(cx + ox - r * 0.18, cy + oy - r * 0.2, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCrater(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  ctx.save();
  // Outer raised dust rim
  ctx.fillStyle = '#b94b25';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 1.12, ry * 1.12, 0.12, 0, Math.PI * 2);
  ctx.fill();

  // Shaded crater bowl
  const grad = ctx.createRadialGradient(cx + rx * 0.15, cy + ry * 0.15, rx * 0.15, cx, cy, rx);
  grad.addColorStop(0, '#5a190d');
  grad.addColorStop(0.65, '#732312');
  grad.addColorStop(1, '#3f1008');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0.12, 0, Math.PI * 2);
  ctx.fill();

  // Rim highlight on bottom-right
  ctx.strokeStyle = 'rgba(234, 127, 74, 0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 1.02, ry * 1.02, 0.12, 0.1, Math.PI * 0.9);
  ctx.stroke();
  ctx.restore();
}

function drawWhiteSiloTank(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  accentColor?: string
) {
  // Heavy dark mounting pad
  ctx.fillStyle = '#18181b';
  ctx.fillRect(x + 2, y + h - 18, w - 4, 18);
  ctx.strokeStyle = '#3f3f46';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 2, y + h - 18, w - 4, 18);

  // Cylindrical shaded white/silver tank body
  const bodyGrad = ctx.createLinearGradient(x + 6, 0, x + w - 6, 0);
  bodyGrad.addColorStop(0, '#94a3b8');
  bodyGrad.addColorStop(0.32, '#f1f5f9');
  bodyGrad.addColorStop(0.65, '#e2e8f0');
  bodyGrad.addColorStop(1, '#64748b');

  ctx.fillStyle = bodyGrad;
  ctx.fillRect(x + 7, y + 14, w - 14, h - 26);

  // Domed top cap
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + 14, (w - 14) / 2, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 7, y + 14, w - 14, h - 26);

  // Top rim highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + 14, (w - 14) / 2 - 2, 9, 0, Math.PI, Math.PI * 2);
  ctx.stroke();

  // Hazard triangle decal
  const triX = x + 16;
  const triY = y + h - 32;
  ctx.fillStyle = accentColor || '#f97316';
  ctx.beginPath();
  ctx.moveTo(triX, triY - 7);
  ctx.lineTo(triX - 6, triY + 4);
  ctx.lineTo(triX + 6, triY + 4);
  ctx.closePath();
  ctx.fill();
}

function drawCommDish(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  // Pedestal base
  ctx.fillStyle = '#334155';
  ctx.fillRect(cx - 14, cy + r * 0.45, 28, 20);
  ctx.fillStyle = '#64748b';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.72, 22, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Parabolic white dish
  const grad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.2, 4, cx, cy, r);
  grad.addColorStop(0, '#f8fafc');
  grad.addColorStop(0.65, '#cbd5e1');
  grad.addColorStop(1, '#64748b');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.92, r, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Feed horn arm
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.45, cy + r * 0.3);
  ctx.lineTo(cx + 4, cy - 4);
  ctx.stroke();
  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.arc(cx + 4, cy - 4, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMarsRover(ctx: CanvasRenderingContext2D, x: number, y: number, angle = Math.PI) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI);

  // Shadow
  ctx.fillStyle = 'rgba(40, 10, 4, 0.45)';
  ctx.fillRect(-46, -24, 96, 56);

  // 6 rugged Mars wheels
  ctx.fillStyle = '#18181b';
  ctx.strokeStyle = '#52525b';
  ctx.lineWidth = 1.5;
  for (const wx of [-34, 0, 34]) {
    ctx.fillRect(wx - 10, -28, 20, 9);
    ctx.strokeRect(wx - 10, -28, 20, 9);
    ctx.fillRect(wx - 10, 20, 20, 9);
    ctx.strokeRect(wx - 10, 20, 20, 9);
  }

  // Orange-rust chassis (KR Mars Rover palette)
  ctx.fillStyle = '#c2410c';
  ctx.fillRect(-42, -20, 84, 40);
  ctx.strokeStyle = '#431407';
  ctx.lineWidth = 2;
  ctx.strokeRect(-42, -20, 84, 40);

  // Silver equipment deck + solar top
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(-16, -15, 48, 30);
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(-12, -12, 34, 24);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.strokeRect(-12, -12, 34, 24);

  // Pressurized blue cockpit dome on left front
  ctx.fillStyle = '#0284c7';
  ctx.beginPath();
  ctx.arc(-28, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

function buildStaticWorldCanvas(): HTMLCanvasElement {
  const off = document.createElement('canvas');
  off.width = MAP_WIDTH;
  off.height = MAP_HEIGHT;
  const ctx = off.getContext('2d');
  if (!ctx) return off;

  // 1. Warm Red-Orange Martian Regolith Base
  ctx.fillStyle = '#9a3418';
  ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

  // Sculpted sand-dune ripples across 48x48 tiles (KR Mars Tileset signature look)
  const tile = 48;
  for (let ty = 0; ty < MAP_HEIGHT; ty += tile) {
    for (let tx = 0; tx < MAP_WIDTH; tx += tile) {
      const n = pseudoRand(tx * 0.13 + ty * 0.37);
      // Warm reddish-orange tone variation per tile
      if (n > 0.65) {
        ctx.fillStyle = 'rgba(186, 72, 34, 0.25)';
        ctx.fillRect(tx, ty, tile, tile);
      } else if (n < 0.3) {
        ctx.fillStyle = 'rgba(118, 36, 16, 0.22)';
        ctx.fillRect(tx, ty, tile, tile);
      }

      // Wavy wind-carved sand ridges
      ctx.strokeStyle = 'rgba(218, 102, 56, 0.34)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tx, ty + 14);
      ctx.quadraticCurveTo(tx + 12, ty + 8, tx + 24, ty + 15);
      ctx.quadraticCurveTo(tx + 36, ty + 21, tx + 48, ty + 14);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(104, 29, 13, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tx, ty + 34);
      ctx.quadraticCurveTo(tx + 14, ty + 40, tx + 28, ty + 33);
      ctx.quadraticCurveTo(tx + 40, ty + 28, tx + 48, ty + 34);
      ctx.stroke();
    }
  }

  // 2. Winding Lighter Dusty EVA Footpaths in Outdoor Jezero Yard
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Soft border
  ctx.strokeStyle = '#b9552d';
  ctx.lineWidth = 58;
  ctx.beginPath();
  ctx.moveTo(930, 500);
  ctx.quadraticCurveTo(1010, 495, 1030, 340);
  ctx.lineTo(1085, 280);
  ctx.moveTo(990, 495);
  ctx.quadraticCurveTo(1020, 620, 1085, 710);
  ctx.moveTo(930, 500);
  ctx.lineTo(1350, 500);
  ctx.stroke();

  // Inner pale terracotta trail
  ctx.strokeStyle = '#d47448';
  ctx.lineWidth = 38;
  ctx.stroke();
  ctx.restore();

  // 3. Impact Craters & Geological Rock Ridges (Outdoor Yard)
  drawCrater(ctx, 1435, 260, 68, 46);
  drawCrater(ctx, 1460, 865, 55, 38);
  drawCrater(ctx, 1180, 895, 36, 26);

  // Rocky ridge outcrops framing the outdoor yard edges
  drawRockCluster(ctx, 970, 175, 26, 20, 42);
  drawRockCluster(ctx, 1340, 360, 22, 16, 77);
  drawRockCluster(ctx, 960, 830, 28, 22, 91);

  // 4. Static KR Mars Yard Details (Comm Dishes, Supply Rack, Parked Rover, Surface Conduits)
  // Conduit wiring from ROSA/KRUSTY to Comm Array
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(1245, 700);
  ctx.lineTo(1365, 700);
  ctx.lineTo(1365, 165);
  ctx.lineTo(1435, 165);
  ctx.stroke();

  drawCommDish(ctx, 1405, 115, 36);
  drawCommDish(ctx, 1500, 125, 36);

  // Twin yellow laser boundary pylons along EVA path (kr_mars_3 detail)
  for (const py of [458, 542]) {
    ctx.fillStyle = '#475569';
    ctx.fillRect(962, py - 5, 8, 10);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(964, py - 14, 4, 12);
  }

  // 5. Indoor Pressurized Habitat Deck (kr_mars_2 dark speckled metal floor)
  ctx.fillStyle = '#1b1f27';
  ctx.fillRect(HAB_BOUNDS.x, HAB_BOUNDS.y, HAB_BOUNDS.w, HAB_BOUNDS.h);

  // Speckled metallic 40x40 floor tiles
  for (let gy = HAB_BOUNDS.y; gy < HAB_BOUNDS.y + HAB_BOUNDS.h; gy += 40) {
    for (let gx = HAB_BOUNDS.x; gx < HAB_BOUNDS.x + HAB_BOUNDS.w; gx += 40) {
      const speckle = pseudoRand(gx * 0.21 + gy * 0.53);
      ctx.fillStyle = speckle > 0.5 ? '#232832' : '#1d222b';
      ctx.fillRect(gx + 1, gy + 1, 38, 38);
      ctx.strokeStyle = '#12151c';
      ctx.lineWidth = 1;
      ctx.strokeRect(gx, gy, 40, 40);
    }
  }

  // Light silver interior corridor floor runners (kr_mars_2 corridor style)
  ctx.fillStyle = '#475569';
  ctx.fillRect(465, 455, 345, 90);
  ctx.fillStyle = '#64748b';
  ctx.fillRect(465, 463, 345, 74);

  // Central Hub Emblem on floor
  ctx.fillStyle = '#272d38';
  ctx.beginPath();
  ctx.arc(520, 500, 56, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '700 10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('120V DC BUS', 520, 504);

  // Indoor decorative crew workstations tucked cleanly along north/south wall alcoves (non-blocking)
  for (const deskY of [162, 810]) {
    // White lab console counter
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(510, deskY, 210, 26);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(510, deskY, 210, 26);
    // Blue telemetry screens
    for (const mx of [532, 598, 664]) {
      ctx.fillStyle = '#0ea5e9';
      ctx.fillRect(mx, deskY + 6, 26, 12);
    }
    // Orange ergonomic chairs (kr_mars_2 signature detail!)
    ctx.fillStyle = '#ea580c';
    for (const cx of [545, 611, 677]) {
      const chairY = deskY < 300 ? deskY + 34 : deskY - 12;
      ctx.beginPath();
      ctx.arc(cx, chairY, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 6. Central EVA Airlock Structure (kr_mars_3 white tunnel + grated porch + hazard stripes)
  // Grated porch extending east
  ctx.fillStyle = '#334155';
  ctx.fillRect(AIRLOCK_BOUNDS.x + 10, AIRLOCK_BOUNDS.y + 8, AIRLOCK_BOUNDS.w + 18, AIRLOCK_BOUNDS.h - 16);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.strokeRect(AIRLOCK_BOUNDS.x + 10, AIRLOCK_BOUNDS.y + 8, AIRLOCK_BOUNDS.w + 18, AIRLOCK_BOUNDS.h - 16);
  // Grate lines
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.65)';
  ctx.lineWidth = 1;
  for (let gx = AIRLOCK_BOUNDS.x + 18; gx < AIRLOCK_BOUNDS.x + AIRLOCK_BOUNDS.w + 22; gx += 8) {
    ctx.beginPath();
    ctx.moveTo(gx, AIRLOCK_BOUNDS.y + 12);
    ctx.lineTo(gx, AIRLOCK_BOUNDS.y + AIRLOCK_BOUNDS.h - 12);
    ctx.stroke();
  }

  // Yellow/Black Caution Stripe Trim on Airlock Threshold
  for (let sy = AIRLOCK_BOUNDS.y + 12; sy < AIRLOCK_BOUNDS.y + AIRLOCK_BOUNDS.h - 16; sy += 12) {
    ctx.fillStyle = (sy / 12) % 2 === 0 ? '#facc15' : '#18181b';
    ctx.fillRect(AIRLOCK_BOUNDS.x + AIRLOCK_BOUNDS.w + 20, sy, 8, 12);
  }

  // White/Silver Airlock Chamber Shell
  const lockGrad = ctx.createLinearGradient(0, AIRLOCK_BOUNDS.y, 0, AIRLOCK_BOUNDS.y + AIRLOCK_BOUNDS.h);
  lockGrad.addColorStop(0, '#cbd5e1');
  lockGrad.addColorStop(0.5, '#f8fafc');
  lockGrad.addColorStop(1, '#94a3b8');
  ctx.fillStyle = lockGrad;
  ctx.fillRect(AIRLOCK_BOUNDS.x, AIRLOCK_BOUNDS.y + 10, AIRLOCK_BOUNDS.w - 10, AIRLOCK_BOUNDS.h - 20);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.strokeRect(AIRLOCK_BOUNDS.x, AIRLOCK_BOUNDS.y + 10, AIRLOCK_BOUNDS.w - 10, AIRLOCK_BOUNDS.h - 20);

  // Dark inner doorway floor inside airlock
  ctx.fillStyle = '#272c35';
  ctx.fillRect(AIRLOCK_BOUNDS.x + 12, AIRLOCK_BOUNDS.y + 24, AIRLOCK_BOUNDS.w - 30, AIRLOCK_BOUNDS.h - 48);

  // 7. Clean White/Silver Metallic Habitat Walls (matching WALLS collision rects)
  for (const w of WALLS) {
    // Skip outer invisible world boundary walls on outdoor map (we already drew rocky cliffs there!)

    // Silver-white metallic bulkhead wall
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(w.x, w.y, w.w, w.h);

    // Crisp bright top bevel
    ctx.fillStyle = '#f1f5f9';
    if (w.w > w.h) {
      ctx.fillRect(w.x, w.y, w.w, Math.max(4, w.h * 0.45));
    } else {
      ctx.fillRect(w.x, w.y, Math.max(4, w.w * 0.45), w.h);
    }

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(w.x, w.y, w.w, w.h);
  }

  // Zone Header Titles etched onto Habitat / Regolith floor
  ctx.fillStyle = 'rgba(226, 232, 240, 0.5)';
  ctx.font = '700 13px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PRESSURIZED CHAPEA HABITAT · 21.3 kPa O2', 450, 152);

  ctx.fillStyle = 'rgba(255, 237, 213, 0.72)';
  ctx.fillText('JEZERO REGOLITH YARD · 6.1 mbar CO2 (xEMU EVA SUIT)', 1220, 108);

  return off;
}

function getStaticWorldCanvas(): HTMLCanvasElement {
  if (!cachedStaticCanvas) {
    cachedStaticCanvas = buildStaticWorldCanvas();
  }
  return cachedStaticCanvas;
}

function renderModuleSprite(ctx: CanvasRenderingContext2D, m: ModuleState, nowMs: number) {
  const needsAttention = m.health < 78;
  const pulse = 0.5 + 0.5 * Math.sin(nowMs * 0.006);

  // Subtle selection / alert ring
  if (needsAttention || m.mode === 'OVERDRIVE') {
    ctx.save();
    ctx.strokeStyle = needsAttention
      ? `rgba(251, 146, 60, ${0.45 + pulse * 0.4})`
      : `rgba(56, 189, 248, ${0.3 + pulse * 0.35})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(m.x + m.w / 2, m.y + m.h / 2, m.w * 0.58 + pulse * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Base metallic equipment pad
  ctx.fillStyle = m.zone === 'INDOOR' ? '#1e2430' : '#291713';
  ctx.fillRect(m.x, m.y, m.w, m.h);
  ctx.strokeStyle = needsAttention ? '#f59e0b' : '#94a3b8';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(m.x, m.y, m.w, m.h);

  // Draw authentic KR Mars hardware sprites per module type
  if (m.id === 'food') {
    // APH / Veggie Hydroponics Pump & Grow-Light Controller (beds sit right beside it!)
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(m.x + 6, m.y + 6, m.w - 12, m.h - 12);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(m.x + 12, m.y + 12, m.w - 24, m.h - 24);

    // Dual greywater recycling & nutrient tanks
    for (let tx = 0; tx < 2; tx++) {
      const bx = m.x + 18 + tx * 38;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(bx, m.y + 18, 30, 54);
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(bx + 3, m.y + 24, 24, 42);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(bx + 6, m.y + 26, 7, 38);
    }

    // PAR LED grow-lamp status strip
    ctx.fillStyle =
      m.mode === 'ECO' ? '#475569' : m.mode === 'OVERDRIVE' ? '#e879f9' : '#4ade80';
    ctx.fillRect(m.x + 18, m.y + 82, m.w - 36, 12);
    ctx.fillStyle = '#0f172a';
    ctx.font = '700 8px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LIGHTS/PUMP', m.x + m.w / 2, m.y + 91);
  } else if (m.id === 'shield') {
    // RAD Water-Wall & Mag-Shield: Dipole Core + Blue Water-Wall Tank Racks
    ctx.fillStyle = '#272e3a';
    ctx.fillRect(m.x + 8, m.y + 8, m.w - 16, m.h - 16);

    // Blue water-wall cylinder rack on left (kr_mars_1 blue tanks)
    ctx.fillStyle = '#334155';
    ctx.fillRect(m.x + 14, m.y + 18, 42, 92);
    for (let ty = 0; ty < 3; ty++) {
      for (let tx = 0; tx < 2; tx++) {
        ctx.fillStyle = '#0891b2';
        ctx.fillRect(m.x + 18 + tx * 18, m.y + 24 + ty * 28, 14, 22);
        ctx.fillStyle = '#67e8f9';
        ctx.fillRect(m.x + 21 + tx * 18, m.y + 26 + ty * 28, 4, 18);
      }
    }

    // Central Mag-Dipole Coil Console on right
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(m.x + 104, m.y + 64, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = m.mode === 'OVERDRIVE' ? '#6366f1' : '#4f46e5';
    ctx.beginPath();
    ctx.arc(m.x + 104, m.y + 64, 16 + (m.mode === 'OVERDRIVE' ? pulse * 3 : 0), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c7d2fe';
    ctx.beginPath();
    ctx.arc(m.x + 104, m.y + 64, 7, 0, Math.PI * 2);
    ctx.fill();
  } else if (m.id === 'o2') {
    // MOXIE O2 ISRU: White Silo Tank + 6 Cyan O2 Pressure Cylinders (kr_mars_1 & kr_mars_3)
    drawWhiteSiloTank(ctx, m.x + 8, m.y + 10, 74, 114, '#f97316');

    // Steel cage of O2 cylinders on right
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(m.x + 90, m.y + 18, 64, 96);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.strokeRect(m.x + 90, m.y + 18, 64, 96);
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(m.x + 96 + c * 18, m.y + 26 + r * 42, 13, 34);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(m.x + 99 + c * 18, m.y + 28 + r * 42, 4, 30);
      }
    }

    // 800C SOXE heat vent glow
    if (m.mode !== 'ECO') {
      ctx.fillStyle = m.mode === 'OVERDRIVE' ? '#fb923c' : '#22d3ee';
      ctx.beginPath();
      ctx.arc(m.x + 45, m.y + 24, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (m.id === 'power') {
    // ROSA Solar + KRUSTY 10kWe: White KRUSTY Silo on left + 2x4 Navy Solar Panels on right!
    drawWhiteSiloTank(ctx, m.x + 6, m.y + 12, 66, 110, '#facc15');
    if (m.mode === 'OVERDRIVE') {
      ctx.fillStyle = `rgba(56, 189, 248, ${0.4 + pulse * 0.45})`;
      ctx.beginPath();
      ctx.arc(m.x + 39, m.y + 26, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2x4 ROSA Solar Array Panels (kr_mars_1 top-center solar panels)
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 4; col++) {
        const px = m.x + 78 + col * 20;
        const py = m.y + 18 + row * 50;
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(px, py, 17, 42);
        ctx.fillStyle = '#0f2952';
        ctx.fillRect(px + 2, py + 2, 13, 38);
        // Cell divider lines
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px + 2, py + 15);
        ctx.lineTo(px + 15, py + 15);
        ctx.moveTo(px + 2, py + 28);
        ctx.lineTo(px + 15, py + 28);
        ctx.stroke();

        // Visible Martian dust overlay if panel efficiency dropped
        if (m.health < 85) {
          ctx.fillStyle = `rgba(180, 83, 39, ${Math.min(0.75, (100 - m.health) / 90)})`;
          ctx.fillRect(px + 2, py + 2, 13, 38);
        }
      }
    }
  }

  // Label banner above module
  ctx.fillStyle = 'rgba(12, 17, 29, 0.88)';
  ctx.fillRect(m.x + 4, m.y - 24, m.w - 8, 20);
  ctx.strokeStyle = needsAttention ? '#f59e0b' : m.color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(m.x + 4, m.y - 24, m.w - 8, 20);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 11px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    `${m.shortLabel} · [${m.hotkey}] ${m.mode === 'OVERDRIVE' ? 'MAX' : m.mode}`,
    m.x + m.w / 2,
    m.y - 10
  );

  // Efficiency Bar below Module
  ctx.fillStyle = '#090d16';
  ctx.fillRect(m.x, m.y + m.h + 6, m.w, 8);
  ctx.fillStyle = m.health < 45 ? '#ef4444' : m.health < 78 ? '#f59e0b' : '#10b981';
  ctx.fillRect(m.x, m.y + m.h + 6, m.w * (m.health / 100), 8);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1;
  ctx.strokeRect(m.x, m.y + m.h + 6, m.w, 8);

  ctx.fillStyle = needsAttention ? '#fcd34d' : '#cbd5e1';
  ctx.font = '700 10px "JetBrains Mono", monospace';
  ctx.fillText(`${Math.round(m.health)}% EFF`, m.x + m.w / 2, m.y + m.h + 25);

  // 10-Second Asteroid Invulnerability Dome
  if (m.invulnerableTimer > 0) {
    ctx.save();
    ctx.strokeStyle = `rgba(34, 211, 238, ${0.55 + pulse * 0.35})`;
    ctx.fillStyle = 'rgba(34, 211, 238, 0.09)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(m.x + m.w / 2, m.y + m.h / 2, m.w * 0.64, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#67e8f9';
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.fillText(`SHIELDED ${m.invulnerableTimer.toFixed(1)}s`, m.x + m.w / 2, m.y + m.h + 39);
    ctx.restore();
  }
}

function renderPlantBed3D(
  ctx: CanvasRenderingContext2D,
  bed: PlantBed,
  eng: EngineState,
  nowMs: number,
  isNearby: boolean
) {
  const pulse = 0.5 + 0.5 * Math.sin(nowMs * 0.006);
  const foodMod = eng.modules.find((m) => m.id === 'food');
  const lightsOn = Boolean(foodMod && foodMod.mode !== 'ECO' && eng.resources.power > 0);
  const needsWash =
    bed.stage !== 'EMPTY' &&
    bed.stage !== 'WILTED' &&
    bed.medium === 'MARS_SOIL' &&
    !bed.perchlorateWashed;

  ctx.save();

  // Drop shadow for 3D raised planter depth
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(bed.x + 4, bed.y + 6, bed.w, bed.h + 6);

  // 3D front planter wall (depth extrusion)
  ctx.fillStyle = isNearby ? '#f59e0b' : '#64748b';
  ctx.fillRect(bed.x, bed.y + bed.h - 10, bed.w, 16);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bed.x, bed.y + bed.h - 10, bed.w, 16);

  // Planter outer metallic rim
  ctx.fillStyle = isNearby ? '#fef3c7' : '#cbd5e1';
  ctx.fillRect(bed.x, bed.y, bed.w, bed.h - 6);
  ctx.strokeStyle = isNearby ? '#f59e0b' : '#334155';
  ctx.lineWidth = isNearby ? 2.5 : 1.5;
  ctx.strokeRect(bed.x, bed.y, bed.w, bed.h - 6);

  // Inner growing medium tray (Water-only hydroponic tray vs Rusty Martian Soil)
  const innerX = bed.x + 6;
  const innerY = bed.y + 6;
  const innerW = bed.w - 12;
  const innerH = bed.h - 18;

  if (bed.medium === 'MARS_SOIL') {
    ctx.fillStyle = needsWash ? '#7c2d12' : '#5c2d18';
    ctx.fillRect(innerX, innerY, innerW, innerH);
    // Unwashed perchlorate crystal flecks
    if (needsWash) {
      ctx.fillStyle = `rgba(250, 204, 21, ${0.5 + pulse * 0.4})`;
      for (const [dx, dy] of [
        [10, 10],
        [28, 16],
        [46, 12],
        [18, 30],
        [52, 32],
      ]) {
        ctx.fillRect(innerX + dx, innerY + dy, 3, 3);
      }
    }
  } else {
    ctx.fillStyle = eng.pipesFrozen ? '#164e63' : '#0c4a6e';
    ctx.fillRect(innerX, innerY, innerW, innerH);
    // Subtle water sheen
    ctx.fillStyle = eng.pipesFrozen
      ? 'rgba(186, 230, 253, 0.35)'
      : 'rgba(56, 189, 248, 0.25)';
    ctx.fillRect(innerX + 3, innerY + 3, innerW - 6, 8);
  }

  // 3D-Perspective Crop Plants in 3 slots along the bed
  const slotsX = [bed.x + 20, bed.x + bed.w / 2, bed.x + bed.w - 20];
  const baseY = bed.y + bed.h - 20;

  if (bed.stage !== 'EMPTY') {
    for (let idx = 0; idx < slotsX.length; idx++) {
      const px = slotsX[idx];
      const py = baseY - (idx % 2) * 8;

      if (bed.stage === 'SPROUT') {
        // 3D baby stem rising upward + twin cotyledon leaves
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, py - 11);
        ctx.stroke();

        ctx.fillStyle = '#86efac';
        ctx.beginPath();
        ctx.ellipse(px - 4, py - 11, 4.5, 2.5, -0.4, 0, Math.PI * 2);
        ctx.ellipse(px + 4, py - 11, 4.5, 2.5, 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (bed.stage === 'LEAFY') {
        // Taller 3D stem + layered dark/bright foliage canopy
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(px + 2, py + 2, 10, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#15803d';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, py - 20);
        ctx.stroke();

        // Lower tier leaves
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.arc(px - 6, py - 12, 6, 0, Math.PI * 2);
        ctx.arc(px + 6, py - 12, 6, 0, Math.PI * 2);
        ctx.fill();

        // Upper sunlit tier leaves (3D elevation)
        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.arc(px, py - 21, 7.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (bed.stage === 'RIPE') {
        // Full 3D bush + bright red-orange fruit pods + golden shimmer
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(px + 2, py + 2, 12, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#166534';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, py - 26);
        ctx.stroke();

        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.arc(px - 7, py - 15, 7, 0, Math.PI * 2);
        ctx.arc(px + 7, py - 15, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(px, py - 24, 9, 0, Math.PI * 2);
        ctx.fill();

        // Ripe glowing Martian fruits
        ctx.fillStyle = needsWash ? '#facc15' : '#ef4444';
        ctx.beginPath();
        ctx.arc(px - 5, py - 21, 3.5, 0, Math.PI * 2);
        ctx.arc(px + 5, py - 26, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(px - 6, py - 22, 1.3, 0, Math.PI * 2);
        ctx.fill();
      } else if (bed.stage === 'WILTED') {
        // Droopy withered brown/olive plant
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + 4, py - 10, px + 9, py - 4);
        ctx.stroke();
        ctx.fillStyle = '#a16207';
        ctx.beginPath();
        ctx.ellipse(px + 9, py - 3, 5, 2.5, 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Grow-light canopy beam tint when lights are active
  if (lightsOn && bed.stage !== 'EMPTY' && bed.stage !== 'WILTED') {
    ctx.fillStyle =
      foodMod?.mode === 'OVERDRIVE'
        ? 'rgba(232, 121, 249, 0.14)'
        : 'rgba(134, 239, 172, 0.08)';
    ctx.fillRect(bed.x + 4, bed.y + 4, bed.w - 8, bed.h - 12);
  }

  // Top Bed Label
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fillRect(bed.x + 4, bed.y - 17, bed.w - 8, 15);
  ctx.fillStyle =
    bed.stage === 'RIPE'
      ? '#4ade80'
      : bed.stage === 'WILTED'
      ? '#f87171'
      : needsWash
      ? '#facc15'
      : '#e2e8f0';
  ctx.font = '700 9px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';

  let statusLabel = `BED ${bed.id}: EMPTY`;
  if (bed.stage === 'SPROUT') statusLabel = `SPROUT ${Math.round(bed.growth)}%`;
  else if (bed.stage === 'LEAFY') statusLabel = `LEAFY ${Math.round(bed.growth)}%`;
  else if (bed.stage === 'RIPE') statusLabel = `RIPE! (${Math.ceil(bed.ripeTimer)}s)`;
  else if (bed.stage === 'WILTED') statusLabel = 'WILTED [E]';

  ctx.fillText(statusLabel, bed.x + bed.w / 2, bed.y - 6);

  if (needsWash) {
    ctx.fillStyle = '#fef08a';
    ctx.font = '700 8px "JetBrains Mono", monospace';
    ctx.fillText('TOXIC ClO4- [F]', bed.x + bed.w / 2, bed.y + bed.h + 15);
  } else if (bed.stage !== 'EMPTY' && bed.stage !== 'WILTED' && eng.cropsPausedReason) {
    ctx.fillStyle = '#fca5a5';
    ctx.font = '700 8px "JetBrains Mono", monospace';
    ctx.fillText('PAUSED', bed.x + bed.w / 2, bed.y + bed.h + 15);
  }

  ctx.restore();
}

function renderAstronaut(ctx: CanvasRenderingContext2D, eng: EngineState, lmstIsNight: boolean) {
  const p = eng.player;
  drawCrewFigure(ctx, {
    x: p.x,
    y: p.y,
    facing: p.facingAngle,
    moving: p.moving && !p.inRover,
    walkPhase: eng.walkPhase,
    inSuit: p.inEvaSuit,
    role: eng.crew[eng.activeCrew]?.role ?? 'ENGINEER',
    light: lmstIsNight || p.inEvaSuit,
    radius: p.radius,
  });
}

interface FigureOpts {
  x: number;
  y: number;
  facing: number;
  moving: boolean;
  walkPhase: number;
  inSuit: boolean;
  role: CrewRole;
  light: boolean;
  radius: number;
}

function drawCrewFigure(ctx: CanvasRenderingContext2D, o: FigureOpts) {
  const player = { inEvaSuit: o.inSuit, radius: o.radius, facingAngle: o.facing };
  ctx.save();
  ctx.translate(o.x, o.y);

  // Drop shadow on regolith / deck
  ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
  ctx.beginPath();
  ctx.ellipse(0, 12, 16, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Gentle bob while walking
  const walking = o.moving;
  const swing = walking ? Math.sin(o.walkPhase) : 0;
  ctx.translate(0, walking ? Math.abs(Math.cos(o.walkPhase)) * -1.5 : 0);
  ctx.rotate(player.facingAngle);

  // Legs/boots stepping forward and back (drawn under the body)
  const legColor = player.inEvaSuit ? '#e2e8f0' : '#075985';
  ctx.fillStyle = legColor;
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  for (const side of [-1, 1]) {
    const fwd = swing * 7 * side;
    ctx.beginPath();
    ctx.ellipse(fwd + 2, side * 7, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // Arms swinging opposite to the legs
  ctx.fillStyle = player.inEvaSuit ? '#f1f5f9' : '#0369a1';
  for (const side of [-1, 1]) {
    const fwd = -swing * 5 * side;
    ctx.beginPath();
    ctx.ellipse(fwd, side * 15, 5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Flashlight beam at night or outdoors
  if (o.light) {
    ctx.fillStyle = 'rgba(254, 240, 138, 0.11)';
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(118, -42);
    ctx.lineTo(118, 42);
    ctx.closePath();
    ctx.fill();
  }

  if (player.inEvaSuit) {
    // KR Mars 3 style Orange & White xEMU Spacesuit + PLSS Backpack
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(-player.radius - 5, -10, 9, 20);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-player.radius - 5, -10, 9, 20);

    // Orange pressure suit shoulders/torso
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.ellipse(-1, 0, 14, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#431407';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Crew role stripe across the chest
    ctx.fillStyle = ROLE_COLORS[o.role];
    ctx.fillRect(-8, -12, 4, 24);

    // White NASA EVA Helmet
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(3, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Reflective blue-cyan visor
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(7, 0, 7.5, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.fill();
  } else {
    // Indoor NASA Blue/Orange Flight Jumpsuit
    ctx.fillStyle = '#0369a1';
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Head / headset
    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.arc(4, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f97316';
    ctx.fillRect(0, -8, 4, 16);
    // Role colour patch on the back
    ctx.fillStyle = ROLE_COLORS[o.role];
    ctx.fillRect(-11, -6, 4, 12);
  }

  ctx.restore();
}

// Crew quarters: four bunks with blankets in the role colours (decoration).
function renderQuarters(ctx: CanvasRenderingContext2D, eng: EngineState) {
  const q = QUARTERS;
  ctx.save();
  ctx.fillStyle = 'rgba(30, 41, 59, 0.55)';
  ctx.fillRect(q.x, q.y, q.w, q.h);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(q.x, q.y, q.w, q.h);
  ctx.fillStyle = 'rgba(226, 232, 240, 0.55)';
  ctx.font = '700 9px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('CREW QUARTERS', q.x + 6, q.y + q.h - 6);
  const roles: CrewRole[] = ['ENGINEER', 'GEOLOGIST', 'BOTANIST', 'DOCTOR'];
  BUNKS.forEach((b, i) => {
    // frame
    ctx.fillStyle = '#475569';
    ctx.fillRect(b.x - 4, b.y - 4, 68, 40);
    // mattress
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(b.x, b.y, 60, 32);
    // pillow
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(b.x + 2, b.y + 4, 12, 24);
    // blanket in the owner's colour
    ctx.fillStyle = ROLE_COLORS[eng.crew[i]?.role ?? roles[i]];
    ctx.globalAlpha = 0.8;
    ctx.fillRect(b.x + 18, b.y + 1, 41, 30);
    ctx.globalAlpha = 1;
    // little personal touch
    ctx.fillStyle = 'rgba(15,23,42,0.6)';
    ctx.fillRect(b.x + 62, b.y + 6, 6, 8);
  });
  ctx.restore();
}

// The crew members you're not controlling.
function renderNpcs(ctx: CanvasRenderingContext2D, eng: EngineState, nowMs: number, night: boolean) {
  const nearR = NPC_INTERACT_RADIUS;
  for (const n of eng.npcs) {
    if (n.state === 'IN_ROVER') continue;
    const c = eng.crew[n.crewIndex];
    if (!c) continue;
    const outside = !isPointInsideHabitat(n.x, n.y);
    if (n.state === 'SLEEP') {
      // Lying in the bunk: a head on the pillow and a blanket bump
      ctx.save();
      ctx.fillStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.arc(n.x - 22, n.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(15,23,42,0.25)';
      ctx.beginPath();
      ctx.ellipse(n.x + 6, n.y, 18, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      const t = nowMs / 1000;
      ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      for (let k = 0; k < 3; k++) {
        const ph = (t * 0.6 + k / 3) % 1;
        ctx.globalAlpha = 1 - ph;
        ctx.fillText('z', n.x - 14 + ph * 14, n.y - 12 - ph * 22);
      }
      ctx.restore();
      continue;
    }
    drawCrewFigure(ctx, {
      x: n.x,
      y: n.y,
      facing: n.facing,
      moving: n.state === 'WALK' || n.state === 'FOLLOW',
      walkPhase: n.walkPhase,
      inSuit: outside || (n.state === 'FOLLOW' && eng.player.inEvaSuit),
      role: c.role,
      light: night || outside,
      radius: eng.player.radius,
    });
    const near = Math.hypot(eng.player.x - n.x, eng.player.y - n.y) < nearR && !eng.player.inEvaSuit;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '700 10px "JetBrains Mono", monospace';
    const first = c.name.split(' ')[0];
    const label = eng.followerCrew === n.crewIndex ? `${first} · buddy` : near ? `${first} · ${n.activity}` : first;
    const w = ctx.measureText(label).width + 8;
    ctx.fillStyle = 'rgba(15, 10, 8, 0.7)';
    ctx.fillRect(n.x - w / 2, n.y - 36, w, 14);
    ctx.fillStyle = near ? '#fde68a' : ROLE_COLORS[c.role];
    ctx.fillText(label, n.x, n.y - 25);
    if (near) {
      ctx.strokeStyle = 'rgba(253, 230, 138, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(n.x, n.y, 22, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// Solar array southeast of the base. Dust visibly dims the cells.
function renderSolarArray(ctx: CanvasRenderingContext2D, eng: EngineState, nowMs: number) {
  const f = PANEL_FIELD;
  const cols = 6;
  const rows = 2;
  const pw = f.w / cols - 6;
  const ph = f.h / rows - 8;
  const dust = eng.panelDust / 100;
  ctx.save();
  // cables back to the habitat
  ctx.strokeStyle = 'rgba(30, 41, 59, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(f.x, f.y + f.h / 2);
  ctx.lineTo(f.x - 120, f.y - 120);
  ctx.stroke();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = f.x + c * (pw + 6);
      const y = f.y + r * (ph + 8);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x + 3, y + 4, pw, ph);
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(x, y, pw, ph);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, pw, ph);
      ctx.strokeStyle = 'rgba(147, 197, 253, 0.35)';
      for (let k = 1; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(x + (pw * k) / 3, y);
        ctx.lineTo(x + (pw * k) / 3, y + ph);
        ctx.stroke();
      }
      // dust layer
      ctx.fillStyle = `rgba(194, 120, 72, ${0.1 + dust * 0.8})`;
      ctx.fillRect(x, y, pw, ph);
      // glint when clean
      if (dust < 0.3) {
        const g = (nowMs / 1600 + c * 0.13 + r * 0.3) % 1;
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(x + g * pw * 0.8, y, 6, ph);
      }
    }
  }
  landmarkLabel(ctx, f.x + f.w / 2, f.y - 10, `SOLAR ARRAY · ${Math.round((1 - dust * 0.75) * 100)}%`);
  if (eng.player.inEvaSuit && Math.hypot(eng.player.x - (f.x + f.w / 2), eng.player.y - (f.y + f.h / 2)) < PANEL_INTERACT_RADIUS && eng.panelDust >= 10) {
    ctx.fillStyle = '#fde047';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('[E] BRUSH PANELS', f.x + f.w / 2, f.y + f.h + 18);
  }
  ctx.restore();
}

export function renderOutpostCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  eng: EngineState,
  nowMs: number
) {
  ctx.clearRect(0, 0, width, height);
  ctx.save();

  const lmst = getLmstFromElapsed(eng.elapsedSolSec);

  // Camera smoothly tracks the Astronaut + subtle asteroid impact shake
  const shakeX = eng.screenShake > 0 ? (Math.random() - 0.5) * eng.screenShake * 14 : 0;
  const shakeY = eng.screenShake > 0 ? (Math.random() - 0.5) * eng.screenShake * 14 : 0;
  const camX =
    Math.max(WORLD.minX, Math.min(WORLD.maxX - width, eng.player.x - width / 2)) + shakeX;
  const camY =
    Math.max(WORLD.minY, Math.min(WORLD.maxY - height, eng.player.y - height / 2)) + shakeY;
  ctx.translate(-camX, -camY);

  // 0. Outer exploration zones
  renderZones(ctx, camX, camY, width, height);

  // 1. Blit pre-rendered KR Mars Terrain + Habitat Base
  const staticCanvas = getStaticWorldCanvas();
  ctx.drawImage(staticCanvas, 0, 0);

  // 1b. Lava tube cave mouths and zone landmarks
  renderCaves(ctx);
  renderLandmarks(ctx, camX, camY, width, height);

  // 1c. Suit repair station (inside, by the airlock) and the sample lab
  renderSuitStation(ctx, eng, nowMs);
  renderLabStation(ctx, eng, nowMs);
  renderQuarters(ctx, eng);
  renderSolarArray(ctx, eng, nowMs);

  // 1d. Footprints and rover dust
  renderFootprints(ctx, eng);
  renderTrail(ctx, eng);

  // 2. Dynamic Airlock Highlight when standing inside
  const inAirlock = isPointInAirlock(eng.player.x, eng.player.y);
  if (inAirlock) {
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(AIRLOCK_BOUNDS.x, AIRLOCK_BOUNDS.y, AIRLOCK_BOUNDS.w, AIRLOCK_BOUNDS.h);
    ctx.setLineDash([]);
  }
  ctx.fillStyle = '#fde047';
  ctx.font = '700 11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('EVA AIRLOCK', AIRLOCK_BOUNDS.x + AIRLOCK_BOUNDS.w / 2, AIRLOCK_BOUNDS.y - 6);

  // 3. Conduit Power Flow Lines from Central 120V Bus to Modules
  ctx.strokeStyle =
    eng.netPowerKw >= 0 ? 'rgba(250, 204, 21, 0.28)' : 'rgba(248, 113, 113, 0.35)';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  for (const m of eng.modules) {
    ctx.moveTo(520, 500);
    ctx.lineTo(m.x + m.w / 2, m.y + m.h / 2);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // 4. Render 4 KR Mars NASA Hardware Modules
  for (const m of eng.modules) {
    renderModuleSprite(ctx, m, nowMs);
  }

  // 4b. Render 3D Hydroponic Planting Beds
  for (const bed of eng.beds) {
    const dist = Math.hypot(
      eng.player.x - (bed.x + bed.w / 2),
      eng.player.y - (bed.y + bed.h / 2)
    );
    renderPlantBed3D(ctx, bed, eng, nowMs, dist < 74);
  }

  // 4c. Central Insulation & Thermal Core Indicator
  ctx.fillStyle = eng.pipesFrozen ? '#0ea5e9' : '#fb923c';
  ctx.font = '700 9px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    `INSUL Lv.${eng.insulationLevel} · HEATER ${
      eng.heaterMode === 'OVERDRIVE' ? 'MAX' : eng.heaterMode
    }`,
    520,
    546
  );

  // 5. Render Supply Crates
  for (const c of eng.crates) {
    const bob = Math.sin(nowMs * 0.005 + c.id) * 3;
    ctx.save();
    ctx.translate(c.x, c.y + bob);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(-15, -13, 32, 32);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-17, -17, 34, 34);
    ctx.strokeStyle = c.color;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-17, -17, 34, 34);
    ctx.fillStyle = c.color;
    ctx.font = '700 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(c.label, 0, 3);
    ctx.restore();
  }

  // 5a. Field sites (samples, minerals, meteorites)
  for (const f of eng.fieldSites) {
    const near = eng.player.inEvaSuit && Math.hypot(eng.player.x - f.x, eng.player.y - f.y) < 70;
    renderFieldSite(ctx, f, nowMs, near);
  }

  // 5b. Subsurface ice deposits (radar echoes / core-sampled patches)
  for (const d of eng.iceDeposits) {
    const near = eng.player.inEvaSuit && Math.hypot(eng.player.x - d.x, eng.player.y - d.y) < 80;
    renderIceDeposit(ctx, d, nowMs, eng.drillingId === d.id, near);
  }

  // 5c. Ground-penetrating radar sweep ring (first second after a scan)
  const sweepT = SCAN_COOLDOWN_SECONDS - eng.scanCooldown;
  if (eng.scanCooldown > 0 && sweepT < 1.1) {
    const rr = (sweepT / 1.1) * SCAN_RADIUS;
    ctx.strokeStyle = `rgba(125, 211, 252, ${Math.max(0, 0.8 - sweepT * 0.7).toFixed(2)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(eng.player.x, eng.player.y, rr, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 6. Render Incoming Martian Asteroids
  for (const a of eng.asteroids) {
    const currX = a.startX + (a.targetX - a.startX) * a.progress;
    const currY = a.startY + (a.targetY - a.startY) * a.progress;

    // Ground lock-on ring
    const ringR = Math.max(12, 42 * (1 - a.progress * 0.65));
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(a.targetX, a.targetY, ringR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
    ctx.beginPath();
    ctx.arc(a.targetX, a.targetY, 18, 0, Math.PI * 2);
    ctx.fill();

    // Fiery trail
    const grad = ctx.createLinearGradient(a.startX, a.startY, currX, currY);
    grad.addColorStop(0, 'rgba(249, 115, 22, 0)');
    grad.addColorStop(1, 'rgba(251, 146, 60, 0.95)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(a.startX, a.startY);
    ctx.lineTo(currX, currY);
    ctx.stroke();

    // Asteroid head
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.arc(currX, currY, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.arc(currX, currY, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // 7. Render Impact & Shield Deflect Sparks
  for (const s of eng.sparks) {
    ctx.globalAlpha = Math.max(0, s.life / s.maxLife);
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 8. Render Astronaut
  if (eng.player.inRover) {
    drawMarsRover(ctx, eng.player.x, eng.player.y, eng.player.facingAngle);
  } else {
    drawMarsRover(ctx, eng.rover.x, eng.rover.y, eng.rover.facingAngle);
    if (
      eng.player.inEvaSuit &&
      Math.hypot(eng.player.x - eng.rover.x, eng.player.y - eng.rover.y) < ROVER_BOARD_RADIUS
    ) {
      ctx.fillStyle = '#fde047';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`[V] BOARD ROVER · ${Math.round(eng.rover.battery)}%`, eng.rover.x, eng.rover.y - 40);
    }
    renderNpcs(ctx, eng, nowMs, lmst.isNight);
    renderAstronaut(ctx, eng, lmst.isNight);
  }

  // 9. Outdoor Martian Dust Particles (clipped outside pressurized habitat)
  ctx.save();
  ctx.beginPath();
  // Everything visible except the pressurized habitat (even-odd cut-out)
  ctx.rect(camX - 20, camY - 20, width + 40, height + 40);
  ctx.rect(HAB_BOUNDS.x, HAB_BOUNDS.y, HAB_BOUNDS.w, HAB_BOUNDS.h);
  ctx.clip('evenodd');
  for (const p of eng.particles) {
    ctx.fillStyle =
      eng.activeEvent.kind === 'SOLAR_FLARE_2024'
        ? `rgba(192, 132, 252, ${p.alpha * 1.9})`
        : `rgba(251, 146, 60, ${
            p.alpha * (eng.activeEvent.kind === 'DUST_STORM_2018' ? 2.6 : 1.15)
          })`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 10. Floating Telemetry Texts
  for (const ft of eng.floatingTexts) {
    ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
    ctx.fillStyle = '#090d16';
    ctx.font = '700 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  // 11. Day/Night Sky Darkening (-90C Night outdoors, warm interior) & Weather Overlay
  // Compute smooth twilight/night darkness factor from sunFactor
  const storm = eng.activeEvent.kind === 'DUST_STORM_2018';
  const darkness = Math.min(
    0.75,
    (lmst.isNight ? 0.56 : Math.max(0, (0.35 - lmst.sunFactor) * 0.9)) + (storm ? 0.3 : 0)
  );
  if (darkness > 0.02) {
    ctx.save();
    // Darken the whole screen, leaving a softer warm interior inside the pressurized habitat
    ctx.fillStyle = `rgba(8, 12, 28, ${darkness.toFixed(2)})`;
    ctx.fillRect(0, 0, width, height);

    // Warm indoor habitat illumination cutout
    const habScreenX = HAB_BOUNDS.x - camX;
    const habScreenY = HAB_BOUNDS.y - camY;
    ctx.fillStyle = 'rgba(251, 191, 36, 0.06)';
    ctx.fillRect(habScreenX, habScreenY, HAB_BOUNDS.w, HAB_BOUNDS.h);
    ctx.restore();
    renderWindowGlow(ctx, camX, camY, Math.min(1, darkness / 0.56));
  }

  // Frozen pipes frost rim inside screen when base heat < 30%
  if (eng.pipesFrozen) {
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.35)';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, width - 10, height - 10);
  }

  if (storm) {
    // Dust blots out the sun: brown haze plus short visibility around the astronaut
    ctx.fillStyle = 'rgba(140, 60, 20, 0.35)';
    ctx.fillRect(0, 0, width, height);
    const px = eng.player.x - camX;
    const py = eng.player.y - camY;
    const g = ctx.createRadialGradient(px, py, 140, px, py, Math.max(width, height) * 0.6);
    g.addColorStop(0, 'rgba(90, 40, 15, 0)');
    g.addColorStop(1, 'rgba(90, 40, 15, 0.85)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }
  // Cold exposure: frosty edges that grow with the cold meter
  if (eng.player.inEvaSuit && eng.cold > 25) {
    const a = Math.min(0.55, ((eng.cold - 25) / 75) * 0.55) + eng.frostFlash * 0.3;
    const g2 = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.35,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.7
    );
    g2.addColorStop(0, 'rgba(186, 230, 253, 0)');
    g2.addColorStop(1, `rgba(186, 230, 253, ${a.toFixed(2)})`);
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, width, height);
  } else if (eng.activeEvent.kind === 'SOLAR_FLARE_2024') {
    ctx.fillStyle = 'rgba(129, 140, 248, 0.14)';
    ctx.fillRect(0, 0, width, height);
  }

  renderMissionArrow(ctx, eng, camX, camY, width, height, nowMs);
  renderMinimap(ctx, eng, width, height);
}
