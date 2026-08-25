const { randomUUID } = require('node:crypto');
const {
  RedisThrottlerStorage,
  ThrottlerAlgorithm,
} = require('@nestjs-redis/throttler-storage');
const { createClient } = require('redis');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6380';
const commandTimeout = Number(process.env.REDIS_COMMAND_TIMEOUT_MS) || 1_500;
const auditId = `officeflow:redis-smoke:${randomUUID()}`;
const cacheKey = `${auditId}:cache`;
const throttlerKeyPattern = `_throttler:{${auditId}}:smoke*`;

function createAuditClient() {
  return createClient({
    url: redisUrl,
    commandOptions: { timeout: commandTimeout },
    socket: {
      connectTimeout: 3_000,
      reconnectStrategy: false,
    },
  });
}

const firstClient = createAuditClient();
const secondClient = createAuditClient();

async function cleanup() {
  if (!firstClient.isReady) {
    return;
  }

  const keys = [cacheKey];

  for await (const batch of firstClient.scanIterator({
    MATCH: throttlerKeyPattern,
    COUNT: 100,
  })) {
    keys.push(...batch);
  }

  if (keys.length > 0) {
    await firstClient.del(keys);
  }
}

async function run() {
  await Promise.all([firstClient.connect(), secondClient.connect()]);
  await firstClient.set(cacheKey, JSON.stringify({ ok: true }), { EX: 30 });

  const cached = JSON.parse(await secondClient.get(cacheKey));
  const cacheTtl = await secondClient.ttl(cacheKey);
  const firstStorage = new RedisThrottlerStorage(
    firstClient,
    ThrottlerAlgorithm.SlidingWindowCounter,
  );
  const secondStorage = new RedisThrottlerStorage(
    secondClient,
    ThrottlerAlgorithm.SlidingWindowCounter,
  );
  const results = await Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      (index % 2 === 0 ? firstStorage : secondStorage).increment(
        auditId,
        60_000,
        5,
        60_000,
        'smoke',
      ),
    ),
  );
  const blockedRequests = results.filter((result) => result.isBlocked).length;

  if (!cached.ok || cacheTtl <= 0 || blockedRequests === 0) {
    throw new Error('Redis smoke test assertions failed');
  }

  console.log(
    JSON.stringify({
      cacheRoundTrip: true,
      cacheTtl,
      redisClients: 2,
      concurrentRequests: results.length,
      blockedRequests,
    }),
  );
}

run()
  .finally(async () => {
    try {
      await cleanup();
    } finally {
      for (const client of [firstClient, secondClient]) {
        if (client.isReady) {
          await client.quit();
        } else if (client.isOpen) {
          client.destroy();
        }
      }
    }
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
