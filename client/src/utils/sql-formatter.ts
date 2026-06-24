import { format as sqlFormat } from 'sql-formatter'

/**
 * 格式化 CREATE TABLE 语句为 DataGrip 风格
 * 特点：列名、类型、约束、注释对齐
 */
function formatCreateTable(sql: string): string | null {
  const trimmed = sql.trim()

  // 检查是否是 CREATE TABLE 语句
  if (!/^CREATE\s+TABLE/i.test(trimmed)) {
    return null
  }

  // 找到表名和第一个左括号的位置
  const tableNameMatch = trimmed.match(/^CREATE\s+TABLE\s+(`?[\w]+`?)\s*\(/i)
  if (!tableNameMatch) {
    return null
  }

  const tableName = tableNameMatch[1]
  const firstParenIndex = trimmed.indexOf('(', tableNameMatch[0].length - 1)

  // 找到匹配的右括号位置（处理嵌套）
  let depth = 0
  let secondParenIndex = -1
  for (let i = firstParenIndex; i < trimmed.length; i++) {
    if (trimmed[i] === '(') depth++
    if (trimmed[i] === ')') {
      depth--
      if (depth === 0) {
        secondParenIndex = i
        break
      }
    }
  }

  if (secondParenIndex === -1) {
    return null
  }

  const columnsPart = trimmed.slice(firstParenIndex + 1, secondParenIndex).trim()
  const tableOptions = trimmed.slice(secondParenIndex + 1).trim().replace(/;$/, '').trim()

  // 解析列定义
  const columns = parseColumnDefinitions(columnsPart)
  if (columns.length === 0) {
    return null
  }

  // 计算各列最大宽度
  let maxNameWidth = 0
  let maxTypeWidth = 0
  let maxConstraintsWidth = 0

  for (const col of columns) {
    if (col.isKey) continue
    if (col.name.length > maxNameWidth) maxNameWidth = col.name.length
    if (col.type.length > maxTypeWidth) maxTypeWidth = col.type.length
    const constraints = buildConstraints(col)
    if (constraints.length > maxConstraintsWidth) maxConstraintsWidth = constraints.length
  }

  // 构建格式化输出
  const lines: string[] = []
  lines.push(`CREATE TABLE ${tableName} (`)

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]
    const isLast = i === columns.length - 1

    if (col.isKey) {
      // 主键/索引定义
      lines.push(`    ${col.keyInfo}${isLast ? '' : ','}`)
    } else {
      // 普通列
      const namePart = col.name.padEnd(maxNameWidth)
      const typePart = col.type.padEnd(maxTypeWidth)
      const constraints = buildConstraints(col)
      const constraintsPart = constraints.padEnd(maxConstraintsWidth)

      let line = `    ${namePart} ${typePart}`
      if (maxConstraintsWidth > 0) line += ` ${constraintsPart}`
      if (col.comment) line += ` ${col.comment}`

      line += isLast ? '' : ','
      lines.push(line)
    }
  }

  if (tableOptions) {
    lines.push(`) ${tableOptions}`)
  } else {
    lines.push(')')
  }

  return lines.join('\n')
}

interface ColumnDef {
  name: string
  type: string
  nullable: string
  defaultValue: string
  comment: string
  isKey: boolean
  keyInfo: string
}

/**
 * 解析列定义（处理括号嵌套）
 */
function parseColumnDefinitions(columnsPart: string): ColumnDef[] {
  const result: ColumnDef[] = []
  let current = ''
  let depth = 0

  for (const char of columnsPart) {
    if (char === '(') depth++
    if (char === ')') depth--
    if (char === ',' && depth === 0) {
      const def = current.trim()
      if (def) {
        const parsed = parseColumnOrKey(def)
        if (parsed) result.push(parsed)
      }
      current = ''
    } else {
      current += char
    }
  }

  const lastDef = current.trim()
  if (lastDef) {
    const parsed = parseColumnOrKey(lastDef)
    if (parsed) result.push(parsed)
  }

  return result
}

/**
 * 解析单个列或键定义
 */
function parseColumnOrKey(def: string): ColumnDef | null {
  const trimmed = def.trim()
  if (!trimmed) return null

  // 检查是否是主键定义
  if (/^PRIMARY\s+KEY/i.test(trimmed)) {
    return {
      name: '',
      type: '',
      nullable: '',
      defaultValue: '',
      comment: '',
      isKey: true,
      keyInfo: trimmed
    }
  }

  // 检查是否是索引定义
  if (/^(UNIQUE\s+)?KEY\b|^INDEX\b/i.test(trimmed)) {
    return {
      name: '',
      type: '',
      nullable: '',
      defaultValue: '',
      comment: '',
      isKey: true,
      keyInfo: trimmed
    }
  }

  // 解析普通列
  return parseColumn(trimmed)
}

/**
 * 解析单个列定义
 */
