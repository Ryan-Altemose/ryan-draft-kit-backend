import { isValidObjectId } from 'mongoose';
import { NotebookModel } from './notebooks.model';
import type {
  CreateNotebookInput,
  Notebook,
  NotebookFilters,
  UpdateNotebookInput,
} from '../types/notebooks.types';

export class NotebooksService {
  async listNotebooks(filters: NotebookFilters = {}): Promise<Notebook[]> {
    const query: Record<string, unknown> = {};

    if (filters.kind) {
      query.kind = filters.kind;
    }

    if (filters.playerName) {
      query.playerName = filters.playerName;
    }

    if (filters.playerId) {
      query.playerId = filters.playerId;
    }

    return (await NotebookModel.find(query)
      .sort({ updatedAt: -1 })
      .lean()) as unknown as Notebook[];
  }

  async getNotebookById(id: string): Promise<Notebook | null> {
    if (!isValidObjectId(id)) {
      return null;
    }

    return (await NotebookModel.findById(id).lean()) as unknown as Notebook | null;
  }

  async createNotebook(input: CreateNotebookInput): Promise<Notebook> {
    if (input.kind === 'player' && input.playerId) {
      const existing = (await NotebookModel.findOneAndUpdate(
        {
          kind: 'player',
          $or: [
            { playerId: input.playerId },
            { playerId: { $exists: false }, playerName: input.playerName },
          ],
        },
        {
          $set: {
            name: input.name,
            content: input.content ?? '',
            playerName: input.playerName,
            playerId: input.playerId,
          },
        },
        {
          new: true,
        },
      ).lean()) as unknown as Notebook | null;

      if (existing) {
        return existing;
      }
    }

    const notebook = await NotebookModel.create({
      kind: input.kind,
      name: input.name,
      content: input.content ?? '',
      playerName: input.playerName,
      playerId: input.playerId,
    });

    return notebook.toObject() as unknown as Notebook;
  }

  async updateNotebook(
    id: string,
    updates: UpdateNotebookInput,
  ): Promise<Notebook | null> {
    if (!isValidObjectId(id)) {
      return null;
    }

    return (await NotebookModel.findByIdAndUpdate(
      id,
      {
        $set: updates,
      },
      {
        new: true,
        runValidators: true,
      },
    ).lean()) as unknown as Notebook | null;
  }

  async deleteNotebook(id: string): Promise<Notebook | null> {
    if (!isValidObjectId(id)) {
      return null;
    }

    return (await NotebookModel.findByIdAndDelete(id).lean()) as unknown as Notebook | null;
  }
}

export const notebooksService = new NotebooksService();
