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

const DEFAULT_OPTIMIZE_SQL_PROMPT = `你是资深 MySQL 性能优化专家，请根据以下原始 SQL 的 EXPLAIN 分析结果，生成一条性能更优的等价 SQL。

【原始 SQL】
\${sql}

【EXPLAIN 结果（每行一个 JSON 对象）】
\${explain}

【相关表结构（如提供）】
\${schema}

【输出规则（严格遵守，违者重罚）】
1. 仅输出一条可直接执行的 SQL 语句，不得包含任何解释、说明、Markdown 格式、代码块标记；
2. 保持与原 SQL 完全等价的业务语义；
3. 优化方向（根据 EXPLAIN 选择可落地的 2-3 项即可）：
   - 消除 Using filesort / Using temporary（改写 ORDER BY / GROUP BY 字段与索引对齐）
   - 避免 type=ALL 全表扫描（确保 WHERE/JOIN 条件命中索引）
   - 避免 SELECT *，只取需要的字段
   - 简化 IN/子查询为 JOIN（当子查询无聚合时）
   - 避免在 WHERE 字段上使用函数/运算导致索引失效
   - 适当添加合理的 LIMIT（如原 SQL 缺少时）
4. 表名、字段名必须与原始 SQL 一致，禁止臆造；
5. 如果 EXPLAIN 显示 SQL 本身已经高效（type 非 ALL、rows 较小、无 filesort/temporary），则原样返回原始 SQL。

请仅输出优化后的 SQL，不包含任何其他内容。`;

export function getDefaultPrompt(type: IPromptTemplateType): string {
  if (type === 'generate_sql') return DEFAULT_GENERATE_SQL_PROMPT;
  if (type === 'analyze_sql') return DEFAULT_ANALYZE_SQL_PROMPT;
  if (type === 'explain_sql') return DEFAULT_EXPLAIN_SQL_PROMPT;
  return DEFAULT_OPTIMIZE_SQL_PROMPT;
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
    optimize_sql: {
      type: 'optimize_sql',
      prompt: DEFAULT_OPTIMIZE_SQL_PROMPT,
      updatedAt: (parsed && parsed.optimize_sql?.updatedAt) || now,
    },
  };

  // 迁移或补齐：如果文件中缺少某个类型，使用默认值补齐但保留原 prompt 内容
  if (parsed && parsed.generate_sql?.prompt) defaults.generate_sql.prompt = parsed.generate_sql.prompt;
  if (parsed && parsed.analyze_sql?.prompt) defaults.analyze_sql.prompt = parsed.analyze_sql.prompt;
  if (parsed && parsed.explain_sql?.prompt) defaults.explain_sql.prompt = parsed.explain_sql.prompt;
  if (parsed && parsed.optimize_sql?.prompt) defaults.optimize_sql.prompt = parsed.optimize_sql.prompt;

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

// ==================== SQL 执行历史 ====================

export interface IQueryHistoryEntry {
  id: string;
  sql: string;
  connectionId: string;
  database: string;
  executionTime: number;
  rowCount: number;
  success: boolean;
  errorMessage?: string;
  userId: string;       // 所属用户
  createdAt: string;
}

const QUERY_HISTORY_FILE = 'query-history.json';
const queryHistoryStore = new JsonStore<IQueryHistoryEntry>(QUERY_HISTORY_FILE);
const QUERY_HISTORY_MAX = 500;

export function addQueryHistory(entry: Omit<IQueryHistoryEntry, 'id' | 'createdAt'>): IQueryHistoryEntry {
  const items = queryHistoryStore.read();
  const newEntry: IQueryHistoryEntry = {
    ...entry,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
  };
  items.unshift(newEntry);
  if (items.length > QUERY_HISTORY_MAX) {
    items.splice(QUERY_HISTORY_MAX);
  }
  queryHistoryStore.write(items);
  return newEntry;
}

export function listQueryHistoryPage(page: number, pageSize: number, connectionId?: string, userId?: string): { items: IQueryHistoryEntry[]; total: number } {
  let items = queryHistoryStore.read();
  if (userId) {
    items = items.filter((i) => i.userId === userId);
  }
  if (connectionId) {
    items = items.filter((i) => i.connectionId === connectionId);
  }
  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const total = items.length;
  const safePage = Math.max(1, page);
  const safeSize = Math.max(1, Math.min(200, pageSize));
  const start = (safePage - 1) * safeSize;
  return { items: items.slice(start, start + safeSize), total };
}

