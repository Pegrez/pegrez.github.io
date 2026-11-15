import { EngineState } from './types';

const RUN_KEY = 'mars-outpost-run';
// Bump when the saved game state changes shape; older saves are ignored instead of breaking.
export const SAVE_VERSION = 5;
const META_KEY = 'mars-outpost-campaign-v2';

export interface CampaignMeta {
  difficulty: number;
  unlocks: string[];
  bestScore: number;
  expeditionsWon: number;
}

const DEFAULT_META: CampaignMeta = { difficulty: 0, unlocks: [], bestScore: 0, expeditionsWon: 0 };

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function saveRun(eng: EngineState) {
  const st = storage();
  if (!st) return;
  try {
    // Transient visual effects are not worth saving
    const slim = { ...eng, sparks: [], floatingTexts: [], trail: [], asteroids: [] };
    st.setItem(RUN_KEY, JSON.stringify({ v: SAVE_VERSION, eng: slim }));
  } catch {
    // Quota or private mode: saving is best-effort
  }
}

export function loadRun(): EngineState | null {
  const st = storage();
  if (!st) return null;
  try {
    const raw = st.getItem(RUN_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { v?: number; eng?: EngineState };
    if (!data || data.v !== SAVE_VERSION || !data.eng) return null;
    const eng = data.eng;
    if (!Array.isArray(eng.crew) || typeof eng.solNumber !== 'number') return null;
    return eng;
  } catch {
    return null;
  }
}

export function peekRun(): { month: number; difficulty: number } | null {
  const eng = loadRun();
  return eng ? { month: eng.solNumber, difficulty: eng.difficulty } : null;
}

export function clearRun() {
  const st = storage();
  try {
    st?.removeItem(RUN_KEY);
  } catch {
    // ignore
  }
}

export function loadMeta(): CampaignMeta {
  const st = storage();
  if (!st) return { ...DEFAULT_META };
  try {
    const raw = st.getItem(META_KEY);
    if (!raw) return { ...DEFAULT_META };
    return { ...DEFAULT_META, ...(JSON.parse(raw) as Partial<CampaignMeta>) };
  } catch {
    return { ...DEFAULT_META };
  }
}

export function saveMeta(meta: CampaignMeta) {
  const st = storage();
  try {
    st?.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // ignore
  }
}
