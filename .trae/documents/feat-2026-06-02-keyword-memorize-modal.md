# 关键词背诵模态框（KeywordMemorizeModal）

> **目标**：让 TopicCard 上的关键词标签可点击，触发"AI 生成考点必背 → 默写 → AI 评析"的三步背诵流程，全程复用 `vue-llm-stream-chat` 的流式弹窗。

---

## 1. Summary

为 `TopicCard.vue` 的关键词 `<n-tag>` 增加可点击交互，弹出 `KeywordMemorizeModal` 模态框，按以下五步状态机运行：

| 步骤 (`step`) | 模态框主体 | 弹窗接管（第三方库） | Footer 按钮 |
| --- | --- | --- | --- |
| `loading-memo` | 模态框**不显示** | vue-llm-stream-chat 全屏弹窗流式渲染必背 | — |
| `view-memo` | 渲染必背纯文本（pre-wrap） | 无 | 默写 / 关闭 |
| `recall` | 替换为 `n-input` 默写框 | 无 | 提交 / 关闭 |
| `loading-evaluate` | 模态框**不显示** | vue-llm-stream-chat 全屏弹窗流式渲染评析 | — |
| `evaluated` | 渲染评析纯文本 | 无 | 关闭 / 重新默写 |

两个 AI 调用阶段（步骤 1、3）**都依赖 `useStreamChat().streamChat(..., { viewProps: { modal: true, blur: 4 } })`**，完全复用在 `App.vue` 顶层挂载的 `<StreamChatModalProvider>`；用户视觉上感受到"AI 正在生成"由第三方库负责。步骤 1 / 3 切换为步骤 2 / 4 的时机是 `loading` 由 `true → false`。

---

## 2. Current State Analysis

### 2.1 已存在的基础设施（**复用**）

