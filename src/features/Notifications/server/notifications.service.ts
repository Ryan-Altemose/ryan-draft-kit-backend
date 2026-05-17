import { isValidObjectId } from 'mongoose';
import { NotificationDismissalModel } from './notification-dismissals.model';
import { NotificationModel } from './notifications.model';
import type {
  CreateArchivedNotificationInput,
  Notification,
} from '../types/notifications.types';

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
      dismissedIds.length > 0
        ? { _id: { $nin: dismissedIds } }
        : {},
    )
      .sort({ timestamp: -1, createdAt: -1 })
      .lean()) as unknown as Notification[];
  }

  async archiveNotification(
    input: CreateArchivedNotificationInput,
  ): Promise<Notification> {
    const timestamp = input.timestamp ?? new Date().toISOString();

    const notification = await NotificationModel.create({
      type: input.type,
      message: input.message,
      data: input.data ?? {},
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
