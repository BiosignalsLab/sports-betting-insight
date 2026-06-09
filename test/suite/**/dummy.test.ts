import { describe, expect, it } from "vitest";
import { MockSoccerAdapter } from "../../adapters/data/mockSoccerAdapter.js";
import { OddsCompareStage } from "../../stages/betting/oddsCompareStage.js";
import { columnNames } from "../../contracts/tables.js";

describe("MockSoccerAdapter", () => {
  it("extracts training data with williamhill odds", () => {
    const loader = new MockSoccerAdapter();
    const [X, Y, O] = loader.extractTrainData(0, "williamhill");
    expect(X.index.length).toBeGreaterThan(0);
    expect(columnNames(Y).every((c) => c.startsWith("output__"))).toBe(true);
    expect(O).not.toBeNull();
    expect(columnNames(O!).every((c) => c.includes("williamhill"))).toBe(true);
  });

  it("lists odds types", () => {
    const loader = new MockSoccerAdapter();
    expect(loader.getOddsTypes()).toEqual(["interwetten", "williamhill"]);
  });
});

describe("OddsCompareStage", () => {
  const loader = new MockSoccerAdapter();
  const [X, Y, O] = loader.extractTrainData(0, "williamhill");

  it("fits with default odds types", () => {
    const bettor = new OddsCompareStage();
    bettor.fit(X, Y);
    expect(bettor.oddsTypes_.sort()).toEqual(["interwetten", "williamhill"]);
  });

  it("predicts value bets", () => {
    const bettor = new OddsCompareStage(["williamhill"], 0.03);
    bettor.fit(X, Y);
    const bets = bettor.bet(X, O!);
    expect(bets.length).toBe(X.index.length);
    expect(bets[0]?.length).toBe(bettor.bettingMarkets_.length);
  });
});
