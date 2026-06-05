# 整卷演练修复计划:LLM 实际选题 + 知识上下文传递

> **Bug**:点击「整卷演练」后,AI 仅对当前卷第一个 subject 的第一个 topic 出题,没有真正在该卷所有 subject/topic 中选题。
>
> **根因**:
> 1. `usePracticeFlow.generate` 强制要求传入 `subject` + `topic`,整卷场景被传入了 `currentExam.subjects[0]` / `subjects[0].topics[0]` 当占位符
> 2. `buildPrompt` 把占位符的 `{subject}` / `{topic}` 字符串原样替换到了 prompt 正文(`围绕 ({subject} | {topic}) 生成…`),导致 LLM 看到具体的科目/考点名后,直接按占位符出题
> 3. 题目 JSON 缺 `subjectId` / `subjectName`,前端无法判断 LLM 真正选了哪个 subject/topic
> 4. `PracticeModal` header 永远显示占位符 subject.name,judge 也用占位符 subject/topic 调评
>
> **目标**:
> 1. 整卷演练时,LLM 必须从该卷所有 subject/topic 中任选一个,前端按 LLM 实际选择渲染
> 2. 考点/科目演练时,带该 topic 的知识上下文 markdown(已实现,确认保留)
> 3. 整卷演练时,带该卷 Exam 上下文的 JSON 数据(已实现 `extras.examSubjectsJson`,确认保留)
> 4. `judge` 调评时使用 LLM 实际选的 subject/topic

---

## 0. 范围与硬约束

- 不修改 `src/data/**`(考试/知识原始数据)
- 不修改对 `vue-llm-stream-chat` 的调用契约
- 不修改 `src/composables/llm/useLLM.ts` / `callWithParse.ts`(统一 LLM 入口)
- 不修改 `src/styles/markdown.css` / `src/lib/format.ts` / `src/lib/examKind.ts`
- 沿用统一提示词加载、blur(仅出题 blur=true)、LLM 入口契约
- 沿用「2+ 处使用即封装」原则

---

## 1. 现状速览

### 1.1 已有机制
- `usePromptStore.buildPrompt` 已按 scope 重写 prompt 头部:
  - `scope='exam'`:把 `【科目领域】: {subject}` / `【核心考点】: {topic}` 替换为「整卷综合」
  - `scope='subject'`:把 `【核心考点】: {topic}` 替换为「科目综合(可涵盖该科目任意考点)」
- `usePromptStore.buildKnowledgeContext`:
  - `scope='topic'`:返回含「相关法考大纲知识」+ markdown 全文(✅ 用户要求)
  - `scope='subject'`:返回科目级考点列表
  - `scope='exam'`:返回空(交给 `examSubjectsJson` 处理)
- `usePracticeFlow.generate` 在 `scope='exam'` 时把 `extras.examSubjectsJson` 注入 prompt
- `PracticeView.openExam` 用 `currentExam.subjects[0]` / `subjects[0].topics[0]` 当占位符

### 1.2 待修缺陷
1. **占位符泄露**:`buildPrompt` 在 exam scope 下只重写了头部,正文「围绕 ({subject} | {topic})」仍被替换为占位符名
2. **API 强耦合**:`usePracticeFlow.generate` 强类型 `Subject`/`Topic`,导致 exam 场景被迫造假
3. **缺少回查**:`ObjectiveGenerateOut` / `SubjectiveGenerateOut` 只有 `topicId` / `topicName`,没有 `subjectId`;前端 header / judge / 错题集无法对齐真实选项
4. **judge 错位**:`PracticeModal.handleJudge` 用 `props.subject` / `props.topic` 调评,exam 场景下永远是占位符

---

## 2. 改动清单(7 个文件 + 1 个模板)

### 2.1 `src/composables/usePromptStore.ts` — Prompt 模板 + buildPrompt

#### 2.1.1 `objective-generate` / `subjective-generate` 输出 JSON 增 `subjectId`

在两处 prompt 的 JSON 示例块最前面加 `subjectId` 字段,并更新说明文字:

```diff
 {
+  "subjectId": "科目ID（从上方 examSubjectsJson 选定）",
   "topicId": "考点ID（从上方 examSubjectsJson 选定）",
   "topicName": "考点名称（从上方 examSubjectsJson 选定）",
   ...
 }
```

并把「请在返回的 JSON 中明确标注本次出题所针对的具体考点ID和名称」改为「请在返回的 JSON 中明确标注本次出题所针对的具体科目ID与名称、考点ID与名称(均从上方 examSubjectsJson 中选定,topicId 必须真实存在于所选 subject 的 topics 列表中)」。

#### 2.1.2 `buildPrompt` 函数签名与实现调整

**新签名**:

