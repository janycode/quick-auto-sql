import express from 'express';
import cors from 'cors';
import { config } from './config';
import { errorHandler } from './middleware/error-handler';
import connectionRouter from './routes/connection';
import databaseRouter from './routes/database';
import queryRouter from './routes/query';
import aiRouter from './routes/ai';

const app = express();

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 请求日志
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// 路由
app.use('/api/connections', connectionRouter);
app.use('/api/databases', databaseRouter);
app.use('/api/query', queryRouter);
app.use('/api/ai', aiRouter);

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 错误处理
app.use(errorHandler);

// 启动服务（绑定到 0.0.0.0，确保 Docker 端口映射可转发流量）
app.listen(config.port, '0.0.0.0', () => {
  console.log(`[Quick Auto SQL] 服务已启动: http://0.0.0.0:${config.port}`);
});

export default app;
