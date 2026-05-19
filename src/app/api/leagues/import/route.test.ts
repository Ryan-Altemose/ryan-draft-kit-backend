import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@/shared/server/http-errors';
import { POST } from './route';

const {
  connectDbMock,
  getAuthenticatedUserIdMock,
  mapImportedLeagueToLeagueInputMock,
  upsertLeagueMock,
} = vi.hoisted(() => ({
  connectDbMock: vi.fn(),
  getAuthenticatedUserIdMock: vi.fn(),
  mapImportedLeagueToLeagueInputMock: vi.fn(),
  upsertLeagueMock: vi.fn(),
}));

vi.mock('@/shared/server/connect-db', () => ({
  connectDb: connectDbMock,
}));

vi.mock('@/shared/server/get-user-id', () => ({
  getAuthenticatedUserId: getAuthenticatedUserIdMock,
}));

vi.mock('@/features/Leagues/server/league-import.service', () => ({
  mapImportedLeagueToLeagueInput: mapImportedLeagueToLeagueInputMock,
}));

vi.mock('@/features/Leagues/server/leagues.service', () => ({
  leaguesService: {
    upsertLeague: upsertLeagueMock,
  },
}));

describe('POST /api/leagues/import', () => {
  beforeEach(() => {
    connectDbMock.mockReset();
    getAuthenticatedUserIdMock.mockReset();
    mapImportedLeagueToLeagueInputMock.mockReset();
    upsertLeagueMock.mockReset();

    getAuthenticatedUserIdMock.mockReturnValue('user-1');
  });

  it('creates a new imported league', async () => {
    mapImportedLeagueToLeagueInputMock.mockResolvedValue({
      externalId: 'imported-test',
      name: 'Imported League',
    });
    upsertLeagueMock.mockResolvedValue({
      _id: 'league-1',
      externalId: 'imported-test',
      name: 'Imported League',
    });

    const response = await POST(
      new Request('http://localhost:3002/api/leagues/import', {
        method: 'POST',
        body: JSON.stringify({
          importJson: {
            name: 'Imported League',
            format: 'roto',
            draftType: 'auction',
            battingCategories: ['R'],
            pitchingCategories: ['W'],
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
            teams: [{ name: 'Team 1' }],
          },
        }),
        headers: {
          'content-type': 'application/json',
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        _id: 'league-1',
        externalId: 'imported-test',
        name: 'Imported League',
      },
    });
    expect(connectDbMock).toHaveBeenCalledTimes(1);
    expect(upsertLeagueMock).toHaveBeenCalledWith('user-1', {
      externalId: 'imported-test',
      name: 'Imported League',
    });
  });

  it('returns validation errors', async () => {
    const response = await POST(
      new Request('http://localhost:3002/api/leagues/import', {
        method: 'POST',
        body: JSON.stringify({
          importJson: {
            name: '',
          },
        }),
        headers: {
          'content-type': 'application/json',
        },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
    });
    expect(mapImportedLeagueToLeagueInputMock).not.toHaveBeenCalled();
  });

  it('returns import service errors', async () => {
    mapImportedLeagueToLeagueInputMock.mockRejectedValue(
      new HttpError(400, 'Unknown player in import: Test Player'),
    );

    const response = await POST(
      new Request('http://localhost:3002/api/leagues/import', {
        method: 'POST',
        body: JSON.stringify({
          importJson: {
            name: 'Imported League',
            format: 'roto',
            draftType: 'auction',
            battingCategories: ['R'],
            pitchingCategories: ['W'],
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
            teams: [{ name: 'Team 1' }],
          },
        }),
        headers: {
          'content-type': 'application/json',
        },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: 'Unknown player in import: Test Player',
    });
  });
});
