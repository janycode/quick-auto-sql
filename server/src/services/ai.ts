import { v4 as uuidv4 } from 'uuid';
import { IAiConfig, IAiConfigCreate, IAiConfigStoreData, IAiGenerateRequest, IAiHistory, IAiHistoryCreate, IAiProvider, ISseMessage } from '../types';
import { aiConfigStore, aiHistoryStore, readActiveAiConfig } from '../store/json-store';
import { getTablesSchemaForAI } from './database';
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

// 构建 SQL 生成 Prompt
function buildSqlPrompt(question: string, schema: string): string {
//   return `你是一个专业的 SQL 生成助手。根据用户的自然语言描述和提供的表结构信息，生成准确的 MySQL SQL 语句。

// ## 数据库表结构

// ${schema}

// ## 用户问题
// ${question}

// ## 严格要求
// 1. 只返回一条可执行的 SQL 语句，不要包含任何解释说明、注释或 markdown 格式
// 2. SQL 必须兼容 MySQL 语法
// 3. **只能使用上面表结构中明确存在的字段，禁止编造或猜测任何不存在的字段**
// 4. 如果涉及多表查询，请使用合适的 JOIN，并确保 JOIN 条件使用正确的关联字段
// 5. 添加必要的 WHERE 条件
// 6. 对大数据量查询添加 LIMIT
// 7. 对生成的SQL进行预先 explain 确认，确保查询性能最高
// 8. 如果用户问题涉及的信息在提供的表结构中无法满足，请在 SQL 中用注释说明`;
    return `你是专业的MySQL SQL生成专家，严格基于提供的表结构生成准确、高效、可直接执行的SQL语句。

【输入信息】
### 数据库表结构
${schema}

### 用户查询需求
${question}

【核心强制规则（必须100%遵守，违反将导致严重错误）】
1. 输出要求：仅输出单行纯SQL语句，绝对禁止任何解释、说明、Markdown格式、代码块标记、多余换行。正常生成的SQL中不得出现任何注释。
2. 语法规范：严格遵循MySQL 5.7+ 语法，如果表名、字段名与MySQL 关键字冲突则必须用反引号\`包裹，一般情况下不需要包裹；字符串统一使用单引号；禁止使用其他数据库专属语法。
3. 字段约束：只能使用上表中明确存在的表和字段，绝对禁止编造、臆测任何不存在的表名、字段名，如果字段包含了下划线_则必须使用 AS 别名进行小驼峰重命名，不含下划线_则不需要重命名。
4. 多表查询：必须使用有意义的表别名，所有字段必须携带表别名前缀；JOIN必须携带正确的关联字段，禁止无关联条件的笛卡尔积。
5. 性能要求：
   - 禁止使用SELECT *，必须显式列出所需字段
   - WHERE、JOIN、ORDER BY条件优先使用主键/索引字段
   - 禁止在WHERE条件的字段上使用函数或运算，避免索引失效
   - 所有查询默认追加 LIMIT 100，用户明确指定返回数量时按用户要求执行
6. 安全约束：UPDATE、DELETE语句必须携带WHERE条件，绝对禁止全表更新/删除。
7. 函数要求：仅使用MySQL原生函数，优先选择性能最优的实现方式。

【异常处理规则】
若用户需求无法通过提供的表结构实现、缺少必要字段或语义完全无法理解，请仅输出单行内容：
-- 错误：当前表结构无法支持该查询需求

最终仅输出SQL或异常注释，不得有任何其他内容。`
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
            onMessage({ type: 'done', content: '' });
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
