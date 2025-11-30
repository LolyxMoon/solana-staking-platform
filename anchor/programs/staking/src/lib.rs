use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, Mint};
declare_id!("B6Gbxi3h727WvrKHM2ANjrVDC9BpdXPenbncogT4oNva");

#[program]
pub mod staking {
    use super::*;

    /// ONE-TIME platform initialization (done manually via CLI)
    pub fn initialize(
        ctx: Context<Initialize>,
        platform_token_fee_bps: u64,
        platform_sol_fee: u64,
    ) -> Result<()> {
        let platform = &mut ctx.accounts.platform;
        
        platform.admin = ctx.accounts.admin.key();
        platform.fee_collector = ctx.accounts.fee_collector.key();
        platform.platform_token_fee_bps = platform_token_fee_bps;
        platform.platform_sol_fee = platform_sol_fee;
        platform.is_initialized = true;
        platform.bump = ctx.bumps.platform;
        
        emit!(PlatformInitialized {
            admin: platform.admin,
            fee_collector: platform.fee_collector,
            platform_token_fee_bps,
            platform_sol_fee,
        });
        
        Ok(())
    }

    /// STEP 1: Create project shell + base vaults (staking + reward)
    pub fn create_project(
        ctx: Context<CreateProject>,
        token_mint: Pubkey,
    ) -> Result<()> {
        let project = &mut ctx.accounts.project;
        
        project.admin = ctx.accounts.admin.key();
        project.token_mint = token_mint;
        project.staking_vault = ctx.accounts.staking_vault.key();
        project.reward_vault = ctx.accounts.reward_vault.key();
        project.reflection_vault = None;
        project.reflection_token = None;
        
        project.total_staked = 0;
        project.total_rewards_deposited = 0;
        project.total_rewards_claimed = 0;
        
        project.rate_bps_per_year = 0;
        project.rate_mode = 0;
        project.reward_rate_per_second = 0;
        project.lockup_seconds = 0;
        project.pool_duration_seconds = 0;
        project.pool_start_time = 0;
        project.pool_end_time = 0;
        
        project.last_update_time = 0;
        project.reward_per_token_stored = 0;
        project.reflection_per_token_stored = 0;
        project.last_reflection_update_time = 0;
        
        project.referrer = None;
        project.referrer_split_bps = 0;
        
        project.is_paused = false;
        project.deposit_paused = false;
        project.withdraw_paused = false;
        project.claim_paused = false;
        project.is_initialized = false;
        
        project.bump = ctx.bumps.project;
        
        emit!(ProjectCreated {
            project: project.key(),
            token_mint,
            staking_vault: ctx.accounts.staking_vault.key(),
            reward_vault: ctx.accounts.reward_vault.key(),
            admin: ctx.accounts.admin.key(),
        });
        
        Ok(())
    }

