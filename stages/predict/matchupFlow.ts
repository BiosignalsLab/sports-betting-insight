import { MockSoccerAdapter } from "../../adapters/data/mockSoccerAdapter.js";
import { LiveSoccerAdapter } from "../../adapters/data/liveSoccerAdapter.js";
import { extractTeamIntel, trainingSlice } from "./teamIntel.js";
import { runBaselineStage, type BaselineOutcome } from "./baselineStage.js";
import { runLlmOutcomeStage } from "./llmOutcomeStage.js";

export type MatchupSource = "mock" | "live";

export interface MatchupFlowInput {
  homeTeam: string;
  awayTeam: string;
  source?: MatchupSource;
  useAi?: boolean;
  league?: string;
  division?: number;
  year?: number;
}

export interface MatchupFlowResult {
  homeTeam: string;
  awayTeam: string;
  homeWin: number;
  draw: number;
  awayWin: number;
  confidence: number;
  engine: "llm-stage" | "baseline-stage";
  source: MatchupSource;
  intel: ReturnType<typeof extractTeamIntel>;
  narrative?: string;
}

function normalizeParams(input: MatchupFlowInput) {
  return {
    league: [input.league ?? "England"],
    division: [input.division ?? 1],
    year: [input.year ?? 2020],
  };
}

export async function runMatchupFlow(input: MatchupFlowInput): Promise<MatchupFlowResult> {
  const source = input.source ?? "live";
  const params = normalizeParams(input);
  const paramGrid = params;

  const adapter =
    source === "live"
      ? new LiveSoccerAdapter(paramGrid)
      : new MockSoccerAdapter(paramGrid);

  if (source === "live") {
    await (adapter as LiveSoccerAdapter).loadRemoteData();
  }

  const intel = extractTeamIntel(input.homeTeam, input.awayTeam, trainingSlice(adapter.getData()));
  const baseline = runBaselineStage(intel);
  const useAi = input.useAi !== false;
  let narrative: string | undefined;
  let rates: BaselineOutcome;
  if (useAi) {
    const llm = await runLlmOutcomeStage(intel, baseline);
    narrative = llm.narrative as string;
    rates = llm;
  } else {
    rates = baseline;
  }

  return {
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    homeWin: rates.homeWin,
    draw: rates.draw,
    awayWin: rates.awayWin,
    confidence: rates.confidence,
    engine: useAi ? "llm-stage" : "baseline-stage",
    source,
    intel,
    narrative,
  };
}
