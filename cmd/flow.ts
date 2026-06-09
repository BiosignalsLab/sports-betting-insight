#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";

const logger = {
  info: (msg: unknown) => console.log(typeof msg === "string" ? msg : JSON.stringify(msg, null, 2)),
};
import { MockSoccerAdapter } from "../adapters/data/mockSoccerAdapter.js";
import { OddsCompareStage, runBacktestStage } from "../stages/betting/index.js";
import type { Table } from "../contracts/tables.js";
import { columnNames } from "../contracts/tables.js";
import { backtestCacheKey, valueBetsCacheKey } from "../adapters/cache/keyBuilder.js";
import { cacheFlushNamespace, cacheGet, cacheSet } from "../adapters/cache/memoryRedis.js";
import { closeRedisClient, isRedisEnabled, pingRedis } from "../adapters/cache/redisAdapter.js";
import { ChronoSplit } from "../shared/chronoSplit.js";

function printUsage(): void {
  logger.info(`
${chalk.bold("bip")} — Stage-based betting insight pipeline with adapters, caching, and CLI flow runner

Usage:
  npm run flow -- ingest manifest
  npm run flow -- ingest sources
  npm run flow -- ingest batch [--out dir] [--no-cache]
  npm run flow -- evaluate walkforward [--out dir] [--no-cache]
  npm run flow -- evaluate recommend [--no-cache]
  npm run flow -- adapter ping
  npm run flow -- adapter purge
`);
}

function tableToCsv(table: Table, name: string): string {
  const cols = columnNames(table);
  const header = ["date", ...cols].join(",");
  const rows = table.index.map((date, i) =>
    [date.toISOString().slice(0, 10), ...cols.map((c) => String(table.columns[c]?.[i] ?? ""))].join(","),
  );
  return `# ${name}\n${header}\n${rows.join("\n")}\n`;
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printUsage();
    process.exit(0);
  }

  const useCache = !hasFlag(args, "--no-cache");
  const dataloader = new MockSoccerAdapter();
  const outIdx = args.indexOf("--out");
  const outDir = outIdx >= 0 ? args[outIdx + 1] : null;

  if (args[0] === "adapter" && args[1] === "ping") {
    if (!isRedisEnabled()) {
      logger.info(chalk.yellow("Redis is disabled. Set REDIS_URL or REDIS_HOST to enable."));
      return;
    }
    const ok = await pingRedis();
    logger.info(ok ? chalk.green("Redis PONG") : chalk.red("Redis unreachable"));
    return;
  }

  if (args[0] === "adapter" && args[1] === "purge") {
    const removed = await cacheFlushNamespace();
    logger.info(chalk.green(`Flushed ${removed} Redis key(s) with bip prefix`));
    return;
  }

  if (args[0] === "ingest" && args[1] === "manifest") {
    logger.info(JSON.stringify(MockSoccerAdapter.getAllParams(), null, 2));
    return;
  }

  if (args[0] === "ingest" && args[1] === "sources") {
    logger.info(JSON.stringify(dataloader.getOddsTypes(), null, 2));
    return;
  }

  if (args[0] === "ingest" && args[1] === "batch") {
    const [X, Y, O] = dataloader.extractTrainData(0, "williamhill");
    if (outDir) {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, "X_train.csv"), tableToCsv(X, "X_train"));
      writeFileSync(join(outDir, "Y_train.csv"), tableToCsv(Y, "Y_train"));
      if (O) writeFileSync(join(outDir, "O_train.csv"), tableToCsv(O, "O_train"));
      logger.info(chalk.green(`Training data written to ${outDir}`));
    } else {
      logger.info({ rows: X.index.length, markets: columnNames(Y), cache: useCache });
    }
    return;
  }

  if (args[0] === "evaluate" && args[1] === "walkforward") {
    const oddsType = "williamhill";
    const alpha = 0.03;
    const splits = 2;
    const cacheKey = backtestCacheKey(oddsType, alpha, splits);

    if (useCache) {
      const cached = await cacheGet<ReturnType<typeof runBacktestStage>>(cacheKey);
      if (cached) {
        logger.info(chalk.cyan("(cached)"));
        if (outDir) {
          mkdirSync(outDir, { recursive: true });
          writeFileSync(join(outDir, "backtest.json"), JSON.stringify(cached, null, 2));
          logger.info(chalk.green(`Backtest results written to ${outDir}/backtest.json`));
        } else {
          logger.info(JSON.stringify(cached, null, 2));
        }
        return;
      }
    }

    const [X, Y, O] = dataloader.extractTrainData(0, oddsType);
    if (!O) throw new Error("Odds required for backtest.");
    const bettor = new OddsCompareStage([oddsType], alpha);
    const results = runBacktestStage(bettor, X, Y, O, new ChronoSplit(splits));

    if (useCache) {
      await cacheSet(cacheKey, results);
    }

    if (outDir) {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, "backtest.json"), JSON.stringify(results, null, 2));
      logger.info(chalk.green(`Backtest results written to ${outDir}/backtest.json`));
    } else {
      logger.info(JSON.stringify(results, null, 2));
    }
    return;
  }

  if (args[0] === "evaluate" && args[1] === "recommend") {
    const oddsType = "williamhill";
    const alpha = 0.03;
    const cacheKey = valueBetsCacheKey(oddsType, alpha);

    if (useCache) {
      const cached = await cacheGet<{ valueBets: unknown }>(cacheKey);
      if (cached) {
        logger.info(chalk.cyan("(cached)"));
        logger.info(JSON.stringify(cached, null, 2));
        return;
      }
    }

    const [XTrain, YTrain, OTrain] = dataloader.extractTrainData(0, oddsType);
    const [XFix, , OFix] = dataloader.extractFixturesData();
    if (!OTrain || !OFix) throw new Error("Odds required for betting.");
    const bettor = new OddsCompareStage([oddsType], alpha);
    bettor.fit(XTrain, YTrain);
    const valueBets = bettor.bet(XFix, OFix);
    const payload = { valueBets };

    if (useCache) {
      await cacheSet(cacheKey, payload);
    }

    logger.info(JSON.stringify(payload, null, 2));
    return;
  }

  printUsage();
  process.exit(1);
}

main()
  .catch((err: unknown) => {
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  })
  .finally(async () => {
    await closeRedisClient();
  });
