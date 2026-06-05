# 编码规范审视与重构计划

> **目标**：依照「复用 / 抽象 / 封装 / 有序 / 简单 / 稳健」原则对整个项目进行代码 review,消除重复、缩减代码量、提升可维护性,保持核心功能不变。
>
> **硬约束**:
> 1. 不修改 `src/data/**`
> 2. 不修改对第三方库 `vue-llm-stream-chat` 的调用方式(`streamChat` 的入参 / 选项契约保持现状)
> 3. 去除「设置」中的提示词覆盖功能,用户态不再接触提示词
> 4. 保持核心功能:AI 出题、AI 评判、关键词背诵、错题集、大纲笔记、模型配置
> 5. **统一所有提示词加载** → 统一 LLM 调用入口
> 6. **统一 LLM 逻辑** = 点击按钮 → 装载提示词 → 调用 `streamChat` → 返回 `fullText` → 继续
> 7. **只有出题需要 blur,其它调用都不需要 blur**(默认 `blur: false`)
> 8. **任何在 2+ 处使用的函数,都必须封装为公共组件 / composable / 工具**

---

## 1. 现状分析 (Phase 1 探索)

### 1.1 项目结构
```
src/
├── components/    Empty(死) / KeywordMemorizeModal / PracticeModal / TopicCard
├── composables/
│   ├── llm/       ask.ts(带 JSON 强制 + 3 次重试) / json.ts / index.ts
│   ├── useKeywordFlow / usePracticeCount / usePracticeFlow / usePracticeTracker
│   ├── usePromptStore(312 行,过度设计) / useRuntimeMode / useSettings / useTheme(死)
├── data/          exams.ts + knowledge/(不修改)
├── layouts/       MainLayout
├── lib/           utils.ts(cn 工具)
├── router/        index.ts
├── types/         exam.ts / index.ts
├── views/         OutlineNotes / Overview / Practice / Settings / WrongBook
```

### 1.2 问题清单

#### A. 重复代码(可立即抽取)
| # | 重复点 | 出现位置 | 建议 |
|---|---|---|---|
| 1 | `marked.parse` + `renderMarkdown(text)` 包装 | `PracticeModal.vue` / `OutlineNotesView.vue` / `WrongBookView.vue` | 抽到 `lib/format.ts` |
| 2 | localStorage `load()` + `save()` + `watch` + `try/catch` 模板 | `useSettings` / `usePromptStore` / `usePracticeTracker` / `useWrongBook` / `MainLayout` / `KeywordMemorizeModal` | 抽到 `useLocalStorage<T>` |
| 3 | `genId()` / `nextId()` ID 生成 | `useSettings`(`p_${Date.now()}_${uid}`) / `useWrongBook`(`crypto.randomUUID()` + 降级) | 统一为 `genId(prefix?)` 工具 |
| 4 | `kindOf(examId)` 主客观派生 | `usePracticeFlow.ts`(行 82-84) / `usePracticeCount.ts`(行 20) | 抽到 `lib/examKind.ts` |
| 5 | 分数 `score[0]/score[1]` 比例与 TagType 推导 | `WrongBookView.vue`(行 24-29) / `PracticeModal.vue`(行 366-372) | 抽到 `lib/format.ts` |
| 6 | `formatDate(ts)` 时间戳转 `YYYY-MM-DD HH:mm` | `WrongBookView.vue`(行 15-18) | 抽到 `lib/format.ts` |
| 7 | `items.filter(i => i.type === 'objective').length` 客观/主观统计 | `SettingsView.vue`(行 207-208) / `WrongBookView.vue`(行 12-13) | 由 `useWrongBook` 暴露 `objectiveCount` / `subjectiveCount` |
| 8 | `ai-result` / `ai-judge-content` / `markdown-content` / `.plain-text` 高度相似的 Markdown 排版样式 | `PracticeModal` / `WrongBookView` / `OutlineNotesView` / `KeywordMemorizeModal` | 抽到 `src/styles/markdown.css`,统一用 `.markdown` |
| 9 | 降级模式判断 `if (!isNormalMode.value) throw new Error(...)` | `useKeywordFlow.ts`(行 19-21) / `usePracticeFlow.ts`(行 101-103) / `llm/ask.ts` 隐含 | 在 `useRuntimeMode` 暴露 `requireNormalMode()` |

