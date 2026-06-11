import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { IAiConfig, IAiConfigStoreData, IAiHistory, IPromptTemplate, IPromptTemplateType } from '../types';

// ==================== 默认提示词模板 ====================

const DEFAULT_GENERATE_SQL_PROMPT = `你是专业的MySQL SQL生成专家，严格基于提供的表结构生成准确、高效、可直接执行的SQL语句。

【输入信息】
### 数据库表结构
\${schema}

### 用户查询需求
\${question}

【核心强制规则（必须100%遵守，违反将导致严重错误）】
1. 输出要求：仅输出单行纯SQL语句，绝对禁止任何解释、说明、Markdown格式、代码块标记、多余换行。正常生成的SQL中不得出现任何注释。
2. 语法规范：严格遵循MySQL 5.7+ 语法，如果表名、字段名与MySQL 关键字冲突则必须用反引号\`包裹，一般情况下不需要包裹；字符串统一使用单引号；禁止使用其他数据库专属语法。
3. 字段约束：只能使用上表中明确存在的表和字段，绝对禁止编造、臆测任何不存在的表名、字段名，如果字段包含了下划线_则【必须】使用 AS 别名进行小驼峰重命名，字段不含下划线_则不需要重命名。
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

最终仅输出SQL或异常注释，不得有任何其他内容。`;

const DEFAULT_ANALYZE_SQL_PROMPT = `你是资深 MySQL 性能优化专家。请基于以下 SQL 及其 EXPLAIN 结果，给出极简、可执行的分析结论与优化建议。

【待分析 SQL】
\${sql}

【EXPLAIN 结果（每行一个 JSON 对象）】
\${explain}

【输出格式要求（严格遵守，禁止输出 Markdown 代码块、禁止多余寒暄）】
- 整体评估：一句话（优/良/中/差 + 关键原因）
- 关键发现：
  • 要点1
  • 要点2
  ...
- 优化建议：
  • 建议1（含具体SQL/索引变更）
  • 建议2（含具体SQL/索引变更）
  ...

【风格约束】
1. 每项不超过 40 字；
2. 聚焦 EXPLAIN 关键指标：type(ALL/index/ref/eq_ref/const)、rows、filtered、Extra(Using where/Using filesort/Using temporary/Using index/Impossible WHERE)、possible_keys 与 key；
3. 给出可落地、可直接执行的索引建议（如"ALTER TABLE 表名 ADD INDEX idx_xxx(col)"）或改写建议；
4. 若 SQL 本身已高效，则简洁说明"无需优化"。`;

const DEFAULT_EXPLAIN_SQL_PROMPT = `你是专业的 MySQL 业务分析师。请针对以下 SQL 语句，给出简练准确的业务功能解释。

【待解释 SQL】
\${sql}

【输出规则（严格遵守，违者重罚）】
1. 仅输出一句中文业务描述，总长度控制在 40~120 字之间；
2. 必须涵盖：操作类型（SELECT/INSERT/UPDATE/DELETE/其他）+ 涉及的主表 + 过滤条件的业务含义 + 结果集用途；
3. 不输出 Markdown、不输出代码块、不输出任何说明性前缀（如"解释："、"结论："等）；
4. 表述自然，可被普通业务人员理解，避免过多技术术语；
5. 若 SQL 无法理解，则仅输出"无法解析该 SQL 的业务含义"。

【示例参考】
- 输入: SELECT name, age FROM users WHERE status = 1 ORDER BY created_at DESC LIMIT 10
- 输出: 从用户表中筛选已启用状态的用户，按创建时间倒序排列，取前 10 条记录，用于展示最新活跃用户列表。

请直接输出业务描述，不包含任何其他内容。`;

export function getDefaultPrompt(type: IPromptTemplateType): string {
  if (type === 'generate_sql') return DEFAULT_GENERATE_SQL_PROMPT;
  if (type === 'analyze_sql') return DEFAULT_ANALYZE_SQL_PROMPT;
  return DEFAULT_EXPLAIN_SQL_PROMPT;
}

// ==================== 提示词模板存储 ====================

const PROMPT_STORE_FILE = 'ai-prompts.json';

