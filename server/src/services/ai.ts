import { v4 as uuidv4 } from 'uuid';
import { IAiConfig, IAiConfigCreate, IAiConfigStoreData, IAiGenerateRequest, IAiHistory, IAiHistoryCreate, IAiProvider, ISseMessage, IPromptTemplate, IPromptTemplateType, IUserAiConfig } from '../types';
import { aiConfigStore, aiHistoryStore, readActiveAiConfig, getPromptTemplate, getAllPromptTemplates, updatePromptTemplate, resetPromptTemplate, getDefaultPrompt, findAnalysisCache, saveAnalysisCache, listAnalysisCache, listAnalysisCachePage, deleteAnalysisCacheById, clearAnalysisCache, DEFAULT_AI_CONFIG_ID } from '../store/json-store';
import { getTables, getTablesSchemaForAI } from './database';
import { explainQuery } from './query';
import { findUserById, updateUserAiConfigs, getAllUsers, displayNameOf } from './auth';
import { config } from '../config';

export { DEFAULT_AI_CONFIG_ID };

// 判断用户是否为 admin
function isAdminUser(userId: string | undefined): boolean {
  if (!userId) return false;
  const user = findUserById(userId);
  return user?.role === 'admin';
}

// AI 模型服务商 registry — 新增 LongCat 等提供商时在此加一条即可
export const AI_PROVIDERS: IAiProvider[] = [
  {
    name: 'deepseek',
    displayName: 'DeepSeek',
    chatUrl: 'https://api.deepseek.com/v1/chat/completions',
    modelsUrl: 'https://api.deepseek.com/models',
    defaultModel: 'deepseek-chat',
  },
  {
    name: 'longcat',
    displayName: 'LongCat',
    chatUrl: 'https://api.longcat.chat/openai/v1/chat/completions',
    modelsUrl: 'https://api.longcat.chat/openai/v1/models',
    defaultModel: 'LongCat-2.0-Preview',
  },
];

// 获取所有 provider
export function getAiProviders(): IAiProvider[] {
  return AI_PROVIDERS;
}

// 根据 name 查 provider
export function getAiProvider(name: string): IAiProvider | undefined {
  return AI_PROVIDERS.find(p => p.name.toLowerCase() === name.toLowerCase());
}

// 默认配置专属的 system prompt（仅使用默认配置时拼接）
const DEFAULT_SYSTEM_PROMPT = '你是一名专注于 MySQL 的 SQL 生成助手。请严格基于用户提供的表结构生成可直接执行的 SQL 语句。【输出规则】1. 只输出 SQL 语句本身，不包含任何解释、前缀、后缀或客套话；2. 禁止使用 Markdown 代码块（```sql ... ```）；3. 只能使用表结构中明确存在的表名和字段名，禁止臆造；4. 优先使用 JOIN 而非子查询，避免 SELECT *，注意 NULL 值处理；5. 所有回复使用中文。';

// 是否为默认配置
export function isDefaultAiConfig(config: IAiConfig | null): boolean {
  return !!config && (config.isDefault === true || config.id === DEFAULT_AI_CONFIG_ID);
}

// 获取默认配置（从 ai-config.json 读取，始终存在）
export function getDefaultAiConfig(): IAiConfig {
  const data = aiConfigStore.read();
  const found = data.configs.find(c => c.id === DEFAULT_AI_CONFIG_ID);
  return found ? { ...found } : {
    id: DEFAULT_AI_CONFIG_ID,
    apiKey: '',
    apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'openrouter/free',
    createdAt: new Date().toISOString(),
    isDefault: true,
    displayModel: '默认模型',
    displayApiUrl: 'https://localhost/api/v1/chat/completions',
  };
}

// 从持久化存储中读取默认配置（始终存在，id 固定）
export function getDefaultAiConfigForApi(isAdmin: boolean): IAiConfig {
  const cfg = getDefaultAiConfig();
  if (!isAdmin) {
    cfg.apiKey = '';
  }
  return cfg;
}

