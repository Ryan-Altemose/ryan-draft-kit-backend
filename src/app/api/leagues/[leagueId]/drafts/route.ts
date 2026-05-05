import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { connectDb } from '@/shared/server/connect-db';
import { getUserId } from '@/shared/server/get-user-id';
import { HttpError } from '@/shared/server/http-errors';
import { CreateLeagueDraftSchema } from '@/features/Leagues/types/leagueDrafts.types';
import { leagueDraftsService } from '@/features/Leagues/server/leagueDrafts.service';

type RouteContext = {
  params: Promise<{ leagueId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    await connectDb();
    const userId = getUserId(request);
    const { leagueId } = await context.params;

    const drafts = await leagueDraftsService.listDrafts(leagueId, userId);
    return NextResponse.json({ success: true, data: drafts });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 },
      );
    }

    if (error instanceof HttpError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status },
      );
    }

    const message =
      error instanceof Error ? error.message : 'Failed to fetch drafts';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    await connectDb();
    const userId = getUserId(request);
    const { leagueId } = await context.params;

    const payload = CreateLeagueDraftSchema.parse(await request.json().catch(() => ({})));
    const result = await leagueDraftsService.startNewDraft(leagueId, userId, payload);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 },
      );
    }

    if (error instanceof HttpError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status },
      );
    }

    const message =
      error instanceof Error ? error.message : 'Failed to start new draft';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

