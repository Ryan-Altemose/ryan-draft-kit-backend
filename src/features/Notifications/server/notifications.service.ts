import { isValidObjectId } from 'mongoose';
import { NotificationDismissalModel } from './notification-dismissals.model';
import { NotificationModel } from './notifications.model';
import type {
  CreateArchivedNotificationInput,
  Notification,
} from '../types/notifications.types';

function stripSource(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripSource);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== 'source')
        .map(([key, nestedValue]) => [key, stripSource(nestedValue)]),
    );
  }

  return value;
}

export class NotificationsService {
  async listNotifications(userId: string): Promise<Notification[]> {
    const dismissedNotificationIds = await NotificationDismissalModel.find(
      { userId },
      { notificationId: 1 },
    ).lean();

    const dismissedIds = dismissedNotificationIds.map((record) =>
      String(record.notificationId),
    );

    return (await NotificationModel.find(
      {
        ...(dismissedIds.length > 0 ? { _id: { $nin: dismissedIds } } : {}),
        $or: [
          { targetUserIds: { $exists: false } },
          { targetUserIds: { $size: 0 } },
          { targetUserIds: userId },
        ],
      },
    )
      .sort({ timestamp: -1, createdAt: -1 })
      .lean()) as unknown as Notification[];
  }

  async archiveNotification(
    input: CreateArchivedNotificationInput,
  ): Promise<Notification> {
    const timestamp = input.timestamp ?? new Date().toISOString();
    const data = stripSource(input.data ?? {}) as Record<string, unknown>;

    const notification = await NotificationModel.create({
      type: input.type,
      message: input.message,
      data,
      targetUserIds: input.targetUserIds ?? [],
      timestamp,
    });

    return notification.toObject() as unknown as Notification;
  }

  async deleteNotification(
    id: string,
    userId: string,
  ): Promise<Notification | null> {
    if (!isValidObjectId(id)) {
      return null;
    }

    const notification = await NotificationModel.findById(id).lean();

    if (!notification) {
      return null;
    }

    const existingDismissal = await NotificationDismissalModel.findOne({
      userId,
      notificationId: id,
    }).lean();

    if (existingDismissal) {
      return notification as Notification;
    }

    await NotificationDismissalModel.create({
      userId,
      notificationId: id,
      dismissedAt: new Date().toISOString(),
    });

    return notification as Notification;
  }
}

export const notificationsService = new NotificationsService();