function parseColumn(def: string): ColumnDef | null {
  let remaining = def.trim()

  // 匹配列名
  const nameMatch = remaining.match(/^(`?[\w]+`?)\s+/)
  if (!nameMatch) return null

  const name = nameMatch[1]
  remaining = remaining.slice(nameMatch[0].length).trim()

  // 解析类型（可能包含括号参数、CHARACTER SET、COLLATE 等）
  const typeParts: string[] = []

  // 匹配基础类型名
  const baseTypeMatch = remaining.match(/^(\w+)/i)
  if (!baseTypeMatch) return null

  typeParts.push(baseTypeMatch[1].toUpperCase())
  remaining = remaining.slice(baseTypeMatch[0].length).trim()

  // 匹配类型参数（如 VARCHAR(50)、DECIMAL(10,2)）
  if (remaining.startsWith('(')) {
    let depth = 0
    let param = ''
    for (const char of remaining) {
      param += char
      if (char === '(') depth++
      if (char === ')') {
        depth--
        if (depth === 0) break
      }
    }
    typeParts.push(param)
    remaining = remaining.slice(param.length).trim()
  }

  // 匹配 UNSIGNED
  const unsignedMatch = remaining.match(/^UNSIGNED\b/i)
  if (unsignedMatch) {
    typeParts.push(unsignedMatch[0].toUpperCase())
    remaining = remaining.slice(unsignedMatch[0].length).trim()
  }

  // 跳过 CHARACTER SET（不展示）
  const charsetMatch = remaining.match(/^CHARACTER\s+SET\s+[\w_]+/i)
  if (charsetMatch) {
    remaining = remaining.slice(charsetMatch[0].length).trim()
  }

  // 跳过 COLLATE（不展示）
  const collateMatch = remaining.match(/^COLLATE\s+[\w_]+/i)
  if (collateMatch) {
    remaining = remaining.slice(collateMatch[0].length).trim()
  }

  // 组合类型字符串（基础类型和括号连在一起，其他部分用空格分隔）
  let type = typeParts[0]
  if (typeParts.length > 1) {
    type += typeParts[1] // 括号部分直接连接
    for (let i = 2; i < typeParts.length; i++) {
      type += ' ' + typeParts[i]
    }
  }

  // 解析 DEFAULT（需要在 NULL/NOT NULL 之前解析，避免 DEFAULT NULL 被错误解析）
  let defaultValue = ''
  const defaultMatch = remaining.match(/\bDEFAULT\s+((?:'[^']*')|(?:\S+))/i)
  if (defaultMatch) {
    defaultValue = `DEFAULT ${defaultMatch[1]}`
    remaining = remaining.replace(defaultMatch[0], '').trim()
  }

  // 解析 NULL/NOT NULL
  let nullable = ''
  const nullMatch = remaining.match(/\b(NOT\s+NULL|NULL)\b/i)
  if (nullMatch) {
    nullable = nullMatch[1].toUpperCase()
    remaining = remaining.replace(nullMatch[0], '').trim()
  }

  // 解析 AUTO_INCREMENT
  let autoInc = ''
  const autoIncMatch = remaining.match(/\bAUTO_INCREMENT\b/i)
  if (autoIncMatch) {
    autoInc = 'AUTO_INCREMENT'
    remaining = remaining.replace(autoIncMatch[0], '').trim()
  }

  // 解析 PRIMARY KEY
  let pk = ''
  const pkMatch = remaining.match(/\bPRIMARY\s+KEY\b/i)
  if (pkMatch) {
    pk = 'PRIMARY KEY'
    remaining = remaining.replace(pkMatch[0], '').trim()
  }

  // 组合约束
  const constraints: string[] = []
  if (nullable) constraints.push(nullable)
  if (autoInc) constraints.push(autoInc)
  if (pk) constraints.push(pk)
  nullable = constraints.join(' ')

  // 解析 COMMENT
  let comment = ''
  const commentMatch = remaining.match(/COMMENT\s+'[^']*'/i)
  if (commentMatch) {
    comment = commentMatch[0].replace(/^COMMENT\s+/i, 'COMMENT ')
  }

  return {
    name,
    type,
    nullable,
    defaultValue,
    comment,
    isKey: false,
    keyInfo: ''
  }
}

/**
 * 构建约束字符串（nullable + defaultValue 等）
 */
function buildConstraints(col: ColumnDef): string {
  const parts: string[] = []
  if (col.nullable) parts.push(col.nullable)
  if (col.defaultValue) parts.push(col.defaultValue)
  return parts.join(' ')
}

/**
 * 格式化 SQL 语句
 */
export function formatSql(sql: string): string {
  try {
    // 先尝试用 DataGrip 风格格式化 CREATE TABLE
    const createTableFormatted = formatCreateTable(sql)
    if (createTableFormatted) {
      return createTableFormatted
    }

    // 其他语句使用 sql-formatter 默认格式化
    return sqlFormat(sql, {
      language: 'mysql',
      tabWidth: 2,
      keywordCase: 'upper',
    })
  } catch {
    return sql
  }
}