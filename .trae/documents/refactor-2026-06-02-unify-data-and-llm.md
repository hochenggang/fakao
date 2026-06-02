# 重构计划 v2：完全重构 · 优雅迭代

> **基调**：不考虑任何兼容层；删除即删除；不为旧 API 留出口。
> 所有"导出兼容映射"全部砍掉，所有"在原结构上 patch"全部砍掉。

---

## 0. 现状与目标

### 0.1 痛点（用户视角）

- **数据冗余**：同一 `Subject` 在三处数组（`paper1/paper2/subjective`）重复声明，靠 `name` 字符串做关联，AI 出题时还按 `subjectName` 找 paper（`getPaperSubjectsByName` 这种 hack）。
- **AI 抽象破碎**：调用方要自己管 SSE 模态框、retry、JSON 抽取、blur、thinking 状态；同一段流程在 `ObjectiveModal` 和 `SubjectiveModal` 各写一遍。
- **视图/模态重复**：`ObjectiveView` 与 `SubjectiveView`、`ObjectiveModal` 与 `SubjectiveModal` 几乎是一份模板的两份拷贝，差异仅是题型。

### 0.2 设计目标

1. 数据是**单一真相源**：`exams` 一棵扁平树，AI 与 UI 都消费它。
2. AI 调用是**一个函数**：`useLLM().ask(messages, schema)` → 结构化结果。SSE 模态、retry、JSON 抽取、blur 全部托管。
3. UI 是**一个视图 + 一个模态**：通过 `ExamId` 决定模式渲染，所有差异收敛到一个 `v-if` 分支。
4. 代码量与耦合面同时**减少**，新增题型或新考试只需要加一个 `ExamId` 与一个 schema 描述。

---

## 1. 数据结构（干净替换）

### 1.1 `src/types/exam.ts`（新文件）

> 单独抽出 exam 相关类型，不污染 `types/index.ts`。

```ts
export const EXAM_IDS = ['exam1', 'exam2', 'exam3'] as const
export type ExamId = (typeof EXAM_IDS)[number]

export const EXAM_NAMES: Record<ExamId, string> = {
  exam1: '客观题（卷一）',
  exam2: '客观题（卷二）',
  exam3: '主观题',
}

export const EXAM_KIND: Record<ExamId, 'objective' | 'subjective'> = {
  exam1: 'objective',
  exam2: 'objective',
  exam3: 'subjective',
}

export interface Keyword { text: string }   // 显式结构化，预留元数据

export interface Topic {
  id: string          // 内部 key
  name: string        // 展示用
  keywords: string[]  // 字符串，绑 topic 才有意义
}

export interface Subject {
  id: string
  name: string
  topics: Topic[]
}

export interface Exam {
  id: ExamId
  name: string
  subjects: Subject[]
}
```

> 用 `as const` + `Record` 让 `ExamId` 与 `name/kind` 形成**编译期联动**——加新 Exam 只需要在 `EXAM_IDS` 数组里加一行，TS 会自动强制补齐 name/kind。

### 1.2 `src/data/exams.ts`（新文件）

```ts
import type { Exam, ExamId } from '@/types/exam'

export const exams: Exam[] = [
  { id: 'exam1', name: '客观题（卷一）', subjects: [ /* 9 科，每科 3-5 topic */ ] },
  { id: 'exam2', name: '客观题（卷二）', subjects: [ /* 9 科 */ ] },
  { id: 'exam3', name: '主观题',         subjects: [ /* 10 科 */ ] },
]

export const examById = (id: ExamId): Exam | undefined => exams.find(e => e.id === id)

export const findSubject = (id: ExamId, subjectId: string): Subject | undefined =>
  examById(id)?.subjects.find(s => s.id === subjectId)

export const findTopic = (id: ExamId, subjectId: string, topicId: string): Topic | undefined =>
  findSubject(id, subjectId)?.topics.find(t => t.id === topicId)

export const allTopics = (): Array<{ exam: Exam; subject: Subject; topic: Topic }> =>
  exams.flatMap(e => e.subjects.flatMap(s => s.topics.map(t => ({ exam: e, subject: s, topic: t }))))
```

