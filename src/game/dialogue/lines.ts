import { CrewRole } from '../types';

/**
 * Crew banter. Short exchanges shown in a small box that never pauses the game.
 *
 * The crew:
 * - Mateo Sheinbaum (Engineer): American, perfectionist, short fuse, lives by checklists.
 *   Gets exasperated with Xavier but genuinely tries to be patient, and quietly has his back.
 * - Xavier Netanyahu (Geologist): warm, earnest, brilliant with rocks, observant Jew who keeps
 *   Shabbat on Mars as best he can. Notices a single crystal from ten meters away and somehow
 *   misses the rover parked right behind him.
 * - Adrian Salido (Doctor): bookish, sarcastic, very hairy (his beard and helmet seals are at war).
 *   Quotes scientists and philosophers; also loses patience with Xavier, but with jokes.
 * - Grace Arpeba (Botanist): calm, upbeat, the crew's peacemaker. Names her plants, sings to the
 *   tomatoes, defends Xavier, and is secretly the most competitive person on the planet.
 */

export type DialogueTrigger =
  | 'START'
  | 'MONTH_2'
  | 'MONTH_3'
  | 'MONTH_4'
  | 'MONTH_5'
  | 'MONTH_6'
  | 'SHABBAT'
  | 'STORM'
  | 'FLARE'
  | 'QUAKE'
  | 'METEOR_HIT'
  | 'SAMPLE'
  | 'BIOSIGNATURE'
  | 'REPAIR_DONE'
  | 'REPAIR_FAIL'
  | 'LOW_FOOD'
  | 'LOW_WATER'
  | 'ROVER'
  | 'NIGHT_COLD'
  | 'HARVEST'
  | 'SOLO_EVA'
  | 'BUDDY_OUT'
  | 'PANELS_DIRTY'
  | 'PANELS_CLEANED'
  | 'DUST_INSIDE'
  | 'SEASON_STORM'
  | 'SEASON_CLEAR'
  | 'FAULT'
  | 'SWITCH_ENGINEER'
  | 'SWITCH_GEOLOGIST'
  | 'SWITCH_DOCTOR'
  | 'SWITCH_BOTANIST'
  | 'IDLE';

export interface DialogueLine {
  who: CrewRole;
  text: string;
}

export interface Conversation {
  id: string;
  trigger: DialogueTrigger;
  lines: DialogueLine[];
}

const M = 'ENGINEER' as const; // Mateo
const X = 'GEOLOGIST' as const; // Xavier
const A = 'DOCTOR' as const; // Adrian
const G = 'BOTANIST' as const; // Grace