#### B. 死代码 / 未使用导出
| # | 文件 / 符号 | 验证 | 处理 |
|---|---|---|---|
| 1 | `src/components/Empty.vue` | 无 import 引用 | **删除** |
| 2 | `src/composables/useTheme.ts` | 无 import 引用 | **删除** |
| 3 | `useBuildPrompt` in `usePromptStore.ts` | 仅 export,无使用 | **删除** |
| 4 | `usePromptStore` hook | 唯一使用在 `SettingsView`,而提示词 tab 即将删除 | **删除** |
| 5 | `buildKnowledgeContext` 暴露在 hook 返回对象中 | 无外部使用 | **保留为内部函数** |
| 6 | `usePromptStore.ts` 行末的 `export type { Subject, Topic, Ref }` | 外部均从 `@/types/exam` 导入 | **删除** |

#### C. LLM 调用分裂为 2 套(用户要求统一)
- `useLLM.ask`(在 `llm/ask.ts`):
  - 强制 JSON schema,3 次重试
  - `viewProps: opts.blur ? { blur: 4 } : { blur: 0 }`
  - 自动添加 system 提示词
  - 给 `usePracticeFlow.generate` / `usePracticeFlow.judge` 用
- `useKeywordFlow.runPrompt`:
  - 纯文本流式,**不**加 system 提示词
  - `viewProps: { modal: true }`
  - **不**做重试
  - 给关键词背诵 / 评析用
- 两套实现:同样的"装载提示词 → streamChat → 返回文本"流程分裂 2 份,且 `useKeywordFlow` 缺 system 提示词(可能是 bug)

#### D. 提示词功能过度设计(因用户要求删除)
`usePromptStore.ts` 312 行中,真正核心的只有:
- `DEFAULT_PROMPTS`(7 个键的常量)
- `buildPrompt(key, subject, topic, scope, extras)`(模板替换)

其余全部可以删除:
- `custom` reactive + `load` + `watchEffect` + `save` + `removeCustom` + `hasCustom`(约 60 行)
- `usePromptStore()` hook(约 12 行)
- `useBuildPrompt()`(约 6 行)
- `getPrompt` 改为内联 / 直接 `DEFAULT_PROMPTS[key]`

#### E. SettingsView 复杂度
- 含 3 个 tab(模型设置 / 提示词设置 / 错题集管理),删除提示词 tab 后结构清晰化
- `defaultModelOptions` / `defaultModelValue` / `onDefaultModelChange` 字符串拼接可封装

---

## 2. 重构方案 (Proposed Changes)

### 2.1 新增文件

#### 2.1.1 `src/lib/format.ts`(新)
```ts
// Markdown 渲染
export function renderMarkdown(text: string): string

// 日期格式化 YYYY-MM-DD HH:mm
export function formatDate(ts: number): string

// 分数衍生:TagType(naive-ui)
export function scoreTagType(score: [number, number]): 'success' | 'warning' | 'error'

// 分数百分比 0-100 整数
export function scorePercent(score: [number, number]): number

// 分数展示 "25 / 30 (83%)"
export function formatScore(score: [number, number]): string

// ID 生成(优先 crypto.randomUUID,降级 Date+随机)
export function genId(prefix?: string): string
```

#### 2.1.2 `src/lib/examKind.ts`(新) — 单一来源
```ts
import type { ExamId } from '@/types/exam'
export type ExamKind = 'objective' | 'subjective'

const KIND_MAP: Record<ExamId, ExamKind> = {
  exam1: 'objective',
  exam2: 'objective',
  exam3: 'subjective',
}

export function examKindOf(id: ExamId): ExamKind {
  return KIND_MAP[id]
}
```
> `types/exam.ts` 中 `EXAM_KIND` 改为从 `@/lib/examKind` re-export,保持对外契约,内部单一来源。

