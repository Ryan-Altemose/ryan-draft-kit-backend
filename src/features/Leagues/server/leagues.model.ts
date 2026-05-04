import mongoose, { Schema } from 'mongoose';
import type { League } from '../types/leagues.types';

type LeagueDocument = Omit<League, 'userId'> & {
  userId: mongoose.Types.ObjectId | string;
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

const leagueSchema = new Schema<LeagueDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    externalId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    format: {
      type: String,
      required: true,
      enum: ['roto', 'h2h-points', 'h2h-category'],
    },
    draftType: {
      type: String,
      required: true,
      enum: ['auction', 'snake'],
    },
    battingCategories: {
      type: [String],
      required: true,
      enum: [
        'R',
        'HR',
        'RBI',
        'SB',
        'AVG',
        'OBP',
        'SLG',
        'OPS',
        'H',
        '2B',
        '3B',
        'BB',
        'K',
      ],
    },
    pitchingCategories: {
      type: [String],
      required: true,
      enum: [
        'W',
        'SV',
        'K',
        'ERA',
        'WHIP',
        'QS',
        'IP',
        'H',
        'BB',
        'HR',
        'L',
        'HLD',
        'SV+HLD',
      ],
    },
    rosterSlots: {
      C: { type: Number, default: 1 },
      '1B': { type: Number, default: 1 },
      '2B': { type: Number, default: 1 },
      '3B': { type: Number, default: 1 },
      SS: { type: Number, default: 1 },
      CI: { type: Number, default: 1 },
      MI: { type: Number, default: 1 },
      OF: { type: Number, default: 3 },
      SP: { type: Number, default: 2 },
      RP: { type: Number, default: 2 },
      UTIL: { type: Number, default: 0 },
      BENCH: { type: Number, default: 0 },
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
    isDefault: {
      type: Boolean,
      default: false,
    },
    categoryWeights: {
      type: Map,
      of: Number,
    },
    minorLeagueSlotsPerTeam: {
      type: Number,
      min: 0,
    },
    taxiSquadPlayersPerTeam: {
      type: Number,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

leagueSchema.index({ name: 'text', description: 'text' });
leagueSchema.index({ userId: 1, externalId: 1 }, { unique: true });
leagueSchema.index({ userId: 1, isDefault: 1 });
leagueSchema.index({ format: 1 });
leagueSchema.index({ draftType: 1 });
leagueSchema.index({ isDefault: 1 });

export const LeagueModel: mongoose.Model<LeagueDocument> =
  mongoose.models.League ||
  mongoose.model<LeagueDocument>('League', leagueSchema);