// 拉取指定 provider 的模型列表（代理官方 /models 接口，统一返回 string[]）
// providerName: 内置服务商名称；若为空则必须传 modelsUrl
// apiKey: 必填
// modelsUrl: 可选，自定义服务商时直接使用传入的 URL
export async function fetchAiModels(providerName: string | undefined, apiKey: string, modelsUrl?: string): Promise<string[]> {
  if (!apiKey) {
    throw new Error('API Key 必填');
  }

  let url: string | undefined = modelsUrl;
  if (!url && providerName) {
    const provider = getAiProvider(providerName);
    if (provider) url = provider.modelsUrl;
  }
  if (!url) {
    throw new Error('未找到服务商，请选择内置服务商或填写获取模型URL');
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`模型列表拉取失败: ${response.status} ${text}`);
  }

  const data = (await response.json()) as any;
  // OpenAI 兼容格式：{ object: "list", data: [{ id, ... }] }
  if (data && Array.isArray(data.data)) {
    return data.data
      .filter((m: any) => m && typeof m.id === 'string')
      .map((m: any) => m.id);
  }

  throw new Error('模型列表响应格式不兼容');
}

// 测试 AI 配置连接（后端代理调用 chat completions 接口，最小请求）
export async function testAiConnection(apiKey: string, apiUrl: string, model?: string): Promise<{ ok: true; status: number }> {
  if (!apiKey) {
    throw new Error('API Key 必填');
  }
  if (!apiUrl) {
    throw new Error('API URL 必填');
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 5,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${response.status} ${text}`);
  }

  return { ok: true, status: response.status };
}

// 核心：根据用户的 aiConfigs 列表 + 配置库 → 构建可访问的配置列表
// 返回值：完整配置详情 + 当前激活配置 ID
// admin 返回的配置会额外包含 ownerName（所属用户显示名）
// 普通用户仅看到自己的配置，不包含 ownerName
export function getAiConfigList(userId: string): { configs: IAiConfig[]; activeId: string } {
  const user = findUserById(userId);
  if (!user) {
    return { configs: [getDefaultAiConfig()], activeId: DEFAULT_AI_CONFIG_ID };
  }
  const data = aiConfigStore.read();
  const admin = isAdminUser(userId);
  const resultConfigs: IAiConfig[] = [];
  let activeId = DEFAULT_AI_CONFIG_ID;

  // 构建 configId → 第一个拥有者 的映射（用于 admin 显示）
  const ownerMap = new Map<string, string>();
  if (admin) {
    for (const u of getAllUsers()) {
      const dname = displayNameOf(u);
      for (const e of u.aiConfigs) {
        if (e.id === DEFAULT_AI_CONFIG_ID) continue;
        if (!ownerMap.has(e.id)) ownerMap.set(e.id, dname);
      }
    }
  }

  for (const entry of user.aiConfigs) {
    if (entry.id === DEFAULT_AI_CONFIG_ID) {
      resultConfigs.push(getDefaultAiConfig());
      if (entry.state === 1) activeId = entry.id;
      continue;
    }
    const cfg = data.configs.find(c => c.id === entry.id);
    if (cfg) {
      const enriched: IAiConfig = { ...cfg };
      if (admin) {
        const oname = ownerMap.get(cfg.id);
        if (oname) enriched.ownerName = oname;
      }
      resultConfigs.push(enriched);
      if (entry.state === 1) activeId = entry.id;
    }
  }

  // admin 的额外处理：尚未出现在列表中的配置（向后兼容）
  if (admin) {
    const seenIds = new Set(resultConfigs.map(c => c.id));
    for (const cfg of data.configs) {
      if (!seenIds.has(cfg.id)) {
        const oname = ownerMap.get(cfg.id);
        const enriched: IAiConfig = { ...cfg };
        if (oname) enriched.ownerName = oname;
        resultConfigs.push(enriched);
        const newEntry: IUserAiConfig = { id: cfg.id, state: 0 };
        user.aiConfigs.push(newEntry);
        seenIds.add(cfg.id);
        updateUserAiConfigs(userId, user.aiConfigs);
      }
    }
  }

  return { configs: resultConfigs, activeId };
}

// 获取指定用户当前激活配置
export function getActiveAiConfig(userId?: string): IAiConfig {
  if (!userId) return getDefaultAiConfig();
  const user = findUserById(userId);
  if (!user) return getDefaultAiConfig();
  const active = user.aiConfigs.find(e => e.state === 1);
  if (!active) return getDefaultAiConfig();
  if (active.id === DEFAULT_AI_CONFIG_ID) return getDefaultAiConfig();
  const data = aiConfigStore.read();
  const found = data.configs.find(c => c.id === active.id);
  return found || getDefaultAiConfig();
}

// 新增 AI 配置（添加到 ai-config.json，同时加入用户的 aiConfigs 列表，state=0）
export function addAiConfig(input: IAiConfigCreate, userId: string): IAiConfig {
  const data = aiConfigStore.read();
  const newItem: IAiConfig = {
    id: uuidv4(),
    apiKey: input.apiKey,
    apiUrl: input.apiUrl || config.deepseek.apiUrl,
    model: input.model || config.deepseek.model,
    createdAt: new Date().toISOString(),
  };
  data.configs.push(newItem);
  aiConfigStore.write(data);

  // 同步更新用户的 aiConfigs
  const user = findUserById(userId);
  if (user) {
    const newEntry: IUserAiConfig = { id: newItem.id, state: 0 };
    const updated = [...user.aiConfigs, newEntry];
    updateUserAiConfigs(userId, updated);
  }
  return { id: newItem.id, apiKey: newItem.apiKey, apiUrl: newItem.apiUrl, model: newItem.model, createdAt: newItem.createdAt };
}

// 删除 AI 配置：从 ai-config.json 删除，同时从用户 aiConfigs 移除；若是激活配置，回退到默认
export function deleteAiConfig(id: string, userId: string): boolean {
  if (id === DEFAULT_AI_CONFIG_ID) {
    throw new Error('默认配置不可删除');
  }
  const data = aiConfigStore.read();
  const index = data.configs.findIndex(c => c.id === id);
  if (index === -1) {
    throw new Error('配置不存在');
  }
  data.configs.splice(index, 1);
  aiConfigStore.write(data);

  // 更新用户的 aiConfigs
  const user = findUserById(userId);
  if (user) {
    const wasActive = user.aiConfigs.find(e => e.id === id)?.state === 1;
    const filtered = user.aiConfigs.filter(e => e.id !== id);
    if (wasActive) {
      const hasDefault = filtered.some(e => e.id === DEFAULT_AI_CONFIG_ID);
      if (hasDefault) {
        filtered.forEach(e => { e.state = e.id === DEFAULT_AI_CONFIG_ID ? 1 : 0; });
      } else {
        filtered.forEach(e => { e.state = 0; });
        filtered.push({ id: DEFAULT_AI_CONFIG_ID, state: 1 });
      }
    }
    updateUserAiConfigs(userId, filtered);
  }
  return true;
}

// 激活指定配置：将用户的 aiConfigs 全部置 0，然后把目标配置置 1
export function activateAiConfig(id: string, userId: string): boolean {
  const user = findUserById(userId);
  if (!user) throw new Error('用户不存在');
  const hasConfig = user.aiConfigs.some(e => e.id === id);
  // 默认配置或用户已拥有的配置 → 允许激活
  if (id === DEFAULT_AI_CONFIG_ID || hasConfig) {
    // 确保默认配置在列表中
    const baseList = (id === DEFAULT_AI_CONFIG_ID && !hasConfig)
      ? [...user.aiConfigs, { id: DEFAULT_AI_CONFIG_ID, state: 1 }]
      : user.aiConfigs;
    const updated: IUserAiConfig[] = baseList.map(e => ({ id: e.id, state: e.id === id ? 1 : 0 } as IUserAiConfig));
    updateUserAiConfigs(userId, updated);
    return true;
  }
  throw new Error('配置不存在或无权限激活');
}

// 构建 SQL 生成 Prompt（从可配置模板读取，将 ${schema} / ${question} 做占位符替换）
function buildSqlPrompt(question: string, schema: string): string {
  const template = getPromptTemplate('generate_sql');
  return template.prompt
    .replace(/\$\{schema\}/g, schema)
    .replace(/\$\{question\}/g, question);
}

// SSE 流式生成 SQL（按用户隔离：使用该用户的激活配置）
export async function generateSqlStream(
  request: IAiGenerateRequest,
  onMessage: (msg: ISseMessage) => void,
  userId?: string
): Promise<void> {
  const aiConfig = getActiveAiConfig(userId);
  if (!aiConfig || !aiConfig.apiKey) {
    throw new Error('请先在 AI 配置中添加并激活配置');
  }

  // 若未指定表，则查询当前数据库的所有表（按用户校验归属）
  let tableList = request.tables;
  if (!tableList || tableList.length === 0) {
    const allTables = await getTables(request.connectionId, request.database, userId);
    tableList = allTables.map((t) => t.name);
  }

  // 获取表结构
  const schema = await getTablesSchemaForAI(
    request.connectionId,
    request.database,
    tableList,
    userId
  );

  const prompt = buildSqlPrompt(request.question, schema);

  onMessage({ type: 'thinking', content: '正在分析表结构并生成 SQL...' });

  // 构建消息列表：支持多轮对话
  // - 使用默认配置时：拼接默认配置专属的 system prompt
  // - 使用用户自建配置时：使用通用的 system message（保持简洁）
  const usingDefault = isDefaultAiConfig(aiConfig);
  const systemMessage = {
    role: 'system' as const,
    content: usingDefault
      ? DEFAULT_SYSTEM_PROMPT
      : '你是一个专业的 MySQL SQL 生成助手。只返回可执行的 SQL 语句，不要包含任何解释说明或 markdown 格式。必须严格使用提供的表结构中存在的字段，不能编造字段。'
  };
  const userMessage = { role: 'user' as const, content: prompt };

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [systemMessage];
  // 添加历史对话消息（如果有）
  if (request.messages && request.messages.length > 0) {
    for (const msg of request.messages) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }
  messages.push(userMessage);

  // 调用 DeepSeek API（OpenAI 兼容格式）
  const response = await fetch(aiConfig.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: aiConfig.model,
      messages,
      stream: true,
      temperature: 0.1,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API 调用失败: ${response.status} ${errorText}`);
  }

  const reader = response.body;
  if (!reader) throw new Error('AI API 响应为空');

  const decoder = new TextDecoder();
  let buffer = '';

  const processStream = async () => {
    const readerObj = reader.getReader();
    try {
      while (true) {
        const { done, value } = await readerObj.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              onMessage({ type: 'sql', content });
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } finally {
      readerObj.releaseLock();
    }
  };

  await processStream();
  onMessage({ type: 'done', content: '' });
}