> 旧 `subjects.ts` 整体删除。keywords 来源：把原 `description` 拆成 3~5 条短语（`xxx 的构成要件` / `xxx 的法律效果` 等）。

---

## 2. AI 调用统一（核心抽象）

### 2.1 设计

```vue
<template>
  <AiSseProvider>
    <NMessageProvider>...</NMessageProvider>
  </AiSseProvider>
</template>
```

```ts
const llm = useLLM()

const out = await llm.ask<{ topicId: string; caseText: string; question: string }>({
  messages,
  thinking: true,
  blur: true,
  schema: { topicId: 'string', caseText: 'string', question: 'string' },
})
// out 已校验、已重试；out.topicId 可以直接传给 findTopic 拿展示名
```

### 2.2 新文件：`src/composables/llm/createSseContext.ts`

```ts
import { ref, readonly } from 'vue'
import { useSettings } from '@/composables/useSettings'
import { useAiCallRaw } from './useAiCallRaw'   // 旧 streamChat 的纯函数版
import { getPrompt } from '@/composables/usePromptStore'
import { extractJson, validateShape, type JsonShape } from './json'

export interface AskOptions {
  messages: ChatMessage[]
  schema?: JsonShape
  thinking?: boolean
  blur?: boolean
  retries?: number               // 默认 3
  system?: string                // 默认 system prompt
}

export interface SseContext {
  streamingText: Readonly<Ref<string>>
  reasoningText: Readonly<Ref<string>>
  isStreaming: Readonly<Ref<boolean>>
  isThinking: Readonly<Ref<boolean>>
  showStream: Readonly<Ref<boolean>>
  blur: Readonly<Ref<boolean>>
  lastError: Readonly<Ref<Error | null>>
  ask: <T extends Record<string, unknown>>(opts: AskOptions) => Promise<T>
  cancel: () => void
}

export function createSseContext(): SseContext {
  const { settings } = useSettings()
  const { streamChat } = useAiCallRaw()

  const streamingText = ref('')
  const reasoningText = ref('')
  const isStreaming = ref(false)
  const isThinking = ref(false)
  const showStream = ref(false)
  const blur = ref(false)
  const lastError = ref<Error | null>(null)
  let abortRef: AbortController | null = null

  function pickProvider() {
    const p = settings.value.providers.find(x =>
      x.baseUrl.trim() && x.apiKey.trim() && x.models.some(m => m.name.trim())
    )
    if (!p) throw new Error('请先在设置中配置 API 信息')
    const m = p.models.find(m => m.name.trim())!
    return { provider: p, model: m }
  }

  async function ask<T extends Record<string, unknown>>(opts: AskOptions): Promise<T> {
    const { provider, model } = pickProvider()
    const retries = opts.retries ?? 3
    const system = opts.system ?? getPrompt('system')
    const fullMessages: ChatMessage[] = [{ role: 'system', content: system }, ...opts.messages]

    isStreaming.value = true
    isThinking.value = !!opts.thinking
    showStream.value = true
    blur.value = !!opts.blur
    streamingText.value = ''
    reasoningText.value = ''
    lastError.value = null
    abortRef = new AbortController()

    let lastErr: Error | null = null
    for (let i = 0; i < retries; i++) {
      try {
        const full = await streamChat(provider, model.name, fullMessages, {
          thinking: opts.thinking,
          signal: abortRef.signal,
          onChunk: (_, text) => (streamingText.value = text),
          onThinking: (_, text) => (reasoningText.value = text),
        })
        const obj = extractJson(full)
        validateShape(obj, opts.schema)         // 缺失必填字段 → 抛错进入下次重试
        return obj as T
      } catch (e: any) {
        lastErr = e
        if (e.name === 'AbortError') break
      }
    }
    lastError.value = lastErr
    throw lastErr ?? new Error('AI 调用失败')
  }

  function cancel() {
    abortRef?.abort()
    isStreaming.value = false
    showStream.value = false
  }

  return {
    streamingText: readonly(streamingText),
    reasoningText: readonly(reasoningText),
    isStreaming: readonly(isStreaming),
    isThinking: readonly(isThinking),
    showStream: readonly(showStream),
    blur: readonly(blur),
    lastError: readonly(lastError),
    ask, cancel,
  }
}
```

