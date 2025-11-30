// Use window object to ensure single instance across all components
if (typeof window !== 'undefined') {
  (window as any).globalPoolData = (window as any).globalPoolData || {};
}

export function setGlobalPoolData(poolId: number, data: any) {
  if (typeof window === 'undefined') return;
  
  console.log(`[GLOBAL] Setting pool ${poolId}`, data);
  (window as any).globalPoolData[poolId] = data;
  console.log(`[GLOBAL] Keys now:`, Object.keys((window as any).globalPoolData));
}

export function getGlobalPoolData(poolId: number) {
  if (typeof window === 'undefined') return null;
  
  const data = (window as any).globalPoolData[poolId] || null;
  console.log(`[GLOBAL] Getting pool ${poolId}:`, data ? 'FOUND' : 'NULL');
  return data;
}

export function getAllPoolKeys() {
  if (typeof window === 'undefined') return [];
  return Object.keys((window as any).globalPoolData);
}