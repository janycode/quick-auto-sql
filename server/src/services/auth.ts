import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import SHA256 from 'crypto-js/sha256';
import { config } from '../config';
import type { IUser, IAuthSession } from '../types';
import { sendEmailCode } from './email';

const USERS_FILE = 'users.json';
const SESSIONS_FILE = 'sessions.json';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天
const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = 'jy19900903';

// ==================== 验证码与防刷常量 ====================
const CODE_TTL_MS = 10 * 60 * 1000;        // 10 分钟
const CODE_RESEND_COOLDOWN_MS = 60 * 1000;  // 60 秒
const CODE_MAX_ATTEMPTS = 5;                // 失败尝试上限
const IP_HOUR_LIMIT = 10;                   // 同一 IP 1 小时最多发送 10 次

interface IEmailCode {
  email: string;
  code: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}

const emailCodeStore = new Map<string, IEmailCode>();
// key: ip, value: 发送时间戳数组（仅保留 1 小时内）
const ipSendLog = new Map<string, number[]>();

// 定时清理：每 5 分钟清理一次过期的验证码条目和 IP 记录
setInterval(() => {
  const now = Date.now();
  for (const [email, entry] of emailCodeStore.entries()) {
    if (entry.expiresAt <= now) emailCodeStore.delete(email);
  }
  for (const [ip, list] of ipSendLog.entries()) {
    const filtered = list.filter(t => now - t < 60 * 60 * 1000);
    if (filtered.length === 0) ipSendLog.delete(ip);
    else ipSendLog.set(ip, filtered);
  }
}, 5 * 60 * 1000).unref();

// ==================== 工具函数 ====================
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

function generateSixDigitCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += Math.floor(Math.random() * 10);
  return code;
}

/**
 * 获取用户在 JSON 中展示的 "账号名"：优先返回 email，其次返回 username。
 */
function displayNameOf(user: IUser): string {
  return user.email || user.username || '';
}

// ==================== 邮箱 & 密码校验 ====================
const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length > 254) return false;
  return EMAIL_REGEX.test(trimmed);
}

/**
 * 密码强度规则：
 * - 长度 >= 8
 * - 必须包含英文字母
 * - 必须包含数字或特殊符号（非字母数字字符）
 */
export function validatePassword(password: string): { ok: boolean; reason?: string } {
  if (!password || typeof password !== 'string') {
    return { ok: false, reason: '密码不能为空' };
  }
  if (password.length < 8) {
    return { ok: false, reason: '密码长度至少 8 位' };
  }
  if (password.length > 128) {
    return { ok: false, reason: '密码长度不能超过 128 位' };
  }
  if (!/[A-Za-z]/.test(password)) {
    return { ok: false, reason: '密码必须包含英文字母' };
  }
  // 数字或非字母数字的可见字符（视为"符号/数字"）
  if (!/[0-9]/.test(password) && !/[^A-Za-z0-9]/.test(password)) {
    return { ok: false, reason: '密码必须包含至少一个数字或特殊符号' };
  }
  return { ok: true };
}

// ==================== 用户存储 ====================
function getUsersFilePath(): string {
  return path.join(config.dataDir, USERS_FILE);
}

function readUsers(): IUser[] {
  const filePath = getUsersFilePath();
  const data = readJson<{ users: IUser[] }>(filePath, { users: [] });
  if (!Array.isArray(data.users)) return [];
  // 数据迁移：补齐 emailVerified 字段
  return data.users.map((u) => ({
    ...u,
    emailVerified: typeof u.emailVerified === 'boolean' ? u.emailVerified : false,
  }));
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
      emailVerified: false,
      createdAt: new Date().toISOString(),
    });
    writeUsers(users);
  }
}

// 首次启动时写入内置用户
ensureDefaultUser();

/**
 * 按给定的登录字段查找用户：优先按 email 匹配，否则按 username 匹配。
 */
export function findUserByIdentifier(identifier: string): IUser | undefined {
  if (!identifier) return undefined;
  const normalized = identifier.trim().toLowerCase();
  const users = readUsers();

  // 优先 email 精确匹配（忽略大小写）
  const byEmail = users.find(u => u.email && u.email.toLowerCase() === normalized);
  if (byEmail) return byEmail;

  // 回退 username 精确匹配
  const byUsername = users.find(u => u.username && u.username.toLowerCase() === normalized);
  if (byUsername) return byUsername;

  return undefined;
}

/**
 * 为兼容旧代码保留。
 */
export function findUserByUsername(username: string): IUser | undefined {
  return findUserByIdentifier(username);
}

export function verifyUser(username: string, password: string): IUser | null {
  const user = findUserByIdentifier(username);
  if (!user) return null;
  if (user.passwordHash !== hashPassword(password)) return null;
  return user;
}