### 2.3 新文件：`src/composables/llm/json.ts`

```ts
export type JsonShape = Record<string, 'string' | 'number' | 'boolean' | 'string[]' | JsonShape | JsonShape[]>

export function extractJson(text: string): Record<string, unknown> {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('未找到 JSON 内容')
  return JSON.parse(m[0])
}

export function validateShape(obj: unknown, shape?: JsonShape): void {
  if (!shape) return
  if (typeof obj !== 'object' || obj === null) throw new Error('返回不是对象')
  for (const [k, v] of Object.entries(shape)) {
    if (!(k in (obj as any))) throw new Error(`缺少字段 ${k}`)
    // 极简类型校验，足以覆盖 90% 场景
    const actual = (obj as any)[k]
    if (v === 'string' && typeof actual !== 'string') throw new Error(`${k} 应为 string`)
    if (v === 'number' && typeof actual !== 'number') throw new Error(`${k} 应为 number`)
    if (v === 'string[]' && !(Array.isArray(actual) && actual.every(x => typeof x === 'string')))
      throw new Error(`${k} 应为 string[]`)
  }
}
```

> 不引入 zod/ajv，类型用字符串字面量描述，足够优雅且无依赖。

### 2.4 新文件：`src/composables/llm/provider.ts`

```ts
import { provide, inject, type InjectionKey } from 'vue'
import { createSseContext, type SseContext } from './createSseContext'

const KEY: InjectionKey<SseContext> = Symbol('AiSseProvider')

export function provideAiSse() {
  const ctx = createSseContext()
  provide(KEY, ctx)
  return ctx
}

export function useLLM(): SseContext {
  const ctx = inject(KEY)
  if (!ctx) throw new Error('useLLM 必须在 <AiSseProvider> 内部使用')
  return ctx
}
```

### 2.5 新组件：`src/components/AiSseProvider.vue`

```vue
<script setup lang="ts">
import { provideAiSse } from '@/composables/llm/provider'
import SseStreamModal from './SseStreamModal.vue'

const ctx = provideAiSse()
</script>

<template>
  <slot />
  <SseStreamModal
    v-model:show="ctx.showStream.value"
    :streaming-text="ctx.streamingText.value"
    :reasoning-text="ctx.reasoningText.value"
    :blur="ctx.blur.value"
  />
</template>
```

### 2.6 `src/composables/useAiCall.ts` 改为最小底层

仅保留 `streamChat` 纯函数（不再被外部组件直接调用，仅供 `createSseContext` 内部用），文件改名 `useAiCallRaw.ts`（避免与 llm/ 同名混淆）。`useAiCall()` 包装函数**删除**。

---

## 3. 出题 / 评判 Composable

### 3.1 新文件：`src/composables/usePracticeFlow.ts`

