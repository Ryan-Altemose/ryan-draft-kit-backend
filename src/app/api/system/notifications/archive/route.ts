import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { notificationsService } from '@/features/Notifications/server/notifications.service';
import { CreateArchivedNotificationSchema } from '@/features/Notifications/types/notifications.types';
import { connectDb } from '@/shared/server/connect-db';
import { assertApiKeyAuth } from '@/shared/server/get-user-id';

export async function POST(request: Request) {
  try {
    await connectDb();
    assertApiKeyAuth(request);

    const payload = CreateArchivedNotificationSchema.parse(await request.json());
    const notification = await notificationsService.archiveNotification(payload);

    return NextResponse.json(
      {
        success: true,
        data: {
          archived: true,
          archivedCount: 1,
          notification,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 },
      );
    }

    const status =
      error instanceof Error && error.message.toLowerCase().includes('api key')
        ? 401
        : 500;
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to archive notifications';

    return NextResponse.json({ success: false, message }, { status });
  }
}
