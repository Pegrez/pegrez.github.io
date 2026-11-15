import { EngineState } from './types';

export interface ScoreResult {
  total: number;
  stars: number; // 0-3
  lines: Array<{ label: string; points: number }>;
  multiplier: number;
}

export function computeScore(eng: EngineState, won: boolean): ScoreResult {
  const avgHp = eng.crew.reduce((s, c) => s + c.hp, 0) / eng.crew.length;
  const avgMorale = eng.crew.reduce((s, c) => s + c.morale, 0) / eng.crew.length;
  const lines = [
    { label: 'Launch fuel', points: Math.round(eng.resources.fuel * 3) },
    { label: 'Science', points: Math.round(eng.science) },
    { label: 'Missions completed', points: eng.missionIndex * 20 },
    { label: 'Zones explored', points: eng.discoveredZones.length * 25 },
    { label: 'Crew health', points: Math.round(avgHp) },
    { label: 'Crew morale', points: Math.round(avgMorale) },
    { label: won ? 'Safe launch home' : 'Mission lost', points: won ? 500 : 0 },
  ];
  const multiplier = 1 + 0.2 * eng.difficulty;
  const total = Math.round(lines.reduce((s, l) => s + l.points, 0) * multiplier);
  const stars = !won ? (total >= 500 ? 1 : 0) : total >= 1500 ? 3 : total >= 1100 ? 2 : 1;
  return { total, stars, lines, multiplier };
}
