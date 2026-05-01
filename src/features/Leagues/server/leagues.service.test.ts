import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { connectDb } from '@/shared/server/connect-db';
import { LeagueModel } from './leagues.model';
import { LeaguesService } from './leagues.service';

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

  beforeAll(async () => {
    loadLocalMongoEnv();
    await connectDb();
    await LeagueModel.collection.createIndex(
      { name: 'text', description: 'text' },
      { name: 'name_description_text' },
    );
  });

  beforeEach(async () => {
    await LeagueModel.deleteMany({
      externalId: { $regex: `^${testPrefix}` },
    });
  });

  afterAll(async () => {
    await LeagueModel.deleteMany({
      externalId: { $regex: `^${testPrefix}` },
    });
    await mongoose.disconnect();
  });

  it('performs real create and read against MongoDB', async () => {
    const created = await service.upsertLeague({
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

    const byId = await service.getLeagueById(created._id);
    const byExternalId = await service.getLeagueByExternalId(
      `${testPrefix}-crud`,
    );

    expect(byId?._id.toString()).toBe(created._id.toString());
    expect(byExternalId?.name).toBe('Vitest CRUD League');
  });

  it('performs real filter and pagination queries against MongoDB', async () => {
    await service.upsertLeagues([
      {
        externalId: `${testPrefix}-default`,
        name: `${testPrefix} Default League`,
        description: `${testPrefix} default`,
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
        name: `${testPrefix} Snake League`,
        description: `${testPrefix} snake`,
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

    const filtered = await service.getLeagues({
      format: 'roto',
      draftType: 'auction',
      isDefault: true,
      search: testPrefix,
      page: 1,
      limit: 10,
    });

    expect(filtered.leagues).toHaveLength(1);
    expect(filtered.leagues[0].externalId).toBe(`${testPrefix}-default`);
    expect(filtered.pagination.total).toBe(1);
  });

  it('performs a real delete against MongoDB', async () => {
    const created = await service.upsertLeague({
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

    const deleted = await service.deleteLeagueById(created._id);
    const reloaded = await service.getLeagueById(created._id);

    expect(deleted?._id.toString()).toBe(created._id.toString());
    expect(reloaded).toBeNull();
  });

  it('does not wipe draft_picks when omitted from update payload', async () => {
    const externalId = `${testPrefix}-preserve-draft-picks`;

    await service.upsertLeague({
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

    await service.upsertLeague({
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

    const reloaded = await service.getLeagueByExternalId(externalId);
    expect(reloaded?.draft_picks).toEqual([
      [1, 'team-1', 'team-1', 'player-1', 10],
    ]);
    expect(reloaded?.taken_players).toEqual([['player-2', 'team-1', 'DRAFT', 5]]);
  });

  it('stores draftStateJson on the matching league without affecting other leagues', async () => {
    const firstExternalId = `${testPrefix}-draft-json-1`;
    const secondExternalId = `${testPrefix}-draft-json-2`;

    await service.upsertLeague({
      externalId: firstExternalId,
      name: 'Draft Json League 1',
      description: 'league 1',
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
      taken_players: [['player-1', 'team-1', 'DRAFT', 25]],
      draft_picks: [[1, 'team-1', 'team-1', 'player-1', 25]],
      teams: [['team-1', 'Team 1', 235]],
      draftStateJson: {
        league: { externalId: firstExternalId },
        teams: [{ teamId: 'team-1', budgetRemaining: 235 }],
        players: [{ playerId: 'player-1', purchasePrice: 25 }],
        draftPicks: [{ pickNumber: 1 }],
      },
      isDefault: false,
    });

    await service.upsertLeague({
      externalId: secondExternalId,
      name: 'Draft Json League 2',
      description: 'league 2',
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
      draft_picks: [],
      teams: [['team-2', 'Team 2', 260]],
      draftStateJson: {
        league: { externalId: secondExternalId },
        teams: [{ teamId: 'team-2', budgetRemaining: 260 }],
        players: [],
        draftPicks: [],
      },
      isDefault: false,
    });

    const firstLeague = await service.getLeagueByExternalId(firstExternalId);
    const secondLeague = await service.getLeagueByExternalId(secondExternalId);

    expect(firstLeague?.draftStateJson).toEqual({
      league: { externalId: firstExternalId },
      teams: [{ teamId: 'team-1', budgetRemaining: 235 }],
      players: [{ playerId: 'player-1', purchasePrice: 25 }],
      draftPicks: [{ pickNumber: 1 }],
    });
    expect(secondLeague?.draftStateJson).toEqual({
      league: { externalId: secondExternalId },
      teams: [{ teamId: 'team-2', budgetRemaining: 260 }],
      players: [],
      draftPicks: [],
    });
  });
});
