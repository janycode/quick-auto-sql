import { IDatabase, ITable, IColumn } from '../types';
import { getPoolById } from './connection';

// 获取数据库列表
export async function getDatabases(connectionId: string): Promise<IDatabase[]> {
  const pool = getPoolById(connectionId);
  if (!pool) throw new Error('连接不存在或未配置');

  const [rows] = await pool.query(
    `SELECT SCHEMA_NAME as name, DEFAULT_CHARACTER_SET_NAME as charset, DEFAULT_COLLATION_NAME as collation
     FROM INFORMATION_SCHEMA.SCHEMATA
     WHERE SCHEMA_NAME NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
     ORDER BY SCHEMA_NAME`
  );
  return rows as IDatabase[];
}

// 获取表列表
export async function getTables(connectionId: string, database: string): Promise<ITable[]> {
  const pool = getPoolById(connectionId);
  if (!pool) throw new Error('连接不存在或未配置');

  const [rows] = await pool.query(
    `SELECT TABLE_NAME as name, TABLE_COMMENT as comment, ENGINE as engine, TABLE_ROWS as rowCount
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_NAME`,
    [database]
  );
  return rows as ITable[];
}

// 获取表字段信息
export async function getColumns(connectionId: string, database: string, table: string): Promise<IColumn[]> {
  const pool = getPoolById(connectionId);
  if (!pool) throw new Error('连接不存在或未配置');

  const [rows] = await pool.query(
    `SELECT
       COLUMN_NAME as name,
       COLUMN_TYPE as type,
       IS_NULLABLE = 'YES' as nullable,
       COLUMN_DEFAULT as defaultValue,
       COLUMN_COMMENT as comment,
       COLUMN_KEY = 'PRI' as isPrimary,
       EXTRA LIKE '%auto_increment%' as autoIncrement
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [database, table]
  );
  return rows as IColumn[];
}

// 获取表 DDL
export async function getTableDDL(connectionId: string, database: string, table: string): Promise<string> {
  const pool = getPoolById(connectionId);
  if (!pool) throw new Error('连接不存在或未配置');

  try {
    const conn = await pool.getConnection();
    await conn.changeUser({ database });
    try {
      const [rows] = await conn.query(`SHOW CREATE TABLE \`${table}\``);
      const result = rows as any[];
      if (result.length > 0) {
        return result[0]['Create Table'] || '';
      }
      return '';
    } finally {
      conn.release();
    }
  } catch {
    // 回退方案：使用 INFORMATION_SCHEMA 拼接
    return await buildDDLFromSchema(connectionId, database, table);
  }
}

// 通过 INFORMATION_SCHEMA 拼接 DDL
async function buildDDLFromSchema(connectionId: string, database: string, table: string): Promise<string> {
  const columns = await getColumns(connectionId, database, table);

  let ddl = `CREATE TABLE \`${table}\` (\n`;
  const colDefs = columns.map(col => {
    let def = `  \`${col.name}\` ${col.type}`;
    if (!col.nullable) def += ' NOT NULL';
    if (col.autoIncrement) def += ' AUTO_INCREMENT';
    if (col.defaultValue !== null) def += ` DEFAULT '${col.defaultValue}'`;
    if (col.comment) def += ` COMMENT '${col.comment}'`;
    return def;
  });

  const pks = columns.filter(c => c.isPrimary).map(c => `\`${c.name}\``);
  if (pks.length > 0) {
    colDefs.push(`  PRIMARY KEY (${pks.join(', ')})`);
  }

  ddl += colDefs.join(',\n');
  ddl += `\n)`;
  return ddl;
}

// 获取多张表的完整结构描述（用于 AI Prompt），使用 DDL + 字段注释
export async function getTablesSchemaForAI(connectionId: string, database: string, tables: string[]): Promise<string> {
  const pool = getPoolById(connectionId);
  if (!pool) throw new Error('连接不存在或未配置');

  const conn = await pool.getConnection();
  await conn.changeUser({ database });

  try {
    const schemas: string[] = [];

    for (const table of tables) {
      // 1. 获取完整 DDL（最准确的表结构信息）
      let ddl = '';
      try {
        const [rows] = await conn.query(`SHOW CREATE TABLE \`${table}\``);
        const result = rows as any[];
        if (result.length > 0) {
          ddl = result[0]['Create Table'] || '';
        }
      } catch {
        // DDL 获取失败则回退
      }

      // 2. 获取字段注释补充信息
      const [colRows] = await conn.query(
        `SELECT
           COLUMN_NAME as name,
           COLUMN_TYPE as type,
           IS_NULLABLE as nullable,
           COLUMN_KEY as \`key\`,
           COLUMN_COMMENT as comment
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION`,
        [database, table]
      );
      const columns = colRows as any[];

      let schema = `### 表: ${table}\n`;

      if (ddl) {
        // 优先使用完整 DDL
        schema += `DDL:\n${ddl}\n`;
      } else {
        // 回退：使用字段列表
        for (const col of columns) {
          let desc = `- ${col.name}: ${col.type}`;
          if (col.key === 'PRI') desc += ', 主键';
          if (col.nullable === 'NO') desc += ', NOT NULL';
          schema += desc + '\n';
        }
      }

      // 补充字段中文注释（DDL 中可能没有注释或注释不够直观）
      const comments = columns
        .filter(c => c.comment)
        .map(c => `  ${c.name}: ${c.comment}`);
      if (comments.length > 0) {
        schema += `字段注释:\n${comments.join('\n')}\n`;
      }

      schemas.push(schema);
    }

    return schemas.join('\n');
  } finally {
    conn.release();
  }
}
