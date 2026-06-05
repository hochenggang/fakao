# 提示词模块重构:函数化 + 模板字面量 + 整卷全量 JSON

> **核心改动**:
> 1. 整卷场景下,把 [exams.ts#L5-6](file:///c:/Users/Administrator/Documents/codes/易懂法考/src/data/exams.ts#L5-L6) 所在 **整个 `Exam` 对象** 进行 JSON 序列化作为知识上下文(目前是 slim 版)
> 2. 抛弃正则占位符替换,改用 JS 模板字面量 `${}` 拼接
> 3. 每个提示词从「字符串 + 后期正则替换」重构为「`(ctx) => string` 函数」,按 scope 分支原生内联,清晰/正确/高效
> 4. 优化所有 6 个业务提示词(系统提示词保留)

---

## 0. 现状与痛点

### 0.1 整卷 JSON 不是全量
[usePracticeFlow.ts#L85-94](file:///c:/Users/Administrator/Documents/codes/易懂法考/src/composables/usePracticeFlow.ts#L85-L94) `buildExamSubjectsJson` 只取 `id/name/keywords`,**丢掉了 `name` (科目名) 和 `name` (考点名) 之外的全部信息**。用户要求传入**完整的 exam 对象**,让 LLM 看到试卷全貌(便于选题、避免偏差)。

### 0.2 正则替换缺陷
[usePromptStore.ts#L246-280](file:///c:/Users/Administrator/Documents/codes/易懂法考/src/composables/usePromptStore.ts#L246-L280) `buildPrompt` 维护 5+ 个 `replace` 步骤:
- `subject` / `topic` 占位符替换
- `subject!` / `topic!` 强非空断言(在 exam scope 下不安全)
- `extras[?]` 散乱键名(`examSubjectsJson` / `keyword` / `memoText` ...)
- 顺序敏感、扩展性差、类型不安全
- exam scope 需要"先剥离占位符再补占位符"两轮

### 0.3 scope 分支臃肿
模板字符串中 `【科目领域】: {subject}` / `【核心考点】: {topic}` 在三种 scope 下意义完全不同,却用同一段文本 + 后期正则改写。

### 0.4 提示词未优化
6 个业务提示词沿用最初版,缺乏:
- 清晰的任务拆解(用编号 1./2./...)
- JSON 输出规则统一抽象
- 关键词背诵要求不够结构化

---

## 1. 设计:从「字符串 + 后期替换」改为「函数 + 模板字面量」

### 1.1 新 API
[usePromptStore.ts](file:///c:/Users/Administrator/Documents/codes/易懂法考/src/composables/usePromptStore.ts) 重构后导出:

```ts
// 1. 类型
export type PromptKey = 'system' | 'objective-generate' | 'subjective-generate'
                     | 'objective-judge' | 'subjective-judge'
                     | 'keyword-memo' | 'keyword-evaluate'

export interface PromptContext {
  subject: Subject | null
  topic: Topic | null
  scope: 'topic' | 'subject' | 'exam'
  knowledgeContext: string        // 知识点 markdown
  examJson: string                 // 整卷场景:整卷 Exam 全量 JSON
  // 关键词背诵
  keyword?: string
  memoText?: string
  userRecall?: string
  // 客观题评判
  singleQuestion?: string
  singleOptions?: string
  singleAnswer?: string | null
  singleCorrect?: string
  multiQuestion?: string
  multiOptions?: string
  multiAnswer?: string[]
  multiCorrect?: string[]
  // 主观题评判
  caseText?: string
  question?: string
  answer?: string
}

// 2. System 提示词(常量,无 ctx 依赖)
export const SYSTEM_PROMPT: string = `...`

// 3. 6 个业务提示词函数
const objectiveGenerate  = (ctx: PromptContext): string => `...${ctx.subject?.name}...`
const subjectiveGenerate  = (ctx: PromptContext): string => `...`
const objectiveJudge      = (ctx: PromptContext): string => `...`
const subjectiveJudge     = (ctx: PromptContext): string => `...`
const keywordMemo         = (ctx: PromptContext): string => `...`
const keywordEvaluate     = (ctx: PromptContext): string => `...`

// 4. 统一入口
export function buildPrompt(key: PromptKey, ctx: PromptContext): string

// 5. 整卷 JSON 工具(全量)
export function buildExamJson(examId: ExamId): string

// 6. 原有 findSubjectTopic 保留
export function findSubjectTopic(examId, subjectId, topicId): { subject, topic } | null
```

### 1.2 调用方 API 收敛
[useLLM.ts](file:///c:/Users/Administrator/Documents/codes/易懂法考/src/composables/llm/useLLM.ts) `CallStreamOptions` 去掉 `subject` / `topic` / `scope` / `extras`,统一改为 `promptContext: PromptContext`:

```ts
export interface CallStreamOptions {
  promptKey?: PromptKey
  prompt?: string                    // 跳过 buildPrompt,直接给 user prompt
  promptContext?: PromptContext      // 标准路径
  blur?: boolean
  thinking?: boolean
  systemPrompt?: string
}
```

[usePracticeFlow.ts](file:///c:/Users/Administrator/Documents/codes/易懂法考/src/composables/usePracticeFlow.ts) / [useKeywordFlow.ts](file:///c:/Users/Administrator/Documents/codes/易懂法考/src/composables/useKeywordFlow.ts) / `PracticeModal.vue` 全部改为构造 `PromptContext`。

### 1.3 优势对比

| 维度 | 旧(字符串 + 替换) | 新(函数 + 模板字面量) |
|---|---|---|
| 类型 | `extras: Record<string, string>` 弱类型 | `PromptContext` 强类型,IDE 提示完整字段 |
| scope 分支 | 后期正则字符串改写 | 函数内 `if (scope === ...)` 模板字面量原生分支 |
| 占位符 | `{subject}` / `{topic}` / `{knowledgeContext}` + `extras[?]` | 全部走 `${ctx.field}`,无歧义 |
| 整卷 JSON | slim 版(丢 name 字段) | **完整 Exam 对象**(`id`/`name`/`subjects`) |
| 测试 | 难(整段字符串) | 易(纯函数) |
| 调试 | 出错位置模糊 | 出错位置精准(`${ctx.subject?.name}` 不会与同名变量混淆) |

---

## 2. 改动清单(4 文件)

### 2.1 [src/composables/usePromptStore.ts](file:///c:/Users/Administrator/Documents/codes/易懂法考/src/composables/usePromptStore.ts) — 整体重写

**删除**:
- `DEFAULT_PROMPTS` 对象(全部字符串)
- `buildPrompt(key, subject, topic, scope, extras)` 老签名
- `findModule` / `buildSubjectKnowledgeContext` 内嵌辅助(并入新函数内,或保留)
- 所有 `{subject}` / `{topic}` / `{knowledgeContext}` 占位符

**新增**:
- `PromptContext` 类型
- `SYSTEM_PROMPT` 常量
- 6 个 prompt 函数(全部用模板字面量)
- 共享 helper:`scopeHeader(ctx)` / `jsonOutputRules()` / `knowledgeSection(ctx)`
- `buildExamJson(examId: ExamId): string` — **完整 Exam JSON**
- 新签名 `buildPrompt(key, ctx: PromptContext): string`
- `findSubjectTopic` 保留

**整卷 JSON 关键**:
```ts
export function buildExamJson(examId: ExamId): string {
  const exam = examById(examId)
  return exam ? JSON.stringify(exam, null, 2) : ''
}
```

**scope 分支内联(以 `objectiveGenerate` 为例)**:
```ts
function scopeHeader(ctx: PromptContext): string {
  const { subject, topic, scope, examJson } = ctx
  if (scope === 'topic' && subject && topic) {
    return `【出题范围】: 考点
- 科目: ${subject.name}
- 考点: ${topic.name}
- 考点关键词: ${topic.keywords.join('、')}`
  }
  if (scope === 'subject' && subject) {
    return `【出题范围】: 科目综合
- 科目: ${subject.name}
- 可从该科目任意考点选题`
  }
  if (scope === 'exam') {
    return `【出题范围】: 整卷综合
- 请从下方【试卷结构】中任选一个科目 + 该科目下任一考点作为出题目标
- 建议在不同科目间均匀分布

【试卷结构】:
\`\`\`json
${examJson}
\`\`\``
  }
  return '【出题范围】: （未指定）'
}
```

**优化后 objectiveGenerate 全文**:
```ts
const objectiveGenerate = (ctx: PromptContext): string => {
  const knowledge = ctx.knowledgeContext
    ? `【相关法考大纲知识】:
\`\`\`markdown
${ctx.knowledgeContext}
\`\`\`
`
    : ''
  return `你是一位法考命题研究专家。请根据以下出题范围,生成1道高质量的单选题和1道高质量的多选题。

${scopeHeader(ctx)}

${knowledge}
【出题要求】:
1. 紧密围绕上方【出题范围】选定的科目与考点,不得超出范围
2. 题干贴近法考真题风格,案情或情境设置具有实务感
3. 选项设计须包含典型法考陷阱(偷换概念/脑补情节/张冠李戴/混淆条件/以偏概全等)
4. 难度适中偏上,符合近年法考真题
5. 正确答案须有充分法律依据,解释清晰透彻

${jsonOutputRules()}

字段说明:
- subjectId:所选科目 ID(必须从【出题范围】/【试卷结构】中真实存在)
- subjectName:所选科目名称
- topicId:所选考点 ID(必须真实存在于所选 subject 的 topics 列表中)
- topicName:所选考点名称
- single:单选题
- multiple:多选题

JSON 结构示例(仅说明字段,不要照抄内容):
{
  "subjectId": "criminal-law",
  "subjectName": "刑法",
  "topicId": "cl-1",
  "topicName": "犯罪构成",
  "single": {
    "question": "题干...",
    "options": [{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],
    "correctAnswer": "A",
    "explanation": "解析..."
  },
  "multiple": {
    "question": "题干...",
    "options": [{"label":"A","text":"..."},{"label":"B","text":"..."},{"label":"C","text":"..."},{"label":"D","text":"..."}],
    "correctAnswer": ["A","B"],
    "explanation": "解析..."
  }
}`
}
```

> **不再需要** `replace(/【科目领域】: \{subject\}/g, ...)` 这种 hack。`scopeHeader` 直接根据 `ctx.scope` 渲染正确的部分。

**5 个其他 prompt 函数** 同步改造(模板字面量 + 内联分支),具体见 §3。

---

### 2.2 [src/composables/llm/useLLM.ts](file:///c:/Users/Administrator/Documents/codes/易懂法考/src/composables/llm/useLLM.ts) — `CallStreamOptions` 收敛

```diff
- import { DEFAULT_PROMPTS, buildPrompt, type PromptKey } from '../usePromptStore'
+ import { SYSTEM_PROMPT, buildPrompt, type PromptKey, type PromptContext } from '../usePromptStore'

  export interface CallStreamOptions {
    promptKey?: PromptKey
    prompt?: string
-   subject?: Subject | null
-   topic?: Topic | null
-   scope?: 'topic' | 'subject' | 'exam'
-   extras?: Record<string, string>
+   promptContext?: PromptContext
    blur?: boolean
    thinking?: boolean
    systemPrompt?: string
  }

  // callStream 内部
  const userPrompt = opts.prompt
-   ?? buildPrompt(opts.promptKey!, opts.subject ?? null, opts.topic ?? null, opts.scope ?? 'topic', opts.extras ?? {})
+   ?? buildPrompt(opts.promptKey!, opts.promptContext!)

  const messages: ChatMessage[] = [
    { role: 'system', content: opts.systemPrompt ?? SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ]
```

- 删除 `Subject` / `Topic` import(本文件不再需要)

---

### 2.3 [src/composables/usePracticeFlow.ts](file:///c:/Users/Administrator/Documents/codes/易懂法考/src/composables/usePracticeFlow.ts) — 构造 PromptContext

```ts
import { buildPrompt, buildExamJson, buildKnowledgeContext, type PromptContext } from './usePromptStore'
// 删除:import { examById } from '@/data/exams'  (buildExamJson 接管)

export function usePracticeFlow(examId: Ref<ExamId>) {
  const { callStream } = useLLM()

  async function generate(
    subject: Subject | null,
    topic: Topic | null,
    scope: PracticeScope,
  ): Promise<ObjectiveGenerateOut | SubjectiveGenerateOut> {
    const kind = examKindOf(examId.value)
    const promptKey = kind === 'subjective' ? 'subjective-generate' : 'objective-generate'
    const schema = kind === 'subjective' ? SUBJECTIVE_GENERATE_SCHEMA : OBJECTIVE_GENERATE_SCHEMA

    const promptContext: PromptContext = {
      subject, topic, scope,
      knowledgeContext: buildKnowledgeContext(subject, topic, scope),
      examJson: scope === 'exam' ? buildExamJson(examId.value) : '',
    }

    return callStreamWithParse<...>(callStream, {
      promptKey,
      promptContext,
      blur: true,
      schema,
      retries: 3,
    })
  }

  async function judge(args: PromptContext): Promise<JudgeOut> {
    const kind = examKindOf(examId.value)
    const promptKey = kind === 'subjective' ? 'subjective-judge' : 'objective-judge'
    return callStreamWithParse<JudgeOut>(callStream, {
      promptKey,
      promptContext: args,
      thinking: true,
      schema: JUDGE_SCHEMA,
      retries: 3,
      fallbackReport: true,
    })
  }

  return { generate, judge }
}
```

> `judge` 签名由 `(subject, topic, scope, extras) => JudgeOut` 改为 `(args: PromptContext) => JudgeOut`,更符合「直接传上下文」语义。`PracticeModal.handleJudge` 同步改造。

---

### 2.4 [src/composables/useKeywordFlow.ts](file:///c:/Users/Administrator/Documents/codes/易懂法考/src/composables/useKeywordFlow.ts) — 构造 PromptContext

```ts
import { useLLM } from './llm'
import { buildKnowledgeContext, type PromptContext } from './usePromptStore'
import type { Subject, Topic } from '@/types/exam'

export function useKeywordFlow() {
  const { callStream } = useLLM()

  async function generateMemo(subject: Subject, topic: Topic, keyword: string): Promise<string> {
    const ctx: PromptContext = {
      subject, topic,
      scope: 'topic',
      knowledgeContext: buildKnowledgeContext(subject, topic, 'topic'),
      examJson: '',
      keyword,
    }
    return callStream({ promptKey: 'keyword-memo', promptContext: ctx })
  }

  async function evaluateMemo(
    subject: Subject, topic: Topic, keyword: string,
    memoText: string, userRecall: string,
  ): Promise<string> {
    const ctx: PromptContext = {
      subject, topic,
      scope: 'topic',
      knowledgeContext: buildKnowledgeContext(subject, topic, 'topic'),
      examJson: '',
      keyword, memoText, userRecall,
    }
    return callStream({ promptKey: 'keyword-evaluate', promptContext: ctx })
  }

  return { generateMemo, evaluateMemo }
}
```

---

### 2.5 [src/components/PracticeModal.vue](file:///c:/Users/Administrator/Documents/codes/易懂法考/src/components/PracticeModal.vue) — judge 调用同步

```diff
+ import { buildKnowledgeContext, type PromptContext } from '@/composables/usePromptStore'

  // handleJudge 内
- const r = await flow.judge(targetSubject, targetTopic, props.scope, extras)
+ const judgeCtx: PromptContext = {
+   subject: targetSubject,
+   topic: targetTopic,
+   scope: props.scope,
+   knowledgeContext: buildKnowledgeContext(targetSubject, targetTopic, props.scope),
+   examJson: '',
+   ...extras,  // singleQuestion / multiQuestion / caseText 等
+ }
+ const r = await flow.judge(judgeCtx)
```

`extras` 局部对象字段名从 `singleQuestion` 等与 `PromptContext` 对齐(去掉旧的 snake_case 习惯)。

---

## 3. 6 个 prompt 函数核心结构

| 提示词 | 关键点 |
|---|---|
| `objectiveGenerate` | `scopeHeader` + 知识 context + 出题要求 + JSON 输出规则 + JSON 结构 |
| `subjectiveGenerate` | `scopeHeader` + 知识 context + 出题要求 + JSON 输出规则 + JSON 结构 |
| `objectiveJudge` | 强制要求 subject/topic + 知识 context + 单选/多选作答 + 5 项分析任务 + JSON 规则 |
| `subjectiveJudge` | 强制要求 subject/topic + 知识 context + 案情/问题/答卷 + 5 项阅卷任务 + JSON 规则 |
| `keywordMemo` | subject/topic/keyword + 知识 context + 4 项硬要求(纯文本) |
| `keywordEvaluate` | subject/topic/keyword + memoText + userRecall + 4 项评析要求(纯文本) |

**共享 helper**:
```ts
function knowledgeSection(ctx: PromptContext): string {
  return ctx.knowledgeContext
    ? `【相关法考大纲知识】:
\`\`\`markdown
${ctx.knowledgeContext}
\`\`\`
`
    : ''
}

function jsonOutputRules(): string {
  return `【JSON 输出要求 — 必须严格遵守,否则视为失败】:
- 整个回复只能是一个合法 JSON 对象,首字符为 \`{\`,末字符为 \`}\`
- JSON 前后不得出现任何文字、说明、代码块标记、注释、空行、问候语
- JSON 内不得使用未转义的双引号;若内容需引号请改用「」或『』
- 字符串内的换行用 \\\\n 表示`
}
```

**judge 类必须 subject/topic,模板字面量内**:
```ts
const objectiveJudge = (ctx: PromptContext): string => {
  if (!ctx.subject || !ctx.topic) {
    throw new Error('objective-judge prompt requires subject and topic')
  }
  // ...使用 ctx.subject.name / ctx.topic.name
}
```

---

## 4. 关键决策与假设

1. **整卷 JSON 用全量 `JSON.stringify(exam, null, 2)`**:`exams.ts` 数据已结构化,字段少(`id`/`name`/`subjects`),无敏感信息,全量无副作用。同时,LLM 看到的"试卷全貌"更接近真实法考命题人视角。
2. **`PromptContext` 是强类型 dict**:即便某些字段对当前 prompt 无用,也保留(用 `?` 标可选),保证结构统一,避免「8 个不同 dict」的混乱。
3. **`judge(args: PromptContext)` 而非 `judge(subject, topic, scope, extras)`**:`judge` 已不再关心 4 个独立参数,直接传 ctx 最简洁。
4. **`buildExamJson` 放 usePromptStore**:与 `buildKnowledgeContext` 同一抽象层,统一「数据 → 提示词文本」职责;`usePracticeFlow` 瘦身,不再 import `@/data/exams`。
5. **`SYSTEM_PROMPT` 用常量而非函数**:无 ctx 依赖,`string` 最简洁。`buildPrompt('system', ctx)` 也直接返回 `SYSTEM_PROMPT`。
6. **scope 改写不写在 prompt 函数内**:用 `scopeHeader(ctx)` 抽出独立 helper,2 个 generate 函数共用,避免重复。
7. **`extras` 局部 dict 在 `PracticeModal` 仍临时使用**:`handleJudge` 构造 `PromptContext` 时用 `...extras` 展开,保持调用代码紧凑。
8. **不优化 system 提示词**:用户只说优化 6 个业务提示词;system 提示词已经清晰,保持不变。

---

## 5. 验证步骤

### 5.1 编译
1. `npm run check` 0 错误
2. `npm run build` 成功

### 5.2 行为验证(开发者自查)

| 场景 | 预期 |
|---|---|
| 单考点练习(客观题) | 提示词含「出题范围: 考点 / 科目: XX / 考点: XX」+ 知识 markdown + JSON 规则 |
| 单考点练习(主观题) | 同上 + 主观题 JSON 结构 |
| 专题练习(单科目综合) | 提示词含「出题范围: 科目综合 / 科目: XX」+ 知识 markdown |
| **整卷演练(客观题/主观题)** | 提示词含「出题范围: 整卷综合」+ **完整 Exam JSON**(`{ "id": "exam1", "name": "客观题(卷一)", "subjects": [...] }`)+ JSON 规则 + LLM 真正从全卷任选 |
| 关键词背诵 | 纯文本,4 项硬要求 |
| 关键词评析 | 纯文本,4 项评析要求 |
| 客观题评判 | 5 项分析任务,无 score |
| 主观题评判 | 5 项阅卷任务,`score: [N, 30]`,`referenceAnswer` markdown |

### 5.3 持久化回归 / 第三方库契约
- `streamChat` 调用方式不变
- 出题 `blur: true`;评判/关键词无 blur
- 降级模式 throw

### 5.4 代码质量
- 提示词模块无 `replace(/.../g, ...)` 残留
- 提示词模块无 `extras: Record<string, string>` 残留
- `useLLM.callStream` / `usePracticeFlow` / `useKeywordFlow` 不再 import `@/data/exams`
- `PromptContext` 强类型,IDE 提示完整字段

---

## 6. 改动文件清单

### 修改 (4)
- `src/composables/usePromptStore.ts` — 整体重写:PromptContext、6 个 prompt 函数、buildExamJson、findSubjectTopic、SYSTEM_PROMPT
- `src/composables/llm/useLLM.ts` — CallStreamOptions 收敛到 promptContext
- `src/composables/usePracticeFlow.ts` — 构造 PromptContext;judge 签名改为 `(args) => JudgeOut`
- `src/composables/useKeywordFlow.ts` — 构造 PromptContext
- `src/components/PracticeModal.vue` — handleJudge 用 PromptContext 调 judge

### 不动
- `src/data/**`(原始数据,虽然 buildExamJson 直接序列化)
- `src/composables/llm/callWithParse.ts` / `json.ts` / `index.ts`
- `src/composables/useSettings.ts` / `useWrongBook.ts` / `usePracticeCount.ts` / `usePracticeTracker.ts` / `useRuntimeMode.ts` / `useLocalStorage.ts`
- `src/views/**`(只读 PromptContext 副作用,API 收敛)
- `src/lib/**` / `src/types/**`
- `src/router/index.ts` / `src/main.ts` / `src/App.vue`

---

## 7. 预期收益

### 7.1 正确性
- **整卷全量 JSON**:`exams.ts` 完整传给 LLM,LLM 看到全卷结构,选题更准
- **类型安全**:`PromptContext` 强类型,`buildPrompt` 不再接受任意 dict
- **不再有空指针风险**:`buildPrompt('objective-judge', { subject: null, ... })` 会直接 throw

### 7.2 可维护性
- **提示词函数化**:每个 prompt 是 30-60 行纯函数,无需追踪 `replace` 顺序
- **scope 分支内联**:`scopeHeader(ctx)` 单一职责,改一处全部生效
- **JSON 规则共享**:`jsonOutputRules()` 单点维护,3 个 JSON 提示词保持一致

### 7.3 可读性
- 模板字面量可直接 `Cmd+B` 跳转到字段,IDE 友好
- 不再需要「{subject} 是啥 / {topic} 是啥 / 啥时填」的口口相传

### 7.4 性能
- 无正则 `String.replace` 多次遍历
- 模板字面量在 V8 中是高度优化的字符串拼接

### 7.5 扩展性
- 新增 prompt:写一个 `(ctx) => string` 函数 + 在 `PROMPT_FNS` 注册即可
- 新增 scope 字段:改 `PromptContext` + helper,无需改其他文件

---

## 8. 执行顺序

1. `usePromptStore.ts` — 整体重写(类型 + 6 函数 + helper + buildExamJson + findSubjectTopic)
2. `llm/useLLM.ts` — CallStreamOptions 收敛到 promptContext
3. `usePracticeFlow.ts` — 构造 PromptContext;judge 签名改造
4. `useKeywordFlow.ts` — 构造 PromptContext
5. `PracticeModal.vue` — handleJudge 用 PromptContext
6. `npm run check` + `npm run build` 验证