```ts
import type { ExamId, Subject, Topic } from '@/types/exam'
import { useLLM } from './llm/provider'
import { buildPrompt } from './usePromptStore'
import { useSettings } from './useSettings'
import { useRuntimeMode } from './useRuntimeMode'

export type PracticeScope = 'topic' | 'subject' | 'exam'

// === 客观题 ===
export interface ObjectiveSingleQ {
  question: string
  options: Array<{ label: string; text: string }>
  correctAnswer: string
  explanation: string
}
export interface ObjectiveMultiQ extends Omit<ObjectiveSingleQ, 'correctAnswer'> {
  correctAnswer: string[]
}
export interface ObjectiveGenerateOut {
  topicId: string
  topicName: string
  single: ObjectiveSingleQ
  multiple: ObjectiveMultiQ
}

// === 主观题 ===
export interface SubjectiveGenerateOut {
  topicId: string
  topicName: string
  caseText: string
  question: string
}

// === 评判 ===
export interface JudgeOut {
  report: string
  score?: [number, number]
  referenceAnswer?: string
}

export function usePracticeFlow(examId: Ref<ExamId>) {
  const llm = useLLM()
  const { isNormalMode } = useRuntimeMode()

  async function generate(subject: Subject, topic: Topic, scope: PracticeScope) {
    if (!isNormalMode.value) throw new Error('降级模式下无法使用 AI 功能')
    const kind = examId.value === 'exam3' ? 'subjective' : 'objective'
    const promptKey = kind === 'subjective' ? 'subjective-generate' : 'objective-generate'
    const prompt = buildPrompt(promptKey, subject, topic, scope)
    const schema = kind === 'subjective'
      ? { topicId: 'string', topicName: 'string', caseText: 'string', question: 'string' }
      : {
          topicId: 'string', topicName: 'string',
          single: { question: 'string', options: 'string[]', correctAnswer: 'string', explanation: 'string' },
          multiple: { question: 'string', options: 'string[]', correctAnswer: 'string[]', explanation: 'string' },
        } as any
    return llm.ask<SubjectiveGenerateOut | ObjectiveGenerateOut>({
      messages: [{ role: 'user', content: prompt }],
      schema: schema as any,
      thinking: false,
      blur: true,
    })
  }

  async function judge(
    subject: Subject,
    topic: Topic,
    scope: PracticeScope,
    payload: Record<string, unknown>,
  ): Promise<JudgeOut> {
    if (!isNormalMode.value) throw new Error('降级模式下无法使用 AI 功能')
    const kind = examId.value === 'exam3' ? 'subjective' : 'objective'
    const promptKey = kind === 'subjective' ? 'subjective-judge' : 'objective-judge'
    const prompt = buildPrompt(promptKey, subject, topic, scope, payload)
    return llm.ask<JudgeOut>({
      messages: [{ role: 'user', content: prompt }],
      schema: { report: 'string', score: 'string[]', referenceAnswer: 'string' } as any,
      thinking: true,
      blur: false,
    })
  }

  return { generate, judge }
}
```

> **关键收敛点**：出题 schema 跟 `ObjectiveGenerateOut` / `SubjectiveGenerateOut` 类型一一对应，调用方拿到结果后**直接** `findTopic(examId, subjectId, result.topicId)` 渲染。

### 3.2 `src/composables/usePromptStore.ts` 重构

```ts
import type { Subject, Topic } from '@/types/exam'
import { knowledgeModules } from '@/data/knowledge'

export type PromptKey = 'system' | 'objective-generate' | 'subjective-generate' | 'objective-judge' | 'subjective-judge'

// DEFAULT_PROMPTS 改为接收 { subject, topic, knowledgeContext, ...extras } 字符串模板
// 内部统一：占位符 {subject} / {topic} / {knowledgeContext} / {extras.xxx}

export function buildPrompt(
  key: PromptKey,
  subject: Subject,
  topic: Topic,
  scope: 'topic' | 'subject' | 'exam',
  extras: Record<string, string> = {},
): string {
  const knowledgeContext = buildKnowledgeContext(subject, scope)
  const tpl = getPrompt(key)
  return tpl
    .replace(/\{subject\}/g, subject.name)
    .replace(/\{topic\}/g, topic.name)
    .replace(/\{knowledgeContext\}/g, knowledgeContext)
    .replace(/\{(\w+)\}/g, (_, k) => extras[k] ?? '')
}
```

> 不再用字符串匹配 paper；`buildKnowledgeContext(subject, scope)` 内部根据 `scope` 决定取哪一个 `knowledgeModules` 片段（用 `subject.name` 匹配 module），或拼接该 subject 的所有 topic 上下文。

---

## 4. UI 完全收敛

### 4.1 新视图：`src/views/PracticeView.vue`

