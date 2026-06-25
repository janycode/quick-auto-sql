import type { PlanType, IQuotaInfo, IUser } from '../types';
import { findUserById, updateUserField } from './auth';
import { incrementUsage, readUsage, sumMonthlyUsage } from '../store/quota-store';
import { listQueryHistoryPage } from '../store/json-store';

export const PLAN_QUOTAS: Record<PlanType, {
  aiGenerateOwnKey: number;
  aiGeneratePlatform: number;
  aiAnalyze: number;
  sqlExecute: number;
  historyLimit: number;
  customPrompts: boolean;
}> = {
  free: { aiGenerateOwnKey: 30, aiGeneratePlatform: 10, aiAnalyze: 10, sqlExecute: 100, historyLimit: 50, customPrompts: false },
  pro: { aiGenerateOwnKey: 500, aiGeneratePlatform: 200, aiAnalyze: 200, sqlExecute: -1, historyLimit: -1, customPrompts: true },
  team: { aiGenerateOwnKey: -1, aiGeneratePlatform: 1000, aiAnalyze: -1, sqlExecute: -1, historyLimit: -1, customPrompts: true },
  enterprise: { aiGenerateOwnKey: -1, aiGeneratePlatform: -1, aiAnalyze: -1, sqlExecute: -1, historyLimit: -1, customPrompts: true },
};

export type QuotaKey = 'aiGenerateOwnKey' | 'aiGeneratePlatform' | 'aiAnalyze' | 'sqlExecute';

export const QUOTA_LABELS: Record<QuotaKey, string> = {
  aiGenerateOwnKey: 'AI SQL 生成（自带 Key）',
  aiGeneratePlatform: 'AI SQL 生成（平台提供）',
  aiAnalyze: 'SQL 优化/分析',
  sqlExecute: 'SQL 查询执行',
};

export const QUOTA_RESET_CYCLE: Record<QuotaKey, 'monthly' | 'daily'> = {
  aiGenerateOwnKey: 'monthly',
  aiGeneratePlatform: 'monthly',
  aiAnalyze: 'monthly',
  sqlExecute: 'daily',
};

export function isUnlimited(v: number): boolean {
  return v === -1 || v === Infinity || v < 0;
}

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getMonthStr(): string {
  return new Date().toISOString().slice(0, 7);
}

export function getUserPlan(userId: string): PlanType {
  const user = findUserById(userId);
  if (!user) return 'free';
  const plan = user.plan || 'free';
  if (plan === 'free') return 'free';
  if (user.planExpiresAt) {
    const expiresAt = new Date(user.planExpiresAt).getTime();
    if (!isNaN(expiresAt) && expiresAt < Date.now()) {
      return 'free';
    }
  }
  return plan;
}

export function updateUserPlan(userId: string, plan: PlanType, expiresDays?: number): boolean {
  const updates: Partial<IUser> = { plan };
  if (expiresDays && expiresDays > 0) {
    updates.planExpiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000).toISOString();
  } else if (plan === 'free') {
    updates.planExpiresAt = undefined;
  }
  return updateUserField(userId, updates);
}

function getUsedCount(userId: string, key: QuotaKey): number {
  const cycle = QUOTA_RESET_CYCLE[key];
  if (cycle === 'monthly') {
    return sumMonthlyUsage(userId, getMonthStr(), key as any);
  }
  const existing = readUsage(userId, getTodayStr());
  return existing ? (existing[key] as number) || 0 : 0;
}

export function consumeQuota(userId: string, key: QuotaKey): { allowed: boolean; used: number; limit: number } {
  const plan = getUserPlan(userId);
  const limit = PLAN_QUOTAS[plan][key];
  if (isUnlimited(limit)) {
    const date = getTodayStr();
    incrementUsage(userId, date, key as any);
    return { allowed: true, used: 0, limit: -1 };
  }
  const usedNow = getUsedCount(userId, key);
  if (usedNow >= limit) {
    return { allowed: false, used: usedNow, limit };
  }
  const date = getTodayStr();
  incrementUsage(userId, date, key as any);
  return { allowed: true, used: usedNow + 1, limit };
}

export function getQuotaUsage(userId: string, key: QuotaKey): { used: number; limit: number } {
  const plan = getUserPlan(userId);
  const limit = PLAN_QUOTAS[plan][key];
  if (isUnlimited(limit)) {
    return { used: 0, limit: -1 };
  }
  return { used: getUsedCount(userId, key), limit };
}

export function getQuotaInfo(userId: string): IQuotaInfo {
  const user = findUserById(userId);
  const plan = getUserPlan(userId);
  return {
    plan,
    planExpiresAt: user?.planExpiresAt,
    aiGenerateOwnKey: getQuotaUsage(userId, 'aiGenerateOwnKey'),
    aiGeneratePlatform: getQuotaUsage(userId, 'aiGeneratePlatform'),
    aiAnalyze: getQuotaUsage(userId, 'aiAnalyze'),
    sqlExecute: getQuotaUsage(userId, 'sqlExecute'),
    historyLimit: PLAN_QUOTAS[plan].historyLimit,
    historyUsed: listQueryHistoryPage(1, 1, undefined, userId).total,
    hasCustomPrompts: PLAN_QUOTAS[plan].customPrompts,
    trialUsed: user?.trialUsed,
  };
}
