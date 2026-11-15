// Crew members who aren't being controlled: they wander the habitat, sleep at night,
// and one of them can follow you outside as your EVA buddy.
import {
  BUNKS,
  CREW_SPOTS,
  HAB_BOUNDS,
  WING_DOOR,
  getLmstFromElapsed,
  isPointInsideHabitat,
} from '../constants';
import { CrewNpc, EngineState } from '../types';

const NPC_SPEED = 85;
const FOLLOW_SPEED_MULT = 1.08;
const BREADCRUMB_SPACING = 16;
const FOLLOW_GAP = 4; // how many breadcrumbs behind you the buddy walks

const side = (x: number) => (x < WING_DOOR.x ? 'L' : 'R');

// One NPC per crew member except the one you control.
export function createNpcs(activeCrew: number): CrewNpc[] {
  const starts = [CREW_SPOTS[0], CREW_SPOTS[2], CREW_SPOTS[1], CREW_SPOTS[6]];
  return [0, 1, 2, 3]
    .filter((i) => i !== activeCrew)
    .map((i, k) => ({
      crewIndex: i,
      x: starts[k].x,
      y: starts[k].y,
      tx: starts[k].x,
      ty: starts[k].y,
      via: null,
      facing: Math.PI / 2,
      state: 'IDLE' as const,
      timer: 2 + Math.random() * 5,
      activity: starts[k].activity,
      walkPhase: 0,
    }));
}

function setDestination(n: CrewNpc, x: number, y: number) {
  n.tx = x;
  n.ty = y;
  // Walls separate the two wings: route through the opening in the middle
  n.via = side(n.x) !== side(x) ? { ...WING_DOOR } : null;
  n.state = 'WALK';
}

function pickActivity(n: CrewNpc, eng: EngineState) {
  // Avoid spots another crew member is heading to, standing at, or where you are
  const others = eng.npcs.filter((o) => o !== n);
  const busy = (x: number, y: number) =>
    others.some((o) => Math.hypot(o.tx - x, o.ty - y) < 50 || Math.hypot(o.x - x, o.y - y) < 50) ||
    Math.hypot(eng.player.x - x, eng.player.y - y) < 40;
  const free = CREW_SPOTS.filter((s) => !busy(s.x, s.y));
  const spot = free[Math.floor(Math.random() * free.length)] ?? CREW_SPOTS[0];
  n.activity = spot.activity;
  setDestination(n, spot.x + (Math.random() - 0.5) * 16, spot.y + (Math.random() - 0.5) * 10);
}

function stepToward(n: CrewNpc, x: number, y: number, speed: number, dt: number): boolean {
  const dx = x - n.x;
  const dy = y - n.y;
  const d = Math.hypot(dx, dy);
  if (d < 3) return true;
  const step = Math.min(d, speed * dt);
  n.x += (dx / d) * step;
  n.y += (dy / d) * step;
  let diff = Math.atan2(dy, dx) - n.facing;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  n.facing += diff * Math.min(1, dt * 10);
  n.walkPhase += dt * 9;
  return false;
}

// Records your path so a following buddy walks the same way (through the airlock, around walls).
export function recordBreadcrumb(eng: EngineState) {
  const last = eng.breadcrumbs[eng.breadcrumbs.length - 1];
  if (!last || Math.hypot(last.x - eng.player.x, last.y - eng.player.y) >= BREADCRUMB_SPACING) {
    eng.breadcrumbs.push({ x: eng.player.x, y: eng.player.y });
    if (eng.breadcrumbs.length > 40) eng.breadcrumbs.shift();
  }
}

