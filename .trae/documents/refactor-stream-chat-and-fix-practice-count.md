# 重构计划：统一流式聊天模块、修复练习计数、完善提示词

## 目标

1. 抽象 SSE Stream Modal 为独立组件
2. 创建 `useStreamChatWithModel` composable，自动管理 SSE Modal 和回调流程
3. 修复练习计数问题：客观题和主观题计数分离
4. 完善提示词，自动注入知识库上下文

---

## 当前问题分析

### 1. SSE Modal 重复代码
`ObjectiveModal.vue` 和 `SubjectiveModal.vue` 都包含相同的 SSE Stream Modal 代码（约 20 行），需要抽象为独立组件。

### 2. 流式聊天逻辑分散
每个组件都自己管理：
- `showStreamModal` 状态
- `streamingText` / `reasoningText` 数据
- `openStreamModal` / `closeStreamModal` 方法
- 滚动逻辑

### 3. 练习计数问题
当前 `usePracticeTracker` 使用简单的 `subjectId + topicId` 作为键，但客观题和主观题的科目 ID 相同（如 `legal-thought`），导致计数相互影响。

**解决方案**：添加 `type` 字段区分客观题/主观题练习记录。

### 4. 提示词缺乏上下文
当前提示词只包含科目名称和考点名称，缺少知识库内容。需要自动注入对应模块的 `knowledgeModules` 内容。

---

## 实施步骤

### 阶段1：创建 SSE Stream Modal 组件

#### 1.1 创建 `src/components/SseStreamModal.vue`

```vue
<template>
  <n-modal
    v-model:show="show"
    :mask-closable="false"
    preset="card"
    style="width: 680px; max-height: 80vh; overflow-y: auto;"
    :closable="false"
  >
    <div v-if="reasoningText" class="modal-reasoning">
      <div class="modal-section-label">思考过程</div>
      <pre ref="reasoningPreRef" class="modal-reasoning-content">{{ reasoningText }}</pre>
    </div>
    <div class="modal-output">
      <div class="modal-section-label">模型输出</div>
      <pre ref="outputPreRef" class="modal-output-content">{{ streamingText || '正在等待模型响应...' }}</pre>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { NModal } from 'naive-ui'

interface Props {
  show: boolean
  streamingText: string
  reasoningText: string
}

const props = defineProps<Props>()

const outputPreRef = ref<HTMLPreElement | null>(null)
const reasoningPreRef = ref<HTMLPreElement | null>(null)

watch(() => props.streamingText, () => {
  nextTick(() => {
    const el = outputPreRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
})

watch(() => props.reasoningText, () => {
  nextTick(() => {
    const el = reasoningPreRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
})
</script>
```

### 阶段2：创建 `useStreamChatWithModel` composable

#### 2.1 创建 `src/composables/useStreamChatWithModel.ts`

```typescript
import { ref } from 'vue'
import { useAiCall } from './useAiCall'
import { useSettings } from './useSettings'
import { useRuntimeMode } from './useRuntimeMode'
import type { ChatMessage } from '@/types'

export interface StreamChatOptions {
  messages: ChatMessage[]
  thinking?: boolean
  onFinish?: (fullText: string) => void
  onError?: (error: Error) => void
}

export function useStreamChatWithModel() {
  const { streamChat } = useAiCall()
  const { settings } = useSettings()
  const { isNormalMode } = useRuntimeMode()

  const showStreamModal = ref(false)
  const streamingText = ref('')
  const reasoningText = ref('')
  const isStreaming = ref(false)

  async function startStreamChat(options: StreamChatOptions): Promise<void> {
    if (!isNormalMode.value) {
      options.onError?.(new Error('降级模式下无法使用 AI 功能'))
      return
    }

    const provider = settings.value.providers[0]
    const model = provider.models[0]?.name

    if (!provider?.baseUrl || !provider?.apiKey) {
      options.onError?.(new Error('请先在设置中配置 API 信息'))
      return
    }

    if (!model) {
      options.onError?.(new Error('请选择模型'))
      return
    }

    showStreamModal.value = true
    streamingText.value = ''
    reasoningText.value = ''
    isStreaming.value = true

    try {
      await streamChat(provider, model, options.messages, {
        thinking: options.thinking,
        onChunk: (_, full) => {
          streamingText.value = full
        },
        onThinking: (_, full) => {
          reasoningText.value = full
        },
        onFinish: (full) => {
          isStreaming.value = false
          showStreamModal.value = false
          options.onFinish?.(full)
        }
      })
    } catch (error: any) {
      isStreaming.value = false
      showStreamModal.value = false
      options.onError?.(error)
    }
  }

  function closeStreamModal() {
    showStreamModal.value = false
  }

  return {
    showStreamModal,
    streamingText,
    reasoningText,
    isStreaming,
    startStreamChat,
    closeStreamModal
  }
}
```

### 阶段3：修复练习计数

#### 3.1 更新 `src/types/index.ts`

添加练习类型：

```typescript
export interface PracticeRecord {
  id: string  // 新增：唯一标识
  subjectId: string
  topicId: string
  type: 'objective' | 'subjective'  // 新增：区分客观/主观
  count: number
  lastPracticedAt: number
}
```

#### 3.2 更新 `src/composables/usePracticeTracker.ts`