#### 2.1.3 `src/composables/useLocalStorage.ts`(新)
```ts
import { ref, watch, type Ref } from 'vue'

export function useLocalStorage<T>(key: string, fallback: T): Ref<T>
// 行为:首次调用时从 localStorage 读取(失败用 fallback),之后 deep watch 自动写回
```
> 消除 5+ 处手写的 load/save/watch/try-catch 模板。

#### 2.1.4 `src/styles/markdown.css`(新)
合并 4 处相似的 Markdown / AI 报告样式到一个类 `.markdown`,含:
- 基础:行高 1.8、字号 14px、颜色 #334155
- 标题 h1/h2/h3、段落、列表、引用、行内代码、代码块、strong
- 暴露: `import '@/styles/markdown.css'` 在 `main.ts` 中加载
- 原 4 处 scoped 样式中重复的 `:deep(...)` 规则全部统一指向 `.markdown`

### 2.2 删除文件

| 文件 | 原因 |
|---|---|
| `src/components/Empty.vue` | 死代码 |
| `src/composables/useTheme.ts` | 死代码 |

### 2.3 改动文件

#### 2.3.1 核心: 统一 LLM 调用(`src/composables/llm/useLLM.ts` + `src/composables/llm/callWithParse.ts`)

**A. 重构 `useLLM`(原 `ask.ts` 整体替换)**

将原 `ask.ts` 的 3 次重试 + JSON 解析从 `useLLM` 内部抽离,`useLLM` 只做"装载提示词 → 调 streamChat → 返回 fullText"这一件事。**`streamChat` 调用方式一字不改**(满足硬约束 2)。

```ts
// src/composables/llm/useLLM.ts
import { useStreamChat } from 'vue-llm-stream-chat'
import { useSettings } from '../useSettings'
import { useRuntimeMode } from '../useRuntimeMode'
import { DEFAULT_PROMPTS, buildPrompt } from '../usePromptStore'
import type { Subject, Topic } from '@/types/exam'
import type { PromptKey, ChatMessage } from '@/types'

export interface CallStreamOptions {
  /** 模板键,与 subject/topic/scope/extras 二选一(若同时传 prompt 则 prompt 优先) */
  promptKey?: PromptKey
  /** 直接给定的 user prompt(跳过 buildPrompt 模板) */
  prompt?: string
  subject?: Subject
  topic?: Topic
  scope?: 'topic' | 'subject' | 'exam'
  extras?: Record<string, string>
  /** 出题场景传 true,其余默认 false */
  blur?: boolean
  thinking?: boolean
  systemPrompt?: string
}

export function useLLM() {
  const { streamChat, fullContent, error } = useStreamChat()
  const { resolveDefaultModel } = useSettings()
  const { requireNormalMode } = useRuntimeMode()

  /**
   * 统一 LLM 调用:装载提示词 → streamChat → 返回 fullText。
   * - 默认 blur=false(出题场景由调用方传 blur:true)
   * - 自动加 system 提示词(用 DEFAULT_PROMPTS.system 或 systemOverride)
   * - 降级模式下 throw
   */
  async function callStream(opts: CallStreamOptions): Promise<string> {
    requireNormalMode()
    const picked = resolveDefaultModel()
    if (!picked) throw new Error('请先在设置中配置 API 信息')

    const userPrompt = opts.prompt
      ?? buildPrompt(
        opts.promptKey!,
        opts.subject!,
        opts.topic!,
        opts.scope ?? 'topic',
        opts.extras ?? {},
      )

    const messages: ChatMessage[] = [
      { role: 'system', content: opts.systemPrompt ?? DEFAULT_PROMPTS.system },
      { role: 'user', content: userPrompt },
    ]

    await streamChat(
      { baseUrl: picked.baseUrl, apiKey: picked.apiKey },
      picked.model,
      messages,
      {
        thinking: opts.thinking ?? false,
        viewProps: opts.blur ? { blur: 4 } : { blur: 0 },
      },
    )

    if (error.value) throw new Error(error.value)
    return fullContent.value ?? ''
  }

  return { callStream }
}
```

**B. 新增 `callStreamWithParse`(`src/composables/llm/callWithParse.ts`)** — 用于"需要 JSON + 重试"的场景

