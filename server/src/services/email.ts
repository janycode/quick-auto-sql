import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config';
import type { IFeedback, FeedbackType } from '../types';

let cachedTransporter: Transporter | null = null;
let lastTransporterError: string | null = null;

// ==================== 安全工具函数 ====================

export function sanitizeEmailHeader(value: string): string {
  if (!value) return '';
  return String(value)
    .replace(/[\r\n%0a%0d]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function escapeHtml(value: string): string {
  if (!value) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const FEEDBACK_TYPE_LABEL: Record<FeedbackType, string> = {
  bug: 'Bug 反馈',
  suggestion: '功能建议',
  security: '安全问题',
  other: '其他',
};

export interface SendResult {
  ok: boolean;
  reason?: string;
  response?: string;      // SMTP 服务器响应原始信息（便于排查）
  responseCode?: number;  // SMTP 响应码（如 535/550/553）
  command?: string;       // 失败时的 SMTP 命令（AUTH/MAIL FROM 等）
  previewUrl?: string;    // test-account 模式下的邮件在线预览链接
  devMode?: boolean;
}

function isConfigured(): boolean {
  return !!(config.smtp.host && config.smtp.user && config.smtp.pass);
}

/**
 * 是否使用 "test-account" 模式（由配置显式指定 `SMTP_HOST=test`），
 * 用于零配置的真实邮件发送测试，邮件将被投递到 Ethereal 临时邮箱。
 */
function isTestAccountMode(): boolean {
  return (config.smtp.host || '').toLowerCase() === 'test';
}

/**
 * 检测端口并给出合理的 secure/requireTLS 默认值：
 * - 465 端口：默认 secure=true（隐式 TLS）
 * - 587 端口：默认 secure=false，但 requireTLS=true（STARTTLS）
 * - 25 端口：不强制 TLS（明文，一般仅内网可用）
 * - 其它：按用户显式配置，否则按端口号自动判断
 */
function resolveSecure(port: number): { secure: boolean; requireTLS: boolean } {
  if (typeof config.smtp.secure === 'boolean') {
    return {
      secure: config.smtp.secure,
      requireTLS: config.smtp.secure === false && port === 587,
    };
  }
  if (port === 465) return { secure: true, requireTLS: false };
  if (port === 587) return { secure: false, requireTLS: true };
  return { secure: false, requireTLS: false };
}

async function ensureTransporter(): Promise<Transporter | null> {
  if (config.smtp.devMode) return null;

  if (cachedTransporter) return cachedTransporter;

  try {
    // Test-account 模式：用 nodemailer.createTestAccount() 创建一个 Ethereal 账号
    if (isTestAccountMode()) {
      const testAccount = await nodemailer.createTestAccount();
      const transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
        // 把账号信息挂到 transporter 上，用于后续生成预览链接
      } as any);
      (transporter as any).__testAccount = testAccount;
      cachedTransporter = transporter;
      return cachedTransporter;
    }

    if (!isConfigured()) {
      lastTransporterError = 'SMTP 配置缺失，请设置 SMTP_HOST / SMTP_USER / SMTP_PASS';
      return null;
    }

    const port = Number(config.smtp.port) || 465;
    const { secure, requireTLS } = resolveSecure(port);

    cachedTransporter = nodemailer.createTransport({
      host: config.smtp.host,
      port,
      secure,
      requireTLS,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
    return cachedTransporter;
  } catch (e: any) {
    lastTransporterError = e?.message || String(e);
    console.error('[EMAIL] 创建 SMTP transporter 失败', lastTransporterError);
    return null;
  }
}

export function resetTransporter(): void {
  cachedTransporter = null;
  lastTransporterError = null;
}

/**
 * 自检：尝试连接并发送空指令，确认 SMTP 配置可用。
 * 可被管理端点 / 启动日志调用。
 */
export async function verifySmtpConfig(): Promise<{ ok: boolean; reason?: string; previewUrl?: string }> {
  if (config.smtp.devMode) {
    return { ok: true, reason: 'EMAIL_DEV_MODE=true，未发送真实邮件' };
  }
  const transporter = await ensureTransporter();
  if (!transporter) {
    return { ok: false, reason: lastTransporterError || 'SMTP 配置缺失' };
  }
  try {
    const ready = await transporter.verify();
    if (ready) return { ok: true };
    return { ok: false, reason: 'SMTP verify 返回 false' };
  } catch (e: any) {
    return { ok: false, reason: e?.message || String(e) };
  }
}

/**
 * 发送邮箱验证码。
 */
export async function sendEmailCode(to: string, code: string, expiresSeconds = 600): Promise<SendResult> {
  const safeTo = sanitizeEmailHeader(to);
  if (!safeTo) return { ok: false, reason: '收件人邮箱为空' };

  const minutes = Math.round(expiresSeconds / 60);
  const subject = sanitizeEmailHeader('【Quick Auto SQL】邮箱验证码');
  const safeCode = escapeHtml(code);
  const text = `您正在注册 Quick Auto SQL 账号，验证码为：${code}\n该验证码将在 ${minutes} 分钟后过期，请勿泄露给他人。`;
  const html = `
    <div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; padding: 20px; color: #1f2a44;">
      <h2 style="margin:0 0 12px 0;">【Quick Auto SQL】邮箱验证码</h2>
      <p>您正在注册 Quick Auto SQL 账号，验证码为：</p>
      <div style="font-size:28px; letter-spacing:8px; font-weight:700; color:#2b6cff; padding:12px 18px; background:#f2f6ff; border-radius:8px; display:inline-block;">
        ${safeCode}
      </div>
      <p style="color:#6b7590; margin-top:16px;">该验证码将在 <b>${minutes}</b> 分钟后过期，请勿泄露给他人。</p>
      <p style="color:#a9b2c3; font-size:12px;">如果您并未发起此操作，请忽略本邮件。</p>
    </div>
  `.trim();

  if (config.smtp.devMode) {
    console.log(`\n[EMAIL DEV MODE] 发送邮箱验证码 to=<${safeTo}>  code=${code}  expires=${minutes}分钟\n`);
    return { ok: true, devMode: true };
  }

  const transporter = await ensureTransporter();
  if (!transporter) {
    return { ok: false, reason: lastTransporterError || 'SMTP 未配置' };
  }

  const from = config.smtp.from || config.smtp.user;

  try {
    const info = await transporter.sendMail({
      from,
      to: safeTo,
      subject,
      text,
      html,
    });

    const testAccount = (transporter as any).__testAccount;
    const previewUrl = testAccount ? nodemailer.getTestMessageUrl(info) || undefined : undefined;

    return { ok: true, previewUrl };
  } catch (e: any) {
    const msg = e?.message || String(e);
    const response = typeof e?.response === 'string' ? e.response : undefined;
    const responseCode = typeof e?.responseCode === 'number' ? e.responseCode : undefined;
    const command = typeof e?.command === 'string' ? e.command : undefined;

    console.error(`[EMAIL] 发送失败 to=<${safeTo}>`, { message: msg, responseCode, command });
    // 让下次请求重建 transporter，避免卡在一个坏连接上
    resetTransporter();

    let friendlyReason = msg;
    if (responseCode === 535) {
      friendlyReason = 'SMTP 认证失败（535）：请确认 SMTP_USER 是完整邮箱、SMTP_PASS 是邮箱后台申请的"SMTP授权码"（非登录密码）';
    } else if (responseCode === 553) {
      friendlyReason = '发件人地址不合法（553）：SMTP_FROM 中的邮箱必须与 SMTP_USER 一致，请核对 .env 配置';
    } else if (responseCode && responseCode >= 500) {
      friendlyReason = `SMTP 服务器拒绝（${responseCode}）：${response || msg}`;
    } else if (command === 'CONN' || /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/i.test(msg)) {
      friendlyReason = `无法连接到 SMTP 服务器（${msg}）：请核对 SMTP_HOST/SMTP_PORT，或本机网络/防火墙是否放行`;
    } else if (/AUTH|login|credential/i.test(msg)) {
      friendlyReason = `SMTP 账号/授权码无效：${msg}`;
    }

    return {
      ok: false,
      reason: friendlyReason,
      response,
      responseCode,
      command,
    };
  }
}

export async function sendFeedbackNotification(
  feedback: IFeedback,
  adminEmail: string,
  baseUrl?: string,
): Promise<SendResult> {
  const safeTo = sanitizeEmailHeader(adminEmail);
  if (!safeTo) return { ok: false, reason: 'admin 邮箱为空' };

  const typeLabel = FEEDBACK_TYPE_LABEL[feedback.type] || feedback.type;
  const subject = sanitizeEmailHeader(`【Quick Auto SQL】新的用户反馈 - ${typeLabel}`);

  const safeDescription = escapeHtml(feedback.description);
  const safeEmail = escapeHtml(feedback.email || '-');
  const safeUsername = escapeHtml(feedback.username || '-');
  const safeType = escapeHtml(typeLabel);
  const safeCreatedAt = escapeHtml(feedback.createdAt);

  const feedbackUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/settings/feedback` : '';
  const safeFeedbackUrl = escapeHtml(feedbackUrl);

  const text = `
用户反馈类型：${typeLabel}
反馈描述：${feedback.description}
提交用户：${feedback.username || '-'}（${feedback.email || '-'}）
提交时间：${feedback.createdAt}
${feedbackUrl ? `查看反馈：${feedbackUrl}` : ''}
  `.trim();

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; padding: 20px; color: #1f2a44;">
      <h2 style="margin:0 0 16px 0;">新的用户反馈</h2>
      <table style="width:100%; border-collapse:collapse; font-size:14px;">
        <tr>
          <td style="padding:8px 12px; background:#f5f7fa; width:100px; color:#6b7590;">反馈类型</td>
          <td style="padding:8px 12px;">${safeType}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px; background:#f5f7fa; color:#6b7590;">提交用户</td>
          <td style="padding:8px 12px;">${safeUsername}（${safeEmail}）</td>
        </tr>
        <tr>
          <td style="padding:8px 12px; background:#f5f7fa; color:#6b7590;">提交时间</td>
          <td style="padding:8px 12px;">${safeCreatedAt}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px; background:#f5f7fa; color:#6b7590; vertical-align:top;">反馈描述</td>
          <td style="padding:8px 12px; white-space:pre-wrap; word-break:break-word;">${safeDescription}</td>
        </tr>
      </table>
      ${safeFeedbackUrl ? `
      <div style="margin-top:20px;">
        <a href="${safeFeedbackUrl}" style="display:inline-block; padding:10px 24px; background:#2b6cff; color:#fff; text-decoration:none; border-radius:6px;">查看并处理反馈</a>
      </div>
      ` : ''}
      <p style="color:#a9b2c3; font-size:12px; margin-top:20px;">本邮件由系统自动发送，请勿直接回复。</p>
    </div>
  `.trim();

  if (config.smtp.devMode) {
    console.log(`\n[EMAIL DEV MODE] 发送反馈通知 to=<${safeTo}>  type=${feedback.type}\n`);
    return { ok: true, devMode: true };
  }

  const transporter = await ensureTransporter();
  if (!transporter) {
    return { ok: false, reason: lastTransporterError || 'SMTP 未配置' };
  }

  const from = config.smtp.from || config.smtp.user;

  try {
    const info = await transporter.sendMail({
      from,
      to: safeTo,
      subject,
      text,
      html,
    });

    const testAccount = (transporter as any).__testAccount;
    const previewUrl = testAccount ? nodemailer.getTestMessageUrl(info) || undefined : undefined;

    return { ok: true, previewUrl };
  } catch (e: any) {
    const msg = e?.message || String(e);
    const response = typeof e?.response === 'string' ? e.response : undefined;
    const responseCode = typeof e?.responseCode === 'number' ? e.responseCode : undefined;
    const command = typeof e?.command === 'string' ? e.command : undefined;

    console.error(`[EMAIL] 反馈通知发送失败 to=<${safeTo}>`, { message: msg, responseCode, command });
    resetTransporter();

    return {
      ok: false,
      reason: msg,
      response,
      responseCode,
      command,
    };
  }
}
