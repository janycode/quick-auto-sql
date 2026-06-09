import { IAiConfig, IAiGenerateRequest, ISseMessage } from '../types';
import { aiConfigStore } from '../store/json-store';
import { getTablesSchemaForAI } from './database';
import { config } from '../config';

// 获取 AI 配置
export function getAiConfig(): IAiConfig {
  return aiConfigStore.read() as IAiConfig;
}

// 更新 AI 配置
export function updateAiConfig(updates: Partial<IAiConfig>): IAiConfig {
  const current = aiConfigStore.read() as IAiConfig;
  const updated = { ...current, ...updates };
  aiConfigStore.write(updated);
  return updated;
}

// 构建 SQL 生成 Prompt
function buildSqlPrompt(question: string, schema: string): string {
  return `你是一个专业的 SQL 生成助手。根据用户的自然语言描述和提供的表结构信息，生成准确的 MySQL SQL 语句。

## 数据库表结构

${schema}

## 用户问题
${question}

## 严格要求
1. 只返回一条可执行的 SQL 语句，不要包含任何解释说明、注释或 markdown 格式
2. SQL 必须兼容 MySQL 语法
3. **只能使用上面表结构中明确存在的字段，绝对不能编造或猜测任何不存在的字段**
4. 如果涉及多表查询，请使用合适的 JOIN，并确保 JOIN 条件使用正确的关联字段
5. 添加必要的 WHERE 条件
6. 对大数据量查询添加 LIMIT
7. 如果用户问题涉及的信息在提供的表结构中无法满足，请在 SQL 中用注释说明`;
}

// SSE 流式生成 SQL
export async function generateSqlStream(
  request: IAiGenerateRequest,
  onMessage: (msg: ISseMessage) => void
): Promise<void> {
  const aiConfig = getAiConfig();
  if (!aiConfig.apiKey) {
    throw new Error('请先配置 AI API Key');
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
