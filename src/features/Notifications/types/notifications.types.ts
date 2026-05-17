import { z } from 'zod';

export const NotificationPayloadSchema = z.record(z.string(), z.unknown());

export const NotificationSchema = z.object({
  _id: z.string(),
  type: z.string().trim().min(1),
  message: z.string().trim().min(1),
  data: NotificationPayloadSchema,
  timestamp: z.string().datetime(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const NotificationDismissalSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  notificationId: z.string(),
  dismissedAt: z.string().datetime(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CreateArchivedNotificationSchema = z.object({
  type: z.string().trim().min(1),
  message: z.string().trim().min(1),
  data: NotificationPayloadSchema.optional().default({}),
  timestamp: z.string().datetime().optional(),
});

export type Notification = z.infer<typeof NotificationSchema>;
export type NotificationDismissal = z.infer<
  typeof NotificationDismissalSchema
>;
export type CreateArchivedNotificationInput = z.infer<
  typeof CreateArchivedNotificationSchema
>;