    /// STEP 2: Initialize pool with parameters + optional reflection vault
    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        params: InitializePoolParams,
    ) -> Result<()> {
        let project = &mut ctx.accounts.project;
        
        require!(!project.is_initialized, StakingError::AlreadyInitialized);
        require!(params.pool_duration_seconds > 0, StakingError::InvalidAmount);
        
        let current_time = Clock::get()?.unix_timestamp;
        
        project.rate_bps_per_year = params.rate_bps_per_year;
        project.rate_mode = params.rate_mode;
        project.lockup_seconds = params.lockup_seconds;
        project.pool_duration_seconds = params.pool_duration_seconds;
        project.pool_start_time = current_time;
        project.pool_end_time = current_time
            .checked_add(params.pool_duration_seconds as i64)
            .ok_or(StakingError::MathOverflow)?;
        
        project.last_update_time = current_time;
        project.last_reflection_update_time = current_time;
        
        if params.rate_mode == 0 {
            project.reward_rate_per_second = 0;
        }
        
        if let Some(referrer) = params.referrer {
            project.referrer = Some(referrer);
            project.referrer_split_bps = params.referrer_split_bps.unwrap_or(0);
        }
        
        if params.enable_reflections {
            require!(
                ctx.accounts.reflection_vault.is_some(),
                StakingError::ReflectionVaultRequired
            );
            require!(
                params.reflection_token.is_some(),
                StakingError::ReflectionTokenRequired
            );
            
            project.reflection_token = params.reflection_token;
            project.reflection_vault = ctx.accounts.reflection_vault
                .as_ref()
                .map(|v| v.key());
        }
        
        project.is_initialized = true;
        
        emit!(PoolInitialized {
            project: project.key(),
            staking_vault: project.staking_vault,
            reward_vault: project.reward_vault,
            reflection_vault: project.reflection_vault,
            rate_bps_per_year: params.rate_bps_per_year,
            rate_mode: params.rate_mode,
            lockup_seconds: params.lockup_seconds,
            pool_duration_seconds: params.pool_duration_seconds,
            reflections_enabled: params.enable_reflections,
        });
        
        Ok(())
    }

    /// USER: Deposit (stake) tokens
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let platform = &ctx.accounts.platform;
        
        require!(ctx.accounts.project.is_initialized, StakingError::NotInitialized);
        require!(!ctx.accounts.project.is_paused, StakingError::ProjectPaused);
        require!(!ctx.accounts.project.deposit_paused, StakingError::DepositsPaused);
        require!(amount > 0, StakingError::InvalidAmount);
        
        let rent_minimum = 890880u64;
        let sol_fee = platform.platform_sol_fee;
        require!(
            ctx.accounts.user.lamports() >= sol_fee.saturating_add(rent_minimum),
            StakingError::InsufficientSolForFee
        );
        
        let current_time = Clock::get()?.unix_timestamp;
        
        require!(
            current_time < ctx.accounts.project.pool_end_time,
            StakingError::PoolEnded
        );
        
        let token_fee = amount
            .checked_mul(platform.platform_token_fee_bps)
            .ok_or(StakingError::MathOverflow)?
            .checked_div(10000)
            .ok_or(StakingError::MathOverflow)?;
        
        let amount_after_fee = amount
            .checked_sub(token_fee)
            .ok_or(StakingError::MathOverflow)?;
        
        let stake = &mut ctx.accounts.stake;
        let is_initialized = stake.bump != 0;
        
        if !is_initialized {
            stake.user = ctx.accounts.user.key();
            stake.project = ctx.accounts.project.key();
            stake.amount = amount_after_fee;
            stake.last_stake_timestamp = current_time;
            stake.withdrawal_wallet = ctx.accounts.user.key();
            
            stake.reward_per_token_paid = ctx.accounts.project.reward_per_token_stored;
            stake.rewards_pending = 0;
            stake.total_rewards_claimed = 0;
            
            stake.reflection_per_token_paid = ctx.accounts.project.reflection_per_token_stored;
            stake.reflections_pending = 0;
            stake.total_reflections_claimed = 0;
            
            stake.bump = ctx.bumps.stake;
        } else {
            require!(stake.user == ctx.accounts.user.key(), StakingError::Unauthorized);
            require!(stake.project == ctx.accounts.project.key(), StakingError::InvalidProject);
            
            update_reward(&mut ctx.accounts.project, stake)?;
           if let Some(_vault) = &ctx.accounts.reflection_vault {
    if ctx.accounts.project.reflection_vault.is_some() {
        if stake.reflection_per_token_paid < ctx.accounts.project.reflection_per_token_stored {
            let reflection_diff = ctx.accounts.project.reflection_per_token_stored - stake.reflection_per_token_paid;
            let rewards = (stake.amount as u128)
                .checked_mul(reflection_diff as u128)
                .unwrap()
                .checked_div(1_000_000_000_000)
                .unwrap();
            
            stake.reflections_pending = stake.reflections_pending.checked_add(rewards as u64).unwrap();
        }
        
        stake.reflection_per_token_paid = ctx.accounts.project.reflection_per_token_stored;
    }
}
            
            stake.amount = stake.amount
                .checked_add(amount_after_fee)
                .ok_or(StakingError::MathOverflow)?;
            stake.last_stake_timestamp = current_time;
        }
        
        ctx.accounts.project.total_staked = ctx.accounts.project.total_staked
            .checked_add(amount_after_fee)
            .ok_or(StakingError::MathOverflow)?;
        
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_account.to_account_info(),
                    to: ctx.accounts.staking_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount_after_fee,
        )?;
        
        if token_fee > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.user_token_account.to_account_info(),
                        to: ctx.accounts.fee_collector_token_account.to_account_info(),
                        authority: ctx.accounts.user.to_account_info(),
                    },
                ),
                token_fee,
            )?;
        }
        
        if sol_fee > 0 {
            if let Some(referrer_key) = ctx.accounts.project.referrer {
                if let Some(ref referrer_account) = ctx.accounts.referrer {
                    require!(
                        referrer_account.key() == referrer_key,
                        StakingError::InvalidReferrer
                    );
                    
                    let referrer_amount = sol_fee
                        .checked_mul(ctx.accounts.project.referrer_split_bps)
                        .ok_or(StakingError::MathOverflow)?
                        .checked_div(10000)
                        .ok_or(StakingError::MathOverflow)?;
                    
                    let admin_amount = sol_fee
                        .checked_sub(referrer_amount)
                        .ok_or(StakingError::MathOverflow)?;
                    
                    system_program::transfer(
                        CpiContext::new(
                            ctx.accounts.system_program.to_account_info(),
                            system_program::Transfer {
                                from: ctx.accounts.user.to_account_info(),
                                to: ctx.accounts.fee_collector.to_account_info(),
                            },
                        ),
                        admin_amount,
                    )?;
                    
                    if referrer_amount > 0 {
                        system_program::transfer(
                            CpiContext::new(
                                ctx.accounts.system_program.to_account_info(),
                                system_program::Transfer {
                                    from: ctx.accounts.user.to_account_info(),
                                    to: referrer_account.to_account_info(),
                                },
                            ),
                            referrer_amount,
                        )?;
                    }
                } else {
                    system_program::transfer(
                        CpiContext::new(
                            ctx.accounts.system_program.to_account_info(),
                            system_program::Transfer {
                                from: ctx.accounts.user.to_account_info(),
                                to: ctx.accounts.fee_collector.to_account_info(),
                            },
                        ),
                        sol_fee,
                    )?;
                }
            } else {
                system_program::transfer(
                    CpiContext::new(
                        ctx.accounts.system_program.to_account_info(),
                        system_program::Transfer {
                            from: ctx.accounts.user.to_account_info(),
                            to: ctx.accounts.fee_collector.to_account_info(),
                        },
                    ),
                    sol_fee,
                )?;
            }
        }
        
        emit!(TokensDeposited {
            user: ctx.accounts.user.key(),
            project: ctx.accounts.project.key(),
            amount: amount_after_fee,
            token_fee,
            sol_fee,
            new_total: stake.amount,
        });
        
        Ok(())
    }

    /// USER: Withdraw (unstake) tokens
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        require!(ctx.accounts.project.is_initialized, StakingError::NotInitialized);
        require!(!ctx.accounts.project.is_paused, StakingError::ProjectPaused);
        require!(!ctx.accounts.project.withdraw_paused, StakingError::WithdrawalsPaused);
        require!(amount > 0, StakingError::InvalidAmount);
        require!(ctx.accounts.stake.amount >= amount, StakingError::InsufficientBalance);
        
        require!(
            ctx.accounts.staking_vault.amount >= amount,
            StakingError::InsufficientVaultBalance
        );
        
        update_reward(&mut ctx.accounts.project, &mut ctx.accounts.stake)?;
        
if let Some(vault) = &ctx.accounts.reflection_vault {
    require!(
        Some(vault.key()) == ctx.accounts.project.reflection_vault,
        StakingError::InvalidReflectionVault
    );
    
    if ctx.accounts.stake.reflection_per_token_paid < ctx.accounts.project.reflection_per_token_stored {
        let reflection_diff = ctx.accounts.project.reflection_per_token_stored - ctx.accounts.stake.reflection_per_token_paid;
        let rewards = (ctx.accounts.stake.amount as u128)
            .checked_mul(reflection_diff as u128)
            .unwrap()
            .checked_div(1_000_000_000_000)
            .unwrap();
        
        ctx.accounts.stake.reflections_pending = ctx.accounts.stake.reflections_pending.checked_add(rewards as u64).unwrap();
    }
    
    ctx.accounts.stake.reflection_per_token_paid = ctx.accounts.project.reflection_per_token_stored;
}
        
