import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  LeagueFiltersSchema,
  LeagueSchema,
} from '@/features/Leagues/types/leagues.types';
import { leaguesService } from '@/features/Leagues/server/leagues.service';
import { seedDefaultLeagues } from '@/features/Leagues/utils/leagues.seed';
import { connectDb } from '@/shared/server/connect-db';
import { getUserId } from '@/shared/server/get-user-id';
import { HttpError } from '@/shared/server/http-errors';

export async function GET(request: Request) {
  try {
    await connectDb();
    await seedDefaultLeagues();
    const userId = getUserId(request);

    const filters = LeagueFiltersSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    const { leagues, pagination } = await leaguesService.getLeagues(
      userId,
      filters,
    );

    return NextResponse.json({
      success: true,
      data: leagues,
      pagination: {
        total: pagination.total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.max(1, Math.ceil(pagination.total / pagination.limit)),
      },
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
      error instanceof Error ? error.message : 'Failed to fetch leagues';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await connectDb();
    const userId = getUserId(request);

    const payload = LeagueSchema.parse(await request.json());
    const league = await leaguesService.upsertLeague(userId, payload);

    return NextResponse.json({
      success: true,
      data: league,
      debug: {
        receivedHasDraftStateJson: Boolean(payload.draftStateJson),
        savedHasDraftStateJson: Boolean(league.draftStateJson),
      },
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
      error instanceof Error ? error.message : 'Failed to save league';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
