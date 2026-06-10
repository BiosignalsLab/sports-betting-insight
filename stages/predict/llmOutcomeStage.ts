import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { loadEnv } from "../../shared/loadEnv.js";
import type { TeamIntel } from "./teamIntel.js";
import type { BaselineOutcome } from "./baselineStage.js";

const schema = z.object({
  homeWin: z.number().min(0).max(1),
  draw: z.number().min(0).max(1),
  awayWin: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  narrative: z.string(),
});

export interface LlmOutcome extends BaselineOutcome {
  narrative: string;
}

export function llmConfigured(): boolean {
  loadEnv();
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function llmSetupHelp(): string {
  return [
    "AI stage requires OPENAI_API_KEY in .env (use --no-ai for baseline only).",
    "  cp .env.example .env",
    "  set OPENAI_API_KEY=sk-...",
  ].join("\n");
}

export async function runLlmOutcomeStage(
  intel: TeamIntel,
  baseline: BaselineOutcome,
): Promise<LlmOutcome> {
  loadEnv();
  if (!llmConfigured()) throw new Error(llmSetupHelp());

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const prompt = [
    `Stage: LLM outcome refinement for ${intel.homeTeam} (home) vs ${intel.awayTeam} (away).`,
    `Resolved: home=${intel.resolvedHome ?? "unknown"}, away=${intel.resolvedAway ?? "unknown"}.`,
    `Home form: ${intel.homeForm} (${intel.homePlayed} matches).`,
    `Away form: ${intel.awayForm} (${intel.awayPlayed} matches).`,
    `Head-to-head samples: ${intel.headToHead}. League draw rate: ${(intel.leagueDrawRate * 100).toFixed(1)}%.`,
    `Baseline: H ${(baseline.homeWin * 100).toFixed(1)}% D ${(baseline.draw * 100).toFixed(1)}% A ${(baseline.awayWin * 100).toFixed(1)}%.`,
    "Return calibrated probabilities summing to ~1 and a short narrative.",
  ].join("\n");

  const { object } = await generateObject({
    model: createOpenAI({ apiKey: process.env.OPENAI_API_KEY!.trim() })(model),
    schema,
    prompt,
  });

  const sum = object.homeWin + object.draw + object.awayWin || 1;
  return {
    homeWin: object.homeWin / sum,
    draw: object.draw / sum,
    awayWin: object.awayWin / sum,
    confidence: object.confidence,
    narrative: object.narrative,
  };
}
