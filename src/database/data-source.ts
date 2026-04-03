import { DataSource } from 'typeorm';
import { join } from 'path';
import * as dotenv from 'dotenv';

// Load environment variables — tries .env.local first, then .env
dotenv.config({ path: join(process.cwd(), '.env.local') });
dotenv.config({ path: join(process.cwd(), '.env') });

const entitiesDir = join(__dirname, 'entities');
const migrationsDir = join(__dirname, 'migrations');

const AppDataSource = new DataSource({
  type: 'postgres',
  // Prefer DATABASE_URL if set, otherwise use individual params
  ...(process.env.DATABASE_URL
    ? { url: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE || 'dexxify',
      }),
  entities: [join(entitiesDir, '*.entity.{js,ts}')],
  migrations: [join(migrationsDir, '*.{js,ts}')],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
});

export default AppDataSource;

// ── Migration CLI commands ──────────────────────────────────
// Generate migration from entity changes:
//   npx typeorm-ts-node-commonjs migration:generate src/database/migrations/MigrationName -d src/database/data-source.ts
//
// Run pending migrations:
//   npx typeorm-ts-node-commonjs migration:run -d src/database/data-source.ts
//
// Revert last migration:
//   npx typeorm-ts-node-commonjs migration:revert -d src/database/data-source.ts
//
// Create empty migration:
//   npx typeorm-ts-node-commonjs migration:create src/database/migrations/MigrationName
