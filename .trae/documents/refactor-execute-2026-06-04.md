# 项目编码规范重构执行计划（最终执行版）

> **目标**:依照「复用 / 抽象 / 封装 / 有序 / 简单 / 稳健」完成项目重构剩余工作,保持核心功能。
>
> **硬约束**:
> 1. 不修改 `src/data/**`
> 2. 不修改对第三方库 `vue-llm-stream-chat` 的调用方式(`streamChat` 入参 / 选项契约保持不变)
> 3. 设置中已无提示词覆盖功能,用户态不再接触提示词
> 4. 统一 LLM 调用:点击按钮 → 装载提示词 → 调用 `streamChat` → 返回 `fullText` → 继续
> 5. 只有出题场景需要 `blur: true`,其它默认 `blur: false`
> 6. 任何在 2+ 处使用的函数,必须封装为公共组件 / composable / 工具

---

## 0. 现状速览(已完成 / 未完成)

### ✅ 0.1 已完成基础设施
- `src/lib/format.ts` — `renderMarkdown` / `formatDate` / `scoreTagType` / `scorePercent` / `formatScore` / `genId`
- `src/lib/examKind.ts` — `ExamKind` / `EXAM_KIND` / `examKindOf`(单一来源)
- `src/composables/useLocalStorage.ts` — 通用 localStorage 包装
- `src/styles/markdown.css` — 共享 `.markdown` 样式
- `src/types/exam.ts` — `EXAM_KIND` / `examKindOf` 从 `lib/examKind` re-export
- `src/composables/useRuntimeMode.ts` — 暴露 `requireNormalMode()` 守卫
- `src/composables/usePromptStore.ts` — 已精简,只剩 `DEFAULT_PROMPTS` / `buildPrompt` / 内部辅助

### ❌ 0.2 未完成(本计划执行)
1. `useLLM` 入口 + `callStreamWithParse` 抽离(`llm/ask.ts` → `useLLM.ts` + `callWithParse.ts`)
2. `useKeywordFlow` 改用统一 `useLLM.callStream`
3. `useSettings` / `usePracticeTracker` / `useWrongBook` 改用 `useLocalStorage` / `genId`
4. `useWrongBook` 暴露 `objectiveCount` / `subjectiveCount`
5. `usePracticeCount` 改用 `examKindOf`
6. `usePracticeFlow` 改用 `callStreamWithParse`(JSON+重试场景)
7. `PracticeModal` / `KeywordMemorizeModal` / `SettingsView` / `WrongBookView` / `OutlineNotesView` 引用共享工具与样式
8. `MainLayout` 侧栏折叠改用 `useLocalStorage`
9. `SettingsView` 删除提示词 tab,使用 `useWrongBook` 暴露的 counts
10. `PracticeView` `kindOf` → `examKindOf`
11. `main.ts` 引入 `markdown.css`
12. `types/index.ts` 移除 `PromptKey` 导出
13. 删除死代码:`Empty.vue` / `useTheme.ts`
14. `npm run check` / `npm run build` 0 错误

---

## 1. LLM 统一入口(核心)

### 1.1 新建 `src/composables/llm/useLLM.ts`(替代 `ask.ts`)

**契约**:装载提示词 → 调 `streamChat` → 返回 `fullText`。`streamChat` 第三方调用方式**逐字保留**。

```ts
import { useStreamChat } from 'vue-llm-stream-chat'
import { useSettings } from '../useSettings'
import { useRuntimeMode } from '../useRuntimeMode'
import { DEFAULT_PROMPTS, buildPrompt } from '../usePromptStore'
import type { Subject, Topic } from '@/types/exam'
import type { ChatMessage } from '@/types'

export interface CallStreamOptions {
  /** 模板键;与 prompt 二选一(同传则 prompt 优先) */
  promptKey?: PromptKey
  /** 直接给定的 user prompt(跳过 buildPrompt) */
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

### 1.2 新建 `src/composables/llm/callWithParse.ts`

> 封装「`callStream` + JSON 解析 + 重试 + 失败回退」,2 处使用(`usePracticeFlow.generate` / `.judge`)。

```ts
import { extractJson, validateShape, type JsonShape } from './json'
import type { CallStreamOptions } from './useLLM'

