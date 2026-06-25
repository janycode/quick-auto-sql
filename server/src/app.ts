import express from 'express';
import cors from 'cors';
import { config } from './config';
import { errorHandler } from './middleware/error-handler';
import { requireAuth } from './middleware/auth';
import { apiRateLimit, authRateLimit, aiRateLimit, csrfProtection } from './middleware/security';
import connectionRouter from './routes/connection';
import databaseRouter from './routes/database';
import queryRouter from './routes/query';
import aiRouter from './routes/ai';
import authRouter from './routes/auth';
import auditRouter from './routes/audit';
import quotaRouter from './routes/quota';
import payRouter from './routes/pay';
import feedbackRouter from './routes/feedback';
import { closeAllPools } from './services/connection';

// 启动时校验关键配置
if (!config.encryptKey) {
  console.error('[Quick Auto SQL] 错误：未设置 ENCRYPT_KEY 环境变量，数据加密功能不可用。');
  console.error('[Quick Auto SQL] 请在 .env 文件中设置 ENCRYPT_KEY=你的随机密钥');
}

const app = express();

// 中间件
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : undefined;
app.use(cors(corsOrigins ? { origin: corsOrigins } : {}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// 请求日志
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// 全局速率限制
app.use('/api', apiRateLimit);

// CSRF 保护（生产环境）
if (process.env.NODE_ENV === 'production') {
  app.use('/api', csrfProtection);
}

// 登录相关 & 健康检查 不需要鉴权
app.use('/api/auth', authRateLimit, authRouter);
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 业务路由：必须登录
app.use('/api/connections', requireAuth, connectionRouter);
app.use('/api/databases', requireAuth, databaseRouter);
app.use('/api/query', requireAuth, queryRouter);
app.use('/api/ai', requireAuth, aiRateLimit, aiRouter);
app.use('/api/audit', requireAuth, auditRouter);
app.use('/api/quota', requireAuth, quotaRouter);
app.use('/api/pay', requireAuth, payRouter);
app.use('/api/feedback', feedbackRouter);

// 错误处理
app.use(errorHandler);

// 启动服务
const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`[Quick Auto SQL] 服务已启动: http://0.0.0.0:${config.port}`);
});

// 优雅关闭
async function gracefulShutdown(signal: string) {
  console.log(`\n[Quick Auto SQL] 收到 ${signal} 信号，正在优雅关闭...`);
  server.close(async () => {
    console.log('[Quick Auto SQL] HTTP 服务已关闭');
    await closeAllPools();
    console.log('[Quick Auto SQL] 数据库连接池已关闭');
    process.exit(0);
  });
  // 超时强制退出
  setTimeout(() => {
    console.error('[Quick Auto SQL] 关闭超时，强制退出');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
