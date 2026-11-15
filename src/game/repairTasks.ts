import { ModuleId } from './types';

export type RepairMechanic = 'VALVE' | 'WIRES' | 'REBOOT' | 'WELD' | 'BOLTS';

export interface RepairTaskDef {
  id: string;
  mechanic: RepairMechanic;
  title: string;
  hint: string;
}

// Hands-on tasks, themed on what each real system would need.
export const REPAIR_TASKS: Record<ModuleId, RepairTaskDef[]> = {
  o2: [
    { id: 'o2_bolts', mechanic: 'BOLTS', title: 'Open the MOXIE access panel', hint: 'Click every bolt (or press its number) before time runs out.' },
    { id: 'o2_weld', mechanic: 'WELD', title: 'Seal the cracked gas line', hint: 'Hold SPACE to weld. Keep the torch on the crack with A/D or the mouse.' },
    { id: 'o2_valve', mechanic: 'VALVE', title: 'Set the CO₂ intake pressure', hint: 'Press SPACE when the needle is in the green zone. 3 hits needed.' },
    { id: 'o2_reboot', mechanic: 'REBOOT', title: 'Reboot the electrolysis controller', hint: 'Watch the lights, then repeat the order with 1–4 or clicks.' },
  ],
  power: [
    { id: 'pw_wires', mechanic: 'WIRES', title: 'Rewire the power junction', hint: 'Click a wire on the left, then the matching color on the right.' },
    { id: 'pw_valve', mechanic: 'VALVE', title: 'Reset the main breaker', hint: 'Press SPACE when the needle is in the green zone. 3 hits needed.' },
    { id: 'pw_bolts', mechanic: 'BOLTS', title: 'Brush dust off the solar cells', hint: 'Click every dusty spot (or press its number).' },
    { id: 'pw_reboot', mechanic: 'REBOOT', title: 'Restart the reactor control computer', hint: 'Watch the lights, then repeat the order with 1–4 or clicks.' },
  ],
  food: [
    { id: 'fd_valve', mechanic: 'VALVE', title: 'Balance the nutrient valve', hint: 'Press SPACE when the needle is in the green zone. 3 hits needed.' },
    { id: 'fd_wires', mechanic: 'WIRES', title: 'Reconnect the water pump', hint: 'Click a wire on the left, then the matching color on the right.' },
    { id: 'fd_weld', mechanic: 'WELD', title: 'Patch the leaking water pipe', hint: 'Hold SPACE to seal. Keep the nozzle on the leak with A/D or the mouse.' },
    { id: 'fd_bolts', mechanic: 'BOLTS', title: 'Swap the burnt-out grow lamps', hint: 'Click every dead lamp (or press its number).' },
  ],
  shield: [
    { id: 'sh_weld', mechanic: 'WELD', title: 'Seal the water-wall bladder', hint: 'Hold SPACE to seal. Keep the nozzle on the seam with A/D or the mouse.' },
    { id: 'sh_wires', mechanic: 'WIRES', title: 'Rewire the radiation sensor', hint: 'Click a wire on the left, then the matching color on the right.' },
    { id: 'sh_reboot', mechanic: 'REBOOT', title: 'Reboot the dosimeter', hint: 'Watch the lights, then repeat the order with 1–4 or clicks.' },
    { id: 'sh_valve', mechanic: 'VALVE', title: 'Set the pump pressure', hint: 'Press SPACE when the needle is in the green zone. 3 hits needed.' },
  ],
};

export function buildRepairQueue(moduleId: ModuleId, count: number): RepairTaskDef[] {
  const list = [...REPAIR_TASKS[moduleId]];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list.slice(0, Math.max(1, Math.min(count, list.length)));
}

export interface RepairSession {
  active: boolean;
  moduleId: ModuleId;
  moduleName: string;
  nasaSystem: string;
  queue: RepairTaskDef[];
  stageIndex: number;
  // 'PANELS' = brushing the solar array instead of repairing a module
  purpose?: 'PANELS';
}

// Solar array cleaning: three quick brushing passes.
export function buildPanelQueue(): RepairTaskDef[] {
  const brush = REPAIR_TASKS.power.find((t) => t.id === 'pw_bolts')!;
  return [brush, { ...brush, title: 'Brush the second row of panels' }, { ...brush, title: 'Brush the last row and check the output' }];
}
