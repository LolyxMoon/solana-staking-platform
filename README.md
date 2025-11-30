# Solana Staking Platform — Starter Kit (v2: APR/APY, Fixed/Variable, Lockups)

What’s new in v2:
- **APR or APY** staking modes.
- **Fixed or Variable** rates (admin updatable).
- **Per-pool lockup** (in seconds) enforced on withdrawals.
- Keeps **platform % fee** and **flat SOL fee** on deposit/withdraw/claim.

This is still a starter: wire keys, program id, and harden before mainnet.

## Modes
- **APR (simple interest):** rewards accrue to *unclaimed* and do not increase principal automatically.
- **APY (auto-compounding):** rewards accrue by **increasing the staked amount** on each update (auto-compound).
- **Fixed:** rate only changes when admin calls `set_project_params`.
- **Variable:** same instruction, but you can change it as often as needed (e.g., based on liquidity).

## Lockups
- `lockup_seconds` per pool. Withdrawals revert until `now >= user.deposit_ts + lockup_seconds`.

## Build/Run
Same as v1:
```
anchor build && anchor deploy
# server: pnpm i && pnpm prisma:generate && pnpm prisma:migrate && pnpm dev
# web: pnpm i && pnpm dev
```
# Updated
# Deploy from web folder
# Fix program ID
# Redeploy with updated env vars
# Trigger deploy
# Redeploy with DIRECT_URL
# Apply env vars to all environments
# Fix env var format
# Fix env var format
# Fix env var format
# Fix env var format
# Fix env var format