```typescript
function record(subjectId: string, topicId: string, type: 'objective' | 'subjective') {
  const id = `${type}-${subjectId}-${topicId}`  // 使用复合键
  const idx = records.value.findIndex(r => r.id === id)
  if (idx >= 0) {
    records.value[idx].count += 1
    records.value[idx].lastPracticedAt = Date.now()
  } else {
    records.value.push({ 
      id, 
      subjectId, 
      topicId, 
      type, 
      count: 1, 
      lastPracticedAt: Date.now() 
    })
  }
  save(records.value)
}

function getCount(subjectId: string, topicId: string, type: 'objective' | 'subjective'): number {
  const id = `${type}-${subjectId}-${topicId}`
  return records.value.find(r => r.id === id)?.count || 0
}

function getSubjectCount(subjectId: string, type: 'objective' | 'subjective'): number {
  return records.value
    .filter(r => r.subjectId === subjectId && r.type === type)
    .reduce((sum, r) => sum + r.count, 0)
}
```

#### 3.3 更新 `src/composables/usePracticeCount.ts`

修改 `buildSubjectCount` 函数，传入 `type` 参数：

```typescript
function buildSubjectCount(
  subject: Subject,
  type: 'objective' | 'subjective',
  getTopicCount: (subjectId: string, topicId: string, type: 'objective' | 'subjective') => number
): PracticeCountTree {
  const topicCounts = subject.topics.map(topic => ({
    id: topic.id,
    name: topic.name,
    count: getTopicCount(subject.id, topic.id, type)
  }))
  // ...
}
```

#### 3.4 更新视图组件

`ObjectiveView.vue` 和 `SubjectiveView.vue` 调用 `recordPractice` 时传入 `type` 参数。

### 阶段4：完善提示词注入知识库

#### 4.1 更新 `src/composables/usePromptStore.ts`

添加知识库获取函数：

```typescript
import { knowledgeModules } from '@/data/knowledge'

export function getKnowledgeContext(subjectName: string): string {
  const module = knowledgeModules.find(m => m.name === subjectName)
  return module?.content || ''
}

export function buildPromptWithContext(
  promptKey: PromptKey, 
  subjectName: string, 
  topicName: string
): string {
  const basePrompt = getPrompt(promptKey)
  const knowledgeContext = getKnowledgeContext(subjectName)
  
  return basePrompt
    .replace(/\{subject\}/g, subjectName)
    .replace(/\{topic\}/g, topicName)
    .replace(/\{knowledgeContext\}/g, knowledgeContext)
}
```

#### 4.2 更新默认提示词模板

在提示词中添加 `{knowledgeContext}` 占位符：

```typescript
'objective-generate': `你是一位法考命题研究专家。请根据以下科目和考点，生成高质量的法考客观题模拟题。

【科目领域】: {subject}
【核心考点】: {topic}

【相关法考大纲知识】:
{knowledgeContext}

【出题要求】:
...
`
```

### 阶段5：更新 ObjectiveModal 和 SubjectiveModal

#### 5.1 使用新的 `useStreamChatWithModel`

替换原有的 SSE Modal 相关代码：

```typescript
const { 
  showStreamModal, 
  streamingText, 
  reasoningText, 
  startStreamChat 
} = useStreamChatWithModel()

// 移除：showStreamModal, streamingText, reasoningText 的 ref 定义
// 移除：openStreamModal, closeStreamModal 函数
// 移除：watch 滚动逻辑
```

#### 5.2 更新生成题目逻辑

```typescript
async function generateQuestions() {
  // ... 准备 prompt
  
  await startStreamChat({
    messages: [{ role: 'user', content: prompt }],
    onFinish: (full) => {
      // 解析结果
      // 关闭 modal 已在 composable 中处理
    },
    onError: (error) => {
      generateError.value = error.message
    }
  })
}
```

#### 5.3 使用 SseStreamModal 组件

```vue
<template>
  <!-- ... 原有内容 ... -->
  
  <SseStreamModal
    v-model:show="showStreamModal"
    :streaming-text="streamingText"
    :reasoning-text="reasoningText"
  />
</template>
```

---

## 文件变更清单

### 新增文件
1. `src/components/SseStreamModal.vue` — SSE 流式模态框组件
2. `src/composables/useStreamChatWithModel.ts` — 统一流式聊天 composable

### 修改文件
1. `src/types/index.ts` — 添加 `type` 字段到 `PracticeRecord`
2. `src/composables/usePracticeTracker.ts` — 修复计数逻辑，区分客观/主观
3. `src/composables/usePracticeCount.ts` — 更新计数统计逻辑
4. `src/composables/usePromptStore.ts` — 添加知识库上下文注入
5. `src/views/ObjectiveView.vue` — 传入 `type` 参数
6. `src/views/SubjectiveView.vue` — 传入 `type` 参数
7. `src/components/ObjectiveModal.vue` — 使用新 composable 和组件
8. `src/components/SubjectiveModal.vue` — 使用新 composable 和组件

---

## 数据结构变更

### PracticeRecord（修改前）
```typescript
interface PracticeRecord {
  subjectId: string
  topicId: string
  count: number
  lastPracticedAt: number
}
```

### PracticeRecord（修改后）
```typescript
interface PracticeRecord {
  id: string  // 复合键：${type}-${subjectId}-${topicId}
  subjectId: string
  topicId: string
  type: 'objective' | 'subjective'
  count: number
  lastPracticedAt: number
}
```

---

## API 变更

### usePracticeTracker（修改前）
```typescript
record(subjectId: string, topicId: string): void
getCount(subjectId: string, topicId: string): number
getSubjectCount(subjectId: string): number
```

### usePracticeTracker（修改后）
```typescript
record(subjectId: string, topicId: string, type: 'objective' | 'subjective'): void
getCount(subjectId: string, topicId: string, type: 'objective' | 'subjective'): number
getSubjectCount(subjectId: string, type: 'objective' | 'subjective'): number
```

### 新增 useStreamChatWithModel
```typescript
startStreamChat(options: StreamChatOptions): Promise<void>
// 自动管理 showStreamModal, streamingText, reasoningText
```
