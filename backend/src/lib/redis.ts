import { createClient, type RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;
let redisConnectPromise: Promise<RedisClientType | null> | null = null;
let connectionState: 'idle' | 'connected' | 'fallback' = 'idle';

function logStateOnce(nextState: 'connected' | 'fallback', message: string): void {
  if (connectionState === nextState) return;
  connectionState = nextState;
  console.log(message);
}

/** Connect to Redis once and reuse the shared client for token-bucket state. */
export async function getRedisClient(): Promise<RedisClientType | null> {
  if (redisClient?.isReady) {
    logStateOnce('connected', 'Redis connected for rate limiting');
    return redisClient;
  }

  if (redisConnectPromise) {
    return redisConnectPromise;
  }

  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    logStateOnce('fallback', 'REDIS_URL not set, using in-memory rate limiting fallback');
    return null;
  }

  redisClient = createClient({ url: redisUrl });
  redisClient.on('error', (error) => {
    console.error('Redis client error:', error);
  });

  redisConnectPromise = redisClient
    .connect()
    .then((client) => {
      logStateOnce('connected', 'Redis connected for rate limiting');
      return client;
    })
    .catch((error) => {
      console.error('Failed to connect to Redis, using in-memory rate limiting fallback:', error);
      redisClient = null;
      logStateOnce('fallback', 'Redis unavailable, using in-memory rate limiting fallback');
      return null;
    })
    .finally(() => {
      redisConnectPromise = null;
    });

  return redisConnectPromise;
}

/** Warm the Redis connection during server startup so first requests do not pay the connect cost. */
export async function primeRedisConnection(): Promise<void> {
  await getRedisClient();
}
