# 提示词模块重构计划：函数化 + 模板字面量 + 整卷全量 JSON

> **目标**：
> 1. 整卷演练时，把 `exams.ts` 中 `exam_id` 对应的完整 `Exam` 对象 `JSON.stringify` 后作为知识上下文（不再使用精简的 `examSubjectsJson`）。
> 2. 取消 `{subject}` / `{topic}` 之类的正则占位符替换，改为 `${}` 模板字面量直接拼接。
> 3. 把 6 个业务提示词改成「函数 + 模板字面量」形态，按 `scope` 分支原生内联，不再依赖 `buildPrompt` 的 post-processing 字符串改写。
> 4. 收敛 `useLLM.callStream` 的扁平入参为单一 `PromptContext`，让所有调用方统一收口。
> 5. 优化所有提示词文本：去除冗余、统一风格、明确 JSON 输出要求。

---

## 0. 范围与硬约束

- 不修改 `src/data/**`（考试/知识原始数据）
- 不修改对 `vue-llm-stream-chat` 的调用契约
- 不修改 `src/composables/llm/callWithParse.ts` / `llm/json.ts` / `llm/index.ts`
- 不修改 `src/lib/**` / `src/styles/**` / `src/types/exam.ts`
- 沿用统一 LLM 入口、出题 `blur=true`、其他场景 `blur=false` 的约定
- 沿用「2+ 处使用即封装」原则
- 沿用「1 个文件能解决的就不拆多个文件」

---

## 1. 现状速览（与痛点）

### 1.1 `src/composables/usePromptStore.ts` 的现状

- `DEFAULT_PROMPTS` 是 6 条 `Record<PromptKey, string>`，内含 `{subject}` / `{topic}` / `{knowledgeContext}` / `{examSubjectsJson}` 等占位符。
- `buildPrompt` 走 4 步：① 基础模板 → ② `scope='subject'` 时正则改头部 → ③ `scope='exam'` 时连续 5 条 `replace(/.../g, ...)` 改头部 + 正文 + 兜底剥离孤立占位符 → ④ 通用 `{key}` 替换。
- 痛点：
  1. **正则改写脆弱**：`{subject}` 出现在示例 JSON 中、正文中、注释中时一锅端，容易出意外。
  2. **scope 行为分散**：scope 改写逻辑与模板本身分离，看 prompt 文本时无法直接判断在 `exam` 场景下会变成什么。
  3. **占位符耦合知识**：`{knowledgeContext}` 与 `{examSubjectsJson}` 是两个独立分支，调用方需要按 scope 决定塞哪个；二者合一后会更直观。
  4. **extras 形如 `Record<string, string>`**：类型弱，调用方拼装易错。

### 1.2 调用方现状

- `usePracticeFlow.ts` 持有 `buildExamSubjectsJson(examId)` 函数（精简版），并以 `extras.examSubjectsJson` 注入 prompt。
- `useLLM.CallStreamOptions` 同时持有 `subject? / topic? / scope? / extras?` 4 个扁平字段。
- `useKeywordFlow.ts` 同样按 `extras` 传 `keyword / memoText / userRecall`。
- `PracticeModal.vue` 手工拼装 `extras` 给 `flow.judge`。

### 1.3 待解决问题

1. **整卷应传全量 Exam JSON**（按用户最新要求），而非精简的 subjects/topics 列表。
2. **取消正则**，全部走 `${}` 模板字面量。
3. **统一提示词**为函数 + PromptContext，按 scope 分支原生内联。
4. **收敛 LLM 入参**为单一 `promptContext`。
5. **优化所有 6 个业务提示词**文本。

---

## 2. 目标架构

### 2.1 `src/composables/usePromptStore.ts` —— 提示词模块（重写）

#### 2.1.1 导出类型

