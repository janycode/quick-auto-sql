import { Router, Request, Response } from 'express';
import { asyncHandler, success, fail } from '../middleware/async-handler';
import { AuthRequest, requireAuth, requireAdmin as requireAdminRole } from '../middleware/auth';
import * as aiService from '../services/ai';
import { ISseMessage, IPromptTemplateType } from '../types';
import { addAuditLog } from '../services/audit';
import { requireAiAnalyzeQuota } from '../middleware/quota';
import { getQuotaUsage, isUnlimited, consumeQuota } from '../services/quota';

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

// 测试 AI 配置连接（后端代理调用 chat completions，避免浏览器 CORS）
// - 传 configId: 'default-openrouter' 测试内置默认配置（安全，不暴露 Key）
// - 传 apiKey/apiUrl/model 测试自定义配置
router.post('/test', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { apiKey, apiUrl, model, configId } = req.body || {};
  // 如果传的是默认配置 ID，直接用内置配置测试（不从请求里读 Key）
  if (configId && configId === aiService.DEFAULT_AI_CONFIG_ID) {
    const defaultCfg = aiService.getDefaultAiConfig();
    const result = await aiService.testAiConnection(
      defaultCfg.apiKey,
      defaultCfg.apiUrl,
      defaultCfg.model
    );
    success(res, result);
    return;
  }
  if (!apiKey) {
    fail(res, 'apiKey 必填');
    return;
  }
  if (!apiUrl) {
    fail(res, 'apiUrl 必填');
    return;
  }
  const result = await aiService.testAiConnection(
    apiKey as string,
    apiUrl as string,
    model as string | undefined
  );
  success(res, result);
}));

// 获取 AI 配置列表（按用户隔离：默认配置 + 该用户自建配置）
// - 默认配置始终存在且始终在列表最前
// - 非 admin 用户：默认配置的 apiKey 不返回（为空字符串），用户自建配置正常返回
router.get('/configs', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.auth?.userId || '';
  const data = aiService.getAiConfigList(userId);
  const isAdmin = req.auth?.role === 'admin';
  // 处理默认配置的字段（displayModel/displayApiUrl → 给前端展示；apiKey 对非 admin 脱敏）
  const configs = data.configs.map((c) => {
    if (c.isDefault) {
      return {
        ...c,
        apiKey: isAdmin ? c.apiKey : '',
        model: c.displayModel || c.model,
        apiUrl: c.displayApiUrl || c.apiUrl,
      };
    }
    return c;
  });
  success(res, { configs, activeId: data.activeId });
}));

// 获取当前激活的 AI 配置（内部使用，不暴露给前端列表页面使用）
router.get('/config', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.auth?.userId || '';
  const config = aiService.getActiveAiConfig(userId);
  if (config && config.isDefault) {
    const isAdmin = req.auth?.role === 'admin';
    success(res, {
      ...config,
      apiKey: isAdmin ? config.apiKey : '',
      model: config.displayModel || config.model,
      apiUrl: config.displayApiUrl || config.apiUrl,
    });
    return;
  }
  success(res, config);
}));

// 新增 AI 配置（任何已登录用户都可新增，配置归该用户私有）
router.post('/configs', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { apiKey, apiUrl, model } = req.body || {};
  if (!apiKey) {
    fail(res, 'API Key 必填');
    return;
  }
  const userId = req.auth?.userId || '';
  const newConfig = aiService.addAiConfig({ apiKey, apiUrl, model }, userId);
  success(res, newConfig, '配置添加成功');
}));

// 删除 AI 配置（只能删除自己创建的配置；默认配置不允许删除）
router.delete('/configs/:id', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (req.params.id === aiService.DEFAULT_AI_CONFIG_ID) {
    fail(res, '默认配置不允许删除');
    return;
  }
  const userId = req.auth?.userId || '';
  try {
    aiService.deleteAiConfig(req.params.id, userId);
    success(res, true, '配置删除成功');
  } catch (err: any) {
    fail(res, err.message || '删除失败');
  }
}));

// 激活 AI 配置（只能激活自己创建的配置，或默认配置；不限制角色）
router.post('/configs/:id/activate', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.auth?.userId || '';
  try {
    aiService.activateAiConfig(req.params.id, userId);
    success(res, true, '已切换为该配置');
  } catch (err: any) {
    fail(res, err.message || '切换失败');
  }
}));

