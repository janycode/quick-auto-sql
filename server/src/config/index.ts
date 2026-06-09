import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  encryptKey: process.env.ENCRYPT_KEY || 'quick-auto-sql-default-key',
  dataDir: process.env.DATA_DIR || './data',
  deepseek: {
    apiUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  },
  query: {
    maxRows: 1000,
    timeout: 30000,
  },
};
