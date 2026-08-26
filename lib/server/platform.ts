import { createClient, type Client, type InArgs, type ResultSet } from '@libsql/client';
import { del as blobDelete, get as blobGet, put as blobPut, type PutCommandOptions } from '@vercel/blob';

/**
 * The app was originally written against Cloudflare's D1 binding.  Keep the
 * small D1 surface the server code uses while running it on Vercel with
 * Turso/libSQL.  All SQL remains SQLite SQL, including `?` placeholders and
 * `INSERT OR IGNORE` statements.
 */
export type D1Value = string | number | bigint | boolean | null | Uint8Array | ArrayBuffer;

export type D1RunResult = {
  success: true;
  meta: {
    changes: number;
    last_row_id: number | string | null;
  };
};

export type D1RowsResult<T> = {
  results: T[];
  success: true;
  meta: {
    changes: number;
    last_row_id: number | string | null;
  };
};

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1RowsResult<T>>;
  run(): Promise<D1RunResult>;
}

export interface D1CompatibleDatabase {
  prepare(sql: string): D1PreparedStatement;
  batch<T extends D1PreparedStatement>(statements: T[]): Promise<D1RunResult[]>;
}

export type AssetHttpMetadata = {
  contentType?: string;
  cacheControl?: string;
  contentDisposition?: string;
};

export type AssetPutOptions = {
  httpMetadata?: AssetHttpMetadata;
  customMetadata?: Record<string, string>;
};

export type AssetObject = {
  body: ReadableStream<Uint8Array>;
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
};

export interface AssetStorage {
  get(key: string): Promise<AssetObject | null>;
  put(key: string, body: Uint8Array | ArrayBuffer | string | Blob | ReadableStream<Uint8Array>, options?: AssetPutOptions): Promise<unknown>;
  delete(key: string): Promise<void>;
}

export type RuntimeEnv = {
  DB: D1CompatibleDatabase;
  FILES: AssetStorage;
  NODE_ENV?: string;
  POSTGRES_URL?: string;
  DATABASE_URL?: string;
  TURSO_DATABASE_URL?: string;
  TURSO_AUTH_TOKEN?: string;
  BLOB_READ_WRITE_TOKEN?: string;
  VERCEL_BLOB_READ_WRITE_TOKEN?: string;
  BLOB_STORE_ID?: string;
  VERCEL_OIDC_TOKEN?: string;
  VERCEL_URL?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_TAX_ENABLED?: string;
  STRIPE_ALLOW_PROMOTION_CODES?: string;
  SITE_URL?: string;
  DEMO_DATA?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  RATE_LIMIT_SALT?: string;
  ADMIN_USER_IDS?: string;
  ADMIN_EMAIL?: string;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_SESSION_SECRET?: string;
  OPERATOR_NAME?: string;
  OPERATOR_ADDRESS?: string;
  OPERATOR_COUNTRY?: string;
  SUPPORT_EMAIL?: string;
  PRIVACY_RETENTION_DAYS?: string;
  [key: string]: string | D1CompatibleDatabase | AssetStorage | undefined;
};

export class PlatformSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlatformSetupError';
  }
}

function processValue(name: string) {
  const value = process.env[name];
  return value?.trim() || undefined;
}

export function getTursoUrl() {
  return processValue('TURSO_DATABASE_URL');
}

export function getTursoAuthToken() {
  return processValue('TURSO_AUTH_TOKEN');
}

/** Local file URLs do not need a token; remote Turso URLs do. */
export function isDatabaseConfigured() {
  const url = getTursoUrl();
  return Boolean(url && (url.startsWith('file:') || getTursoAuthToken()));
}

export function getBlobToken() {
  return processValue('BLOB_READ_WRITE_TOKEN') ?? processValue('VERCEL_BLOB_READ_WRITE_TOKEN');
}

export function isAssetStorageConfigured() {
  return Boolean(getBlobToken() || (processValue('BLOB_STORE_ID') && processValue('VERCEL_OIDC_TOKEN')));
}

let cachedClient: { key: string; client: Client } | null = null;

export function getLibsqlClient() {
  const url = getTursoUrl();
  const authToken = getTursoAuthToken();
  if (!url || (!url.startsWith('file:') && !authToken)) {
    throw new PlatformSetupError(
      'The database is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN before using persistence.',
    );
  }
  const key = `${url}\u0000${authToken ?? ''}`;
  if (!cachedClient || cachedClient.key !== key) {
    cachedClient = {
      key,
      client: createClient({ url, ...(authToken ? { authToken } : {}) }),
    };
  }
  return cachedClient.client;
}

