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

    const clientId = process.env.TWITTER_CLIENT_ID;
    const clientSecret = process.env.TWITTER_CLIENT_SECRET;
    const redirectUri = process.env.TWITTER_REDIRECT_URI || `${APP_URL}/api/twitter/callback`;

    console.log('=== TWITTER DEBUG ===');
    console.log('Client ID:', clientId);
    console.log('Redirect URI:', redirectUri);
    console.log('Code length:', code.length);
    console.log('Code verifier:', codeVerifier);

    // Try with Basic auth header
    const credentials = `${clientId}:${clientSecret}`;
    const base64Credentials = Buffer.from(credentials).toString('base64');
    
    console.log('Credentials string length:', credentials.length);
    console.log('Base64 auth:', base64Credentials.slice(0, 20) + '...');

    const tokenResponse = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${base64Credentials}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    const responseText = await tokenResponse.text();

    if (!tokenResponse.ok) {
      return NextResponse.redirect(`${APP_URL}/whale-club?error=token_exchange_failed`);
    }

    const tokens = JSON.parse(responseText);

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