export function deleteQueryHistory(id: string, userId?: string): boolean {
  const items = queryHistoryStore.read();
  const idx = items.findIndex((i) => i.id === id);
  if (idx < 0) return false;
  if (userId && items[idx].userId !== userId) return false;
  items.splice(idx, 1);
  queryHistoryStore.write(items);
  return true;
}

export function clearQueryHistory(userId?: string): number {
  const items = queryHistoryStore.read();
  if (!userId) {
    const count = items.length;
    queryHistoryStore.write([]);
    return count;
  }
  const kept = items.filter((i) => i.userId !== userId);
  const count = items.length - kept.length;
  queryHistoryStore.write(kept);
  return count;
}

// ==================== SQL 性能分析缓存（按 SQL 内容哈希；按用户隔离） ====================

export interface ISqlAnalysisCacheEntry {
  id: string;
  sql: string;
  analysis: string;
  explain: Record<string, unknown>[];
  userId: string;       // 所属用户
  createdAt: string;
}

const SQL_ANALYSIS_CACHE_FILE = 'ai-sql-analysis-cache.json';

const analysisCacheStore = new JsonStore<ISqlAnalysisCacheEntry>(SQL_ANALYSIS_CACHE_FILE);

// 对 SQL 做稳定 hash，忽略首尾空白与大小写
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

export function findAnalysisCache(sql: string, userId?: string): ISqlAnalysisCacheEntry | undefined {
  if (!sql) return undefined;
  const targetHash = hashSql(sql);
  const items = readAnalysisCacheWithMigration();
  for (const item of items) {
    if (!item) continue;
    if (userId && item.userId !== userId) continue;
    if (hashSql(item.sql) === targetHash) return item;
  }
  return undefined;
}

function readAnalysisCacheWithMigration(): ISqlAnalysisCacheEntry[] {
  const items = analysisCacheStore.read();
  let changed = false;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it || !it.id || it.userId === undefined) {
      items[i] = {
        id: (it as any)?.id || uuidv4(),
        sql: (it as any)?.sql || '',
        analysis: (it as any)?.analysis || '',
        explain: (it as any)?.explain || [],
        userId: (it as any)?.userId || '',
        createdAt: (it as any)?.createdAt || new Date().toISOString(),
      };
      changed = true;
    }
  }
  if (changed) analysisCacheStore.write(items);
  return items;
}

export function saveAnalysisCache(sql: string, analysis: string, explain: Record<string, unknown>[], userId?: string): ISqlAnalysisCacheEntry {
  const items = readAnalysisCacheWithMigration();
  const targetHash = hashSql(sql);
  const existingIdx = items.findIndex((i) => i.userId === (userId || '') && hashSql(i.sql) === targetHash);
  const entry: ISqlAnalysisCacheEntry = {
    id: existingIdx >= 0 && items[existingIdx]?.id ? items[existingIdx].id : uuidv4(),
    sql,
    analysis,
    explain,
    userId: userId || '',
    createdAt: new Date().toISOString(),
  };
  if (existingIdx >= 0) {
    items[existingIdx] = entry;
  } else {
    items.push(entry);
    // 最多保留最近 200 条（按用户聚合后总量更合理，但为简单起见按总量限制）
    if (items.length > 200) {
      items.splice(0, items.length - 200);
    }
  }
  analysisCacheStore.write(items);
  return entry;
}

export function deleteAnalysisCacheById(id: string, userId?: string): boolean {
  if (!id) return false;
  const items = readAnalysisCacheWithMigration();
  const idx = items.findIndex((i) => i && i.id === id);
  if (idx < 0) return false;
  if (userId && items[idx].userId !== userId) return false;
  items.splice(idx, 1);
  analysisCacheStore.write(items);
  return true;
}

export function clearAnalysisCache(userId?: string): number {
  const items = readAnalysisCacheWithMigration() || [];
  if (!userId) {
    analysisCacheStore.write([]);
    return items.length;
  }
  const kept = items.filter((i) => i.userId !== userId);
  const count = items.length - kept.length;
  analysisCacheStore.write(kept);
  return count;
}

