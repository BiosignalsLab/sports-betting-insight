# betting-insight-pipeline

Stage-based betting insight pipeline with adapters, caching, and CLI flow runner

## Commands

```bash
npm run flow -- dataloader params
npm run flow -- dataloader training
npm run flow -- bettor backtest
npm run flow -- bettor bet
npm run flow -- redis ping
```

## Redis

Copy `.env.example` to `.env` and set `REDIS_URL` or `REDIS_HOST`. Cache prefix defaults to `bip:`.

## Examples

See `docs/` for worked examples.
