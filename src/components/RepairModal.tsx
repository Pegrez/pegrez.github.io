import { useCallback, useEffect, useRef, useState } from 'react';
import { RepairSession, RepairTaskDef } from '../game/repairTasks';
import { sound } from '../game/audio';

interface RepairModalProps {
  session: RepairSession;
  onStageClear: () => void;
  onFail: () => void;
  onAbort: () => void;
}

const COLORS = ['#ef4444', '#3b82f6', '#facc15', '#22c55e'];
const COLOR_NAMES = ['Red', 'Blue', 'Yellow', 'Green'];

function useAnimationFrame(cb: (dt: number) => void, active = true) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      ref.current(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}

function useKeys(handler: (e: KeyboardEvent) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const down = (e: KeyboardEvent) => ref.current(e);
    window.addEventListener('keydown', down, true);
    return () => window.removeEventListener('keydown', down, true);
  }, []);
}

interface TaskProps {
  onWin: () => void;
  onLose: () => void;
  setStatus: (s: string) => void;
}

// Stop a swinging pressure needle inside the green zone, 3 times.
function ValveTask({ onWin, onLose, setStatus }: TaskProps) {
  const [needle, setNeedle] = useState(0);
  const dir = useRef(1);
  const [zone, setZone] = useState(() => ({ start: 0.35 + Math.random() * 0.4, width: 0.2 }));
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [flash, setFlash] = useState<'ok' | 'bad' | null>(null);
  const speed = 0.75 + hits * 0.25;
  useAnimationFrame((dt) => {
    setNeedle((n) => {
      let v = n + dir.current * speed * dt;
      if (v > 1) {
        v = 1;
        dir.current = -1;
      } else if (v < 0) {
        v = 0;
        dir.current = 1;
      }
      return v;
    });
  });
  const press = useCallback(() => {
    if (needle >= zone.start && needle <= zone.start + zone.width) {
      sound.playShieldBlock();
      setFlash('ok');
      const h = hits + 1;
      setHits(h);
      if (h >= 3) onWin();
      else setZone({ start: 0.1 + Math.random() * 0.7, width: Math.max(0.12, 0.2 - h * 0.03) });
    } else {
      sound.playAlert();
      setFlash('bad');
      const m = misses + 1;
      setMisses(m);
      if (m >= 3) onLose();
    }
    setTimeout(() => setFlash(null), 200);
  }, [hits, misses, needle, onLose, onWin, zone]);
  useKeys((e) => {
    if (e.code === 'Space' || e.code === 'KeyE') {
      e.preventDefault();
      e.stopImmediatePropagation();
      press();
    }
  });
  useEffect(() => setStatus(`Hits ${hits}/3 · misses ${misses}/3`), [hits, misses, setStatus]);
  return (
    <button type="button" onClick={press} className="w-full cursor-pointer select-none">
      <svg viewBox="0 0 400 200" className="w-full">
        <path d="M40 180 A160 160 0 0 1 360 180" fill="none" stroke="#334155" strokeWidth="26" />
        {(() => {
          const a0 = Math.PI * (1 - zone.start);
          const a1 = Math.PI * (1 - zone.start - zone.width);
          const p = (a: number) => `${200 + Math.cos(a) * 160} ${180 - Math.sin(a) * 160}`;
          return <path d={`M${p(a0)} A160 160 0 0 1 ${p(a1)}`} fill="none" stroke="#22c55e" strokeWidth="26" />;
        })()}
        {(() => {
          const a = Math.PI * (1 - needle);
          return (
            <line
              x1="200"
              y1="180"
              x2={200 + Math.cos(a) * 150}
              y2={180 - Math.sin(a) * 150}
              stroke={flash === 'bad' ? '#ef4444' : flash === 'ok' ? '#22c55e' : '#f8fafc'}
              strokeWidth="6"
              strokeLinecap="round"
            />
          );
        })()}
        <circle cx="200" cy="180" r="12" fill="#f97316" />
        <text x="200" y="130" textAnchor="middle" fill="#fde68a" fontSize="16" fontWeight="700">
          PRESS SPACE IN THE GREEN
        </text>
      </svg>
    </button>
  );
}

