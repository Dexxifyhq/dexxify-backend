export default () => ({
  app: {
    nodeEnv: process.env.NODE_ENV,
    port: parseInt(process.env.PORT as string, 10) || 4000,
    apiPrefix: process.env.API_PREFIX,
    pin: process.env.APP_PIN,
  },

  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT as string, 10) || 5432,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    pooler: process.env.DATABASE_POOLER,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRATION || '1800s',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRATION || '1d',
  },

  coincircuit: {
    apiUrl: process.env.COINCIRCUIT_API_URL || 'https://api.coincircuit.io',
    sandboxApiUrl:
      process.env.COINCIRCUIT_SANDBOX_API_URL ||
      'https://sandbox-api.coincircuit.io',
    apiKey: process.env.COINCIRCUIT_API_KEY,
    testApiKey: process.env.COINCIRCUIT_TEST_API_KEY,
    webhookSecret: process.env.COINCIRCUIT_WEBHOOK_SECRET,
    testWebhookSecret: process.env.COINCIRCUIT_TEST_WEBHOOK_SECRET,
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
    encryptionKey: process.env.KORA_ENCRYPTION_KEY,
    testSecretKey: process.env.KORA_TEST_SECRET_KEY,
    testPublicKey: process.env.KORA_TEST_PUBLIC_KEY,
    testEncryptionKey: process.env.KORA_TEST_ENCRYPTION_KEY,
  },

  redis: {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT as string, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },

  webhook: {
    testUrl: process.env.WEBHOOK_TEST_URL,
    retryAttempts:
      parseInt(process.env.WEBHOOK_RETRY_ATTEMPTS as string, 10) || 3,
    retryDelayMs:
      parseInt(process.env.WEBHOOK_RETRY_DELAY_MS as string, 10) || 5000,
  },

  frontend: {
    url: process.env.FRONTEND_URL,
  },

  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT as string, 10) || 587,
    user: process.env.SMTP_USER,
    password: process.env.SMTP_KEY,
    fromName: process.env.SMTP_FROM_NAME,
    fromEmail: process.env.SMTP_FROM_EMAIL,
    replyToEmail: process.env.SMTP_REPLY_TO_EMAIL,
    apiKey: process.env.SMTP_API_KEY,
  },

  otp: {
    expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES as string, 10) || 10,
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS as string, 10) || 5,
    resendCooldownSeconds:
      parseInt(process.env.OTP_RESEND_COOLDOWN as string, 10) || 60,
  },

  platform: {
    // Email used to identify the internal platform Developer record in the DB.
    email: process.env.PLATFORM_EMAIL || 'dexxifyhq@gmail.com',
    // Secret key for admin endpoints (x-admin-key header).
    adminKey: process.env.PLATFORM_ADMIN_KEY,
  },
});
