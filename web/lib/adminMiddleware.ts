import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

// ====================================================================
// JWT VERIFICATION MIDDLEWARE
// This runs on the server for EVERY admin API request
// ====================================================================

interface JWTPayload {
  wallet: string;
  iat: number;
  exp: number;
}

interface VerificationResult {
  isValid: boolean;
  wallet?: string;
  error?: string;
}

/**
 * Verifies JWT token from Authorization header
 * Checks if wallet is in the admin list from environment variable
 * 
 * @param request - The incoming Next.js request
 * @returns Object with isValid boolean, wallet address if valid, or error message
 */
export async function verifyAdminToken(
  request: NextRequest | Request
): Promise<VerificationResult> {
  try {
    // 1️⃣ Extract token from Authorization header
    const authHeader = request.headers.get("authorization");
    
    if (!authHeader) {
      return {
        isValid: false,
        error: "No authorization header provided",
      };
    }

    // Expected format: "Bearer <token>"
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return {
        isValid: false,
        error: "Invalid authorization header format. Expected: Bearer <token>",
      };
    }

    const token = parts[1];

    // 2️⃣ Get JWT secret from environment
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error("❌ JWT_SECRET not configured in environment");
      return {
        isValid: false,
        error: "Server configuration error",
      };
    }

    // 3️⃣ Verify JWT token
    let payload: JWTPayload;
    try {
      payload = jwt.verify(token, jwtSecret) as JWTPayload;
    } catch (err: any) {
      if (err.name === "TokenExpiredError") {
        return {
          isValid: false,
          error: "Token expired. Please sign in again.",
        };
      }
      if (err.name === "JsonWebTokenError") {
        return {
          isValid: false,
          error: "Invalid token",
        };
      }
      throw err; // Re-throw unexpected errors
    }

    // 4️⃣ Get admin wallet list from environment
    const adminWallets = process.env.ADMIN_WALLETS?.split(",").map((w) =>
      w.trim()
    );

    if (!adminWallets || adminWallets.length === 0) {
      console.error("❌ ADMIN_WALLETS not configured in environment");
      return {
        isValid: false,
        error: "Server configuration error",
      };
    }

    // 5️⃣ Check if wallet is in admin list
    if (!adminWallets.includes(payload.wallet)) {
      console.warn(
        `⚠️ Unauthorized access attempt by wallet: ${payload.wallet}`
      );
      return {
        isValid: false,
        error: "Wallet not authorized",
      };
    }

    // ✅ All checks passed
    return {
      isValid: true,
      wallet: payload.wallet,
    };
  } catch (error) {
    console.error("❌ Token verification error:", error);
    return {
      isValid: false,
      error: "Token verification failed",
    };
  }
}

/**
 * Alternative helper for API routes that need to return early on auth failure
 * 
 * @example
 * const admin = await requireAdmin(request);
 * if (!admin) {
 *   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 * }
 * // Continue with authenticated request...
 */
export async function requireAdmin(
  request: NextRequest | Request
): Promise<string | null> {
  const result = await verifyAdminToken(request);
  if (!result.isValid) {
    return null;
  }
  return result.wallet!;
}
