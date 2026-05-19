import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { ForbiddenError } from '@/shared/server/http-errors';
import { connectDb } from '@/shared/server/connect-db';
import { LeagueModel } from './leagues.model';
import { LeaguesService } from './leagues.service';
import { LeagueDraftsService } from './leagueDrafts.service';
import { LeagueDraftModel } from './leagueDrafts.model';
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
  const draftsService = new LeagueDraftsService();
  const testPrefix = 'vitest-league-service';
  const searchToken = testPrefix.replace(/-/g, '');
  let primaryUserId: string;
  let secondaryUserId: string;

  beforeAll(async () => {
    loadLocalMongoEnv();
    await connectDb();
  });

  beforeEach(async () => {
    await LeagueModel.deleteMany({
      externalId: { $regex: `^${testPrefix}` },
    });
    await LeagueDraftModel.deleteMany({
      name: { $regex: `^${testPrefix}` },
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
    await LeagueDraftModel.deleteMany({
      name: { $regex: `^${testPrefix}` },
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
      minorLeagueSlotsPerTeam: 4,
      taxiSquadPlayersPerTeam: 3,
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
    expect(byId?.minorLeagueSlotsPerTeam).toBe(4);
    expect(byId?.taxiSquadPlayersPerTeam).toBe(3);
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

  it('can finish a draft by copying draft_picks into drafts while preserving live roster state', async () => {
    const created = await service.upsertLeague(primaryUserId, {
      externalId: `${testPrefix}-finish-draft`,
      name: 'Finish Draft League',
      description: 'finish draft test',
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
      taken_players: [
        ['player-1', 'team-1', '1B-0', 10, ''],
        ['player-2', 'team-2', '1B-0', 7, ''],
      ],
      draft_picks: [
        [1, 'team-1', 'team-1', 'player-1', 10],
        [2, 'team-2', 'team-2', 'player-2', 7],
      ],
      teams: [
        ['team-1', 'Team 1', 250],
        ['team-2', 'Team 2', 253],
      ],
      isDefault: false,
    });

    const updated = await service.finishDraftByLeagueId(
      created._id,
      primaryUserId,
      '2026 Season',
    );

    expect(updated?.draft_picks).toEqual([]);
    expect(updated?.taken_players).toEqual([
      ['player-1', 'team-1', '1B-0', 10, ''],
      ['player-2', 'team-2', '1B-0', 7, ''],
    ]);
    expect(updated?.teams).toEqual([
      ['team-1', 'Team 1', 250],
      ['team-2', 'Team 2', 253],
    ]);

    const archivedDrafts = await LeagueDraftModel.find({
      leagueId: created._id,
      userId: primaryUserId,
    })
      .sort({ createdAt: -1 })
      .lean();

    expect(archivedDrafts).toHaveLength(1);
    expect(archivedDrafts[0]).toMatchObject({
      name: '2026 Season',
      taken_players: [
        ['player-1', 'team-1', '1B-0', 10, ''],
        ['player-2', 'team-2', '1B-0', 7, ''],
      ],
      draft_picks: [
        [1, 'team-1', 'team-1', 'player-1', 10],
        [2, 'team-2', 'team-2', 'player-2', 7],
      ],
      teams: [
        ['team-1', 'Team 1', 250],
        ['team-2', 'Team 2', 253],
      ],
      totalBudget: 260,
    });
  });

  it('can finish a draft with pre-draft roster state even when draft_picks is empty', async () => {
    const created = await service.upsertLeague(primaryUserId, {
      externalId: `${testPrefix}-finish-predraft-only`,
      name: 'Finish Predraft League',
      description: 'finish predraft test',
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
      taken_players: [
        ['player-3', 'team-1', 'OF-0', 12, ''],
        ['player-4', 'team-2', 'SP-1', 9, ''],
      ],
      draft_picks: [],
      teams: [
        ['team-1', 'Team 1', 248],
        ['team-2', 'Team 2', 251],
      ],
      isDefault: false,
    });

    const updated = await service.finishDraftByLeagueId(
      created._id,
      primaryUserId,
      'Predraft Snapshot',
    );
    expect(updated?.draft_picks).toEqual([]);

    const archivedDrafts = await LeagueDraftModel.find({
      leagueId: created._id,
      userId: primaryUserId,
    })
      .sort({ createdAt: -1 })
      .lean();

    expect(archivedDrafts).toHaveLength(1);
    expect(archivedDrafts[0]).toMatchObject({
      name: 'Predraft Snapshot',
      taken_players: [
        ['player-3', 'team-1', 'OF-0', 12, ''],
        ['player-4', 'team-2', 'SP-1', 9, ''],
      ],
      draft_picks: [],
      teams: [
        ['team-1', 'Team 1', 248],
        ['team-2', 'Team 2', 251],
      ],
      totalBudget: 260,
    });
  });

  it('can restore exact pre-draft roster state from a finished draft snapshot', async () => {
    const created = await service.upsertLeague(primaryUserId, {
      externalId: `${testPrefix}-predraft-roundtrip`,
      name: 'Predraft Roundtrip League',
      description: 'predraft roundtrip test',
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
      taken_players: [
        ['player-7', 'team-1', 'CI-0', 14, ''],
        ['player-8', 'team-1', 'UTIL-0', 6, ''],
        ['player-9', 'team-2', 'SP-3', 11, ''],
      ],
      draft_picks: [],
      teams: [
        ['team-1', 'Team 1', 240],
        ['team-2', 'Team 2', 249],
      ],
      isDefault: false,
    });

    await service.finishDraftByLeagueId(
      created._id,
      primaryUserId,
      'Predraft Roundtrip Snapshot',
    );

    const archivedDraft = await LeagueDraftModel.findOne({
      leagueId: created._id,
      userId: primaryUserId,
      name: 'Predraft Roundtrip Snapshot',
    }).lean();

    expect(archivedDraft).toMatchObject({
      taken_players: [
        ['player-7', 'team-1', 'CI-0', 14, ''],
        ['player-8', 'team-1', 'UTIL-0', 6, ''],
        ['player-9', 'team-2', 'SP-3', 11, ''],
      ],
      draft_picks: [],
      teams: [
        ['team-1', 'Team 1', 240],
        ['team-2', 'Team 2', 249],
      ],
      totalBudget: 260,
    });

    await service.upsertLeague(primaryUserId, {
      externalId: `${testPrefix}-predraft-roundtrip`,
      name: 'Predraft Roundtrip League',
      description: 'predraft roundtrip test',
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
      taken_players: [['other-player', 'team-2', 'C-0', 3, '']],
      draft_picks: [[1, 'team-2', 'team-2', 'other-player', 3]],
      teams: [
        ['team-1', 'Team 1', 260],
        ['team-2', 'Team 2', 257],
      ],
      isDefault: false,
    });

    const restored = await draftsService.copyDraftToLeague(
      created._id,
      archivedDraft?._id.toString() ?? '',
      primaryUserId,
    );

    expect(restored?.taken_players).toEqual([
      ['player-7', 'team-1', 'CI-0', 14, ''],
      ['player-8', 'team-1', 'UTIL-0', 6, ''],
      ['player-9', 'team-2', 'SP-3', 11, ''],
    ]);
    expect(restored?.draft_picks).toEqual([]);
    expect(restored?.teams).toEqual([
      ['team-1', 'Team 1', 240],
      ['team-2', 'Team 2', 249],
    ]);
  });

  it('can copy an archived draft back into the active live draft', async () => {
    const created = await service.upsertLeague(primaryUserId, {
      externalId: `${testPrefix}-copy-draft`,
      name: 'Copy Draft League',
      description: 'copy draft test',
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
      taken_players: [['live-player', 'team-1', 'C-0', 21, '']],
      draft_picks: [[1, 'team-1', 'team-1', 'live-player', 21]],
      teams: [
        ['team-1', 'Team 1', 239],
        ['team-2', 'Team 2', 260],
      ],
      isDefault: false,
    });

    const archivedDraft = await LeagueDraftModel.create({
      userId: primaryUserId,
      leagueId: created._id,
      name: `${testPrefix}-archived-draft`,
      totalBudget: 260,
      taken_players: [
        ['archived-player-1', 'team-1', '1B-0', 15, ''],
        ['archived-player-2', 'team-2', 'C-0', 18, ''],
      ],
      draft_picks: [
        [1, 'team-1', 'team-1', 'archived-player-1', 15],
        [2, 'team-2', 'team-2', 'archived-player-2', 18],
      ],
      teams: [
        ['team-1', 'Team 1', 245],
        ['team-2', 'Team 2', 242],
      ],
    });

    const updated = await draftsService.copyDraftToLeague(
      created._id,
      archivedDraft._id.toString(),
      primaryUserId,
    );

    expect(updated?.taken_players).toEqual([
      ['archived-player-1', 'team-1', '1B-0', 15, ''],
      ['archived-player-2', 'team-2', 'C-0', 18, ''],
    ]);
    expect(updated?.draft_picks).toEqual([
      [1, 'team-1', 'team-1', 'archived-player-1', 15],
      [2, 'team-2', 'team-2', 'archived-player-2', 18],
    ]);
    expect(updated?.teams).toEqual([
      ['team-1', 'Team 1', 245],
      ['team-2', 'Team 2', 242],
    ]);
  });

  it('migrates legacy embedded drafts into LeagueDraft documents on draft history reads', async () => {
    const created = await service.upsertLeague(primaryUserId, {
      externalId: `${testPrefix}-legacy-embedded-drafts`,
      name: 'Legacy Embedded Drafts League',
      description: 'legacy embedded drafts migration test',
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
      teams: [['team-1', 'Team 1', 260]],
      isDefault: false,
    });

    await LeagueModel.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(created._id) },
      {
        $set: {
          drafts: [
            {
              name: 'Legacy Snapshot',
              taken_players: [['player-10', 'team-1', 'OF-0', 8, '']],
              draft_picks: [[1, 'team-1', 'team-1', 'player-10', 8]],
              teams: [['team-1', 'Team 1', 252]],
              totalBudget: 260,
            },
          ],
        },
      },
    );

    const drafts = await draftsService.listDrafts(created._id, primaryUserId);

    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      name: 'Legacy Snapshot',
      taken_players: [['player-10', 'team-1', 'OF-0', 8, '']],
      draft_picks: [[1, 'team-1', 'team-1', 'player-10', 8]],
      teams: [['team-1', 'Team 1', 252]],
      totalBudget: 260,
    });

    const reloaded = await LeagueModel.collection.findOne({
      _id: new mongoose.Types.ObjectId(created._id),
    });
    expect(reloaded?.drafts).toBeUndefined();
  });

  it('deletes saved drafts when deleting a league', async () => {
    const created = await service.upsertLeague(primaryUserId, {
      externalId: `${testPrefix}-delete-league-drafts`,
      name: 'Delete League Drafts',
      description: 'delete league cascade test',
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
      teams: [['team-1', 'Team 1', 260]],
      isDefault: false,
    });

    await LeagueDraftModel.create({
      userId: primaryUserId,
      leagueId: created._id,
      name: `${testPrefix}-delete-league-drafts-snapshot`,
      totalBudget: 260,
      taken_players: [['player-11', 'team-1', 'CI-0', 5, '']],
      draft_picks: [[1, 'team-1', 'team-1', 'player-11', 5]],
      teams: [['team-1', 'Team 1', 255]],
    });

    await service.deleteLeagueById(created._id, primaryUserId);

    const remainingDrafts = await LeagueDraftModel.find({
      leagueId: created._id,
      userId: primaryUserId,
    }).lean();
    expect(remainingDrafts).toHaveLength(0);
  });

  it('rejects duplicate taken_players entries for the same player', async () => {
    await expect(
      service.upsertLeague(primaryUserId, {
        externalId: `${testPrefix}-duplicate-taken-players`,
        name: 'Duplicate Taken Players League',
        description: 'duplicate taken_players should fail validation',
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
        taken_players: [
          ['player-1', 'team-1', 'DRAFT', 5],
          ['player-1', 'team-1', 'DRAFT', 7],
        ],
        teams: [['team-1', 'Team 1', 248]],
        isDefault: false,
      }),
    ).rejects.toMatchObject({ name: 'ValidationError' });
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
