import mongoose, { Schema } from 'mongoose';
import type { NotificationDismissal } from '../types/notifications.types';

type NotificationDismissalDocument = NotificationDismissal;

const notificationDismissalSchema = new Schema<NotificationDismissalDocument>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    notificationId: {
      type: String,
      required: true,
      index: true,
    },
    dismissedAt: {
      type: String,
      required: true,
      default: () => new Date().toISOString(),
    },
  },
  {
    timestamps: true,
  },
);

notificationDismissalSchema.index(
  { userId: 1, notificationId: 1 },
  { unique: true },
);

export const NotificationDismissalModel:
  mongoose.Model<NotificationDismissalDocument> =
  mongoose.models.NotificationDismissal ||
  mongoose.model<NotificationDismissalDocument>(
    'NotificationDismissal',
    notificationDismissalSchema,
  );