> 2 处使用:`usePracticeFlow.generate`、`usePracticeFlow.judge`。
> 用户硬约束 8 要求"超过一个地方用到就封装"。

```ts
// src/composables/llm/callWithParse.ts
import { extractJson, validateShape, type JsonShape } from './json'
import type { CallStreamOptions } from './useLLM'

export interface ParseRetryOptions {
  schema?: JsonShape
  retries?: number
  /** judge 类场景:true 时最后一次失败回退为 { report: text } */
  fallbackReport?: boolean
}

export async function callStreamWithParse<T>(
  callStream: (opts: CallStreamOptions) => Promise<string>,
  options: CallStreamOptions & ParseRetryOptions,
): Promise<T> {
  const { schema, retries = 3, fallbackReport = false, ...streamOpts } = options
  let lastError: Error | null = null
  let lastText = ''

  for (let i = 0; i < retries; i++) {
    try {
      const text = await callStream(streamOpts)
      lastText = text
      const obj = extractJson(text)
      if (schema) validateShape(obj, schema)
      return obj as T
    } catch (e: any) {
      lastError = e
      if (i === retries - 1 && !(fallbackReport && schema && 'report' in schema)) {
        throw e
      }
    }
  }

  if (fallbackReport && schema && 'report' in schema && lastText) {
    return { report: lastText } as T
  }
  throw lastError ?? new Error('LLM call failed')
}
```

**C. 调整 `llm/index.ts`** — 重新导出
```ts
export { useLLM, type CallStreamOptions } from './useLLM'
export { callStreamWithParse, type ParseRetryOptions } from './callWithParse'
export { extractJson, validateShape, type JsonShape, type JsonShapeValue } from './json'
```

#### 2.3.2 `src/composables/useKeywordFlow.ts`(大瘦身,删除 runPrompt)
```ts
import { useLLM } from './llm'

export function useKeywordFlow() {
  const { callStream } = useLLM()

  async function generateMemo(subject: Subject, topic: Topic, keyword: string) {
    return callStream({
      promptKey: 'keyword-memo', subject, topic, scope: 'topic',
      extras: { keyword },
      // blur 默认 false
    })
  }

  async function evaluateMemo(
    subject: Subject, topic: Topic, keyword: string,
    memoText: string, userRecall: string,
  ) {
    return callStream({
      promptKey: 'keyword-evaluate', subject, topic, scope: 'topic',
      extras: { keyword, memoText, userRecall },
    })
  }

  return { generateMemo, evaluateMemo }
}
```

#### 2.3.3 `src/composables/usePracticeFlow.ts`(改用 callStreamWithParse)
- 删除 `kindOf`,改 import `examKindOf`
- 删除 `if (!isNormalMode.value) throw ...`,统一由 `useLLM.callStream` 内部检查
- 删除 `checkMode`
- `generate` / `judge` 内部用 `callStreamWithParse` 包裹 `callStream`

```ts
import { useLLM, callStreamWithParse } from './llm'
import { examKindOf } from '@/lib/examKind'

export function usePracticeFlow(examId: Ref<ExamId>) {
  const { callStream } = useLLM()

  async function generate(subject, topic, scope) {
    const kind = examKindOf(examId.value)
    const promptKey = kind === 'subjective' ? 'subjective-generate' : 'objective-generate'
    const schema = kind === 'subjective' ? SUBJECTIVE_GENERATE_SCHEMA : OBJECTIVE_GENERATE_SCHEMA
    const extras = scope === 'exam' ? { examSubjectsJson: buildExamSubjectsJson(examId.value) } : {}
    return callStreamWithParse(callStream, {
      promptKey, subject, topic, scope, extras,
      blur: true,  // 出题场景需要 blur
      schema, retries: 3,
    })
  }

  async function judge(subject, topic, scope, extras) {
    const kind = examKindOf(examId.value)
    const promptKey = kind === 'subjective' ? 'subjective-judge' : 'objective-judge'
    return callStreamWithParse(callStream, {
      promptKey, subject, topic, scope, extras,
      thinking: true,  // judge 场景需要思考
      schema: JUDGE_SCHEMA, retries: 3,
      fallbackReport: true,  // 失败时回退为 { report: text }
    })
  }

  return { generate, judge }
}
```

