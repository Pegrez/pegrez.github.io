import { getLmstFromElapsed, getZoneAt, isPointInCave } from './constants';
import { EngineState } from './types';

export interface MarsFact {
  title: string;
  text: string;
}

const GENERAL: MarsFact[] = [
  {
    title: 'CHAPEA, 2023–2024',
    text: 'Four volunteers lived 378 days in a 3D-printed Mars habitat at NASA Johnson, growing crops and doing simulated Marswalks.',
  },
  {
    title: 'MOXIE, 2021–2023',
    text: 'Perseverance's MOXIE made 122 g of oxygen from Mars air over 16 runs: about what a small dog breathes in 10 hours.',
  },
  {
    title: 'Phoenix lander, 2008',
    text: 'Phoenix scraped up bright chunks of ice just under the soil. They vanished in a few days as the ice turned to vapor.',
  },
  {
    title: 'Talking to Earth',
    text: 'A message takes 4 to 22 minutes each way between Mars and Earth, so crews must solve emergencies on their own.',
  },
  {
    title: 'Mars gravity',
    text: 'Gravity on Mars is 38% of Earth's. Long stays weaken bones and muscles, so crews exercise about 2 hours a day.',
  },
  {
    title: 'ISS water recycling, 2023',
    text: 'The ISS reached 98% water recovery, turning sweat, breath and urine back into drinking water.',
  },
];

// Picks a real event or fact that matches what the player is doing right now.
export function pickFact(eng: EngineState): MarsFact {
  const ev = eng.activeEvent.kind;
  if (ev === 'DUST_STORM_2018') {
    return {
      title: 'Opportunity, June 2018',
      text: 'A planet-wide dust storm blocked 99% of sunlight. Opportunity's solar panels starved and the rover never woke up again.',
    };
  }
  if (ev === 'SOLAR_FLARE_2024') {
    return {
      title: 'Curiosity, May 20, 2024',
      text: 'An X12 solar flare gave about 8 mSv at the surface in a day, like 30 chest X-rays. Caves or thick shielding cut that a lot.',
    };
  }
  if (ev === 'INSIGHT_MARSQUAKE_2021') {
    return {
      title: 'InSight, May 4, 2022',
      text: 'InSight recorded a magnitude 5 marsquake, the largest ever detected on another planet. It shook for over 6 hours.',
    };
  }
  if (ev === 'PERCHLORATE_DUST_2022') {
    return {
      title: 'InSight dust, 2022',
      text: 'Dust slowly covered InSight's solar panels until power ran out in December 2022, ending the mission.',
    };
  }
  const lm = getLmstFromElapsed(eng.elapsedSolSec);
  if (eng.player.inEvaSuit && eng.cold > 40) {
    return {
      title: 'Martian nights',
      text: 'Curiosity measures nights near −80 °C at Gale Crater. The thin air holds almost no heat, so it gets cold fast after sunset.',
    };
  }
  if (eng.player.inEvaSuit && isPointInCave(eng.player.x, eng.player.y)) {
    return {
      title: 'Lava tube skylights',
      text: 'Orbiters have photographed pit craters on Mars that may open into lava tubes, natural shelters from radiation.',
    };
  }
  if (eng.suit < 40) {
    return {
      title: 'Spacesuit wear, Apollo',
      text: 'Apollo moonwalkers found that sharp dust scratched visors and wore down suit joints after only three EVAs.',
    };
  }
  if (eng.drillingId !== null) {
    return {
      title: 'NASA SWIM project',
      text: 'NASA's Subsurface Water Ice Mapping combines orbital radar and heat data to find ice that could be just 1 m deep.',
    };
  }
  if (eng.player.inRover) {
    return {
      title: 'Lunar Roving Vehicle, 1971',
      text: 'Apollo 15–17 astronauts drove rovers up to about 7.6 km from their lander, always staying within walking distance home.',
    };
  }
  const zone = getZoneAt(eng.player.x, eng.player.y).id;
  if (zone === 'CRATER_FIELD') {
    return {
      title: 'Cheyava Falls, July 2024',
      text: 'Perseverance found a rock in Jezero with "leopard spots" that could be a sign of ancient microbes, or not. Scientists are still studying it.',
    };
  }
  if (zone === 'POLAR_CAP') {
    return {
      title: 'Mars polar caps',
      text: 'Mars's north polar cap is water ice up to about 3 km thick. In winter, a layer of frozen CO₂ (dry ice) covers it.',
    };
  }
  if (zone === 'VOLCANO') {
    return {
      title: 'Olympus Mons',
      text: 'Mars has the largest known volcano in the solar system, Olympus Mons, about 22 km high.',
    };
  }
  if (zone === 'ICE_PLAINS') {
    return {
      title: 'Heat Shield Rock, 2005',
      text: 'Opportunity found the first meteorite on another planet: a basketball-sized iron meteorite lying on the Martian plains.',
    };
  }
  if (lm.isNight) {
    return {
      title: 'Martian nights',
      text: 'Without a thick atmosphere, Mars loses heat quickly. Nights can drop below −70 °C even near the equator.',
    };
  }
  const i = Math.floor(eng.totalElapsedSec / 20) % GENERAL.length;
  return GENERAL[i];
}
