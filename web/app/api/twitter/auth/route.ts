import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet");
  
  if (!wallet) {
    return NextResponse.json({ error: "Wallet required" }, { status: 400 });
  }

  // Generate PKCE code verifier and challenge
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  // Store code verifier in cookie for callback
  const state = Buffer.from(JSON.stringify({ wallet, codeVerifier })).toString("base64url");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.TWITTER_CLIENT_ID!,
    redirect_uri: process.env.TWITTER_REDIRECT_URI!,
    scope: "tweet.read users.read like.read offline.access",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const authUrl = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;

  return NextResponse.redirect(authUrl);
}