```vue
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NSelect, NButton, NCollapse, NCollapseItem, NTag, NSpace, NCard, NAlert } from 'naive-ui'
import { Edit16Regular } from '@vicons/fluent'
import { exams, EXAM_IDS, EXAM_NAMES, type ExamId } from '@/data/exams'
import { useRuntimeMode } from '@/composables/useRuntimeMode'
import { usePracticeTracker } from '@/composables/usePracticeTracker'
import { usePracticeCount } from '@/composables/usePracticeCount'
import PracticeModal from '@/components/PracticeModal.vue'
import type { Subject, Topic } from '@/types/exam'

const examId = ref<ExamId>('exam1')
const subjectId = ref<string | null>(null)
const modal = ref<{ show: boolean; subject?: Subject; topic?: Topic; scope: 'topic' | 'subject' | 'exam' }>({ show: false })

const examOptions = EXAM_IDS.map(id => ({ label: EXAM_NAMES[id], value: id }))
const currentExam = computed(() => exams.find(e => e.id === examId.value)!)
const visibleSubjects = computed(() =>
  subjectId.value ? currentExam.value.subjects.filter(s => s.id === subjectId.value) : currentExam.value.subjects
)
const subjectOptions = computed(() => currentExam.value.subjects.map(s => ({ label: s.name, value: s.id })))

// ... practice count / record / openTopic / openSubject / openExam
</script>

<template>
  <header>
    <NSelect v-model:value="examId" :options="examOptions" style="width: 200px" />
    <NSelect v-model:value="subjectId" :options="subjectOptions" placeholder="筛选科目" clearable filterable style="width: 240px" />
    <NButton v-if="isNormalMode" type="primary" @click="openExam">整卷演练</NButton>
  </header>

  <NCollapse>
    <NCollapseItem v-for="subject in visibleSubjects" :key="subject.id" :title="subject.name">
      <template #header-extra>... 练习数 / topic 数 ...</template>
      <NCard v-for="topic in subject.topics" :key="topic.id">
        <div>{{ topic.name }}</div>
        <NSpace>
          <NTag v-for="k in topic.keywords" :key="k" size="small" :bordered="false">{{ k }}</NTag>
        </NSpace>
        <NButton v-if="isNormalMode" size="tiny" @click="openTopic(subject, topic)">演练</NButton>
      </NCard>
    </NCollapseItem>
  </NCollapse>

  <PracticeModal v-model:show="modal.show" :exam-id="examId" :subject="modal.subject" :topic="modal.topic" :scope="modal.scope" @practice-recorded="..." />
</template>
```

### 4.2 新模态框：`src/components/PracticeModal.vue`

