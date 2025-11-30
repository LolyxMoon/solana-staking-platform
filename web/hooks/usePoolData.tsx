"use client";
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface PoolData {
  poolInfo: any;
  userStake: {
    amount: number;
    pendingRewards: number;
    lastClaimTime: number;
  } | null;
  lastUpdated: number;
}

interface PoolDataContextType {
  getPoolData: (poolId: number) => PoolData | null;
  setPoolData: (poolId: number, data: PoolData) => void;
  clearPoolData: (poolId: number) => void;
  hasData: (poolId: number) => boolean; // NEW: Check if data exists
  dataLoadedCount: number; // NEW: Track how many pools have data loaded
}

const PoolDataContext = createContext<PoolDataContextType | undefined>(undefined);

export function PoolDataProvider({ children }: { children: ReactNode }) {
  const [poolDataCache, setPoolDataCache] = useState<Record<number, PoolData>>({});
  const [dataLoadedCount, setDataLoadedCount] = useState(0);

  const getPoolData = useCallback((poolId: number) => {
    const data = poolDataCache[poolId] || null;
    console.log(`🔍 getPoolData(${poolId}):`, data ? 'FOUND' : 'NULL', '| Available keys:', Object.keys(poolDataCache));
    return data;
  }, [poolDataCache]);

  const setPoolData = useCallback((poolId: number, data: PoolData) => {
    console.log(`📥 setPoolData(${poolId}) - Storing data`);
    setPoolDataCache(prev => {
      const isNewData = !prev[poolId];
      const updated = {
        ...prev,
        [poolId]: data
      };
      
      console.log(`✅ Pool data stored. Keys now:`, Object.keys(updated));
      
      // Update count if this is new data
      if (isNewData) {
        setDataLoadedCount(Object.keys(updated).length);
      }
      
      return updated;
    });
  }, []);

  const clearPoolData = useCallback((poolId: number) => {
    setPoolDataCache(prev => {
      const { [poolId]: removed, ...rest } = prev;
      setDataLoadedCount(Object.keys(rest).length);
      return rest;
    });
  }, []);

  const hasData = useCallback((poolId: number) => {
    return poolId in poolDataCache;
  }, [poolDataCache]);

  return (
    <PoolDataContext.Provider value={{ 
      getPoolData, 
      setPoolData, 
      clearPoolData,
      hasData,
      dataLoadedCount 
    }}>
      {children}
    </PoolDataContext.Provider>
  );
}

export function usePoolData() {
  const context = useContext(PoolDataContext);
  if (!context) {
    throw new Error('usePoolData must be used within PoolDataProvider');
  }
  return context;
}