"use client";

// Base Skeleton Component
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 rounded ${className}`}
    />
  );
}

// Pool Card Skeleton (for pools page)
export function PoolCardSkeleton() {
  return (
    <div className="bg-slate-900/50 backdrop-blur border border-slate-700 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="w-16 h-16 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-10 w-24 rounded-lg" />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-6 w-24" />
        </div>
      </div>
      
      <div className="flex gap-2">
        <Skeleton className="h-10 flex-1 rounded-lg" />
        <Skeleton className="h-10 flex-1 rounded-lg" />
      </div>
    </div>
  );
}

// Dashboard Stats Skeleton
export function DashboardStatsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-slate-900 rounded-xl p-6">
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

// Featured Pool Skeleton
export function FeaturedPoolSkeleton() {
  return (
    <div className="bg-black/30 p-2 rounded-lg">
      <Skeleton className="h-3 w-8 mb-2" />
      <div className="flex items-center justify-between mb-2">
        <div className="space-y-1">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="w-16 h-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-24" />
    </div>
  );
}

// Activity List Skeleton
export function ActivityListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex justify-between items-center border-b border-gray-700 pb-2">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

// Chart Skeleton
export function ChartSkeleton() {
  return (
    <div className="flex items-center justify-center h-[300px]">
      <div className="relative">
        <Skeleton className="w-48 h-48 rounded-full" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Skeleton className="w-24 h-24 rounded-full" />
        </div>
      </div>
    </div>
  );
}

// Generic Loading Spinner
export function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12"
  };

  return (
    <div className="flex items-center justify-center">
      <div className={`${sizes[size]} border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin`} />
    </div>
  );
}

// Full Page Loader
export function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <LoadingSpinner size="lg" />
        <p className="text-gray-400">Loading...</p>
      </div>
    </div>
  );
}