```ts
export function buildPrompt(
  key: PromptKey,
  subject: Subject | null,
  topic: Topic | null,
  scope: 'topic' | 'subject' | 'exam',
  extras: Record<string, string> = {},
): string
```

`subject` / `topic` 允许为 `null`(整卷场景)。

**exam scope 关键改动**:在头部重写之后,**进一步把正文中所有 `({subject} | {topic})`、`({subject} 或 {topic})`、孤立 `{subject}` / `{topic}` 替换掉**,避免占位符名泄露:

```ts
} else if (scope === 'exam') {
  tpl = tpl
    .replace(/【科目领域】: \{subject\}/g, '【出题范围】: 整卷综合')
    .replace(/【核心考点】: \{topic\}/g, '【出题范围】: 整卷综合（可涵盖该试卷任意科目的任意考点）')
    // 正文:把围绕某个具体 subject/topic 的字眼改成"围绕下方所选科目与考点"
    .replace(/\(\{subject\} \| \{topic\}\)/g, '（下方所选科目与考点）')
    .replace(/\{subject\} \| \{topic\}/g, '下方所选科目与考点')
    .replace(/\{subject\}/g, '（整卷由 AI 选定）')
    .replace(/\{topic\}/g, '（整卷由 AI 选定）')
}
```

`subject` / `topic` 为 `null` 时,所有 `subject.name` / `topic.name` 取 `'（整卷由 AI 选定）'`;其它字段用空串兜底。

#### 2.1.3 `buildKnowledgeContext` 调整

保持现状,`subject` / `topic` 为 `null` 时直接返回 `''`(整卷场景本来就不需要它,改为由 `extras.examSubjectsJson` 接管)。

---

### 2.2 `src/composables/llm/useLLM.ts` — 适配可空 subject/topic

```diff
 export interface CallStreamOptions {
   promptKey?: PromptKey
   prompt?: string
-  subject?: Subject
-  topic?: Topic
+  subject?: Subject | null
+  topic?: Topic | null
   scope?: 'topic' | 'subject' | 'exam'
   ...
 }
```

`callStream` 内部把 `opts.subject!` / `opts.topic!` 改为 `opts.subject ?? null` / `opts.topic ?? null` 透传给 `buildPrompt`(`buildPrompt` 已支持 null)。

---

### 2.3 `src/composables/usePracticeFlow.ts` — 输出类型 + 函数签名

#### 2.3.1 `ObjectiveGenerateOut` / `SubjectiveGenerateOut` 增 `subjectId`

```ts
export interface ObjectiveGenerateOut {
  subjectId: string
  topicId: string
  topicName: string
  single: ObjectiveSingleQ
  multiple: ObjectiveMultiQ
}

export interface SubjectiveGenerateOut {
  subjectId: string
  topicId: string
  topicName: string
  caseText: string
  question: string
}
```

#### 2.3.2 JSON Schema 同步增字段

```ts
const SUBJECTIVE_GENERATE_SCHEMA: JsonShape = {
  subjectId: 'string',
  topicId: 'string',
  topicName: 'string',
  caseText: 'string',
  question: 'string',
}

const OBJECTIVE_GENERATE_SCHEMA: JsonShape = {
  subjectId: 'string',
  topicId: 'string',
  topicName: 'string',
  single: { ... },
  multiple: { ... },
}
```

#### 2.3.3 `generate` 函数签名为可空 subject/topic

```ts
async function generate(
  subject: Subject | null,
  topic: Topic | null,
  scope: PracticeScope,
): Promise<ObjectiveGenerateOut | SubjectiveGenerateOut> {
  // subject/topic 透传给 useLLM.callStream,已支持 null
  return callStreamWithParse<...>(callStream, {
    promptKey,
    subject,
    topic,
    scope,
    extras: { examSubjectsJson: scope === 'exam' ? buildExamSubjectsJson(examId.value) : '' },
    blur: true,
    schema,
    retries: 3,
  })
}
```

> `judge` 暂保持现签名,由调用方(`PracticeModal`)传实际 subject/topic(见 2.5)。

---

### 2.4 `src/composables/usePromptStore.ts` 增导出辅助函数

为 `PracticeModal` 方便地根据 `(subjectId, topicId)` 在 exam 数据中查找,新增纯函数:

```ts
import { examById } from '@/data/exams'
import type { ExamId } from '@/types/exam'

export function findSubjectTopic(
  examId: ExamId,
  subjectId: string,
  topicId: string,
): { subject: Subject; topic: Topic } | null {
  const exam = examById(examId)
  const subject = exam?.subjects.find(s => s.id === subjectId)
  const topic = subject?.topics.find(t => t.id === topicId)
  return subject && topic ? { subject, topic } : null
}
```

