import { drizzle } from 'drizzle-orm/libsql';
import { getLibsqlClient, isDatabaseConfigured } from '@/lib/server/platform';
import * as schema from './schema';

export function getDb() {
  if (!isDatabaseConfigured()) {
    throw new Error('Database is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN before using Drizzle.');
  }
  return drizzle(getLibsqlClient(), { schema });
}