// ==================== SQL 优化（EXPLAIN + AI → 流式输出优化后 SQL） ====================

function buildOptimizePrompt(
  sql: string,
  explainRows: Record<string, unknown>[],
  schema: string | null,
  analysis?: string
): string {
  const explainText = explainRows.length
    ? explainRows.map((r) => JSON.stringify(r)).join('\n')
    : '（EXPLAIN 未返回结果）';
  const template = getPromptTemplate('optimize_sql');
  let prompt = template.prompt
    .replace(/\$\{sql\}/g, sql)
    .replace(/\$\{explain\}/g, explainText)
    .replace(/\$\{schema\}/g, schema || '（调用方未提供表结构信息）');
  if (analysis && analysis.trim()) {
    prompt += `\n\n【本次分析结论（用于参考）】\n${analysis}\n`;
  }
  return prompt;
}

export async function optimizeSqlStream(
  request: { connectionId: string; database: string; sql: string; tables?: string[]; analysis?: string },
  onMessage: (msg: ISseMessage) => void,
  userId?: string
): Promise<void> {
  const aiConfig = getActiveAiConfig(userId);
  if (!aiConfig || !aiConfig.apiKey) {
    throw new Error('请先在 AI 配置中添加并激活配置');
  }

  const trimmedSql = String(request.sql || '').trim();
  if (!trimmedSql) {
    throw new Error('SQL 不能为空');
  }

  // 1. 先跑 EXPLAIN（按用户校验归属）
  onMessage({ type: 'thinking', content: '正在执行 EXPLAIN 分析执行计划...' });
  const explainRows = await explainQuery(request.connectionId, request.database, trimmedSql, userId);

  // 2. 获取表结构信息（按用户校验归属；若未指定则使用当前数据库的所有表）
  let schema: string | null = null;
  try {
    let tablesForSchema: string[] = [];
    if (request.tables && request.tables.length > 0) {
      tablesForSchema = request.tables;
    } else {
      const allTables = await getTables(request.connectionId, request.database, userId);
      tablesForSchema = allTables.map((t) => t.name);
    }
    schema = await getTablesSchemaForAI(request.connectionId, request.database, tablesForSchema, userId);
  } catch {
    schema = null;
  }

  // 3. 构造 prompt 并流式输出（analysis 为调用方传入的本次分析结论，可选）
  const prompt = buildOptimizePrompt(trimmedSql, explainRows, schema, request.analysis);
  onMessage({ type: 'thinking', content: '正在根据 EXPLAIN 结果生成优化 SQL...' });

  // 使用默认配置时，拼接默认配置专属的 system prompt
  const usingDefault = isDefaultAiConfig(aiConfig);
  const systemContent = usingDefault
    ? DEFAULT_SYSTEM_PROMPT
    : '你是资深的 MySQL 性能优化专家，只输出可执行的 SQL 语句，不输出任何解释、Markdown 或代码块。';

  const response = await fetch(aiConfig.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: aiConfig.model,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: prompt },
      ],
      stream: true,
      temperature: 0.2,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API 调用失败: ${response.status} ${errorText}`);
  }

  const reader = response.body;
  if (!reader) throw new Error('AI API 响应为空');

  const decoder = new TextDecoder();
  let buffer = '';

  const processStream = async () => {
    const readerObj = reader.getReader();
    try {
      while (true) {
        const { done, value } = await readerObj.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') return;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              onMessage({ type: 'sql', content });
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } finally {
      readerObj.releaseLock();
    }
  };

  await processStream();
  onMessage({ type: 'done', content: '' });
}

// ==================== AI 历史对话 ====================

// 获取全部历史（按用户隔离，按时间倒序）
export function getAllHistory(userId?: string): IAiHistory[] {
  const items = aiHistoryStore.read() as unknown as IAiHistory[];
  const filtered = userId ? items.filter((h) => h.userId === userId) : items;
  return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// 根据 connectionId 过滤（按用户隔离）
export function getHistoryByConnection(connectionId: string, userId?: string): IAiHistory[] {
  return getAllHistory(userId).filter((h) => h.connectionId === connectionId);
}

// 新增历史（绑定用户）
export function createHistory(data: IAiHistoryCreate, userId?: string): IAiHistory {
  const item: IAiHistory = {
    id: uuidv4(),
    connectionId: data.connectionId,
    database: data.database,
    tables: data.tables,
    question: data.question,
    sql: data.sql,
    userId: userId || '',
    createdAt: new Date().toISOString(),
  };
  aiHistoryStore.insert(item as any);
  return item;
}

// 删除单条（按用户校验归属）
export function deleteHistory(id: string, userId?: string): boolean {
  const items = aiHistoryStore.read() as unknown as IAiHistory[];
  const target = items.find((h) => h.id === id);
  if (!target) return false;
  if (userId && target.userId !== userId) return false;
  return aiHistoryStore.delete(id);
}

// 清空用户自己的全部历史
export function clearAllHistory(userId?: string): number {
  const items = aiHistoryStore.read() as unknown as IAiHistory[];
  let kept: IAiHistory[];
  let removedCount: number;
  if (userId) {
    kept = items.filter((h) => h.userId !== userId);
    removedCount = items.length - kept.length;
  } else {
    kept = [];
    removedCount = items.length;
  }
  aiHistoryStore.write(kept as any);
  return removedCount;
}

// ==================== SQL 性能分析 ====================

function buildAnalyzePrompt(sql: string, explainRows: Record<string, unknown>[]): string {
  const explainText = explainRows.length
    ? explainRows.map((r) => JSON.stringify(r)).join('\n')
    : '（EXPLAIN 未返回结果）';
  const template = getPromptTemplate('analyze_sql');
  return template.prompt
    .replace(/\$\{sql\}/g, sql)
    .replace(/\$\{explain\}/g, explainText);
}

function callAiNonStream(aiConfig: IAiConfig, userPrompt: string, defaultSystemPrompt?: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const usingDefault = isDefaultAiConfig(aiConfig);
      const systemContent = usingDefault && defaultSystemPrompt
        ? defaultSystemPrompt
        : '你是 MySQL 性能优化专家，只输出简洁的分析文本，不输出 Markdown 代码块，不多寒暄。';

      const response = await fetch(aiConfig.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: aiConfig.model,
          messages: [
            { role: 'system', content: systemContent },
            { role: 'user', content: userPrompt },
          ],
          stream: false,
          temperature: 0.2,
          max_tokens: 1200,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        reject(new Error(`AI API 调用失败: ${response.status} ${text}`));
        return;
      }

      const data = (await response.json()) as any;
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        reject(new Error('AI 响应格式异常'));
        return;
      }
      resolve(content.trim());
    } catch (err: any) {
      reject(err);
    }
  });
}

// 去掉 SQL 顶部以 -- 开头的注释行（兼容行首空格、CRLF）
function stripLeadingCommentLines(sql: string): string {
  if (!sql) return sql;
  const lines = sql.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (trimmed === '') { i++; continue; }
    if (trimmed.startsWith('--')) { i++; continue; }
    break;
  }
  return lines.slice(i).join('\n').trim();
}

export async function analyzeSql(
  connectionId: string,
  database: string,
  sql: string,
  userId?: string
): Promise<{ explain: Record<string, unknown>[]; analysis: string; cached: boolean; createdAt?: string }> {
  const aiConfig = getActiveAiConfig(userId);
  if (!aiConfig || !aiConfig.apiKey) {
    throw new Error('请先在 AI 配置中添加并激活配置');
  }

  const trimmedSql = stripLeadingCommentLines(sql);
  if (!trimmedSql) throw new Error('SQL 不能为空');

  // 命中缓存（按用户隔离）
  const cached = findAnalysisCache(trimmedSql, userId);
  if (cached) {
    return { explain: cached.explain, analysis: cached.analysis, cached: true, createdAt: cached.createdAt };
  }

  const explainRows = await explainQuery(connectionId, database, trimmedSql, userId);
  const prompt = buildAnalyzePrompt(trimmedSql, explainRows);
  const analysis = await callAiNonStream(aiConfig, prompt, DEFAULT_SYSTEM_PROMPT);

  // 写入缓存（绑定用户）
  const entry = saveAnalysisCache(trimmedSql, analysis, explainRows, userId);

  return { explain: explainRows, analysis, cached: false, createdAt: entry.createdAt };
}

// ==================== SQL 业务解释 ====================

function buildExplainPrompt(sql: string): string {
  const template = getPromptTemplate('explain_sql');
  return template.prompt.replace(/\$\{sql\}/g, sql);
}

export async function explainSql(sql: string, userId?: string): Promise<{ explanation: string }> {
  const aiConfig = getActiveAiConfig(userId);
  if (!aiConfig || !aiConfig.apiKey) {
    throw new Error('请先在 AI 配置中添加并激活配置');
  }

  const trimmedSql = sql.trim();
  if (!trimmedSql) throw new Error('SQL 不能为空');

  const prompt = buildExplainPrompt(trimmedSql);
  const raw = await callAiNonStream(aiConfig, prompt, DEFAULT_SYSTEM_PROMPT);
  // 去除首尾空白与多余引号，保证输出可以直接拼到 SQL 注释中
  let explanation = raw.trim();
  // 若模型误输出 markdown 代码块，则去除首尾 ```...```
  const fenceMatch = explanation.match(/```(?:[\s\S]*?)\n([\s\S]*?)```/);
  if (fenceMatch && fenceMatch[1]) {
    explanation = fenceMatch[1].trim();
  }
  // 去除以 "解释：" / "结论：" 等前缀（若模型违规添加）
  explanation = explanation.replace(/^(解释[:：]?\s*|结论[:：]?\s*|业务含义[:：]?\s*)/, '').trim();
  // 去除换行，压缩为单行，长度上限 300 字
  explanation = explanation.replace(/\r?\n+/g, ' ').replace(/\s{2,}/g, ' ').slice(0, 300);

  return { explanation };
}

export function listAnalysisHistory(userId?: string) {
  return listAnalysisCache(userId);
}

export function listAnalysisHistoryPage(page: number, pageSize: number, userId?: string) {
  return listAnalysisCachePage(page, pageSize, userId);
}

export function deleteAnalysisHistory(id: string, userId?: string): boolean {
  return deleteAnalysisCacheById(id, userId);
}

export function clearAnalysisHistory(userId?: string): number {
  return clearAnalysisCache(userId);
}

// ==================== 提示词模板管理 ====================

export function listPromptTemplates(): Record<IPromptTemplateType, IPromptTemplate> {
  return getAllPromptTemplates();
}

export function getPrompt(type: IPromptTemplateType): IPromptTemplate {
  return getPromptTemplate(type);
}

export function updatePrompt(type: IPromptTemplateType, prompt: string): IPromptTemplate {
  if (!type) throw new Error('type 必填');
  if (type !== 'generate_sql' && type !== 'analyze_sql' && type !== 'explain_sql') throw new Error('非法的提示词类型');
  if (!prompt || !prompt.trim()) throw new Error('提示词不能为空或纯空白');
  return updatePromptTemplate(type, prompt);
}

export function resetPrompt(type: IPromptTemplateType): IPromptTemplate {
  if (!type) throw new Error('type 必填');
  if (type !== 'generate_sql' && type !== 'analyze_sql' && type !== 'explain_sql') throw new Error('非法的提示词类型');
  return resetPromptTemplate(type);
}

export function defaultPrompt(type: IPromptTemplateType): string {
  return getDefaultPrompt(type);
}
