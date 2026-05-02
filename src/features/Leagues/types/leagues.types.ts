import { z } from 'zod';

export const RosterSlotsSchema = z.object({
  C: z.number().int().min(0).default(1),
  '1B': z.number().int().min(0).default(1),
  '2B': z.number().int().min(0).default(1),
  '3B': z.number().int().min(0).default(1),
  SS: z.number().int().min(0).default(1),
  CI: z.number().int().min(0).default(1),
  MI: z.number().int().min(0).default(1),
  OF: z.number().int().min(0).default(3),
  SP: z.number().int().min(0).default(2),
  RP: z.number().int().min(0).default(2),
  UTIL: z.number().int().min(0).default(0),
  BENCH: z.number().int().min(0).default(0),
});

export const BattingCategorySchema = z.enum([
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
]);

export const PitchingCategorySchema = z.enum([
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
]);

export const LeagueFormatSchema = z.enum([
  'roto',
  'h2h-points',
  'h2h-category',
]);

export const DraftTypeSchema = z.enum(['auction', 'snake']);

export const TakenPlayerSchema = z.tuple([
  z.string(),
  z.string(),
  z.string(),
  z.number().min(0),
]);

export const DraftPickSchema = z.tuple([
  z.number().int().min(1),   // pick number
  z.string(),                // nominating team id
  z.string(),                // winning team id
  z.string(),                // player id
  z.number().int().min(0),   // salary
]);

export const LeagueTeamSchema = z.tuple([
  z.string(),
  z.string(),
  z.number().min(0),
]);

export const LeagueSchema = z.object({
  externalId: z.string().min(1),
  name: z.string().min(1).trim(),
  description: z.string().optional(),
  format: LeagueFormatSchema,
  draftType: DraftTypeSchema,
  battingCategories: z.array(BattingCategorySchema).min(1),
  pitchingCategories: z.array(PitchingCategorySchema).min(1),
  rosterSlots: RosterSlotsSchema,
  totalBudget: z.number().int().min(1).optional(),
  taken_players: z.array(TakenPlayerSchema).optional(),
  draft_picks: z.array(DraftPickSchema).optional(),
  teams: z.array(LeagueTeamSchema).optional(),
  draftStateJson: z.unknown().optional(),
  isDefault: z.boolean().default(false),
  categoryWeights: z.record(z.string(), z.number()).optional(),
  minorLeagueSlotsPerTeam: z.number().int().min(0).optional(),
});

export const LeagueFiltersSchema = z.object({
  format: LeagueFormatSchema.optional(),
  draftType: DraftTypeSchema.optional(),
  isDefault: z.coerce.boolean().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export type RosterSlots = z.infer<typeof RosterSlotsSchema>;
export type TakenPlayer = z.infer<typeof TakenPlayerSchema>;
export type DraftPick = z.infer<typeof DraftPickSchema>;
export type LeagueTeam = z.infer<typeof LeagueTeamSchema>;
export type LeagueInput = z.infer<typeof LeagueSchema>;
export type LeagueFilters = z.infer<typeof LeagueFiltersSchema>;

export interface League extends LeagueInput {
  _id: string;
  userId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type CreateLeagueInput = {
  name: string;
  teams: number;
  draftType: 'auction';
  rosterSlots: RosterSlots;
  totalBudget: number;
  takenPlayers?: TakenPlayer[];
  teamsData?: LeagueTeam[];
};

export interface CreateLeagueResponse {
  success: boolean;
  data: League;
}

export interface LeaguesResponse {
  success: boolean;
  data: League[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface LeagueResponse {
  success: boolean;
  data: League;
}