let current_time = Clock::get()?.unix_timestamp;
        let time_since_stake = current_time
            .checked_sub(ctx.accounts.stake.last_stake_timestamp)
            .ok_or(StakingError::MathOverflow)?;
        
        if ctx.accounts.project.lockup_seconds > 0 && time_since_stake < ctx.accounts.project.lockup_seconds as i64 {
            return Err(StakingError::LockupNotExpired.into());
        }
        
        require!(
            ctx.accounts.project.total_staked >= amount,
            StakingError::InconsistentTotalStaked
        );
        
        ctx.accounts.stake.amount = ctx.accounts.stake.amount
            .checked_sub(amount)
            .ok_or(StakingError::MathOverflow)?;
        
        ctx.accounts.project.total_staked = ctx.accounts.project.total_staked
            .checked_sub(amount)
            .ok_or(StakingError::MathOverflow)?;
        
        let seeds = &[
            b"project",
            ctx.accounts.project.token_mint.as_ref(),
            &[ctx.accounts.project.bump],
        ];
        let signer = &[&seeds[..]];
        
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.staking_vault.to_account_info(),
                    to: ctx.accounts.withdrawal_token_account.to_account_info(),
                    authority: ctx.accounts.project.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;
        
        emit!(TokensWithdrawn {
            user: ctx.accounts.user.key(),
            project: ctx.accounts.project.key(),
            amount,
            remaining: ctx.accounts.stake.amount,
        });
        
        Ok(())
    }

    /// USER: Claim rewards
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        require!(ctx.accounts.project.is_initialized, StakingError::NotInitialized);
        require!(!ctx.accounts.project.is_paused, StakingError::ProjectPaused);
        require!(!ctx.accounts.project.claim_paused, StakingError::ClaimsPaused);
        require!(ctx.accounts.stake.amount > 0, StakingError::NoStakeFound);
        
        update_reward(&mut ctx.accounts.project, &mut ctx.accounts.stake)?;
        
        let rewards = ctx.accounts.stake.rewards_pending;
        require!(rewards > 0, StakingError::NoRewardsAvailable);
        
        require!(
            ctx.accounts.reward_vault.amount >= rewards,
            StakingError::InsufficientRewardVault
        );
        
        ctx.accounts.stake.rewards_pending = 0;
        ctx.accounts.stake.total_rewards_claimed = ctx.accounts.stake.total_rewards_claimed
            .checked_add(rewards)
            .ok_or(StakingError::MathOverflow)?;
        
        ctx.accounts.project.total_rewards_claimed = ctx.accounts.project.total_rewards_claimed
            .checked_add(rewards)
            .ok_or(StakingError::MathOverflow)?;
        
        let seeds = &[
            b"project",
            ctx.accounts.project.token_mint.as_ref(),
            &[ctx.accounts.project.bump],
        ];
        let signer = &[&seeds[..]];
        
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.reward_vault.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.project.to_account_info(),
                },
                signer,
            ),
            rewards,
        )?;
        
        emit!(RewardsClaimed {
            user: ctx.accounts.user.key(),
            project: ctx.accounts.project.key(),
            amount: rewards,
        });
        
        Ok(())
    }

    /// USER: Claim reflection rewards
    pub fn claim_reflections(ctx: Context<ClaimReflections>) -> Result<()> {
        require!(ctx.accounts.project.is_initialized, StakingError::NotInitialized);
        require!(!ctx.accounts.project.is_paused, StakingError::ProjectPaused);
        require!(ctx.accounts.project.reflection_vault.is_some(), StakingError::ReflectionsNotEnabled);
        require!(ctx.accounts.stake.amount > 0, StakingError::NoStakeFound);
        
        require!(
            Some(ctx.accounts.reflection_vault.key()) == ctx.accounts.project.reflection_vault,
            StakingError::InvalidReflectionVault
        );
        
        let vault_info = &ctx.accounts.reflection_vault.to_account_info();

if ctx.accounts.stake.reflection_per_token_paid < ctx.accounts.project.reflection_per_token_stored {
    let reflection_diff = ctx.accounts.project.reflection_per_token_stored - ctx.accounts.stake.reflection_per_token_paid;
    let rewards = (ctx.accounts.stake.amount as u128)
        .checked_mul(reflection_diff as u128)
        .unwrap()
        .checked_div(1_000_000_000_000)
        .unwrap();
    
    ctx.accounts.stake.reflections_pending = ctx.accounts.stake.reflections_pending.checked_add(rewards as u64).unwrap();
}

ctx.accounts.stake.reflection_per_token_paid = ctx.accounts.project.reflection_per_token_stored;
        
        let reflections = ctx.accounts.stake.reflections_pending;
        require!(reflections > 0, StakingError::NoReflectionsAvailable);
        
        require!(
            ctx.accounts.reflection_vault.amount >= reflections,
            StakingError::InsufficientReflectionVault
        );
        
        ctx.accounts.stake.reflections_pending = 0;
        ctx.accounts.stake.total_reflections_claimed = ctx.accounts.stake.total_reflections_claimed
            .checked_add(reflections)
            .ok_or(StakingError::MathOverflow)?;
        
        let seeds = &[
            b"project",
            ctx.accounts.project.token_mint.as_ref(),
            &[ctx.accounts.project.bump],
        ];
        let signer = &[&seeds[..]];
        
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.reflection_vault.to_account_info(),
                    to: ctx.accounts.user_reflection_account.to_account_info(),
                    authority: ctx.accounts.project.to_account_info(),
                },
                signer,
            ),
            reflections,
        )?;
        
        emit!(ReflectionsClaimed {
            user: ctx.accounts.user.key(),
            project: ctx.accounts.project.key(),
            amount: reflections,
        });
        
        Ok(())
    }

    /// ADMIN: Deposit rewards to reward vault
    /// ✅ FIXED: Now calculates reward_rate_per_second for BOTH rate modes
    pub fn deposit_rewards(ctx: Context<DepositRewards>, amount: u64) -> Result<()> {
        require!(amount > 0, StakingError::InvalidAmount);
        
        require!(ctx.accounts.project.is_initialized, StakingError::NotInitialized);
        require!(!ctx.accounts.project.is_paused, StakingError::ProjectPaused);
        
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.admin_token_account.to_account_info(),
                    to: ctx.accounts.reward_vault.to_account_info(),
                    authority: ctx.accounts.admin.to_account_info(),
                },
            ),
            amount,
        )?;
        
        ctx.accounts.project.total_rewards_deposited = ctx.accounts.project.total_rewards_deposited
            .checked_add(amount)
            .ok_or(StakingError::MathOverflow)?;
        
        // ✅ FIXED: Calculate reward rate for BOTH fixed (mode 0) and variable (mode 1) pools
        let total_available = ctx.accounts.project.total_rewards_deposited
            .checked_sub(ctx.accounts.project.total_rewards_claimed)
            .ok_or(StakingError::MathOverflow)?;
        
        let current_time = Clock::get()?.unix_timestamp;
        let time_remaining = ctx.accounts.project.pool_end_time
            .checked_sub(current_time)
            .unwrap_or(0);
        
        if time_remaining > 0 {
            ctx.accounts.project.reward_rate_per_second = total_available
                .checked_div(time_remaining as u64)
                .unwrap_or(0);
        }
        
        emit!(RewardsDeposited {
            project: ctx.accounts.project.key(),
            amount,
            total_rewards: ctx.accounts.project.total_rewards_deposited,
            reward_rate: ctx.accounts.project.reward_rate_per_second,
        });
        
        Ok(())
    }

    /// ADMIN: Emergency return stake to individual user
    pub fn emergency_return_stake(
        ctx: Context<EmergencyReturnStake>,
        user_pubkey: Pubkey,
    ) -> Result<()> {
        let stake = &ctx.accounts.stake;
        
        require!(stake.user == user_pubkey, StakingError::InvalidStakeAccount);
        require!(stake.amount > 0, StakingError::NoStakeFound);
        
        require!(
            ctx.accounts.staking_vault.amount >= stake.amount,
            StakingError::InsufficientVaultBalance
        );
        
        update_reward(&mut ctx.accounts.project, &mut ctx.accounts.stake)?;
        
        let amount = ctx.accounts.stake.amount;
        
        ctx.accounts.stake.amount = 0;
        
        ctx.accounts.project.total_staked = ctx.accounts.project.total_staked
            .checked_sub(amount)
            .ok_or(StakingError::MathOverflow)?;
        
        let seeds = &[
            b"project",
            ctx.accounts.project.token_mint.as_ref(),
            &[ctx.accounts.project.bump],
        ];
        let signer = &[&seeds[..]];
        
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.staking_vault.to_account_info(),
                    to: ctx.accounts.user_withdrawal_account.to_account_info(),
                    authority: ctx.accounts.project.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;
        
        emit!(EmergencyStakeReturned {
            project: ctx.accounts.project.key(),
            user: user_pubkey,
            amount,
        });
        
        Ok(())
    }

    /// ADMIN: Transfer admin ownership
    pub fn transfer_admin(ctx: Context<TransferAdmin>, new_admin: Pubkey) -> Result<()> {
        let old_admin = ctx.accounts.project.admin;
        
        ctx.accounts.project.admin = new_admin;
        
        emit!(AdminTransferred {
            project: ctx.accounts.project.key(),
            old_admin,
            new_admin,
        });
        
        Ok(())
    }

    /// ADMIN: Set/change project parameters
    pub fn set_project_params(
        ctx: Context<SetProjectParams>,
        rate_bps_per_year: u64,
        lockup_seconds: u64,
    ) -> Result<()> {
        ctx.accounts.project.rate_bps_per_year = rate_bps_per_year;
        ctx.accounts.project.lockup_seconds = lockup_seconds;
        
        emit!(ProjectParamsUpdated {
            project: ctx.accounts.project.key(),
            rate_bps_per_year,
            lockup_seconds,
        });
        
        Ok(())
    }

    /// ADMIN: Set pool duration
    /// ✅ FIXED: Now calculates reward_rate_per_second for BOTH rate modes
    pub fn set_pool_duration(
        ctx: Context<SetPoolDuration>,
        duration_seconds: u64,
    ) -> Result<()> {
        require!(duration_seconds > 0, StakingError::InvalidAmount);
        
        let current_time = Clock::get()?.unix_timestamp;
        
        ctx.accounts.project.pool_duration_seconds = duration_seconds;
        ctx.accounts.project.pool_end_time = ctx.accounts.project.pool_start_time
            .checked_add(duration_seconds as i64)
            .ok_or(StakingError::MathOverflow)?;
        
        // ✅ FIXED: Calculate reward rate for BOTH fixed (mode 0) and variable (mode 1) pools
        let total_available = ctx.accounts.project.total_rewards_deposited
            .checked_sub(ctx.accounts.project.total_rewards_claimed)
            .ok_or(StakingError::MathOverflow)?;
        
        let time_remaining = ctx.accounts.project.pool_end_time
            .checked_sub(current_time)
            .unwrap_or(0);
        
        if time_remaining > 0 {
            ctx.accounts.project.reward_rate_per_second = total_available
                .checked_div(time_remaining as u64)
                .unwrap_or(0);
        }
        
        emit!(PoolDurationUpdated {
            project: ctx.accounts.project.key(),
            duration_seconds,
        });
        
        Ok(())
    }

    /// ADMIN: Set referrer
    pub fn set_project_referrer(
        ctx: Context<SetProjectReferrer>,
        referrer: Option<Pubkey>,
        split_bps: u64,
    ) -> Result<()> {
        require!(split_bps <= 10000, StakingError::InvalidSplitPercentage);
        
        ctx.accounts.project.referrer = referrer;
        ctx.accounts.project.referrer_split_bps = split_bps;
        
        emit!(ReferrerUpdated {
            project: ctx.accounts.project.key(),
            referrer,
            split_bps,
        });
        
        Ok(())
    }

    /// ADMIN: Enable/disable reflections
    pub fn set_reflections(
        ctx: Context<SetReflections>,
        enabled: bool,
        reflection_token: Option<Pubkey>,
    ) -> Result<()> {
        if enabled {
            require!(
                ctx.accounts.reflection_vault.is_some(),
                StakingError::ReflectionVaultRequired
            );
            require!(
                reflection_token.is_some(),
                StakingError::ReflectionTokenRequired
            );
            
            ctx.accounts.project.reflection_token = reflection_token;
            ctx.accounts.project.reflection_vault = ctx.accounts.reflection_vault
                .as_ref()
                .map(|v| v.key());
            
            emit!(ReflectionsEnabled {
                project: ctx.accounts.project.key(),
                reflection_token: reflection_token.unwrap(),
                reflection_vault: ctx.accounts.project.reflection_vault.unwrap(),
            });
        } else {
            ctx.accounts.project.reflection_token = None;
            ctx.accounts.project.reflection_vault = None;
            
            emit!(ReflectionsDisabled {
                project: ctx.accounts.project.key(),
            });
        }
        
        Ok(())
    }

    /// ADMIN: Update platform fees
    pub fn set_fees(
        ctx: Context<SetFees>,
        platform_token_fee_bps: u64,
        platform_sol_fee: u64,
    ) -> Result<()> {
        ctx.accounts.platform.platform_token_fee_bps = platform_token_fee_bps;
        ctx.accounts.platform.platform_sol_fee = platform_sol_fee;
        
        emit!(FeesUpdated {
            platform_token_fee_bps,
            platform_sol_fee,
        });
        
        Ok(())
    }

    /// ADMIN: Pause/unpause functions
    pub fn pause_deposits(ctx: Context<PauseControl>) -> Result<()> {
        ctx.accounts.project.deposit_paused = true;
        emit!(DepositsPaused { project: ctx.accounts.project.key() });
        Ok(())
    }

    pub fn unpause_deposits(ctx: Context<PauseControl>) -> Result<()> {
        ctx.accounts.project.deposit_paused = false;
        emit!(DepositsUnpaused { project: ctx.accounts.project.key() });
        Ok(())
    }

    pub fn pause_withdrawals(ctx: Context<PauseControl>) -> Result<()> {
        ctx.accounts.project.withdraw_paused = true;
        emit!(WithdrawalsPaused { project: ctx.accounts.project.key() });
        Ok(())
    }

    pub fn unpause_withdrawals(ctx: Context<PauseControl>) -> Result<()> {
        ctx.accounts.project.withdraw_paused = false;
        emit!(WithdrawalsUnpaused { project: ctx.accounts.project.key() });
        Ok(())
    }

    pub fn pause_claims(ctx: Context<PauseControl>) -> Result<()> {
        ctx.accounts.project.claim_paused = true;
        emit!(ClaimsPaused { project: ctx.accounts.project.key() });
        Ok(())
    }

    pub fn unpause_claims(ctx: Context<PauseControl>) -> Result<()> {
        ctx.accounts.project.claim_paused = false;
        emit!(ClaimsUnpaused { project: ctx.accounts.project.key() });
        Ok(())
    }

    pub fn pause_project(ctx: Context<PauseControl>) -> Result<()> {
        ctx.accounts.project.is_paused = true;
        emit!(ProjectPaused { project: ctx.accounts.project.key() });
        Ok(())
    }

    pub fn unpause_project(ctx: Context<PauseControl>) -> Result<()> {
        ctx.accounts.project.is_paused = false;
        emit!(ProjectUnpaused { project: ctx.accounts.project.key() });
        Ok(())
    }

    pub fn emergency_unlock(ctx: Context<EmergencyUnlock>) -> Result<()> {
        ctx.accounts.project.lockup_seconds = 0;
        emit!(EmergencyUnlockEvent {
            admin: ctx.accounts.admin.key(),
            project: ctx.accounts.project.key()
        });
        Ok(())
    }

    pub fn change_withdrawal_wallet(
        ctx: Context<ChangeWithdrawalWallet>,
        new_wallet: Pubkey,
    ) -> Result<()> {
        ctx.accounts.stake.withdrawal_wallet = new_wallet;
        
        emit!(WithdrawalWalletChanged {
            user: ctx.accounts.stake.user,
            project: ctx.accounts.stake.project,
            new_wallet,
        });
        
        Ok(())
    }

    pub fn claim_unclaimed_tokens(ctx: Context<ClaimUnclaimedTokens>, amount: u64) -> Result<()> {
        require!(
            ctx.accounts.vault.amount >= amount,
            StakingError::InsufficientVaultBalance
        );
        
        let seeds = &[
            b"project",
            ctx.accounts.project.token_mint.as_ref(),
            &[ctx.accounts.project.bump],
        ];
        let signer = &[&seeds[..]];
        
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.admin_token_account.to_account_info(),
                    authority: ctx.accounts.project.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;
        
        Ok(())
    }
}