export interface ParseRetryOptions {
  schema?: JsonShape
  retries?: number
  /** judge 场景:最后一次失败回退为 { report: text } */
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
    }
  }

  if (fallbackReport && schema && 'report' in schema && lastText) {
    return { report: lastText } as T
  }
  throw lastError ?? new Error('LLM call failed')
}
```

### 1.3 删除 `src/composables/llm/ask.ts` + 更新 `src/composables/llm/index.ts`

```ts
export { useLLM, type CallStreamOptions } from './useLLM'
export { callStreamWithParse, type ParseRetryOptions } from './callWithParse'
export { extractJson, validateShape, type JsonShape, type JsonShapeValue } from './json'
```

> **`PromptKey` 类型**:从 `src/types/index.ts` 移除,改为在 `useLLM.ts` 中 `import type { PromptKey } from '../usePromptStore'`(已经在该文件 export,见 §7)。

---

## 2. 简化 `useKeywordFlow.ts`(大瘦身)

```ts
import { useLLM } from './llm'
import type { Subject, Topic } from '@/types/exam'

export function useKeywordFlow() {
  const { callStream } = useLLM()

  async function generateMemo(subject: Subject, topic: Topic, keyword: string): Promise<string> {
    return callStream({
      promptKey: 'keyword-memo', subject, topic, scope: 'topic',
      extras: { keyword },
      // blur 默认 false
    })
  }

  async function evaluateMemo(
    subject: Subject, topic: Topic, keyword: string,
    memoText: string, userRecall: string,
  ): Promise<string> {
    return callStream({
      promptKey: 'keyword-evaluate', subject, topic, scope: 'topic',
      extras: { keyword, memoText, userRecall },
    })
  }

  return { generateMemo, evaluateMemo }
}
```

> **删除**:`runPrompt` / `useStreamChat` 直接调用 / 重复的 `isNormalMode` 检查 / 重复的 `resolveDefaultModel` 解析 / 重复的 `error` 抛出。
> **新增**:系统提示词(原代码漏加,通过 `useLLM.callStream` 隐式修复)。

---

## 3. 重构持久化 composables

### 3.1 `src/composables/useSettings.ts`
- 内部 `nextId()` → 用 `genId('p')` 共享工具
- 用 `useLocalStorage('fakao_settings', { providers: [defaultProvider()] })` 替代手写 load/save/watch
- 暴露 `defaultModelOptions`(原 `SettingsView` 内联逻辑,移到 useSettings 内部)与 `defaultModelValue` / `setDefaultModelByKey`
- 行为契约:`resolveDefaultModel` / `settings` / `addProvider` / `removeProvider` / `addModel` / `removeModel` / `setDefaultModel` / `clearDefaultModel` 全部保留

```ts
const settings = useLocalStorage<Settings>('fakao_settings', { providers: [defaultProvider()] })

// 暴露给 SettingsView,避免 30+ 行内联模板
const defaultModelOptions = computed(() => /* 原 SettingsView 内的实现 */)
const defaultModelValue = computed(() => /* ... */)
function setDefaultModelByKey(v: string) { /* ... */ }
```

### 3.2 `src/composables/usePracticeTracker.ts`
- 用 `useLocalStorage('fakao_practice_v2', [])` 替代
- 保留 `legacy migration`:在 `useLocalStorage` 初始化时一次性处理 `fakao_practice` → `fakao_practice_v2` 迁移(改用一个工厂函数返回 `fallback`,把迁移结果传给 `useLocalStorage`)
- `record` / `getCount` / `getSubjectCount` / `list` 行为不变

```ts
const records = useLocalStorage<PracticeRecord[]>(
  'fakao_practice_v2',
  migrateLegacy(),  // 工厂函数:从 fakao_practice 读取并转换
)
```

### 3.3 `src/composables/useWrongBook.ts`
- 用 `useLocalStorage('fakao_wrongbook', [])` 替代
- 内部 `genId()` → 共享 `genId()`
- **新增**暴露 `objectiveCount` / `subjectiveCount` 两个 `computed`,消除 SettingsView / WrongBookView 里的重复 filter
- `add` / `remove` / `list` / `clear` / `has` 行为不变

```ts
const items = useLocalStorage<WrongBookItem[]>('fakao_wrongbook', [])
const objectiveCount = computed(() => items.value.filter(i => i.type === 'objective').length)
const subjectiveCount = computed(() => items.value.filter(i => i.type === 'subjective').length)
```

---

## 4. `usePracticeCount.ts` 使用 `examKindOf`

- 删除文件内部 `kindOf` 闭包(行 20)
- 改 `import { examKindOf } from '@/lib/examKind'`
- 全部 `kindOf(examId)` 改 `examKindOf(examId)`

---

## 5. `usePracticeFlow.ts` 改用 `callStreamWithParse`

- 删除 `kindOf`(改用 `examKindOf`)
- 删除 `useRuntimeMode` import 与 `checkMode`(降级检查由 `useLLM.callStream` 内部处理)
- `generate` / `judge` 内部用 `callStreamWithParse(callStream, {...})`
- `generate` 传 `blur: true`(出题场景)
- `judge` 传 `thinking: true` 与 `fallbackReport: true`

```ts
import { useLLM, callStreamWithParse } from './llm'
import { examKindOf } from '@/lib/examKind'