export function updateNpcs(eng: EngineState, dt: number) {
  const night = getLmstFromElapsed(eng.elapsedSolSec).isNight;
  for (const n of eng.npcs) {
    const c = eng.crew[n.crewIndex];
    const isFollower = eng.followerCrew === n.crewIndex;

    if (isFollower) {
      if (eng.player.inRover) {
        n.state = 'IN_ROVER';
        n.x = eng.player.x;
        n.y = eng.player.y;
        continue;
      }
      if (n.state === 'IN_ROVER') {
        // Climb out next to you
        n.x = eng.player.x - 36;
        n.y = eng.player.y + 10;
        eng.breadcrumbs = [];
      }
      n.state = 'FOLLOW';
      const crumbs = eng.breadcrumbs;
      const target = crumbs.length > FOLLOW_GAP ? crumbs[crumbs.length - 1 - FOLLOW_GAP] : null;
      if (target && Math.hypot(eng.player.x - n.x, eng.player.y - n.y) > 40) {
        stepToward(n, target.x, target.y, eng.player.speed * FOLLOW_SPEED_MULT, dt);
        // Drop crumbs we've passed so the buddy keeps moving along the trail
        while (crumbs.length > FOLLOW_GAP + 1 && Math.hypot(crumbs[0].x - n.x, crumbs[0].y - n.y) < 20) crumbs.shift();
      }
      continue;
    }

    // Injured crew rest in their bunk; everyone sleeps at night
    const bunk = BUNKS[n.crewIndex];
    if (c.down || (night && eng.activeEvent.kind === 'NONE')) {
      if (n.state !== 'SLEEP') {
        if (stepTowardWithDoor(n, bunk.x, bunk.y, dt)) {
          n.state = 'SLEEP';
          n.activity = c.down ? 'recovering in the medbay bunk' : 'sleeping';
          n.facing = 0;
        } else {
          n.state = 'WALK';
          n.activity = 'heading to bed';
        }
      }
      continue;
    }
    if (n.state === 'SLEEP') {
      n.state = 'IDLE';
      n.timer = Math.random() * 3;
    }

    // Safety: if a buddy was released outside, walk home through the airlock
    if (!isPointInsideHabitat(n.x, n.y)) {
      stepToward(n, HAB_BOUNDS.x + HAB_BOUNDS.w - 40, 500, NPC_SPEED * 1.4, dt);
      continue;
    }

    if (n.state === 'WALK') {
      if (stepTowardWithDoor(n, n.tx, n.ty, dt)) {
        n.state = 'IDLE';
        n.timer = 6 + Math.random() * 10;
      }
    } else {
      n.timer -= dt;
      if (n.timer <= 0) pickActivity(n, eng);
    }
  }
}

function stepTowardWithDoor(n: CrewNpc, x: number, y: number, dt: number): boolean {
  if (side(n.x) !== side(x) && !n.via) n.via = { ...WING_DOOR };
  if (n.via) {
    if (stepToward(n, n.via.x, n.via.y, NPC_SPEED, dt)) {
      n.via = null;
      // Step through the doorway so we end up on the target's side (avoids dithering in the door)
      n.x = WING_DOOR.x + (side(x) === 'R' ? 4 : -4);
    }
    return false;
  }
  return stepToward(n, x, y, NPC_SPEED, dt);
}

export function nearestNpc(eng: EngineState, radius: number): CrewNpc | null {
  if (eng.player.inRover) return null;
  let best: CrewNpc | null = null;
  let bestD = radius;
  for (const n of eng.npcs) {
    if (n.state === 'IN_ROVER') continue;
    const d = Math.hypot(n.x - eng.player.x, n.y - eng.player.y);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

/**
 * Hand control to crew member `j` (who is standing somewhere as an NPC).
 * The person you were controlling stays where they are and goes back to idling.
 */
export function takeControl(eng: EngineState, j: number) {
  const n = eng.npcs.find((m) => m.crewIndex === j);
  if (!n || j === eng.activeCrew) return;
  const oldIndex = eng.activeCrew;
  const oldX = eng.player.x;
  const oldY = eng.player.y;
  eng.player.x = n.x;
  eng.player.y = n.y;
  eng.player.vx = 0;
  eng.player.vy = 0;
  eng.player.facingAngle = n.facing;
  n.crewIndex = oldIndex;
  n.x = oldX;
  n.y = oldY;
  n.tx = oldX;
  n.ty = oldY;
  n.via = null;
  n.state = 'IDLE';
  n.timer = 3 + Math.random() * 4;
  n.activity = 'taking a break';
  eng.activeCrew = j;
  if (eng.followerCrew === j) eng.followerCrew = null;
  eng.breadcrumbs = [];
}
