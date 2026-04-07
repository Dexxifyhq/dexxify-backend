import { DataSource } from 'typeorm';
import { join } from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: join(process.cwd(), '.env.local') });

const entitiesDir = join(__dirname, 'entities');
const migrationsDir = join(__dirname, 'migrations');

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_POOLER,
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