function readPromptStore(): Record<IPromptTemplateType, IPromptTemplate> {
  const filePath = path.join(config.dataDir, PROMPT_STORE_FILE);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let parsed: any = null;
  if (fs.existsSync(filePath)) {
    try {
      parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      parsed = null;
    }
  }

  const now = new Date().toISOString();
  const defaults: Record<IPromptTemplateType, IPromptTemplate> = {
    generate_sql: {
      type: 'generate_sql',
      prompt: DEFAULT_GENERATE_SQL_PROMPT,
      updatedAt: (parsed && parsed.generate_sql?.updatedAt) || now,
    },
    analyze_sql: {
      type: 'analyze_sql',
      prompt: DEFAULT_ANALYZE_SQL_PROMPT,
      updatedAt: (parsed && parsed.analyze_sql?.updatedAt) || now,
    },
    explain_sql: {
      type: 'explain_sql',
      prompt: DEFAULT_EXPLAIN_SQL_PROMPT,
      updatedAt: (parsed && parsed.explain_sql?.updatedAt) || now,
    },
  };

  // 迁移或补齐：如果文件中缺少某个类型，使用默认值补齐但保留原 prompt 内容
  if (parsed && parsed.generate_sql?.prompt) defaults.generate_sql.prompt = parsed.generate_sql.prompt;
  if (parsed && parsed.analyze_sql?.prompt) defaults.analyze_sql.prompt = parsed.analyze_sql.prompt;
  if (parsed && parsed.explain_sql?.prompt) defaults.explain_sql.prompt = parsed.explain_sql.prompt;

  return defaults;
}

function writePromptStore(data: Record<IPromptTemplateType, IPromptTemplate>): void {
  const filePath = path.join(config.dataDir, PROMPT_STORE_FILE);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function getAllPromptTemplates(): Record<IPromptTemplateType, IPromptTemplate> {
  return readPromptStore();
}

export function getPromptTemplate(type: IPromptTemplateType): IPromptTemplate {
  const all = readPromptStore();
  return all[type] || { type, prompt: getDefaultPrompt(type), updatedAt: new Date().toISOString() };
}

export function updatePromptTemplate(type: IPromptTemplateType, prompt: string): IPromptTemplate {
  if (!prompt || !prompt.trim()) {
    throw new Error('提示词不能为空');
  }
  const all = readPromptStore();
  const updated: IPromptTemplate = {
    type,
    prompt,
    updatedAt: new Date().toISOString(),
  };
  all[type] = updated;
  writePromptStore(all);
  return updated;
}

export function resetPromptTemplate(type: IPromptTemplateType): IPromptTemplate {
  const all = readPromptStore();
  const reset: IPromptTemplate = {
    type,
    prompt: getDefaultPrompt(type),
    updatedAt: new Date().toISOString(),
  };
  all[type] = reset;
  writePromptStore(all);
  return reset;
}

export class JsonStore<T = unknown> {
  private filePath: string;

  constructor(fileName: string) {
    this.filePath = path.join(config.dataDir, fileName);
    this.ensureFile();
  }

  private ensureFile(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, '[]', 'utf-8');
    }
  }

  read(): T[] {
    const content = fs.readFileSync(this.filePath, 'utf-8');
    return JSON.parse(content) as T[];
  }

  write(data: T[]): void {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  findById(id: string): T | undefined {
    const items = this.read();
    return items.find((item: any) => item.id === id);
  }

  insert(item: T): void {
    const items = this.read();
    items.push(item);
    this.write(items);
  }

  update(id: string, updates: Partial<T>): T | undefined {
    const items = this.read();
    const index = items.findIndex((item: any) => item.id === id);
    if (index === -1) return undefined;
    items[index] = { ...items[index], ...updates };
    this.write(items);
    return items[index] as T;
  }

  delete(id: string): boolean {
    const items = this.read();
    const index = items.findIndex((item: any) => item.id === id);
    if (index === -1) return false;
    items.splice(index, 1);
    this.write(items);
    return true;
  }
}

// 单例存储实例
export const connectionStore = new JsonStore('connections.json');
export const aiHistoryStore = new JsonStore<{ id: string; [key: string]: unknown }>('ai-history.json');

