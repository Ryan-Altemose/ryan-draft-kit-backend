import { NextResponse } from 'next/server';
import { connectDb } from '@/shared/server/connect-db';
import { getUserId } from '@/shared/server/get-user-id';
import { HttpError } from '@/shared/server/http-errors';
import { leagueDraftsService } from '@/features/Leagues/server/leagueDrafts.service';

type RouteContext = {
  params: Promise<{ leagueId: string; draftId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    await connectDb();
    const userId = getUserId(request);
    const { draftId } = await context.params;

    const draft = await leagueDraftsService.getDraftById(draftId, userId);
    if (!draft) {
      return NextResponse.json(
        { success: false, message: 'Draft not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: draft });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status },
      );
    }

    const message =
      error instanceof Error ? error.message : 'Failed to fetch draft';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

