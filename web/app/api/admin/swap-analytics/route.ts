// ✅ ENHANCED API ROUTE: app/api/admin/swap-analytics/route.ts
// This replaces your existing route with leaderboard functionality

import { NextResponse } from "next/server";
import { verifyAdminToken } from "@/lib/adminMiddleware";
import fs from "fs";
import path from "path";

const ANALYTICS_FILE = path.join(process.cwd(), "data", "swap-analytics.json");

// Ensure data directory exists
function ensureDataDirectory() {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Load analytics data
function loadAnalytics() {
  ensureDataDirectory();
  
  if (!fs.existsSync(ANALYTICS_FILE)) {
    const defaultData = {
      totalVolume: 0,
      totalSwaps: 0,
      uniqueUsers: 0,
      avgSwapSize: 0,
      recentSwaps: [],
      allSwaps: []
    };
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  
  const data = fs.readFileSync(ANALYTICS_FILE, "utf-8");
  return JSON.parse(data);
}

// Save analytics data
function saveAnalytics(data: any) {
  ensureDataDirectory();
  fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(data, null, 2));
}

// ✅ NEW: Calculate top traders by time period
function getTopTraders(swaps: any[], days: number) {
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
  
  // Filter swaps within time period
  const recentSwaps = swaps.filter(swap => {
    const swapDate = new Date(swap.timestamp);
    return swapDate >= cutoffDate;
  });
  
  // Aggregate volume by user
  const userVolumes: { [key: string]: number } = {};
  const userSwapCounts: { [key: string]: number } = {};
  
  recentSwaps.forEach(swap => {
    const user = swap.user;
    userVolumes[user] = (userVolumes[user] || 0) + swap.value;
    userSwapCounts[user] = (userSwapCounts[user] || 0) + 1;
  });
  
  // Convert to array and sort by volume
  const traders = Object.entries(userVolumes).map(([address, volume]) => ({
    address,
    volume,
    swapCount: userSwapCounts[address],
    avgSwapSize: volume / userSwapCounts[address]
  }));
  
  // Sort by volume descending and take top 10
  return traders
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 10);
}

// ✅ NEW: Get time period statistics
function getTimePeriodStats(swaps: any[], days: number) {
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
  
  const periodSwaps = swaps.filter(swap => {
    const swapDate = new Date(swap.timestamp);
    return swapDate >= cutoffDate;
  });
  
  const totalVolume = periodSwaps.reduce((sum, swap) => sum + swap.value, 0);
  const totalSwaps = periodSwaps.length;
  const uniqueUsers = new Set(periodSwaps.map(s => s.user)).size;
  const avgSwapSize = totalSwaps > 0 ? totalVolume / totalSwaps : 0;
  
  return {
    totalVolume,
    totalSwaps,
    uniqueUsers,
    avgSwapSize
  };
}

// GET: Fetch swap analytics with optional leaderboard
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const leaderboard = searchParams.get("leaderboard"); // "1d", "7d", "30d", or "all"
    
    const analytics = loadAnalytics();
    const allSwaps = analytics.allSwaps || [];
    
    // If leaderboard requested, return top traders
    if (leaderboard) {
      let days: number;
      let label: string;
      
      switch (leaderboard) {
        case "1d":
          days = 1;
          label = "24 Hours";
          break;
        case "7d":
          days = 7;
          label = "7 Days";
          break;
        case "30d":
          days = 30;
          label = "30 Days";
          break;
        case "all":
        default:
          days = 999999; // All time
          label = "All Time";
      }
      
      const topTraders = getTopTraders(allSwaps, days);
      const periodStats = getTimePeriodStats(allSwaps, days);
      
      return NextResponse.json({
        period: label,
        days: leaderboard === "all" ? "all" : days,
        stats: periodStats,
        topTraders,
        timestamp: new Date().toISOString()
      });
    }
    
    // Default: return general analytics
    return NextResponse.json({
      totalVolume: analytics.totalVolume || 0,
      totalSwaps: analytics.totalSwaps || 0,
      uniqueUsers: analytics.uniqueUsers || 0,
      avgSwapSize: analytics.avgSwapSize || 0,
      recentSwaps: analytics.recentSwaps?.slice(0, 10) || []
    });
  } catch (error: any) {
    console.error("Error fetching swap analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch swap analytics" },
      { status: 500 }
    );
  }
}

// POST: Record a new swap transaction
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      fromToken, 
      toToken, 
      fromAmount, 
      toAmount, 
      value, 
      user, 
      signature 
    } = body;

    const analytics = loadAnalytics();

    // Create new swap record
    const newSwap = {
      fromToken,
      toToken,
      fromAmount,
      toAmount,
      value,
      user,
      signature,
      timestamp: new Date().toISOString()
    };

    // Update analytics
    analytics.allSwaps = analytics.allSwaps || [];
    analytics.allSwaps.push(newSwap);
    analytics.recentSwaps = analytics.allSwaps.slice(-50); // Keep last 50
    
    analytics.totalSwaps = (analytics.totalSwaps || 0) + 1;
    analytics.totalVolume = (analytics.totalVolume || 0) + value;

    // Calculate unique users
    const uniqueUsersSet = new Set(analytics.allSwaps.map((s: any) => s.user));
    analytics.uniqueUsers = uniqueUsersSet.size;

    // Calculate average swap size
    analytics.avgSwapSize = analytics.totalVolume / analytics.totalSwaps;

    saveAnalytics(analytics);

    return NextResponse.json({ 
      success: true, 
      message: "Swap recorded successfully" 
    });
  } catch (error: any) {
    console.error("Error recording swap:", error);
    return NextResponse.json(
      { error: "Failed to record swap" },
      { status: 500 }
    );
  }
}

// DELETE: Reset analytics (admin only)
export async function DELETE(req: Request) {
  const authResult = await verifyAdminToken(req);
  if (!authResult.isValid) {
    return NextResponse.json({ error: authResult.error || "Unauthorized" }, { status: 401 });
  }

  try {
    const defaultData = {
      totalVolume: 0,
      totalSwaps: 0,
      uniqueUsers: 0,
      avgSwapSize: 0,
      recentSwaps: [],
      allSwaps: []
    };
    
    saveAnalytics(defaultData);
    
    return NextResponse.json({ 
      success: true, 
      message: "Analytics reset successfully" 
    });
  } catch (error: any) {
    console.error("Error resetting analytics:", error);
    return NextResponse.json(
      { error: "Failed to reset analytics" },
      { status: 500 }
    );
  }
}