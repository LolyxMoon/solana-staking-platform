 
# StakePoint — Solana Staking Platform

A DeFi staking protocol on Solana supporting SPL tokens, Token-2022, and Native SOL with flexible reward mechanisms.

**Status:** Live on Mainnet  
**Program ID:** `gLHaGJsZ6G7AXZxoDL9EsSWkRbKAWhFHi73gVfNXuzK`

## Features

* **Fixed APY or Variable APR** — Choose per-pool reward calculation
* **Lockup Periods** — Configurable lock duration per pool
* **Reflection Rewards** — Support for Native SOL, SPL, or self-reflecting tokens
* **Multi-Token Support** — SPL tokens, Token-2022, Native SOL
* **Referral System** — Configurable fee splits for referrers
* **Platform Fees** — Token % fee + flat SOL fee on transactions

## Architecture

| Component | Description |
|-----------|-------------|
| Platform PDA | Global fee configuration |
| Project PDA | Per-pool settings (rate, lockup, vaults) |
| Stake PDA | Per-user stake tracking |
| Staking Vault | Holds staked tokens |
| Reward Vault | Holds reward tokens |
| Reflection Vault | Holds reflection distributions |

## Rate Modes

* **Fixed (mode 0):** Static APY set at pool creation
* **Variable (mode 1):** Dynamic APR based on reward deposits and time remaining

## Security

* All vaults are PDAs owned by the program
* User stakes stored in individual PDAs
* Admin functions require project admin signature
* Lockup enforced on-chain — withdrawals revert until lock expires

### Current Trust Model

* **Upgrade authority:** Single wallet (multisig migration planned)
* **Admin can:** pause/unpause pools, deposit rewards, update referrer settings, emergency unlock
* **Admin cannot:** modify user stake amounts, transfer user funds without program logic

## Roadmap

- [ ] Multisig upgrade authority (Squads)
- [ ] Timelock on admin functions
- [ ] Formal audit
- [ ] Program immutability (post-audit, 6+ months stable operation)

## Links

* App: https://stakepoint.app
* Docs: https://stakepoint.app/docs
* Twitter: [@stakepointapp](https://twitter.com/stakepointapp)
