# Betting Insight Pipeline (BIP)

Stage-based pipeline with adapters for data ingest, betting stages, and cache.

## Stages

1. **ingest** — `MockSoccerAdapter` / `LiveSoccerAdapter`
2. **evaluate** — `OddsCompareStage`, `runBacktestStage`
3. **adapter** — Redis + in-memory cache bridge

## CLI

```bash
npm run flow -- ingest manifest
npm run flow -- ingest batch
npm run flow -- evaluate walkforward
npm run flow -- evaluate recommend
npm run flow -- adapter ping
```

Contracts live in `contracts/`, shared utilities in `shared/`, orchestration in `cmd/flow.ts`.
