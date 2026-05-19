import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ImportLeagueRequestSchema } from '@/features/Leagues/types/league-import.types';
import { leaguesService } from '@/features/Leagues/server/leagues.service';
import { mapImportedLeagueToLeagueInput } from '@/features/Leagues/server/league-import.service';
import { connectDb } from '@/shared/server/connect-db';
import { getAuthenticatedUserId } from '@/shared/server/get-user-id';
import { HttpError } from '@/shared/server/http-errors';

export async function POST(request: Request) {
  try {
    await connectDb();
    const userId = getAuthenticatedUserId(request);

    const payload = ImportLeagueRequestSchema.parse(await request.json());
    const leagueInput = await mapImportedLeagueToLeagueInput(payload.importJson);
    const league = await leaguesService.upsertLeague(userId, leagueInput);

    return NextResponse.json({
      success: true,
      data: league,
    });
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
      error instanceof Error ? error.message : 'Failed to import league';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