#### 2.3.4 `src/composables/usePromptStore.ts`(大瘦身)
- **保留**:`DEFAULT_PROMPTS`、`buildPrompt`、内部辅助 `findModule` / `buildSubjectKnowledgeContext` / `buildKnowledgeContext`
- **删除**:`custom` 状态、`load` / `save` / `removeCustom` / `hasCustom`、`usePromptStore()` hook、`useBuildPrompt`、`getPrompt`
- **删除行末**:`export type { Subject, Topic, Ref }`
- 估计行数 312 → ~150

#### 2.3.5 `src/composables/useRuntimeMode.ts`
- 暴露 `requireNormalMode()`:`() => { if (!isNormalMode.value) throw new Error('降级模式下无法使用 AI 功能') }`

#### 2.3.6 `src/composables/useSettings.ts`
- 用 `useLocalStorage('fakao_settings', { providers: [defaultProvider()] })` 替代 load/watch/save
- `nextId()` 改用 `genId('p')` 共享工具
- 把 defaultModelOptions 字符串拼接封装为 `defaultModelValue()` / `setDefaultModelByKey(key: string)`
- 保留 `resolveDefaultModel` 不变(对外契约)

#### 2.3.7 `src/composables/usePracticeTracker.ts`
- 用 `useLocalStorage('fakao_practice_v2', [])` 替代
- 保留 legacy migration(load 内部一次性处理)
- `record` / `getCount` / `getSubjectCount` / `list` 不变

#### 2.3.8 `src/composables/useWrongBook.ts`
- 用 `useLocalStorage('fakao_wrongbook', [])` 替代
- `genId()` → 用共享 `genId()`
- 暴露 `objectiveCount` / `subjectiveCount` 两个 `computed`,消除 Settings/WrongBook 视图里的重复 filter

#### 2.3.9 `src/composables/usePracticeCount.ts`
- 删除本地 `kindOf`,改为 `import { examKindOf } from '@/lib/examKind'`

#### 2.3.10 `src/components/PracticeModal.vue`
- 模板行 82/86 `marked.parse(...)` → 改用 `renderMarkdown` 共享工具
- 行 363-371 主观题分数展示改用 `formatScore` / `scoreTagType` / `scorePercent`
- 组件 scoped 样式中 `.ai-result` 相关 `:deep(...)` 全部删除,改为挂 `<div class="markdown">` 即可
- 模板中三处大量内联 `style="..."` 优先保留(非本轮范围,避免改动过大)

#### 2.3.11 `src/components/KeywordMemorizeModal.vue`
- `cacheKey` / `loadFromCache` / `saveToCache` / `clearCache` 改用 `useLocalStorage` 共享工具
  - 方案:`useKeywordCache(subjectId, topicId, keyword)` 内调 `useLocalStorage(key, null)`,key 由三个参数计算
  - 实际更轻:在 `useKeywordFlow` 内暴露 `loadMemo` / `saveMemo` / `clearMemo` 三个方法,内部用 `useLocalStorage`
- `.plain-text` 样式删除,改用 `.markdown` 共享样式

#### 2.3.12 `src/components/TopicCard.vue`
- 无需修改(已足够精简)

#### 2.3.13 `src/views/SettingsView.vue`
- **删除整个 `n-tab-pane name="prompts"`**(约 30 行模板 + 15 行 script)
- script 中删除 `usePromptStore` import、`promptItems`、`onResetPrompt`、`hasCustom`、`removeCustom`
- `defaultModelOptions` / `defaultModelValue` / `onDefaultModelChange` 改为引用 `useSettings` 暴露的 `defaultModelValue()` / `setDefaultModelByKey()`
- 客观/主观题统计改用 `useWrongBook` 暴露的 `objectiveCount` / `subjectiveCount`

#### 2.3.14 `src/views/WrongBookView.vue`
- `renderMarkdown` / `formatDate` / `scoreTagType` 局部函数删除,改 import 共享工具
- `objectiveCount` / `subjectiveCount` 改用 `useWrongBook` 暴露的 computed
- scoped 样式 `.ai-judge-content` 整块删除,模板中 `class="ai-judge-content"` 改为 `class="markdown"`

