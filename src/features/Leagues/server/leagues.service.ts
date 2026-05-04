import { isValidObjectId } from 'mongoose';
import { ForbiddenError } from '@/shared/server/http-errors';
import { LeagueModel } from './leagues.model';
import type { League, LeagueFilters } from '../types/leagues.types';
import type { LeagueInput } from '../types/leagues.types';

function buildLeagueUpdate(
  userId: string,
  leagueData: LeagueInput,
): Record<string, unknown> {
  const update: Record<string, unknown> = {
    userId,
    externalId: leagueData.externalId,
    name: leagueData.name,
    format: leagueData.format,
    draftType: leagueData.draftType,
    battingCategories: leagueData.battingCategories,
    pitchingCategories: leagueData.pitchingCategories,
    rosterSlots: leagueData.rosterSlots,
    isDefault: leagueData.isDefault,
  };

  if (leagueData.description !== undefined) {
    update.description = leagueData.description;
  }

  if (leagueData.totalBudget !== undefined) {
    update.totalBudget = leagueData.totalBudget;
  }

  if (leagueData.taken_players !== undefined) {
    update.taken_players = leagueData.taken_players;
  }

  if (leagueData.draft_picks !== undefined) {
    update.draft_picks = leagueData.draft_picks;
  }

  if (leagueData.teams !== undefined) {
    update.teams = leagueData.teams;
  }

  if (leagueData.categoryWeights !== undefined) {
    update.categoryWeights = leagueData.categoryWeights;
  }

  if (leagueData.minorLeagueSlotsPerTeam !== undefined) {
    update.minorLeagueSlotsPerTeam = leagueData.minorLeagueSlotsPerTeam;
  }

  if (leagueData.taxiSquadPlayersPerTeam !== undefined) {
    update.taxiSquadPlayersPerTeam = leagueData.taxiSquadPlayersPerTeam;
  }

  return update;
}

export class LeaguesService {
  async getLeagues(userId: string, filters: LeagueFilters = {}) {
    const {
      format,
      draftType,
      isDefault,
      search,
      page = 1,
      limit = 50,
    } = filters;

    const query: Record<string, unknown> = {
      userId,
    };

    if (format) {
      query.format = format;
    }

    if (draftType) {
      query.draftType = draftType;
    }

    if (isDefault !== undefined) {
      query.isDefault = isDefault;
    }

    if (search) {
      query.$text = { $search: search };
    }

    const skip = (page - 1) * limit;

    const [leagues, total] = await Promise.all([
      LeagueModel.find(query)
        .sort({ isDefault: -1, name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LeagueModel.countDocuments(query),
    ]);

    return {
      leagues,
      pagination: {
        page,
        limit,
        total,
      },
    };
  }

  async getLeagueById(id: string, userId: string): Promise<League | null> {
    if (!isValidObjectId(id)) {
      return null;
    }

    const league = (await LeagueModel.findOne({
      _id: id,
      userId,
    }).lean()) as League | null;

    if (league) {
      return league;
    }

    const existingLeague = await LeagueModel.exists({ _id: id });

    if (existingLeague) {
      throw new ForbiddenError('League does not belong to user');
    }

    return null;
  }

  async getLeagueByExternalId(
    externalId: string,
    userId: string,
  ): Promise<League | null> {
    const league = (await LeagueModel.findOne({
      externalId,
      userId,
    }).lean()) as League | null;

    if (league) {
      return league;
    }

    const existingLeague = await LeagueModel.exists({ externalId });

    if (existingLeague) {
      throw new ForbiddenError('League does not belong to user');
    }

    return null;
  }

  async upsertLeague(
    userId: string,
    leagueData: LeagueInput,
  ): Promise<League> {
    const update = buildLeagueUpdate(userId, leagueData);

    const persisted = await LeagueModel.findOneAndUpdate(
      { externalId: leagueData.externalId, userId },
      { $set: update },
      { upsert: true, new: true, runValidators: true },
    ).lean();

    return persisted as League;
  }

  async upsertLeagues(
    userId: string,
    leagues: LeagueInput[],
  ): Promise<number> {
    const operations = leagues.map((league) => ({
      updateOne: {
        filter: { externalId: league.externalId, userId },
        update: { $set: buildLeagueUpdate(userId, league) },
        upsert: true,
      },
    }));

    const result = await LeagueModel.bulkWrite(operations, { ordered: false });
    return result.upsertedCount + result.modifiedCount;
  }

  async deleteLeagueById(id: string, userId: string): Promise<League | null> {
    if (!isValidObjectId(id)) {
      return null;
    }

    const league = (await LeagueModel.findOneAndDelete({
      _id: id,
      userId,
    }).lean()) as League | null;

    if (league) {
      return league;
    }

    const existingLeague = await LeagueModel.exists({ _id: id });

    if (existingLeague) {
      throw new ForbiddenError('League does not belong to user');
    }

    return null;
  }
}

export const leaguesService = new LeaguesService();