fn update_reward(project: &mut Account<Project>, stake: &mut Account<Stake>) -> Result<()> {
    let current_time = Clock::get()?.unix_timestamp;
    
    if project.total_staked > 0 && current_time > project.last_update_time {
        let time_delta_i64 = current_time
            .checked_sub(project.last_update_time)
            .ok_or(StakingError::MathOverflow)?;
        
        require!(time_delta_i64 >= 0, StakingError::InvalidTimestamp);
        let time_delta = time_delta_i64 as u64;
        
        let effective_time = if current_time > project.pool_end_time {
            let time_until_end = project.pool_end_time
                .checked_sub(project.last_update_time)
                .unwrap_or(0)
                .max(0);
            
            require!(time_until_end >= 0, StakingError::InvalidTimestamp);
            time_until_end as u64
        } else {
            time_delta
        };
        
        if effective_time > 0 {
            let intermediate = (project.reward_rate_per_second as u128)
                .checked_mul(effective_time as u128)
                .ok_or(StakingError::MathOverflow)?;
            
            let scaled = intermediate
                .checked_mul(1_000_000_000)
                .ok_or(StakingError::MathOverflow)?;
            
            let result_u128 = scaled
                .checked_div(project.total_staked as u128)
                .ok_or(StakingError::DivisionByZero)?;
            
            require!(result_u128 <= u64::MAX as u128, StakingError::MathOverflow);
            let rewards_per_token = result_u128 as u64;
            
            project.reward_per_token_stored = project.reward_per_token_stored
                .checked_add(rewards_per_token)
                .ok_or(StakingError::MathOverflow)?;
        }
    }
    
    project.last_update_time = current_time;
    
    if stake.amount > 0 {
        let reward_delta = project.reward_per_token_stored
            .checked_sub(stake.reward_per_token_paid)
            .unwrap_or(0);
        
        let earned_u128 = (stake.amount as u128)
            .checked_mul(reward_delta as u128)
            .ok_or(StakingError::MathOverflow)?
            .checked_div(1_000_000_000)
            .ok_or(StakingError::DivisionByZero)?;
        
        require!(earned_u128 <= u64::MAX as u128, StakingError::MathOverflow);
        let earned = earned_u128 as u64;
        
        stake.rewards_pending = stake.rewards_pending
            .checked_add(earned)
            .ok_or(StakingError::MathOverflow)?;
    }
    
    stake.reward_per_token_paid = project.reward_per_token_stored;
    
    Ok(())
}