export function usePracticeFlow(examId: Ref<ExamId>) {
  const { callStream } = useLLM()

  async function generate(subject: Subject, topic: Topic, scope: PracticeScope) {
    const kind = examKindOf(examId.value)
    const promptKey = kind === 'subjective' ? 'subjective-generate' : 'objective-generate'
    const schema = kind === 'subjective' ? SUBJECTIVE_GENERATE_SCHEMA : OBJECTIVE_GENERATE_SCHEMA
    const extras: Record<string, string> = {}
    if (scope === 'exam') extras.examSubjectsJson = buildExamSubjectsJson(examId.value)
    return callStreamWithParse<ObjectiveGenerateOut | SubjectiveGenerateOut>(callStream, {
      promptKey, subject, topic, scope, extras,
      blur: true,
      schema, retries: 3,
    })
  }

  async function judge(subject, topic, scope, extras: Record<string, string>): Promise<JudgeOut> {
    const kind = examKindOf(examId.value)
    const promptKey = kind === 'subjective' ? 'subjective-judge' : 'objective-judge'
    return callStreamWithParse<JudgeOut>(callStream, {
      promptKey, subject, topic, scope, extras,
      thinking: true,
      schema: JUDGE_SCHEMA, retries: 3,
      fallbackReport: true,
    })
  }

  return { generate, judge }
}
```

---

## 6. 组件 / 视图精简

### 6.1 `src/components/PracticeModal.vue`
- 顶部 `import { marked }` 删除,改 `import { renderMarkdown, scoreTagType, scorePercent, formatScore } from '@/lib/format'`
- 模板行 80-87 `marked.parse(...)` → `renderMarkdown(...)`
- 模板行 366-372 内联分数展示 → `:type="scoreTagType(score)"` + `{{ formatScore(score) }}` 或解构
- `<div class="ai-result" v-html="...">` 改为 `<div class="markdown" ...>` 共享样式
- 删除组件 scoped 样式中 `.ai-result :deep(...)` 整块(共 50+ 行,迁移到全局 `markdown.css`)

### 6.2 `src/components/KeywordMemorizeModal.vue`
- `cacheKey` / `loadFromCache` / `saveToCache` / `clearCache` 改用 `useLocalStorage`
  - 方案:在 `useKeywordFlow` 内暴露 `loadMemo` / `saveMemo` / `clearMemo`,内部用 `useLocalStorage('fakao_keyword_memo:<s>:<t>:<k>', null)`
  - 简化:`useKeywordCache(subjectId, topicId, keyword)` composable
- `.plain-text` 样式删除,改用 `.markdown` 共享样式(无需 markdown 渲染,纯文本展示,继承 `white-space: pre-wrap` 的局部类)

> 由于 `KeywordMemorizeModal` 的 memo 是纯文本不是 markdown,`.markdown` 类不合适。**改为**:在 `markdown.css` 加一个 `.plain-text-block` 类(同样白底圆角,与 markdown 分离)或将 `.markdown` 内的 `white-space: pre-wrap` 也保留,模板挂 `.markdown` 类即可。

### 6.3 `src/views/SettingsView.vue`
- **删除**整个 `n-tab-pane name="prompts"`(约 30 行模板 + 30 行 script)
- script 中删除 `usePromptStore` / `PromptKey` / `promptItems` / `onResetPrompt` / `hasCustom` / `removeCustom`
- `defaultModelOptions` / `defaultModelValue` / `onDefaultModelChange` → 改用 `useSettings()` 暴露的同名 API
- `objectiveCount` / `subjectiveCount` → 改用 `useWrongBook` 暴露的 computed

### 6.4 `src/views/WrongBookView.vue`
- 局部 `renderMarkdown` / `formatDate` / `scoreTagType` 删除,改 import 共享工具
- `objectiveCount` / `subjectiveCount` 改用 `useWrongBook` 暴露的 computed
- 模板中 `class="ai-judge-content"` → `class="markdown"`
- scoped 样式 `.ai-judge-content` 整块删除(共 50+ 行)

### 6.5 `src/views/OutlineNotesView.vue`
- 局部 `renderMarkdown` 删除,改 import 共享工具
- 模板中 `class="markdown-content"` → `class="markdown"`
- scoped 样式 `.markdown-content` 整块删除(共 70+ 行)

### 6.6 `src/views/PracticeView.vue`
- `import { kindOf } from '@/composables/usePracticeFlow'` → `import { examKindOf } from '@/lib/examKind'`
- `kindOf(examId.value)` → `examKindOf(examId.value)`

---

## 7. `usePromptStore.ts` 二次清理

虽然之前已精简,但因 `SettingsView` 删除提示词 tab、`ask.ts` 删除 `getPrompt` import,以下符号已无外部引用:
- 行 4 `export type PromptKey` — 改为 `export type`(供 `useLLM.ts` / `llm/index.ts` 使用,**保留**)
- 末尾的 `export type { Subject, Topic, Ref }` — **删除**(无外部使用)
- `findModule` / `buildSubjectKnowledgeContext` / `buildKnowledgeContext` 已是 `function` 非 export,无需改

---

## 8. `types/index.ts` 清理

```diff
- export type PromptKey = 'system' | ...
```
- 该类型已在 `usePromptStore.ts` 中 export,`useLLM.ts` / 其它文件改 import 此处
- `ChatMessage` 保留(系统提示词需要)

---

## 9. `MainLayout.vue` 侧栏折叠

```diff
- const collapsed = ref(false)
- onMounted(() => {
-   const saved = localStorage.getItem('sidebar-collapsed')
-   if (saved !== null) collapsed.value = saved === 'true'
- })
- const toggleCollapse = () => {
-   collapsed.value = !collapsed.value
-   localStorage.setItem('sidebar-collapsed', String(collapsed.value))
- }
+ const collapsed = useLocalStorage<boolean>('sidebar-collapsed', false)
+ const toggleCollapse = () => { collapsed.value = !collapsed.value }
```

> `useLocalStorage` 当前设计是 JSON 序列化 boolean,`true`/`false` 字符串来回转换不影响显示。

---

## 10. `main.ts` 引入共享样式

```diff
  import './style.css'
