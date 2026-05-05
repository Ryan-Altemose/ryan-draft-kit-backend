import { NextResponse } from 'next/server';
import { ZodError, z } from 'zod';
import { leaguesService } from '@/features/Leagues/server/leagues.service';
import { connectDb } from '@/shared/server/connect-db';
import { getUserId } from '@/shared/server/get-user-id';
import { HttpError } from '@/shared/server/http-errors';

type RouteContext = {
  params: Promise<{ leagueId: string }>;
};

const FinishDraftSchema = z.object({
  name: z.string().min(1).trim(),
});

export async function POST(request: Request, context: RouteContext) {
  try {
    await connectDb();
    const userId = getUserId(request);
    const { leagueId } = await context.params;

    const payload = FinishDraftSchema.parse(await request.json());

    const updated = await leaguesService.finishDraftByLeagueId(
      leagueId,
      userId,
      payload.name,
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, message: 'League not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: updated });
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
      error instanceof Error ? error.message : 'Failed to finish draft';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

