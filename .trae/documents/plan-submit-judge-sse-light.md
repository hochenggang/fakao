# Plan: 提交/评判按钮拆分 + SSE 流式调用 + 淡色 SSE 弹窗

## 背景
1. **ObjectiveModal.vue** 的「交卷判定」按钮需要拆分为两步：先「提交」显示对错，再「AI 评判」请求 AI 深度分析
2. 当前 `generateQuestions()` 使用的是非流式的 `chat()`，需要改为 SSE 流式调用 `streamChat()`
3. SSE 提示弹窗当前是深色风格（黑色背景），需要改为淡色风格

## 目标
1. **ObjectiveModal.vue**：拆分提交/评判按钮，提交后显示对错结果，再显示 AI 评判按钮
2. **ObjectiveModal.vue + SubjectiveModal.vue**：`generateQuestions()` 改为使用 `streamChat()` 流式调用
3. **SSE 弹窗样式**：从深色改为淡色风格

## 实现步骤

### Step 1: ObjectiveModal.vue — 拆分提交/评判按钮

**当前逻辑：**
- `handleSubmit()` → `submitted = true` → 直接调用 `handleAiJudge()`

**新逻辑：**
- 新增状态 `showCorrectness`（是否已显示对错结果）
- 新增 `handleCheck()` 方法：只标记 `submitted = true`，显示对错结果，不调用 AI
- `handleSubmit()` 改名为 `handleCheck()` 或保留但只负责提交
- 提交后按钮变为「AI 深度评判」，点击后才调用 `handleAiJudge()`

**按钮状态流转：**
1. 未提交：显示「提交答案」按钮
2. 已提交（showCorrectness=true）：显示对错结果 + 「AI 深度评判」按钮
3. AI 评判中：显示 loading
4. AI 评判完成：显示重新出题 + 关闭

**UI 变更：**
- 提交后，在题目下方显示对错结果（用 n-alert 绿色/红色）
- 对错结果始终显示（不依赖 isNormalMode），因为题目自带 correctAnswer
- AI 评判按钮只在正常模式显示

### Step 2: ObjectiveModal.vue — generateQuestions 改为 SSE 流式

**当前：** `await chat(provider, model!, ...)` 非流式
**改为：** `await streamChat(provider, model!, ..., { onChunk, onFinish })`
- 打开 SSE Modal
- 流式接收 AI 返回的 JSON
- 在 onFinish 中解析 JSON 填充题目

### Step 3: SubjectiveModal.vue — generateQuestion 改为 SSE 流式

**同上**，`chat()` 改为 `streamChat()`

### Step 4: SSE 弹窗改为淡色风格

**当前深色样式：**
- `.modal-output-content`: background: #0f172a (深色), color: #e2e8f0 (白色)

**改为淡色：**
- `.modal-output-content`: background: #f8fafc (浅灰), color: #334155 (深灰文字)
- `.modal-reasoning-content`: background: #fff (白色), color: #475569
- 整体 Modal 背景保持白色卡片风格
- 移除深色代码块风格，改为浅色

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/components/ObjectiveModal.vue` | 修改 | 拆分按钮 + generateQuestions 改为 SSE + 淡色弹窗样式 |
| `src/components/SubjectiveModal.vue` | 修改 | generateQuestion 改为 SSE + 淡色弹窗样式 |

## 详细代码变更

### ObjectiveModal.vue 按钮拆分

```vue
<!-- 提交前 -->
<n-button v-if="!submitted" type="primary" size="large" @click="handleCheck">
  提交答案
</n-button>

<!-- 提交后显示对错 -->
<n-alert v-if="submitted" :type="allCorrect ? 'success' : 'error'" style="margin: 16px 0">
  <template #title>
    {{ allCorrect ? '全部答对！' : '有错题，请查看下方解析' }}
  </template>
</n-alert>

<!-- 提交后显示 AI 评判按钮 -->
<n-button v-if="submitted && isNormalMode && !aiJudging && !aiResult" type="primary" size="large" @click="handleAiJudge">
  AI 深度评判
</n-button>
```

### generateQuestions 改为 SSE

```typescript
openStreamModal()
streamingText.value = ''

try {
  await streamChat(provider, model!, [{ role: 'user', content: prompt }], {
    onChunk(_, full) {
      streamingText.value = full
    },
    onFinish(full) {
      const match = full.match(/\{[\s\S]*\}/)
      if (match) {
        const data = JSON.parse(match[0])
        // 填充题目...
      }
      closeStreamModal()
    },
  })
} catch (e: any) {
  generateError.value = `出题失败：${e.message}`
  closeStreamModal()
} finally {
  generating.value = false
}
```

### 淡色 SSE 弹窗样式

```css
.modal-output-content {
  background: #f8fafc;
  color: #334155;
  border: 1px solid #e2e8f0;
}

.modal-reasoning-content {
  background: #fff;
  color: #475569;
  border: 1px solid #e2e8f0;
}
```
