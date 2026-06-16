import { Router, Request, Response } from 'express';
import { asyncHandler, success, fail } from '../middleware/async-handler';
import * as aiService from '../services/ai';
import { ISseMessage, IPromptTemplateType } from '../types';

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
  const missing = [];
  if (!connectionId) missing.push('connectionId');
  if (!database) missing.push('database');
  if (!tables || !Array.isArray(tables) || tables.length === 0) missing.push('tables');
  if (!question || !String(question).trim()) missing.push('question');
  if (!sql || !String(sql).trim()) missing.push('sql');
  if (missing.length > 0) {
    fail(res, `参数不完整，缺少: ${missing.join(', ')}`);
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

// 根据 EXPLAIN 结果优化 SQL（SSE 流式）
router.post('/optimize', asyncHandler(async (req: Request, res: Response) => {
  const { connectionId, database, sql, tables, analysis } = req.body || {};
  if (!connectionId || !database || !sql) {
    fail(res, 'connectionId、database 和 sql 参数必填');
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const sendSse = (msg: ISseMessage) => {
    res.write(`data: ${JSON.stringify(msg)}\n\n`);
  };

  try {
    await aiService.optimizeSqlStream(
      { connectionId, database, sql, tables: tables || [], analysis: analysis || '' },
      sendSse
    );
  } catch (error: any) {
    sendSse({ type: 'error', content: error.message });
  } finally {
    res.end();
  }
}));

// ==================== 提示词模板管理 ====================

// 获取所有提示词模板
router.get('/prompts', asyncHandler(async (_req: Request, res: Response) => {
  success(res, aiService.listPromptTemplates());
}));

// 获取单个提示词模板
router.get('/prompts/:type', asyncHandler(async (req: Request, res: Response) => {
  const type = req.params.type as IPromptTemplateType;
  if (type !== 'generate_sql' && type !== 'analyze_sql' && type !== 'explain_sql') {
    fail(res, '非法的提示词类型');
    return;
  }
  success(res, aiService.getPrompt(type));
}));

// 更新提示词模板（不允许清空）
router.put('/prompts/:type', asyncHandler(async (req: Request, res: Response) => {
  const type = req.params.type as IPromptTemplateType;
  const { prompt } = req.body || {};
  if (type !== 'generate_sql' && type !== 'analyze_sql' && type !== 'explain_sql') {
    fail(res, '非法的提示词类型');
    return;
  }
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    fail(res, '提示词内容不能为空');
    return;
  }
  try {
    const updated = aiService.updatePrompt(type, prompt);
    success(res, updated, '提示词已更新');
  } catch (err: any) {
    fail(res, err.message || '提示词更新失败');
  }
}));

// 重置为默认提示词
router.post('/prompts/:type/reset', asyncHandler(async (req: Request, res: Response) => {
  const type = req.params.type as IPromptTemplateType;
  if (type !== 'generate_sql' && type !== 'analyze_sql' && type !== 'explain_sql') {
    fail(res, '非法的提示词类型');
    return;
  }
  try {
    const reset = aiService.resetPrompt(type);
    success(res, reset, '已重置为默认提示词');
  } catch (err: any) {
    fail(res, err.message || '提示词重置失败');
  }
}));

// SQL 性能分析（先 EXPLAIN，再给 AI 分析）
router.post('/analyze', asyncHandler(async (req: Request, res: Response) => {
  const { connectionId, database, sql } = req.body || {};
  if (!connectionId || !database || !sql) {
    fail(res, 'connectionId、database 和 sql 参数必填');
    return;
  }
  try {
    const result = await aiService.analyzeSql(connectionId, database, sql);
    success(res, result);
  } catch (error: any) {
    fail(res, error.message || 'SQL 性能分析失败');
  }
}));

// SQL 业务解释（生成中文业务描述，可用于在 SQL 首行添加注释）
router.post('/explain', asyncHandler(async (req: Request, res: Response) => {
  const { sql } = req.body || {};
  if (!sql || !String(sql).trim()) {
    fail(res, 'sql 参数不能为空');
    return;
  }
  try {
    const result = await aiService.explainSql(String(sql));
    success(res, result);
  } catch (error: any) {
    fail(res, error.message || 'SQL 解释失败');
  }
}));

// 列出所有 SQL 性能分析历史（支持分页：?page=1&pageSize=10；按时间倒序）
router.get('/analysis-history', asyncHandler(async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 10;
    const result = aiService.listAnalysisHistoryPage(page, pageSize);
    success(res, { items: result.items, total: result.total, page, pageSize });
  } catch (error: any) {
    fail(res, error.message || '获取分析历史失败');
  }
}));

// 删除单条 SQL 性能分析历史
router.delete('/analysis-history/:id', asyncHandler(async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!id) {
      fail(res, 'id 不能为空', 400);
      return;
    }
    const ok = aiService.deleteAnalysisHistory(id);
    if (!ok) {
      fail(res, '记录不存在', 404);
      return;
    }
    success(res, true, '删除成功');
  } catch (error: any) {
    fail(res, error.message || '删除失败');
  }
}));

// 清空 SQL 性能分析历史
router.delete('/analysis-history', asyncHandler(async (_req: Request, res: Response) => {
  try {
    const count = aiService.clearAnalysisHistory();
    success(res, { cleared: count });
  } catch (error: any) {
    fail(res, error.message || '清空分析历史失败');
  }
}));

export default router;
