import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import type { IAuditLog } from '../types';

const AUDIT_LOG_FILE = 'audit-log.json';
const MAX_LOG_ENTRIES = 1000;

function getAuditLogPath(): string {
  return path.join(config.dataDir, AUDIT_LOG_FILE);
}

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readLogs(): IAuditLog[] {
  const filePath = getAuditLogPath();
  ensureDir(filePath);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeLogs(logs: IAuditLog[]): void {
  const filePath = getAuditLogPath();
  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(logs, null, 2), 'utf-8');
}

export function addAuditLog(data: {
  userId: string;
  username: string;
  action: string;
  target: string;
  details: string;
  ip: string;
}): IAuditLog {
  const log: IAuditLog = {
    id: uuidv4(),
    userId: data.userId,
    username: data.username,
    action: data.action,
    target: data.target,
    details: data.details,
    ip: data.ip,
    createdAt: new Date().toISOString(),
  };

  const logs = readLogs();
  logs.push(log);

  // 限制日志数量
  if (logs.length > MAX_LOG_ENTRIES) {
    logs.splice(0, logs.length - MAX_LOG_ENTRIES);
  }

  writeLogs(logs);
  return log;
}

export function getAuditLogs(page: number = 1, pageSize: number = 50): {
  items: IAuditLog[];
  total: number;
} {
  const logs = readLogs();
  // 按时间倒序
  logs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const total = logs.length;
  const start = (page - 1) * pageSize;
  const items = logs.slice(start, start + pageSize);
  return { items, total };
}

export function clearAuditLogs(): number {
  const count = readLogs().length;
  writeLogs([]);
  return count;
}