fn update_reflection<'info>(
    project: &mut Account<'info, Project>,
    stake: &mut Account<'info, Stake>,
    reflection_vault: &'info AccountInfo<'info>,
) -> Result<()> {
    if project.reflection_vault.is_none() {
        return Ok(());
    }
    
    let current_time = Clock::get()?.unix_timestamp;
    let vault = Account::<TokenAccount>::try_from(reflection_vault)?;
    
    if project.total_staked > 0 && current_time > project.last_reflection_update_time {
        let current_balance = vault.amount;
        
        if current_balance > 0 {
            let result_u128 = (current_balance as u128)
                .checked_mul(1_000_000_000)
                .ok_or(StakingError::MathOverflow)?
                .checked_div(project.total_staked as u128)
                .ok_or(StakingError::DivisionByZero)?;
            
            require!(result_u128 <= u64::MAX as u128, StakingError::MathOverflow);
            let reflections_per_token = result_u128 as u64;
            
            if reflections_per_token > project.reflection_per_token_stored {
                project.reflection_per_token_stored = reflections_per_token;
            }
        }
    }
    
    project.last_reflection_update_time = current_time;
    
    if stake.amount > 0 {
        let reflection_delta = project.reflection_per_token_stored
            .checked_sub(stake.reflection_per_token_paid)
            .unwrap_or(0);
        
        let earned_u128 = (stake.amount as u128)
            .checked_mul(reflection_delta as u128)
            .ok_or(StakingError::MathOverflow)?
            .checked_div(1_000_000_000)
            .ok_or(StakingError::DivisionByZero)?;
        
        require!(earned_u128 <= u64::MAX as u128, StakingError::MathOverflow);
        let earned = earned_u128 as u64;
        
        stake.reflections_pending = stake.reflections_pending
            .checked_add(earned)
            .ok_or(StakingError::MathOverflow)?;
    }
    
    stake.reflection_per_token_paid = project.reflection_per_token_stored;
    
    Ok(())
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + Platform::INIT_SPACE,
        seeds = [b"platform"],
        bump
    )]
    pub platform: Account<'info, Platform>,
    
    /// CHECK: Fee collector wallet
    pub fee_collector: AccountInfo<'info>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(token_mint: Pubkey)]