// ==================== SQL 性能分析缓存（按 SQL 内容哈希） ====================

export interface ISqlAnalysisCacheEntry {
  sql: string;
  analysis: string;
  explain: Record<string, unknown>[];
  createdAt: string;
}

const SQL_ANALYSIS_CACHE_FILE = 'ai-sql-analysis-cache.json';

const analysisCacheStore = new JsonStore<ISqlAnalysisCacheEntry>(SQL_ANALYSIS_CACHE_FILE);

// 对 SQL 做稳定 hash，忽略首尾空白与大小写（内容变化时才会视为新 SQL）
function hashSql(sql: string): string {
  const normalized = sql
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  let h1: number = 0x811c9dc5;
  let h2: number = 0xdeadbeef;
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ ch, 0x85ebca77) >>> 0;
  }
  const s1 = h1.toString(16).padStart(8, '0');
  const s2 = h2.toString(16).padStart(8, '0');
  return `${s1}${s2}`;
}

export function findAnalysisCache(sql: string): ISqlAnalysisCacheEntry | undefined {
  if (!sql) return undefined;
  const targetHash = hashSql(sql);
  const items = analysisCacheStore.read();
  for (const item of items) {
    if (item && hashSql(item.sql) === targetHash) return item;
  }
  return undefined;
}

export function saveAnalysisCache(sql: string, analysis: string, explain: Record<string, unknown>[]): ISqlAnalysisCacheEntry {
  const entry: ISqlAnalysisCacheEntry = {
    sql,
    analysis,
    explain,
    createdAt: new Date().toISOString(),
  };
  // 若已存在相同 SQL，则覆盖；否则追加
  const items = analysisCacheStore.read();
  const targetHash = hashSql(sql);
  const existingIdx = items.findIndex(i => hashSql(i.sql) === targetHash);
  if (existingIdx >= 0) {
    items[existingIdx] = entry;
  } else {
    items.push(entry);
    // 最多保留最近 200 条，避免文件无限膨胀
    if (items.length > 200) {
      items.splice(0, items.length - 200);
    }
  }
  analysisCacheStore.write(items);
  return entry;
}

export function clearAnalysisCache(): number {
  const count = (analysisCacheStore.read() || []).length;
  analysisCacheStore.write([]);
  return count;
}

export function listAnalysisCache(): ISqlAnalysisCacheEntry[] {
  const items = analysisCacheStore.read();
  // 按 createdAt 倒序返回，最新的在最前
  return [...items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// AI 配置存储（多配置 + activeId）
export const aiConfigStore = (() => {
  const filePath = path.join(config.dataDir, 'ai-config.json');
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 初始化文件，兼容旧版单对象结构
  if (!fs.existsSync(filePath)) {
    const initial: IAiConfigStoreData = { configs: [], activeId: null };
    fs.writeFileSync(filePath, JSON.stringify(initial, null, 2), 'utf-8');
  } else {
    // 若旧版结构则迁移为新结构
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (!raw || !('configs' in raw) || !('activeId' in raw)) {
        const migrated: IAiConfigStoreData = {
          configs: raw?.apiKey
            ? [{
                id: uuidv4(),
                apiKey: raw.apiKey,
                apiUrl: raw.apiUrl || config.deepseek.apiUrl,
                model: raw.model || config.deepseek.model,
                createdAt: new Date().toISOString(),
              }]
            : [],
          activeId: null,
        };
        migrated.activeId = migrated.configs[0]?.id || null;
        fs.writeFileSync(filePath, JSON.stringify(migrated, null, 2), 'utf-8');
      }
    } catch {
      // 解析失败则重置
      const initial: IAiConfigStoreData = { configs: [], activeId: null };
      fs.writeFileSync(filePath, JSON.stringify(initial, null, 2), 'utf-8');
    }
  }

  return {
    read(): IAiConfigStoreData {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as IAiConfigStoreData;
    },
    write(data: IAiConfigStoreData): void {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    },
  };
})();

// 当前激活的 AI 配置
export function readActiveAiConfig(): IAiConfig | null {
  const data = aiConfigStore.read();
  if (!data.activeId) return null;
  return data.configs.find(c => c.id === data.activeId) || null;
}