#### 2.3.15 `src/views/OutlineNotesView.vue`
- 局部 `renderMarkdown` 删除,改 import 共享工具
- scoped 样式 `.markdown-content` 改为 `class="markdown"`(共享样式已在 main.ts 全局加载)

#### 2.3.16 `src/views/PracticeView.vue`
- `kindOf` → `examKindOf`
- 其他无大改

#### 2.3.17 `src/views/OverviewView.vue`
- 无需修改(纯展示)

#### 2.3.18 `src/layouts/MainLayout.vue`
- `collapsed` ref + `onMounted` 读 localStorage + `toggleCollapse` 写 localStorage → 改为 `useLocalStorage('sidebar-collapsed', false)` + `computed collapsed`

#### 2.3.19 `src/types/exam.ts`
- `EXAM_KIND` 改为 `export { EXAM_KIND } from '@/lib/examKind'`(单一来源)
- 即:把 `EXAM_KIND` 的实际定义移入 `lib/examKind.ts`,`types/exam.ts` 仅 re-export,保持外部 API

#### 2.3.20 `src/main.ts`
- 增加 `import '@/styles/markdown.css'`

#### 2.3.21 `src/types/index.ts`
- `PromptKey` 联合类型移到 `usePromptStore.ts` 内部(local),从 `types/index.ts` 移除 export

### 2.4 不动的文件
- `src/composables/llm/json.ts`(纯工具,无重复)
- `src/router/index.ts`
- `src/lib/utils.ts`(已有 `cn` 工具)
- `src/App.vue`(已极简)
- 所有 `src/data/**` 与 `src/data/knowledge/**`
- `streamChat` 调用方式:一字不改(契约不变)

---

## 3. 关键决策与假设

1. **`EXAM_KIND` 迁移到 `lib/examKind.ts`**:`types/exam.ts` re-export,避免双向依赖且保持原 `EXAM_KIND` 名字对消费方透明。
2. **`useLocalStorage` 默认用 `JSON.stringify`**:与现状一致。
3. **`useLocalStorage` 不做 `key` 变更时的迁移**:超出本轮 scope。
4. **统一 `genId(prefix?: string)`**:不传则裸 UUID(适合错题),传 `'p'` 给供应商。
5. **删除 `Empty.vue` 和 `useTheme.ts`**:死代码不保留。
6. **`useRuntimeMode.requireNormalMode` 命名**:表达"调用即要求正常模式,不满足则 throw"。
7. **Markdown 共享样式以 `.markdown` 为统一类名**:原 4 个相似类全部统一,细微差异(背景色)通过外层 wrapper 处理。
8. **不修改 `streamChat` 调用方式**:本轮不动 streamChat 的入参与选项。
9. **`useLLM.callStream` 是唯一的 LLM 调用入口**:所有 LLM 调用经过此处,统一 prompt 装载、blur 默认 false、降级检查、system 提示词。
10. **`callStreamWithParse` 是 JSON 场景的高阶封装**:2 处使用(usePracticeFlow.generate/judge),符合"超过 1 处使用就封装"。
11. **`buildKnowledgeContext` 收紧为内部函数**:不暴露给 usePromptStore 外部 API。
12. **不重构 `useSettings.resolveDefaultModel` 内部命名**:虽"model" 实际是 modelName,留待后续。
13. **关键词背诵补 system 提示词**:`useKeywordFlow` 原先漏掉 system 提示词,统一到 `useLLM.callStream` 后自动修正。

---

## 4. 验证步骤

按以下顺序执行,任一步失败则停:

1. **静态检查**
   - `npm run check`(vue-tsc)0 错误
   - `npm run lint`(eslint)0 错误
2. **构建**
   - `npm run build` 成功