pub struct CreateProject<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + Project::INIT_SPACE,
        seeds = [b"project", token_mint.as_ref()],
        bump
    )]
    pub project: Account<'info, Project>,
    
    #[account(
        init,
        payer = admin,
        seeds = [b"staking_vault", token_mint.as_ref()],
        bump,
        token::mint = token_mint_account,
        token::authority = project,
    )]
    pub staking_vault: Account<'info, TokenAccount>,
    
    #[account(
        init,
        payer = admin,
        seeds = [b"reward_vault", token_mint.as_ref()],
        bump,
        token::mint = token_mint_account,
        token::authority = project,
    )]
    pub reward_vault: Account<'info, TokenAccount>,
    
    pub token_mint_account: Account<'info, Mint>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(
        mut,
        seeds = [b"project", project.token_mint.as_ref()],
        bump = project.bump,
        constraint = !project.is_initialized @ StakingError::AlreadyInitialized,
        constraint = project.admin == admin.key() @ StakingError::Unauthorized,
    )]
    pub project: Account<'info, Project>,
    
    /// CHECK: Optional reflection vault - validated in instruction logic
    pub reflection_vault: Option<AccountInfo<'info>>,
    
    /// CHECK: Optional reflection token mint - validated in instruction logic
    pub reflection_token_mint: Option<AccountInfo<'info>>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        seeds = [b"platform"],
        bump = platform.bump,
    )]
    pub platform: Account<'info, Platform>,
    
    #[account(
        mut,
        seeds = [b"project", project.token_mint.as_ref()],
        bump = project.bump,
    )]
    pub project: Account<'info, Project>,
    
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + Stake::INIT_SPACE,
        seeds = [b"stake", project.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub stake: Account<'info, Stake>,
    
    #[account(
        mut,
        seeds = [b"staking_vault", project.token_mint.as_ref()],
        bump,
    )]
    pub staking_vault: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = user_token_account.owner == user.key() @ StakingError::Unauthorized,
        constraint = user_token_account.mint == project.token_mint @ StakingError::WrongTokenMint,
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = fee_collector_token_account.mint == project.token_mint @ StakingError::WrongTokenMint,
    )]
    pub fee_collector_token_account: Account<'info, TokenAccount>,
    
    /// CHECK: Fee collector
    #[account(
        mut,
        constraint = fee_collector.key() == platform.fee_collector @ StakingError::InvalidFeeCollector
    )]
    pub fee_collector: AccountInfo<'info>,
    
    /// CHECK: Optional referrer
    #[account(mut)]
    pub referrer: Option<AccountInfo<'info>>,
    
    /// CHECK: Optional reflection vault for update - validated in instruction logic
    pub reflection_vault: Option<AccountInfo<'info>>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"project", project.token_mint.as_ref()],
        bump = project.bump,
    )]
    pub project: Account<'info, Project>,
    
    #[account(
        mut,
        seeds = [b"stake", project.key().as_ref(), user.key().as_ref()],
        bump = stake.bump,
        constraint = stake.user == user.key() @ StakingError::Unauthorized,
    )]
    pub stake: Account<'info, Stake>,
    
    #[account(
        mut,
        seeds = [b"staking_vault", project.token_mint.as_ref()],
        bump,
    )]
    pub staking_vault: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = withdrawal_token_account.owner == stake.withdrawal_wallet @ StakingError::InvalidWithdrawalWallet,
        constraint = withdrawal_token_account.mint == project.token_mint @ StakingError::WrongTokenMint,
    )]
    pub withdrawal_token_account: Account<'info, TokenAccount>,
    
    /// CHECK: Optional reflection vault for update - validated in instruction logic
    pub reflection_vault: Option<AccountInfo<'info>>,
    
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(
        mut,
        seeds = [b"project", project.token_mint.as_ref()],
        bump = project.bump,
    )]
    pub project: Account<'info, Project>,
    
    #[account(
        mut,
        seeds = [b"stake", project.key().as_ref(), user.key().as_ref()],
        bump = stake.bump,
        constraint = stake.user == user.key() @ StakingError::Unauthorized,
    )]
    pub stake: Account<'info, Stake>,
    
    #[account(
        mut,
        seeds = [b"reward_vault", project.token_mint.as_ref()],
        bump,
    )]
    pub reward_vault: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = user_token_account.owner == user.key() @ StakingError::Unauthorized,
        constraint = user_token_account.mint == project.token_mint @ StakingError::WrongTokenMint,
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimReflections<'info> {
    #[account(
        mut,
        seeds = [b"project", project.token_mint.as_ref()],
        bump = project.bump,
    )]
    pub project: Account<'info, Project>,
    
    #[account(
        mut,
        seeds = [b"stake", project.key().as_ref(), user.key().as_ref()],
        bump = stake.bump,
        constraint = stake.user == user.key() @ StakingError::Unauthorized,
    )]
    pub stake: Account<'info, Stake>,
    
    #[account(mut)]
    pub reflection_vault: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = user_reflection_account.owner == user.key() @ StakingError::Unauthorized,
    )]
    pub user_reflection_account: Account<'info, TokenAccount>,
    
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct DepositRewards<'info> {
    #[account(
        mut,
        seeds = [b"project", project.token_mint.as_ref()],
        bump = project.bump,
        constraint = project.admin == admin.key() @ StakingError::Unauthorized,
    )]
    pub project: Account<'info, Project>,
    
    #[account(
        mut,
        seeds = [b"reward_vault", project.token_mint.as_ref()],
        bump,
        constraint = reward_vault.mint == project.token_mint @ StakingError::WrongTokenMint,
    )]
    pub reward_vault: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = admin_token_account.mint == project.token_mint @ StakingError::WrongTokenMint,
    )]
    pub admin_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(user_pubkey: Pubkey)]
