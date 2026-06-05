import { marked } from 'marked'

/** Markdown → HTML(全项目唯一渲染入口) */
export function renderMarkdown(text: string): string {
  return marked.parse(text) as string
}

/** 时间戳 → 'YYYY-MM-DD HH:mm' */
export function formatDate(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 分数 → TagType(供 naive-ui n-tag 配色) */
export function scoreTagType(score: [number, number]): 'success' | 'warning' | 'error' {
  const ratio = score[0] / score[1]
  if (ratio >= 0.8) return 'success'
  if (ratio >= 0.6) return 'warning'
  return 'error'
}

/** 分数 → 百分比 0-100 整数 */
export function scorePercent(score: [number, number]): number {
  return Math.round((score[0] / score[1]) * 100)
}

/** 分数 → 展示串 "25 / 30 (83%)" */
export function formatScore(score: [number, number]): string {
  return `${score[0]} / ${score[1]} (${scorePercent(score)}%)`
}

/** ID 生成:优先 crypto.randomUUID,降级 Date+随机。可选前缀。 */
export function genId(prefix?: string): string {
  let raw: string
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    raw = crypto.randomUUID()
  } else {
    raw = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }
  return prefix ? `${prefix}_${raw}` : raw
}
