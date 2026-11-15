import { changeMoraleAll, damageAll } from './crew';
import { EngineState, DecisionView } from './types';

interface DecisionDef extends DecisionView {
  // Only offered when this returns true.
  when?: (eng: EngineState) => boolean;
  // Applies the chosen option and returns a short log line.
  resolve: (eng: EngineState, choice: number) => string;
}

const crewName = (eng: EngineState, role: string) =>
  eng.crew.find((c) => c.role === role)?.name ?? 'A crew member';

export const DECISIONS: DecisionDef[] = [
  {
    id: 'FEVER',
    title: 'Crew member sick',
    text: 'Grace (botanist) has a high fever. The doctor says she will get better, but it will take time.',
    options: [
      { label: 'Use a medical kit', hint: 'She recovers now. Uses 1 of your medical kits.' },
      { label: 'Bed rest', hint: 'Saves the kit, but she loses health and the crew worries.' },
    ],
    when: (e) => e.medKits > 0,
    resolve: (eng, c) => {
      const g = eng.crew.find((m) => m.role === 'BOTANIST');
      if (c === 0) {
        eng.medKits -= 1;
        if (g) g.hp = Math.min(100, g.hp + 10);
        return `${crewName(eng, 'BOTANIST')} took antibiotics from a medical kit and is back on her feet. Kits left: ${eng.medKits}.`;
      }
      if (g) g.hp = Math.max(5, g.hp - 35);
      changeMoraleAll(eng, -8);
      return `${crewName(eng, 'BOTANIST')} is resting. Crops may grow slower until she recovers.`;
    },
  },
  {
    id: 'SIGNAL',
    title: 'Strange signal',
    text: 'Orbital cameras spotted a bright, unusual outcrop on the Volcano Slope. It could be valuable, or nothing.',
    options: [
      { label: 'Mark it for a visit', hint: 'Adds a special site on the Volcano Slope (rover needed).' },
      { label: 'Ignore it', hint: 'Stay focused on the mission.' },
    ],
    resolve: (eng, c) => {
      if (c === 0) {
        eng.fieldSites.push({
          id: 900,
          x: 2850,
          y: -600,
          kind: 'MINERAL',
          label: 'Strange outcrop',
          collected: false,
        });
        return 'Marked the strange outcrop on the Volcano Slope. Take the rover there and press [E].';
      }
      return 'Logged the signal for a future crew.';
    },
  },
  {
    id: 'LEAK',
    title: 'Water recycler leak',
    text: 'A seal in the water recycler is dripping. The engineer can replace it properly or tape it for now.',
    options: [
      { label: 'Replace the seal', hint: 'Costs 1 spare part. Problem solved.' },
      { label: 'Tape it', hint: 'Free, but you lose 15% water now.' },
    ],
    when: (e) => e.parts > 0,
    resolve: (eng, c) => {
      if (c === 0) {
        eng.parts -= 1;
        return 'Replaced the recycler seal with a spare part.';
      }
      eng.resources.water = Math.max(0, eng.resources.water - 15);
      return 'Taped the leak. Some water was lost before it held.';
    },
  },
  {
    id: 'PANELS',
    title: 'Dusty solar panels',
    text: 'A thin layer of dust is cutting solar output. Someone can go out and brush it off, or you can hope the wind cleans it.',
    options: [
      { label: 'Clean them now', hint: 'Power module +25% health, but the suit takes wear.' },
      { label: 'Wait for wind', hint: '50/50: wind cleans them (+15%) or more dust settles (-15%).' },
    ],
    resolve: (eng, c) => {
      const p = eng.modules.find((m) => m.id === 'power');
      if (!p) return '';
      if (c === 0) {
        p.health = Math.min(100, p.health + 25);
        eng.suit = Math.max(0, eng.suit - 10);
        return 'Brushed the panels clean. Power module +25%.';
      }
      if (Math.random() < 0.5) {
        p.health = Math.min(100, p.health + 15);
        return 'A gust of wind cleaned the panels, like the "cleaning events" that kept Spirit and Opportunity alive.';
      }
      p.health = Math.max(15, p.health - 15);
      return 'No wind came. More dust settled on the panels (-15%).';
    },
  },
  {
    id: 'EXPERIMENT',
    title: 'Request from Earth',
    text: 'Scientists on Earth ask you to run an extra experiment. It uses battery power but they promise a reward.',
    options: [
      { label: 'Run it', hint: 'Costs 15% battery. Gives +40 science and +1 part.' },
      { label: 'Decline', hint: 'Saves power. The crew feels a bit guilty (-5 morale).' },
    ],
    resolve: (eng, c) => {
      if (c === 0) {
        eng.resources.power = Math.max(0, eng.resources.power - 15);
        eng.science += 40;
        eng.parts += 1;
        return 'Experiment complete! +40 science and Houston approved +1 spare part.';
      }
      changeMoraleAll(eng, -5);
      return 'Declined the experiment to save power.';
    },
  },
  {
    id: 'ARGUMENT',
    title: 'Tension in the crew',
    text: 'After months in a small habitat, two crew members argued about chores. Everyone is a bit on edge.',
    options: [
      { label: 'Team dinner', hint: 'Costs 8% food. Everyone +15 morale.' },
      { label: 'Let it pass', hint: 'No cost, but everyone -10 morale.' },
    ],
    resolve: (eng, c) => {
      if (c === 0) {
        eng.resources.food = Math.max(0, eng.resources.food - 8);
        changeMoraleAll(eng, 15);
        return 'A shared dinner cleared the air. (CHAPEA crews say meals together mattered a lot.)';
      }
      changeMoraleAll(eng, -10);
      return 'Things stayed tense for a while.';
    },
  },
  {
    id: 'METEORS',
    title: 'Meteor shower warning',
    text: 'Orbit sensors predict a burst of small meteoroids in the next hours.',
    options: [
      { label: 'Shelter mode', hint: 'All modules protected for 30 s. Costs 10% battery.' },
      { label: 'Keep working', hint: 'No cost, but a meteoroid will hit soon.' },
    ],
    resolve: (eng, c) => {
      if (c === 0) {
        eng.resources.power = Math.max(0, eng.resources.power - 10);
        for (const m of eng.modules) m.invulnerableTimer = Math.max(m.invulnerableTimer, 30);
        return 'Shelter mode on. All modules are protected for 30 s.';
      }
      eng.nextAsteroidTimer = 3;
      return 'Kept working. Watch the skies.';
    },
  },
  {
    id: 'BIRTHDAY',
    title: 'Birthday on Mars',
    text: 'It is Adrian's birthday. The crew wants to make a small cake from the food stores.',
    options: [
      { label: 'Celebrate', hint: 'Costs 5% food. Everyone +20 morale.' },
      { label: 'Postpone', hint: 'No cost. Everyone -5 morale.' },
    ],
    resolve: (eng, c) => {
      if (c === 0) {
        eng.resources.food = Math.max(0, eng.resources.food - 5);
        changeMoraleAll(eng, 20);
        return 'Happy birthday, Adrian! The crew celebrated, just like the CHAPEA crew did.';
      }
      changeMoraleAll(eng, -5);
      return 'The party will have to wait.';
    },
  },
  {
    id: 'OVERHEAT',
    title: 'Fuel plant overheating',
    text: 'The Sabatier reactor is running hot. Shutting it down is safe; pushing on is risky.',
    options: [
      { label: 'Shut it down', hint: 'Fuel plant turns off. Turn it back on with [G].' },
      { label: 'Push on', hint: '60%: +6% fuel. 40%: reactor damage hurts the crew a little.' },
    ],
    when: (e) => e.fuelPlantOn,
    resolve: (eng, c) => {
      if (c === 0) {
        eng.fuelPlantOn = false;
        return 'Fuel plant shut down to cool off. Press [G] to restart it.';
      }
      if (Math.random() < 0.6) {
        eng.resources.fuel = Math.min(100, eng.resources.fuel + 6);
        return 'The reactor held. +6% fuel.';
      }
      damageAll(eng, 12);
      return 'A valve burst and the crew had to vent hot gas. Minor injuries.';
    },
  },
];

export function pickDecision(eng: EngineState): DecisionDef | null {
  const pool = DECISIONS.filter((d) => !eng.usedDecisions.includes(d.id) && (!d.when || d.when(eng)));
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getDecision(id: string): DecisionDef | undefined {
  return DECISIONS.find((d) => d.id === id);
}