pub struct EmergencyReturnStake<'info> {
    #[account(
        mut,
        seeds = [b"project", project.token_mint.as_ref()],
        bump = project.bump,
        constraint = project.admin == admin.key() @ StakingError::Unauthorized,
    )]
    pub project: Account<'info, Project>,
    
    #[account(
        mut,
        seeds = [b"stake", project.key().as_ref(), user_pubkey.as_ref()],
        bump = stake.bump,
    )]
    pub stake: Account<'info, Stake>,
    
    #[account(
        mut,
        seeds = [b"staking_vault", project.token_mint.as_ref()],
        bump,
    )]
    pub staking_vault: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = user_withdrawal_account.owner == stake.withdrawal_wallet @ StakingError::InvalidWithdrawalWallet,
        constraint = user_withdrawal_account.mint == project.token_mint @ StakingError::WrongTokenMint,
    )]
    pub user_withdrawal_account: Account<'info, TokenAccount>,
    
    pub admin: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct TransferAdmin<'info> {
    #[account(
        mut,
        seeds = [b"project", project.token_mint.as_ref()],
        bump = project.bump,
        constraint = project.admin == admin.key() @ StakingError::Unauthorized,
    )]
    pub project: Account<'info, Project>,
    
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetProjectParams<'info> {
    #[account(
        mut,
        seeds = [b"project", project.token_mint.as_ref()],
        bump = project.bump,
        constraint = project.admin == admin.key() @ StakingError::Unauthorized,
    )]
    pub project: Account<'info, Project>,
    
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetPoolDuration<'info> {
    #[account(
        mut,
        seeds = [b"project", project.token_mint.as_ref()],
        bump = project.bump,
        constraint = project.admin == admin.key() @ StakingError::Unauthorized,
    )]
    pub project: Account<'info, Project>,
    
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetProjectReferrer<'info> {
    #[account(
        mut,
        seeds = [b"project", project.token_mint.as_ref()],
        bump = project.bump,
        constraint = project.admin == admin.key() @ StakingError::Unauthorized,
    )]
    pub project: Account<'info, Project>,
    
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetReflections<'info> {
    #[account(
        mut,
        seeds = [b"project", project.token_mint.as_ref()],
        bump = project.bump,
        constraint = project.admin == admin.key() @ StakingError::Unauthorized,
    )]
    pub project: Account<'info, Project>,
    
    /// CHECK: Optional reflection vault - validated in instruction logic
    pub reflection_vault: Option<AccountInfo<'info>>,
    
    /// CHECK: Optional reflection token mint - validated in instruction logic
    pub reflection_token_mint: Option<AccountInfo<'info>>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct SetFees<'info> {
    #[account(
        mut,
        seeds = [b"platform"],
        bump = platform.bump,
        constraint = platform.admin == admin.key() @ StakingError::Unauthorized,
    )]
    pub platform: Account<'info, Platform>,
    
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct PauseControl<'info> {
    #[account(
        mut,
        seeds = [b"project", project.token_mint.as_ref()],
        bump = project.bump,
        constraint = project.admin == admin.key() @ StakingError::Unauthorized,
    )]
    pub project: Account<'info, Project>,
    
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct EmergencyUnlock<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"project", project.token_mint.as_ref()],
        bump = project.bump,
        has_one = admin @ StakingError::Unauthorized,
    )]
    pub project: Account<'info, Project>,
}

#[derive(Accounts)]
pub struct ChangeWithdrawalWallet<'info> {
    #[account(
        seeds = [b"project", project.token_mint.as_ref()],
        bump = project.bump,
        constraint = project.admin == admin.key() @ StakingError::Unauthorized,
    )]
    pub project: Account<'info, Project>,
    
    #[account(
        mut,
        seeds = [b"stake", project.key().as_ref(), stake.user.as_ref()],
        bump = stake.bump,
    )]
    pub stake: Account<'info, Stake>,
    
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimUnclaimedTokens<'info> {
    #[account(
        seeds = [b"project", project.token_mint.as_ref()],
        bump = project.bump,
        constraint = project.admin == admin.key() @ StakingError::Unauthorized,
    )]
    pub project: Account<'info, Project>,
    
    #[account(
        mut,
        constraint = vault.owner == project.key() @ StakingError::UnauthorizedVault,
    )]
    pub vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub admin_token_account: Account<'info, TokenAccount>,
    
    pub admin: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[account]
