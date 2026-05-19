import { randomUUID } from 'node:crypto';
import type { LeagueInput, LeagueTeam, TakenPlayer, DraftPick } from '../types/leagues.types';
import type {
  ImportedDraftPickInput,
  ImportedLeagueInput,
  ImportedTakenPlayerInput,
} from '../types/league-import.types';
import { HttpError } from '@/shared/server/http-errors';

type ExternalPlayer = {
  _id: string;
  name: string;
};

type ExternalPlayersResponse = {
  data?: ExternalPlayer[];
  pagination?: {
    totalPages?: number;
  };
};

function normalizePlayerName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}+/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getExternalApiBaseUrl(): string {
  const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    throw new Error('API_URL or NEXT_PUBLIC_API_URL is required for league imports');
  }

  return apiUrl.replace(/\/+$/, '');
}

function getExternalApiKey(): string {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY;

  if (!apiKey) {
    throw new Error('NEXT_PUBLIC_API_KEY is required for league imports');
  }

  return apiKey;
}

function toImportedExternalId(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `imported-${slug || 'league'}-${randomUUID()}`;
}

function toTeamId(index: number): string {
  return `team-${index + 1}`;
}

function calculateImportedBudget(
  totalBudget: number,
  teamId: string,
  takenPlayers: TakenPlayer[],
): number {
  const spent = takenPlayers.reduce((sum, [, takenTeamId, , price]) => {
    if (takenTeamId !== teamId) return sum;
    return sum + price;
  }, 0);

  return Math.max(0, totalBudget - spent);
}

async function fetchAllPlayers(): Promise<ExternalPlayer[]> {
  const apiBaseUrl = getExternalApiBaseUrl();
  const apiKey = getExternalApiKey();
  const headers = {
    Accept: 'application/json',
    'x-api-key': apiKey,
  };

  const firstResponse = await fetch(`${apiBaseUrl}/api/players?limit=100&page=1`, {
    headers,
    cache: 'no-store',
  });

  if (!firstResponse.ok) {
    throw new Error(`Failed to fetch players for import (${firstResponse.status})`);
  }

  const firstPage = (await firstResponse.json()) as ExternalPlayersResponse;
  const firstBatch = firstPage.data ?? [];
  const totalPages = Math.max(1, firstPage.pagination?.totalPages ?? 1);

  if (totalPages === 1) {
    return firstBatch;
  }

  const remaining = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      fetch(`${apiBaseUrl}/api/players?limit=100&page=${index + 2}`, {
        headers,
        cache: 'no-store',
      }),
    ),
  );

  for (const response of remaining) {
    if (!response.ok) {
      throw new Error(`Failed to fetch players for import (${response.status})`);
    }
  }

  const remainingPages = (await Promise.all(
    remaining.map((response) => response.json() as Promise<ExternalPlayersResponse>),
  )).flatMap((page) => page.data ?? []);

  return [...firstBatch, ...remainingPages];
}

function assertUniqueTeamNames(importedLeague: ImportedLeagueInput): void {
  const seen = new Set<string>();

  for (const team of importedLeague.teams) {
    if (seen.has(team.name)) {
      throw new HttpError(400, `Duplicate team name in import: ${team.name}`);
    }
    seen.add(team.name);
  }
}

function buildPlayerIdMap(
  importedLeague: ImportedLeagueInput,
  players: ExternalPlayer[],
): Map<string, string> {
  const requestedNames = new Set<string>();

  for (const takenPlayer of importedLeague.taken_players ?? []) {
    requestedNames.add(takenPlayer.playerName);
  }

  for (const draftPick of importedLeague.draft_picks ?? []) {
    requestedNames.add(draftPick.playerName);
  }

  const playersByName = new Map<string, ExternalPlayer[]>();
  for (const player of players) {
    const normalizedName = normalizePlayerName(player.name);
    const existing = playersByName.get(normalizedName) ?? [];
    existing.push(player);
    playersByName.set(normalizedName, existing);
  }

  const playerIdMap = new Map<string, string>();
  for (const playerName of requestedNames) {
    const matches = playersByName.get(normalizePlayerName(playerName)) ?? [];

    if (matches.length === 0) {
      throw new HttpError(400, `Unknown player in import: ${playerName}`);
    }

    if (matches.length > 1) {
      throw new HttpError(400, `Ambiguous player name in import: ${playerName}`);
    }

    playerIdMap.set(playerName, matches[0]._id);
  }

  return playerIdMap;
}

function validateTeamReference(
  teamName: string,
  teamIdMap: Map<string, string>,
  label: string,
): string {
  const teamId = teamIdMap.get(teamName);
  if (!teamId) {
    throw new HttpError(400, `${label} references unknown team: ${teamName}`);
  }
  return teamId;
}

