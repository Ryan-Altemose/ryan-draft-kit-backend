import { isValidObjectId } from 'mongoose';
import { ForbiddenError } from '@/shared/server/http-errors';
import { LeagueModel } from './leagues.model';
import { LeagueDraftModel } from './leagueDrafts.model';
import type { League } from '../types/leagues.types';
import type { CreateLeagueDraftInput, LeagueDraft } from '../types/leagueDrafts.types';

function resetTeamBudgets(teams: League['teams'], totalBudget?: number): League['teams'] {
  if (!teams) return [];
  if (typeof totalBudget !== 'number') return teams;
  return teams.map(([id, name]) => [id, name, totalBudget]);
}

function isObjectId(value: string): boolean {
  return /^[a-f0-9]{24}$/i.test(value);
}

export class LeagueDraftsService {
  async listDrafts(leagueId: string, userId: string): Promise<LeagueDraft[]> {
    if (!isObjectId(leagueId)) return [];

    const drafts = await LeagueDraftModel.find({ leagueId, userId })
      .sort({ createdAt: -1 })
      .lean();
    return drafts as unknown as LeagueDraft[];
  }

  async getDraftById(draftId: string, userId: string): Promise<LeagueDraft | null> {
    if (!isValidObjectId(draftId)) return null;

    const draft = (await LeagueDraftModel.findOne({ _id: draftId, userId }).lean()) as
      | LeagueDraft
      | null;
    return draft;
  }

  async startNewDraft(
    leagueId: string,
    userId: string,
    input: CreateLeagueDraftInput = {},
  ): Promise<{ archivedDraft: LeagueDraft | null; league: League }> {
    if (!isObjectId(leagueId)) {
      throw new ForbiddenError('League does not belong to user');
    }

    const league = (await LeagueModel.findOne({ _id: leagueId, userId }).lean()) as League | null;
    if (!league) {
      const existingLeague = await LeagueModel.exists({ _id: leagueId });
      if (existingLeague) throw new ForbiddenError('League does not belong to user');
      throw new Error('League not found');
    }

    const hasDraftState =
      (league.draft_picks?.length ?? 0) > 0 || (league.taken_players?.length ?? 0) > 0;

    let archivedDraft: LeagueDraft | null = null;
    if (hasDraftState) {
      const year = new Date().getFullYear();
      const existingCount = await LeagueDraftModel.countDocuments({
        leagueId: league._id,
        userId,
      });
      const name = input.name ?? `Draft ${existingCount + 1} (${year})`;

      const created = await LeagueDraftModel.create({
        userId,
        leagueId: league._id,
        name,
        totalBudget: league.totalBudget,
        taken_players: league.taken_players ?? [],
        draft_picks: league.draft_picks ?? [],
        teams: league.teams ?? [],
      });
      archivedDraft = (created.toObject({ getters: false }) as unknown) as LeagueDraft;
    }

    const nextTeams = resetTeamBudgets(league.teams, league.totalBudget);

    const updatedLeague = (await LeagueModel.findOneAndUpdate(
      { _id: league._id, userId },
      {
        $set: {
          taken_players: [],
          draft_picks: [],
          teams: nextTeams,
        },
      },
      { new: true, runValidators: true },
    ).lean()) as League;

    return { archivedDraft, league: updatedLeague };
  }
}

export const leagueDraftsService = new LeagueDraftsService();

