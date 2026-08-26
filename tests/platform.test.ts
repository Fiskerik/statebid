import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { env, isAssetStorageConfigured, isDatabaseConfigured, PlatformSetupError } from '@/lib/server/platform';
import { getBoardSnapshot } from '@/lib/server/board';

const previous = {
  url: process.env.TURSO_DATABASE_URL,
  token: process.env.TURSO_AUTH_TOKEN,
  blob: process.env.BLOB_READ_WRITE_TOKEN,
  vercelBlob: process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
  storeId: process.env.BLOB_STORE_ID,
  oidc: process.env.VERCEL_OIDC_TOKEN,
};

describe('Vercel platform adapters', () => {
  beforeAll(() => {
    const databasePath = join(tmpdir(), `statebid-platform-${crypto.randomUUID()}.db`).replaceAll('\\', '/');
    process.env.TURSO_DATABASE_URL = `file:${databasePath}`;
    delete process.env.TURSO_AUTH_TOKEN;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_STORE_ID;
    delete process.env.VERCEL_OIDC_TOKEN;
  });

  afterAll(() => {
    restore('TURSO_DATABASE_URL', previous.url);
    restore('TURSO_AUTH_TOKEN', previous.token);
    restore('BLOB_READ_WRITE_TOKEN', previous.blob);
    restore('VERCEL_BLOB_READ_WRITE_TOKEN', previous.vercelBlob);
    restore('BLOB_STORE_ID', previous.storeId);
    restore('VERCEL_OIDC_TOKEN', previous.oidc);
  });

  it('runs the existing prepared-statement surface on libSQL', async () => {
    expect(isDatabaseConfigured()).toBe(true);
    await env.DB.prepare('CREATE TABLE adapter_test (id TEXT PRIMARY KEY, amount INTEGER NOT NULL)').run();
    await env.DB.prepare('INSERT INTO adapter_test(id, amount) VALUES (?, ?)').bind('one', 100).run();
    const row = await env.DB.prepare('SELECT id, amount FROM adapter_test WHERE id = ?').bind('one').first<{ id: string; amount: number }>();
    expect(row).toEqual({ id: 'one', amount: 100 });
  });

  it('rolls a failed batch back atomically', async () => {
    await env.DB.prepare('CREATE TABLE batch_test (id TEXT PRIMARY KEY)').run();
    await expect(env.DB.batch([
      env.DB.prepare('INSERT INTO batch_test(id) VALUES (?)').bind('duplicate'),
      env.DB.prepare('INSERT INTO batch_test(id) VALUES (?)').bind('duplicate'),
    ])).rejects.toThrow();
    const row = await env.DB.prepare('SELECT COUNT(*) AS count FROM batch_test').first<{ count: number }>();
    expect(Number(row?.count)).toBe(0);
  });

  it('initializes the complete ledger schema and returns all 50 states', async () => {
    const board = await getBoardSnapshot(1_800_000_000_000);
    expect(board.states).toHaveLength(50);
    expect(board.positions).toEqual([]);
    expect(board.checkoutEnabled).toBe(false);
  });

  it('keeps Blob writes closed when storage is not configured', async () => {
    expect(isAssetStorageConfigured()).toBe(false);
    await expect(env.FILES.put('test/file.png', new Uint8Array([1, 2, 3]))).rejects.toBeInstanceOf(PlatformSetupError);
  });
});

function restore(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
