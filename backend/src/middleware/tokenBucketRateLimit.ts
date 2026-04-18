import { createHash } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { getRedisClient } from '../lib/redis';

type BucketState = {
  tokens: number;
  updatedAt: number;
};

type ConsumeResult = {
  allowed: boolean;
  remainingTokens: number;
  retryAfterMs: number;
  resetAfterMs: number;
};

type TokenBucketPolicy = {
  name: string;
  capacity: number;
  refillTokens: number;
  refillWindowMs: number;
  message: string;
  cost?: number;
  keyGenerator?: (req: Request) => string;
};

const redisScript = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local refillRate = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])
local ttl = tonumber(ARGV[5])

local bucket = redis.call('HMGET', key, 'tokens', 'updatedAt')
local tokens = tonumber(bucket[1])
local updatedAt = tonumber(bucket[2])

if tokens == nil then
  tokens = capacity
  updatedAt = now
end

local elapsed = math.max(0, now - updatedAt)
tokens = math.min(capacity, tokens + (elapsed * refillRate))

local allowed = 0
if tokens >= requested then
  allowed = 1
  tokens = tokens - requested
end

redis.call('HMSET', key, 'tokens', tokens, 'updatedAt', now)
redis.call('PEXPIRE', key, ttl)

local retryAfterMs = 0
if allowed == 0 then
  retryAfterMs = math.ceil(math.max(0, requested - tokens) / refillRate)
end

local resetAfterMs = math.ceil(math.max(0, capacity - tokens) / refillRate)

return { allowed, tokens, retryAfterMs, resetAfterMs }
`;

const memoryBuckets = new Map<string, BucketState>();

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function getClientIdentifier(req: Request): string {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.length > 0) {
    return `token:${hashValue(authHeader)}`;
  }

  return req.ip || req.socket.remoteAddress || 'unknown';
}

function getAuthAttemptIdentifier(req: Request): string {
  const body = req.body as { email?: string } | undefined;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return email ? `${ip}:email:${hashValue(email)}` : ip;
}

function consumeFromMemoryBucket(
  key: string,
  now: number,
  capacity: number,
  refillRate: number,
  requestedTokens: number,
  ttlMs: number
): ConsumeResult {
  const current = memoryBuckets.get(key);
  const state = current ?? { tokens: capacity, updatedAt: now };
  const elapsed = Math.max(0, now - state.updatedAt);
  const replenishedTokens = Math.min(capacity, state.tokens + elapsed * refillRate);
  const allowed = replenishedTokens >= requestedTokens;
  const remainingTokens = allowed ? replenishedTokens - requestedTokens : replenishedTokens;
  const nextState = { tokens: remainingTokens, updatedAt: now };

  memoryBuckets.set(key, nextState);
  setTimeout(() => {
    const latest = memoryBuckets.get(key);
    if (latest?.updatedAt === now) {
      memoryBuckets.delete(key);
    }
  }, ttlMs).unref();

  const retryAfterMs = allowed
    ? 0
    : Math.ceil(Math.max(0, requestedTokens - remainingTokens) / refillRate);

  const resetAfterMs = Math.ceil(Math.max(0, capacity - remainingTokens) / refillRate);

  return {
    allowed,
    remainingTokens,
    retryAfterMs,
    resetAfterMs,
  };
}

async function consumeTokenBucket(
  bucketKey: string,
  now: number,
  capacity: number,
  refillRate: number,
  requestedTokens: number,
  ttlMs: number
): Promise<ConsumeResult> {
  const redisClient = await getRedisClient();

  if (!redisClient) {
    return consumeFromMemoryBucket(
      bucketKey,
      now,
      capacity,
      refillRate,
      requestedTokens,
      ttlMs
    );
  }

  try {
    const result = (await redisClient.eval(redisScript, {
      keys: [bucketKey],
      arguments: [
        String(now),
        String(capacity),
        String(refillRate),
        String(requestedTokens),
        String(ttlMs),
      ],
    })) as [number, number, number, number];

    return {
      allowed: Number(result[0]) === 1,
      remainingTokens: Math.max(0, Number(result[1])),
      retryAfterMs: Math.max(0, Number(result[2])),
      resetAfterMs: Math.max(0, Number(result[3])),
    };
  } catch (error) {
    console.error('Redis token-bucket eval failed, using in-memory fallback:', error);
    return consumeFromMemoryBucket(
      bucketKey,
      now,
      capacity,
      refillRate,
      requestedTokens,
      ttlMs
    );
  }
}

function setRateLimitHeaders(
  res: Response,
  policy: TokenBucketPolicy,
  remainingTokens: number,
  resetAfterMs: number
): void {
  res.setHeader('RateLimit-Policy', `${policy.capacity};w=${Math.ceil(policy.refillWindowMs / 1000)}`);
  res.setHeader('RateLimit-Limit', policy.capacity.toString());
  res.setHeader('RateLimit-Remaining', Math.max(0, Math.floor(remainingTokens)).toString());
  res.setHeader('RateLimit-Reset', Math.ceil(resetAfterMs / 1000).toString());
}

/** Create a reusable token-bucket limiter with Redis-backed state and in-memory fallback. */
export function createTokenBucketLimiter(policy: TokenBucketPolicy) {
  const refillRate = policy.refillTokens / policy.refillWindowMs;
  const requestedTokens = policy.cost ?? 1;
  const keyGenerator = policy.keyGenerator ?? getClientIdentifier;
  const ttlMs = Math.ceil(policy.refillWindowMs * 2);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = `${policy.name}:${keyGenerator(req)}`;
    const now = Date.now();

    try {
      const result = await consumeTokenBucket(
        key,
        now,
        policy.capacity,
        refillRate,
        requestedTokens,
        ttlMs
      );

      setRateLimitHeaders(res, policy, result.remainingTokens, result.resetAfterMs);

      if (!result.allowed) {
        res.setHeader('Retry-After', Math.max(1, Math.ceil(result.retryAfterMs / 1000)).toString());
        res.status(429).json({
          message: policy.message,
          retryAfterMs: result.retryAfterMs,
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Token-bucket limiter error:', error);
      next();
    }
  };
}

export const rateLimitKeyGenerators = {
  byClient: getClientIdentifier,
  authAttempt: getAuthAttemptIdentifier,
};
