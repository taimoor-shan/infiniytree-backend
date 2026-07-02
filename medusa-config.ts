import path from 'path'
import { loadEnv, defineConfig, Modules } from '@medusajs/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

const backendUrl =
  process.env.BACKEND_PUBLIC_URL ||
  'http://localhost:9000'

module.exports = defineConfig({
  projectConfig: {
    redisUrl: process.env.REDIS_URL,
    databaseUrl: process.env.DATABASE_URL,
    databaseDriverOptions: process.env.NODE_ENV === 'production'
      ? { ssl: { rejectUnauthorized: false } }
      : { ssl: false },
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },
  modules: [
    {
      key: Modules.FILE,
      resolve: '@medusajs/file',
      options: {
        providers: [
          // Cloudflare R2 (S3-compatible) — free tier, zero egress
          // Set S3_FILE_URL, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION, S3_BUCKET to activate
          ...(process.env.S3_FILE_URL &&
          process.env.S3_ACCESS_KEY_ID &&
          process.env.S3_SECRET_ACCESS_KEY
            ? [
                {
                  resolve: '@medusajs/file-s3',
                  id: 's3',
                  options: {
                    file_url: process.env.S3_FILE_URL,
                    access_key_id: process.env.S3_ACCESS_KEY_ID,
                    secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
                    region: process.env.S3_REGION || 'auto',
                    bucket: process.env.S3_BUCKET || 'medusa-media',
                    endpoint: process.env.S3_ENDPOINT,
                    // Required for R2/non-AWS S3 providers
                    additional_config: {
                      forcePathStyle: true,
                    },
                  },
                },
              ]
            // Local filesystem (default)
            : [
                (() => {
                  const isProduction = process.env.NODE_ENV === 'production'
                  const uploadDir =
                    process.env.UPLOAD_DIR ?? path.resolve(__dirname, 'static')

                  if (isProduction && !process.env.UPLOAD_DIR) {
                    throw new Error(
                      'UPLOAD_DIR must be configured in production. ' +
                        'Example: UPLOAD_DIR=/srv/medusa/uploads',
                    )
                  }

                  return {
                    resolve: '@medusajs/file-local',
                    id: 'local',
                    options: {
                      upload_dir: uploadDir,
                      backend_url: `${backendUrl}/static`,
                    },
                  }
                })(),
              ]),
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/notification-sendgrid",
            id: "sendgrid",
            options: {
              channels: ["email"],
              api_key: process.env.SENDGRID_API_KEY,
              from: process.env.SENDGRID_FROM,
            },
          },
        ],
      },
    },
    {
      resolve: "./src/modules/page",
    },
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/payment-stripe",
            id: "stripe",
            options: {
              apiKey: process.env.STRIPE_API_KEY,
              automatic_payment_methods: true,
            },
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/translation",
    },
    {
      resolve: "@medusajs/medusa/product",
    },

  ],
  admin: {
    vite: () => {
      return {
        server: {
          host: '0.0.0.0',
          // Allow all hosts when running in Docker (development mode)
          // In production, this should be more restrictive
          allowedHosts: 'all',
          hmr: {
            // HMR websocket port inside container
            port: 5173,
            // Port browser connects to (exposed in docker-compose.yml)
            clientPort: 5173,
          },
        },
      }
    },
  },
  featureFlags: {
    translation: true,
  },
})