> 放在 `usePromptStore.ts` 避免新增文件;它纯查数据,与 LLM/提示词无耦合。
> 备选:放到 `src/lib/examLookup.ts`(独立纯函数模块);倾向 `usePromptStore.ts`,因为 `buildPrompt` 也需要它(可简化 prompt 内部 subject/topic 反查),且模块已经依赖 `@/data/exams`。

> ⚠️ 注意:目前 `usePromptStore.ts` 不 import `@/data/exams`,需要新增一行 import。

---

### 2.5 `src/components/PracticeModal.vue` — 用 LLM 实际选择回填

#### 2.5.1 新增 `actualSubjectId` / `actualSubjectName` 引用

```ts
const actualSubjectId = ref(props.subject.id || '')
const actualSubjectName = ref(props.subject.name || '整卷演练（AI 选题中）')
```

`reset()` 中同步重置:
```ts
actualSubjectId.value = props.subject.id || ''
actualSubjectName.value = props.subject.name || '整卷演练（AI 选题中）'
```

#### 2.5.2 `doGenerate` 处理 LLM 返回

```ts
async function doGenerate() {
  error.value = ''
  try {
    const out = await flow.generate(
      props.scope === 'exam' ? null : props.subject,
      props.scope === 'exam' ? null : props.topic,
      props.scope,
    )
    // ... 现有 single/multi/subjective 赋值
    if (out.subjectId) actualSubjectId.value = out.subjectId
    if (out.topicId) actualTopicId.value = out.topicId
    if (out.topicName) actualTopicName.value = out.topicName
    // 用 findSubjectTopic 反查 subjectName
    const found = findSubjectTopic(props.examId, out.subjectId, out.topicId)
    if (found) actualSubjectName.value = found.subject.name

    if (props.scope !== 'topic') {
      recordPractice(actualSubjectId.value || props.subject.id, actualTopicId.value, kind.value)
      emit('practice-recorded', actualSubjectId.value || props.subject.id, actualTopicId.value, kind.value)
    }
  } catch (e: any) { ... }
}
```

#### 2.5.3 header 改用 `actualSubjectName`

```diff
-<span>{{ subject.name }} · {{ actualTopicName }}</span>
+<span>{{ actualSubjectName || subject.name }} · {{ actualTopicName }}</span>
```

#### 2.5.4 `handleJudge` 用实际 subject/topic

```ts
const targetSubject = findSubjectTopic(
  props.examId,
  actualSubjectId.value,
  actualTopicId.value,
)?.subject ?? props.subject
const targetTopic = findSubjectTopic(
  props.examId,
  actualSubjectId.value,
  actualTopicId.value,
)?.topic ?? props.topic

await flow.judge(targetSubject, targetTopic, props.scope, extras)
```

`addWrong` 调用同步换成 `targetSubject.id` / `targetSubject.name` / `targetTopic.id` / `targetTopic.name`,**`caseText` / `questionText` / `aiJudgeResult` 等不变**。

---

### 2.6 `src/views/PracticeView.vue` — `openExam` 不再造假

```ts
function openExam() {
  triggerOpen({
    show: true,
    subject: FALLBACK_SUBJECT,   // 整卷场景下仅为占位
    topic: FALLBACK_TOPIC,
    scope: 'exam',
  })
}
```

保持现状即可 — 占位符依然存在,但 `PracticeModal.doGenerate` 在 `scope === 'exam'` 时**传 null** 给 `flow.generate`,所以 LLM 走 exam scope 路径,不会看到占位符名。

> `FALLBACK_SUBJECT` / `FALLBACK_TOPIC` 保留(供 keyword modal / 兜底用),只是不在 `flow.generate` 上泄露。

---

### 2.7 模板改动落地清单

| 文件 | 变更 |
|---|---|
| `usePromptStore.ts` | 2 处 prompt 模板加 `subjectId` 字段;`buildPrompt` 签名支持 null;exam scope 改写正文占位符;导出 `findSubjectTopic` |
| `llm/useLLM.ts` | `CallStreamOptions.subject/topic` 类型放宽为 `Subject \| null` / `Topic \| null` |
| `usePracticeFlow.ts` | 输出类型 + JSON schema 加 `subjectId`;`generate` 形参改可空 |
| `PracticeModal.vue` | 增 `actualSubjectId` / `actualSubjectName`;`doGenerate` 处理 exam scope 与新字段;header 改用 `actualSubjectName`;`handleJudge` 用 `findSubjectTopic` 查实际 subject/topic;`addWrong` 用实际 subject |
| `PracticeView.vue` | `openExam` 维持占位(本次无需改) |

---

## 3. 关键决策与假设

