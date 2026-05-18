import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { LeagueModel } from '@/features/Leagues/server/leagues.model';
import { connectDb } from '@/shared/server/connect-db';
import { assertApiKeyAuth } from '@/shared/server/get-user-id';

const ResolveTargetUsersSchema = z.object({
  playerIds: z.array(z.string().trim().min(1)).min(1),
});

export async function POST(request: Request) {
  try {
    await connectDb();
    assertApiKeyAuth(request);

    const payload = ResolveTargetUsersSchema.parse(await request.json());
    const playerIds = new Set(payload.playerIds);

    const leagues = await LeagueModel.find(
      { taken_players: { $exists: true, $ne: [] } },
      { userId: 1, taken_players: 1 },
    ).lean();

    const targets = new Map<string, Set<string>>();

    for (const playerId of playerIds) {
      targets.set(playerId, new Set<string>());
    }

    for (const league of leagues) {
      const leagueUserId = String(league.userId);
      const takenPlayers = Array.isArray(league.taken_players)
        ? league.taken_players
        : [];

      for (const entry of takenPlayers) {
        const playerId = Array.isArray(entry) ? entry[0] : null;

        if (typeof playerId !== 'string' || !playerIds.has(playerId)) {
          continue;
        }

        targets.get(playerId)?.add(leagueUserId);
      }
    }

    return NextResponse.json({
      success: true,
      data: Object.fromEntries(
        [...targets.entries()].map(([playerId, userIds]) => [
          playerId,
          [...userIds],
        ]),
      ),
    });
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
        : 'Failed to resolve notification target users';

    return NextResponse.json({ success: false, message }, { status });
  }
}
