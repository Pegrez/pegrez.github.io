// Player settings, saved in this browser. Read anywhere with getSettings().
export interface GameSettings {
  master: number; // 0-1
  music: number;
  sfx: number;
  ambient: number;
  screenShake: boolean;
  dialogue: boolean;
}

const KEY = 'mars-outpost-settings';
const DEFAULTS: GameSettings = { master: 1, music: 0.8, sfx: 0.9, ambient: 0.8, screenShake: true, dialogue: true };

let current: GameSettings = load();

function load(): GameSettings {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage?.getItem(KEY) : null;
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<GameSettings>) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function getSettings(): GameSettings {
  return current;
}

export function updateSettings(patch: Partial<GameSettings>): GameSettings {
  current = { ...current, ...patch };
  try {
    window.localStorage?.setItem(KEY, JSON.stringify(current));
  } catch {
    // best-effort
  }
  return current;
}

const TUTORIAL_KEY = 'mars-outpost-tutorial-done';

export function tutorialDone(): boolean {
  try {
    return window.localStorage?.getItem(TUTORIAL_KEY) === '1';
  } catch {
    return false;
  }
}

export function setTutorialDone(done: boolean) {
  try {
    if (done) window.localStorage?.setItem(TUTORIAL_KEY, '1');
    else window.localStorage?.removeItem(TUTORIAL_KEY);
  } catch {
    // ignore
  }
}
