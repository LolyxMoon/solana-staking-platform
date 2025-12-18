/**
 * StakePoint Helpdesk - Rate Limiting
 * Prevents brute force attacks and spam
 */

import { NextRequest, NextResponse } from 'next/server';

// In-memory store (use Redis in production for multi-instance)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  identifier: string;    // What to rate limit by
}

// Predefined limits for different endpoints
export const RATE_LIMITS = {
  // Login: 5 attempts per 15 minutes
  login: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    identifier: 'login'
  },
  // Message sending: 30 per minute
  messageSend: {
    windowMs: 60 * 1000,
    maxRequests: 30,
    identifier: 'message'
  },
  // Conversation creation: 5 per hour
  conversationCreate: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 5,
    identifier: 'conversation'
  },
  // General API: 100 per minute
  api: {
    windowMs: 60 * 1000,
    maxRequests: 100,
    identifier: 'api'
  }
};

/**
 * Get client identifier (IP + optional suffix)
 */
function getClientId(request: NextRequest, suffix: string = ''): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 
             request.headers.get('x-real-ip') || 
             'unknown';
  
  return `${ip}:${suffix}`;
}

/**
 * Check and update rate limit
 */
export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetIn: number } {
  const clientId = getClientId(request, config.identifier);
  const now = Date.now();
  
  // Clean up expired entries periodically
  if (Math.random() < 0.01) {
    cleanupExpired();
  }
  
  const existing = rateLimitStore.get(clientId);
  
  if (!existing || now > existing.resetAt) {
    // New window
    rateLimitStore.set(clientId, {
      count: 1,
      resetAt: now + config.windowMs
    });
    
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetIn: config.windowMs
    };
  }
  
  // Existing window
  if (existing.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: existing.resetAt - now
    };
  }
  
  existing.count++;
  
  return {
    allowed: true,
    remaining: config.maxRequests - existing.count,
    resetIn: existing.resetAt - now
  };
}

/**
 * Rate limit middleware
 */
export function rateLimit(
  request: NextRequest,
  config: RateLimitConfig
): NextResponse | null {
  const result = checkRateLimit(request, config);
  
  if (!result.allowed) {
    return NextResponse.json(
      { 
        error: 'Too many requests',
        retryAfter: Math.ceil(result.resetIn / 1000)
      },
      { 
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(result.resetIn / 1000)),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(result.resetIn / 1000))
        }
      }
    );
  }
  
  return null; // Allowed
}

/**
 * Clean up expired entries
 */
function cleanupExpired(): void {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Reset rate limit for a client (e.g., after successful login)
 */
export function resetRateLimit(request: NextRequest, identifier: string): void {
  const clientId = getClientId(request, identifier);
  rateLimitStore.delete(clientId);
}

/**
 * Block an IP temporarily (e.g., after suspicious activity)
 */
export function blockIP(request: NextRequest, durationMs: number = 60 * 60 * 1000): void {
  const clientId = getClientId(request, 'blocked');
  rateLimitStore.set(clientId, {
    count: 999999,
    resetAt: Date.now() + durationMs
  });
}

/**
 * Check if IP is blocked
 */
export function isIPBlocked(request: NextRequest): boolean {
  const clientId = getClientId(request, 'blocked');
  const existing = rateLimitStore.get(clientId);
  
  if (!existing) return false;
  if (Date.now() > existing.resetAt) {
    rateLimitStore.delete(clientId);
    return false;
  }
  
  return existing.count >= 999999;
}

export default {
  checkRateLimit,
  rateLimit,
  resetRateLimit,
  blockIP,
  isIPBlocked,
  RATE_LIMITS
};
