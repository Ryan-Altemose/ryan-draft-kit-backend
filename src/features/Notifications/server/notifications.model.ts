import mongoose, { Schema } from 'mongoose';
import type { Notification } from '../types/notifications.types';

type NotificationDocument = Notification;

const notificationSchema = new Schema<NotificationDocument>(
  {
    type: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

notificationSchema.index({ timestamp: -1, createdAt: -1 });

export const NotificationModel: mongoose.Model<NotificationDocument> =
  mongoose.models.Notification ||
  mongoose.model<NotificationDocument>('Notification', notificationSchema);