3. **运行时验证(开发服务器)**
   - 进入 `/#/practice`,不配置 API,确认降级模式提示与禁用的关键词 tag
   - 配置 API 后:
     - 客观题(整卷/科目/考点)三档出题 + 评判 + 错题收录
     - 主观题(整卷/科目/考点)三档出题 + 评判 + 错题收录
     - 关键词背诵(生成必背 → 默写 → AI 评析)
   - 错题集:列表展示、删除、统计、清空
   - 大纲笔记:Markdown 渲染正常
   - 设置:模型配置、默认模型、清空错题集(已删除提示词 tab,只有「模型设置」「错题集管理」两个 tab)
4. **持久化回归**
   - 刷新页面后:供应商、默认模型、练习次数、错题、侧栏折叠、关键词缓存 全部保留
5. **第三方库契约**
   - `vue-llm-stream-chat` 弹窗行为不变:出题、评判、关键词背诵均由库模态框接管
6. **blur 行为回归**
   - 出题场景:流式渲染有模糊(blur=4)
   - 评判、关键词背诵:流式渲染无模糊(blur=0)

---

## 5. 改动汇总(按文件)

### 新增 (5)
- `src/lib/format.ts`
- `src/lib/examKind.ts`
- `src/composables/useLocalStorage.ts`
- `src/styles/markdown.css`
- `src/composables/llm/callWithParse.ts`

### 重命名 (1)
- `src/composables/llm/ask.ts` → `src/composables/llm/useLLM.ts`(内容整体重写为统一入口)

### 删除 (2)
- `src/components/Empty.vue`
- `src/composables/useTheme.ts`

### 修改 (16)
- `src/composables/llm/index.ts`(re-exports)
- `src/composables/usePromptStore.ts`(大瘦身)
- `src/composables/useSettings.ts`
- `src/composables/usePracticeTracker.ts`
- `src/composables/useWrongBook.ts`
- `src/composables/usePracticeCount.ts`
- `src/composables/usePracticeFlow.ts`
- `src/composables/useRuntimeMode.ts`(加 requireNormalMode)
- `src/composables/useKeywordFlow.ts`(大瘦身)
- `src/components/PracticeModal.vue`
- `src/components/KeywordMemorizeModal.vue`
- `src/views/SettingsView.vue`(删提示词 tab)
- `src/views/WrongBookView.vue`
- `src/views/OutlineNotesView.vue`
- `src/views/PracticeView.vue`
- `src/layouts/MainLayout.vue`
- `src/main.ts`(加 1 行 import)
- `src/types/index.ts`(`PromptKey` 收紧)
- `src/types/exam.ts`(`EXAM_KIND` re-export)

### 不动
- `src/data/**`、`src/router/index.ts`、`src/lib/utils.ts`、`src/App.vue`、`src/views/OverviewView.vue`、`src/components/TopicCard.vue`、`src/composables/llm/json.ts`

---

## 6. 预期收益

- **代码量缩减估计**:
  - `usePromptStore.ts` -150 行
  - `useLLM.ask` 拆分后逻辑简化,callStream 仅 30 余行
  - `useKeywordFlow.ts` -25 行(删除 runPrompt)
  - `SettingsView.vue` -50 行
  - 共享样式 -200 行(分散在 4 处)
  - localStorage 模板 -60 行(分散在 6 处)
  - Markdown 渲染 / 分数 / 日期 / kindOf 重复 -30 行
  - **预计净减约 500~600 行**
- **LLM 调用统一**:全项目仅 1 个 `useLLM.callStream` 入口 + 1 个 `callStreamWithParse` 高阶封装,行为一致、可观测、可扩展
- **可维护性提升**:
  - 添加新视图时直接复用 `useLocalStorage` / `renderMarkdown` / `formatScore`
  - 提示词调整只改 `DEFAULT_PROMPTS` 一处(用户态无关)
  - 主题/统计类样式集中,改一处即全局生效
- **边界清晰**:
  - `lib/format.ts` / `lib/examKind.ts` / `useLocalStorage` / `useLLM` / `callStreamWithParse` 是稳定基础
  - composables 不再泄漏 localStorage / streamChat 细节
- **风险**:
  - 局部行为不变(行为契约由类型保证)
  - 第三方库调用不变(逐字保留)
  - 关键词背诵补 system 提示词 — 是 bug 修复,不是行为改变(原行为就缺)