#[derive(InitSpace)]
pub struct Platform {
    pub admin: Pubkey,
    pub fee_collector: Pubkey,
    pub platform_token_fee_bps: u64,
    pub platform_sol_fee: u64,
    pub is_initialized: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Project {
    pub admin: Pubkey,
    pub token_mint: Pubkey,
    pub staking_vault: Pubkey,
    pub reward_vault: Pubkey,
    #[max_len(1)]
    pub reflection_vault: Option<Pubkey>,
    #[max_len(1)]
    pub reflection_token: Option<Pubkey>,
    pub total_staked: u64,
    pub total_rewards_deposited: u64,
    pub total_rewards_claimed: u64,
    pub rate_bps_per_year: u64,
    pub rate_mode: u8,
    pub reward_rate_per_second: u64,
    pub lockup_seconds: u64,
    pub pool_duration_seconds: u64,
    pub pool_start_time: i64,
    pub pool_end_time: i64,
    pub last_update_time: i64,
    pub reward_per_token_stored: u64,
    pub reflection_per_token_stored: u64,
    pub last_reflection_update_time: i64,
    #[max_len(1)]
    pub referrer: Option<Pubkey>,
    pub referrer_split_bps: u64,
    pub is_paused: bool,
    pub deposit_paused: bool,
    pub withdraw_paused: bool,
    pub claim_paused: bool,
    pub is_initialized: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Stake {
    pub user: Pubkey,
    pub project: Pubkey,
    pub amount: u64,
    pub last_stake_timestamp: i64,
    pub withdrawal_wallet: Pubkey,
    pub reward_per_token_paid: u64,
    pub rewards_pending: u64,
    pub total_rewards_claimed: u64,
    pub reflection_per_token_paid: u64,
    pub reflections_pending: u64,
    pub total_reflections_claimed: u64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializePoolParams {
    pub rate_bps_per_year: u64,
    pub rate_mode: u8,
    pub lockup_seconds: u64,
    pub pool_duration_seconds: u64,
    pub referrer: Option<Pubkey>,
    pub referrer_split_bps: Option<u64>,
    pub enable_reflections: bool,
    pub reflection_token: Option<Pubkey>,
}

#[event]
pub struct PlatformInitialized {
    pub admin: Pubkey,
    pub fee_collector: Pubkey,
    pub platform_token_fee_bps: u64,
    pub platform_sol_fee: u64,
}

#[event]
pub struct ProjectCreated {
    pub project: Pubkey,
    pub token_mint: Pubkey,
    pub staking_vault: Pubkey,
    pub reward_vault: Pubkey,
    pub admin: Pubkey,
}

#[event]
pub struct PoolInitialized {
    pub project: Pubkey,
    pub staking_vault: Pubkey,
    pub reward_vault: Pubkey,
    pub reflection_vault: Option<Pubkey>,
    pub rate_bps_per_year: u64,
    pub rate_mode: u8,
    pub lockup_seconds: u64,
    pub pool_duration_seconds: u64,
    pub reflections_enabled: bool,
}

#[event]
pub struct TokensDeposited {
    pub user: Pubkey,
    pub project: Pubkey,
    pub amount: u64,
    pub token_fee: u64,
    pub sol_fee: u64,
    pub new_total: u64,
}

#[event]
pub struct TokensWithdrawn {
    pub user: Pubkey,
    pub project: Pubkey,
    pub amount: u64,
    pub remaining: u64,
}

#[event]
pub struct RewardsClaimed {
    pub user: Pubkey,
    pub project: Pubkey,
    pub amount: u64,
}

#[event]
pub struct ReflectionsClaimed {
    pub user: Pubkey,
    pub project: Pubkey,
    pub amount: u64,
}

#[event]
pub struct RewardsDeposited {
    pub project: Pubkey,
    pub amount: u64,
    pub total_rewards: u64,
    pub reward_rate: u64,
}

#[event]
pub struct EmergencyStakeReturned {
    pub project: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
}

#[event]
pub struct AdminTransferred {
    pub project: Pubkey,
    pub old_admin: Pubkey,
    pub new_admin: Pubkey,
}

#[event]
pub struct ProjectParamsUpdated {
    pub project: Pubkey,
    pub rate_bps_per_year: u64,
    pub lockup_seconds: u64,
}

#[event]
pub struct PoolDurationUpdated {
    pub project: Pubkey,
    pub duration_seconds: u64,
}

#[event]
pub struct ReferrerUpdated {
    pub project: Pubkey,
    pub referrer: Option<Pubkey>,
    pub split_bps: u64,
}

#[event]
pub struct ReflectionsEnabled {
    pub project: Pubkey,
    pub reflection_token: Pubkey,
    pub reflection_vault: Pubkey,
}

#[event]
pub struct ReflectionsDisabled {
    pub project: Pubkey,
}

#[event]
pub struct FeesUpdated {
    pub platform_token_fee_bps: u64,
    pub platform_sol_fee: u64,
}

#[event]
pub struct DepositsPaused {
    pub project: Pubkey,
}

#[event]
pub struct DepositsUnpaused {
    pub project: Pubkey,
}

#[event]
pub struct WithdrawalsPaused {
    pub project: Pubkey,
}

#[event]
pub struct WithdrawalsUnpaused {
    pub project: Pubkey,
}

#[event]
pub struct ClaimsPaused {
    pub project: Pubkey,
}

#[event]
pub struct ClaimsUnpaused {
    pub project: Pubkey,
}

#[event]
pub struct ProjectPaused {
    pub project: Pubkey,
}

#[event]
pub struct ProjectUnpaused {
    pub project: Pubkey,
}

#[event]
pub struct EmergencyUnlockEvent {
    pub admin: Pubkey,
    pub project: Pubkey,
}

#[event]
pub struct WithdrawalWalletChanged {
    pub user: Pubkey,
    pub project: Pubkey,
    pub new_wallet: Pubkey,
}

#[error_code]
pub enum StakingError {
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Project is paused")]
    ProjectPaused,
    #[msg("Deposits are paused")]
    DepositsPaused,
    #[msg("Withdrawals are paused")]
    WithdrawalsPaused,
    #[msg("Claims are paused")]
    ClaimsPaused,
    #[msg("Lockup period not expired")]
    LockupNotExpired,
    #[msg("No stake found")]
    NoStakeFound,
    #[msg("No rewards available")]
    NoRewardsAvailable,
    #[msg("No reflections available")]
    NoReflectionsAvailable,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Already initialized")]
    AlreadyInitialized,
    #[msg("Not initialized")]
    NotInitialized,
    #[msg("Invalid split percentage")]
    InvalidSplitPercentage,
    #[msg("Reflection vault required")]
    ReflectionVaultRequired,
    #[msg("Reflection token required")]
    ReflectionTokenRequired,
    #[msg("Reflections not enabled")]
    ReflectionsNotEnabled,
    #[msg("Insufficient SOL for fee - would leave account below rent-exempt minimum")]
    InsufficientSolForFee,
    #[msg("Referrer address does not match project referrer")]
    InvalidReferrer,
    #[msg("Insufficient balance in vault")]
    InsufficientVaultBalance,
    #[msg("Insufficient rewards in reward vault")]
    InsufficientRewardVault,
    #[msg("Insufficient reflections in reflection vault")]
    InsufficientReflectionVault,
    #[msg("No stakers in pool")]
    NoStakersInPool,
    #[msg("Invalid calculation")]
    InvalidCalculation,
    #[msg("Division by zero")]
    DivisionByZero,
    #[msg("Invalid fee collector")]
    InvalidFeeCollector,
    #[msg("Calculated APR exceeds maximum u64 value")]
    AprOverflow,
    #[msg("Wrong token type - must match project token mint")]
    WrongTokenMint,
    #[msg("Unauthorized vault - must belong to this project")]
    UnauthorizedVault,
    #[msg("Invalid stake account for specified user")]
    InvalidStakeAccount,
    #[msg("Invalid withdrawal wallet - does not match stake withdrawal wallet")]
    InvalidWithdrawalWallet,
    #[msg("Invalid reflection vault - does not match project reflection vault")]
    InvalidReflectionVault,
    #[msg("Invalid project - stake does not belong to this project")]
    InvalidProject,
    #[msg("Inconsistent total staked - total staked is less than withdrawal amount")]
    InconsistentTotalStaked,
    #[msg("Invalid timestamp - clock moved backwards")]
    InvalidTimestamp,
    #[msg("Pool has ended - cannot deposit after pool end time")]
    PoolEnded,
    #[msg("Unauthorized access")]
    Unauthorized,
}