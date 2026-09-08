/** Starting 4–3–3 responsibilities, not abilities, legal restrictions or automatic movement. */
export const POSITION_BRIEFS = {
  goalkeeper:
    'Possession: safe outlet/distribution. Defend: guard ownGoal. Loss: recover goal position.',
  fullback:
    'Possession: overlap with cover. Defend: flank and inside channel. Loss: recover goal-side; partner stays deeper.',
  centre_back:
    'Possession: safe buildup; one advances with cover. Defend: central route to ownGoal. Loss: recover, never both press.',
  holding_midfielder:
    'Possession: outlet behind attack. Defend: screen centre backs and inside passes. Loss: recover goal-side.',
  central_midfielder:
    'Possession: support at different depths. Defend: track midfield runners. Loss: if one presses, the other drops.',
  winger:
    'Possession: width or timed onside runs. Defend: track wide outlets. Loss: recover along your flank.',
  striker:
    'Possession: receive to feet/run behind, attack box. Defend: lead covered press. Loss: screen an outlet.',
} as const;

export type StartingPosition = {
  role: keyof typeof POSITION_BRIEFS;
  side: 'left' | 'centre' | 'right';
};

const STARTING_POSITIONS: readonly StartingPosition[] = [
  { role: 'goalkeeper', side: 'centre' },
  { role: 'fullback', side: 'left' },
  { role: 'centre_back', side: 'left' },
  { role: 'centre_back', side: 'right' },
  { role: 'fullback', side: 'right' },
  { role: 'central_midfielder', side: 'left' },
  { role: 'holding_midfielder', side: 'centre' },
  { role: 'central_midfielder', side: 'right' },
  { role: 'winger', side: 'left' },
  { role: 'striker', side: 'centre' },
  { role: 'winger', side: 'right' },
];

/** Roster numbers 1–11 are validated by the existing state boundary. */
export function startingPosition(number: number): StartingPosition {
  return { ...STARTING_POSITIONS[number - 1]! };
}
