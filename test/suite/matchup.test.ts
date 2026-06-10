import { describe, expect, it } from "vitest";
import { runMatchupFlow } from "../../stages/predict/matchupFlow.js";
import { runBaselineStage } from "../../stages/predict/baselineStage.js";
import { extractTeamIntel, trainingSlice } from "../../stages/predict/teamIntel.js";
import { MockSoccerAdapter } from "../../adapters/data/mockSoccerAdapter.js";

describe("matchup flow", () => {
  it("runs baseline stage on mock data", async () => {
    const result = await runMatchupFlow({
      homeTeam: "Barcelona",
      awayTeam: "Real Madrid",
      source: "mock",
      useAi: false,
    });
    expect(result.engine).toBe("baseline-stage");
    expect(result.homeWin + result.draw + result.awayWin).toBeCloseTo(1, 2);
  });

  it("extracts team intel", () => {
    const adapter = new MockSoccerAdapter();
    const intel = extractTeamIntel("Arsenal", "Liverpool", trainingSlice(adapter.getData()));
    expect(intel.resolvedHome).toBe("Arsenal");
    expect(runBaselineStage(intel).confidence).toBeGreaterThan(0);
  });
});