// ==================== 验证码：发送 & 校验 ====================
export interface ISendCodeResult {
  ok: boolean;
  reason?: string;
  sent?: boolean;       // 是否实际调用过发送
  devMode?: boolean;    // 是否处于 dev 模式（控制台打印）
  expiresIn?: number;   // 有效时长，秒
  previewUrl?: string;  // test-account 模式下的邮件在线预览链接
  response?: string;    // SMTP 原始响应（便于排查）
  responseCode?: number;// SMTP 响应码
  command?: string;     // 失败时的 SMTP 命令
}

/**
 * 为给定邮箱生成并发送验证码。
 * 内置：同一邮箱 60 秒内不能重复发送；同一 IP 1 小时最多 10 次。
 */
export async function sendEmailCodeFor(email: string, ip?: string): Promise<ISendCodeResult> {
  if (!validateEmail(email)) {
    return { ok: false, reason: '邮箱格式不正确' };
  }
  const normalizedEmail = email.trim().toLowerCase();

  // 邮箱级：60 秒冷却
  const now = Date.now();
  const existing = emailCodeStore.get(normalizedEmail);
  if (existing && now - existing.lastSentAt < CODE_RESEND_COOLDOWN_MS) {
    const remaining = Math.ceil((CODE_RESEND_COOLDOWN_MS - (now - existing.lastSentAt)) / 1000);
    return { ok: false, reason: `请 ${remaining} 秒后再试` };
  }

  // IP 级：1 小时最多 10 次
  if (ip) {
    const record = ipSendLog.get(ip) || [];
    const recent = record.filter(t => now - t < 60 * 60 * 1000);
    if (recent.length >= IP_HOUR_LIMIT) {
      return { ok: false, reason: '请求过于频繁，请稍后再试' };
    }
    recent.push(now);
    ipSendLog.set(ip, recent);
  }

  const code = generateSixDigitCode();

  // 先发送邮件；成功后再写入验证码记录，避免"未收到但被冷却"
  const sendResult = await sendEmailCode(normalizedEmail, code, CODE_TTL_MS / 1000);
  if (!sendResult.ok) {
    return {
      ok: false,
      sent: false,
      reason: sendResult.reason || '邮件发送失败，请稍后重试',
      response: sendResult.response,
      responseCode: sendResult.responseCode,
      command: sendResult.command,
    };
  }

  const entry: IEmailCode = {
    email: normalizedEmail,
    code,
    createdAt: now,
    expiresAt: now + CODE_TTL_MS,
    attempts: 0,
    lastSentAt: now,
  };
  emailCodeStore.set(normalizedEmail, entry);

  return {
    ok: true,
    sent: true,
    devMode: !!sendResult.devMode || config.smtp.devMode,
    expiresIn: CODE_TTL_MS / 1000,
    previewUrl: sendResult.previewUrl,
  };
}

export interface IVerifyCodeResult {
  ok: boolean;
  reason?: string;
}

export function verifyEmailCodeFor(email: string, code: string): IVerifyCodeResult {
  if (!validateEmail(email)) {
    return { ok: false, reason: '邮箱格式不正确' };
  }
  if (!code || !/^\d{6}$/.test(code)) {
    return { ok: false, reason: '验证码必须为 6 位数字' };
  }
  const normalizedEmail = email.trim().toLowerCase();
  const entry = emailCodeStore.get(normalizedEmail);
  if (!entry) {
    return { ok: false, reason: '验证码不存在或已过期，请重新获取' };
  }
  if (entry.expiresAt <= Date.now()) {
    emailCodeStore.delete(normalizedEmail);
    return { ok: false, reason: '验证码已过期，请重新获取' };
  }
  if (entry.attempts >= CODE_MAX_ATTEMPTS) {
    emailCodeStore.delete(normalizedEmail);
    return { ok: false, reason: '验证失败次数过多，请重新获取验证码' };
  }
  if (entry.code !== code) {
    entry.attempts += 1;
    emailCodeStore.set(normalizedEmail, entry);
    return { ok: false, reason: '验证码错误' };
  }
  // 成功后一次性消费
  emailCodeStore.delete(normalizedEmail);
  return { ok: true };
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
    username: displayNameOf(user),
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

export function createUser(email: string, password: string): ICreateUserResult {
  const normalizedEmail = email.trim().toLowerCase();

  if (!validateEmail(normalizedEmail)) {
    throw new Error('邮箱格式不正确');
  }

  const pw = validatePassword(password);
  if (!pw.ok) {
    throw new Error(pw.reason || '密码不符合要求');
  }

  // 邮箱必须唯一
  const users = readUsers();
  if (users.find(u => u.email && u.email.toLowerCase() === normalizedEmail)) {
    throw new Error('该邮箱已被注册');
  }

  const user: IUser = {
    id: uuidv4(),
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    emailVerified: true, // 通过验证码才到达这里，视为已验证
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  writeUsers(users);
  return { user };
}
