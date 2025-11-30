"use client";

import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";

interface LockChartProps {
  createdAt: Date | string;
  unlockTime: Date | string;
}

export default function LockChart({ createdAt, unlockTime }: LockChartProps) {
  const [mounted, setMounted] = useState(false);
  const startDate = new Date(createdAt);
  const endDate = new Date(unlockTime);
  const [now, setNow] = useState<Date | null>(null);
  
  useEffect(() => {
    setMounted(true);
    setNow(new Date());
  }, []);

  const progress = useMemo(() => {
    if (!now) return 0;
    const total = endDate.getTime() - startDate.getTime();
    const elapsed = now.getTime() - startDate.getTime();
    return Math.min((elapsed / total) * 100, 100);
  }, [startDate, endDate, now]);

  const timePoints = useMemo(() => {
    if (!now) return [];
    const points = [];
    const total = endDate.getTime() - startDate.getTime();
    const segments = 10;

    for (let i = 0; i <= segments; i++) {
      const timestamp = startDate.getTime() + (total / segments) * i;
      const date = new Date(timestamp);
      const isPast = date <= now;

      points.push({
        date,
        label: format(date, "MMM dd"),
        progress: (i / segments) * 100,
        isPast,
      });
    }

    return points;
  }, [startDate, endDate, now]);

  const milestones = useMemo(() => {
    if (!now) return [];
    const total = endDate.getTime() - startDate.getTime();
    return [
      {
        label: "25%",
        progress: 25,
        date: new Date(startDate.getTime() + total * 0.25),
        isPast: now.getTime() >= startDate.getTime() + total * 0.25,
      },
      {
        label: "50%",
        progress: 50,
        date: new Date(startDate.getTime() + total * 0.5),
        isPast: now.getTime() >= startDate.getTime() + total * 0.5,
      },
      {
        label: "75%",
        progress: 75,
        date: new Date(startDate.getTime() + total * 0.75),
        isPast: now.getTime() >= startDate.getTime() + total * 0.75,
      },
    ];
  }, [startDate, endDate, now]);
  
  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        Loading chart...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Timeline */}
      <div className="relative">
        {/* Timeline bar */}
        <div className="relative h-3 bg-white/[0.05] rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#fb57ff] to-purple-600 transition-all duration-1000 ease-out"
            style={{ width: `${progress}%` }}
          >
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
          </div>
        </div>

        {/* Milestones */}
        {milestones.map((milestone) => (
          <div
            key={milestone.label}
            className="absolute top-1/2 -translate-y-1/2"
            style={{ left: `${milestone.progress}%` }}
          >
            <div
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center -ml-3 ${
                milestone.isPast
                  ? "bg-[#fb57ff] border-[#fb57ff]"
                  : "bg-[#0a0a0f] border-white/[0.2]"
              }`}
            >
              {milestone.isPast && (
                <svg
                  className="w-3 h-3 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </div>
            <div className="absolute top-8 left-1/2 -translate-x-1/2 text-center whitespace-nowrap">
              <p
                className={`text-xs font-medium mb-1 ${
                  milestone.isPast ? "text-[#fb57ff]" : "text-gray-500"
                }`}
              >
                {milestone.label}
              </p>
              <p className="text-xs text-gray-600">
                {format(milestone.date, "MMM dd")}
              </p>
            </div>
          </div>
        ))}

        {/* Current position indicator */}
        {progress < 100 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
            style={{ left: `${progress}%` }}
          >
            <div className="relative">
              <div className="w-4 h-4 rounded-full bg-white border-2 border-[#fb57ff] animate-pulse" />
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <div className="px-2 py-1 rounded bg-[#fb57ff] text-white text-xs font-medium">
                  {progress.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Start and End dates */}
      <div className="flex justify-between items-center pt-12">
        <div className="text-left">
          <p className="text-xs text-gray-500 mb-1">Lock Created</p>
          <p className="text-sm font-medium text-white">
            {format(startDate, "MMM dd, yyyy")}
          </p>
          <p className="text-xs text-gray-600">{format(startDate, "HH:mm")}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 mb-1">Unlock Time</p>
          <p className="text-sm font-medium text-green-400">
            {format(endDate, "MMM dd, yyyy")}
          </p>
          <p className="text-xs text-gray-600">{format(endDate, "HH:mm")}</p>
        </div>
      </div>

      {/* Visual Timeline Grid */}
      <div className="grid grid-cols-5 gap-2 pt-6">
        {timePoints.slice(0, 5).map((point, index) => (
          <div
            key={index}
            className={`h-20 rounded-lg border transition-all ${
              point.isPast
                ? "bg-[#fb57ff]/10 border-[#fb57ff]/30"
                : "bg-white/[0.02] border-white/[0.05]"
            }`}
          >
            <div className="h-full flex flex-col items-center justify-center">
              <div
                className={`w-2 h-2 rounded-full mb-2 ${
                  point.isPast ? "bg-[#fb57ff]" : "bg-gray-600"
                }`}
              />
              <p className={`text-xs ${point.isPast ? "text-[#fb57ff]" : "text-gray-500"}`}>
                {point.label}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

