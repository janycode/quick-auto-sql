import { Request, Response, NextFunction } from 'express';

// MySQL 连接失败的关键字段（mysql2 / Node 底层错误常见形态）
// 当 MySQL 未启动、host 不可达、端口被拒、认证失败时均会命中
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

// 错误码约定：-1 通用错误，其它业务错误可自行扩展
// 1001: MySQL 不可用 / 连接失败
function inferMySqlErrorInfo(err: any): { code: number; message: string } | null {
  if (!err) return null;

  // 上游已经明确标识为 MySQL 错误
  if (err && err.code === 'MYSQL_UNAVAILABLE') {
    return {
      code: 1001,
      message: err.message || '未发现可用的mysql服务，请启动服务后刷新重试',
    };
  }

  // 直接从 Error 字段推断
  const errCode: string | undefined = err.code || err.errno?.toString();
  if (errCode && MYSQL_UNAVAILABLE_CODES.has(errCode.toUpperCase())) {
    return {
      code: 1001,
      message: '未发现可用的mysql服务，请启动服务后刷新重试',
    };
  }

  // 通过消息文本兜底判断（某些 mysql2 包装错误不暴露 code）
  const msg = String(err.message || '').toLowerCase();
  if (
    msg.includes('access denied for user') ||
    msg.includes('unknown database') ||
    msg.includes('too many connections') ||
    msg.includes('can\'t connect to mysql') ||
    msg.includes('connect econnrefused') ||
    msg.includes('getaddrinfo enotfound') ||
    msg.includes('timeout') && msg.includes('mysql')
  ) {
    return {
      code: 1001,
      message: '未发现可用的mysql服务，请启动服务后刷新重试',
    };
  }

  return null;
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[Error]', err.message, err.stack || '');

  const mysqlInfo = inferMySqlErrorInfo(err);
  if (mysqlInfo) {
    res.status(500).json({
      code: mysqlInfo.code,
      message: mysqlInfo.message,
      data: null,
    });
    return;
  }

  res.status(500).json({
    code: -1,
    message: err.message || '服务器内部错误',
    data: null,
  });
}