export function listAnalysisCache(userId?: string): ISqlAnalysisCacheEntry[] {
  const items = readAnalysisCacheWithMigration();
  const filtered = userId ? items.filter((i) => i.userId === userId) : items;
  return [...filtered].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function listAnalysisCachePage(page: number, pageSize: number, userId?: string): { items: ISqlAnalysisCacheEntry[]; total: number } {
  const items = readAnalysisCacheWithMigration();
  const filtered = userId ? items.filter((i) => i.userId === userId) : items;
  const sorted = [...filtered].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const total = sorted.length;
  const safePage = Math.max(1, Number.isFinite(page) ? page : 1);
  const safeSize = Math.max(1, Math.min(200, Number.isFinite(pageSize) ? pageSize : 10));
  const start = (safePage - 1) * safeSize;
  const end = start + safeSize;
  return { items: sorted.slice(start, end), total };
}

// 默认 AI 配置 ID（与 services/ai.ts 保持一致）
export const DEFAULT_AI_CONFIG_ID = 'default-openrouter';

// AI 配置存储（多配置 + 按用户激活）
/**
 * ai-config.json 配置格式：
 * {
 *   "configs": [
 *     {
 *       "id": "default-openrouter",
 *       "apiKey": "sk-...",
 *       "apiUrl": "https://openrouter.ai/api/v1/chat/completions",
 *       "model": "openrouter/free",
 *       "createdAt": "2026-06-24T08:21:20.914Z",
 *       "isDefault": true,
 *       "displayModel": "默认模型",
 *       "displayApiUrl": "https://localhost/api/v1/chat/completions"
 *     }
 *   ]
 * }
 */
export const aiConfigStore = (() => {
  const filePath = path.join(config.dataDir, 'ai-config.json');
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 确保默认配置存在于 configs 数组中（安全：apiKey 为空，需管理员手动配置）
  function ensureDefaultConfig(data: IAiConfigStoreData): IAiConfigStoreData {
    const hasDefault = data.configs.some(c => c.id === DEFAULT_AI_CONFIG_ID);
    if (!hasDefault) {
      data.configs.unshift({
        id: DEFAULT_AI_CONFIG_ID,
        apiKey: '',
        apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
        model: 'openrouter/free',
        createdAt: new Date().toISOString(),
        isDefault: true,
        displayModel: '默认模型',
        displayApiUrl: 'https://localhost/api/v1/chat/completions',
      });
    }
    return data;
  }

  // 初始化文件（支持旧版结构 → 新版：仅保留 configs 数组，激活状态由 users.json 管理）
  if (!fs.existsSync(filePath)) {
    const initial: IAiConfigStoreData = ensureDefaultConfig({ configs: [] });
    fs.writeFileSync(filePath, JSON.stringify(initial, null, 2), 'utf-8');
  } else {
    // 迁移：任何旧版结构 → 新版（仅保留 configs 数组，忽略 activeId / activeByUser）
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      let needsMigration = false;
      let migrated: IAiConfigStoreData;

      // 极旧版：单对象 { apiKey, apiUrl, model }
      if (raw && !('configs' in raw)) {
        migrated = {
          configs: raw?.apiKey
            ? [{
                id: uuidv4(),
                apiKey: raw.apiKey,
                apiUrl: raw.apiUrl || config.deepseek.apiUrl,
                model: raw.model || config.deepseek.model,
                createdAt: new Date().toISOString(),
              }]
            : [],
        };
        needsMigration = true;
      }
      // 旧版：有 configs + activeId/activeByUser → 保留 configs
      else if (raw && 'configs' in raw) {
        migrated = { configs: raw.configs || [] };
        // 如果原始数据还有 activeByUser / activeId，那就是新旧结构差异 → 需要重写
        needsMigration = 'activeByUser' in raw || 'activeId' in raw;
      } else {
        migrated = { configs: [] };
        needsMigration = true;
      }

      // 确保默认配置存在
      const beforeCount = migrated.configs.length;
      migrated = ensureDefaultConfig(migrated);
      if (migrated.configs.length !== beforeCount) {
        needsMigration = true;
      }

      if (needsMigration) {
        fs.writeFileSync(filePath, JSON.stringify(migrated, null, 2), 'utf-8');
      }
    } catch {
      // 解析失败则重置
      const initial: IAiConfigStoreData = ensureDefaultConfig({ configs: [] });
      fs.writeFileSync(filePath, JSON.stringify(initial, null, 2), 'utf-8');
    }
  }

  return {
    read(): IAiConfigStoreData {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as IAiConfigStoreData;
      // 运行时也确保默认配置存在（防止手动删除）
      return ensureDefaultConfig(data);
    },
    write(data: IAiConfigStoreData): void {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    },
  };
})();

// 当前激活的 AI 配置（不再使用，保留旧接口用于兼容；新项目建议直接走 services/ai.ts）
export function readActiveAiConfig(): IAiConfig | null {
  const data = aiConfigStore.read();
  return null;  // 按用户隔离后，全局 activeId 无意义；调用方应传入 userId
}