```ts
export type PromptScope = 'topic' | 'subject' | 'exam'

export type PromptKey =
  | 'objective-generate'
  | 'subjective-generate'
  | 'objective-judge'
  | 'subjective-judge'
  | 'keyword-memo'
  | 'keyword-evaluate'

export interface PromptContext {
  scope: PromptScope
  subject: Subject | null
  topic: Topic | null
  /** scope='topic': 含大纲 markdown; scope='subject': 考点列表; scope='exam': 空字符串 */
  knowledgeContext: string
  /** scope='exam': 完整 Exam 的 JSON.stringify; 其他场景: 空字符串 */
  examJson: string
  // 关键词背诵
  keyword?: string
  memoText?: string
  userRecall?: string
  // 客观题评卷
  singleQuestion?: string
  singleOptions?: string
  singleAnswer?: string | null
  singleCorrect?: string
  multiQuestion?: string
  multiOptions?: string
  multiAnswer?: string[] | string
  multiCorrect?: string[] | string
  // 主观题评卷
  caseText?: string
  question?: string
  answer?: string
}
```

#### 2.1.2 导出 `SYSTEM_PROMPT` 常量

- 维持现有 system 文本不变（已足够清晰）。

#### 2.1.3 知识上下文工具函数（拆出 buildKnowledgeContext / buildExamJson）

```ts
export function buildKnowledgeContext(
  subject: Subject | null,
  topic: Topic | null,
  scope: PromptScope,
): string { /* 维持现状 */ }

export function buildExamJson(examId: ExamId): string {
  const exam = examById(examId)
  return exam ? JSON.stringify(exam, null, 2) : ''
}
```

> 把 `usePracticeFlow.buildExamSubjectsJson` 删掉，统一由 `buildExamJson` 提供（它返回完整 Exam JSON，不做 slim）。

#### 2.1.4 6 个业务提示词改为「函数 + 模板字面量」

形态：

```ts
type PromptFn = (ctx: PromptContext) => string

const PROMPT_FNS: Record<PromptKey, PromptFn> = {
  'objective-generate': (ctx) => { /* 三段：exam / subject / topic 各自模板 */ },
  'subjective-generate': (ctx) => { /* 三段 */ },
  'objective-judge': (ctx) => `...`,
  'subjective-judge': (ctx) => `...`,
  'keyword-memo': (ctx) => `...`,
  'keyword-evaluate': (ctx) => `...`,
}

export function buildPrompt(key: PromptKey, ctx: PromptContext): string {
  const fn = PROMPT_FNS[key]
  if (!fn) throw new Error(`Unknown prompt key: ${key}`)
  return fn(ctx)
}
```

#### 2.1.5 提示词优化要点（6 个文件级要求）

1. **首段统一身份**：每个提示词开头一句话点明角色 + 任务，不重复 `SYSTEM_PROMPT` 的内容。
2. **scope='exam' 必须出现的字段**：`examJson`（整卷 JSON）。
3. **scope='subject'**：使用 `subject` 名称 + `knowledgeContext`（科目级考点列表）。
4. **scope='topic'**：使用 `subject` + `topic` + `knowledgeContext`（含 markdown 大纲）。
5. **生成类（generate）JSON 必含**：`subjectId / subjectName / topicId / topicName`。
6. **评卷类（judge）JSON 必含**：`report`；主观题加 `score:[n,30]` + `referenceAnswer`。
7. **关键词类（keyword-）**：纯文本输出，不要 JSON / 代码块。
8. **首尾硬约束**：JSON 输出类统一在末尾加「输出只能是一段合法 JSON，第一字符 `{`，最后一字符 `}`，不要任何额外文字/代码块标记/注释/Markdown 标题/空行/问候语」。
9. **去除冗余**：删除重复的口吻铺垫、不必要的 Markdown 加粗。
10. **统一陷阱词汇**：偷换概念 / 脑补情节 / 张冠李戴 / 混淆条件 / 以偏概全 / 时间错位。

#### 2.1.6 6 个提示词的关键分支结构

| Prompt | topic scope | subject scope | exam scope |
|---|---|---|---|
| `objective-generate` | subject.name + topic.name + knowledgeContext(md) → 1 单选 + 1 多选 | subject.name + knowledgeContext(科目级) → 1 单选 + 1 多选 | examJson → 1 单选 + 1 多选 |
| `subjective-generate` | subject + topic + knowledgeContext(md) → 1 案例 | subject + knowledgeContext(科目级) → 1 案例 | examJson → 1 案例 |
| `objective-judge` | subject + topic + knowledgeContext(md) + 客观题作答 | subject + knowledgeContext(科目级) + 客观题作答 | examJson + 客观题作答 |
| `subjective-judge` | subject + topic + knowledgeContext(md) + 案例/问题/答案 | subject + knowledgeContext(科目级) + 案例/问题/答案 | examJson + 案例/问题/答案 |
| `keyword-memo` | subject + topic + knowledgeContext(md) + keyword | (不区分 scope，统一 topic) | (不区分 scope) |
| `keyword-evaluate` | subject + topic + knowledgeContext(md) + keyword + memoText + userRecall | (不区分 scope) | (不区分 scope) |