```vue
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NModal, NSpin, NAlert, NButton, NInput, NRadio, NRadioGroup, NCheckbox, NCheckboxGroup, NDivider, NTag, NSpace, useMessage } from 'naive-ui'
import { marked } from 'marked'
import type { ExamId, Subject, Topic } from '@/types/exam'
import { usePracticeFlow, type PracticeScope, type ObjectiveGenerateOut, type SubjectiveGenerateOut, type JudgeOut } from '@/composables/usePracticeFlow'
import { useWrongBook } from '@/composables/useWrongBook'
import { usePracticeTracker } from '@/composables/usePracticeTracker'

const props = defineProps<{
  show: boolean
  examId: ExamId
  subject: Subject
  topic: Topic
  scope: PracticeScope
}>()
const emit = defineEmits<{ (e: 'update:show', v: boolean): void; (e: 'practice-recorded'): void }>()

const isSubjective = computed(() => props.examId === 'exam3')
const flow = usePracticeFlow(toRef(props, 'examId'))
const { add: addWrong } = useWrongBook()
const { record: recordPractice } = usePracticeTracker()
const message = useMessage()

const generating = ref(false)
const submitState = ref<'idle' | 'submitted'>('idle')
const judging = ref(false)

const singleQ = ref<ObjectiveGenerateOut['single'] | null>(null)
const multiQ = ref<ObjectiveGenerateOut['multiple'] | null>(null)
const subjectiveQ = ref<SubjectiveGenerateOut | null>(null)
const singleAnswer = ref<string | null>(null)
const multiAnswer = ref<string[]>([])
const subjectiveAnswer = ref('')
const aiResult = ref<JudgeOut | null>(null)
const error = ref('')

// 初始化（show 变 true 时触发）
watch(() => props.show, async (v) => {
  if (!v) return
  reset()
  await doGenerate()
})

async function doGenerate() {
  generating.value = true
  error.value = ''
  try {
    const out = await flow.generate(props.subject, props.topic, props.scope)
    if ('caseText' in out) {
      subjectiveQ.value = out
    } else {
      singleQ.value = out.single
      multiQ.value = out.multiple
    }
    if (props.scope !== 'topic') {
      recordPractice(props.subject.id, out.topicId, isSubjective.value ? 'subjective' : 'objective')
      emit('practice-recorded')
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    generating.value = false
  }
}

async function doJudge() {
  judging.value = true
  error.value = ''
  try {
    const payload = isSubjective.value
      ? { caseText: subjectiveQ.value!.caseText, question: subjectiveQ.value!.question, answer: subjectiveAnswer.value || '（未作答）' }
      : { singleQuestion: singleQ.value, singleAnswer: singleAnswer.value, singleCorrect: singleQ.value!.correctAnswer, multiQuestion: multiQ.value, multiAnswer: multiAnswer.value, multiCorrect: multiQ.value!.correctAnswer }
    const r = await flow.judge(props.subject, props.topic, props.scope, payload)
    aiResult.value = r
    if (isSubjective.value) {
      addWrong({ examId: props.examId, type: 'subjective', subjectId: props.subject.id, topicId: subjectiveQ.value!.topicId, subjectName: props.subject.name, topicName: subjectiveQ.value!.topicName, caseText: subjectiveQ.value!.caseText, questionText: subjectiveQ.value!.question, answer: subjectiveAnswer.value, aiJudgeResult: r.report, score: r.score, referenceAnswer: r.referenceAnswer, isWrong: true, createdAt: Date.now(), id: '' })
    } else {
      addWrong({ examId: props.examId, type: 'objective', subjectId: props.subject.id, topicId: singleQ.value ? (singleQ.value as any).topicId : multiQ.value!.topicId, subjectName: props.subject.name, topicName: singleQ.value?.topicName || multiQ.value!.topicName, singleQuestion: singleQ.value, multiQuestion: multiQ.value, singleAnswer: singleAnswer.value, multiAnswer: multiAnswer.value, singleCorrect: singleAnswer.value === singleQ.value?.correctAnswer, multiCorrect: ..., aiJudgeResult: r.report, isWrong: ..., createdAt: Date.now(), id: '' })
    }
  } catch (e: any) {
    error.value = e.message
  } finally {
    judging.value = false
  }
}

function reset() { /* ... */ }
</script>

<template>
  <NModal :show="show" preset="card" style="width: 840px; max-width: 90vw" @update:show="emit('update:show', $event)">
    <NSpin v-if="generating" />
    <NAlert v-else-if="error" type="error">{{ error }}</NAlert>

    <!-- 客观题分支 -->
    <template v-else-if="!isSubjective && singleQ">
      ... 客观题 UI（用 singleQ / multiQ）...
    </template>

    <!-- 主观题分支 -->
    <template v-else-if="isSubjective && subjectiveQ">
      ... 主观题 UI（用 subjectiveQ）...
    </template>
  </NModal>
</template>
```

> **两段 v-if 各自渲染**。共享的状态机（generating / judging / aiResult / error）在 `<script>` 里，模板里只换 UI。

### 4.3 路由与菜单

**新路由**（`src/router/index.ts`）：

```ts
{ path: 'practice', name: 'Practice', component: () => import('@/views/PracticeView.vue'), meta: { title: '法考演练' } }
```

`/objective/paper1`、`/objective/paper2`、`/subjective` 全部删除。

**侧边栏**（`MainLayout.vue`）：把"客观题·卷一 / 客观题·卷二 / 主观题"三条合并为一条"演练"。

---

## 5. 配套调整

### 5.1 `useWrongBook` 与 `WrongBookItem`