// ==================== AI 历史对话 RESTful ====================

// 获取历史（支持 ?connectionId=xxx 过滤；按当前用户隔离）
router.get('/history', asyncHandler(async (req: AuthRequest, res: Response) => {
  const connectionId = req.query.connectionId as string | undefined;
  const userId = req.auth?.userId;
  const list = connectionId
    ? aiService.getHistoryByConnection(connectionId, userId)
    : aiService.getAllHistory(userId);
  success(res, list);
}));

// 新增历史（绑定当前用户）
router.post('/history', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { connectionId, database, tables, question, sql } = req.body;
  const missing = [];
  if (!connectionId) missing.push('connectionId');
  if (!database) missing.push('database');
  if (!Array.isArray(tables)) missing.push('tables');
  if (!question || !String(question).trim()) missing.push('question');
  if (!sql || !String(sql).trim()) missing.push('sql');
  if (missing.length > 0) {
    fail(res, `参数不完整，缺少: ${missing.join(', ')}`);
    return;
  }
  const item = aiService.createHistory(
    { connectionId, database, tables: tables || [], question, sql },
    req.auth?.userId
  );
  success(res, item, '保存成功');
}));

// 删除单条（校验归属）
router.delete('/history/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const ok = aiService.deleteHistory(req.params.id, req.auth?.userId);
  if (!ok) {
    fail(res, '记录不存在或无权限', 404);
    return;
  }
  success(res, true, '删除成功');
}));

// 清空当前用户的全部历史
router.delete('/history', asyncHandler(async (req: AuthRequest, res: Response) => {
  const count = aiService.clearAllHistory(req.auth?.userId);
  success(res, count, `已清空 ${count} 条历史`);
}));

// 自然语言生成 SQL（SSE 流式）
router.post('/generate', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { connectionId, database, tables, question, messages } = req.body;
  if (!connectionId || !database || !question) {
    fail(res, 'connectionId、database 和 question 参数必填');
    return;
  }
  const userId = req.auth?.userId;
  let quotaKey: 'aiGenerateOwnKey' | 'aiGeneratePlatform' = 'aiGenerateOwnKey';
  if (userId) {
    const activeConfig = aiService.getActiveAiConfig(userId);
    quotaKey = aiService.isDefaultAiConfig(activeConfig) ? 'aiGeneratePlatform' : 'aiGenerateOwnKey';
    const usage = getQuotaUsage(userId, quotaKey);
    if (!isUnlimited(usage.limit) && usage.used >= usage.limit) {
      const label = quotaKey === 'aiGeneratePlatform' ? 'AI SQL 生成（平台提供）' : 'AI SQL 生成（自带 Key）';
      fail(res, `本月${label}次数已用完（${usage.used}/${usage.limit}），升级可获得更多额度`, 429, 429);
      return;
    }
  }
  const tableList: string[] = Array.isArray(tables) ? tables : [];
  const conversationMessages = Array.isArray(messages) ? messages : [];

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const sendSse = (msg: ISseMessage) => {
    res.write(`data: ${JSON.stringify(msg)}\n\n`);
  };

  try {
    await aiService.generateSqlStream(
      { connectionId, database, tables: tableList, question, messages: conversationMessages },
      sendSse,
      req.auth?.userId
    );
    if (userId) {
      consumeQuota(userId, quotaKey);
    }
    addAuditLog({
      userId: req.auth?.userId || '',
      username: req.auth?.username || '',
      action: 'generate',
      target: 'ai',
      details: `AI 生成 SQL: ${question.slice(0, 100)}`,
      ip: req.ip || '',
    });
  } catch (error: any) {
    sendSse({ type: 'error', content: error.message });
  } finally {
    res.end();
  }
}));

