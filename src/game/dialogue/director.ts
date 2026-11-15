import { getSettings } from '../settings';
import { EngineState } from '../types';
import { CONVERSATIONS, DialogueTrigger } from './lines';

// Seconds a line stays on screen: long enough to read, short enough to keep moving.
function lineDuration(text: string): number {
  return 2.6 + text.length * 0.045;
}

/**
 * Queues an unused conversation for this trigger (if nothing is already playing).
 * Returns true if something was queued.
 */
export function sayConversation(eng: EngineState, trigger: DialogueTrigger, force = false): boolean {
  if (!getSettings().dialogue) return false;
  if (!force && (eng.dialogueLine || eng.dialogueQueue.length > 0)) return false;
  // Crew members in the medbay don't chat
  const able = new Set(eng.crew.filter((c) => !c.down).map((c) => c.role));
  const options = CONVERSATIONS.filter(
    (c) =>
      c.trigger === trigger &&
      !eng.usedConversations.includes(c.id) &&
      c.lines.every((l) => able.has(l.who))
  );
  if (options.length === 0) return false;
  const convo = options[Math.floor(Math.random() * options.length)];
  eng.usedConversations.push(convo.id);
  eng.dialogueQueue = convo.lines.map((l) => ({ ...l }));
  eng.dialogueLine = null;
  return true;
}

// Queue a conversation after whatever is already being said.
export function appendConversation(eng: EngineState, trigger: DialogueTrigger): boolean {
  if (!getSettings().dialogue) return false;
  const convo = CONVERSATIONS.find((c) => c.trigger === trigger && !eng.usedConversations.includes(c.id));
  if (!convo) return false;
  eng.usedConversations.push(convo.id);
  eng.dialogueQueue.push(...convo.lines.map((l) => ({ ...l })));
  return true;
}

// Like sayConversation, but only once per run for this trigger (used for warnings).
export function sayOnce(eng: EngineState, trigger: DialogueTrigger): boolean {
  if (eng.dialogueSaid.includes(trigger)) return false;
  const ok = sayConversation(eng, trigger);
  if (ok) eng.dialogueSaid.push(trigger);
  return ok;
}

// Advances lines and schedules idle chatter and Shabbat scenes. Uses game time.
export function updateDialogue(eng: EngineState, dt: number) {
  const now = eng.totalElapsedSec;
  if (eng.dialogueLine && now >= eng.dialogueLine.until) eng.dialogueLine = null;
  if (!eng.dialogueLine && eng.dialogueQueue.length > 0) {
    const next = eng.dialogueQueue.shift()!;
    eng.dialogueLine = { ...next, until: now + lineDuration(next.text) };
  }

  const calm = eng.activeEvent.kind === 'NONE' && !eng.pendingDecision;
  eng.chatterTimer -= dt;
  if (eng.chatterTimer <= 0) {
    eng.chatterTimer = 55 + Math.random() * 35;
    if (calm) sayConversation(eng, 'IDLE');
  }
  // Shabbat comes around roughly every 7 sols; in game time that's a few times per run
  if (eng.solNumber >= 2) {
    eng.shabbatTimer -= dt;
    if (eng.shabbatTimer <= 0) {
      eng.shabbatTimer = 85 + Math.random() * 20;
      if (calm) sayConversation(eng, 'SHABBAT');
    }
  }
}