```ts
export interface WrongBookItem {
  id: string                              // 删除旧记录时 id 必填；新记录由 add() 内部生成
  examId: ExamId                          // 新增：用于错误本按 ExamId 过滤
  type: 'objective' | 'subjective'
  subjectId: string
  topicId: string
  subjectName: string                     // 冗余存储，避免反查
  topicName: string
  createdAt: number
  // 客观题字段
  singleQuestion?: ObjectiveSingleQ
  multiQuestion?: ObjectiveMultiQ
  singleAnswer?: string | null
  multiAnswer?: string[]
  singleCorrect?: boolean
  multiCorrect?: boolean
  // 主观题字段
  caseText?: string
  questionText?: string
  answer?: string
  // 通用
  aiJudgeResult: string
  score?: [number, number]
  referenceAnswer?: string
  isWrong: boolean
}
```

`add()` 内部 `id = crypto.randomUUID()`，旧 `localStorage` 数据**不迁移**（用户接受"完全重构"，旧数据由用户自行清空）。设置页中"清空错题集"按钮保留。

### 5.2 `usePracticeCount`

```ts
export function usePracticeCount() {
  const { getCount: getTopicCount } = usePracticeTracker()

  const tree = computed(() => ({
    id: 'root',
    name: '全部',
    count: sum,
    children: exams.map(e => ({
      id: e.id, name: e.name, count: 0, children: e.subjects.map(s => ({ ... }))
    }))
  }))

  function getSubjectCount(subjectId: string, kind: 'objective' | 'subjective') { /* ... */ }
  function getExamCount(examId: ExamId): number { /* ... */ }
  return { tree, getSubjectCount, getExamCount }
}
```

### 5.3 `usePromptStore`

完全重写（见 3.2）。旧 `paper1Subjects/paper2Subjects/subjectiveSubjects` 导入全部删除。

### 5.4 `useRuntimeMode` / `useSettings` / `useTheme` / `useWrongBook` / `usePracticeTracker` 维持现状

仅修内部对 `subjects.ts` 的导入为 `data/exams.ts`。

---

## 6. 删除清单（一行不留）

| 删除文件 | 原因 |
|---|---|
| `src/data/subjects.ts` | 被 `data/exams.ts` 替代 |
| `src/composables/useStreamChatWithModel.ts` | 被 `useLLM` 替代 |
| `src/composables/useAiCall.ts` | 改为底层 `useAiCallRaw.ts`，公开 API 删除 |
| `src/views/ObjectiveView.vue` | 合并到 `PracticeView` |
| `src/views/SubjectiveView.vue` | 合并到 `PracticeView` |
| `src/components/ObjectiveModal.vue` | 合并到 `PracticeModal` |
| `src/components/SubjectiveModal.vue` | 合并到 `PracticeModal` |

> **`pages/HomePage.vue` 空壳**顺手删除。

---

## 7. 文件总览（变更后）

```
src/
├── App.vue                                  # + AiSseProvider 包裹
├── main.ts
├── router/index.ts                          # 仅保留 /practice + 其他
├── layouts/MainLayout.vue                   # 合并菜单项
├── types/
│   ├── exam.ts                              # 新增：Exam/Subject/Topic/ExamId
│   └── index.ts                             # 移除 ExamOutline/Subject 等旧类型
├── data/
│   ├── exams.ts                             # 新增：单一真相源
│   └── knowledge/...                        # 不变
├── composables/
│   ├── llm/
│   │   ├── createSseContext.ts              # 新增
│   │   ├── provider.ts                      # 新增：provideAiSse / useLLM
│   │   └── json.ts                          # 新增：extractJson / validateShape
│   ├── useAiCallRaw.ts                      # 改名（原 useAiCall.ts）
│   ├── usePracticeFlow.ts                   # 新增：generate / judge
│   ├── usePromptStore.ts                    # 重写
│   ├── usePracticeCount.ts                  # 重写
│   ├── usePracticeTracker.ts                # 不变
│   ├── useWrongBook.ts                      # + examId 字段
│   ├── useSettings.ts                       # 不变
│   ├── useRuntimeMode.ts                    # 不变
│   ├── useTheme.ts                          # 不变
│   └── useClipboard.ts                      # 不变
├── components/
│   ├── AiSseProvider.vue                    # 新增
│   ├── SseStreamModal.vue                   # 不变（仅由 Provider 挂载）
│   ├── PracticeModal.vue                    # 新增
│   ├── TopicCard.vue                        # 新增（可选，列表项卡片）
│   └── Empty.vue                            # 不变
└── views/
    ├── PracticeView.vue                     # 新增
    ├── OverviewView.vue                     # 不变
    ├── OutlineNotesView.vue                 # 不变
    ├── WrongBookView.vue                    # 微调（按 examId 分组可选）
    └── SettingsView.vue                     # 不变
```

