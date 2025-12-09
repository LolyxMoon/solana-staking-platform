import TelegramBot from 'node-telegram-bot-api';
import type { PrismaClient } from '@prisma/client';

interface WalletStat {
  rank: number;
  address: string;
  volumeUsd: number;
  swaps: number;
}

interface SwapStats {
  totalSwaps: number;
  totalVolumeUsd: number;
  totalFeesUsd: number;
  rewardPoolUsd: number;
  last24hVolumeUsd: number;
  last7dVolumeUsd: number;
  topWallets: WalletStat[];
}

export class TelegramBotService {
  private bot: TelegramBot | null = null;
  private prisma: PrismaClient;
  private bannerImageUrl: string = "https://image2url.com/images/1764325586041-e82989fd-172c-446c-a02d-25ea2690bbd6.png";
  private fallbackLogoUrl: string = "https://solanastaking-seven.vercel.app/favicon.jpg";

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token) {
      this.bot = new TelegramBot(token, { polling: false });
    }
  }

  // Helper: Convert duration to days (handles seconds input)
  private toDays(duration: number): number {
    if (duration <= 0) return 0;
    // If value > 400, assume it's in seconds (no realistic lock > 400 days)
    if (duration > 400) {
      return Math.round(duration / 86400); // 86400 seconds per day
    }
    return duration;
  }

  // Helper: Format lock period for display
  private formatLockPeriod(duration: number): string {
    const days = this.toDays(duration);
    if (days <= 0) return '🔓 Flexible (Unlocked)';
    return `🔒 ${days} days`;
  }

  async processUpdate(update: any) {
    if (!this.bot) return;

    try {
      const message = update.message;
      if (!message || !message.text) return;

      const chatId = message.chat.id;
      const text = message.text;

      if (text === '/start') {
        await this.handleStart(chatId);
      } else if (text === '/help') {
        await this.handleHelp(chatId);
      } else if (text === '/toptraders' || text === '/top10') {
        await this.handleTopTraders(chatId, 10);
      } else if (text === '/top20') {
        await this.handleTopTraders(chatId, 20);
      } else if (text === '/monthly') {
        await this.handleMonthly(chatId);
      } else if (text === '/alltime') {
        await this.handleAlltime(chatId);
      }
    } catch (error) {
      console.error('Error processing update:', error);
    }
  }

  private async handleStart(chatId: number) {
    const welcomeMessage = `
🎯 *Welcome to StakePoint Leaderboard Bot!*

I track the top traders on the StakePoint platform and show weekly rewards!

*Available Commands:*
/toptraders - Show this week's top 10 + rewards (Mon-Sun)
/top10 - Same as /toptraders
/top20 - Show top 20 traders
/monthly - Show top 10 for last 30 days
/alltime - Show all-time top 10 traders
/help - Show this help message

*Weekly Rewards:*
🎁 Reward pool split proportionally among top 10 traders!
📅 Resets every Monday at 00:00

Let's see who's leading the pack! 🚀
    `;
    await this.sendMessageWithBanner(chatId, welcomeMessage);
  }

  private async handleHelp(chatId: number) {
    const helpMessage = `
📚 *StakePoint Leaderboard Bot Commands*

*Leaderboard Commands:*
/toptraders - This week's top 10 (Mon-Sun)
/top10 - Same as /toptraders
/top20 - Top 20 traders (this week)
/monthly - Top 10 for last 30 days
/alltime - All-time top 10 traders

*Rewards:*
- Weekly reward pool split proportionally by volume among top 10 traders
- Resets every Monday 00:00

*Time Ranges:*
- Weekly: Current week (Monday to Sunday)
- Monthly: Last 30 days
- All Time: Since platform launch

💡 Data updates in real-time from the blockchain!
    `;
    await this.sendMessageWithBanner(chatId, helpMessage);
  }

  private async handleTopTraders(chatId: number, limit: number) {
    await this.bot!.sendMessage(chatId, '⏳ Fetching this week\'s leaderboard...');
    const stats = await this.fetchStats('week');
    if (!stats) {
      await this.bot!.sendMessage(chatId, '❌ Failed to fetch leaderboard data. Please try again later.');
      return;
    }
    const message = this.formatLeaderboard(stats, 'week', limit);
    await this.sendMessageWithBanner(chatId, message);
  }

  private async handleMonthly(chatId: number) {
    await this.bot!.sendMessage(chatId, '⏳ Fetching monthly leaderboard...');
    const stats = await this.fetchStats('month');
    if (!stats) {
      await this.bot!.sendMessage(chatId, '❌ Failed to fetch leaderboard data. Please try again later.');
      return;
    }
    const message = this.formatLeaderboard(stats, 'month', 10);
    await this.sendMessageWithBanner(chatId, message);
  }

  private async handleAlltime(chatId: number) {
    await this.bot!.sendMessage(chatId, '⏳ Fetching all-time leaderboard...');
    const stats = await this.fetchStats('alltime');
    if (!stats) {
      await this.bot!.sendMessage(chatId, '❌ Failed to fetch leaderboard data. Please try again later.');
      return;
    }
    const message = this.formatLeaderboard(stats, 'alltime', 10);
    await this.sendMessageWithBanner(chatId, message);
  }

  private async sendMessageWithBanner(chatId: number, message: string) {
    if (this.bannerImageUrl) {
      try {
        await this.bot!.sendPhoto(chatId, this.bannerImageUrl, {
          caption: message,
          parse_mode: 'Markdown'
        });
      } catch (error) {
        console.error('Failed to send banner image:', error);
        await this.bot!.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      }
    } else {
      await this.bot!.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }
  }

  private formatNumber(num: number, decimals: number = 2): string {
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  private shortenAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  private getMedal(rank: number): string {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `${rank}.`;
  }

  private getWeekStart(): Date {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  private getWeekEnd(): Date {
    const monday = this.getWeekStart();
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return sunday;
  }

  private async fetchStats(mode: 'week' | 'month' | 'alltime' | number = 'week'): Promise<SwapStats | null> {
    try {
      const dateFilter: any = {};
      
      if (mode === 'week') {
        dateFilter.gte = this.getWeekStart();
        dateFilter.lte = this.getWeekEnd();
      } else if (mode === 'month') {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        dateFilter.gte = startDate;
        dateFilter.lte = endDate;
      } else if (typeof mode === 'number') {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - mode * 24 * 60 * 60 * 1000);
        dateFilter.gte = startDate;
        dateFilter.lte = endDate;
      }

      const whereClause = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

      const stats = await this.prisma.swapStats.aggregate({
        where: whereClause,
        _count: { id: true },
        _sum: { volumeUsd: true },
      });

      const now = new Date();
      const day24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const day7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const last24hStats = await this.prisma.swapStats.aggregate({
        where: { createdAt: { gte: day24Ago } },
        _sum: { volumeUsd: true },
      });

      const last7dStats = await this.prisma.swapStats.aggregate({
        where: { createdAt: { gte: day7Ago } },
        _sum: { volumeUsd: true },
      });

      const topWalletsRaw = await this.prisma.swapStats.groupBy({
        where: whereClause,
        by: ['userAddress'],
        _count: { id: true },
        _sum: { volumeUsd: true },
        orderBy: { _sum: { volumeUsd: 'desc' } },
        take: 100,
      });

      const topWallets = topWalletsRaw.map((wallet, index) => ({
        rank: index + 1,
        address: wallet.userAddress,
        volumeUsd: wallet._sum.volumeUsd || 0,
        swaps: wallet._count.id,
      }));

      const config = await this.prisma.swapConfig.findFirst();
      const platformFeeBps = config?.platformFeeBps || 100;
      const totalVolumeUsd = stats._sum.volumeUsd || 0;
      const totalFeesUsd = (totalVolumeUsd * platformFeeBps) / 10000;
      const rewardPoolUsd = totalFeesUsd * 0.4;

      return {
        totalSwaps: stats._count.id || 0,
        totalVolumeUsd,
        totalFeesUsd,
        rewardPoolUsd,
        last24hVolumeUsd: last24hStats._sum.volumeUsd || 0,
        last7dVolumeUsd: last7dStats._sum.volumeUsd || 0,
        topWallets,
      };
    } catch (error) {
      console.error('Error fetching stats from database:', error);
      return null;
    }
  }

  private formatLeaderboard(stats: SwapStats, mode: 'week' | 'month' | 'alltime' | number = 'week', limit: number = 10): string {
    let period: string;
    
    if (mode === 'week') {
      const weekStart = this.getWeekStart();
      const weekEnd = this.getWeekEnd();
      const startStr = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endStr = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      period = `This Week (${startStr} - ${endStr})`;
    } else if (mode === 'month') {
      period = 'Last 30 Days';
    } else if (mode === 'alltime') {
      period = 'All Time';
    } else {
      period = `Last ${mode} Days`;
    }
    
    const topWallets = stats.topWallets.slice(0, limit);

    if (topWallets.length === 0) {
      return `📊 *StakePoint Top Traders - ${period}*\n\n❌ No trading data available for this period.`;
    }

    let message = `🏆 *StakePoint Top ${limit} Traders - ${period}*\n\n`;
    message += `📈 Total Volume: $${this.formatNumber(stats.totalVolumeUsd)}\n`;
    message += `🔄 Total Swaps: ${this.formatNumber(stats.totalSwaps, 0)}\n`;
    
    if (mode === 'week') {
      message += `\n🎁 *Reward Pool: $${this.formatNumber(stats.rewardPoolUsd)}*\n`;
      message += `   💎 Distributed to top 10 traders!\n`;
    }
    
    message += `\n━━━━━━━━━━━━━━━━━━━━\n\n`;

    topWallets.forEach((wallet) => {
      const medal = this.getMedal(wallet.rank);
      const address = this.shortenAddress(wallet.address);
      const volume = this.formatNumber(wallet.volumeUsd);
      
      message += `${medal} \`${address}\`\n`;
      message += `   💵 Volume: $${volume}\n`;
      message += `   🔄 Swaps: ${wallet.swaps}\n`;
      
      if (mode === 'week' && wallet.rank <= 10 && stats.rewardPoolUsd > 0) {
        const top10Wallets = stats.topWallets.slice(0, 10);
        const top10TotalVolume = top10Wallets.reduce((sum, w) => sum + w.volumeUsd, 0);
        
        if (top10TotalVolume > 0) {
          const volumeShare = (wallet.volumeUsd / top10TotalVolume) * 100;
          const proportionalReward = (wallet.volumeUsd / top10TotalVolume) * stats.rewardPoolUsd;
          message += `   📊 Share: ${this.formatNumber(volumeShare, 1)}%\n`;
          message += `   🎁 Reward: $${this.formatNumber(proportionalReward)}\n`;
        }
      }
      
      message += `\n`;
    });

    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `📅 Updated: ${new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`;

    return message;
  }

  // Send staking pool creation alert
  async sendPoolCreatedAlert(poolData: {
    poolName: string;
    tokenSymbol: string;
    aprType: string;
    lockPeriodDays: number;
    tokenLogo?: string;
  }) {
    const chatId = process.env.TELEGRAM_ALERT_CHAT_ID;
    
    if (!this.bot || !chatId) {
      console.log('⚠️ Telegram alerts not configured');
      return;
    }

    try {
      const lockPeriodDisplay = this.formatLockPeriod(poolData.lockPeriodDays);
      
      const message = `
🎉 *New Staking Pool Created!*

*Pool:* ${poolData.poolName}
*Token:* ${poolData.tokenSymbol}
*Lock Period:* ${lockPeriodDisplay}

[👉 View Staking Pools](https://stakepoint.app/pools)
      `;

      const imageUrl = poolData.tokenLogo || this.fallbackLogoUrl;
      
      try {
        await this.bot.sendPhoto(parseInt(chatId), imageUrl, {
          caption: message,
          parse_mode: 'Markdown'
        });
      } catch (error) {
        console.error('Failed to send image:', error);
        await this.bot.sendMessage(parseInt(chatId), message, { parse_mode: 'Markdown' });
      }

      console.log('✅ Staking pool alert sent to Telegram');
    } catch (error) {
      console.error('❌ Failed to send staking pool alert:', error);
    }
  }

  // Send farming pool creation alert
  async sendFarmingPoolCreatedAlert(poolData: {
    poolName: string;
    tokenSymbol: string;
    apr: number;
    lockPeriodDays: number;
    tokenLogo?: string;
  }) {
    const chatId = process.env.TELEGRAM_ALERT_CHAT_ID;
    
    if (!this.bot || !chatId) {
      console.log('⚠️ Telegram alerts not configured');
      return;
    }

    try {
      const lockPeriodDisplay = this.formatLockPeriod(poolData.lockPeriodDays);
      
      const message = `
🌾 *New Farming Pool Created!*

*Pool:* ${poolData.poolName}
*LP Token:* ${poolData.tokenSymbol}
*APR:* ${poolData.apr > 0 ? `${poolData.apr}%` : 'Variable'}
*Lock Period:* ${lockPeriodDisplay}

[👉 View LP Farms](https://stakepoint.app/lp-pools)
      `;

      const imageUrl = poolData.tokenLogo || this.fallbackLogoUrl;
      
      try {
        await this.bot.sendPhoto(parseInt(chatId), imageUrl, {
          caption: message,
          parse_mode: 'Markdown'
        });
      } catch (error) {
        console.error('Failed to send image:', error);
        await this.bot.sendMessage(parseInt(chatId), message, { parse_mode: 'Markdown' });
      }

      console.log('✅ Farming pool alert sent to Telegram');
    } catch (error) {
      console.error('❌ Failed to send farming pool alert:', error);
    }
  }

  // Send lock creation alert
  async sendLockCreatedAlert(lockData: {
    tokenName: string;
    tokenSymbol: string;
    amount: number;
    lockDurationDays: number;
    creatorWallet: string;
    tokenLogo?: string;
  }) {
    const chatId = process.env.TELEGRAM_ALERT_CHAT_ID;
    
    if (!this.bot || !chatId) {
      console.log('⚠️ Telegram alerts not configured');
      return;
    }

    try {
      const shortWallet = `${lockData.creatorWallet.slice(0, 4)}...${lockData.creatorWallet.slice(-4)}`;
      const lockPeriodDisplay = this.formatLockPeriod(lockData.lockDurationDays);
      
      const message = `
🔐 *New Token Lock Created!*

*Token:* ${lockData.tokenName} (${lockData.tokenSymbol})
*Amount:* ${lockData.amount.toLocaleString()} ${lockData.tokenSymbol}
*Duration:* ${lockPeriodDisplay}
*Locked by:* \`${shortWallet}\`

[👉 View Token Locks](https://stakepoint.app/locks)
      `;

      const imageUrl = lockData.tokenLogo || this.fallbackLogoUrl;
      
      try {
        await this.bot.sendPhoto(parseInt(chatId), imageUrl, {
          caption: message,
          parse_mode: 'Markdown'
        });
      } catch (error) {
        console.error('Failed to send image:', error);
        await this.bot.sendMessage(parseInt(chatId), message, { parse_mode: 'Markdown' });
      }

      console.log('✅ Lock alert sent to Telegram');
    } catch (error) {
      console.error('❌ Failed to send lock alert:', error);
    }
  }
}