// Match each wire on the left to the same color on the right.
function WiresTask({ onWin, onLose, setStatus }: TaskProps) {
  const [right] = useState(() => {
    const r = [0, 1, 2, 3];
    for (let i = 3; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [r[i], r[j]] = [r[j], r[i]];
    }
    return r;
  });
  const [picked, setPicked] = useState<number | null>(null);
  const [done, setDone] = useState<number[]>([]);
  const [mistakes, setMistakes] = useState(0);
  useEffect(() => setStatus(`Connected ${done.length}/4 · mistakes ${mistakes}/3`), [done, mistakes, setStatus]);
  const pickRight = (slot: number) => {
    if (picked === null) return;
    if (right[slot] === picked) {
      sound.playShieldBlock();
      const d = [...done, picked];
      setDone(d);
      setPicked(null);
      if (d.length === 4) onWin();
    } else {
      sound.playAlert();
      const m = mistakes + 1;
      setMistakes(m);
      setPicked(null);
      if (m >= 3) onLose();
    }
  };
  useKeys((e) => {
    const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
    if (n < 0) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (picked === null) {
      if (!done.includes(n)) setPicked(n);
    } else {
      pickRight(n);
    }
  });
  return (
    <svg viewBox="0 0 400 220" className="w-full select-none">
      <rect x="10" y="10" width="380" height="200" rx="10" fill="#0f172a" stroke="#334155" />
      {done.map((c) => {
        const slot = right.indexOf(c);
        return <line key={c} x1="70" y1={40 + c * 45} x2="330" y2={40 + slot * 45} stroke={COLORS[c]} strokeWidth="7" strokeLinecap="round" />;
      })}
      {[0, 1, 2, 3].map((c) => (
        <g key={`l${c}`} onClick={() => !done.includes(c) && setPicked(c)} style={{ cursor: 'pointer' }}>
          <rect x="24" y={28 + c * 45} width="46" height="24" rx="5" fill={COLORS[c]} stroke={picked === c ? '#fff' : 'none'} strokeWidth="3" />
          <text x="47" y={45 + c * 45} textAnchor="middle" fontSize="12" fontWeight="700" fill="#0f172a">{c + 1}</text>
        </g>
      ))}
      {right.map((c, slot) => (
        <g key={`r${slot}`} onClick={() => pickRight(slot)} style={{ cursor: picked !== null ? 'pointer' : 'default' }}>
          <rect x="330" y={28 + slot * 45} width="46" height="24" rx="5" fill={COLORS[c]} opacity={done.includes(c) ? 1 : 0.85} />
          <text x="353" y={45 + slot * 45} textAnchor="middle" fontSize="12" fontWeight="700" fill="#0f172a">{slot + 1}</text>
        </g>
      ))}
      <text x="200" y="205" textAnchor="middle" fill="#94a3b8" fontSize="11">
        {picked === null ? 'Pick a wire on the left (1–4)' : `Now pick the ${COLOR_NAMES[picked].toLowerCase()} terminal on the right (1–4)`}
      </text>
    </svg>
  );
}

// Watch a 4-light boot sequence, then repeat it.
function RebootTask({ onWin, onLose, setStatus }: TaskProps) {
  const [seq] = useState(() => Array.from({ length: 4 }, () => Math.floor(Math.random() * 4)));
  const [showIdx, setShowIdx] = useState(-1);
  const [input, setInput] = useState<number[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [lit, setLit] = useState<number | null>(null);
  const playing = showIdx < seq.length;
  // Play the sequence
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      const next = showIdx + 1;
      if (next < seq.length) {
        setLit(seq[next]);
        sound.tone(440 + seq[next] * 110, 'sine', 0.25, 0.08);
        setTimeout(() => setLit(null), 420);
      }
      setShowIdx(next);
    }, showIdx < 0 ? 700 : 650);
    return () => clearTimeout(t);
  }, [playing, seq, showIdx]);
  useEffect(
    () => setStatus(playing ? 'Watch the lights…' : `Entered ${input.length}/4 · mistakes ${mistakes}/2`),
    [input, mistakes, playing, setStatus]
  );
  const press = (b: number) => {
    if (playing) return;
    setLit(b);
    sound.tone(440 + b * 110, 'sine', 0.2, 0.08);
    setTimeout(() => setLit(null), 180);
    const next = [...input, b];
    if (seq[next.length - 1] !== b) {
      sound.playAlert();
      const m = mistakes + 1;
      setMistakes(m);
      setInput([]);
      if (m >= 2) onLose();
      else setShowIdx(-1); // replay the sequence
      return;
    }
    setInput(next);
    if (next.length === seq.length) onWin();
  };
  useKeys((e) => {
    const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
    if (n < 0) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    press(n);
  });
  return (
    <div className="grid grid-cols-4 gap-3 py-4 select-none">
      {[0, 1, 2, 3].map((b) => (
        <button
          key={b}
          type="button"
          onClick={() => press(b)}
          className="aspect-square rounded-xl border-2 font-bold text-lg cursor-pointer transition-all"
          style={{
            background: lit === b ? COLORS[b] : '#0f172a',
            borderColor: COLORS[b],
            color: lit === b ? '#0f172a' : COLORS[b],
            boxShadow: lit === b ? `0 0 24px ${COLORS[b]}` : 'none',
          }}
        >
          {b + 1}
        </button>
      ))}
    </div>
  );
}

