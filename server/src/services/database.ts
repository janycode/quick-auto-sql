import { IDatabase, ITable, IColumn, ITableStatus } from '../types';
import { getPoolById } from './connection';
import mysql from 'mysql2/promise';

const MYSQL_UNAVAILABLE_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ETIMEDOUT',
  'PROTOCOL_CONNECTION_LOST',
  'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
]);

function wrapMySqlError(error: any): Error {
  if (!error) return new Error('未知错误');
  const code = String(error.code || '').toUpperCase();
  const message = String(error.sqlMessage || error.message || '执行失败');

  if (MYSQL_UNAVAILABLE_CODES.has(code) || /connect.*mysql|mysql.*connect|econnrefused/i.test(message)) {
    const wrapped: any = new Error('未发现可用的mysql服务，请启动服务后刷新重试');
    wrapped.code = 'MYSQL_UNAVAILABLE';
    return wrapped;
  }

  const wrapped: any = new Error(message);
  if (error.code) wrapped.code = error.code;
  if (error.errno !== undefined) wrapped.errno = error.errno;
  return wrapped;
}

async function acquireConn(connectionId: string, userId?: string): Promise<mysql.PoolConnection> {
  const pool = getPoolById(connectionId, userId);
  if (!pool) throw new Error('连接不存在或无权限');
  try {
    return await pool.getConnection();
  } catch (error) {
    throw wrapMySqlError(error);
  }
}

export async function getDatabases(connectionId: string, userId?: string): Promise<IDatabase[]> {
  const conn = await acquireConn(connectionId, userId);
  try {
    const [rows] = await conn.query(
      `SELECT SCHEMA_NAME as name, DEFAULT_CHARACTER_SET_NAME as charset, DEFAULT_COLLATION_NAME as collation
       FROM INFORMATION_SCHEMA.SCHEMATA
       WHERE SCHEMA_NAME NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
       ORDER BY SCHEMA_NAME`
    );
    return rows as IDatabase[];
  } catch (error) {
    throw wrapMySqlError(error);
  } finally {
    conn.release();
  }
}

export async function getTables(connectionId: string, database: string, userId?: string): Promise<ITable[]> {
  const conn = await acquireConn(connectionId, userId);
  try {
    const [rows] = await conn.query(
      `SELECT TABLE_NAME as name, TABLE_COMMENT as comment, ENGINE as engine, TABLE_ROWS as rowCount
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME`,
      [database]
    );
    return rows as ITable[];
  } catch (error) {
    throw wrapMySqlError(error);
  } finally {
    conn.release();
  }
}

export async function getColumns(connectionId: string, database: string, table: string, userId?: string): Promise<IColumn[]> {
  const conn = await acquireConn(connectionId, userId);
  try {
    const [rows] = await conn.query(
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
  } catch (error) {
    throw wrapMySqlError(error);
  } finally {
    conn.release();
  }
}

export async function getTableDDL(connectionId: string, database: string, table: string, userId?: string): Promise<string> {
  const conn = await acquireConn(connectionId, userId);
  try {
    await conn.changeUser({ database });
    const [rows] = await conn.query(`SHOW CREATE TABLE \`${table}\``);
    const result = rows as any[];
    if (result.length > 0) {
      return result[0]['Create Table'] || '';
    }
    return '';
  } catch {
    return await buildDDLFromSchema(connectionId, database, table, userId);
  } finally {
    conn.release();
  }
}

async function buildDDLFromSchema(connectionId: string, database: string, table: string, userId?: string): Promise<string> {
  const columns = await getColumns(connectionId, database, table, userId);

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

export async function getTableStatus(connectionId: string, database: string, table: string, userId?: string): Promise<ITableStatus> {
  const conn = await acquireConn(connectionId, userId);
  try {
    const [statusRows] = await conn.query(`SHOW TABLE STATUS FROM \`${database}\` LIKE ?`, [table]);
    const statusArr = statusRows as any[];
    const status = statusArr[0] || {};

    const [[colCountResult]]: any = await conn.query(
      `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [database, table]
    );

    const [[idxCountResult]]: any = await conn.query(
      `SELECT COUNT(DISTINCT INDEX_NAME) as cnt FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [database, table]
    );

    return {
      name: status.Name || table,
      engine: status.Engine || null,
      version: status.Version ?? null,
      rowFormat: status.Row_format || null,
      rows: status.Rows ?? null,
      avgRowLength: status.Avg_row_length ?? null,
      dataLength: status.Data_length ?? null,
      maxDataLength: status.Max_data_length ?? null,
      indexLength: status.Index_length ?? null,
      dataFree: status.Data_free ?? null,
      autoIncrement: status.Auto_increment ?? null,
      createTime: status.Create_time ? new Date(status.Create_time).toISOString() : null,
      updateTime: status.Update_time ? new Date(status.Update_time).toISOString() : null,
      checkTime: status.Check_time ? new Date(status.Check_time).toISOString() : null,
      collation: status.Collation || null,
      comment: status.Comment || null,
      columnCount: colCountResult?.cnt || 0,
      indexCount: idxCountResult?.cnt || 0,
    };
  } catch (error) {
    throw wrapMySqlError(error);
  } finally {
    conn.release();
  }
}

export async function getTablesSchemaForAI(connectionId: string, database: string, tables: string[], userId?: string): Promise<string> {
  const conn = await acquireConn(connectionId, userId);
  try {
    await conn.changeUser({ database });

    const schemas: string[] = [];

    for (const table of tables) {
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
        schema += `DDL:\n${ddl}\n`;
      } else {
        for (const col of columns) {
          let desc = `- ${col.name}: ${col.type}`;
          if (col.key === 'PRI') desc += ', 主键';
          if (col.nullable === 'NO') desc += ', NOT NULL';
          schema += desc + '\n';
        }
      }

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
