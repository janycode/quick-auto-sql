import mysql from 'mysql2/promise';
import { IQueryResult } from '../types';
import { getPoolById, getConnectionById } from './connection';
import { config } from '../config';

// 执行 SQL 查询
export async function executeQuery(
  connectionId: string,
  database: string,
  sql: string
): Promise<IQueryResult> {
  const pool = getPoolById(connectionId);
  if (!pool) throw new Error('连接不存在或未配置');

  const startTime = Date.now();
  const conn = await pool.getConnection();

  try {
    await conn.changeUser({ database });

    // 设置查询超时
    await conn.query(`SET SESSION max_execution_time = ${config.query.timeout}`);

    const [result] = await conn.query({
      sql,
      rowsAsArray: false,
      timeout: config.query.timeout,
    });

    const executionTime = Date.now() - startTime;

    // 处理 SELECT 查询结果
    if (Array.isArray(result)) {
      const rows = result.slice(0, config.query.maxRows) as Record<string, unknown>[];
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      return {
        columns,
        rows,
        rowCount: result.length, // 返回总行数而非截断后行数
        executionTime,
      };
    }

    // 处理 INSERT/UPDATE/DELETE 等操作
    const affectedResult = result as mysql.ResultSetHeader;
    return {
      columns: ['affectedRows', 'changedRows', 'insertId'],
      rows: [{
        affectedRows: affectedResult.affectedRows,
        changedRows: affectedResult.changedRows,
        insertId: affectedResult.insertId,
      }],
      rowCount: 1,
      executionTime,
    };
  } catch (error: any) {
    // 移除 MySQL 错误码前缀，使错误信息更友好
    const message = error.sqlMessage || error.message || '查询执行失败';
    throw new Error(message);
  } finally {
    conn.release();
  }
}