function toLibsqlValue(value: unknown): D1Value {
  if (value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean' || value === null) return value as D1Value;
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return value;
  throw new TypeError(`Unsupported SQL bind value: ${Object.prototype.toString.call(value)}`);
}

function rowsToObjects<T>(result: ResultSet): T[] {
  return result.rows.map((row) => {
    if (!Array.isArray(row)) return row as unknown as T;
    return Object.fromEntries(result.columns.map((column, index) => [column, row[index]])) as T;
  });
}

function resultMeta(result: ResultSet) {
  return {
    changes: Number(result.rowsAffected ?? 0),
    last_row_id: result.lastInsertRowid == null ? null : String(result.lastInsertRowid),
  };
}

class LibsqlPreparedStatement implements D1PreparedStatement {
  private args: InArgs = [];

  constructor(private readonly client: Client, private readonly sql: string) {}

  bind(...values: unknown[]) {
    this.args = values.map(toLibsqlValue) as InArgs;
    return this;
  }

  async first<T = Record<string, unknown>>(column?: string) {
    const result = await this.client.execute({ sql: this.sql, args: this.args });
    const row = rowsToObjects<T>(result)[0] ?? null;
    if (row && column) return (row as Record<string, unknown>)[column] as T;
    return row;
  }

  async all<T = Record<string, unknown>>() {
    const result = await this.client.execute({ sql: this.sql, args: this.args });
    return { results: rowsToObjects<T>(result), success: true as const, meta: resultMeta(result) };
  }

  async run() {
    const result = await this.client.execute({ sql: this.sql, args: this.args });
    return { success: true as const, meta: resultMeta(result) };
  }

  getSqlStatement() {
    return { sql: this.sql, args: this.args };
  }
}

class LibsqlDatabase implements D1CompatibleDatabase {
  constructor(private readonly client: Client) {}

  prepare(sql: string) {
    return new LibsqlPreparedStatement(this.client, sql);
  }

  async batch(statements: D1PreparedStatement[]) {
    const transaction = await this.client.transaction('write');
    try {
      const results: D1RunResult[] = [];
      for (const statement of statements) {
        if (!(statement instanceof LibsqlPreparedStatement)) {
          throw new TypeError('Database batches must contain statements created by env.DB.prepare().');
        }
        const result = await transaction.execute(statement.getSqlStatement());
        results.push({ success: true, meta: resultMeta(result) });
      }
      await transaction.commit();
      return results;
    } catch (error) {
      await transaction.rollback().catch(() => undefined);
      throw error;
    }
  }
}

let databaseFacade: { key: string; db: LibsqlDatabase } | null = null;
function getDatabaseFacade() {
  const key = `${getTursoUrl() ?? ''}\u0000${getTursoAuthToken() ?? ''}`;
  if (!databaseFacade || databaseFacade.key !== key) {
    databaseFacade = { key, db: new LibsqlDatabase(getLibsqlClient()) };
  }
  return databaseFacade.db;
}

const unconfiguredDatabase: D1CompatibleDatabase = {
  prepare() {
    throw new PlatformSetupError(
      'Database persistence is disabled until TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are configured.',
    );
  },
  async batch() {
    throw new PlatformSetupError(
      'Database persistence is disabled until TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are configured.',
    );
  },
};

function blobOptions(options: Record<string, unknown> = {}) {
  const token = getBlobToken();
  return token ? { ...options, token } : options;
}

function cacheMaxAge(cacheControl?: string) {
  const match = cacheControl?.match(/max-age=(\d+)/i);
  return match ? Number(match[1]) : undefined;
}

const unconfiguredFiles: AssetStorage = {
  async get() { return null; },
  async put() {
    throw new PlatformSetupError(
      'Asset storage is disabled until BLOB_READ_WRITE_TOKEN is configured.',
    );
  },
  async delete() { return undefined; },
};

const filesFacade: AssetStorage = {
  async get(key) {
    if (!isAssetStorageConfigured()) return null;
    const result = await blobGet(key, blobOptions({ access: 'private' }) as unknown as Parameters<typeof blobGet>[1]);
    if (!result || result.statusCode !== 200) return null;
    return {
      body: result.stream,
      httpEtag: result.blob.etag,
      writeHttpMetadata(headers: Headers) {
        headers.set('content-type', result.blob.contentType);
        if (result.blob.cacheControl) headers.set('cache-control', result.blob.cacheControl);
        if (result.blob.contentDisposition) headers.set('content-disposition', result.blob.contentDisposition);
      },
    };
  },
  async put(key, body, options = {}) {
    if (!isAssetStorageConfigured()) return unconfiguredFiles.put(key, body, options);
    const metadata = options.httpMetadata;
    const putOptions: PutCommandOptions = {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      ...(metadata?.contentType ? { contentType: metadata.contentType } : {}),
      ...(cacheMaxAge(metadata?.cacheControl) ? { cacheControlMaxAge: cacheMaxAge(metadata?.cacheControl) } : {}),
      ...blobOptions(),
    } as PutCommandOptions;
    return blobPut(key, body as Parameters<typeof blobPut>[1], putOptions);
  },
  async delete(key) {
    if (!isAssetStorageConfigured()) return;
    await blobDelete(key, blobOptions() as unknown as Parameters<typeof blobDelete>[1]);
  },
};

const envTarget = {
  get DB() {
    return isDatabaseConfigured() ? getDatabaseFacade() : unconfiguredDatabase;
  },
  get FILES() {
    return isAssetStorageConfigured() ? filesFacade : unconfiguredFiles;
  },
};

/** Typed process.env + platform services, replacing `cloudflare:workers`. */
export const env = new Proxy(envTarget as unknown as RuntimeEnv, {
  get(target, property: string | symbol) {
    if (property === 'DB' || property === 'FILES') return target[property];
    if (typeof property !== 'string') return undefined;
    return processValue(property);
  },
}) as RuntimeEnv;