+ import '@/styles/markdown.css'
  import App from './App.vue'
```

---

## 11. 死代码删除

| 文件 | 理由 |
|---|---|
| `src/components/Empty.vue` | 无 import 引用 |
| `src/composables/useTheme.ts` | 无 import 引用 |

---

## 12. 关键决策与假设

1. **统一 `useLLM.callStream`**:`streamChat` 调用方式**逐字保留**(满足硬约束 2);`callStreamWithParse` 是 JSON 场景的高阶封装(2 处使用,符合「2+ 处封装」规则)。
2. **统一 `genId(prefix?: string)`**:不传则裸 UUID(适合错题),传 `'p'` 给供应商。
3. **`useLocalStorage` 行为**:首次读取时用 `fallback`(可为函数,处理 legacy migration),`watch deep` 自动写回。
4. **不重命名 `EXAM_KIND`**:保持外部 API 不变,`types/exam.ts` re-export 自 `lib/examKind.ts`。
5. **删除 `usePromptStore` 的 `usePromptStore()` hook / `getPrompt` / `useBuildPrompt`**:提示词完全后端化,无任何用户态入口。
6. **`requireNormalMode` 命名**:表达「调用即要求正常模式,不满足则 throw」。
7. **`MainLayout` 侧栏**:`useLocalStorage<boolean>` 存 `true`/`false`,无需迁移。
8. **`.plain-text` vs `.markdown`**:纯文本展示走 `.markdown`(挂载同样样式 + `white-space: pre-wrap`),无需新加类。

---

## 13. 验证步骤(每步必跑,失败即停)

1. `npm run check`(vue-tsc)0 错误
2. `npm run build` 成功
3. **运行时验证**(开发者自查)
   - 「设置」只剩 2 个 tab:模型设置 / 错题集管理
   - 演练页:降级模式提示正确
   - 客观题(整卷/科目/考点)出题 + 评判 + 错题收录
   - 主观题(整卷/科目/考点)出题 + 评判 + 错题收录
   - 关键词背诵:生成必背 / 默写 / AI 评析
   - 错题集:列表、删除、统计、清空
   - 大纲笔记:Markdown 渲染正常
4. **持久化回归**:供应商、默认模型、练习次数、错题、侧栏折叠、关键词缓存 全部保留
5. **第三方库契约**:`streamChat` 调用方式不变;出题 blur=4,其它 blur=0
6. **行为不变**:出题有 blur,评判/关键词无 blur

---

## 14. 改动文件清单

### 新增 (3)
- `src/composables/llm/useLLM.ts`
- `src/composables/llm/callWithParse.ts`

### 删除 (3)
- `src/composables/llm/ask.ts`
- `src/components/Empty.vue`
- `src/composables/useTheme.ts`

### 修改 (17)
- `src/composables/llm/index.ts` — 重新导出
- `src/composables/useSettings.ts` — `useLocalStorage` / `genId` / 暴露默认模型 API
- `src/composables/usePracticeTracker.ts` — `useLocalStorage` + legacy migration
- `src/composables/useWrongBook.ts` — `useLocalStorage` / `genId` / 暴露 counts
- `src/composables/usePracticeCount.ts` — 用 `examKindOf`
- `src/composables/usePracticeFlow.ts` — 改用 `callStreamWithParse` / `examKindOf` / 删 `checkMode`
- `src/composables/useKeywordFlow.ts` — 改用 `useLLM.callStream` / 删 `runPrompt`
- `src/composables/usePromptStore.ts` — 删末尾 `export type { Subject, Topic, Ref }`
- `src/components/PracticeModal.vue` — 用共享工具与样式
- `src/components/KeywordMemorizeModal.vue` — 用 `useLocalStorage` 缓存
- `src/views/SettingsView.vue` — 删提示词 tab,使用 `useSettings` / `useWrongBook` 暴露的 API
- `src/views/WrongBookView.vue` — 用共享工具与样式
- `src/views/OutlineNotesView.vue` — 用共享工具与样式
- `src/views/PracticeView.vue` — 用 `examKindOf`
- `src/layouts/MainLayout.vue` — `useLocalStorage` 侧栏
- `src/main.ts` — 引入 `markdown.css`
- `src/types/index.ts` — 移除 `PromptKey` export

### 不动
- `src/lib/format.ts` / `src/lib/examKind.ts` / `src/lib/utils.ts`
- `src/composables/useLocalStorage.ts` / `src/composables/useRuntimeMode.ts`
- `src/types/exam.ts` / `src/composables/llm/json.ts`
- `src/components/TopicCard.vue` / `src/views/OverviewView.vue`
- `src/styles/markdown.css` / `src/router/index.ts` / `src/App.vue`
- 所有 `src/data/**`

---

## 15. 预期收益

- **代码量净减**:
  - `useKeywordFlow` -25 行(删除 `runPrompt` 重复实现)
  - `SettingsView` -80 行(删提示词 tab + 默认模型逻辑下沉)
  - `WrongBookView` -60 行(scoped 样式)
  - `OutlineNotesView` -75 行(scoped 样式)
  - `PracticeModal` -50 行(scoped 样式 + 分数内联)
  - `useWrongBook` / `useSettings` / `usePracticeTracker` 各 -10 行
  - **预计净减 300+ 行**
- **单一入口**:全项目 1 个 `useLLM.callStream` 入口,1 个 `callStreamWithParse` 高阶封装
- **可维护性提升**:新增功能只需复用 `useLocalStorage` / `renderMarkdown` / `formatScore` / `examKindOf`
- **边界清晰**:`lib/format.ts` / `lib/examKind.ts` / `useLocalStorage` / `useLLM` / `callStreamWithParse` 是稳定基础

---

## 16. 执行顺序

按以下顺序执行,每步独立 commit(用户未要求 commit,默认不 commit):

1. 创建 `useLLM.ts` + `callWithParse.ts`,更新 `llm/index.ts`,删除 `ask.ts`
2. 重构 `useKeywordFlow.ts`
3. 重构 `useSettings.ts` / `usePracticeTracker.ts` / `useWrongBook.ts`
4. 重构 `usePracticeCount.ts` / `usePracticeFlow.ts`
5. 重构 `PracticeModal.vue` / `KeywordMemorizeModal.vue`
6. 重构 `SettingsView.vue` / `WrongBookView.vue` / `OutlineNotesView.vue` / `PracticeView.vue`
7. 重构 `MainLayout.vue`
8. 更新 `main.ts` / `types/index.ts` / `usePromptStore.ts` 收尾
9. 删除 `Empty.vue` / `useTheme.ts`
10. `npm run check` + `npm run build` 验证
