import { Router, Request, Response } from 'express';
import { asyncHandler, success, fail } from '../middleware/async-handler';
import * as aiService from '../services/ai';
import { ISseMessage } from '../types';

const router = Router();

// 获取 AI 服务商列表（含 chatUrl、modelsUrl、defaultModel）
router.get('/providers', asyncHandler(async (_req: Request, res: Response) => {
  success(res, aiService.getAiProviders());
}));

// 拉取指定 provider 的模型列表（代理官方 /models 接口）
// 方式一：provider + apiKey → 使用内置 provider 的 modelsUrl
// 方式二：provider='custom' + apiKey + modelsUrl → 自定义服务商
router.post('/models', asyncHandler(async (req: Request, res: Response) => {
  const { provider, apiKey, modelsUrl } = req.body || {};
  if (!apiKey) {
    fail(res, 'apiKey 必填');
    return;
  }
  const providerName = (provider === 'custom' || !provider) ? undefined : (provider as string);
  const customModelsUrl = modelsUrl as string | undefined;
  if (!providerName && !customModelsUrl) {
    fail(res, '请选择内置服务商或填写获取模型URL');
    return;
  }
  const models = await aiService.fetchAiModels(providerName, apiKey as string, customModelsUrl);
  success(res, models);
}));

// 获取 AI 配置列表（含 activeId）
router.get('/configs', asyncHandler(async (_req: Request, res: Response) => {
  const data = aiService.getAiConfigList();
  success(res, data);
}));

// 获取当前激活的 AI 配置
router.get('/config', asyncHandler(async (_req: Request, res: Response) => {
  const config = aiService.getActiveAiConfig();
  success(res, config);
}));

// 新增 AI 配置
router.post('/configs', asyncHandler(async (req: Request, res: Response) => {
  const { apiKey, apiUrl, model } = req.body || {};
  if (!apiKey) {
    fail(res, 'API Key 必填');
    return;
  }
  const data = aiService.addAiConfig({ apiKey, apiUrl, model });
  success(res, data, '配置添加成功');
}));

// 删除 AI 配置
router.delete('/configs/:id', asyncHandler(async (req: Request, res: Response) => {
  const data = aiService.deleteAiConfig(req.params.id);
  success(res, data, '配置删除成功');
}));

// 激活 AI 配置
router.post('/configs/:id/activate', asyncHandler(async (req: Request, res: Response) => {
  const data = aiService.activateAiConfig(req.params.id);
  success(res, data, '已切换为该配置');
}));

// ==================== AI 历史对话 RESTful ====================

// 获取历史（支持 ?connectionId=xxx 过滤）
router.get('/history', asyncHandler(async (req: Request, res: Response) => {
  const connectionId = req.query.connectionId as string | undefined;
  const list = connectionId
    ? aiService.getHistoryByConnection(connectionId)
    : aiService.getAllHistory();
  success(res, list);
}));

// 新增历史
router.post('/history', asyncHandler(async (req: Request, res: Response) => {
  const { connectionId, database, tables, question, sql } = req.body;
  if (!connectionId || !database || !tables?.length || !question || !sql) {
    fail(res, '参数不完整');
    return;
  }
  const item = aiService.createHistory({ connectionId, database, tables, question, sql });
  success(res, item, '保存成功');
}));

// 删除单条
router.delete('/history/:id', asyncHandler(async (req: Request, res: Response) => {
  const ok = aiService.deleteHistory(req.params.id);
  if (!ok) {
    fail(res, '记录不存在', 404);
    return;
  }
  success(res, true, '删除成功');
}));

// 清空全部
router.delete('/history', asyncHandler(async (_req: Request, res: Response) => {
  const count = aiService.clearAllHistory();
  success(res, count, `已清空 ${count} 条历史`);
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