function mapTakenPlayers(
  importedTakenPlayers: ImportedTakenPlayerInput[],
  teamIdMap: Map<string, string>,
  playerIdMap: Map<string, string>,
): TakenPlayer[] {
  const seenPlayerIds = new Set<string>();

  return importedTakenPlayers.map((takenPlayer) => {
    const playerId = playerIdMap.get(takenPlayer.playerName);
    if (!playerId) {
      throw new HttpError(400, `Unknown player in import: ${takenPlayer.playerName}`);
    }

    if (seenPlayerIds.has(playerId)) {
      throw new HttpError(400, `Duplicate player in import: ${takenPlayer.playerName}`);
    }
    seenPlayerIds.add(playerId);

    return [
      playerId,
      validateTeamReference(takenPlayer.teamName, teamIdMap, 'taken_players'),
      takenPlayer.positionSlot,
      takenPlayer.price,
      takenPlayer.contract ?? '',
    ];
  });
}

function mapDraftPicks(
  importedDraftPicks: ImportedDraftPickInput[],
  teamIdMap: Map<string, string>,
  playerIdMap: Map<string, string>,
): DraftPick[] {
  const seenPickNumbers = new Set<number>();
  const seenPlayerIds = new Set<string>();

  return importedDraftPicks.map((draftPick) => {
    if (seenPickNumbers.has(draftPick.pickNumber)) {
      throw new HttpError(400, `Duplicate draft pick number in import: ${draftPick.pickNumber}`);
    }
    seenPickNumbers.add(draftPick.pickNumber);

    const playerId = playerIdMap.get(draftPick.playerName);
    if (!playerId) {
      throw new HttpError(400, `Unknown player in import: ${draftPick.playerName}`);
    }

    if (seenPlayerIds.has(playerId)) {
      throw new HttpError(400, `Duplicate player in import: ${draftPick.playerName}`);
    }
    seenPlayerIds.add(playerId);

    return [
      draftPick.pickNumber,
      validateTeamReference(draftPick.nominatingTeamName, teamIdMap, 'draft_picks'),
      validateTeamReference(draftPick.winningTeamName, teamIdMap, 'draft_picks'),
      playerId,
      draftPick.salary,
    ];
  });
}

function validateDraftPickConsistency(
  importedDraftPicks: ImportedDraftPickInput[],
  importedTakenPlayers: ImportedTakenPlayerInput[],
): void {
  if (importedDraftPicks.length === 0) return;

  const takenPlayersByName = new Map(
    importedTakenPlayers.map((takenPlayer) => [takenPlayer.playerName, takenPlayer]),
  );

  for (const draftPick of importedDraftPicks) {
    const matchingTakenPlayer = takenPlayersByName.get(draftPick.playerName);

    if (!matchingTakenPlayer) {
      throw new HttpError(
        400,
        `draft_picks and taken_players disagree for player: ${draftPick.playerName}`,
      );
    }

    if (
      matchingTakenPlayer.teamName !== draftPick.winningTeamName ||
      matchingTakenPlayer.price !== draftPick.salary
    ) {
      throw new HttpError(
        400,
        `draft_picks and taken_players disagree for player: ${draftPick.playerName}`,
      );
    }
  }
}

function buildTeams(
  importedLeague: ImportedLeagueInput,
  takenPlayers: TakenPlayer[],
): LeagueTeam[] {
  const importedTotalBudget =
    importedLeague.totalBudget ??
    (importedLeague.teams.every((team) => typeof team.budget === 'number')
      ? undefined
      : null);

  if (importedTotalBudget === null) {
    throw new HttpError(400, 'totalBudget is required when imported teams do not include budgets');
  }

  return importedLeague.teams.map((team, index) => {
    const teamId = toTeamId(index);
    const budget =
      team.budget ??
      calculateImportedBudget(importedTotalBudget as number, teamId, takenPlayers);

    return [teamId, team.name, budget];
  });
}

export async function mapImportedLeagueToLeagueInput(
  importedLeague: ImportedLeagueInput,
): Promise<LeagueInput> {
  assertUniqueTeamNames(importedLeague);
  validateDraftPickConsistency(
    importedLeague.draft_picks ?? [],
    importedLeague.taken_players ?? [],
  );

  const players = await fetchAllPlayers();
  const playerIdMap = buildPlayerIdMap(importedLeague, players);
  const teamIdMap = new Map(
    importedLeague.teams.map((team, index) => [team.name, toTeamId(index)]),
  );

  const takenPlayers = mapTakenPlayers(
    importedLeague.taken_players ?? [],
    teamIdMap,
    playerIdMap,
  );
  const draftPicks = mapDraftPicks(
    importedLeague.draft_picks ?? [],
    teamIdMap,
    playerIdMap,
  );
  const teams = buildTeams(importedLeague, takenPlayers);

  return {
    externalId: toImportedExternalId(importedLeague.name),
    name: importedLeague.name,
    description: importedLeague.description,
    format: importedLeague.format,
    draftType: importedLeague.draftType,
    leagueType: importedLeague.leagueType,
    battingCategories: importedLeague.battingCategories,
    pitchingCategories: importedLeague.pitchingCategories,
    rosterSlots: importedLeague.rosterSlots,
    totalBudget: importedLeague.totalBudget,
    taken_players: takenPlayers,
    draft_picks: draftPicks,
    teams,
    isDefault: false,
    categoryWeights: importedLeague.categoryWeights,
    minorLeagueSlotsPerTeam: importedLeague.minorLeagueSlotsPerTeam,
    taxiSquadPlayersPerTeam: importedLeague.taxiSquadPlayersPerTeam,
  };
}
