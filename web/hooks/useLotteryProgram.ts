import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor';
import type { Idl } from '@coral-xyz/anchor';
import { useState, useMemo, useCallback } from 'react';
import lotteryIdl from '@/lib/lottery.json';

// Program ID from your deployment
const LOTTERY_PROGRAM_ID = new PublicKey('Gu7AoXQqr2PsED9FwYeSwedUx8NKSwvbZUvrWyczBhqx');
const ADMIN_WALLET = new PublicKey('9zS3TWXEWQnYU2xFSMB7wvv7JuBJpcPtxw9kaf1STzvR');

// Type definitions
export interface LotteryState {
  admin: PublicKey;
  currentWeek: BN;
  prizeVault: PublicKey;
  adminFeeVault: PublicKey;
  isActive: boolean;
  ticketPrice: BN;
  bump: number;
}

export interface WeekState {
  weekNumber: BN;
  startTime: BN;
  salesCloseTime: BN;
  drawTime: BN;
  salesOpen: boolean;
  numbersDrawn: boolean;
  winningNumbers: number[];
  totalTicketsSold: BN;
  totalPrizePool: BN;
  winnersAnnounced: boolean;
  rolloverAmount: BN;
}

export interface TicketRecord {
  owner: PublicKey;
  weekNumber: BN;
  numbers: number[];
  ticketNumber: BN;
  claimed: boolean;
}

export interface WinnerRecord {
  owner: PublicKey;
  weekNumber: BN;
  matchCount: number;
  prizeAmount: BN;
  claimed: boolean;
  ticketNumber: BN;
}

