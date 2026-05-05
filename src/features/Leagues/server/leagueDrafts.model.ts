import mongoose, { Schema } from 'mongoose';
import type { LeagueDraft } from '../types/leagueDrafts.types';

type LeagueDraftDocument = Omit<LeagueDraft, '_id' | 'userId' | 'leagueId'> & {
  userId: mongoose.Types.ObjectId | string;
  leagueId: mongoose.Types.ObjectId | string;
};

function isValidTakenPlayers(value: unknown): boolean {
  if (!Array.isArray(value)) return false;

  function isValidDraftPickMeta(meta: unknown): boolean {
    if (!Array.isArray(meta) || meta.length !== 3) return false;
    const [pickNumber, nominatingTeamId, winningTeamId] = meta;
    return (
      typeof pickNumber === 'number' &&
      Number.isInteger(pickNumber) &&
      pickNumber >= 1 &&
      typeof nominatingTeamId === 'string' &&
      typeof winningTeamId === 'string'
    );
  }

  if (
    !value.every(
      (entry) =>
        Array.isArray(entry) &&
        (entry.length === 4 || entry.length === 5) &&
        typeof entry[0] === 'string' &&
        typeof entry[1] === 'string' &&
        typeof entry[2] === 'string' &&
        typeof entry[3] === 'number' &&
        entry[3] >= 0 &&
        (entry.length === 4 || isValidDraftPickMeta(entry[4])),
    )
  ) {
    return false;
  }

  const playerIds = new Set<string>();

  for (const entry of value) {
    const playerId = entry[0] as string;
    if (playerIds.has(playerId)) return false;
    playerIds.add(playerId);
  }

  return true;
}

function isValidDraftPicks(value: unknown): boolean {
  if (!Array.isArray(value)) return false;

  return value.every(
    (entry) =>
      Array.isArray(entry) &&
      entry.length === 5 &&
      typeof entry[0] === 'number' &&
      entry[0] >= 1 &&
      typeof entry[1] === 'string' &&
      typeof entry[2] === 'string' &&
      typeof entry[3] === 'string' &&
      typeof entry[4] === 'number' &&
      entry[4] >= 0,
  );
}

function isValidTeams(value: unknown): boolean {
  if (!Array.isArray(value)) return false;

  return value.every(
    (entry) =>
      Array.isArray(entry) &&
      entry.length === 3 &&
      typeof entry[0] === 'string' &&
      typeof entry[1] === 'string' &&
      typeof entry[2] === 'number' &&
      entry[2] >= 0,
  );
}

const leagueDraftSchema = new Schema<LeagueDraftDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    leagueId: {
      type: Schema.Types.ObjectId,
      ref: 'League',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    totalBudget: {
      type: Number,
      min: 1,
    },
    taken_players: {
      type: [[Schema.Types.Mixed]],
      default: [],
      validate: {
        validator: isValidTakenPlayers,
        message:
          'taken_players must be [player_id, team_id, position_slot, price] or [player_id, team_id, position_slot, price, draft_pick] tuples',
      },
    },
    draft_picks: {
      type: [[Schema.Types.Mixed]],
      default: [],
      validate: {
        validator: isValidDraftPicks,
        message:
          'draft_picks must be [pick_number, nominating_team_id, winning_team_id, player_id, salary] tuples',
      },
    },
    teams: {
      type: [[Schema.Types.Mixed]],
      default: [],
      validate: {
        validator: isValidTeams,
        message: 'teams must be [team_id, team_name, current_budget] tuples',
      },
    },
  },
  { timestamps: true },
);

leagueDraftSchema.index({ userId: 1, leagueId: 1, createdAt: -1 });

export const LeagueDraftModel: mongoose.Model<LeagueDraftDocument> =
  mongoose.models.LeagueDraft ||
  mongoose.model<LeagueDraftDocument>('LeagueDraft', leagueDraftSchema);
