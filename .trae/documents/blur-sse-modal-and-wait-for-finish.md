# 计划：SSE 模态框模糊效果 + 出题后显示题目

## 目标

1. 为 `SseStreamModal.vue` 增加 `blur` 参数，使流式输出内容模糊化，防止用户提前看到 AI 生成的答案
2. 调整 `ObjectiveModal.vue` 和 `SubjectiveModal.vue` 的显示逻辑，等待 SSE 完成后才显示题目内容

---

## 当前问题分析

### 问题1：AI 输出内容直接可见
当前 `SseStreamModal.vue` 中的 `.modal-reasoning-content` 和 `.modal-output-content` 以明文显示，用户在出题阶段就能直接看到 AI 生成的题目和答案。

### 问题2：题目模态框和 SSE 模态框同时显示
当前逻辑：
- `ObjectiveModal.vue` / `SubjectiveModal.vue` 的 `show` prop 为 true 时，题目模态框立即显示
- 同时 `generateQuestions()` / `generateQuestion()` 调用 `startStreamChat()`，SSE 模态框也显示
- 两个模态框同时存在，用户可以看到题目模态框中的 loading 状态和 SSE 模态框中的流式输出

---

## 实施步骤

### 阶段1：SseStreamModal 增加 blur 参数

#### 1.1 修改 `src/components/SseStreamModal.vue`

添加 `blur` prop（默认 `false`）：

```vue
<script setup lang="ts">
interface Props {
  show: boolean
  streamingText: string
  reasoningText: string
  blur?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  blur: false
})
</script>
```

在模板中为两个 pre 元素动态绑定模糊类：

```vue
<pre ref="reasoningPreRef" class="modal-reasoning-content" :class="{ 'blur-text': blur }">{{ reasoningText }}</pre>

<pre ref="outputPreRef" class="modal-output-content" :class="{ 'blur-text': blur }">{{ streamingText || '正在等待模型响应...' }}</pre>
```

添加模糊 CSS：

```css
.blur-text {
  filter: blur(4px);
  user-select: none;
  pointer-events: none;
}
```

### 阶段2：调整 useStreamChatWithModel

#### 2.1 修改 `src/composables/useStreamChatWithModel.ts`

在 `StreamChatOptions` 中添加 `blur` 选项：

```typescript
export interface StreamChatOptions {
  messages: ChatMessage[]
  thinking?: boolean
  blur?: boolean
  onFinish?: (fullText: string) => void
  onError?: (error: Error) => void
}
```

在 `startStreamChat` 中暴露 `blur` 状态给调用方（通过 ref 或返回值）。由于组件需要知道是否启用模糊，最简单的方式是让调用方自行管理 `blur` prop。

**方案**：调用方（ObjectiveModal/SubjectiveModal）自己维护一个 `blurStream` ref，传给 `SseStreamModal` 的 `blur` prop。在调用 `startStreamChat` 时设为 `true`，`onFinish` 时不需要关心，因为 SSE 模态框会自动关闭。

### 阶段3：调整 ObjectiveModal 显示逻辑

#### 3.1 修改 `src/components/ObjectiveModal.vue`

**当前逻辑**：
```typescript
watch(() => props.show, (val) => {
  if (val) {
    reset()
    if (isNormalMode.value) {
      generateQuestions()  // 同时显示题目模态框 + SSE 模态框
    }
  }
})
```

**新逻辑**：
```typescript
const blurStream = ref(false)

watch(() => props.show, (val) => {
  if (val) {
    reset()
    if (isNormalMode.value) {
      blurStream.value = true  // 启用模糊
      generateQuestions()      // 只显示 SSE 模态框，题目模态框内容为空
    }
  }
})

async function generateQuestions() {
  if (!isNormalMode.value) return
  generating.value = true  // 控制题目模态框显示 loading
  generateError.value = ''
  singleQuestion.value = null
  multiQuestion.value = null

  const prompt = buildPrompt('objective-generate', props.subjectName, props.topicName)

  try {
    await startStreamChat({
      messages: [{ role: 'user', content: prompt }],
      onFinish: (full) => {
        // SSE 完成后解析题目
        const match = full.match(/\{[\s\S]*\}/)
        if (match) {
          const data = JSON.parse(match[0])
          // ... 设置题目
        }
        generating.value = false  // 题目内容就绪，显示题目
      },
      onError: (error) => {
        generateError.value = `出题失败：${error.message}`
        generating.value = false
      }
    })
  } finally {
    // generating 在 onFinish/onError 中设置，不在 finally 中设置
  }
}
```

**模板调整**：
- 题目模态框始终显示（由父组件通过 `show` prop 控制）
- 但内容区域在 `generating` 为 true 时显示 loading（不显示题目）
- SSE 模态框由 `useStreamChatWithModel` 控制显示
- SSE 完成后，`generating` 设为 false，题目内容显示

**传递 blur**：
```vue
<SseStreamModal
  v-model:show="showStreamModal"
  :streaming-text="streamingText"
  :reasoning-text="reasoningText"
  :blur="blurStream"
/>
```

### 阶段4：调整 SubjectiveModal 显示逻辑

#### 4.1 修改 `src/components/SubjectiveModal.vue`

与 ObjectiveModal 相同的调整：
- 添加 `blurStream` ref
- `watch(() => props.show)` 中启用模糊并调用 `generateQuestion()`
- `generateQuestion()` 中 `generating` 控制 loading 状态
- `onFinish` 中解析题目并设置 `generating = false`
- `SseStreamModal` 传入 `:blur="blurStream"`

### 阶段5：降级模式处理

降级模式下不调用 `startStreamChat`，所以：
- 不需要模糊
- 题目模态框直接显示降级提示（现有行为）

---

## 文件变更清单

### 修改文件
1. `src/components/SseStreamModal.vue` — 添加 `blur` prop 和模糊 CSS
2. `src/components/ObjectiveModal.vue` — 调整显示逻辑，添加 `blurStream`
3. `src/components/SubjectiveModal.vue` — 调整显示逻辑，添加 `blurStream`

---

## 用户体验流程（修改后）

### 正常模式出题：
1. 用户点击考点 → 父组件设置 `show = true`
2. `ObjectiveModal`/`SubjectiveModal` 显示，但内容区域显示 "AI 正在生成题目..."
3. 同时 `SseStreamModal` 显示，内容模糊化，用户只能看到文字形状在变化
4. SSE 完成后，`SseStreamModal` 自动关闭
5. 题目内容解析完成，题目模态框显示题目

### 降级模式：
1. 用户点击考点 → 题目模态框直接显示降级提示（无 SSE）

---

## CSS 模糊效果说明

```css
.blur-text {
  filter: blur(4px);
  user-select: none;
  pointer-events: none;
}
```

- `filter: blur(4px)` — 文字模糊，肉眼难以辨认具体内容，但能看到文字轮廓和长度变化
- `user-select: none` — 防止用户选中复制
- `pointer-events: none` — 防止用户通过右键检查元素获取内容