1. **不修改 `subject` scope 行为**:`subject` scope 当前是"专题练习",沿用 `buildSubjectKnowledgeContext`(列出该科目的所有 topic 名 + 关键词)。用户没要求改,保持现状。
2. **整卷 `subject.name` / `topic.name` 反查**:LLM 仅返回 ID,前端用 `findSubjectTopic` 在 `exams.ts` 数据中查真实名称,避免 LLM 名称漂移。
3. **`subject` / `topic` 可空 vs 保留占位符**:**选择可空**。让 `useLLM.callStream` / `usePracticeFlow.generate` 的类型层就反映 exam 场景的"未知",而不是骗它说"我有一个 subject"。`usePromptStore.buildPrompt` 是唯一需要兼容 null 的地方。
4. **judge 仍用 `props.subject` 占位符兜底**:若 LLM 返回的 `subjectId` 在 exam 数据中查不到(极端情况),退回占位符,保证功能可用。
5. **错题集 `subjectId` / `subjectName` 修正**:exam 场景下写入错题集时,使用 `actualSubjectId` / `actualSubjectName`,确保错题集与 AI 实际选题一致。
6. **不做请求级 scope 决策**:仍然依赖 `props.scope` 判断,不变。
7. **保持 `recordPractice` 语义不变**:scope === 'topic' 时不 record(由 TopicCard 触发时已 record),scope === 'subject' / 'exam' 时 record。用 `actualSubjectId.value || props.subject.id` 兜底。

---

## 4. 验证步骤

### 4.1 编译
1. `npm run check` 0 错误
2. `npm run build` 成功

### 4.2 行为验证(开发者自查)

| 场景 | 预期 |
|---|---|
| 整卷演练(客观题-卷一) | 弹出 modal 时 header 显示"客观题(卷一) · 整卷演练(AI 选题中...)"或类似占位;LLM 响应后 header 切换为真实 subject/topic;出题不再固定为 lt-1 |
| 整卷演练(客观题-卷二) | 同上 |
| 整卷演练(主观题-卷三) | 同上(主观题路径) |
| 专题练习(单科目) | header 显示该科目名;LLM 响应后切换为 LLM 选的 topic;错题集记录真实 subjectId/topicId |
| 单考点练习 | header 固定为该 subject/topic(原行为不变) |
| 关键词背诵 | 不受影响 |
| 错题集统计 / 演练次数 | 数据正确(因 record 调用更新) |

### 4.3 持久化回归
- 默认模型 / 供应商 / 错题 / 练习次数 / 侧栏折叠 / 关键词缓存 全部保留
- 升级前已存在的错题(无 subjectId 字段)仍可正常展示(`findSubjectTopic` 找不到时 fallback 到 `props.subject`)

### 4.4 第三方库契约
- `streamChat` 调用方式不变
- 出题场景 `blur: true`;评判/关键词无 blur
- 降级模式 throw

---

## 5. 改动文件清单

### 修改 (4)
- `src/composables/usePromptStore.ts` — 模板 + buildPrompt 改造;导出 `findSubjectTopic`
- `src/composables/llm/useLLM.ts` — `CallStreamOptions.subject/topic` 改为可空
- `src/composables/usePracticeFlow.ts` — 输出类型 + schema + generate 形参可空
- `src/components/PracticeModal.vue` — 增 actualSubjectId/Name,改 doGenerate / handleJudge / header / addWrong

### 不动
- `src/data/**`(原始数据)
- `src/composables/llm/callWithParse.ts` / `llm/json.ts` / `llm/index.ts`
- `src/composables/useLLM.callStream` 内部逻辑(仅放宽类型)
- `src/views/PracticeView.vue`(占位符保持,modal 内部消化)
- `src/styles/markdown.css` / `src/lib/**`
- `src/composables/useSettings.ts` / `usePracticeTracker.ts` / `useWrongBook.ts` / `usePracticeCount.ts` / `useKeywordFlow.ts` / `useLocalStorage.ts` / `useRuntimeMode.ts`

---

## 6. 预期收益

- **核心 bug 修复**:整卷演练真正在该卷所有 subject/topic 中随机选题
- **显示正确**:modal header / 错题集 subject 名与 AI 实际选题一致
- **judge 准确**:评判时使用 AI 实际选的 subject/topic 上下文,评判质量提升
- **类型准确**:`usePracticeFlow.generate` 不再强求一个伪 subject/topic
- **LLM 反馈稳定**:`subjectId` 必返回,前端用数据反查名称,避免 LLM 名称漂移

---

## 7. 执行顺序

1. `usePromptStore.ts`:模板 + buildPrompt 改造 + findSubjectTopic
2. `llm/useLLM.ts`:`CallStreamOptions` 放宽类型
3. `usePracticeFlow.ts`:输出类型 + schema + generate 形参可空
4. `PracticeModal.vue`:actualSubjectId/Name + doGenerate/handleJudge/header/addWrong
5. `npm run check` + `npm run build` 验证
