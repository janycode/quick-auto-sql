import fs from 'fs';
import path from 'path';
import { config } from '../config';

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
export const aiConfigStore = (() => {
  // AI 配置使用对象而非数组
  const filePath = path.join(config.dataDir, 'ai-config.json');
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify({ apiKey: '', apiUrl: config.deepseek.apiUrl, model: config.deepseek.model }, null, 2), 'utf-8');
  }
  return {
    read(): any {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    },
    write(data: any): void {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    },
  };
})();