---

## 8. 实施顺序

> **完全重构无兼容**：每一步都是"落地-验证-再走下一步"，旧文件在第 7 步统一删。

1. **新增 types & data**：`types/exam.ts` + `data/exams.ts` + 工具函数。
2. **新增 AI 抽象**：`composables/llm/*` + `AiSseProvider.vue` + `App.vue` 包裹。
3. **新增 usePracticeFlow**：客观/主观统一入口；`usePromptStore` 重写。
4. **新增 `PracticeView` + `PracticeModal` + `TopicCard`**。
5. **替换路由 + 菜单**：新增 `/practice` 路由；侧边栏替换为"演练"。
6. **跑通**：`vue-tsc -b`、`npm run lint`、dev 服务器冒烟。
7. **删除旧文件**：`subjects.ts` / `useStreamChatWithModel.ts` / `useAiCall.ts`（改名为 `useAiCallRaw.ts`）/ `ObjectiveView/SubjectiveView/ObjectiveModal/SubjectiveModal/HomePage`。

---

## 9. 优雅性的具体体现

- **类型即文档**：`EXAM_IDS as const` + `Record<ExamId, ...>` 让"加新 Exam 漏配 name/kind"在编译期就被抓住。
- **Provider 模式对齐 naive-ui**：`<AiSseProvider>` 与 `<NMessageProvider>` 同构，调用方零感知。
- **schema 即契约**：`useLLM.ask<T>({ schema })` 既描述 JSON 结构又描述 TS 类型（schema 形如 `{ topicId: 'string' }` 与 `T` 是同一回事，调用方写一处就够）。
- **流式可关闭**：传 `blur: true` 时 UI 不暴露原文（防泄题），`blur: false` 时正常滚动。
- **retry 透明**：`ask` 默认 3 次重试，调用方不需要写 while 循环（用户痛点直接消失）。
- **UI 收敛**：`PracticeView` + `PracticeModal` 各自一个文件，UI 差异收敛到 `v-if`，状态机/错误本/计数全部共用。
- **零兼容包袱**：旧 API、旧文件、旧字段全部直接删，避免"既要新又要旧"的设计债。

---

## 10. 风险与对策

| 风险 | 对策 |
|---|---|
| `useAiCallRaw` 改名导致路径找不到 | 第 7 步前先重命名并改完所有引用再删除旧文件 |
| AI 返回 JSON 偶尔被 markdown 包裹破坏 | `extractJson` 用 `/\{[\s\S]*\}/` 抓最大对象；如未来模型包裹变多，再升级为 streaming JSON 解析 |
| 客观题选项 `options` 形如对象数组时 `validateShape('string[]')` 误判 | schema 描述里 options 用 `'string[]'` 表示"返回数组里每项是对象、校验时只确保是数组"；PracticeFlow 里调用方拿到后自行 `map` 还原完整结构（已用 `as any` 转出，TS 层不做深度校验） |
| Provider 切换路由时 state 残留 | `SseContext` 创建在 `provideAiSse()` 调用时，仅在 `AiSseProvider` mount 期有效；切换路由不卸载 Provider（顶层），所以 state 自然延续 |
| `id: crypto.randomUUID()` 旧浏览器不支持 | 仅在现代浏览器使用；`WrongBookItem.id` 改为 `Date.now() + '-' + Math.random().toString(36).slice(2, 8)` 兜底 |
