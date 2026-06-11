import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { IAiConfig, IAiConfigStoreData, IAiHistory } from '../types';

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