- **`vue-llm-stream-chat` 第三方库**
  - `<StreamChatModalProvider>` 已挂在 `src/App.vue#L12`。
  - `useStreamChat()` 返回 `streamingText / fullContent / loading / error / streamChat(...)`。
  - `streamChat` 接收 `viewProps: { modal, modalWidth, modalMaxHeight, modalContentMaxHeight, blur }`，默认 `modal: true`。
  - 见 [`useStreamChat.d.ts`](file:///c:/Users/Administrator/Documents/codes/%E6%98%93%E6%87%82%E6%B3%95%E8%80%83/node_modules/vue-llm-stream-chat/dist/useStreamChat.d.ts)。

- **`useLLM` 封装**（[`src/composables/llm/ask.ts`](file:///c:/Users/Administrator/Documents/codes/%E6%98%93%E6%87%82%E6%B3%95%E8%80%83/src/composables/llm/ask.ts)）
  - 已通过 `streamChat` 接入第三方库，并设置 `viewProps: { blur: 4 }`。
  - 但**它强制要求 `schema` 提取 JSON**（不传 schema 会进入 `extractJson` 抛错路径），且 3 次重试对"必背纯文本"语义不友好。
  - **本特性不复用 `useLLM.ask`**，直接调用 `streamChat` 自己管状态。

- **`usePromptStore` 体系**（[`src/composables/usePromptStore.ts`](file:///c:/Users/Administrator/Documents/codes/%E6%98%93%E6%87%82%E6%B3%95%E8%80%83/src/composables/usePromptStore.ts)）
  - `PromptKey` 在 `src/types/index.ts#L31` 定义，目前不含"必背 / 评析"键。
  - `buildPrompt(key, subject, topic, scope, extras)` 负责模板替换。
  - `buildKnowledgeContext(subject, topic, 'topic')` 自动追加相关法考知识到 prompt。

- **`useRuntimeMode`**（[`src/composables/useRuntimeMode.ts`](file:///c:/Users/Administrator/Documents/codes/%E6%98%93%E6%87%82%E6%B3%95%E8%80%83/src/composables/useRuntimeMode.ts)）
  - `isNormalMode` 已配置 AI 才能调用；模态框入口处需根据其降级。

- **`useSettings.resolveDefaultModel`**：返回 `{ baseUrl, apiKey, model }`，本特性直接复用。

### 2.2 缺失/需新增的部分

- `PromptKey` 没有 `keyword-memo` / `keyword-evaluate`。
- 没有 `KeywordMemorizeModal.vue`。
- 没有 `useKeywordFlow` 组合式。
- `TopicCard.vue` 的关键词 `<n-tag>` 不可点击、无事件。

---

## 3. Proposed Changes

### 3.1 扩展 PromptKey 与 Prompt 模板

**文件**：[`src/types/index.ts`](file:///c:/Users/Administrator/Documents/codes/%E6%98%93%E6%87%82%E6%B3%95%E8%80%83/src/types/index.ts)
- 在 `PromptKey` 联合类型尾部追加 `'keyword-memo' | 'keyword-evaluate'`。

**文件**：[`src/composables/usePromptStore.ts`](file:///c:/Users/Administrator/Documents/codes/%E6%98%93%E6%87%82%E6%B3%95%E8%80%83/src/composables/usePromptStore.ts)
- 在 `DEFAULT_PROMPTS` 中新增两个键：

  ```ts
  'keyword-memo': `
    你是中国国家统一法律职业资格考试（法考）辅导名师。
    请围绕【科目】{subject}、【考点】{topic}、【关键词】{keyword}，输出一段「考点必背」纯文本。
    要求：
    1. 简洁、结构清晰、便于背诵（不超过 300 字）。
    2. 包含核心概念 + 关键构成要件 + 易混淆点 + 一句秒杀口诀。
    3. 不要输出 JSON、不要代码块标记、不要 Markdown 标题。
    4. 用换行分段即可。

    【相关法考大纲知识】:
    {knowledgeContext}
  `,

  'keyword-evaluate': `
    你是法考辅导阅卷专家。学生在默写"考点必背"时可能漏点、错点或加入自己的理解。
    请对学生默写进行精准评析。

    【科目】{subject}
    【考点】{topic}
    【关键词】{keyword}
    【原必背内容】{memoText}
    【学生默写】{userRecall}

    【评析要求】:
    1. 漏点清单：逐条列出原必背中出现但学生漏掉的内容。
    2. 错点清单：学生写错或有偏差之处。
    3. 加分项：学生补充得当、值得肯定的内容。
    4. 综合点评：一段简短的鼓励 + 改进建议。
    5. 不要输出 JSON、不要代码块标记、不要 Markdown 标题，仅输出纯文本（用换行分段）。
  `,
  ```

  > 这两个 prompt 都**不**走 `useLLM.ask`（避免 JSON 校验），在新的 `useKeywordFlow` 中直接 `streamChat` 调用，第三方库会按 `viewProps.modal=true` 显示弹窗。

### 3.2 新增 `useKeywordFlow` 组合式

**新建文件**：[`src/composables/useKeywordFlow.ts`](file:///c:/Users/Administrator/Documents/codes/%E6%98%93%E6%87%82%E6%B3%95%E8%80%83/src/composables/useKeywordFlow.ts)

提供：
- `generateMemo(subject, topic, keyword): Promise<string>` — 调用 streamChat，让 ModalProvider 接管，结束后返回 `fullContent`。
- `evaluateMemo(subject, topic, keyword, memoText, userRecall): Promise<string>` — 同上。

**关键设计**：
- 内部使用 `useStreamChat()` 的 `streamChat`、`loading`、`fullContent`。
- **不传 schema**，故不会触发 `extractJson` 路径。
- 失败时不重试（教学场景里一次重试体验更好，失败直接抛错给 modal 显示）。
- 复用 `useSettings.resolveDefaultModel` 拿到 baseUrl/apiKey/model；调用前用 `useRuntimeMode.isNormalMode` 兜底检查（降级时直接 throw）。

```ts
// 关键伪代码
export function useKeywordFlow() {
  const { streamChat, loading, fullContent, error } = useStreamChat()
  const { resolveDefaultModel } = useSettings()
  const { isNormalMode } = useRuntimeMode()

  async function runPrompt(prompt: string): Promise<string> {
    if (!isNormalMode.value) throw new Error('降级模式下无法使用 AI 功能')
    const picked = resolveDefaultModel()
    if (!picked) throw new Error('请先在设置中配置 API 信息')
    await streamChat(
      { baseUrl: picked.baseUrl, apiKey: picked.apiKey },
      picked.model,
      [{ role: 'user', content: prompt }],
      { thinking: false, viewProps: { modal: true, blur: 4 } },
    )
    if (error.value) throw new Error(error.value)
    return fullContent.value ?? ''
  }

  async function generateMemo(subject: Subject, topic: Topic, keyword: string) {
    const prompt = buildPrompt('keyword-memo', subject, topic, 'topic', { keyword })
    return runPrompt(prompt)
  }

  async function evaluateMemo(...) { /* 同上，使用 'keyword-evaluate' */ }

  return { generateMemo, evaluateMemo, loading }
}
```

> 注意：`streamChat` 触发的 ModalProvider 弹窗在 `loading=false` 时会自动关闭（由第三方库管理），我们在 `useKeywordFlow` 内 `await` 等待 Promise resolve，再读 `fullContent` 即可。

### 3.3 新增 `KeywordMemorizeModal` 组件

**新建文件**：[`src/components/KeywordMemorizeModal.vue`](file:///c:/Users/Administrator/Documents/codes/%E6%98%93%E6%87%82%E6%B3%95%E8%80%83/src/components/KeywordMemorizeModal.vue)

**Props**：
```ts
interface Props {
  show: boolean
  openKey: number       // 每次打开 +1，触发 watch 重置
  subject: Subject
  topic: Topic
  keyword: string
}
```

**Emits**：
```ts
(e: 'update:show', v: boolean): void
```

**状态机**（内部 `ref`）：
```ts
type Step = 'loading-memo' | 'view-memo' | 'recall' | 'loading-evaluate' | 'evaluated'
const step = ref<Step>('loading-memo')
const memoText = ref('')
const userRecall = ref('')
const evaluationText = ref('')
const error = ref('')
const flow = useKeywordFlow()
```

**显示控制**（与 `PracticeModal.vue#L62-64` 一致）：仅在"自有 UI"步骤（view-memo / recall / evaluated）或出错时显示模态框；流式生成阶段（loading-memo / loading-evaluate）模态框**隐藏**，让第三方库 ModalProvider 接管。

```ts
const displayed = computed(() => {
  if (error.value) return true
  return ['view-memo', 'recall', 'evaluated'].includes(step.value)
})
```

**核心流程**：

1. `watch(() => props.openKey, async (k) => { if (k > 0) { reset(); await doGenerateMemo() } })`
2. `doGenerateMemo()`:
   - `step = 'loading-memo'`
   - `error = ''`
   - 调 `flow.generateMemo(subject, topic, keyword)`，得到文本
   - 成功 → `memoText = text; step = 'view-memo'`
   - 失败 → `error = e.message; step = 'view-memo'`（仍显示一个空 memo + 顶部 alert，方便用户重试）
3. 用户点击「默写」→ `step = 'recall'`
4. 用户点击「提交」→ `step = 'loading-evaluate'` → 调 `flow.evaluateMemo(...)` → 成功 `evaluationText = text; step = 'evaluated'`，失败时 `error = e.message; step = 'evaluated'`
5. 关闭 → emit `update:show = false`

**UI 模板**（关键片段）：
```vue
<n-modal :show="displayed" preset="card" :bordered="false"
  style="width: 720px; max-width: 92vw; max-height: 88vh; overflow: auto"
  @update:show="emit('update:show', $event)">
  <template #header>
    <span>📚 {{ subject.name }} · {{ topic.name }} · 「{{ keyword }}」背诵</span>
  </template>

  <n-alert v-if="error" type="error" style="margin-bottom: 12px">{{ error }}</n-alert>

  <!-- 必背文本 -->
  <div v-if="step === 'view-memo'" class="plain-text">{{ memoText || '（生成失败，请关闭后重试）' }}</div>

  <!-- 默写输入 -->
  <div v-else-if="step === 'recall'">
    <n-input v-model:value="userRecall" type="textarea" :rows="12" placeholder="请输入你背诵的内容..." />
  </div>

  <!-- 评析结果 -->
  <div v-else-if="step === 'evaluated'" class="plain-text">{{ evaluationText || '（评析失败）' }}</div>

  <template #footer>
    <n-space justify="end">
      <n-button v-if="step === 'view-memo'" type="primary" @click="step = 'recall'">默写</n-button>
      <n-button v-else-if="step === 'recall'" type="primary" :disabled="!userRecall.trim()" @click="doEvaluate">提交</n-button>
      <n-button v-else-if="step === 'evaluated'" @click="step = 'recall'; userRecall = ''">重新默写</n-button>
      <n-button @click="emit('update:show', false)">关闭</n-button>
    </n-space>
  </template>
</n-modal>
```

> `plain-text` class：`white-space: pre-wrap; line-height: 1.8; font-size: 14px; color: #334155; padding: 16px; background: #f8fafc; border-radius: 8px; max-height: 60vh; overflow-y: auto;`

### 3.4 修改 `TopicCard.vue`

**文件**：[`src/components/TopicCard.vue`](file:///c:/Users/Administrator/Documents/codes/%E6%98%93%E6%87%82%E6%B3%95%E8%80%83/src/components/TopicCard.vue#L33-36)

- 在 `defineEmits` 末尾追加 `(e: 'memorize', keyword: string): void`
- 在 `<script setup>` 末尾加：
  ```ts
  function clickKeyword(kw: string) {
    if (!props.isNormalMode) return
    emit('memorize', kw)
  }
  ```
- 修改 `<n-tag>` 模板：
  ```vue
  <n-tag
    v-for="kw in topic.keywords"
    :key="kw"
    size="small"
    :bordered="false"
    class="keyword-tag"
    :class="{ 'keyword-tag-clickable': isNormalMode }"
    @click="clickKeyword(kw)"
  >
    {{ kw }}
  </n-tag>
  ```
- 在 `<style scoped>` 中追加：
  ```css
  .keyword-tag-clickable {
    background: #e0e7ff !important;
    color: #3730a3 !important;
    cursor: pointer;
    transition: transform .15s, background .15s;
  }
  .keyword-tag-clickable:hover {
    background: #c7d2fe !important;
    transform: translateY(-1px);
  }
  ```

### 3.5 修改 `PracticeView.vue`

**文件**：[`src/views/PracticeView.vue`](file:///c:/Users/Administrator/Documents/codes/%E6%98%93%E6%87%82%E6%B3%95%E8%80%83/src/views/PracticeView.vue)

- 引入：`import KeywordMemorizeModal from '@/components/KeywordMemorizeModal.vue'`
- 新增 `keywordModal` 状态与 `openKeywordMemo` 函数（与 `modal` 模式一致）：
  ```ts
  const keywordModal = ref({
    show: false,
    openKey: 0,
    subject: FALLBACK_SUBJECT as Subject,
    topic: FALLBACK_TOPIC as Topic,
    keyword: '',
  })
  function openKeywordMemo(subject: Subject, topic: Topic, keyword: string) {
    keywordModal.value = {
      show: true,
      openKey: keywordModal.value.openKey + 1,
      subject, topic, keyword,
    }
  }
  function onKeywordModalClose() { keywordModal.value.show = false }
  ```
- 修改 `<TopicCard @practice=...>` 改为同时监听 `@memorize`：
  ```vue
  <TopicCard
    ...
    @practice="(sId, tId) => onTopicPractice(subject, tId)"
    @memorize="(kw) => openKeywordMemo(subject, topic, kw)"
  />
  ```
- 在 `<PracticeModal>` 之后挂载 `<KeywordMemorizeModal>`：
  ```vue
  <KeywordMemorizeModal
    :show="keywordModal.show"
    :open-key="keywordModal.openKey"
    :subject="keywordModal.subject"
    :topic="keywordModal.topic"
    :keyword="keywordModal.keyword"
    @update:show="onKeywordModalClose"
  />
  ```

---

## 4. Assumptions & Decisions

1. **不复用 `useLLM.ask`**：因为它强制 JSON schema 和 3 次重试；本特性是纯文本生成，重试体验差。
2. **必背 / 评析都由第三方库 ModalProvider 弹窗接管**：通过 `viewProps: { modal: true, blur: 4 }`；自有 modal 仅在 view-memo / recall / evaluated 阶段显示。
3. **可点击条件**：`isNormalMode === true`（即至少有一个供应商配置了 baseUrl + apiKey + 模型名），与「考点练习」按钮一致；不满足时关键词 tag 保持普通样式且不响应 click。
4. **降级体验**：降级模式下关键词 tag 不可点击，不弹错误。
5. **Markdown 渲染**：用户确认必背与评析均为**纯文本**，仅做 `white-space: pre-wrap` 渲染换行。
6. **错误处理**：两次 AI 调用失败时，`step` 退到最近的"有内容"步骤，顶部 `<n-alert>` 展示错误，footer 仍可关闭 / 重新默写。
7. **不持久化**：默写与评析结果不写入 localStorage（属于临时教学互动）。
8. **`useKeywordFlow` 与第三方库全局状态协作**：`useStreamChat` 是单例（Provider 共享同一组 ref），所以多个 modal 同时调用会互相覆盖；本特性假设同一时刻只有一个关键词背诵模态框（与 PracticeModal 已有约定一致）。

---

## 5. Verification Steps

执行顺序：

1. **静态检查**：
   - `npm run type-check`（或 `npx vue-tsc --noEmit`）确认所有新增类型与 `PromptKey` 扩展编译通过。
2. **构建**：`npm run build` 无 TS 报错。
3. **运行时验证**（dev server 起 `npm run dev` 后）：
   - 进入 `/#/practice`，先在「设置」中确认默认模型已配置。
   - 点击任一关键词 tag，预期：
     - 第三方库弹窗出现，模糊效果 → 流式显示"考点必背"内容。
     - 流式结束后第三方弹窗关闭，**自有 modal 弹出**，显示完整必背文本 + [默写, 关闭] 按钮。
   - 点击「默写」：切换为输入框。
   - 输入内容后点击「提交」：第三方库弹窗再次出现 → 评析流式生成 → 结束后自有 modal 显示评析 + [关闭, 重新默写]。
4. **降级模式**：把「设置」中所有 provider 的 apiKey 清空 → 关键词 tag 不可点击（鼠标悬浮不出现 pointer），hover 不变色。
5. **失败重试**：临时把默认模型指向不存在的 baseUrl → 触发生成失败 → modal 顶部出现红色 alert，footer 仍可关闭。
6. **回归**：原 `PracticeModal` 的「考点练习」按钮行为不受影响。

---

## 6. Out of Scope

- 不改动 `vue-llm-stream-chat` 库本身。
- 不重构 `useLLM.ask` 的 schema/重试逻辑。
- 不引入"背诵历史"持久化。
- 不修改 App.vue 顶层 Provider。
- 不改动 OverviewView、SettingsView、WrongBook 等无关视图。