// Hold SPACE to weld while keeping the torch on a drifting crack.
function WeldTask({ onWin, onLose, setStatus }: TaskProps) {
  const [torch, setTorch] = useState(0.5);
  const [progress, setProgress] = useState(0);
  const [quality, setQuality] = useState(100);
  const t = useRef(Math.random() * 10);
  const held = useRef(false);
  const left = useRef(false);
  const right = useRef(false);
  const target = 0.5 + Math.sin(t.current * 0.9) * 0.28 + Math.sin(t.current * 2.1) * 0.08;
  const finished = useRef(false);
  useAnimationFrame((dt) => {
    if (finished.current) return;
    t.current += dt;
    setTorch((x) => Math.max(0, Math.min(1, x + ((right.current ? 1 : 0) - (left.current ? 1 : 0)) * 0.9 * dt)));
    if (held.current) {
      const onTarget = Math.abs(torch - target) < 0.07;
      if (onTarget) setProgress((p) => Math.min(100, p + 22 * dt));
      else setQuality((q) => Math.max(0, q - 30 * dt));
    }
  });
  useEffect(() => {
    if (finished.current) return;
    if (progress >= 100) {
      finished.current = true;
      onWin();
    } else if (quality <= 0) {
      finished.current = true;
      onLose();
    }
  }, [onLose, onWin, progress, quality]);
  useEffect(() => setStatus(`Sealed ${Math.round(progress)}% · weld quality ${Math.round(quality)}%`), [progress, quality, setStatus]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['Space', 'KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      if (e.code === 'Space') held.current = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') left.current = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') right.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') held.current = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') left.current = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') right.current = false;
    };
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    return () => {
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
    };
  }, []);
  const onTarget = Math.abs(torch - target) < 0.07;
  return (
    <svg
      viewBox="0 0 400 180"
      className="w-full select-none cursor-crosshair"
      onMouseMove={(e) => {
        const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        setTorch(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
      }}
      onMouseDown={() => (held.current = true)}
      onMouseUp={() => (held.current = false)}
      onMouseLeave={() => (held.current = false)}
    >
      <rect x="0" y="40" width="400" height="100" rx="8" fill="#475569" />
      <rect x="0" y="40" width={(400 * progress) / 100} height="100" rx="8" fill="#64748b" />
      <line x1={target * 400} y1="44" x2={target * 400} y2="136" stroke="#0f172a" strokeWidth="6" strokeDasharray="8 5" />
      <polygon points={`${torch * 400 - 12},18 ${torch * 400 + 12},18 ${torch * 400},40`} fill={onTarget ? '#22c55e' : '#f97316'} />
      {held.current && <circle cx={torch * 400} cy="90" r={onTarget ? 14 : 8} fill={onTarget ? '#fde68a' : '#f87171'} opacity="0.9" />}
      <text x="200" y="170" textAnchor="middle" fill="#fde68a" fontSize="13" fontWeight="700">
        HOLD SPACE (or mouse) · A/D to follow the crack
      </text>
    </svg>
  );
}

