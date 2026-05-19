import { describe, expect, it } from 'vitest';
import { ImportedLeagueSchema } from './league-import.types';

describe('ImportedLeagueSchema', () => {
  it('accepts friendly import JSON with settings only', () => {
    const parsed = ImportedLeagueSchema.parse({
      name: 'Imported League',
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
        SP: 5,
        RP: 2,
        UTIL: 1,
        P: 0,
        BENCH: 5,
      },
      totalBudget: 260,
      teams: [{ name: 'Team 1' }, { name: 'Team 2' }],
    });

    expect(parsed.teams).toHaveLength(2);
    expect(parsed.leagueType).toBe('MLB');
  });

  it('accepts friendly import JSON with live draft state', () => {
    const parsed = ImportedLeagueSchema.parse({
      name: 'Imported League',
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
        SP: 5,
        RP: 2,
        UTIL: 1,
        P: 0,
        BENCH: 5,
      },
      totalBudget: 260,
      teams: [{ name: 'Team 1' }, { name: 'Team 2' }],
      taken_players: [
        {
          playerName: 'Ronald Acuna Jr.',
          teamName: 'Team 1',
          positionSlot: 'OF-0',
          price: 42,
          contract: 'A',
        },
      ],
      draft_picks: [
        {
          pickNumber: 1,
          nominatingTeamName: 'Team 1',
          winningTeamName: 'Team 1',
          playerName: 'Ronald Acuna Jr.',
          salary: 42,
        },
      ],
    });

    expect(parsed.taken_players?.[0]?.playerName).toBe('Ronald Acuna Jr.');
    expect(parsed.draft_picks?.[0]?.winningTeamName).toBe('Team 1');
  });

  it('rejects invalid import JSON', () => {
    const parsed = ImportedLeagueSchema.safeParse({
      name: '',
      format: 'roto',
      draftType: 'auction',
      battingCategories: ['NOT_A_STAT'],
      pitchingCategories: ['W'],
      rosterSlots: {
        C: -1,
        '1B': 1,
        '2B': 1,
        '3B': 1,
        SS: 1,
        CI: 1,
        MI: 1,
        OF: 3,
        SP: 5,
        RP: 2,
        UTIL: 1,
        P: 0,
        BENCH: 5,
      },
      teams: [],
    });

    expect(parsed.success).toBe(false);
  });
});
