// MySQL 连接失败相关错误码，命中时优先把原生 code 透传到 error-handler
export const MYSQL_UNAVAILABLE_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ETIMEDOUT',
  'PROTOCOL_CONNECTION_LOST',
  'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR',
]);

export function wrapMySqlError(error: any, defaultMessage = '操作失败'): Error {
  if (!error) return new Error('未知错误');
  const code = String(error.code || '').toUpperCase();
  const message = String(error.sqlMessage || error.message || defaultMessage);

  if (MYSQL_UNAVAILABLE_CODES.has(code) || /connect.*mysql|mysql.*connect|econnrefused|access denied for user/i.test(message)) {
    const wrapped: any = new Error('未发现可用的mysql服务，请启动服务后刷新重试');
    wrapped.code = 'MYSQL_UNAVAILABLE';
    return wrapped;
  }

  const wrapped: any = new Error(message);
  if (error.code) wrapped.code = error.code;
  if (error.errno !== undefined) wrapped.errno = error.errno;
  return wrapped;
}
