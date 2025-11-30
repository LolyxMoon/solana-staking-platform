"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useToast } from "@/components/ToastContainer";
import { ActivityListSkeleton, LoadingSpinner } from "@/components/SkeletonLoaders";
import { 
  Search, 
  Filter, 
  X, 
  Download, 
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Gift,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Wallet
} from "lucide-react";

type Activity = {
  id: string;
  type: "stake" | "unstake" | "claim" | "compound";
  pool: {
    name: string;
    symbol: string;
    logo?: string | null;
  };
  amount: number;
  txHash: string;
  status: "pending" | "completed" | "failed";
  timestamp: string;
  gasFee?: number;
  rewards?: number;
};

export default function HistoryPage() {
  const { publicKey, connected } = useWallet();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | Activity["type"]>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | Activity["status"]>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const { showSuccess, showInfo, showError } = useToast();

  // Fetch user-specific activity data
  useEffect(() => {
    async function fetchUserActivity() {
      // If wallet not connected, show empty state
      if (!connected || !publicKey) {
        setLoading(false);
        setActivities([]);
        return;
      }

      setLoading(true);
      try {
        // Fetch activities for this specific user's wallet
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL}/api/activity/${publicKey.toString()}`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch activity");
        }

        const data = await response.json();
        
        // Ensure data is an array and sort by timestamp (newest first)
        const sortedData = Array.isArray(data) 
          ? data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          : [];
        
        setActivities(sortedData);
      } catch (error) {
        console.error("Error fetching user activity:", error);
        showError("Failed to load activity history");
        setActivities([]);
      } finally {
        setLoading(false);
      }
    }

    fetchUserActivity();
  }, [publicKey, connected, showError]);

  // Filter activities
  const filteredActivities = activities.filter((activity) => {
    if (filterType !== "all" && activity.type !== filterType) return false;
    if (filterStatus !== "all" && activity.status !== filterStatus) return false;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesPool = activity.pool.name.toLowerCase().includes(query) || 
                          activity.pool.symbol.toLowerCase().includes(query);
      const matchesTx = activity.txHash.toLowerCase().includes(query);
      if (!matchesPool && !matchesTx) return false;
    }
    
    const activityDate = new Date(activity.timestamp);
    if (dateFrom && activityDate < new Date(dateFrom)) return false;
    if (dateTo && activityDate > new Date(dateTo)) return false;
    
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredActivities.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedActivities = filteredActivities.slice(startIndex, startIndex + itemsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType, filterStatus, dateFrom, dateTo]);

  // Clear filters
  const clearFilters = () => {
    setSearchQuery("");
    setFilterType("all");
    setFilterStatus("all");
    setDateFrom("");
    setDateTo("");
    showInfo("Filters cleared!");
  };

  const hasActiveFilters = filterType !== "all" || filterStatus !== "all" || dateFrom !== "" || dateTo !== "" || searchQuery !== "";

  // Export to CSV
  const exportToCSV = () => {
    setIsExporting(true);
    
    setTimeout(() => {
      const headers = ["Date", "Type", "Pool", "Amount", "Status", "TX Hash", "Gas Fee", "Rewards"];
      const rows = filteredActivities.map(a => [
        new Date(a.timestamp).toLocaleString(),
        a.type.toUpperCase(),
        `${a.pool.name} (${a.pool.symbol})`,
        a.amount,
        a.status.toUpperCase(),
        a.txHash,
        a.gasFee || 0,
        a.rewards || 0
      ]);
      
      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.join(","))
      ].join("\n");
      
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `activity-history-${publicKey?.toString().slice(0, 8)}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      
      setIsExporting(false);
      showSuccess(`Exported ${filteredActivities.length} activities to CSV!`);
    }, 1000);
  };

  // Activity type icons & colors
  const getActivityIcon = (type: Activity["type"]) => {
    switch (type) {
      case "stake": return <ArrowDownRight className="w-5 h-5" />;
      case "unstake": return <ArrowUpRight className="w-5 h-5" />;
      case "claim": return <Gift className="w-5 h-5" />;
      case "compound": return <Clock className="w-5 h-5" />;
    }
  };

  const getActivityColor = (type: Activity["type"]) => {
    switch (type) {
      case "stake": return "bg-green-600/20 text-green-400 border-green-600/30";
      case "unstake": return "bg-red-600/20 text-red-400 border-red-600/30";
      case "claim": return "bg-blue-600/20 text-blue-400 border-blue-600/30";
      case "compound": return "bg-purple-600/20 text-purple-400 border-purple-600/30";
    }
  };

  const getStatusIcon = (status: Activity["status"]) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case "pending": return <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />;
      case "failed": return <XCircle className="w-4 h-4 text-red-400" />;
    }
  };

  const getStatusColor = (status: Activity["status"]) => {
    switch (status) {
      case "completed": return "text-green-400";
      case "pending": return "text-yellow-400";
      case "failed": return "text-red-400";
    }
  };

  // Group activities by date
  const groupByDate = (activities: Activity[]) => {
    const groups: { [key: string]: Activity[] } = {};
    
    activities.forEach(activity => {
      const date = new Date(activity.timestamp).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
      });
      
      if (!groups[date]) groups[date] = [];
      groups[date].push(activity);
    });
    
    return groups;
  };

  const groupedActivities = groupByDate(paginatedActivities);

  // Loading state
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <div className="h-10 w-64 bg-white/[0.05] rounded animate-pulse" />
          <div className="h-5 w-48 bg-white/[0.05] rounded animate-pulse" />
        </div>
        
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-6">
          <div className="h-10 w-full bg-white/[0.05] rounded animate-pulse mb-4" />
        </div>
        
        <ActivityListSkeleton count={8} />
      </div>
    );
  }

  // Not connected state
  if (!connected) {
    return (
      <div className="p-6">
        <h1 
          className="text-3xl font-bold mb-2"
          style={{ background: 'linear-gradient(45deg, white, #fb57ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
        >
          Activity History
        </h1>
        <p className="text-gray-500 mb-8">View your complete transaction history</p>
        
        <div className="text-center py-20 bg-white/[0.02] border border-white/[0.05] rounded-xl">
          <Wallet className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h2>
          <p className="text-gray-400 mb-6">
            Please connect your wallet to view your activity history
          </p>
          <p className="text-sm text-gray-500">
            Your transaction history is tied to your wallet address
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 
            className="text-3xl font-bold mb-2"
            style={{ background: 'linear-gradient(45deg, white, #fb57ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
          >
            Activity History
          </h1>
          <p className="text-gray-500">
            Showing <span className="font-semibold" style={{ color: '#fb57ff' }}>{filteredActivities.length}</span> of{" "}
            <span className="font-semibold" style={{ color: '#fb57ff' }}>{activities.length}</span> transactions
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Wallet: {publicKey?.toString().slice(0, 4)}...{publicKey?.toString().slice(-4)}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.05] rounded-lg transition-all hover:scale-105"
          >
            <Filter className="w-5 h-5" />
            {showFilters ? "Hide Filters" : "Show Filters"}
          </button>

          <button
            onClick={exportToCSV}
            disabled={isExporting || filteredActivities.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
          >
            {isExporting ? (
              <>
                <LoadingSpinner size="sm" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Export CSV
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filters Section */}
      {showFilters && (
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-6 space-y-4 animate-in slide-in-from-top duration-300">
          {/* Search Bar */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-2">
              <Search className="w-4 h-4" />
              Search
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by pool name, symbol, or transaction hash..."
                className="w-full bg-white/[0.05] text-white pl-10 pr-10 py-3 rounded-lg border border-white/[0.05] focus:outline-none transition-colors"
                style={{ borderColor: searchQuery ? 'rgba(251, 87, 255, 0.3)' : '' }}
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Filter Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Activity Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Activity Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full bg-white/[0.05] text-white px-3 py-2.5 rounded-lg border border-white/[0.05] focus:outline-none transition-colors"
              >
                <option value="all">All Types</option>
                <option value="stake">Stake</option>
                <option value="unstake">Unstake</option>
                <option value="claim">Claim</option>
                <option value="compound">Compound</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full bg-white/[0.05] text-white px-3 py-2.5 rounded-lg border border-white/[0.05] focus:outline-none transition-colors"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                From Date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full bg-white/[0.05] text-white px-3 py-2.5 rounded-lg border border-white/[0.05] focus:outline-none transition-colors"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                To Date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full bg-white/[0.05] text-white px-3 py-2.5 rounded-lg border border-white/[0.05] focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <div className="flex justify-end pt-2 border-t border-white/[0.05]">
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 text-red-400 rounded-lg font-semibold transition-all hover:scale-105"
              >
                <X className="w-4 h-4" />
                Clear Filters
              </button>
            </div>
          )}

          {/* Active Filters Summary */}
          {hasActiveFilters && (
            <div className="flex flex-wrap gap-2 pt-2">
              {searchQuery && (
                <span className="px-3 py-1 rounded-full text-sm flex items-center gap-1 border" style={{ background: 'rgba(251, 87, 255, 0.2)', borderColor: 'rgba(251, 87, 255, 0.5)', color: '#fb57ff' }}>
                  Search: "{searchQuery}"
                  <button onClick={() => setSearchQuery("")} className="hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filterType !== "all" && (
                <span className="px-3 py-1 rounded-full text-sm flex items-center gap-1 capitalize border" style={{ background: 'rgba(251, 87, 255, 0.2)', borderColor: 'rgba(251, 87, 255, 0.5)', color: '#fb57ff' }}>
                  Type: {filterType}
                  <button onClick={() => setFilterType("all")} className="hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filterStatus !== "all" && (
                <span className="px-3 py-1 rounded-full text-sm flex items-center gap-1 capitalize border" style={{ background: 'rgba(251, 87, 255, 0.2)', borderColor: 'rgba(251, 87, 255, 0.5)', color: '#fb57ff' }}>
                  Status: {filterStatus}
                  <button onClick={() => setFilterStatus("all")} className="hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {(dateFrom || dateTo) && (
                <span className="px-3 py-1 rounded-full text-sm flex items-center gap-1 border" style={{ background: 'rgba(251, 87, 255, 0.2)', borderColor: 'rgba(251, 87, 255, 0.5)', color: '#fb57ff' }}>
                  Date: {dateFrom || "Start"} - {dateTo || "End"}
                  <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Activity Timeline */}
      {filteredActivities.length === 0 ? (
        <div className="text-center py-16 animate-in zoom-in-95 duration-300">
          <div className="text-6xl mb-4">📜</div>
          <p className="text-xl text-gray-300 mb-2 font-semibold">No activities found</p>
          <p className="text-gray-500 mb-4">
            {hasActiveFilters 
              ? "Try adjusting your filters to see more results" 
              : activities.length === 0 
                ? "Start staking to see your transaction history here"
                : "Your transaction history will appear here"}
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-6 py-3 text-white rounded-lg font-semibold transition-all hover:scale-105"
              style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedActivities).map(([date, dayActivities]) => (
            <div key={date} className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-6 animate-in slide-in-from-bottom duration-300">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-white/[0.05]">
                <Calendar className="w-5 h-5" style={{ color: '#fb57ff' }} />
                <h2 className="text-lg font-bold text-white">{date}</h2>
                <span className="ml-auto text-sm text-gray-400">{dayActivities.length} transactions</span>
              </div>

              <div className="space-y-3">
                {dayActivities.map((activity, index) => (
                  <div
                    key={activity.id}
                    className="bg-white/[0.02] rounded-lg p-4 hover:bg-white/[0.04] transition-all border border-white/[0.05] animate-in slide-in-from-left duration-300"
                    style={{ animationDelay: `${index * 50}ms` }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(251, 87, 255, 0.3)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      {/* Icon & Type */}
                      <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${getActivityColor(activity.type)} min-w-fit`}>
                        {getActivityIcon(activity.type)}
                        <span className="font-semibold capitalize">{activity.type}</span>
                      </div>

                      {/* Pool Info */}
                      <div className="flex-1">
                        <p className="text-white font-semibold">{activity.pool.name}</p>
                        <p className="text-gray-400 text-sm">
                          {activity.amount.toLocaleString()} {activity.pool.symbol}
                          {activity.rewards && (
                            <span className="text-green-400 ml-2">
                              (+{activity.rewards} rewards)
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Status */}
                      <div className="flex items-center gap-2">
                        {getStatusIcon(activity.status)}
                        <span className={`text-sm font-semibold capitalize ${getStatusColor(activity.status)}`}>
                          {activity.status}
                        </span>
                      </div>

                      {/* Time & TX */}
                      <div className="text-right">
                        <p className="text-gray-400 text-sm">
                          {new Date(activity.timestamp).toLocaleTimeString()}
                        </p>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(activity.txHash);
                            showSuccess("Transaction hash copied!");
                          }}
                          className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1 ml-auto transition-colors"
                        >
                          {activity.txHash}
                          <ExternalLink className="w-3 h-3" />
                        </button>
                        {activity.gasFee && (
                          <p className="text-gray-500 text-xs mt-1">
                            Gas: {activity.gasFee} SOL
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {filteredActivities.length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Items per page */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Show</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white/[0.05] text-white px-3 py-1.5 rounded border border-white/[0.05] focus:outline-none text-sm"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-gray-400 text-sm">per page</span>
          </div>

          {/* Page info */}
          <div className="text-gray-400 text-sm">
            Page {currentPage} of {totalPages} ({filteredActivities.length} total)
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 bg-white/[0.05] hover:bg-white/[0.08] disabled:opacity-50 disabled:cursor-not-allowed rounded transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1 rounded transition-all ${
                      currentPage === pageNum
                        ? "text-white"
                        : "bg-white/[0.05] text-gray-400 hover:bg-white/[0.08]"
                    }`}
                    style={currentPage === pageNum ? { background: 'linear-gradient(45deg, black, #fb57ff)' } : {}}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 bg-white/[0.05] hover:bg-white/[0.08] disabled:opacity-50 disabled:cursor-not-allowed rounded transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}