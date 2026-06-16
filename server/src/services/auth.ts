import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import SHA256 from 'crypto-js/sha256';
import { config } from '../config';
import { IUser, IAuthSession } from '../types';

const USERS_FILE = 'users.json';
const SESSIONS_FILE = 'sessions.json';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天
const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = 'jy19900903';

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function hashPassword(password: string): string {
  return SHA256(password).toString();
}

function readJson<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(filePath: string, data: T): void {
  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ==================== 用户存储 ====================
function getUsersFilePath(): string {
  return path.join(config.dataDir, USERS_FILE);
}

function readUsers(): IUser[] {
  const filePath = getUsersFilePath();
  const data = readJson<{ users: IUser[] }>(filePath, { users: [] });
  if (!Array.isArray(data.users)) return [];
  return data.users;
}

function writeUsers(users: IUser[]): void {
  writeJson(getUsersFilePath(), { users });
}

function ensureDefaultUser(): void {
  const users = readUsers();
  if (!users.find(u => u.username === DEFAULT_USERNAME)) {
    users.push({
      id: uuidv4(),
      username: DEFAULT_USERNAME,
      passwordHash: hashPassword(DEFAULT_PASSWORD),
      createdAt: new Date().toISOString(),
    });
    writeUsers(users);
  }
}

// 首次启动时写入内置用户（写入 users.json）
ensureDefaultUser();

export function findUserByUsername(username: string): IUser | undefined {
  const users = readUsers();
  return users.find(u => u.username === username);
}

export function verifyUser(username: string, password: string): IUser | null {
  const user = findUserByUsername(username);
  if (!user) return null;
  if (user.passwordHash !== hashPassword(password)) return null;
  return user;
}

// ==================== 会话存储 ====================
function getSessionsFilePath(): string {
  return path.join(config.dataDir, SESSIONS_FILE);
}

function readSessions(): IAuthSession[] {
  const filePath = getSessionsFilePath();
  const data = readJson<{ sessions: IAuthSession[] }>(filePath, { sessions: [] });
  if (!Array.isArray(data.sessions)) return [];
  return data.sessions.filter(s => s && s.token);
}

function writeSessions(sessions: IAuthSession[]): void {
  writeJson(getSessionsFilePath(), { sessions });
}

function pruneExpiredSessions(): IAuthSession[] {
  const now = Date.now();
  const sessions = readSessions().filter(s => new Date(s.expiresAt).getTime() > now);
  writeSessions(sessions);
  return sessions;
}

export function createSession(user: IUser): IAuthSession {
  const now = new Date();
  const session: IAuthSession = {
    token: uuidv4() + '-' + uuidv4(),
    userId: user.id,
    username: user.username,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
  };
  const sessions = pruneExpiredSessions();
  sessions.push(session);
  writeSessions(sessions);
  return session;
}

export function findSession(token: string): IAuthSession | undefined {
  if (!token) return undefined;
  const sessions = pruneExpiredSessions();
  const session = sessions.find(s => s.token === token);
  if (!session) return undefined;
  if (new Date(session.expiresAt).getTime() <= Date.now()) return undefined;
  return session;
}

export function revokeSession(token: string): boolean {
  const sessions = pruneExpiredSessions();
  const idx = sessions.findIndex(s => s.token === token);
  if (idx === -1) return false;
  sessions.splice(idx, 1);
  writeSessions(sessions);
  return true;
}

// ==================== 注册 ====================
export interface ICreateUserResult {
  user: IUser;
}

export function createUser(username: string, password: string): ICreateUserResult {
  const trimmed = typeof username === 'string' ? username.trim() : '';
  if (!trimmed || !password) {
    throw new Error('用户名和密码不能为空');
  }
  if (trimmed.length < 3 || trimmed.length > 32) {
    throw new Error('用户名长度需在 3~32 个字符之间');
  }
  if (password.length < 6 || password.length > 128) {
    throw new Error('密码长度需在 6~128 个字符之间');
  }
  if (findUserByUsername(trimmed)) {
    throw new Error('用户名已被注册');
  }
  const users = readUsers();
  const user: IUser = {
    id: uuidv4(),
    username: trimmed,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  writeUsers(users);
  return { user };
}
