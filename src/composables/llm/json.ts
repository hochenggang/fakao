export interface JsonShape {
  [key: string]: JsonShapeValue
}

export type JsonShapeValue =
  | 'string'
  | 'number'
  | 'boolean'
  | 'string[]'
  | 'number[]'
  | 'boolean[]'
  | JsonShape
  | JsonShape[]

function findBalancedJson(text: string): string | null {
  const start = text.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (escape) { escape = false; continue }
    if (c === '\\') { escape = true; continue }
    if (inString) {
      if (c === '"') inString = false
      continue
    }
    if (c === '"') { inString = true; continue }
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

function findJsonInFence(text: string): string | null {
  const m = text.match(/```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```/i)
  return m ? m[1] : null
}

export function extractJson(text: string): Record<string, unknown> {
  const trimmed = text.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try { return JSON.parse(trimmed) } catch {}
  }
  const balanced = findBalancedJson(text)
  if (balanced) {
    try { return JSON.parse(balanced) } catch {}
  }
  const fenced = findJsonInFence(text)
  if (fenced) {
    const inner = fenced.trim()
    if (inner.startsWith('{') && inner.endsWith('}')) {
      try { return JSON.parse(inner) } catch {}
    }
  }
  throw new Error('未找到 JSON 内容')
}

function check(value: JsonShapeValue, actual: unknown, path: string): void {
  if (value === 'string') {
    if (typeof actual !== 'string') throw new Error(`${path} 应为 string`)
    return
  }
  if (value === 'number') {
    if (typeof actual !== 'number') throw new Error(`${path} 应为 number`)
    return
  }
  if (value === 'boolean') {
    if (typeof actual !== 'boolean') throw new Error(`${path} 应为 boolean`)
    return
  }
  if (value === 'string[]') {
    if (!Array.isArray(actual) || !actual.every(x => typeof x === 'string'))
      throw new Error(`${path} 应为 string[]`)
    return
  }
  if (value === 'number[]') {
    if (!Array.isArray(actual) || !actual.every(x => typeof x === 'number'))
      throw new Error(`${path} 应为 number[]`)
    return
  }
  if (value === 'boolean[]') {
    if (!Array.isArray(actual) || !actual.every(x => typeof x === 'boolean'))
      throw new Error(`${path} 应为 boolean[]`)
    return
  }
  if (Array.isArray(value)) {
    if (!Array.isArray(actual)) throw new Error(`${path} 应为 array`)
    const itemShape = value[0]
    actual.forEach((item, i) => validateShape(item, itemShape, `${path}[${i}]`))
    return
  }
  if (typeof value === 'object' && value !== null) {
    validateShape(actual, value, path)
  }
}

export function validateShape(obj: unknown, shape?: JsonShape, prefix = ''): void {
  if (!shape) return
  if (typeof obj !== 'object' || obj === null) throw new Error(`${prefix || '根对象'} 应为 object`)
  for (const [k, v] of Object.entries(shape)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (!(k in (obj as Record<string, unknown>))) throw new Error(`缺少字段 ${path}`)
    check(v, (obj as Record<string, unknown>)[k], path)
  }
}
