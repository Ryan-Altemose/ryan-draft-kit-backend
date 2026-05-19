import { Types, isValidObjectId } from 'mongoose';
import { ForbiddenError } from '@/shared/server/http-errors';
import { LeagueModel } from './leagues.model';
import { LeagueDraftModel } from './leagueDrafts.model';
import type { League } from '../types/leagues.types';
import {
  LeagueDraftSnapshotSchema,
  type CreateLeagueDraftInput,
  type LeagueDraft,
} from '../types/leagueDrafts.types';

function resetTeamBudgets(teams: League['teams'], totalBudget?: number): League['teams'] {
  if (!teams) return [];
  if (typeof totalBudget !== 'number') return teams;
  return teams.map(([id, name]) => [id, name, totalBudget]);
}

function isObjectId(value: string): boolean {
  return /^[a-f0-9]{24}$/i.test(value);
}

type LeagueDraftSnapshot = Omit<LeagueDraft, '_id' | 'leagueId' | 'userId' | 'createdAt' | 'updatedAt'>;

function buildDraftSnapshotSignature(draft: LeagueDraftSnapshot): string {
  return JSON.stringify({
    name: draft.name,
    taken_players: draft.taken_players ?? [],
    draft_picks: draft.draft_picks ?? [],
    teams: draft.teams ?? [],
    totalBudget: draft.totalBudget ?? null,
  });
}

export class LeagueDraftsService {
  private async migrateLegacyEmbeddedDrafts(
    leagueId: string,
    userId: string,
  ): Promise<void> {
    if (!isObjectId(leagueId) || !isValidObjectId(userId)) {
      return;
    }

    const league = (await LeagueModel.collection.findOne({
      _id: new Types.ObjectId(leagueId),
      userId: new Types.ObjectId(userId),
    })) as ({ drafts?: unknown[] } & Record<string, unknown>) | null;

    const legacyDrafts = Array.isArray(league?.drafts) ? league.drafts : [];
    if (legacyDrafts.length === 0) {
      return;
    }

    const parsedDrafts = legacyDrafts
      .map((draft) => LeagueDraftSnapshotSchema.safeParse(draft))
      .filter((result) => result.success)
      .map((result) => result.data);

    const existingDrafts = ((await LeagueDraftModel.find({
      leagueId,
      userId,
    }).lean()) as unknown) as LeagueDraft[];
    const existingSignatures = new Set(
      existingDrafts.map((draft) =>
        buildDraftSnapshotSignature({
          name: draft.name,
          taken_players: draft.taken_players ?? [],
          draft_picks: draft.draft_picks ?? [],
          teams: draft.teams ?? [],
          totalBudget: draft.totalBudget,
        }),
      ),
    );

    const draftsToInsert = parsedDrafts.filter((draft) => {
      const signature = buildDraftSnapshotSignature(draft);
      if (existingSignatures.has(signature)) {
        return false;
      }
      existingSignatures.add(signature);
      return true;
    });

    if (draftsToInsert.length > 0) {
      await LeagueDraftModel.insertMany(
        draftsToInsert.map((draft) => ({
          userId,
          leagueId,
          ...draft,
        })),
      );
    }

    await LeagueModel.updateOne(
      { _id: leagueId, userId },
      { $unset: { drafts: 1 } },
      { strict: false },
    );
  }

  async listDrafts(leagueId: string, userId: string): Promise<LeagueDraft[]> {
    if (!isObjectId(leagueId)) return [];

    await this.migrateLegacyEmbeddedDrafts(leagueId, userId);

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

  async copyDraftToLeague(
    leagueId: string,
    draftId: string,
    userId: string,
  ): Promise<League | null> {
    if (!isObjectId(leagueId) || !isValidObjectId(draftId)) {
      return null;
    }

    const [league, draft] = await Promise.all([
      LeagueModel.findOne({ _id: leagueId, userId }).lean() as Promise<League | null>,
      LeagueDraftModel.findOne({ _id: draftId, leagueId, userId }).lean() as Promise<LeagueDraft | null>,
    ]);

    if (!league) {
      const existingLeague = await LeagueModel.exists({ _id: leagueId });
      if (existingLeague) throw new ForbiddenError('League does not belong to user');
      return null;
    }

    if (!draft) {
      return null;
    }

    const updatedLeague = (await LeagueModel.findOneAndUpdate(
      { _id: leagueId, userId },
      {
        $set: {
          totalBudget: draft.totalBudget ?? league.totalBudget,
          taken_players: draft.taken_players ?? [],
          draft_picks: draft.draft_picks ?? [],
          teams: draft.teams ?? [],
        },
      },
      { new: true, runValidators: true },
    ).lean()) as League | null;

    return updatedLeague;
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

    await this.migrateLegacyEmbeddedDrafts(leagueId, userId);

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
