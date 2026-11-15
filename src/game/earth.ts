import { LAUNCH_FUEL_REQUIRED, TOTAL_MISSION_MONTHS, getLmstFromElapsed } from './constants';
import { EarthMessage, EngineState } from './types';

// Conditions that Earth's advice is about. If false on arrival, the advice is outdated.
export const EARTH_CONDITIONS: Record<string, (eng: EngineState) => boolean> = {
  WATER_LOW: (e) => e.resources.water < 35,
  O2_LOW: (e) => e.resources.o2 < 45,
  POWER_LOW: (e) => e.resources.power < 35,
  FOOD_LOW: (e) => e.resources.food < 35,
  MOXIE_DAMAGED: (e) => (e.modules.find((m) => m.id === 'o2')?.health ?? 100) < 55,
  FUEL_BEHIND: (e) => e.solNumber >= 3 && e.resources.fuel < (e.solNumber / TOTAL_MISSION_MONTHS) * 85 - 10,
};

// Mission Control writes a message based on what it sees *now*; it arrives later.
export function composeEarthMessage(eng: EngineState): EarthMessage {
  const lm = getLmstFromElapsed(eng.elapsedSolSec);
  // Real one-way light delay is 4–22 min; relay passes and queueing add hours.
  const delay = 7 + Math.random() * 9;
  const base = { deliverAt: eng.totalElapsedSec + delay, sentLabel: lm.formatted, moraleBoost: 0 };

  const advice: Array<[string, string]> = [
    ['MOXIE_DAMAGED', 'Houston: telemetry shows MOXIE damaged. Recommend repairing it before oxygen drops.'],
    ['O2_LOW', 'Houston: your oxygen is trending down. Set MOXIE [1] to MAX and check it for damage.'],
    ['WATER_LOW', 'Houston: water reserves look low. Prioritize ice mining and pause the fuel plant [G] if needed.'],
    ['POWER_LOW', 'Houston: battery is low on our screens. Switch the reactor [2] to MAX tonight.'],
    ['FOOD_LOW', 'Houston: food stores are getting low. Keep the grow lights on and harvest on time.'],
    ['FUEL_BEHIND', `Houston: fuel is behind schedule for the launch. You need ${LAUNCH_FUEL_REQUIRED}% by Month ${TOTAL_MISSION_MONTHS}.`],
  ];
  for (const [key, text] of advice) {
    if (EARTH_CONDITIONS[key](eng) && Math.random() < 0.85) {
      return { ...base, text, condKey: key };
    }
  }

  const flavor: Array<[string, number]> = [
    ['Message from home: your families recorded a video. Everyone says they are proud of you.', 10],
    ['Houston: the science team loved your last data download. Keep it up!', 6],
    ['Houston: a school in Hermosillo named their robotics team after your mission.', 8],
    ['Houston: weather team sees calm skies for now. Good time for long drives.', 4],
    ['Houston: reminder to exercise 2 hours a day. Bones lose strength in low gravity.', 3],
    [`Houston: ${eng.samplesCollected > 0 ? 'your rock samples are the talk of the lab here!' : 'we are excited to see your first rock samples.'}`, 5],
  ];
  const [text, boost] = flavor[Math.floor(Math.random() * flavor.length)];
  return { ...base, text, condKey: null, moraleBoost: boost };
}
