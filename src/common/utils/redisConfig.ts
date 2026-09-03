export const getRedisConfig = () => {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: Number(url.port),
      password: url.password || undefined,
      username: url.username || 'default',
      tls: url.protocol === 'rediss:' ? {} : undefined, // Upstash requires TLS
    };
  }

  // Local fallback
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT as string) || 6379,
  };
};
