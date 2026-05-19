import { z } from 'zod';
import {
  BattingCategorySchema,
  DraftTypeSchema,
  LeagueFormatSchema,
  LeagueTypeSchema,
  PitchingCategorySchema,
  RosterSlotsSchema,
} from './leagues.types';

export const ImportedLeagueTeamSchema = z.object({
  name: z.string().min(1).trim(),
  budget: z.number().min(0).optional(),
});

export const ImportedTakenPlayerSchema = z.object({
  playerName: z.string().min(1).trim(),
  teamName: z.string().min(1).trim(),
  positionSlot: z.string().min(1).trim(),
  price: z.number().min(0),
  contract: z.string().max(2).optional(),
});

export const ImportedDraftPickSchema = z.object({
  pickNumber: z.number().int().min(1),
  nominatingTeamName: z.string().min(1).trim(),
  winningTeamName: z.string().min(1).trim(),
  playerName: z.string().min(1).trim(),
  salary: z.number().int().min(0),
});

export const ImportedLeagueSchema = z.object({
  name: z.string().min(1).trim(),
  description: z.string().optional(),
  format: LeagueFormatSchema,
  draftType: DraftTypeSchema,
  leagueType: LeagueTypeSchema.default('MLB'),
  battingCategories: z.array(BattingCategorySchema).min(1),
  pitchingCategories: z.array(PitchingCategorySchema).min(1),
  rosterSlots: RosterSlotsSchema,
  totalBudget: z.number().int().min(1).optional(),
  categoryWeights: z.record(z.string(), z.number()).optional(),
  minorLeagueSlotsPerTeam: z.number().int().min(0).optional(),
  taxiSquadPlayersPerTeam: z.number().int().min(0).optional(),
  teams: z.array(ImportedLeagueTeamSchema).min(1),
  taken_players: z.array(ImportedTakenPlayerSchema).optional(),
  draft_picks: z.array(ImportedDraftPickSchema).optional(),
});

export const ImportLeagueRequestSchema = z.object({
  importJson: ImportedLeagueSchema,
});

export type ImportedLeagueInput = z.infer<typeof ImportedLeagueSchema>;
export type ImportedLeagueTeamInput = z.infer<typeof ImportedLeagueTeamSchema>;
export type ImportedTakenPlayerInput = z.infer<typeof ImportedTakenPlayerSchema>;
export type ImportedDraftPickInput = z.infer<typeof ImportedDraftPickSchema>;
export type ImportLeagueRequest = z.infer<typeof ImportLeagueRequestSchema>;
