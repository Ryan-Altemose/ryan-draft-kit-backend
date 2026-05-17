import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { connectDb } from '@/shared/server/connect-db';
import { UserModel } from '@/features/Users/server/users.model';
import { usersService } from '@/features/Users/server/users.service';
import { NotificationDismissalModel } from './notification-dismissals.model';
import { NotificationModel } from './notifications.model';
import { NotificationsService } from './notifications.service';

const envPath = path.resolve(process.cwd(), '.env.local');
const envTextForCheck = fs.existsSync(envPath)
  ? fs.readFileSync(envPath, 'utf8')
  : '';
const hasMongoConfig = /(?:^|\n)\s*MONGODB_URI\s*=\s*.+/.test(envTextForCheck);
const describeWithMongo = hasMongoConfig ? describe : describe.skip;

describeWithMongo('NotificationsService', () => {
  const service = new NotificationsService();
  const testPrefix = 'vitest-notifications-service';
  let primaryUserId: string;
  let secondaryUserId: string;

  beforeAll(async () => {
    const envText = fs.readFileSync(envPath, 'utf8');
    const match = envText.match(
      /(?:^|\n)\s*MONGODB_URI\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\n#]+))/,
    );

    if (match && !process.env.MONGODB_URI) {
      process.env.MONGODB_URI = (match[1] || match[2] || match[3] || '').trim();
    }

    await connectDb();
  });

  beforeEach(async () => {
    await NotificationModel.deleteMany({ message: { $regex: `^${testPrefix}` } });
    await NotificationDismissalModel.deleteMany({});
    await UserModel.deleteMany({
      email: { $regex: `^${testPrefix}` },
    });

    primaryUserId = (
      await usersService.upsertProviderUser({
        authProvider: 'google',
        providerSubject: `${testPrefix}-primary-subject`,
        email: `${testPrefix}-primary@example.com`,
        name: 'Primary Notification User',
        avatarUrl: null,
      })
    )._id;

    secondaryUserId = (
      await usersService.upsertProviderUser({
        authProvider: 'google',
        providerSubject: `${testPrefix}-secondary-subject`,
        email: `${testPrefix}-secondary@example.com`,
        name: 'Secondary Notification User',
        avatarUrl: null,
      })
    )._id;
  });

  afterAll(async () => {
    await NotificationModel.deleteMany({
      message: { $regex: `^${testPrefix}` },
    });
    await UserModel.deleteMany({
      email: { $regex: `^${testPrefix}` },
    });
    await mongoose.disconnect();
  });

  it('archives one global notification for all users', async () => {
    const archived = await service.archiveNotification({
      type: 'test-notification',
      message: `${testPrefix} archived message`,
      data: { source: 'unit-test' },
      timestamp: '2026-05-17T18:00:00.000Z',
    });

    expect(archived.message).toBe(`${testPrefix} archived message`);

    const primaryNotifications = await service.listNotifications(primaryUserId);
    const secondaryNotifications =
      await service.listNotifications(secondaryUserId);

    expect(primaryNotifications[0]?.message).toBe(
      `${testPrefix} archived message`,
    );
    expect(secondaryNotifications[0]?.message).toBe(
      `${testPrefix} archived message`,
    );
  });

  it('dismisses notifications only for the current user', async () => {
    const archived = await service.archiveNotification({
      type: 'test-notification',
      message: `${testPrefix} dismiss me`,
      data: { source: 'unit-test' },
      timestamp: '2026-05-17T18:00:00.000Z',
    });

    const [primaryNotification] = await service.listNotifications(primaryUserId);
    expect(primaryNotification).toBeDefined();

    const deleted = await service.deleteNotification(
      primaryNotification._id,
      primaryUserId,
    );
    expect(String(deleted?._id)).toBe(String(primaryNotification._id));

    const primaryRemaining = await service.listNotifications(primaryUserId);
    const secondaryRemaining = await service.listNotifications(secondaryUserId);

    expect(
      primaryRemaining.some(
        (item) => String(item._id) === String(primaryNotification._id),
      ),
    ).toBe(false);
    expect(
      secondaryRemaining.some(
        (item) => String(item._id) === String(primaryNotification._id),
      ),
    ).toBe(true);
    expect(String(archived._id)).toBe(String(primaryNotification._id));
  });
});
