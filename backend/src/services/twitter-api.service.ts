/**
 * TwitterAPI.io Client Service
 * 
 * Fetches Twitter user profiles and tweet data using TwitterAPI.io
 * Reusing the same API that DevPrint uses for tweet enrichment
 * 
 * Requires: TWITTER_API_KEY environment variable
 */

interface TwitterUser {
  userName: string;
  name: string;
  profilePicture?: string;
  followers?: number;
  isBlueVerified?: boolean;
  location?: string;
  description?: string;
  createdAt?: string;
}

interface Tweet {
  id: string;
  url?: string;
  twitterUrl?: string;
  text: string;
  author: TwitterUser;
  createdAt?: string;
  likeCount?: number;
  retweetCount?: number;
  replyCount?: number;
  quoteCount?: number;
  viewCount?: number;
}

interface TwitterAPIResponse {
  tweets?: Tweet[];
  status?: string;
  message?: string;
}

export class TwitterAPIService {
  private apiKey: string;
  private baseUrl = 'https://api.twitterapi.io';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  static fromEnv(): TwitterAPIService {
    const apiKey = process.env.TWITTER_API_KEY;
    if (!apiKey) {
      throw new Error('TWITTER_API_KEY not set in environment');
    }
    return new TwitterAPIService(apiKey);
  }

  /**
   * Extract tweet ID from Twitter URL
   * Examples:
   * - https://x.com/username/status/1234567890
   * - https://twitter.com/username/status/1234567890
   */
  static extractTweetId(url: string): string | null {
    const match = url.match(/\/status\/(\d+)/);
    return match ? match[1] : null;
  }

  /**
   * Extract username from Twitter URL
   * Examples:
   * - https://x.com/username
   * - https://twitter.com/username
   * - @username
   */
  static extractUsername(url: string): string | null {
    // Handle @username format
    if (url.startsWith('@')) {
      return url.slice(1);
    }

    // Handle full URLs
    const match = url.match(/(?:x\.com|twitter\.com)\/([^/]+)/);
    return match ? match[1] : null;
  }

  /**
   * Fetch tweet content by ID
   */
  async fetchTweet(tweetId: string): Promise<Tweet> {
    const url = `${this.baseUrl}/twitter/tweets`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
      },
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`TwitterAPI.io error (${response.status}): ${body}`);
    }

    const data: TwitterAPIResponse = await response.json();

    if (data.status !== 'success') {
      throw new Error(`TwitterAPI.io error: ${data.message || 'Unknown error'}`);
    }

    const tweet = data.tweets?.[0];
    if (!tweet) {
      throw new Error(`No tweet found for ID: ${tweetId}`);
    }

    return tweet;
  }

  /**
   * Fetch tweet by URL
   */
  async fetchTweetByUrl(url: string): Promise<Tweet> {
    const tweetId = TwitterAPIService.extractTweetId(url);
    if (!tweetId) {
      throw new Error(`Invalid Twitter URL: ${url}`);
    }
    return this.fetchTweet(tweetId);
  }

  /**
   * Fetch Twitter user profile by username
   * 
   * This fetches a user's latest tweet to get their profile info
   * since TwitterAPI.io includes author metadata in tweet responses
   */
  async fetchUserProfile(username: string): Promise<TwitterUser> {
    const url = `${this.baseUrl}/twitter/user/tweets`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
      },
      // Remove @ if present
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`TwitterAPI.io user fetch error (${response.status}): ${body}`);
    }

    const data: TwitterAPIResponse = await response.json();

    if (data.status !== 'success') {
      throw new Error(`TwitterAPI.io error: ${data.message || 'Unknown error'}`);
    }

    // Extract author from first tweet
    const tweet = data.tweets?.[0];
    if (!tweet?.author) {
      throw new Error(`No profile found for username: ${username}`);
    }

    return tweet.author;
  }

  /**
   * Search recent tweets (for Mindshare/Narrative analysis)
   */
  async searchRecent(query: string, limit: number = 20): Promise<Tweet[]> {
    const encoded = encodeURIComponent(query);
    const url = `${this.baseUrl}/twitter/tweets/recent?query=${encoded}&limit=${limit}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey,
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        // Fallback: If 404/403, just return empty (don't break observer flow)
        console.warn(`Twitter Search failed (${response.status}) for query: ${query}`);
        return [];
      }

      const data: TwitterAPIResponse = await response.json();
      return data.tweets || [];
    } catch (error) {
      console.warn('Twitter Search Exception:', error);
      return [];
    }
  }

  /**
   * Verify tweet contains expected text
   * Used for Twitter verification flow
   */
  async verifyTweetContains(tweetId: string, expectedText: string): Promise<{
    verified: boolean;
    tweet?: Tweet;
    error?: string;
  }> {
    try {
      const tweet = await this.fetchTweet(tweetId);

      const verified = tweet.text.includes(expectedText);

      return {
        verified,
        tweet,
        error: verified ? undefined : 'Tweet does not contain expected text',
      };
    } catch (error: any) {
      return {
        verified: false,
        error: error.message,
      };
    }
  }
}

// Singleton instance
let twitterAPIInstance: TwitterAPIService | null = null;

export function getTwitterAPI(): TwitterAPIService {
  if (!twitterAPIInstance) {
    try {
      twitterAPIInstance = TwitterAPIService.fromEnv();
    } catch (error) {
      // If TWITTER_API_KEY not set, return a dummy instance that throws on use
      console.warn('⚠️ TWITTER_API_KEY not set - Twitter API features disabled');
      throw new Error('Twitter API not configured. Set TWITTER_API_KEY environment variable.');
    }
  }
  return twitterAPIInstance;
}

// Export types
export type { TwitterUser, Tweet };
