import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { ForbiddenError } from '@/shared/server/http-errors';
import { connectDb } from '@/shared/server/connect-db';
import { LeagueModel } from './leagues.model';
import { LeaguesService } from './leagues.service';
import { UserModel } from '@/features/Users/server/users.model';
import { usersService } from '@/features/Users/server/users.service';

const envPath = path.resolve(process.cwd(), '.env.local');
const envTextForCheck = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const hasMongoConfig =
  Boolean(process.env.MONGODB_URI) ||
  /(^|\n)\s*MONGODB_URI\s*=/.test(envTextForCheck);
const describeWithMongo = hasMongoConfig ? describe : describe.skip;

function loadLocalMongoEnv() {
  if (process.env.MONGODB_URI) {
    return;
  }

  const envText = fs.readFileSync(envPath, 'utf8');

  for (const line of envText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex);
    const value = trimmed.slice(equalsIndex + 1);

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

describeWithMongo('LeaguesService', () => {
  const service = new LeaguesService();
  const testPrefix = 'vitest-league-service';
  const searchToken = testPrefix.replace(/-/g, '');

  beforeAll(async () => {
    loadLocalMongoEnv();
    await connectDb();
  });

  beforeEach(async () => {
    await LeagueModel.deleteMany({
      externalId: { $regex: `^${testPrefix}` },
    });
    await UserModel.deleteMany({
      externalId: { $regex: `^${testPrefix}` },
    });

    primaryUserId = (
      await usersService.getOrCreateUser({
        name: 'Primary Test User',
        externalId: `${testPrefix}-primary-user`,
      })
    )._id;

    secondaryUserId = (
      await usersService.getOrCreateUser({
        name: 'Secondary Test User',
        externalId: `${testPrefix}-secondary-user`,
      })
    )._id;
  });

  afterAll(async () => {
    await LeagueModel.deleteMany({
      externalId: { $regex: `^${testPrefix}` },
    });
    await UserModel.deleteMany({
      externalId: { $regex: `^${testPrefix}` },
    });
    await mongoose.disconnect();
  });

  it('performs real create and read against MongoDB', async () => {
    const created = await service.upsertLeague(primaryUserId, {
      externalId: `${testPrefix}-crud`,
      name: 'Vitest CRUD League',
      description: 'CRUD integration test',
      format: 'roto',
      draftType: 'auction',
      battingCategories: ['R', 'HR', 'RBI', 'SB', 'AVG'],
      pitchingCategories: ['W', 'SV', 'K', 'ERA', 'WHIP'],
      rosterSlots: {
        C: 1,
        '1B': 1,
        '2B': 1,
        '3B': 1,
        CI: 0,
        MI: 0,
        SS: 1,
        OF: 3,
        SP: 5,
        RP: 2,
        UTIL: 0,
        BENCH: 0,
      },
      totalBudget: 260,
      taken_players: [],
      teams: [['team-1', 'Team 1', 260]],
      isDefault: false,
    });

    const byId = await service.getLeagueById(created._id, primaryUserId);
    const byExternalId = await service.getLeagueByExternalId(
      `${testPrefix}-crud`,
      primaryUserId,
    );

    expect(byId?._id.toString()).toBe(created._id.toString());
    expect(byExternalId?.name).toBe('Vitest CRUD League');
    expect(String(byId?.userId)).toBe(String(primaryUserId));
  });

  it('performs real filter and pagination queries against MongoDB', async () => {
    await service.upsertLeagues(primaryUserId, [
      {
        externalId: `${testPrefix}-default`,
        name: `${searchToken} Default League`,
        description: `${searchToken} default`,
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
          CI: 0,
          MI: 0,
          OF: 3,
          SP: 5,
          RP: 2,
          UTIL: 0,
          BENCH: 0,
        },
        totalBudget: 260,
        isDefault: true,
      },
      {
        externalId: `${testPrefix}-snake`,
        name: `${searchToken} Snake League`,
        description: `${searchToken} snake`,
        format: 'roto',
        draftType: 'snake',
        battingCategories: ['R', 'HR', 'RBI', 'SB', 'AVG'],
        pitchingCategories: ['W', 'SV', 'K', 'ERA', 'WHIP'],
        rosterSlots: {
          C: 1,
          '1B': 1,
          '2B': 1,
          '3B': 1,
          SS: 1,
          CI: 0,
          MI: 0,
          OF: 3,
          SP: 5,
          RP: 2,
          UTIL: 0,
          BENCH: 0,
        },
        totalBudget: 260,
        isDefault: false,
      },
    ]);

    const filtered = await service.getLeagues(primaryUserId, {
      format: 'roto',
      draftType: 'auction',
      isDefault: true,
      search: searchToken,
      page: 1,
      limit: 10,
    });

    expect(filtered.leagues).toHaveLength(1);
    expect(filtered.leagues[0].externalId).toBe(`${testPrefix}-default`);
    expect(filtered.pagination.total).toBe(1);
  });

  it('performs a real delete against MongoDB', async () => {
    const created = await service.upsertLeague(primaryUserId, {
      externalId: `${testPrefix}-delete`,
      name: 'Delete Me',
      description: 'delete',
      format: 'roto',
      draftType: 'auction',
      battingCategories: ['R', 'HR', 'RBI', 'SB', 'AVG'],
      pitchingCategories: ['W', 'SV', 'K', 'ERA', 'WHIP'],
      rosterSlots: {
        C: 1,
        '1B': 1,
        '2B': 1,
        '3B': 1,
        CI: 1,
        MI: 1,
        SS: 1,
        OF: 3,
        SP: 2,
        RP: 2,
        UTIL: 0,
        BENCH: 0,
      },
      totalBudget: 260,
      isDefault: false,
    });

    const deleted = await service.deleteLeagueById(created._id, primaryUserId);
    const reloaded = await service.getLeagueById(created._id, primaryUserId);

    expect(deleted?._id.toString()).toBe(created._id.toString());
    expect(reloaded).toBeNull();
  });

  it('does not wipe draft_picks when omitted from update payload', async () => {
    const externalId = `${testPrefix}-preserve-draft-picks`;

    await service.upsertLeague(primaryUserId, {
      externalId,
      name: 'Preserve Draft Picks League',
      description: 'preserve draft_picks regression test',
      format: 'roto',
      draftType: 'auction',
      battingCategories: ['R', 'HR', 'RBI', 'SB', 'AVG'],
      pitchingCategories: ['W', 'SV', 'K', 'ERA', 'WHIP'],
      rosterSlots: {
        C: 1,
        '1B': 1,
        '2B': 1,
        '3B': 1,
        CI: 0,
        MI: 0,
        SS: 1,
        OF: 3,
        SP: 5,
        RP: 2,
        UTIL: 0,
        BENCH: 0,
      },
      totalBudget: 260,
      taken_players: [],
      draft_picks: [[1, 'team-1', 'team-1', 'player-1', 10]],
      teams: [['team-1', 'Team 1', 250]],
      isDefault: false,
    });

    await service.upsertLeague(primaryUserId, {
      externalId,
      name: 'Preserve Draft Picks League',
      description: 'preserve draft_picks regression test',
      format: 'roto',
      draftType: 'auction',
      battingCategories: ['R', 'HR', 'RBI', 'SB', 'AVG'],
      pitchingCategories: ['W', 'SV', 'K', 'ERA', 'WHIP'],
      rosterSlots: {
        C: 1,
        '1B': 1,
        '2B': 1,
        '3B': 1,
        CI: 0,
        MI: 0,
        SS: 1,
        OF: 3,
        SP: 5,
        RP: 2,
        UTIL: 0,
        BENCH: 0,
      },
      totalBudget: 260,
      taken_players: [['player-2', 'team-1', 'DRAFT', 5]],
      teams: [['team-1', 'Team 1', 245]],
      isDefault: false,
    });

    const reloaded = await service.getLeagueByExternalId(
      externalId,
      primaryUserId,
    );
    expect(reloaded?.draft_picks).toEqual([
      [1, 'team-1', 'team-1', 'player-1', 10],
    ]);
    expect(reloaded?.taken_players).toEqual([['player-2', 'team-1', 'DRAFT', 5]]);
  });

  it('persists draftStateJson on create and refetch', async () => {
    const externalId = `${testPrefix}-draft-state-json`;

    const created = await service.upsertLeague(primaryUserId, {
      externalId,
      name: 'Draft State JSON League',
      description: 'persists draftStateJson',
      format: 'roto',
      draftType: 'auction',
      battingCategories: ['R', 'HR', 'RBI', 'SB', 'AVG'],
      pitchingCategories: ['W', 'SV', 'K', 'ERA', 'WHIP'],
      rosterSlots: {
        C: 1,
        '1B': 1,
        '2B': 1,
        '3B': 1,
        CI: 1,
        MI: 1,
        SS: 1,
        OF: 3,
        SP: 2,
        RP: 2,
        UTIL: 0,
        BENCH: 0,
      },
      totalBudget: 260,
      taken_players: [['player-1', 'team-1', 'DRAFT', 25]],
      draft_picks: [[1, 'team-1', 'team-1', 'player-1', 25]],
      teams: [['team-1', 'Team 1', 235]],
      draftStateJson: {
        league: {
          leagueId: 'league-1',
          externalId,
          name: 'Draft State JSON League',
          draftType: 'auction',
          totalBudget: 260,
          battingCategories: ['R', 'HR', 'RBI', 'SB', 'AVG'],
          pitchingCategories: ['W', 'SV', 'K', 'ERA', 'WHIP'],
          rosterSlots: {
            C: 1,
            '1B': 1,
            '2B': 1,
            '3B': 1,
            CI: 1,
            MI: 1,
            SS: 1,
            OF: 3,
            SP: 2,
            RP: 2,
            UTIL: 0,
            BENCH: 0,
          },
          minorLeagueSlotsPerTeam: 0,
          teamCount: 1,
        },
        teams: [],
        players: [],
        draftPicks: [],
      },
      isDefault: false,
      minorLeagueSlotsPerTeam: 0,
    });

    const reloaded = await service.getLeagueByExternalId(externalId, primaryUserId);

    expect(created.draftStateJson).toBeTruthy();
    expect(reloaded?.draftStateJson).toBeTruthy();
    expect(
      (reloaded?.draftStateJson as { league?: { externalId?: string } })?.league
        ?.externalId,
    ).toBe(externalId);
  });

  it('filters out leagues owned by other users', async () => {
    await service.upsertLeague(primaryUserId, {
      externalId: `${testPrefix}-owned-by-primary`,
      name: 'Primary League',
      description: 'primary',
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
        CI: 0,
        MI: 0,
        OF: 3,
        SP: 5,
        RP: 2,
        UTIL: 0,
        BENCH: 0,
      },
      totalBudget: 260,
      isDefault: false,
    });

    await service.upsertLeague(secondaryUserId, {
      externalId: `${testPrefix}-owned-by-secondary`,
      name: 'Secondary League',
      description: 'secondary',
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
        CI: 0,
        MI: 0,
        OF: 3,
        SP: 5,
        RP: 2,
        UTIL: 0,
        BENCH: 0,
      },
      totalBudget: 260,
      isDefault: false,
    });

    const filtered = await service.getLeagues(primaryUserId, {
      search: testPrefix,
    });

    expect(filtered.leagues).toHaveLength(1);
    expect(filtered.leagues[0].externalId).toBe(
      `${testPrefix}-owned-by-primary`,
    );
  });

  it('throws forbidden when a user tries to access another user league', async () => {
    const created = await service.upsertLeague(primaryUserId, {
      externalId: `${testPrefix}-forbidden`,
      name: 'Forbidden League',
      description: 'forbidden',
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
        CI: 0,
        MI: 0,
        OF: 3,
        SP: 5,
        RP: 2,
        UTIL: 0,
        BENCH: 0,
      },
      totalBudget: 260,
      isDefault: false,
    });

    await expect(
      service.getLeagueById(created._id, secondaryUserId),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      service.getLeagueByExternalId(
        `${testPrefix}-forbidden`,
        secondaryUserId,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      service.deleteLeagueById(created._id, secondaryUserId),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
