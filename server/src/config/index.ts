import dotenv from 'dotenv';
dotenv.config();

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const v = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(v)) return false;
  return fallback;
}

function parseOptionalBool(raw: string | undefined): boolean | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const v = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(v)) return false;
  return undefined;
}

function parseIntSafe(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  encryptKey: process.env.ENCRYPT_KEY || 'quick-auto-sql-default-key',
  dataDir: process.env.DATA_DIR || './data',
  deepseek: {
    apiUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  },
  query: {
    maxRows: 1000,
    timeout: 30000,
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseIntSafe(process.env.SMTP_PORT, 465),
    secure: parseOptionalBool(process.env.SMTP_SECURE),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'Quick Auto SQL <no-reply@example.com>',
    devMode: parseBool(process.env.EMAIL_DEV_MODE, true),
  },
  adminEmail: process.env.ADMIN_EMAIL || 'yuan62387@qq.com',
};