> 关键词背诵两条不需要按 scope 分支（永远按 topic 处理），保持现状逻辑。
> 评卷 / 出题 4 个需要按 scope 分支；每个 prompt 函数内部用 `if (ctx.scope === 'exam') return ...; if (ctx.scope === 'subject') return ...; return ...` 三段式。

#### 2.1.7 保留导出

- `findSubjectTopic(examId, subjectId, topicId)` —— `PracticeModal` 仍需使用，保留。
- `SYSTEM_PROMPT` —— 保留供 `useLLM.callStream` 引用。
- `buildPrompt` —— 唯一对外入口。
- `buildKnowledgeContext` / `buildExamJson` —— 供 `usePracticeFlow` 构造 `PromptContext` 时调用。
- `PromptKey` / `PromptContext` / `PromptScope` —— 类型导出。

#### 2.1.8 删除

- 旧 `DEFAULT_PROMPTS` 字符串表（被 `PROMPT_FNS` 取代）。
- 旧 `buildPrompt` 的正则改写逻辑（被函数分支取代）。
- `usePracticeFlow.buildExamSubjectsJson`（被 `buildExamJson` 取代）。

---

## 3. `src/composables/llm/useLLM.ts` —— 收敛入参

### 3.1 `CallStreamOptions` 改为

```ts
export interface CallStreamOptions {
  promptKey?: PromptKey
  prompt?: string
  /** 与 promptKey 配合使用(优先 prompt);包含所有提示词所需变量 */
  promptContext?: PromptContext
  blur?: boolean
  thinking?: boolean
  systemPrompt?: string
}
```

### 3.2 `callStream` 内部

```ts
const userPrompt = opts.prompt
  ?? buildPrompt(opts.promptKey!, opts.promptContext!)
```

- 删除 `subject? / topic? / scope? / extras?` 4 个扁平字段。
- 保持 `streamChat` / blur / thinking / systemPrompt 行为完全不变。

### 3.3 `callWithParse.ts`

- 维持 `CallStreamOptions & ParseRetryOptions` 形态，依赖 `CallStreamOptions` 自动同步。
- 不修改实现。

---

## 4. `src/composables/usePracticeFlow.ts` —— 用 PromptContext 驱动

### 4.1 删除

- `buildExamSubjectsJson` 函数（移到 `usePromptStore.buildExamJson`）。
- `extras: Record<string, string>` 字段。

### 4.2 `generate` 改为

```ts
async function generate(
  subject: Subject | null,
  topic: Topic | null,
  scope: PracticeScope,
): Promise<ObjectiveGenerateOut | SubjectiveGenerateOut> {
  const kind = examKindOf(examId.value)
  const promptKey = kind === 'subjective' ? 'subjective-generate' : 'objective-generate'
  const schema = kind === 'subjective' ? SUBJECTIVE_GENERATE_SCHEMA : OBJECTIVE_GENERATE_SCHEMA

  const promptContext: PromptContext = {
    scope,
    subject,
    topic,
    knowledgeContext: buildKnowledgeContext(subject, topic, scope),
    examJson: scope === 'exam' ? buildExamJson(examId.value) : '',
  }

  return callStreamWithParse<ObjectiveGenerateOut | SubjectiveGenerateOut>(callStream, {
    promptKey,
    promptContext,
    blur: true,
    schema,
    retries: 3,
  })
}
```

### 4.3 `judge` 改为

```ts
async function judge(ctx: PromptContext): Promise<JudgeOut> {
  const kind = examKindOf(examId.value)
  const promptKey = kind === 'subjective' ? 'subjective-judge' : 'objective-judge'

  return callStreamWithParse<JudgeOut>(callStream, {
    promptKey,
    promptContext: ctx,
    thinking: true,
    schema: JUDGE_SCHEMA,
    retries: 3,
    fallbackReport: true,
  })
}
```