export const useLotteryProgram = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize Anchor provider and program
  const { provider, program } = useMemo(() => {
    if (!wallet.publicKey) {
      return { provider: null, program: null };
    }

    const provider = new AnchorProvider(
      connection,
      wallet as any,
      AnchorProvider.defaultOptions()
    );

    const program = new Program(
      lotteryIdl as Idl,
      provider
    );

    return { provider, program };
  }, [connection, wallet]);

  // Derive PDAs
  const getLotteryStatePDA = useCallback(() => {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('lottery_state')],
      LOTTERY_PROGRAM_ID
    );
    return pda;
  }, []);

  const getPrizeVaultPDA = useCallback(() => {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('prize_vault')],
      LOTTERY_PROGRAM_ID
    );
    return pda;
  }, []);

  const getAdminFeeVaultPDA = useCallback(() => {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('admin_fee_vault')],
      LOTTERY_PROGRAM_ID
    );
    return pda;
  }, []);

  const getWeekStatePDA = useCallback((weekNumber: number) => {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('week_state'), new BN(weekNumber).toArrayLike(Buffer, 'le', 8)],
      LOTTERY_PROGRAM_ID
    );
    return pda;
  }, []);

  const getTicketRecordPDA = useCallback((weekNumber: number, ticketNumber: number) => {
    const [pda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('ticket'),
        new BN(weekNumber).toArrayLike(Buffer, 'le', 8),
        new BN(ticketNumber).toArrayLike(Buffer, 'le', 8)
      ],
      LOTTERY_PROGRAM_ID
    );
    return pda;
  }, []);

  const getWinnerRecordPDA = useCallback((weekNumber: number, ticketNumber: number) => {
    const [pda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('winner'),
        new BN(weekNumber).toArrayLike(Buffer, 'le', 8),
        new BN(ticketNumber).toArrayLike(Buffer, 'le', 8)
      ],
      LOTTERY_PROGRAM_ID
    );
    return pda;
  }, []);

  // Fetch lottery state
  const fetchLotteryState = useCallback(async (): Promise<LotteryState | null> => {
    if (!program) return null;

    try {
      const lotteryStatePDA = getLotteryStatePDA();
      const state = await program.account.lotteryState.fetch(lotteryStatePDA);
      return state as LotteryState;
    } catch (err) {
      console.error('Error fetching lottery state:', err);
      return null;
    }
  }, [program, getLotteryStatePDA]);

  // Fetch week state
  const fetchWeekState = useCallback(async (weekNumber: number): Promise<WeekState | null> => {
    if (!program) return null;

    try {
      const weekStatePDA = getWeekStatePDA(weekNumber);
      const state = await program.account.weekState.fetch(weekStatePDA);
      return state as WeekState;
    } catch (err) {
      console.error('Error fetching week state:', err);
      return null;
    }
  }, [program, getWeekStatePDA]);

  // Fetch ticket record
  const fetchTicketRecord = useCallback(async (
    weekNumber: number,
    ticketNumber: number
  ): Promise<TicketRecord | null> => {
    if (!program) return null;

    try {
      const ticketPDA = getTicketRecordPDA(weekNumber, ticketNumber);
      const ticket = await program.account.ticketRecord.fetch(ticketPDA);
      return ticket as TicketRecord;
    } catch (err) {
      console.error('Error fetching ticket record:', err);
      return null;
    }
  }, [program, getTicketRecordPDA]);

  // Fetch winner record
  const fetchWinnerRecord = useCallback(async (
    weekNumber: number,
    ticketNumber: number
  ): Promise<WinnerRecord | null> => {
    if (!program) return null;

    try {
      const winnerPDA = getWinnerRecordPDA(weekNumber, ticketNumber);
      const winner = await program.account.winnerRecord.fetch(winnerPDA);
      return winner as WinnerRecord;
    } catch (err) {
      console.error('Error fetching winner record:', err);
      return null;
    }
  }, [program, getWinnerRecordPDA]);

  // Fetch all tickets for a user in a specific week
  const fetchUserTickets = useCallback(async (
    weekNumber: number
  ): Promise<TicketRecord[]> => {
    if (!program || !wallet.publicKey) return [];

    try {
      const tickets = await program.account.ticketRecord.all([
        {
          memcmp: {
            offset: 8, // Discriminator
            bytes: wallet.publicKey.toBase58(),
          },
        },
      ]);

      return tickets
        .map(t => t.account as TicketRecord)
        .filter(t => t.weekNumber.toNumber() === weekNumber);
    } catch (err) {
      console.error('Error fetching user tickets:', err);
      return [];
    }
  }, [program, wallet.publicKey]);

  // Fetch all winners for a specific week
  const fetchWeekWinners = useCallback(async (
    weekNumber: number
  ): Promise<WinnerRecord[]> => {
    if (!program) return [];

    try {
      const winners = await program.account.winnerRecord.all();
      return winners
        .map(w => w.account as WinnerRecord)
        .filter(w => w.weekNumber.toNumber() === weekNumber);
    } catch (err) {
      console.error('Error fetching week winners:', err);
      return [];
    }
  }, [program]);

  // 1. Initialize (Admin only)
  const initialize = useCallback(async () => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    if (wallet.publicKey.toString() !== ADMIN_WALLET.toString()) {
      throw new Error('Only admin can initialize');
    }

    setIsLoading(true);
    setError(null);

    try {
      const lotteryStatePDA = getLotteryStatePDA();
      const prizeVaultPDA = getPrizeVaultPDA();
      const adminFeeVaultPDA = getAdminFeeVaultPDA();

      const tx = await program.methods
        .initialize()
        .accounts({
          lotteryState: lotteryStatePDA,
          prizeVault: prizeVaultPDA,
          adminFeeVault: adminFeeVaultPDA,
          admin: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('Initialize transaction:', tx);
      return tx;
    } catch (err: any) {
      console.error('Initialize error:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [program, wallet.publicKey, getLotteryStatePDA, getPrizeVaultPDA, getAdminFeeVaultPDA]);

  // 2. Start Week (Admin only)
  const startWeek = useCallback(async (
    salesDuration: number, // seconds
    drawDelay: number // seconds after sales close
  ) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    if (wallet.publicKey.toString() !== ADMIN_WALLET.toString()) {
      throw new Error('Only admin can start a week');
    }

    setIsLoading(true);
    setError(null);

    try {
      const lotteryStatePDA = getLotteryStatePDA();
      const lotteryState = await fetchLotteryState();
      
      if (!lotteryState) {
        throw new Error('Lottery not initialized');
      }

      const weekNumber = lotteryState.currentWeek.toNumber() + 1;
      const weekStatePDA = getWeekStatePDA(weekNumber);

      const tx = await program.methods
        .startWeek(new BN(salesDuration), new BN(drawDelay))
        .accounts({
          lotteryState: lotteryStatePDA,
          weekState: weekStatePDA,
          admin: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('Start week transaction:', tx);
      return tx;
    } catch (err: any) {
      console.error('Start week error:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [program, wallet.publicKey, getLotteryStatePDA, getWeekStatePDA, fetchLotteryState]);

  // 3. Buy Tickets
  const buyTickets = useCallback(async (
    weekNumber: number,
    numbers: number[] // Must be 5 numbers between 1-59
  ) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    // Validate numbers
    if (numbers.length !== 5) {
      throw new Error('Must select exactly 5 numbers');
    }

    if (numbers.some(n => n < 1 || n > 59)) {
      throw new Error('Numbers must be between 1 and 59');
    }

    if (new Set(numbers).size !== 5) {
      throw new Error('Numbers must be unique');
    }

    setIsLoading(true);
    setError(null);

    try {
      const lotteryStatePDA = getLotteryStatePDA();
      const weekStatePDA = getWeekStatePDA(weekNumber);
      const prizeVaultPDA = getPrizeVaultPDA();
      const adminFeeVaultPDA = getAdminFeeVaultPDA();

      const weekState = await fetchWeekState(weekNumber);
      if (!weekState) {
        throw new Error('Week not started');
      }

      const ticketNumber = weekState.totalTicketsSold.toNumber();
      const ticketRecordPDA = getTicketRecordPDA(weekNumber, ticketNumber);

      const tx = await program.methods
        .buyTickets(numbers)
        .accounts({
          lotteryState: lotteryStatePDA,
          weekState: weekStatePDA,
          ticketRecord: ticketRecordPDA,
          buyer: wallet.publicKey,
          prizeVault: prizeVaultPDA,
          adminFeeVault: adminFeeVaultPDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('Buy tickets transaction:', tx);
      return { tx, ticketNumber };
    } catch (err: any) {
      console.error('Buy tickets error:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [
    program,
    wallet.publicKey,
    getLotteryStatePDA,
    getWeekStatePDA,
    getPrizeVaultPDA,
    getAdminFeeVaultPDA,
    getTicketRecordPDA,
    fetchWeekState,
  ]);

  // 4. Close Sales (Admin only)
  const closeSales = useCallback(async (weekNumber: number) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    if (wallet.publicKey.toString() !== ADMIN_WALLET.toString()) {
      throw new Error('Only admin can close sales');
    }

    setIsLoading(true);
    setError(null);

    try {
      const weekStatePDA = getWeekStatePDA(weekNumber);

      const tx = await program.methods
        .closeSales()
        .accounts({
          weekState: weekStatePDA,
          admin: wallet.publicKey,
        })
        .rpc();

      console.log('Close sales transaction:', tx);
      return tx;
    } catch (err: any) {
      console.error('Close sales error:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [program, wallet.publicKey, getWeekStatePDA]);

  // 5. Draw Numbers (Admin only)
  const drawNumbers = useCallback(async (weekNumber: number) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    if (wallet.publicKey.toString() !== ADMIN_WALLET.toString()) {
      throw new Error('Only admin can draw numbers');
    }

    setIsLoading(true);
    setError(null);

    try {
      const weekStatePDA = getWeekStatePDA(weekNumber);

      const tx = await program.methods
        .drawNumbers()
        .accounts({
          weekState: weekStatePDA,
          admin: wallet.publicKey,
          recentSlothashes: new PublicKey('SysvarS1otHashes111111111111111111111111111'),
        })
        .rpc();

      console.log('Draw numbers transaction:', tx);
      return tx;
    } catch (err: any) {
      console.error('Draw numbers error:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [program, wallet.publicKey, getWeekStatePDA]);

  // 6. Announce Winners (Admin only)
  const announceWinners = useCallback(async (weekNumber: number) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    if (wallet.publicKey.toString() !== ADMIN_WALLET.toString()) {
      throw new Error('Only admin can announce winners');
    }

    setIsLoading(true);
    setError(null);

    try {
      const weekStatePDA = getWeekStatePDA(weekNumber);

      const tx = await program.methods
        .announceWinners()
        .accounts({
          weekState: weekStatePDA,
          admin: wallet.publicKey,
        })
        .rpc();

      console.log('Announce winners transaction:', tx);
      return tx;
    } catch (err: any) {
      console.error('Announce winners error:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [program, wallet.publicKey, getWeekStatePDA]);

  // 7. Create Winner Record (Admin only - called for each winning ticket)
  const createWinnerRecord = useCallback(async (
    weekNumber: number,
    ticketNumber: number,
    matchCount: number,
    prizeAmount: number // in lamports
  ) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    if (wallet.publicKey.toString() !== ADMIN_WALLET.toString()) {
      throw new Error('Only admin can create winner records');
    }

    setIsLoading(true);
    setError(null);

    try {
      const weekStatePDA = getWeekStatePDA(weekNumber);
      const ticketRecordPDA = getTicketRecordPDA(weekNumber, ticketNumber);
      const winnerRecordPDA = getWinnerRecordPDA(weekNumber, ticketNumber);

      const tx = await program.methods
        .createWinnerRecord(matchCount, new BN(prizeAmount))
        .accounts({
          weekState: weekStatePDA,
          ticketRecord: ticketRecordPDA,
          winnerRecord: winnerRecordPDA,
          admin: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('Create winner record transaction:', tx);
      return tx;
    } catch (err: any) {
      console.error('Create winner record error:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [program, wallet.publicKey, getWeekStatePDA, getTicketRecordPDA, getWinnerRecordPDA]);

  // 8. Claim Prize (Winner only)
  const claimPrize = useCallback(async (weekNumber: number, ticketNumber: number) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);
    setError(null);

    try {
      const lotteryStatePDA = getLotteryStatePDA();
      const weekStatePDA = getWeekStatePDA(weekNumber);
      const winnerRecordPDA = getWinnerRecordPDA(weekNumber, ticketNumber);
      const prizeVaultPDA = getPrizeVaultPDA();

      const tx = await program.methods
        .claimPrize()
        .accounts({
          lotteryState: lotteryStatePDA,
          weekState: weekStatePDA,
          winnerRecord: winnerRecordPDA,
          winner: wallet.publicKey,
          prizeVault: prizeVaultPDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('Claim prize transaction:', tx);
      return tx;
    } catch (err: any) {
      console.error('Claim prize error:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [
    program,
    wallet.publicKey,
    getLotteryStatePDA,
    getWeekStatePDA,
    getWinnerRecordPDA,
    getPrizeVaultPDA,
  ]);

  // 9. Calculate Rollover (Admin only)
  const calculateRollover = useCallback(async (weekNumber: number) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    if (wallet.publicKey.toString() !== ADMIN_WALLET.toString()) {
      throw new Error('Only admin can calculate rollover');
    }

    setIsLoading(true);
    setError(null);

    try {
      const lotteryStatePDA = getLotteryStatePDA();
      const currentWeekStatePDA = getWeekStatePDA(weekNumber);
      const nextWeekStatePDA = getWeekStatePDA(weekNumber + 1);

      const tx = await program.methods
        .calculateRollover()
        .accounts({
          lotteryState: lotteryStatePDA,
          currentWeekState: currentWeekStatePDA,
          nextWeekState: nextWeekStatePDA,
          admin: wallet.publicKey,
        })
        .rpc();

      console.log('Calculate rollover transaction:', tx);
      return tx;
    } catch (err: any) {
      console.error('Calculate rollover error:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [program, wallet.publicKey, getLotteryStatePDA, getWeekStatePDA]);

  // 10. Reclaim Unclaimed (Admin only)
  const reclaimUnclaimed = useCallback(async (weekNumber: number) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    if (wallet.publicKey.toString() !== ADMIN_WALLET.toString()) {
      throw new Error('Only admin can reclaim unclaimed prizes');
    }

    setIsLoading(true);
    setError(null);

    try {
      const lotteryStatePDA = getLotteryStatePDA();
      const weekStatePDA = getWeekStatePDA(weekNumber);
      const prizeVaultPDA = getPrizeVaultPDA();
      const adminFeeVaultPDA = getAdminFeeVaultPDA();

      const tx = await program.methods
        .reclaimUnclaimed()
        .accounts({
          lotteryState: lotteryStatePDA,
          weekState: weekStatePDA,
          prizeVault: prizeVaultPDA,
          adminFeeVault: adminFeeVaultPDA,
          admin: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('Reclaim unclaimed transaction:', tx);
      return tx;
    } catch (err: any) {
      console.error('Reclaim unclaimed error:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [
    program,
    wallet.publicKey,
    getLotteryStatePDA,
    getWeekStatePDA,
    getPrizeVaultPDA,
    getAdminFeeVaultPDA,
  ]);

  // 11. Emergency Withdraw (Admin only)
  const emergencyWithdraw = useCallback(async () => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    if (wallet.publicKey.toString() !== ADMIN_WALLET.toString()) {
      throw new Error('Only admin can emergency withdraw');
    }

    setIsLoading(true);
    setError(null);

    try {
      const lotteryStatePDA = getLotteryStatePDA();
      const prizeVaultPDA = getPrizeVaultPDA();
      const adminFeeVaultPDA = getAdminFeeVaultPDA();

      const tx = await program.methods
        .emergencyWithdraw()
        .accounts({
          lotteryState: lotteryStatePDA,
          prizeVault: prizeVaultPDA,
          adminFeeVault: adminFeeVaultPDA,
          admin: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('Emergency withdraw transaction:', tx);
      return tx;
    } catch (err: any) {
      console.error('Emergency withdraw error:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [
    program,
    wallet.publicKey,
    getLotteryStatePDA,
    getPrizeVaultPDA,
    getAdminFeeVaultPDA,
  ]);

  // 12. Transfer Admin (Admin only)
  const transferAdmin = useCallback(async (newAdmin: PublicKey) => {
    if (!program || !wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    if (wallet.publicKey.toString() !== ADMIN_WALLET.toString()) {
      throw new Error('Only admin can transfer admin rights');
    }

    setIsLoading(true);
    setError(null);

    try {
      const lotteryStatePDA = getLotteryStatePDA();

      const tx = await program.methods
        .transferAdmin(newAdmin)
        .accounts({
          lotteryState: lotteryStatePDA,
          admin: wallet.publicKey,
        })
        .rpc();

      console.log('Transfer admin transaction:', tx);
      return tx;
    } catch (err: any) {
      console.error('Transfer admin error:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [program, wallet.publicKey, getLotteryStatePDA]);

  // Helper: Check if connected wallet is admin
  const isAdmin = useMemo(() => {
    return wallet.publicKey?.toString() === ADMIN_WALLET.toString();
  }, [wallet.publicKey]);

  return {
    // State
    isLoading,
    error,
    isAdmin,
    program,

    // PDAs
    getLotteryStatePDA,
    getPrizeVaultPDA,
    getAdminFeeVaultPDA,
    getWeekStatePDA,
    getTicketRecordPDA,
    getWinnerRecordPDA,

    // Fetch functions
    fetchLotteryState,
    fetchWeekState,
    fetchTicketRecord,
    fetchWinnerRecord,
    fetchUserTickets,
    fetchWeekWinners,

    // Instructions
    initialize,
    startWeek,
    buyTickets,
    closeSales,
    drawNumbers,
    announceWinners,
    createWinnerRecord,
    claimPrize,
    calculateRollover,
    reclaimUnclaimed,
    emergencyWithdraw,
    transferAdmin,
  };
};