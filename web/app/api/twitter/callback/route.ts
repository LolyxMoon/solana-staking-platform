import { NextRequest, NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://stakepoint.app';

function getSupabase() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

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
    const { wallet, codeVerifier } = JSON.parse(
      Buffer.from(state, "base64url").toString()
    );

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

    const userResponse = await fetch("https://api.twitter.com/2/users/me", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userResponse.ok) {
      return NextResponse.redirect(`${APP_URL}/whale-club?error=user_fetch_failed`);
    }

    const userData = await userResponse.json();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const supabase = getSupabase();
    
    const { error: upsertError } = await supabase
      .from('whale_club_users')
      .upsert({
        wallet_address: wallet,
        twitter_id: userData.data.id,
        twitter_username: userData.data.username,
        twitter_access_token: tokens.access_token,
        twitter_refresh_token: tokens.refresh_token,
        twitter_token_expiry: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'wallet_address',
      });

    if (upsertError) {
      console.error("Database error:", upsertError);
      return NextResponse.redirect(`${APP_URL}/whale-club?error=database_error`);
    }

    return NextResponse.redirect(`${APP_URL}/whale-club?success=true`);
  } catch (error) {
    console.error("Callback error:", error);
    return NextResponse.redirect(`${APP_URL}/whale-club?error=callback_failed`);
  }
}