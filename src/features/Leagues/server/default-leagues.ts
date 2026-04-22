import type { LeagueInput } from '../types/leagues.types';

export const defaultLeagues: LeagueInput[] = [
  {
    externalId: 'draft-kit-standard-auction',
    name: 'Draft Kit Standard Auction',
    description: '12 teams',
    format: 'roto',
    draftType: 'auction',
    battingCategories: ['R', 'HR', 'RBI', 'SB', 'AVG'],
    pitchingCategories: ['W', 'SV', 'K', 'ERA', 'WHIP'],
    rosterSlots: {
      C: 1,
      '1B': 1,
      '2B': 1,
      '3B': 1,
      SS: 1,
      CI: 1,
      MI: 1,
      OF: 3,
      SP: 2,
      RP: 2,
      UTIL: 1,
      BENCH: 4,
    },
    totalBudget: 260,
    taken_players: [],
    teams: Array.from({ length: 12 }, (_, index) => [
      `team-${index + 1}`,
      `Team ${index + 1}`,
      260,
    ]),
    isDefault: true,
  },
];