export const CONVERSATIONS: Conversation[] = [
  // ---------------------------------------------------------------- start & months
  {
    id: 'start_1',
    trigger: 'START',
    lines: [
      { who: M, text: 'Okay, team. Habitat sealed, power stable, oxygen nominal. Day one on Mars.' },
      { who: X, text: 'Mateo, quick question. Which way is the airlock?' },
      { who: M, text: 'It has a giant yellow sign that says AIRLOCK, Xavier.' },
      { who: X, text: 'Ohhh. I thought that was decorative.' },
      { who: G, text: 'Be nice. It's his first day on a whole new planet.' },
      { who: M, text: 'It's all of our first day on a whole new planet, Grace.' },
    ],
  },
  {
    id: 'month_2',
    trigger: 'MONTH_2',
    lines: [
      { who: A, text: 'One month in. Medical report: everyone is healthy, and I have found three of my own hairs in the water filter.' },
      { who: M, text: 'That explains the clog.' },
      { who: A, text: 'Science demands sacrifices, Mateo.' },
    ],
  },
  {
    id: 'month_3',
    trigger: 'MONTH_3',
    lines: [
      { who: X, text: 'Orbital radar found a buried glacier in the Crater Field! A real one! Pure ice!' },
      { who: G, text: 'Water for my plants and fuel for the trip home. Xavier, I could hug you.' },
      { who: M, text: 'Please don't. He's still wearing his muddy boots in the clean zone.' },
      { who: X, text: '…I am?' },
    ],
  },
  {
    id: 'month_4',
    trigger: 'MONTH_4',
    lines: [
      { who: A, text: 'Halfway mark. Studies say this is when isolated crews get grumpy.' },
      { who: M, text: 'I'm not grumpy.' },
      { who: G, text: 'You told the coffee machine it was a disappointment this morning.' },
      { who: M, text: 'It IS a disappointment. It makes brown water.' },
    ],
  },
  {
    id: 'month_5',
    trigger: 'MONTH_5',
    lines: [
      { who: G, text: 'Five months! I made a little celebration cake out of rehydrated strawberries.' },
      { who: X, text: 'It's beautiful. Is it kosher?' },
      { who: G, text: 'Checked every package for you. Certified on Earth, baked on Mars.' },
      { who: X, text: 'Grace, you're the best person in this solar system.' },
    ],
  },
  {
    id: 'month_6',
    trigger: 'MONTH_6',
    lines: [
      { who: M, text: 'Final month. Fuel, samples, checklists. Nobody does anything creative.' },
      { who: X, text: 'What counts as creative?' },
      { who: M, text: 'Anything you were about to do, Xavier.' },
      { who: A, text: 'Ah, the engineer's philosophy: if it's working, don't let Xavier touch it.' },
    ],
  },
  // ---------------------------------------------------------------- Shabbat
  {
    id: 'shabbat_1',
    trigger: 'SHABBAT',
    lines: [
      { who: X, text: 'Shabbat starts soon. I'm lighting my candles. LED candles, Mateo, don't worry.' },
      { who: M, text: 'Thank you. Open flames and pure oxygen are my two least favorite things together.' },
      { who: A, text: 'How do you even count a week here? A Martian day is 39 minutes longer.' },
      { who: X, text: 'The rabbis are still arguing about it. I count seven sols and light them anyway.' },
      { who: G, text: 'Shabbat shalom, Xavier. Can we join you for dinner?' },
      { who: X, text: 'Everyone is welcome at my table. Even Mateo.' },
    ],
  },
  {
    id: 'shabbat_2',
    trigger: 'SHABBAT',
    lines: [
      { who: X, text: 'No work for me tonight. It's Shabbat. The rocks will still be here tomorrow.' },
      { who: M, text: 'Fine. I'll do the evening checklist. Again. Like always.' },
      { who: X, text: 'You love the checklist.' },
      { who: M, text: '…I do love the checklist.' },
      { who: G, text: 'Rest well, Xavier. Even Mars should take a day off sometimes.' },
    ],
  },
  {
    id: 'shabbat_3',
    trigger: 'SHABBAT',
    lines: [
      { who: A, text: 'Xavier, why are you facing the window like that?' },
      { who: X, text: 'Praying toward Jerusalem. Which, from here, is roughly… that bright dot. Earth.' },
      { who: A, text: 'That's Jupiter.' },
      { who: X, text: '…God knows what I meant.' },
    ],
  },
  // ---------------------------------------------------------------- disasters
  {
    id: 'storm_1',
    trigger: 'STORM',
    lines: [
      { who: M, text: 'Dust storm. Solar output is tanking. Reactor to MAX, everyone.' },
      { who: X, text: 'The sky turned orange! Did someone change the lighting settings?' },
      { who: M, text: 'It's. A. Dust. Storm. Xavier. We just said that.' },
      { who: G, text: 'Deep breaths, Mateo. Filtered ones.' },
    ],
  },
  {
    id: 'storm_2',
    trigger: 'STORM',
    lines: [
      { who: A, text: 'A storm like this killed the Opportunity rover in 2018. Fourteen years of service.' },
      { who: G, text: 'That's so sad. Its last message basically said "my battery is low and it's getting dark."' },
      { who: X, text: 'That was a poetic summary, not the real message, right?' },
      { who: A, text: 'Correct, but it still makes everyone cry.' },
    ],
  },
  {
    id: 'flare_1',
    trigger: 'FLARE',
    lines: [
      { who: A, text: 'Solar flare! Everyone inside the shielded areas. Now, please.' },
      { who: X, text: 'Is it safe to finish this one rock sample first?' },
      { who: A, text: 'Is it safe to absorb a month of radiation in one afternoon? Inside, Xavier.' },
    ],
  },
  {
    id: 'quake_1',
    trigger: 'QUAKE',
    lines: [
      { who: X, text: 'Marsquake! This is AMAZING. InSight would have loved this!' },
      { who: M, text: 'It cracked MOXIE, Xavier. Our oxygen machine. Not amazing.' },
      { who: X, text: 'Right. Sorry. Scientifically amazing, practically terrible.' },
      { who: M, text: 'Get me the toolkit. The red bag. No, the RED one.' },
    ],
  },
  {
    id: 'quake_2',
    trigger: 'QUAKE',
    lines: [
      { who: G, text: 'My tomato plants just did a little dance.' },
      { who: A, text: 'Everyone check for bruises. And Xavier, put your helmet down, you're holding it upside down.' },
      { who: X, text: 'Is that why it smelled like the inside of a helmet?' },
    ],
  },
  {
    id: 'meteor_1',
    trigger: 'METEOR_HIT',
    lines: [
      { who: M, text: 'Micrometeoroid hit. Mars has almost no atmosphere to slow them down.' },
      { who: X, text: 'Can we keep the meteorite? For science?' },
      { who: M, text: 'It's embedded in our equipment. So technically, yes.' },
    ],
  },
  // ---------------------------------------------------------------- science
  {
    id: 'sample_1',
    trigger: 'SAMPLE',
    lines: [
      { who: X, text: 'Look at these layers! This rock sat at the bottom of a lake billions of years ago.' },
      { who: G, text: 'You can see all that from one rock?' },
      { who: X, text: 'I can see everything in a rock. I just can't find my gloves.' },
      { who: A, text: 'They're on your hands.' },
    ],
  },
  {
    id: 'sample_2',
    trigger: 'SAMPLE',
    lines: [
      { who: X, text: 'Another sample sealed. Perseverance did this exact thing, tube by tube.' },
      { who: M, text: 'Did you label it this time?' },
      { who: X, text: 'Yes! "Rock."' },
      { who: M, text: 'Xavier. They are ALL rocks.' },
    ],
  },
  {
    id: 'bio_1',
    trigger: 'BIOSIGNATURE',
    lines: [
      { who: A, text: 'Everyone. Come look at the lab results. Right now.' },
      { who: X, text: 'Those patterns… microbes could have made those. Ancient life. Maybe.' },
      { who: G, text: 'I'm getting goosebumps. Is that a medical symptom, Adrian?' },
      { who: A, text: 'It's the correct reaction to possibly not being alone in the universe.' },
      { who: M, text: 'Okay. I take back every annoyed thing I ever said, Xavier. Most of them.' },
    ],
  },
  // ---------------------------------------------------------------- repairs
  {
    id: 'repair_ok_1',
    trigger: 'REPAIR_DONE',
    lines: [
      { who: M, text: 'Fixed. See? Follow the checklist, the machine follows you.' },
      { who: X, text: 'I followed the checklist last week.' },
      { who: M, text: 'You followed the checklist for the coffee machine. On the oxygen system.' },
    ],
  },
  {
    id: 'repair_ok_2',
    trigger: 'REPAIR_DONE',
    lines: [
      { who: A, text: 'Nice repair. Thomas Edison said genius is 1% inspiration, 99% perspiration.' },
      { who: M, text: 'In a spacesuit it's 100% perspiration.' },
    ],
  },
  {
    id: 'repair_fail_1',
    trigger: 'REPAIR_FAIL',
    lines: [
      { who: M, text: 'That did NOT go well. Okay. Deep breath. I am being nice. I am being calm.' },
      { who: G, text: 'You're doing great. Try again.' },
      { who: M, text: 'Thanks, Grace. Xavier, please stop handing me the wrong wrench.' },
      { who: X, text: 'They all look the same!' },
    ],
  },
  // ---------------------------------------------------------------- resources & life
  {
    id: 'food_low',
    trigger: 'LOW_FOOD',
    lines: [
      { who: G, text: 'Food is getting low. Harvest what's ripe and plant more seeds, please.' },
      { who: X, text: 'I could skip dinner. I had a big lunch.' },
      { who: A, text: 'You had a protein bar, Xavier. That is not a big lunch. That is a snack with ambition.' },
    ],
  },
  {
    id: 'water_low',
    trigger: 'LOW_WATER',
    lines: [
      { who: M, text: 'Water tank's dropping. We need ice from outside: scan, sample, drill.' },
      { who: X, text: 'On it! Ice is basically a mineral. My favorite kind of chore.' },
    ],
  },
  {
    id: 'harvest_1',
    trigger: 'HARVEST',
    lines: [
      { who: G, text: 'Harvest! Say goodbye to Gerald, everyone. He was a very good tomato plant.' },
      { who: M, text: 'You named the tomato plant.' },
      { who: G, text: 'I named all of them. You're eating Gerald's children.' },
      { who: A, text: 'I'm a doctor and I have never been more uncomfortable.' },
    ],
  },
  {
    id: 'harvest_2',
    trigger: 'HARVEST',
    lines: [
      { who: G, text: 'Fresh lettuce on Mars. Astronauts on the space station grew some too, in 2015.' },
      { who: X, text: 'Can I add salt? Mars dirt has lots of salt.' },
      { who: G, text: 'Mars dirt has toxic perchlorate salts. Please never do that.' },
    ],
  },
  {
    id: 'rover_1',
    trigger: 'ROVER',
    lines: [
      { who: X, text: 'Has anyone seen the rover? I've been looking for ten minutes.' },
      { who: M, text: 'You are leaning on it, Xavier.' },
      { who: X, text: 'Oh. That's why it felt so supportive.' },
    ],
  },
  {
    id: 'rover_2',
    trigger: 'ROVER',
    lines: [
      { who: M, text: 'Rover rules: watch the battery, stay out of deep dust, and no off-road joyriding.' },
      { who: G, text: 'Define joyriding.' },
      { who: M, text: 'Whatever you did yesterday, Grace.' },
    ],
  },
  {
    id: 'cold_1',
    trigger: 'NIGHT_COLD',
    lines: [
      { who: A, text: 'It's minus 80 out there. Whoever is outside: come back in before your fingers stop working.' },
      { who: X, text: 'My suit says I'm fine.' },
      { who: A, text: 'Your suit also says "check visor seal" and you've ignored that for an hour.' },
    ],
  },
  // ---------------------------------------------------------------- EVA buddies
  {
    id: 'solo_1',
    trigger: 'SOLO_EVA',
    lines: [
      { who: A, text: 'Did someone just go outside alone? Rule number one: nobody walks on Mars without a buddy.' },
      { who: M, text: 'It's in the checklist. Page one. In bold.' },
    ],
  },
  {
    id: 'solo_2',
    trigger: 'SOLO_EVA',
    lines: [
      { who: G, text: 'Going out by yourself? Please take someone next time. I worry.' },
      { who: X, text: 'I'll come next time! I'll even remember my helmet.' },
    ],
  },
  {
    id: 'solo_3',
    trigger: 'SOLO_EVA',
    lines: [
      { who: M, text: 'Solo EVA. Bold. Also against every rule NASA ever wrote.' },
      { who: A, text: 'If you collapse out there, nobody can carry you back. Just saying.' },
    ],
  },
  {
    id: 'buddy_1',
    trigger: 'BUDDY_OUT',
    lines: [
      { who: X, text: 'EVA buddies! Like hiking partners, but the mountain wants to freeze us.' },
      { who: M, text: 'Stay within sight, Xavier. Within. Sight.' },
    ],
  },
  {
    id: 'buddy_2',
    trigger: 'BUDDY_OUT',
    lines: [
      { who: A, text: 'Suit checks: pressure good, oxygen good, beard… mostly contained.' },
      { who: G, text: 'Your beard is a hazard, Adrian. A soft, fluffy hazard.' },
    ],
  },
  {
    id: 'buddy_3',
    trigger: 'BUDDY_OUT',
    lines: [
      { who: G, text: 'I love going out together. Look at that sky. Pinkish-orange all day.' },
      { who: X, text: 'That's dust in the air. Iron oxide. Rust, basically. The whole planet is rusty.' },
      { who: G, text: 'Rusty and beautiful.' },
    ],
  },
  {
    id: 'buddy_4',
    trigger: 'BUDDY_OUT',
    lines: [
      { who: M, text: 'Okay. You walk, I watch your suit readings. If anything blinks red, we turn around.' },
      { who: X, text: 'What if something blinks yellow?' },
      { who: M, text: 'Then I get nervous and we turn around slower.' },
    ],
  },
  // ---------------------------------------------------------------- solar panels
  {
    id: 'panels_dirty_1',
    trigger: 'PANELS_DIRTY',
    lines: [
      { who: M, text: 'Solar output is down. The panels are covered in dust again.' },
      { who: X, text: 'Maybe the wind will clean them? It happened to Spirit and Opportunity!' },
      { who: M, text: 'Or we could not gamble our power on the weather and grab a brush.' },
    ],
  },
  {
    id: 'panels_dirty_2',
    trigger: 'PANELS_DIRTY',
    lines: [
      { who: G, text: 'My grow lights are dimming. Is it the panels?' },
      { who: M, text: 'It's always the panels. Mars is basically a giant dust machine.' },
    ],
  },
  {
    id: 'panels_clean_1',
    trigger: 'PANELS_CLEANED',
    lines: [
      { who: M, text: 'Panels are clean. Look at that power curve go up. Beautiful.' },
      { who: A, text: 'That's the happiest I've seen you in weeks.' },
    ],
  },
  {
    id: 'panels_clean_2',
    trigger: 'PANELS_CLEANED',
    lines: [
      { who: X, text: 'Done brushing! I only brushed one panel twice by accident.' },
      { who: M, text: 'And skipped the last one completely. I'll get it. It's fine. I'm being nice.' },
    ],
  },
  // ---------------------------------------------------------------- dust indoors
  {
    id: 'dust_in_1',
    trigger: 'DUST_INSIDE',
    lines: [
      { who: A, text: 'Who tracked dust in? Martian dust has perchlorates. They're bad for the thyroid.' },
      { who: X, text: 'Not me. Probably not me. …Maybe me.' },
      { who: A, text: 'Suit station. Every time you come in. I will tattoo it on your glove.' },
    ],
  },
  {
    id: 'dust_in_2',
    trigger: 'DUST_INSIDE',
    lines: [
      { who: G, text: 'There's red dust on my lettuce. Please, everyone, clean your suits when you come in.' },
      { who: M, text: 'Apollo astronauts said Moon dust smelled like gunpowder. Mars dust smells like trouble.' },
    ],
  },
  // ---------------------------------------------------------------- seasons & faults
  {
    id: 'season_storm',
    trigger: 'SEASON_STORM',
    lines: [
      { who: X, text: 'Southern summer is starting. Mars is at its closest to the Sun, and that stirs up the dust.' },
      { who: M, text: 'Translation: storm season. Keep the panels clean and the reactor ready.' },
      { who: A, text: 'And keep your EVAs short. I'm not treating frostbite AND sandblasted faces.' },
    ],
  },
  {
    id: 'season_clear',
    trigger: 'SEASON_CLEAR',
    lines: [
      { who: G, text: 'The skies are clearing up! Storm season is over.' },
      { who: M, text: 'Mostly over. Don't jinx it.' },
    ],
  },
  {
    id: 'fault_1',
    trigger: 'FAULT',
    lines: [
      { who: M, text: 'Another little fault. Nothing's exploding, things just wear out. That's real life on Mars.' },
      { who: X, text: 'Like my socks.' },
      { who: M, text: 'Please don't compare the oxygen system to your socks.' },
    ],
  },
  {
    id: 'fault_2',
    trigger: 'FAULT',
    lines: [
      { who: A, text: 'The ISS crew spends hours every week on maintenance. We're no different.' },
      { who: M, text: 'Except they can get spare parts delivered. We get a 3D printer and hope.' },
    ],
  },
  // ---------------------------------------------------------------- taking control of someone
  { id: 'sw_m1', trigger: 'SWITCH_ENGINEER', lines: [{ who: M, text: 'Mateo here. Let's get things done properly. With a checklist.' }] },
  { id: 'sw_m2', trigger: 'SWITCH_ENGINEER', lines: [{ who: M, text: 'Fine, I'll do it. If you want it done right…' }] },
  { id: 'sw_x1', trigger: 'SWITCH_GEOLOGIST', lines: [{ who: X, text: 'Xavier reporting! Are there rocks involved? Please say there are rocks.' }] },
  { id: 'sw_x2', trigger: 'SWITCH_GEOLOGIST', lines: [{ who: X, text: 'Ready! Has anyone seen my other glove? Oh, found it. It was on my hand.' }] },
  { id: 'sw_a1', trigger: 'SWITCH_DOCTOR', lines: [{ who: A, text: 'Doctor Salido, at your service. Try not to get anyone injured.' }] },
  { id: 'sw_a2', trigger: 'SWITCH_DOCTOR', lines: [{ who: A, text: 'As Marie Curie said: nothing in life is to be feared, only understood. Let's go understand.' }] },
  { id: 'sw_g1', trigger: 'SWITCH_BOTANIST', lines: [{ who: G, text: 'Grace here! The plants can water themselves for a bit. Probably.' }] },
  { id: 'sw_g2', trigger: 'SWITCH_BOTANIST', lines: [{ who: G, text: 'Let's make this a good one. And let's win at something.' }] },
  // ---------------------------------------------------------------- more everyday life
  {
    id: 'idle_kosher',
    trigger: 'IDLE',
    lines: [
      { who: X, text: 'NASA packed kosher meals for me. The labels are so small. Is this the chicken?' },
      { who: A, text: 'That's the dessert, Xavier.' },
      { who: X, text: 'Then dessert first. It's been a long day.' },
    ],
  },
  {
    id: 'idle_bones',
    trigger: 'IDLE',
    lines: [
      { who: A, text: 'Reminder: two hours of exercise a day. In low gravity your bones get weaker.' },
      { who: M, text: 'I bike while reading checklists. Multitasking.' },
      { who: G, text: 'I garden very aggressively. Does that count?' },
      { who: A, text: 'No.' },
    ],
  },
  {
    id: 'idle_music',
    trigger: 'IDLE',
    lines: [
      { who: G, text: 'Music night! Everyone picks one song.' },
      { who: M, text: 'Something with guitars. Real music.' },
      { who: X, text: 'I brought a playlist of songs about rocks. It's mostly rock songs.' },
      { who: A, text: 'Of course it is.' },
    ],
  },
  {
    id: 'idle_hair',
    trigger: 'IDLE',
    lines: [
      { who: M, text: 'Adrian, the vacuum filter is full of hair. Again.' },
      { who: A, text: 'My body hair is a natural insulator. I'm basically a thermal blanket.' },
      { who: G, text: 'He's right, honestly. I sit next to him on cold nights.' },
    ],
  },
  {
    id: 'idle_xavier_map',
    trigger: 'IDLE',
    lines: [
      { who: X, text: 'I've mapped every rock in the Crater Field. Every single one.' },
      { who: M, text: 'And yet yesterday you walked into the airlock door. Twice.' },
      { who: X, text: 'The door is not a rock. It's outside my expertise.' },
    ],
  },
  {
    id: 'idle_grace_win',
    trigger: 'IDLE',
    lines: [
      { who: G, text: 'Mateo, want to bet on who grows the bigger tomato?' },
      { who: M, text: 'I don't grow tomatoes, Grace.' },
      { who: G, text: 'So I win by default. I love that for me.' },
    ],
  },
  {
    id: 'idle_stars',
    trigger: 'IDLE',
    lines: [
      { who: A, text: 'Phobos is up tonight. That moon is slowly falling toward Mars, you know.' },
      { who: X, text: 'Should we move?' },
      { who: A, text: 'It will take about 50 million years, Xavier.' },
      { who: X, text: 'Okay. I'll pack slowly.' },
    ],
  },
  {
    id: 'idle_mateo_soft',
    trigger: 'IDLE',
    lines: [
      { who: X, text: 'Mateo, I'm sorry I keep messing things up.' },
      { who: M, text: '…You don't mess everything up. You found the glacier. That saved this mission.' },
      { who: X, text: 'Really?' },
      { who: M, text: 'Don't make it weird. Go label your rocks.' },
    ],
  },
  {
    id: 'idle_havdalah',
    trigger: 'IDLE',
    lines: [
      { who: X, text: 'I brought spices for Havdalah, the end of Shabbat. Smell this.' },
      { who: G, text: 'Cinnamon and cloves. It smells like home.' },
      { who: A, text: 'Smell is strongly linked to memory. That's why it hits so hard up here.' },
    ],
  },
  // ---------------------------------------------------------------- idle chatter
  {
    id: 'idle_beard',
    trigger: 'IDLE',
    lines: [
      { who: A, text: 'My beard is fighting my helmet seal again.' },
      { who: M, text: 'You could shave it.' },
      { who: A, text: 'And lose half my personality? Never.' },
    ],
  },
  {
    id: 'idle_coffee',
    trigger: 'IDLE',
    lines: [
      { who: M, text: 'What I would give for one real cup of coffee.' },
      { who: G, text: 'I could try growing coffee plants.' },
      { who: M, text: 'Grace, if you do that I will name my first child after you.' },
    ],
  },
  {
    id: 'idle_singing',
    trigger: 'IDLE',
    lines: [
      { who: G, text: '♪ Grow, little seedlings, reach for the lamp… ♪' },
      { who: X, text: 'Does singing actually help plants grow?' },
      { who: G, text: 'Science says probably not. My plants say yes.' },
    ],
  },
  {
    id: 'idle_earth',
    trigger: 'IDLE',
    lines: [
      { who: X, text: 'I miss my grandmother's challah. Fresh, still warm from the oven.' },
      { who: G, text: 'Teach me the recipe. We have flour, and the oven works.' },
      { who: X, text: 'You'd do that?' },
      { who: G, text: 'Of course. Mars needs a good bakery.' },
    ],
  },
  {
    id: 'idle_philosophy',
    trigger: 'IDLE',
    lines: [
      { who: A, text: 'Carl Sagan said we are a way for the universe to know itself.' },
      { who: X, text: 'So right now the universe is learning that I left the airlock light on?' },
      { who: M, text: 'YOU LEFT THE AIRLOCK LIGHT ON?' },
    ],
  },
  {
    id: 'idle_lost',
    trigger: 'IDLE',
    lines: [
      { who: X, text: 'Good news, I found the missing torque wrench!' },
      { who: M, text: 'Great. Where was it?' },
      { who: X, text: 'In my pocket. Since Tuesday.' },
      { who: M, text: 'I took the whole power panel apart looking for it. Okay. I'm being nice. I'm being nice.' },
    ],
  },
  {
    id: 'idle_competition',
    trigger: 'IDLE',
    lines: [
      { who: G, text: 'Weekly scoreboard: I grew 4 kilos of vegetables. What did everyone else make?' },
      { who: A, text: 'Medical reports.' },
      { who: M, text: 'Repairs. Lots of repairs.' },
      { who: X, text: 'Friends with a rock.' },
      { who: G, text: 'So I win again. Lovely.' },
    ],
  },
  {
    id: 'idle_view',
    trigger: 'IDLE',
    lines: [
      { who: X, text: 'Look at the sunset. On Mars, sunsets are blue.' },
      { who: A, text: 'Fine dust scatters blue light forward near the sun. Curiosity photographed it.' },
      { who: M, text: 'It's… actually really beautiful.' },
      { who: G, text: 'Mateo said something nice! Everyone write down the time.' },
    ],
  },
];

export const CREW_VOICE: Record<CrewRole, { short: string; color: string }> = {
  ENGINEER: { short: 'Mateo', color: '#f97316' },
  GEOLOGIST: { short: 'Xavier', color: '#eab308' },
  DOCTOR: { short: 'Adrian', color: '#ef4444' },
  BOTANIST: { short: 'Grace', color: '#22c55e' },
};
