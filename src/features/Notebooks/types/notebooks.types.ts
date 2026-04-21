import { z } from 'zod';

export const NotebookKindSchema = z.enum(['custom', 'player']);

export const NotebookSchema = z.object({
  _id: z.string(),
  kind: NotebookKindSchema,
  name: z.string().trim().min(1),
  content: z.string(),
  playerName: z.string().trim().min(1).optional(),
  playerId: z.string().trim().min(1).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CreateNotebookSchema = z.object({
  kind: NotebookKindSchema,
  name: z.string().trim().min(1),
  content: z.string().optional(),
  playerName: z.string().trim().min(1).optional(),
  playerId: z.string().trim().min(1).optional(),
});

export const UpdateNotebookSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    content: z.string().optional(),
    playerName: z.string().trim().min(1).optional(),
    playerId: z.string().trim().min(1).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export const NotebookFiltersSchema = z.object({
  kind: NotebookKindSchema.optional(),
  playerName: z.string().trim().min(1).optional(),
  playerId: z.string().trim().min(1).optional(),
});

export type Notebook = z.infer<typeof NotebookSchema>;
export type CreateNotebookInput = z.infer<typeof CreateNotebookSchema>;
export type UpdateNotebookInput = z.infer<typeof UpdateNotebookSchema>;
export type NotebookFilters = z.infer<typeof NotebookFiltersSchema>;
