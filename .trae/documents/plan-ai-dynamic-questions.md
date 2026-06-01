# Plan: AI 动态出题 + 清理历史遗留题目资源

## 背景
当前 `ObjectiveView.vue` 点击「演练」按钮后，调用 `getQuestionsByTopic()` 从静态 `objectiveQuestions.ts` 中查找题目。若找不到则提示「该考点暂无模拟题目，敬请期待！」——这是错误的。正确行为应该是：**始终调用 AI 动态出题**，不再依赖任何静态题目资源。

同理，`SubjectiveView.vue` 也需要改为 AI 动态出题。

## 目标
1. **ObjectiveView.vue / SubjectiveView.vue**：点击「演练」后，直接打开 Modal 并触发 AI 出题，不再检查静态题目是否存在。
2. **ObjectiveModal.vue / SubjectiveModal.vue**：
   - 移除对静态题目 props 的依赖
   - 新增 AI 动态出题逻辑（流式/非流式），出题完成后渲染题目
   - 保留交卷评判功能（AI 评判或降级复制）
   - 保留「重新出题」功能
3. **清理历史遗留资源**：
   - 删除 `src/data/objectiveQuestions.ts`
   - 删除 `src/data/subjectiveQuestions.ts`
   - 删除 `src/data/prompts.ts`（其功能已被 `usePromptStore.ts` 替代，且降级模式的复制提示词可直接在组件内组装）
   - 从 `src/types/index.ts` 中清理不再需要的类型（如果仅被上述文件使用）

## 实现步骤

### Step 1: 修改 ObjectiveModal.vue — 移除静态题目依赖，改为 AI 动态出题

**变更点：**
- Props 变更：移除 `singleQuestion`、`multiQuestion`，改为接收 `subjectName`、`topicName` 和 `subjectId`、`topicId`（用于出题时标识考点）
- 新增内部状态：`singleQuestion`、`multiQuestion` 改为 `ref<ObjectiveQuestion | null>(null)`，由 AI 动态生成后填充
- 新增 `generating` 状态：表示 AI 正在出题
- `handleOpen` / `watch show`：当 Modal 打开时，自动触发 AI 出题
- AI 出题逻辑：调用 `chat()` 使用 `objective-generate` 提示词，解析返回的 JSON，填充题目数据
- 移除 `generateObjectivePrompt` 的导入（该文件将被删除）
- 降级模式的复制提示词：直接在组件内组装，不再依赖 `data/prompts.ts`

**出题流程：**
1. Modal 打开 → `generating = true`
2. 调用 AI `chat()` 使用 `objective-generate` 提示词
3. 解析 JSON 响应，提取 `single` 和 `multiple` 题目
4. 填充到内部 `singleQuestion` / `multiQuestion` ref
5. `generating = false`

**重新出题：**
- 点击「重新出题」→ 重置答案和提交状态 → 再次触发 AI 出题

### Step 2: 修改 SubjectiveModal.vue — 同样改为 AI 动态出题

**变更点：**
- Props 变更：移除 `question`，改为接收 `subjectName`、`topicName`、`subjectId`、`topicId`
- 新增内部状态：`question` 改为 `ref<SubjectiveQuestion | null>(null)`
- 新增 `generating` 状态
- Modal 打开时自动触发 AI 出题
- 新增 `subjective-generate` 提示词到 `usePromptStore.ts`
- AI 出题返回 JSON 格式：`{ caseText: string, question: string }`
- 降级模式的复制提示词：直接在组件内组装

**新增提示词 `subjective-generate`：**
```
你是一位法考主观题命题研究专家。请根据以下科目和考点，生成高质量的法考主观题模拟案例。

【科目领域】: {subject}
【核心考点】: {topic}

【出题要求】:
- 生成1道主观题案例，包含案情材料和问题
- 案情要贴近法考真题风格，具有实务感和争议性
- 问题要能够考察学生对该考点的深度理解和法律分析能力
- 输出格式必须为以下JSON格式：

{
  "caseText": "案情材料",
  "question": "问题"
}
```

### Step 3: 修改 ObjectiveView.vue

**变更点：**
- 移除 `getQuestionsByTopic` 导入
- 移除 `singleQuestion`、`multiQuestion` ref
- `openModal` 方法：不再查询静态题目，直接设置 `selectedSubject`、`selectedTopic`，打开 Modal
- 移除 `handleCopied`、`handleAiJudged`（如果 Modal 内部已处理）
- Modal props 变更：传递 `subjectId`、`topicId` 而不是题目数据

### Step 4: 修改 SubjectiveView.vue

**变更点：**
- 移除 `getSubjectiveQuestion` 导入
- 移除 `subjectiveQuestion` ref
- `openModal` 方法：直接打开 Modal
- Modal props 变更：传递 `subjectId`、`topicId`

### Step 5: 修改 usePromptStore.ts

**变更点：**
- 新增 `subjective-generate` 默认提示词
- 更新 `PromptKey` 类型（在 types/index.ts 中）

### Step 6: 清理历史遗留文件

**删除文件：**
- `src/data/objectiveQuestions.ts`
- `src/data/subjectiveQuestions.ts`
- `src/data/prompts.ts`

**检查 types/index.ts：**
- `ObjectiveQuestion`、`SubjectiveQuestion` 类型仍被 Modal 组件使用（AI 生成后填充的数据结构），保留
- 确认无其他文件引用上述被删除的文件

### Step 7: 验证

- `vue-tsc -b` 类型检查通过
- `npm run dev` 启动正常
- 浏览器测试：
  - 正常模式：点击「演练」→ AI 出题 → 答题 → AI 评判
  - 降级模式：不显示「演练」按钮（已存在逻辑）
  - 重新出题功能正常

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/components/ObjectiveModal.vue` | 修改 | 移除静态题目 props，改为 AI 动态出题 |
| `src/components/SubjectiveModal.vue` | 修改 | 同上 |
| `src/views/ObjectiveView.vue` | 修改 | 移除静态题目查询逻辑 |
| `src/views/SubjectiveView.vue` | 修改 | 同上 |
| `src/composables/usePromptStore.ts` | 修改 | 新增 `subjective-generate` 提示词 |
| `src/types/index.ts` | 修改 | 更新 `PromptKey` 类型 |
| `src/data/objectiveQuestions.ts` | 删除 | 历史遗留静态题目 |
| `src/data/subjectiveQuestions.ts` | 删除 | 历史遗留静态题目 |
| `src/data/prompts.ts` | 删除 | 功能已被 usePromptStore 替代 |
