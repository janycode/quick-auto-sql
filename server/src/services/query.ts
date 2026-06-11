import mysql from 'mysql2/promise';
import { IQueryResult } from '../types';
import { getPoolById, getConnectionById } from './connection';
import { config } from '../config';

// MySQL 连接失败相关错误码，命中时优先把原生 code 透传到 error-handler
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
  const message = String(error.sqlMessage || error.message || '查询执行失败');

  // 明确是 MySQL 不可用：把 code 透传（error-handler 会识别）
  if (MYSQL_UNAVAILABLE_CODES.has(code) || /connect.*mysql|mysql.*connect|econnrefused/i.test(message)) {
    const wrapped: any = new Error('未发现可用的mysql服务，请启动服务后刷新重试');
    wrapped.code = 'MYSQL_UNAVAILABLE';
    return wrapped;
  }

  // 其它业务错误（SQL 语法错误、表不存在等），保持原始语义
  const wrapped: any = new Error(message);
  if (error.code) wrapped.code = error.code;
  if (error.errno !== undefined) wrapped.errno = error.errno;
  return wrapped;
}

export async function executeQuery(
  connectionId: string,
  database: string,
  sql: string
): Promise<{
  columns: string[];
  columnComments: Record<string, string>;
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTime: number
}> {
  const pool = getPoolById(connectionId);
  if (!pool) throw new Error('连接不存在或未配置');

  const startTime = Date.now();
  let conn: mysql.PoolConnection | null = null;
  try {
    conn = await pool.getConnection();
  } catch (error) {
    throw wrapMySqlError(error);
  }

  try {
    await conn.changeUser({ database });

    await conn.query(`SET SESSION max_execution_time = ${config.query.timeout}`);

    const [result, fields] = await conn.query({
      sql,
      rowsAsArray: false,
      timeout: config.query.timeout,
    });

    const executionTime = Date.now() - startTime;

    if (Array.isArray(result)) {
      const rows = result.slice(0, config.query.maxRows) as Record<string, unknown>[];
      // 使用 fields 数组获取列名，确保顺序和完整性（比从第一行数据提取更可靠）
      const columns: string[] = [];
      if (fields && Array.isArray(fields) && fields.length > 0) {
        for (const field of fields as any[]) {
          columns.push(field.name);
        }
      } else if (rows.length > 0) {
        // 如果没有 fields 信息，回退到从第一行数据提取
        columns.push(...Object.keys(rows[0]));
      }
      
      const columnComments: Record<string, string> = {};
      
      // 尝试从字段信息中获取表名，然后查询信息 schema 获取注释
      if (fields && Array.isArray(fields) && fields.length > 0) {
        const removeNewlines = (str: string): string => str.replace(/[\r\n]+/g, ' ').trim();
        
        const tableSet = new Set<string>();
        // 记录每个字段的详细信息，包括原始列名
        const fieldDetails: Array<{
          columnName: string;
          table?: string;
          orgTable?: string;
          orgName?: string;
        }> = [];
        
        // 收集所有字段和对应的表信息
        for (const field of fields as any[]) {
          fieldDetails.push({
            columnName: field.name,
            table: field.table,
            orgTable: field.orgTable,
            orgName: field.orgName
          });
          if (field.table) {
            tableSet.add(field.table);
          }
          if (field.orgTable) {
            tableSet.add(field.orgTable);
          }
        }
        
        // 如果有表信息，查询 information_schema 获取注释
        if (tableSet.size > 0) {
          const tables = Array.from(tableSet);
          const placeholders = tables.map(() => '?').join(',');
          const [commentRows] = await conn.query(
            `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_COMMENT 
             FROM information_schema.COLUMNS 
             WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (${placeholders})`,
            [database, ...tables]
          ) as any;
          
          // 构建字段到注释的映射
          const commentMap = new Map<string, string>();
          if (Array.isArray(commentRows)) {
            for (const row of commentRows) {
              const key = `${row.TABLE_NAME}.${row.COLUMN_NAME}`;
              commentMap.set(key, removeNewlines(row.COLUMN_COMMENT || ''));
            }
          }
          
          // 为每个字段查找对应的注释
          for (const field of fieldDetails) {
            let comment = '';
            const columnName = field.columnName;
            const orgColumnName = field.orgName || columnName;
            const hasTableInfo = !!(field.table || field.orgTable);
            
            // 1. 先尝试用 table + columnName 查找（精确匹配）
            if (field.table) {
              comment = commentMap.get(`${field.table}.${columnName}`) || '';
            }
            // 2. 如果没找到，尝试用 table + orgColumnName 查找
            if (!comment && field.table) {
              comment = commentMap.get(`${field.table}.${orgColumnName}`) || '';
            }
            // 3. 尝试用 orgTable + columnName 查找
            if (!comment && field.orgTable) {
              comment = commentMap.get(`${field.orgTable}.${columnName}`) || '';
            }
            // 4. 尝试用 orgTable + orgColumnName 查找
            if (!comment && field.orgTable) {
              comment = commentMap.get(`${field.orgTable}.${orgColumnName}`) || '';
            }
            
            // 5. 如果有表信息但没找到，或者没有表信息，尝试在所有表中查找此列名
            // （如果这个列名在所有查询的表中唯一存在的话）
            if (!comment) {
              const candidates: string[] = [];
              for (const [key, value] of commentMap.entries()) {
                if (value) {
                  const parts = key.split('.');
                  const col = parts[parts.length - 1];
                  if (col === columnName || col === orgColumnName) {
                    candidates.push(value);
                  }
                }
              }
              // 如果只有一个候选，使用它
              if (candidates.length === 1) {
                comment = candidates[0];
              }
            }
            
            if (comment) {
              columnComments[columnName] = comment;
            }
          }
        }
        
        // 备选方案：尝试直接从字段对象获取（某些 MySQL 驱动可能支持）
        if (Object.keys(columnComments).length === 0) {
          for (const field of fields as any[]) {
            const fieldName = field.name;
            const comment = removeNewlines(field.comment || '');
            if (comment) {
              columnComments[fieldName] = comment;
            }
          }
        }
      }

      return {
        columns,
        columnComments,
        rows,
        rowCount: result.length,
        executionTime,
      };
    }

    const affectedResult = result as mysql.ResultSetHeader;
    return {
      columns: ['affectedRows', 'changedRows', 'insertId'],
      columnComments: {},
      rows: [{
        affectedRows: affectedResult.affectedRows,
        changedRows: affectedResult.changedRows,
        insertId: affectedResult.insertId,
      }],
      rowCount: 1,
      executionTime,
    };
  } catch (error) {
    throw wrapMySqlError(error);
  } finally {
    if (conn) conn.release();
  }
}

// 对 SQL 执行 EXPLAIN，返回原始行数组（每行为列名 -> 值）
export async function explainQuery(
  connectionId: string,
  database: string,
  sql: string
): Promise<Record<string, unknown>[]> {
  const pool = getPoolById(connectionId);
  if (!pool) throw new Error('连接不存在或未配置');

  let conn: mysql.PoolConnection | null = null;
  try {
    conn = await pool.getConnection();
  } catch (error) {
    throw wrapMySqlError(error);
  }
  try {
    await conn.changeUser({ database });

    const [result] = await conn.query({
      sql: `EXPLAIN ${sql}`,
      rowsAsArray: false,
      timeout: config.query.timeout,
    });

    if (Array.isArray(result)) {
      return result as Record<string, unknown>[];
    }
    return [];
  } catch (error) {
    throw wrapMySqlError(error);
  } finally {
    if (conn) conn.release();
  }
}