// Click every bolt / dusty spot / dead lamp before time runs out.
function BoltsTask({ onWin, setStatus }: TaskProps) {
  const [spots] = useState(() =>
    Array.from({ length: 6 }, (_, i) => ({
      id: i,
      x: 40 + (i % 3) * 140 + Math.random() * 40,
      y: 40 + Math.floor(i / 3) * 90 + Math.random() * 30,
    }))
  );
  const [done, setDone] = useState<number[]>([]);
  useEffect(() => setStatus(`Done ${done.length}/6`), [done, setStatus]);
  const hit = (id: number) => {
    if (done.includes(id)) return;
    sound.tone(900 + id * 60, 'square', 0.05, 0.05);
    const d = [...done, id];
    setDone(d);
    if (d.length === 6) onWin();
  };
  useKeys((e) => {
    const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].indexOf(e.code);
    if (n < 0) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    hit(n);
  });
  return (
    <svg viewBox="0 0 460 220" className="w-full select-none">
      <rect x="5" y="5" width="450" height="210" rx="10" fill="#1e293b" stroke="#475569" />
      {spots.map((s) => (
        <g key={s.id} onClick={() => hit(s.id)} style={{ cursor: 'pointer' }}>
          <circle cx={s.x} cy={s.y} r="20" fill={done.includes(s.id) ? '#14532d' : '#94a3b8'} stroke="#e2e8f0" strokeWidth="2" />
          {!done.includes(s.id) && <line x1={s.x - 9} y1={s.y} x2={s.x + 9} y2={s.y} stroke="#0f172a" strokeWidth="4" />}
          <text x={s.x} y={s.y + 36} textAnchor="middle" fill="#cbd5e1" fontSize="12" fontWeight="700">
            {s.id + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}

const TIME_LIMIT: Record<RepairTaskDef['mechanic'], number> = {
  VALVE: 20,
  WIRES: 20,
  REBOOT: 25,
  WELD: 22,
  BOLTS: 10,
};

export function RepairModal({ session, onStageClear, onFail, onAbort }: RepairModalProps) {
  const task = session.queue[session.stageIndex];
  const [status, setStatus] = useState('');
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT[task.mechanic]);
  const resolved = useRef(false);
  useEffect(() => {
    resolved.current = false;
    setTimeLeft(TIME_LIMIT[task.mechanic]);
  }, [task]);
  const win = useCallback(() => {
    if (resolved.current) return;
    resolved.current = true;
    sound.playSuccess();
    setTimeout(onStageClear, 350);
  }, [onStageClear]);
  const lose = useCallback(() => {
    if (resolved.current) return;
    resolved.current = true;
    setTimeout(onFail, 250);
  }, [onFail]);
  useAnimationFrame((dt) => {
    if (resolved.current) return;
    setTimeLeft((t) => {
      const n = t - dt;
      if (n <= 0) lose();
      return Math.max(0, n);
    });
  });
  useKeys((e) => {
    if (e.code === 'Escape') {
      e.stopImmediatePropagation();
      onAbort();
    }
  });
  const props = { onWin: win, onLose: lose, setStatus };
  const limit = TIME_LIMIT[task.mechanic];
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label={`Repair ${session.moduleName}`}>
      <div className="w-full max-w-lg rounded-2xl border-2 border-amber-400/60 bg-[#120a08] p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
              {session.moduleName} · task {session.stageIndex + 1} of {session.queue.length}
            </div>
            <h2 className="font-display text-lg font-bold text-white">{task.title}</h2>
            <p className="text-xs text-amber-50/80">{task.hint}</p>
          </div>
          <button type="button" onClick={onAbort} className="shrink-0 rounded border border-white/15 px-2 py-1 text-[11px] text-amber-100 hover:bg-white/10 cursor-pointer">
            Leave [Esc]
          </button>
        </div>
        <div className="mt-3" key={`${task.id}-${session.stageIndex}`}>
          {task.mechanic === 'VALVE' && <ValveTask {...props} />}
          {task.mechanic === 'WIRES' && <WiresTask {...props} />}
          {task.mechanic === 'REBOOT' && <RebootTask {...props} />}
          {task.mechanic === 'WELD' && <WeldTask {...props} />}
          {task.mechanic === 'BOLTS' && <BoltsTask {...props} />}
        </div>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-amber-100/80">
          <span className="font-mono-tabular">{status}</span>
          <div className="ml-auto h-1.5 w-32 overflow-hidden rounded bg-black/60">
            <div className={`h-full ${timeLeft < limit * 0.25 ? 'bg-rose-500' : 'bg-amber-400'}`} style={{ width: `${(timeLeft / limit) * 100}%` }} />
          </div>
          <span className="font-mono-tabular w-8 text-right">{Math.ceil(timeLeft)}s</span>
        </div>
        <p className="mt-2 text-[10px] text-amber-100/40">The base keeps running while you work. Failing a task damages the module a little.</p>
      </div>
    </div>
  );
}
