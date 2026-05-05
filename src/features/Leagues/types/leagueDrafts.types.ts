import { z } from 'zod';
import { DraftPickSchema, LeagueTeamSchema, TakenPlayerSchema } from './leagues.types';

export const LeagueDraftSchema = z.object({
  leagueId: z.string().min(1),
  name: z.string().min(1).trim(),
  taken_players: z.array(TakenPlayerSchema).default([]),
  draft_picks: z.array(DraftPickSchema).default([]),
  teams: z.array(LeagueTeamSchema).default([]),
  totalBudget: z.number().int().min(1).optional(),
});

export const CreateLeagueDraftSchema = z.object({
  name: z.string().min(1).trim().optional(),
});

export type LeagueDraftInput = z.infer<typeof LeagueDraftSchema>;
export type CreateLeagueDraftInput = z.infer<typeof CreateLeagueDraftSchema>;

export interface LeagueDraft extends LeagueDraftInput {
  _id: string;
  userId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface LeagueDraftsResponse {
  success: boolean;
  data: LeagueDraft[];
}

export interface LeagueDraftResponse {
  success: boolean;
  data: LeagueDraft;
}
