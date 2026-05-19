import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImportedLeagueInput } from '../types/league-import.types';
import { mapImportedLeagueToLeagueInput } from './league-import.service';

function buildImportedLeague(
  overrides: Partial<ImportedLeagueInput> = {},
): ImportedLeagueInput {
  return {
    name: 'Imported League',
    description: 'Imported from JSON',
    format: 'roto',
    draftType: 'auction',
    leagueType: 'MLB',
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
    ...overrides,
  };
}

describe('mapImportedLeagueToLeagueInput', () => {
  const originalApiUrl = process.env.API_URL;
  const originalPublicApiUrl = process.env.NEXT_PUBLIC_API_URL;
  const originalApiKey = process.env.NEXT_PUBLIC_API_KEY;
  const fetchMock = vi.fn();

  beforeEach(() => {
    process.env.API_URL = 'https://api.example.com';
    process.env.NEXT_PUBLIC_API_KEY = 'draft-kit_test';
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    process.env.API_URL = originalApiUrl;
    process.env.NEXT_PUBLIC_API_URL = originalPublicApiUrl;
    process.env.NEXT_PUBLIC_API_KEY = originalApiKey;
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('maps friendly import JSON into LeagueInput with generated ids', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ _id: 'player-1', name: 'Ronald Acuna Jr.' }],
        pagination: { totalPages: 1 },
      }),
    });

    const result = await mapImportedLeagueToLeagueInput(buildImportedLeague());

    expect(result.externalId).toMatch(/^imported-imported-league-/);
    expect(result.teams).toEqual([
      ['team-1', 'Team 1', 218],
      ['team-2', 'Team 2', 260],
    ]);
    expect(result.taken_players).toEqual([['player-1', 'team-1', 'OF-0', 42, 'A']]);
    expect(result.draft_picks).toEqual([[1, 'team-1', 'team-1', 'player-1', 42]]);
  });

  it('preserves imported team budgets when provided', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ _id: 'player-1', name: 'Ronald Acuna Jr.' }],
        pagination: { totalPages: 1 },
      }),
    });

    const result = await mapImportedLeagueToLeagueInput(
      buildImportedLeague({
        teams: [
          { name: 'Team 1', budget: 111 },
          { name: 'Team 2', budget: 222 },
        ],
      }),
    );

    expect(result.teams).toEqual([
      ['team-1', 'Team 1', 111],
      ['team-2', 'Team 2', 222],
    ]);
  });

  it('matches player names when accents are omitted in the import JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ _id: 'player-1', name: 'Ronald Acuna Jr.' }],
        pagination: { totalPages: 1 },
      }),
    });

    const result = await mapImportedLeagueToLeagueInput(
      buildImportedLeague({
        taken_players: [
          {
            playerName: 'Ronald Acuña Jr.',
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
            playerName: 'Ronald Acuña Jr.',
            salary: 42,
          },
        ],
      }),
    );

    expect(result.taken_players).toEqual([['player-1', 'team-1', 'OF-0', 42, 'A']]);
    expect(result.draft_picks).toEqual([[1, 'team-1', 'team-1', 'player-1', 42]]);
  });

  it('matches player names when the player API returns accents and the import does not', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ _id: 'player-1', name: 'Ronald Acuña Jr.' }],
        pagination: { totalPages: 1 },
      }),
    });

    const result = await mapImportedLeagueToLeagueInput(buildImportedLeague());

    expect(result.taken_players).toEqual([['player-1', 'team-1', 'OF-0', 42, 'A']]);
    expect(result.draft_picks).toEqual([[1, 'team-1', 'team-1', 'player-1', 42]]);
  });

  it('rejects unknown player names', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ _id: 'player-2', name: 'Mookie Betts' }],
        pagination: { totalPages: 1 },
      }),
    });

    await expect(mapImportedLeagueToLeagueInput(buildImportedLeague())).rejects.toMatchObject({
      message: 'Unknown player in import: Ronald Acuna Jr.',
      status: 400,
    });
  });

  it('rejects ambiguous player names', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { _id: 'player-1', name: 'Ronald Acuna Jr.' },
          { _id: 'player-2', name: 'Ronald Acuna Jr.' },
        ],
        pagination: { totalPages: 1 },
      }),
    });

    await expect(mapImportedLeagueToLeagueInput(buildImportedLeague())).rejects.toMatchObject({
      message: 'Ambiguous player name in import: Ronald Acuna Jr.',
      status: 400,
    });
  });

  it('rejects duplicate player usage', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { _id: 'player-1', name: 'Ronald Acuna Jr.' },
          { _id: 'player-2', name: 'Mookie Betts' },
        ],
        pagination: { totalPages: 1 },
      }),
    });

    const importedLeague = buildImportedLeague({
      taken_players: [
        {
          playerName: 'Ronald Acuna Jr.',
          teamName: 'Team 1',
          positionSlot: 'OF-0',
          price: 42,
        },
        {
          playerName: 'Ronald Acuna Jr.',
          teamName: 'Team 2',
          positionSlot: 'OF-1',
          price: 41,
        },
      ],
      draft_picks: [],
    });

    await expect(mapImportedLeagueToLeagueInput(importedLeague)).rejects.toMatchObject({
      message: 'Duplicate player in import: Ronald Acuna Jr.',
      status: 400,
    });
  });

  it('rejects inconsistent draft state', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ _id: 'player-1', name: 'Ronald Acuna Jr.' }],
        pagination: { totalPages: 1 },
      }),
    });

    const importedLeague = buildImportedLeague({
      taken_players: [
        {
          playerName: 'Ronald Acuna Jr.',
          teamName: 'Team 2',
          positionSlot: 'OF-0',
          price: 42,
        },
      ],
    });

    await expect(mapImportedLeagueToLeagueInput(importedLeague)).rejects.toMatchObject({
      message: 'draft_picks and taken_players disagree for player: Ronald Acuna Jr.',
      status: 400,
    });
  });

  it('requires either totalBudget or explicit team budgets', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [],
        pagination: { totalPages: 1 },
      }),
    });

    const importedLeague = buildImportedLeague({
      totalBudget: undefined,
      teams: [{ name: 'Team 1' }, { name: 'Team 2' }],
      taken_players: [],
      draft_picks: [],
    });

    await expect(mapImportedLeagueToLeagueInput(importedLeague)).rejects.toMatchObject({
      message: 'totalBudget is required when imported teams do not include budgets',
      status: 400,
    });
  });
});
