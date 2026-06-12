import { v4 as uuidv4 } from 'uuid';
import { IAiConfig, IAiConfigCreate, IAiConfigStoreData, IAiGenerateRequest, IAiHistory, IAiHistoryCreate, IAiProvider, ISseMessage, IPromptTemplate, IPromptTemplateType } from '../types';
import { aiConfigStore, aiHistoryStore, readActiveAiConfig, getPromptTemplate, getAllPromptTemplates, updatePromptTemplate, resetPromptTemplate, getDefaultPrompt, findAnalysisCache, saveAnalysisCache, listAnalysisCache, clearAnalysisCache } from '../store/json-store';
import { getTablesSchemaForAI } from './database';
import { explainQuery } from './query';
import { config } from '../config';

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

// 获取 AI 配置列表（含 activeId）
export function getAiConfigList(): IAiConfigStoreData {
  return aiConfigStore.read();
}

// 获取当前激活的 AI 配置
export function getActiveAiConfig(): IAiConfig | null {
  return readActiveAiConfig();
}

// 新增 AI 配置（首个配置自动激活）
export function addAiConfig(input: IAiConfigCreate): IAiConfigStoreData {
  const data = aiConfigStore.read();
  const newItem: IAiConfig = {
    id: uuidv4(),
    apiKey: input.apiKey,
    apiUrl: input.apiUrl || config.deepseek.apiUrl,
    model: input.model || config.deepseek.model,
    createdAt: new Date().toISOString(),
  };
  data.configs.push(newItem);
  // 若之前没有激活配置，则自动激活新加的
  if (!data.activeId) {
    data.activeId = newItem.id;
  }
  aiConfigStore.write(data);
  return data;
}

// 删除 AI 配置
export function deleteAiConfig(id: string): IAiConfigStoreData {
  const data = aiConfigStore.read();
  const index = data.configs.findIndex(c => c.id === id);
  if (index === -1) {
    throw new Error('配置不存在');
  }
  data.configs.splice(index, 1);
  // 若删除的是激活配置，则清空 activeId
  if (data.activeId === id) {
    data.activeId = null;
  }
  aiConfigStore.write(data);
  return data;
}

// 激活指定 AI 配置
export function activateAiConfig(id: string): IAiConfigStoreData {
  const data = aiConfigStore.read();
  const exists = data.configs.some(c => c.id === id);
  if (!exists) {
    throw new Error('配置不存在');
  }
  data.activeId = id;
  aiConfigStore.write(data);
  return data;
}

// 构建 SQL 生成 Prompt（从可配置模板读取，将 ${schema} / ${question} 做占位符替换）
function buildSqlPrompt(question: string, schema: string): string {
  const template = getPromptTemplate('generate_sql');
  return template.prompt
    .replace(/\$\{schema\}/g, schema)
    .replace(/\$\{question\}/g, question);
}

// SSE 流式生成 SQL
export async function generateSqlStream(
  request: IAiGenerateRequest,
  onMessage: (msg: ISseMessage) => void
): Promise<void> {
  const aiConfig = getActiveAiConfig();
  if (!aiConfig || !aiConfig.apiKey) {
    throw new Error('请先在 AI 配置中添加并激活配置');
  }

  // 获取表结构
  const schema = await getTablesSchemaForAI(
    request.connectionId,
    request.database,
    request.tables
  );

  const prompt = buildSqlPrompt(request.question, schema);

  onMessage({ type: 'thinking', content: '正在分析表结构并生成 SQL...' });

  // 调用 DeepSeek API（OpenAI 兼容格式）
  const response = await fetch(aiConfig.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: aiConfig.model,
      messages: [
        { role: 'system', content: '你是一个专业的 MySQL SQL 生成助手。只返回可执行的 SQL 语句，不要包含任何解释说明或 markdown 格式。必须严格使用提供的表结构中存在的字段，不能编造字段。' },
        { role: 'user', content: prompt },
      ],
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

// ==================== AI 历史对话 ====================

// 获取全部历史（按时间倒序）
export function getAllHistory(): IAiHistory[] {
  const items = aiHistoryStore.read() as unknown as IAiHistory[];
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// 根据 connectionId 过滤
export function getHistoryByConnection(connectionId: string): IAiHistory[] {
  return getAllHistory().filter(h => h.connectionId === connectionId);
}

// 新增历史
export function createHistory(data: IAiHistoryCreate): IAiHistory {
  const item: IAiHistory = {
    id: uuidv4(),
    connectionId: data.connectionId,
    database: data.database,
    tables: data.tables,
    question: data.question,
    sql: data.sql,
    createdAt: new Date().toISOString(),
  };
  aiHistoryStore.insert(item as any);
  return item;
}

// 删除单条
export function deleteHistory(id: string): boolean {
  return aiHistoryStore.delete(id);
}

// 清空全部
export function clearAllHistory(): number {
  const items = aiHistoryStore.read();
  const count = items.length;
  aiHistoryStore.write([]);
  return count;
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

function callAiNonStream(aiConfig: IAiConfig, userPrompt: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const response = await fetch(aiConfig.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: aiConfig.model,
          messages: [
            { role: 'system', content: '你是 MySQL 性能优化专家，只输出简洁的分析文本，不输出 Markdown 代码块，不多寒暄。' },
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
  sql: string
): Promise<{ explain: Record<string, unknown>[]; analysis: string; cached: boolean; createdAt?: string }> {
  const aiConfig = getActiveAiConfig();
  if (!aiConfig || !aiConfig.apiKey) {
    throw new Error('请先在 AI 配置中添加并激活配置');
  }

  const trimmedSql = stripLeadingCommentLines(sql);
  if (!trimmedSql) throw new Error('SQL 不能为空');

  // 命中缓存（SQL 内容未变化时直接返回已有结果，跳过 EXPLAIN + AI 调用）
  const cached = findAnalysisCache(trimmedSql);
  if (cached) {
    return { explain: cached.explain, analysis: cached.analysis, cached: true, createdAt: cached.createdAt };
  }

  const explainRows = await explainQuery(connectionId, database, trimmedSql);
  const prompt = buildAnalyzePrompt(trimmedSql, explainRows);
  const analysis = await callAiNonStream(aiConfig, prompt);

  // 写入缓存，下次相同 SQL 直接复用
  const entry = saveAnalysisCache(trimmedSql, analysis, explainRows);

  return { explain: explainRows, analysis, cached: false, createdAt: entry.createdAt };
}

// ==================== SQL 业务解释 ====================

function buildExplainPrompt(sql: string): string {
  const template = getPromptTemplate('explain_sql');
  return template.prompt.replace(/\$\{sql\}/g, sql);
}

export async function explainSql(sql: string): Promise<{ explanation: string }> {
  const aiConfig = getActiveAiConfig();
  if (!aiConfig || !aiConfig.apiKey) {
    throw new Error('请先在 AI 配置中添加并激活配置');
  }

  const trimmedSql = sql.trim();
  if (!trimmedSql) throw new Error('SQL 不能为空');

  const prompt = buildExplainPrompt(trimmedSql);
  const raw = await callAiNonStream(aiConfig, prompt);
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

export function listAnalysisHistory() {
  return listAnalysisCache();
}

export function clearAnalysisHistory(): number {
  return clearAnalysisCache();
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
