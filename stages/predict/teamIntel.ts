import type { Table } from "../../contracts/tables.js";
import { rowCount } from "../../contracts/tables.js";

export interface TeamIntel {
  homeTeam: string;
  awayTeam: string;
  resolvedHome: string | null;
  resolvedAway: string | null;
  homePlayed: number;
  awayPlayed: number;
  headToHead: number;
  leagueDrawRate: number;
  homeForm: string;
  awayForm: string;
}

function norm(name: string): string {
  return name.trim().toLowerCase();
}

function matchTeams(a: string, b: string): boolean {
  const l = norm(a);
  const r = norm(b);
  return l === r || l.includes(r) || r.includes(l);
}

function resolve(query: string, pool: string[]): string | null {
  return pool.find((c) => norm(c) === norm(query)) ?? pool.find((c) => matchTeams(c, query)) ?? null;
}

export function extractTeamIntel(homeTeam: string, awayTeam: string, table: Table): TeamIntel {
  const homeCol = table.columns.home_team ?? [];
  const awayCol = table.columns.away_team ?? [];
  const hg = table.columns.target__home_team__full_time_goals ?? [];
  const ag = table.columns.target__away_team__full_time_goals ?? [];
  const pool = [
    ...new Set(
      [...homeCol, ...awayCol].filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  ];

  const resolvedHome = resolve(homeTeam, pool);
  const resolvedAway = resolve(awayTeam, pool);
  let homeW = 0, homeD = 0, homeL = 0, homeN = 0;
  let awayW = 0, awayD = 0, awayL = 0, awayN = 0;
  let h2h = 0;
  let draws = 0, done = 0;

  for (let i = 0; i < rowCount(table); i++) {
    const home = homeCol[i];
    const away = awayCol[i];
    const h = Number(hg[i]);
    const a = Number(ag[i]);
    if (typeof home !== "string" || typeof away !== "string" || Number.isNaN(h) || Number.isNaN(a)) continue;
    done += 1;
    const res = h > a ? "W" : h < a ? "L" : "D";
    if (res === "D") draws += 1;

    if (resolvedHome && matchTeams(home, resolvedHome)) {
      homeN += 1;
      if (res === "W") homeW += 1;
      else if (res === "D") homeD += 1;
      else homeL += 1;
    }
    if (resolvedAway && matchTeams(away, resolvedAway)) {
      awayN += 1;
      if (res === "W") awayW += 1;
      else if (res === "D") awayD += 1;
      else awayL += 1;
    }
    if (resolvedHome && resolvedAway && matchTeams(home, resolvedHome) && matchTeams(away, resolvedAway)) {
      h2h += 1;
    }
  }

  return {
    homeTeam,
    awayTeam,
    resolvedHome,
    resolvedAway,
    homePlayed: homeN,
    awayPlayed: awayN,
    headToHead: h2h,
    leagueDrawRate: done ? draws / done : 0.25,
    homeForm: homeN ? `${homeW}W-${homeD}D-${homeL}L` : "n/a",
    awayForm: awayN ? `${awayW}W-${awayD}D-${awayL}L` : "n/a",
  };
}

export function trainingSlice(table: Table): Table {
  const fixtures = (table.columns.fixtures ?? []).map((v) => Boolean(v));
  const mask = fixtures.map((f) => !f);
  const columns: typeof table.columns = {};
  for (const [k, v] of Object.entries(table.columns)) {
    if (k === "fixtures") continue;
    columns[k] = v.filter((_, i) => mask[i]);
  }
  return { index: table.index.filter((_, i) => mask[i]), columns };
}
