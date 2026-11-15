import { HP_MAX } from './constants';
import { CrewMember, CrewRole, EngineState } from './types';

// A crew member counts for their role perk only while healthy enough and not miserable.
export function roleActive(eng: EngineState, role: CrewRole): boolean {
  const c = eng.crew.find((m) => m.role === role);
  return !!c && !c.down && c.hp >= 30 && c.morale >= 25;
}

export function activeMember(eng: EngineState): CrewMember {
  return eng.crew[eng.activeCrew] ?? eng.crew[0];
}

// The person walking around is the one with this role (and able).
export function activeIs(eng: EngineState, role: CrewRole): boolean {
  const a = activeMember(eng);
  return a.role === role && a.morale >= 25;
}

// Damage in the old 200-point crew pool units, spread across everyone in the habitat.
export function damageAll(eng: EngineState, amount200: number) {
  for (const c of eng.crew) {
    if (!c.down) c.hp -= amount200 / 2;
  }
}

// Damage that only the person outside takes (cold, suit leaks, frostbite...).
export function damageActive(eng: EngineState, amount200: number) {
  const a = activeMember(eng);
  if (!a.down) a.hp -= amount200;
}

export function healAll(eng: EngineState, perMember: number) {
  for (const c of eng.crew) c.hp = Math.min(100, c.hp + (c.down ? perMember * 0.4 : perMember));
}

export function changeMoraleAll(eng: EngineState, delta: number) {
  for (const c of eng.crew) c.morale = Math.max(0, Math.min(100, c.morale + delta));
}

export interface CrewSyncResult {
  newlyDown: CrewMember[];
  recovered: CrewMember[];
  activeWentDown: boolean;
}

// Clamp crew values, flag incapacitated members and keep resources.hp as the crew total (max 200).
export function syncCrew(eng: EngineState): CrewSyncResult {
  const res: CrewSyncResult = { newlyDown: [], recovered: [], activeWentDown: false };
  eng.crew.forEach((c, i) => {
    c.hp = Math.max(0, Math.min(100, c.hp));
    c.morale = Math.max(0, Math.min(100, c.morale));
    if (!c.down && c.hp <= 0) {
      c.down = true;
      res.newlyDown.push(c);
      if (i === eng.activeCrew) res.activeWentDown = true;
    } else if (c.down && c.hp >= 40) {
      c.down = false;
      res.recovered.push(c);
    }
  });
  const total = eng.crew.reduce((s, c) => s + c.hp, 0);
  eng.resources.hp = (total / (eng.crew.length * 100)) * HP_MAX;
  return res;
}

export function nextAbleCrew(eng: EngineState, from: number): number {
  for (let k = 1; k <= eng.crew.length; k++) {
    const i = (from + k) % eng.crew.length;
    if (!eng.crew[i].down) return i;
  }
  return from;
}

// True while a crew member is outside with you as your EVA buddy.
export function buddyOutside(eng: EngineState): boolean {
  return eng.followerCrew !== null && eng.player.inEvaSuit;
}

// True when your current EVA buddy has this role.
export function buddyIs(eng: EngineState, role: CrewRole): boolean {
  return buddyOutside(eng) && eng.crew[eng.followerCrew!].role === role;
}
