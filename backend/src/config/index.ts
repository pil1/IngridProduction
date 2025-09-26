import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // Server configuration
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    env: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:8080,http://localhost:8081,http://localhost:5173,http://localhost:3000',
  },

  // Database configuration
  database: {
    url: process.env.DATABASE_URL || 'postgresql://infotrac_user:infotrac_password@localhost:5432/infotrac',
    ssl: process.env.NODE_ENV === 'production',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
  },

  // Redis configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    ttl: parseInt(process.env.REDIS_TTL || '3600', 10), // 1 hour
  },

  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secure-jwt-secret-key-here',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // Encryption configuration
  encryption: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
  },

  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },

  // File upload configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    uploadDir: process.env.UPLOAD_DIR || 'uploads',
  },

  // Email configuration
  email: {
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    },
    from: {
      name: process.env.SMTP_FROM_NAME || 'INFOtrac',
      address: process.env.SMTP_FROM_EMAIL || 'noreply@infotrac.com',
    },
  },

  // AI configuration
  ai: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4',
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2048', 10),
    },
    enabled: process.env.AI_ENABLED === 'true',
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined',
  },
};

// Validate required configuration
const requiredConfig = [
  'JWT_SECRET',
];

const missingConfig = requiredConfig.filter(key => !process.env[key]);
if (missingConfig.length > 0) {
  console.error('Missing required environment variables:', missingConfig);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}