// 根据 EXPLAIN 结果优化 SQL（SSE 流式）
router.post('/optimize', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { connectionId, database, sql, tables, analysis } = req.body || {};
  if (!connectionId || !database || !sql) {
    fail(res, 'connectionId、database 和 sql 参数必填');
    return;
  }
  const userId = req.auth?.userId;
  if (userId) {
    const usage = getQuotaUsage(userId, 'aiAnalyze');
    if (!isUnlimited(usage.limit) && usage.used >= usage.limit) {
      fail(res, `本月 SQL 优化/分析次数已用完（${usage.used}/${usage.limit}），升级可获得更多额度`, 429, 429);
      return;
    }
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
      sendSse,
      req.auth?.userId
    );
    if (userId) {
      consumeQuota(userId, 'aiAnalyze');
    }
  } catch (error: any) {
    sendSse({ type: 'error', content: error.message });
  } finally {
    res.end();
  }
}));

// ==================== 提示词模板管理 ====================
// 注意：所有提示词接口均仅 admin 可访问

// 获取所有提示词模板
router.get('/prompts', requireAuth, requireAdminRole, asyncHandler(async (_req: AuthRequest, res: Response) => {
  success(res, aiService.listPromptTemplates());
}));

// 获取单个提示词模板
router.get('/prompts/:type', requireAuth, requireAdminRole, asyncHandler(async (req: AuthRequest, res: Response) => {
  const type = req.params.type as IPromptTemplateType;
  if (type !== 'generate_sql' && type !== 'analyze_sql' && type !== 'explain_sql' && type !== 'optimize_sql') {
    fail(res, '非法的提示词类型');
    return;
  }
  success(res, aiService.getPrompt(type));
}));

// 更新提示词模板（不允许清空）
router.put('/prompts/:type', requireAuth, requireAdminRole, asyncHandler(async (req: AuthRequest, res: Response) => {
  const type = req.params.type as IPromptTemplateType;
  const { prompt } = req.body || {};
  if (type !== 'generate_sql' && type !== 'analyze_sql' && type !== 'explain_sql' && type !== 'optimize_sql') {
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
router.post('/prompts/:type/reset', requireAuth, requireAdminRole, asyncHandler(async (req: AuthRequest, res: Response) => {
  const type = req.params.type as IPromptTemplateType;
  if (type !== 'generate_sql' && type !== 'analyze_sql' && type !== 'explain_sql' && type !== 'optimize_sql') {
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
router.post('/analyze', requireAiAnalyzeQuota, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { connectionId, database, sql } = req.body || {};
  if (!connectionId || !database || !sql) {
    fail(res, 'connectionId、database 和 sql 参数必填');
    return;
  }
  try {
    const result = await aiService.analyzeSql(connectionId, database, sql, req.auth?.userId);
    success(res, result);
  } catch (error: any) {
    fail(res, error.message || 'SQL 性能分析失败');
  }
}));

// SQL 业务解释（生成中文业务描述，可用于在 SQL 首行添加注释）
router.post('/explain', requireAiAnalyzeQuota, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { sql } = req.body || {};
  if (!sql || !String(sql).trim()) {
    fail(res, 'sql 参数不能为空');
    return;
  }
  try {
    const result = await aiService.explainSql(String(sql), req.auth?.userId);
    success(res, result);
  } catch (error: any) {
    fail(res, error.message || 'SQL 解释失败');
  }
}));

// 列出所有 SQL 性能分析历史（支持分页：?page=1&pageSize=10；按当前用户隔离；按时间倒序）
router.get('/analysis-history', asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 10;
    const result = aiService.listAnalysisHistoryPage(page, pageSize, req.auth?.userId);
    success(res, { items: result.items, total: result.total, page, pageSize });
  } catch (error: any) {
    fail(res, error.message || '获取分析历史失败');
  }
}));

// 删除单条 SQL 性能分析历史（校验归属）
router.delete('/analysis-history/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    if (!id) {
      fail(res, 'id 不能为空', 400);
      return;
    }
    const ok = aiService.deleteAnalysisHistory(id, req.auth?.userId);
    if (!ok) {
      fail(res, '记录不存在或无权限', 404);
      return;
    }
    success(res, true, '删除成功');
  } catch (error: any) {
    fail(res, error.message || '删除失败');
  }
}));

// 清空当前用户的 SQL 性能分析历史
router.delete('/analysis-history', asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    const count = aiService.clearAnalysisHistory(req.auth?.userId);
    success(res, { cleared: count });
  } catch (error: any) {
    fail(res, error.message || '清空分析历史失败');
  }
}));

export default router;
