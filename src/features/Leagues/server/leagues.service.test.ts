import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { connectDb } from '@/shared/server/connect-db';
import { LeagueModel } from './leagues.model';
import { LeaguesService } from './leagues.service';

function loadLocalMongoEnv() {
  if (process.env.MONGODB_URI) {
    return;
  }

  const envPath = path.resolve(process.cwd(), '.env.local');
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

describe('LeaguesService', () => {
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
        DH: 0,
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
          DH: 0,
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
          DH: 0,
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
        CI: 0,
        MI: 0,
        SS: 1,
        OF: 3,
        DH: 0,
        SP: 5,
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
});
