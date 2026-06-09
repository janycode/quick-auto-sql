import { format as sqlFormat } from 'sql-formatter'

export function formatSql(sql: string): string {
  try {
    return sqlFormat(sql, {
      language: 'mysql',
      tabWidth: 2,
      keywordCase: 'upper',
    })
  } catch {
    return sql
  }
}
