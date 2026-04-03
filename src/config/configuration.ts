export default () => ({
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT as string, 10) || 4000,
    apiPrefix: process.env.API_PREFIX || 'api/v1',
  },

  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT as string, 10) || 5432,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    url: process.env.DATABASE_URL, // connection string — takes priority if set
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRATION || '1800s',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRATION || '1d',
  },

  breet: {
    apiUrl: process.env.BREET_API_URL || 'https://api.breet.com/v1',
    apiKey: process.env.BREET_API_KEY,
    secretKey: process.env.BREET_SECRET_KEY,
    webhookSecret: process.env.BREET_WEBHOOK_SECRET,
  },

  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY,
    publicKey: process.env.PAYSTACK_PUBLIC_KEY,
    testSecretKey: process.env.PAYSTACK_TEST_SECRET_KEY,
    testPublicKey: process.env.PAYSTACK_TEST_PUBLIC_KEY,
    webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET,
  },

  kora: {
    secretKey: process.env.KORA_SECRET_KEY,
    publicKey: process.env.KORA_PUBLIC_KEY,
    testSecretKey: process.env.KORA_TEST_SECRET_KEY,
    testPublicKey: process.env.KORA_TEST_PUBLIC_KEY,
    encryptionKey: process.env.KORA_ENCRYPTION_KEY,
    testEncryptionKey: process.env.KORA_TEST_ENCRYPTION_KEY,
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT as string, 10) || 6379,
    password: process.env.REDIS_PASSWORD,
  },

  webhook: {
    retryAttempts:
      parseInt(process.env.WEBHOOK_RETRY_ATTEMPTS as string, 10) || 3,
    retryDelayMs:
      parseInt(process.env.WEBHOOK_RETRY_DELAY_MS as string, 10) || 5000,
  },

  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:5173',
  },
});
