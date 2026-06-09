import { Router, Request, Response } from 'express';
import { asyncHandler, success, fail } from '../middleware/async-handler';
import * as aiService from '../services/ai';
import { ISseMessage } from '../types';

const router = Router();

// 获取 AI 配置
router.get('/config', asyncHandler(async (_req: Request, res: Response) => {
  const config = aiService.getAiConfig();
  success(res, config);
}));

// 更新 AI 配置
router.put('/config', asyncHandler(async (req: Request, res: Response) => {
  const config = aiService.updateAiConfig(req.body);
  success(res, config, '配置更新成功');
}));

// 自然语言生成 SQL（SSE 流式）
router.post('/generate', asyncHandler(async (req: Request, res: Response) => {
  const { connectionId, database, tables, question } = req.body;
  if (!connectionId || !database || !tables?.length || !question) {
    fail(res, 'connectionId、database、tables 和 question 参数必填');
    return;
  }

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // 发送 SSE 消息
  const sendSse = (msg: ISseMessage) => {
    res.write(`data: ${JSON.stringify(msg)}\n\n`);
  };

  try {
    await aiService.generateSqlStream(
      { connectionId, database, tables, question },
      sendSse
    );
  } catch (error: any) {
    sendSse({ type: 'error', content: error.message });
  } finally {
    res.end();
  }
}));

export default router;
