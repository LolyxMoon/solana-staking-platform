"use client";

import { useState } from 'react';

export default function DiagnosticPage() {
  const [loading, setLoading] = useState(false);
  const [debugData, setDebugData] = useState<any>(null);
  const [statsData, setStatsData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostic = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Running diagnostic...');

      // Fetch debug stakes
      const debugResponse = await fetch('/api/debug/stakes');
      const debugJson = await debugResponse.json();
      setDebugData(debugJson);
      console.log('Debug data:', debugJson);

      // Fetch stats
      const statsResponse = await fetch('/api/stats');
      const statsJson = await statsResponse.json();
      setStatsData(statsJson);
      console.log('Stats data:', statsJson);

    } catch (err: any) {
      setError(err.message);
      console.error('Diagnostic error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6 bg-gray-900">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h1 className="text-3xl font-bold text-white mb-2">🔍 Database Diagnostic</h1>
          <p className="text-gray-400">Check if stakes are syncing to the database</p>
          
          <button
            onClick={runDiagnostic}
            disabled={loading}
            className="mt-4 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Running Diagnostic...' : 'Run Diagnostic'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500 rounded-lg p-4">
            <h3 className="text-red-500 font-bold mb-2">Error</h3>
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Stats Summary */}
        {statsData && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">📊 Stats Summary</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-gray-400 text-sm">Total Stakers</div>
                <div className="text-2xl font-bold text-white">{statsData.totalStakers}</div>
              </div>
              
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-gray-400 text-sm">Total Stakes</div>
                <div className="text-2xl font-bold text-white">{statsData.totalStakes}</div>
              </div>
              
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-gray-400 text-sm">TVL (Tokens)</div>
                <div className="text-2xl font-bold text-white">
                  {statsData.totalValueLockedTokens?.toFixed(2) || '0'}
                </div>
              </div>
              
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-gray-400 text-sm">TVL (USD)</div>
                <div className="text-2xl font-bold text-green-400">
                  ${statsData.totalValueLockedUSD?.toFixed(2) || '0.00'}
                </div>
              </div>
            </div>

            {/* Raw JSON */}
            <details className="mt-4">
              <summary className="cursor-pointer text-purple-400 hover:text-purple-300">
                View Raw JSON
              </summary>
              <pre className="mt-2 bg-gray-900 p-4 rounded text-xs text-gray-300 overflow-x-auto">
                {JSON.stringify(statsData, null, 2)}
              </pre>
            </details>
          </div>
        )}

        {/* Stakes Detail */}
        {debugData && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">💾 Database Stakes</h2>
            
            {debugData.totalRecords === 0 ? (
              <div className="bg-yellow-500/10 border border-yellow-500 rounded-lg p-6 text-center">
                <div className="text-4xl mb-2">⚠️</div>
                <h3 className="text-yellow-500 font-bold text-lg mb-2">No Stakes Found in Database</h3>
                <p className="text-gray-400 mb-4">
                  This means the database sync is not working or no one has staked yet.
                </p>
                <div className="text-left bg-gray-900 rounded p-4 text-sm">
                  <p className="text-white font-semibold mb-2">Troubleshooting:</p>
                  <ol className="text-gray-400 space-y-1 list-decimal list-inside">
                    <li>Make sure you copied all the updated files</li>
                    <li>Check browser console when staking for sync logs</li>
                    <li>Make sure <code className="bg-gray-800 px-1 rounded">useStakingProgram.ts</code> has the database sync code</li>
                    <li>Make sure <code className="bg-gray-800 px-1 rounded">/api/stakes/upsert</code> endpoint exists</li>
                  </ol>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-green-400 mb-4">
                  ✅ Found {debugData.totalRecords} stake{debugData.totalRecords !== 1 ? 's' : ''} in database
                </div>

                {/* Stakes List */}
                <div className="space-y-3">
                  {debugData.stakes?.map((stake: any, index: number) => (
                    <div key={stake.id} className="bg-gray-700/50 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="text-purple-400 font-semibold">Stake #{index + 1}</div>
                        <div className="text-xs text-gray-400">ID: {stake.id}</div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-400">User:</span>
                          <div className="text-white font-mono text-xs mt-1 break-all">
                            {stake.userWallet}
                          </div>
                        </div>
                        
                        <div>
                          <span className="text-gray-400">Token:</span>
                          <div className="text-white font-mono text-xs mt-1 break-all">
                            {stake.tokenMint}
                          </div>
                        </div>
                        
                        <div>
                          <span className="text-gray-400">Pool ID:</span>
                          <div className="text-white">{stake.poolId}</div>
                        </div>
                        
                        <div>
                          <span className="text-gray-400">Amount (raw):</span>
                          <div className="text-white">{stake.amount}</div>
                        </div>
                        
                        <div>
                          <span className="text-gray-400">Amount (tokens):</span>
                          <div className="text-white">{(Number(stake.amount) / 1e9).toFixed(4)}</div>
                        </div>
                        
                        <div>
                          <span className="text-gray-400">Last Updated:</span>
                          <div className="text-white text-xs">
                            {new Date(stake.lastUpdated).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Raw JSON */}
                <details className="mt-4">
                  <summary className="cursor-pointer text-purple-400 hover:text-purple-300">
                    View Raw JSON
                  </summary>
                  <pre className="mt-2 bg-gray-900 p-4 rounded text-xs text-gray-300 overflow-x-auto">
                    {JSON.stringify(debugData, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-500/10 border border-blue-500 rounded-lg p-6">
          <h3 className="text-blue-400 font-bold mb-2">📖 How to Use</h3>
          <ol className="text-gray-300 space-y-2 list-decimal list-inside">
            <li>Click "Run Diagnostic" to check current database state</li>
            <li>Go stake some tokens on your pools page</li>
            <li>Come back here and click "Run Diagnostic" again</li>
            <li>You should see your stake appear!</li>
          </ol>
        </div>

      </div>
    </div>
  );
}