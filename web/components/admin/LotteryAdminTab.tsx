'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useLotteryProgram } from '@/hooks/useLotteryProgram';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

export default function LotteryAdminTab() {
  const { publicKey } = useWallet();
  const {
    isAdmin,
    fetchLotteryState,
    fetchWeekState,
    startWeek,
    closeSales,
    drawNumbers,
    announceWinners,
    calculateRollover,
    reclaimUnclaimed,
    emergencyWithdraw,
    transferAdmin,
    isLoading,
  } = useLotteryProgram();

  const [lotteryState, setLotteryState] = useState<any>(null);
  const [weekState, setWeekState] = useState<any>(null);
  const [activeOperation, setActiveOperation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // New week form
  const [salesDuration, setSalesDuration] = useState<number>(7 * 24 * 60 * 60); // 7 days in seconds
  const [drawDelay, setDrawDelay] = useState<number>(1 * 60 * 60); // 1 hour in seconds
  
  // Transfer admin form
  const [newAdminAddress, setNewAdminAddress] = useState<string>('');
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);

  // Load states
  const loadStates = useCallback(async () => {
    try {
      const lottery = await fetchLotteryState();
      setLotteryState(lottery);
      
      if (lottery && lottery.currentWeek) {
        const currentWeekNumber = lottery.currentWeek.toNumber();
        const week = await fetchWeekState(currentWeekNumber);
        setWeekState(week);
      }
    } catch (err) {
      console.error('Error loading states:', err);
    }
  }, [fetchLotteryState, fetchWeekState]);

  useEffect(() => {
    loadStates();
  }, [loadStates]);

  // Generic operation handler
  const handleOperation = async (
    operationName: string,
    operation: () => Promise<any>,
    successMessage: string
  ) => {
    setActiveOperation(operationName);
    setError(null);
    setSuccess(null);

    try {
      await operation();
      setSuccess(successMessage);
      await loadStates();
      
      // Clear success after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      console.error(`${operationName} error:`, err);
      setError(err.message || `Failed to ${operationName}`);
    } finally {
      setActiveOperation(null);
    }
  };

  // Start new week
  const handleStartWeek = async () => {
    await handleOperation(
      'start_week',
      () => startWeek(salesDuration, drawDelay),
      `Week ${(lotteryState?.currentWeek?.toNumber() || 0) + 1} started successfully!`
    );
  };

  // Close sales
  const handleCloseSales = async () => {
    if (!lotteryState?.currentWeek) return;
    await handleOperation(
      'close_sales',
      () => closeSales(lotteryState.currentWeek.toNumber()),
      'Sales closed successfully!'
    );
  };

  // Draw numbers
  const handleDrawNumbers = async () => {
    if (!lotteryState?.currentWeek) return;
    await handleOperation(
      'draw_numbers',
      () => drawNumbers(lotteryState.currentWeek.toNumber()),
      'Numbers drawn successfully!'
    );
  };

  // Announce winners
  const handleAnnounceWinners = async () => {
    if (!lotteryState?.currentWeek) return;
    await handleOperation(
      'announce_winners',
      () => announceWinners(lotteryState.currentWeek.toNumber()),
      'Winners announced successfully!'
    );
  };

  // Calculate rollover
  const handleCalculateRollover = async () => {
    if (!lotteryState?.currentWeek) return;
    await handleOperation(
      'calculate_rollover',
      () => calculateRollover(lotteryState.currentWeek.toNumber()),
      'Rollover calculated successfully!'
    );
  };

  // Reclaim unclaimed prizes
  const handleReclaimUnclaimed = async () => {
    if (!lotteryState?.currentWeek) return;
    await handleOperation(
      'reclaim_unclaimed',
      () => reclaimUnclaimed(lotteryState.currentWeek.toNumber()),
      'Unclaimed prizes reclaimed successfully!'
    );
  };

  // Emergency withdraw
  const handleEmergencyWithdraw = async () => {
    if (!window.confirm('⚠️ WARNING: This will withdraw all funds. Are you sure?')) {
      return;
    }
    
    await handleOperation(
      'emergency_withdraw',
      () => emergencyWithdraw(),
      'Emergency withdrawal completed!'
    );
  };

  // Transfer admin
  const handleTransferAdmin = async () => {
    if (!newAdminAddress) {
      setError('Please enter a valid address');
      return;
    }

    try {
      const newAdmin = new PublicKey(newAdminAddress);
      await handleOperation(
        'transfer_admin',
        () => transferAdmin(newAdmin),
        'Admin rights transferred successfully!'
      );
      setNewAdminAddress('');
      setShowTransferConfirm(false);
    } catch (err) {
      setError('Invalid public key address');
    }
  };

  // Format durations
  const formatDuration = (seconds: number): string => {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    
    return parts.join(' ') || '0m';
  };

  if (!isAdmin) {
    return (
      <div className="bg-slate-900/50 backdrop-blur border border-slate-700 rounded-xl p-8">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h3 className="text-xl font-bold text-white mb-2">Admin Access Required</h3>
          <p className="text-gray-400">Only the admin wallet can access lottery controls</p>
        </div>
      </div>
    );
  }

  const currentWeekNumber = lotteryState?.currentWeek?.toNumber();
  const canStartWeek = !weekState || weekState.winnersAnnounced;
  const canCloseSales = weekState?.salesOpen;
  const canDrawNumbers = weekState && !weekState.salesOpen && !weekState.numbersDrawn;
  const canAnnounceWinners = weekState?.numbersDrawn && !weekState.winnersAnnounced;
  const canCalculateRollover = weekState?.winnersAnnounced;

  return (
    <div className="space-y-6">
      {/* Admin Badge */}
      <div className="bg-gradient-to-r from-purple-900/50 to-purple-800/50 backdrop-blur border border-purple-500/50 rounded-xl p-6">
        <div className="flex items-center gap-4">
          <span className="text-5xl">👑</span>
          <div>
            <h3 className="text-2xl font-bold text-white">Lottery Admin Controls</h3>
            <p className="text-purple-300">Manage lottery operations and settings</p>
          </div>
        </div>
      </div>

      {/* Current State Info */}
      {lotteryState && (
        <div className="bg-slate-900/50 backdrop-blur border border-slate-700 rounded-xl p-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            📊 <span>Lottery State</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800/50 rounded-lg p-4">
              <span className="text-sm text-gray-400">Current Week:</span>
              <p className="text-2xl font-bold text-blue-400">
                #{lotteryState.currentWeek?.toNumber() || 0}
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4">
              <span className="text-sm text-gray-400">Status:</span>
              <p className={`text-2xl font-bold ${lotteryState.isActive ? 'text-green-400' : 'text-red-400'}`}>
                {lotteryState.isActive ? '🟢 Active' : '🔴 Inactive'}
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4">
              <span className="text-sm text-gray-400">Ticket Price:</span>
              <p className="text-2xl font-bold text-purple-400">
                {(Number(lotteryState.ticketPrice) / LAMPORTS_PER_SOL).toFixed(2)} SOL
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Week State Info */}
      {weekState && currentWeekNumber !== null && (
        <div className="bg-slate-900/50 backdrop-blur border border-slate-700 rounded-xl p-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            📅 <span>Week #{currentWeekNumber} State</span>
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-slate-800/50 rounded-lg p-4">
              <span className="text-sm text-gray-400">Sales:</span>
              <p className={`text-lg font-bold ${weekState.salesOpen ? 'text-green-400' : 'text-red-400'}`}>
                {weekState.salesOpen ? '🟢 Open' : '🔴 Closed'}
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4">
              <span className="text-sm text-gray-400">Numbers Drawn:</span>
              <p className="text-lg font-bold text-white">{weekState.numbersDrawn ? '✅ Yes' : '❌ No'}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4">
              <span className="text-sm text-gray-400">Winners Announced:</span>
              <p className="text-lg font-bold text-white">{weekState.winnersAnnounced ? '✅ Yes' : '❌ No'}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4">
              <span className="text-sm text-gray-400">Tickets Sold:</span>
              <p className="text-lg font-bold text-blue-400">{weekState.totalTicketsSold?.toString() || '0'}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 md:col-span-2">
              <span className="text-sm text-gray-400">Prize Pool:</span>
              <p className="text-lg font-bold text-yellow-400">
                {(Number(weekState.totalPrizePool) / LAMPORTS_PER_SOL).toFixed(4)} SOL
              </p>
            </div>
            {weekState.winningNumbers?.length > 0 && (
              <div className="bg-slate-800/50 rounded-lg p-4 md:col-span-3">
                <span className="text-sm text-gray-400 block mb-2">Winning Numbers:</span>
                <div className="flex gap-2 flex-wrap">
                  {weekState.winningNumbers.map((num: number, idx: number) => (
                    <span 
                      key={idx} 
                      className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-yellow-400 to-yellow-600 text-black font-bold rounded-full"
                    >
                      {num}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Start New Week */}
      <div className="bg-slate-900/50 backdrop-blur border border-slate-700 rounded-xl p-6">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          🚀 <span>Start New Week</span>
        </h3>
        
        <div className="space-y-4 mb-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Sales Duration: <span className="text-white font-semibold">{formatDuration(salesDuration)}</span>
            </label>
            <input
              type="range"
              min={3600} // 1 hour
              max={604800} // 7 days
              step={3600}
              value={salesDuration}
              onChange={(e) => setSalesDuration(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1 hour</span>
              <span>7 days</span>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Draw Delay: <span className="text-white font-semibold">{formatDuration(drawDelay)}</span>
            </label>
            <input
              type="range"
              min={300} // 5 minutes
              max={86400} // 24 hours
              step={300}
              value={drawDelay}
              onChange={(e) => setDrawDelay(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>5 min</span>
              <span>24 hours</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleStartWeek}
          disabled={!canStartWeek || activeOperation === 'start_week'}
          className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
        >
          {activeOperation === 'start_week' ? '⏳ Starting...' : '🚀 Start New Week'}
        </button>
        
        {!canStartWeek && (
          <p className="text-yellow-400 text-sm mt-2 text-center">
            ⚠️ Complete current week before starting a new one
          </p>
        )}
      </div>

      {/* Week Operations */}
      <div className="bg-slate-900/50 backdrop-blur border border-slate-700 rounded-xl p-6">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
          ⚙️ <span>Week Operations</span>
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={handleCloseSales}
            disabled={!canCloseSales || activeOperation === 'close_sales'}
            className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {activeOperation === 'close_sales' ? '⏳ Closing...' : '🔒 Close Sales'}
          </button>

          <button
            onClick={handleDrawNumbers}
            disabled={!canDrawNumbers || activeOperation === 'draw_numbers'}
            className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {activeOperation === 'draw_numbers' ? '⏳ Drawing...' : '🎲 Draw Numbers'}
          </button>

          <button
            onClick={handleAnnounceWinners}
            disabled={!canAnnounceWinners || activeOperation === 'announce_winners'}
            className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {activeOperation === 'announce_winners' ? '⏳ Announcing...' : '📢 Announce Winners'}
          </button>

          <button
            onClick={handleCalculateRollover}
            disabled={!canCalculateRollover || activeOperation === 'calculate_rollover'}
            className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {activeOperation === 'calculate_rollover' ? '⏳ Calculating...' : '🔄 Calculate Rollover'}
          </button>

          <button
            onClick={handleReclaimUnclaimed}
            disabled={!weekState || activeOperation === 'reclaim_unclaimed'}
            className="px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium md:col-span-2"
          >
            {activeOperation === 'reclaim_unclaimed' ? '⏳ Reclaiming...' : '💰 Reclaim Unclaimed'}
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-gradient-to-br from-red-900/30 to-red-800/30 backdrop-blur border border-red-500/50 rounded-xl p-6">
        <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-red-400">
          ⚠️ <span>Danger Zone</span>
        </h3>
        
        {/* Emergency Withdraw */}
        <div className="bg-black/30 rounded-lg p-4 mb-4">
          <h4 className="font-semibold text-white mb-1">Emergency Withdraw</h4>
          <p className="text-sm text-gray-400 mb-3">Withdraw all funds from prize vault and admin fee vault</p>
          <button
            onClick={handleEmergencyWithdraw}
            disabled={activeOperation === 'emergency_withdraw'}
            className="w-full px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition-all disabled:opacity-50 font-semibold"
          >
            {activeOperation === 'emergency_withdraw' ? '⏳ Withdrawing...' : '🚨 Emergency Withdraw'}
          </button>
        </div>

        {/* Transfer Admin */}
        <div className="bg-black/30 rounded-lg p-4">
          <h4 className="font-semibold text-white mb-1">Transfer Admin Rights</h4>
          <p className="text-sm text-gray-400 mb-3">Transfer admin control to another wallet</p>
          
          {!showTransferConfirm ? (
            <button
              onClick={() => setShowTransferConfirm(true)}
              className="w-full px-4 py-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition-all font-medium"
            >
              🔑 Transfer Admin
            </button>
          ) : (
            <div className="space-y-3">
              <input
                type="text"
                placeholder="New admin public key"
                value={newAdminAddress}
                onChange={(e) => setNewAdminAddress(e.target.value)}
                className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-red-500 focus:outline-none font-mono text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleTransferAdmin}
                  disabled={activeOperation === 'transfer_admin'}
                  className="flex-1 px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition-all disabled:opacity-50 font-semibold"
                >
                  {activeOperation === 'transfer_admin' ? '⏳ Transferring...' : '✅ Confirm Transfer'}
                </button>
                <button
                  onClick={() => {
                    setShowTransferConfirm(false);
                    setNewAdminAddress('');
                  }}
                  className="px-4 py-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition-all"
                >
                  ❌ Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="fixed bottom-6 right-6 bg-green-600 border border-green-500 rounded-lg p-4 shadow-xl animate-in slide-in-from-bottom-5 z-50">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <span className="text-white font-medium">{success}</span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="fixed bottom-6 right-6 bg-red-600 border border-red-500 rounded-lg p-4 shadow-xl animate-in slide-in-from-bottom-5 z-50">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <span className="text-white font-medium">{error}</span>
            <button 
              onClick={() => setError(null)} 
              className="ml-4 text-white hover:text-gray-200"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}