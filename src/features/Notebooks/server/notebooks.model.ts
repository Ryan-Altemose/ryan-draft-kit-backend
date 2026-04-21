import mongoose, { Schema } from 'mongoose';
import type { Notebook } from '../types/notebooks.types';

const notebookSchema = new Schema<Notebook>(
  {
    kind: {
      type: String,
      required: true,
      enum: ['custom', 'player'],
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      default: '',
    },
    playerName: {
      type: String,
      trim: true,
    },
    playerId: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
  },
);

notebookSchema.index({ kind: 1, updatedAt: -1 });
notebookSchema.index({ playerName: 1 });

export const NotebookModel =
  mongoose.models.Notebook ||
  mongoose.model<Notebook>('Notebook', notebookSchema);
