import fs from 'fs';
import path from 'path';
import { config } from '../config';
import type { IUsageRecord } from '../types';

const QUOTA_FILE = 'usage-records.json';

function getFilePath(): string {
  return path.join(config.dataDir, QUOTA_FILE);
}

function readAll(): IUsageRecord[] {
  const filePath = getFilePath();
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (!Array.isArray(raw)) return [];
    return raw.filter((r: any) => r && typeof r.userId === 'string' && typeof r.date === 'string');
  } catch {
    return [];
  }
}

function writeAll(records: IUsageRecord[]): void {
  const filePath = getFilePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf-8');
}

export function readUsage(userId: string, date: string): IUsageRecord | undefined {
  const all = readAll();
  return all.find(r => r.userId === userId && r.date === date);
}

export function getOrCreateToday(userId: string, date: string): IUsageRecord {
  const all = readAll();
  const existing = all.find(r => r.userId === userId && r.date === date);
  if (existing) return existing;
  const fresh: IUsageRecord = {
    userId,
    date,
    aiGenerateOwnKey: 0,
    aiGeneratePlatform: 0,
    aiAnalyze: 0,
    sqlExecute: 0,
    updatedAt: new Date().toISOString(),
  };
  all.push(fresh);
  writeAll(all);
  return fresh;
}

export function writeUsage(record: IUsageRecord): void {
  const all = readAll();
  const idx = all.findIndex(r => r.userId === record.userId && r.date === record.date);
  const toSave = { ...record, updatedAt: new Date().toISOString() };
  if (idx === -1) all.push(toSave);
  else all[idx] = toSave;
  writeAll(all);
}

export function incrementUsage(userId: string, date: string, field: keyof IUsageRecord): IUsageRecord {
  const all = readAll();
  const idx = all.findIndex(r => r.userId === userId && r.date === date);
  let record: IUsageRecord;
  if (idx === -1) {
    record = { userId, date, aiGenerateOwnKey: 0, aiGeneratePlatform: 0, aiAnalyze: 0, sqlExecute: 0, updatedAt: new Date().toISOString() };
    all.push(record);
  } else {
    record = all[idx];
  }
  const current = typeof record[field] === 'number' ? (record[field] as number) : 0;
  (record as any)[field] = current + 1;
  record.updatedAt = new Date().toISOString();
  if (idx !== -1) all[idx] = record;
  writeAll(all);
  return record;
}

export function sumMonthlyUsage(userId: string, monthStr: string, field: keyof IUsageRecord): number {
  const all = readAll();
  let sum = 0;
  for (const r of all) {
    if (r.userId === userId && r.date.startsWith(monthStr)) {
      const v = (r as any)[field];
      if (typeof v === 'number') sum += v;
    }
  }
  return sum;
}
