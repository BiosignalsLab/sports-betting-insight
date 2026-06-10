import type { TeamIntel } from "./teamIntel.js";

export interface BaselineOutcome {
  homeWin: number;
  draw: number;
  awayWin: number;
  confidence: number;
}

export function runBaselineStage(intel: TeamIntel): BaselineOutcome {
  const coverage = (Number(Boolean(intel.resolvedHome)) + Number(Boolean(intel.resolvedAway))) / 2;
  const samples = intel.homePlayed + intel.awayPlayed + intel.headToHead * 2;
  const confidence = Math.min(0.95, Math.max(0.15, (samples / 16) * coverage));

  let homeWin = 0.42;
  let draw = intel.leagueDrawRate || 0.26;
  let awayWin = 0.32;

  if (intel.homePlayed > 0) homeWin += 0.08;
  if (intel.awayPlayed > 0) awayWin += 0.05;
  if (intel.headToHead > 0) draw += 0.03;

  const sum = homeWin + draw + awayWin;
  return {
    homeWin: homeWin / sum,
    draw: draw / sum,
    awayWin: awayWin / sum,
    confidence,
  };
}
