import mysql from 'mysql2/promise';
import { IQueryResult } from '../types';
import { getPoolById, getConnectionById } from './connection';
import { config } from '../config';

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
  const conn = await pool.getConnection();

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
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      
      const columnComments: Record<string, string> = {};
      
      // 尝试从字段信息中获取表名，然后查询信息 schema 获取注释
      if (fields && Array.isArray(fields) && fields.length > 0) {
        const removeNewlines = (str: string): string => str.replace(/[\r\n]+/g, ' ').trim();
        
        const tableSet = new Set<string>();
        const fieldMap: Record<string, { table?: string; orgTable?: string }> = {};
        
        // 收集所有字段和对应的表信息
        for (const field of fields as any[]) {
          const fieldName = field.name;
          fieldMap[fieldName] = {
            table: field.table,
            orgTable: field.orgTable
          };
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
          for (const [fieldName, info] of Object.entries(fieldMap)) {
            let comment = '';
            if (info.table) {
              comment = commentMap.get(`${info.table}.${fieldName}`) || '';
            }
            if (!comment && info.orgTable) {
              comment = commentMap.get(`${info.orgTable}.${fieldName}`) || '';
            }
            if (comment) {
              columnComments[fieldName] = comment;
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
  } catch (error: any) {
    const message = error.sqlMessage || error.message || '查询执行失败';
    throw new Error(message);
  } finally {
    conn.release();
  }
}
