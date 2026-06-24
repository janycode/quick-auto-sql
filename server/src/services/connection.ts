import CryptoJS from 'crypto-js';
import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import { IConnection, IConnectionCreate } from '../types';
import { connectionStore } from '../store/json-store';
import { config } from '../config';

// 连接池缓存
const poolCache = new Map<string, mysql.Pool>();

// 加密密码
function encryptPassword(password: string): string {
  return CryptoJS.AES.encrypt(password, config.encryptKey).toString();
}

// 解密密码
export function decryptPassword(encrypted: string): string {
  const bytes = CryptoJS.AES.decrypt(encrypted, config.encryptKey);
  return bytes.toString(CryptoJS.enc.Utf8);
}

// 获取或创建连接池
export function getPool(connection: IConnection): mysql.Pool {
  const cacheKey = connection.id;
  let pool = poolCache.get(cacheKey);
  if (pool) return pool;

  pool = mysql.createPool({
    host: connection.host,
    port: connection.port,
    user: connection.username,
    password: decryptPassword(connection.password),
    database: connection.database || undefined,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });

  poolCache.set(cacheKey, pool);
  return pool;
}

// 获取连接池（通过 connectionId + userId，校验归属）
export function getPoolById(connectionId: string, userId?: string): mysql.Pool | null {
  const connection = getConnectionById(connectionId, userId);
  if (!connection) return null;
  return getPool(connection);
}

// 获取连接信息（校验归属）
export function getConnectionById(connectionId: string, userId?: string): IConnection | undefined {
  const raw = connectionStore.findById(connectionId) as IConnection | undefined;
  if (!raw) return undefined;
  if (userId && raw.userId !== userId) return undefined;
  return raw;
}

// 获取所有连接（按用户隔离）
export function getAllConnections(userId?: string): IConnection[] {
  const items = connectionStore.read() as IConnection[];
  if (!userId) return items;
  return items.filter((c) => c.userId === userId);
}

// 创建连接（绑定用户）
export function createConnection(data: IConnectionCreate, userId?: string): IConnection {
  const now = new Date().toISOString();
  const connection: IConnection = {
    id: uuidv4(),
    name: data.name,
    host: data.host,
    port: data.port,
    username: data.username,
    password: encryptPassword(data.password),
    database: data.database,
    userId: userId || '',
    createdAt: now,
    updatedAt: now,
  };
  connectionStore.insert(connection as any);
  return connection;
}

// 更新连接（校验归属）
export function updateConnection(id: string, data: Partial<IConnectionCreate>, userId?: string): IConnection | null {
  const existing = getConnectionById(id, userId);
  if (!existing) return null;

  const connectionFieldsChanged = data.host || data.port || data.username || data.password || data.database;
  if (connectionFieldsChanged) {
    removePool(id);
  }

  const updates: Partial<IConnection> = { ...data, updatedAt: new Date().toISOString() };
  if (data.password) {
    updates.password = encryptPassword(data.password);
  }

  return connectionStore.update(id, updates as any) as IConnection | null;
}

// 删除连接（校验归属）
export function deleteConnection(id: string, userId?: string): boolean {
  const existing = getConnectionById(id, userId);
  if (!existing) return false;
  removePool(id);
  return connectionStore.delete(id);
}

// MySQL 连接失败相关错误码（与 database.ts / query.ts 保持一致）
const MYSQL_UNAVAILABLE_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ETIMEDOUT',
  'PROTOCOL_CONNECTION_LOST',
  'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
]);

function wrapMySqlError(error: any): Error {
  if (!error) return new Error('未知错误');
  const code = String(error.code || '').toUpperCase();
  const message = String(error.sqlMessage || error.message || '连接失败');

  if (MYSQL_UNAVAILABLE_CODES.has(code) || /connect.*mysql|mysql.*connect|econnrefused|access denied for user/i.test(message)) {
    const wrapped: any = new Error('未发现可用的mysql服务，请启动服务后刷新重试');
    wrapped.code = 'MYSQL_UNAVAILABLE';
    return wrapped;
  }

  const wrapped: any = new Error(message);
  if (error.code) wrapped.code = error.code;
  if (error.errno !== undefined) wrapped.errno = error.errno;
  return wrapped;
}

// 测试连接
export async function testConnection(data: IConnectionCreate): Promise<boolean> {
  let tempConnection: mysql.Connection | null = null;
  try {
    tempConnection = await mysql.createConnection({
      host: data.host,
      port: data.port,
      user: data.username,
      password: data.password,
      database: data.database || undefined,
      connectTimeout: 5000,
    });
    await tempConnection.ping();
    await tempConnection.end();
    return true;
  } catch (error) {
    if (tempConnection) {
      tempConnection.end().catch(() => { /* noop */ });
    }
    throw wrapMySqlError(error);
  }
}

// 测试已保存的连接（按用户校验归属）
export async function testSavedConnection(id: string, userId?: string): Promise<boolean> {
  const connection = getConnectionById(id, userId);
  if (!connection) throw new Error('连接不存在');

  let tempConnection: mysql.Connection | null = null;
  try {
    tempConnection = await mysql.createConnection({
      host: connection.host,
      port: connection.port,
      user: connection.username,
      password: decryptPassword(connection.password),
      database: connection.database || undefined,
      connectTimeout: 5000,
    });
    await tempConnection.ping();
    await tempConnection.end();
    return true;
  } catch (error) {
    if (tempConnection) {
      tempConnection.end().catch(() => { /* noop */ });
    }
    throw wrapMySqlError(error);
  }
}

// 清除连接池缓存
function removePool(id: string): void {
  const pool = poolCache.get(id);
  if (pool) {
    pool.end();
    poolCache.delete(id);
  }
}