> `judge` 形参由 `(subject, topic, scope, extras)` 改为 `PromptContext` —— 与 `generate` 对齐，调用方构造一次 context 即可。

---

## 5. `src/composables/useKeywordFlow.ts` —— 用 PromptContext 驱动

### 5.1 `generateMemo`

```ts
async function generateMemo(subject: Subject, topic: Topic, keyword: string): Promise<string> {
  const promptContext: PromptContext = {
    scope: 'topic',
    subject, topic, keyword,
    knowledgeContext: buildKnowledgeContext(subject, topic, 'topic'),
    examJson: '',
  }
  return callStream({ promptKey: 'keyword-memo', promptContext })
}
```

### 5.2 `evaluateMemo`

```ts
async function evaluateMemo(
  subject: Subject, topic: Topic, keyword: string,
  memoText: string, userRecall: string,
): Promise<string> {
  const promptContext: PromptContext = {
    scope: 'topic',
    subject, topic, keyword, memoText, userRecall,
    knowledgeContext: buildKnowledgeContext(subject, topic, 'topic'),
    examJson: '',
  }
  return callStream({ promptKey: 'keyword-evaluate', promptContext })
}
```

---

## 6. `src/components/PracticeModal.vue` —— 适配新签名

### 6.1 `handleJudge` 改为

```ts
async function handleJudge() {
  judging.value = true
  error.value = ''
  const target = findSubjectTopic(
    props.examId, actualSubjectId.value, actualTopicId.value,
  ) ?? { subject: props.subject, topic: props.topic }
  const { subject: targetSubject, topic: targetTopic } = target

  const ctxBase: PromptContext = {
    scope: props.scope,
    subject: targetSubject,
    topic: targetTopic,
    knowledgeContext: buildKnowledgeContext(targetSubject, targetTopic, props.scope),
    examJson: props.scope === 'exam' ? buildExamJson(props.examId) : '',
  }

  let judgeCtx: PromptContext
  if (isSubjective.value && subjectiveQ.value) {
    judgeCtx = {
      ...ctxBase,
      caseText: subjectiveQ.value.caseText,
      question: subjectiveQ.value.question,
      answer: subjectiveAnswer.value || '（学生未作答）',
    }
  } else {
    const singleOpts = singleQ.value
      ? singleQ.value.options.map(o => `${o.label}. ${o.text}`).join('\n') : '（无）'
    const multiOpts = multiQ.value
      ? multiQ.value.options.map(o => `${o.label}. ${o.text}`).join('\n') : '（无）'
    judgeCtx = {
      ...ctxBase,
      singleQuestion: singleQ.value?.question || '（无）',
      singleOptions: singleOpts,
      singleAnswer: singleAnswer.value ?? '未作答',
      singleCorrect: singleQ.value?.correctAnswer || '',
      multiQuestion: multiQ.value?.question || '（无）',
      multiOptions: multiOpts,
      multiAnswer: multiAnswer.value.length ? multiAnswer.value.join('、') : '未作答',
      multiCorrect: multiQ.value ? multiQ.value.correctAnswer.join('、') : '',
    }
  }

  const r = await flow.judge(judgeCtx)
  // ... 后续 addWrong / message.success 维持现状
}
```

### 6.2 导入

新增 `import { buildExamJson, buildKnowledgeContext, type PromptContext } from '@/composables/usePromptStore'`。

---

## 7. 验证步骤

### 7.1 编译

1. `npm run check` —— 0 类型错误。
2. `npm run build` —— 成功。

### 7.2 行为验证（开发者自查）

