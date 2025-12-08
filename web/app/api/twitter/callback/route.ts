import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://stakepoint.app';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${APP_URL}/whale-club?error=${error}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${APP_URL}/whale-club?error=missing_params`);
  }

  try {
    // Decode state to get wallet and code verifier
    const { wallet, codeVerifier } = JSON.parse(
      Buffer.from(state, "base64url").toString()
    );

    // Exchange code for tokens
    const tokenResponse = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        redirect_uri: process.env.TWITTER_REDIRECT_URI || `${APP_URL}/api/twitter/callback`,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token exchange failed:", errorData);
      return NextResponse.redirect(`${APP_URL}/whale-club?error=token_exchange_failed`);
    }

    const tokens = await tokenResponse.json();

    // Get user info from Twitter
    const userResponse = await fetch("https://api.twitter.com/2/users/me", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userResponse.ok) {
      return NextResponse.redirect(`${APP_URL}/whale-club?error=user_fetch_failed`);
    }

    const userData = await userResponse.json();

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Upsert user in database
    await prisma.whaleClubUser.upsert({
      where: { walletAddress: wallet },
      update: {
        twitterId: userData.data.id,
        twitterUsername: userData.data.username,
        twitterAccessToken: tokens.access_token,
        twitterRefreshToken: tokens.refresh_token,
        twitterTokenExpiry: expiresAt,
        updatedAt: new Date(),
      },
      create: {
        walletAddress: wallet,
        twitterId: userData.data.id,
        twitterUsername: userData.data.username,
        twitterAccessToken: tokens.access_token,
        twitterRefreshToken: tokens.refresh_token,
        twitterTokenExpiry: expiresAt,
      },
    });

    return NextResponse.redirect(`${APP_URL}/whale-club?success=true`);
  } catch (error) {
    console.error("Callback error:", error);
    return NextResponse.redirect(`${APP_URL}/whale-club?error=callback_failed`);
  }
}