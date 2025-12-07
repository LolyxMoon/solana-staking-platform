import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const STAKEPOINT_TWITTER_ID = process.env.STAKEPOINT_TWITTER_ID!;

// Points per action
const POINTS = {
  LIKE: 1,
  RETWEET: 3,
  QUOTE: 5,
};

async function refreshTokenIfNeeded(user: any) {
  if (!user.twitterRefreshToken) return null;
  
  const now = new Date();
  const expiry = user.twitterTokenExpiry ? new Date(user.twitterTokenExpiry) : now;
  
  // Refresh if expires in less than 5 minutes
  if (expiry.getTime() - now.getTime() > 5 * 60 * 1000) {
    return user.twitterAccessToken;
  }

  try {
    const response = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: user.twitterRefreshToken,
      }),
    });

    if (!response.ok) {
      console.error("Token refresh failed");
      return null;
    }

    const tokens = await response.json();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.whaleClubUser.update({
      where: { id: user.id },
      data: {
        twitterAccessToken: tokens.access_token,
        twitterRefreshToken: tokens.refresh_token || user.twitterRefreshToken,
        twitterTokenExpiry: expiresAt,
      },
    });

    return tokens.access_token;
  } catch (error) {
    console.error("Token refresh error:", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { wallet } = await request.json();

    if (!wallet) {
      return NextResponse.json({ error: "Wallet required" }, { status: 400 });
    }

    const user = await prisma.whaleClubUser.findUnique({
      where: { walletAddress: wallet },
    });

    if (!user || !user.twitterId) {
      return NextResponse.json({ error: "Twitter not connected" }, { status: 400 });
    }

    const accessToken = await refreshTokenIfNeeded(user);
    if (!accessToken) {
      return NextResponse.json({ error: "Token expired, please reconnect" }, { status: 401 });
    }

    // Fetch user's liked tweets
    const likesResponse = await fetch(
      `https://api.twitter.com/2/users/${user.twitterId}/liked_tweets?max_results=100&tweet.fields=author_id`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    let likesCount = 0;
    if (likesResponse.ok) {
      const likesData = await likesResponse.json();
      if (likesData.data) {
        likesCount = likesData.data.filter(
          (tweet: any) => tweet.author_id === STAKEPOINT_TWITTER_ID
        ).length;
      }
    }

    // Fetch user's retweets (from their timeline)
    const tweetsResponse = await fetch(
      `https://api.twitter.com/2/users/${user.twitterId}/tweets?max_results=100&tweet.fields=referenced_tweets`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    let retweetsCount = 0;
    let quotesCount = 0;
    if (tweetsResponse.ok) {
      const tweetsData = await tweetsResponse.json();
      if (tweetsData.data) {
        for (const tweet of tweetsData.data) {
          if (tweet.referenced_tweets) {
            for (const ref of tweet.referenced_tweets) {
              // We need to check if the referenced tweet is from StakePoint
              // This is a simplified check - in production you might want to fetch each referenced tweet
              if (ref.type === "retweeted") {
                retweetsCount++;
              } else if (ref.type === "quoted") {
                quotesCount++;
              }
            }
          }
        }
      }
    }

    // Calculate total points
    const totalPoints =
      likesCount * POINTS.LIKE +
      retweetsCount * POINTS.RETWEET +
      quotesCount * POINTS.QUOTE;

    // Update user
    const updatedUser = await prisma.whaleClubUser.update({
      where: { walletAddress: wallet },
      data: {
        likesCount,
        retweetsCount,
        quotesCount,
        totalPoints,
        lastSyncedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      points: {
        likes: likesCount,
        retweets: retweetsCount,
        quotes: quotesCount,
        total: totalPoints,
      },
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}