| 场景 | 预期 |
|---|---|
| 整卷演练（卷一/卷二/卷三）| LLM 从全卷所有科目/考点中任选一个；prompt 中 `examJson` 字段为该卷 `Exam` 完整 `JSON.stringify` 结果；header 切换为真实 subject/topic |
| 专题练习（subject scope）| LLM 仍能选到该科目下具体 topic；prompt 走 subject 分支（`knowledgeContext` 是该科目级考点列表） |
| 单考点练习（topic scope）| LLM 按指定 subject+topic 出题；prompt 走 topic 分支（`knowledgeContext` 含完整 markdown） |
| 关键词背诵 | subject + topic + keyword + knowledgeContext(md) 三要素齐全；输出纯文本 |
| 关键词评析 | 6 个字段齐全；输出纯文本 |
| 客观题评卷 | report + 错因 + 口诀 + 易混点；JSON 合法 |
| 主观题评卷 | report + score:[n,30] + referenceAnswer；JSON 合法 |

### 7.3 第三方库契约

- `streamChat` 调用方式不变
- 出题场景 `blur: true`；评卷/关键词 `blur: false`（评卷走 `thinking: true`）
- 降级模式 throw
- `useStreamChat` 弹窗与 `vue-llm-stream-chat` 行为不变

### 7.4 持久化回归

- 默认模型 / 供应商 / 错题 / 练习次数 / 侧栏折叠 / 关键词缓存 全部保留

---

## 8. 改动文件清单

### 修改（4 个）

- `src/composables/usePromptStore.ts` —— 整体重写为函数化 + 模板字面量；保留 `buildKnowledgeContext` / 新增 `buildExamJson` / 删除 `DEFAULT_PROMPTS` 字符串表 / 优化 6 个提示词
- `src/composables/llm/useLLM.ts` —— `CallStreamOptions` 收敛为 `promptContext`；删除 `subject/topic/scope/extras` 扁平字段
- `src/composables/usePracticeFlow.ts` —— `generate` 用 `PromptContext`；`judge` 形参改为 `PromptContext`；删除 `buildExamSubjectsJson`
- `src/composables/useKeywordFlow.ts` —— 用 `PromptContext` 替代 `subject/topic/scope/extras`
- `src/components/PracticeModal.vue` —— `handleJudge` 用 `PromptContext`；`addWrong` 维持现状

### 不动

- `src/data/**`
- `src/composables/llm/callWithParse.ts` / `llm/json.ts` / `llm/index.ts`（自动跟随 `CallStreamOptions`）
- `src/lib/**` / `src/styles/**` / `src/types/exam.ts`
- `src/views/PracticeView.vue`（占位符逻辑保持，由 modal 内部消化）
- `src/composables/useSettings.ts` / `usePracticeTracker.ts` / `useWrongBook.ts` / `usePracticeCount.ts` / `useLocalStorage.ts` / `useRuntimeMode.ts`
- `src/components/KeywordMemorizeModal.vue`（`useKeywordFlow` API 兼容，但内部已切换为 `PromptContext`）

---

## 9. 预期收益

1. **可读性**：每个 prompt 函数直接看源码就能判断 3 个 scope 下长什么样，无需 mental 模拟 `replace` 链。
2. **类型安全**：`PromptContext` 是强类型结构，调用方不会拼错 `extras` key。
3. **取消正则**：消除「占位符意外出现在 JSON 示例中」「`exam` 场景下 `({subject} | {topic})` 替换不到位」一类隐患。
4. **整卷信息更全**：LLM 拿到完整 `Exam` JSON（含 `id` / `name` / 全部 `subjects.topics.keywords`），选题更精准，也能理解整卷难度结构。
5. **API 收敛**：`useLLM.callStream` 不再暴露 `subject/topic/scope/extras` 4 个扁平参数，未来扩展提示词字段时不会反复改 LLM 入口签名。
6. **提示词优化**：去除冗余、明确 JSON 输出要求、提示陷阱词汇统一，LLM 响应更稳定。

---

## 10. 执行顺序

1. 重写 `src/composables/usePromptStore.ts`（函数化 + 模板字面量 + 优化 6 个提示词 + 新增 `buildExamJson`）。
2. 修改 `src/composables/llm/useLLM.ts`（收敛 `CallStreamOptions`）。
3. 修改 `src/composables/usePracticeFlow.ts`（用 `PromptContext`，删 `buildExamSubjectsJson`）。
4. 修改 `src/composables/useKeywordFlow.ts`（用 `PromptContext`）。
5. 修改 `src/components/PracticeModal.vue`（`handleJudge` 用 `PromptContext`）。
6. `npm run check` + `npm run build` 验证。
