# Plan: 错题集持久化 + SSE 流式提示框

## 背景
1. 用户要求将 AI 出题记录和评判记录中**有错题**的部分持久化到 localStorage 作为错题集
2. 新增「错题集」到侧栏菜单，独立页面展示
3. 所有 AI 调用（出题、评判）都需要把 SSE 流式输出渲染到 Modal，避免用户产生长期等待的错觉。复用 `idea_extend/src/views/TopicView.vue#L188-203` 的 SSE 提示框设计

## 目标
1. 创建 `useWrongBook.ts` composable：管理错题集的增删改查，持久化到 localStorage
2. 修改 ObjectiveModal / SubjectiveModal：
   - 评判完成后，若用户答错，自动保存到错题集
   - 所有 AI 调用（出题、评判）都使用 SSE 流式 Modal 展示进度
3. 创建 WrongBookView.vue：错题集独立页面
4. 更新 MainLayout.vue：侧栏菜单新增「错题集」
5. 更新 router/index.ts：新增错题集路由

## 实现步骤

### Step 1: 创建 useWrongBook.ts 错题集管理

**数据结构：**
```typescript
export interface WrongBookItem {
  id: string           // 唯一标识
  type: 'objective' | 'subjective'
  subjectName: string
  topicName: string
  subjectId: string
  topicId: string
  createdAt: number    // 时间戳
  // 客观题特有
  singleQuestion?: ObjectiveQuestion | null
  multiQuestion?: ObjectiveQuestion | null
  singleAnswer?: string | null
  multiAnswer?: string[]
  singleCorrect?: boolean
  multiCorrect?: boolean
  // 主观题特有
  caseText?: string
  questionText?: string
  answer?: string
  // 评判结果
  aiJudgeResult?: string
  isWrong: boolean     // 是否答错（用于筛选）
}
```

**API：**
- `add(item: WrongBookItem)` — 添加错题
- `remove(id: string)` — 删除错题
- `list()` — 获取全部错题列表
- `clear()` — 清空错题集
- `has(id: string)` — 检查是否已存在

**持久化：** localStorage key = `fakao_wrongbook`

### Step 2: 修改 ObjectiveModal.vue — 接入错题集 + SSE 流式 Modal

**错题集保存逻辑：**
- 在 `handleAiJudge` 的 `onFinish` 回调中，判断是否有错题
- 条件：`singleCorrect === false` 或 `multiCorrect === false`
- 若有错题，调用 `add()` 保存到错题集
- 保存内容包括：题目、用户答案、正确答案、AI 评判结果

**SSE 流式 Modal：**
- 复用 TopicView.vue 的 SSE Modal 设计
- 新增状态：`showStreamModal`、`streamingText`、`reasoningText`
- 所有 AI 调用前打开 Modal，流式更新内容，完成后关闭
- `generateQuestions()` 和 `handleAiJudge()` 都需要接入

**注意：** 出题是非流式的 `chat()`，评判是流式的 `streamChat()`。两者都需要展示 SSE Modal：
- 出题：`chat()` 调用前打开 Modal 显示「AI 正在出题...」，拿到结果后关闭
- 评判：`streamChat()` 直接流式更新到 Modal

### Step 3: 修改 SubjectiveModal.vue — 同样接入错题集 + SSE 流式 Modal

**错题集保存逻辑：**
- 主观题没有明确的对错判断，但 AI 评判结果中会指出得分点
- 策略：每次 AI 评判完成后都保存到错题集（主观题默认需要复习）
- 或者：根据 AI 评判结果中的预估分数，低于某个阈值才保存
- **采用方案：每次评判后都保存，由学生在错题集页面自行标记「已掌握」**

**SSE 流式 Modal：**
- 同 ObjectiveModal，出题和评判都接入 SSE Modal

### Step 4: 创建 WrongBookView.vue 错题集页面

**功能：**
- 展示所有错题列表，按时间倒序
- 支持删除单条错题
- 支持清空全部错题
- 客观题展示：题目、用户答案、正确答案、AI 评判摘要
- 主观题展示：案情、问题、用户答案、AI 评判摘要
- 支持按科目/考点筛选

**UI 设计：**
- 使用 n-card 列表展示
- 每条错题可展开查看详情
- 顶部统计：总错题数、客观题数、主观题数

### Step 5: 更新 MainLayout.vue — 新增错题集菜单

**菜单项：**
```typescript
{
  key: '/wrongbook',
  label: '错题集',
  icon: () => h(Book16Regular)  // 或合适的图标
}
```

### Step 6: 更新 router/index.ts

**新增路由：**
```typescript
{
  path: 'wrongbook',
  name: 'WrongBook',
  component: () => import('@/views/WrongBookView.vue'),
  meta: { title: '错题集', index: 5 }
}
```

### Step 7: 更新 types/index.ts

**新增 WrongBookItem 类型**

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/composables/useWrongBook.ts` | 创建 | 错题集管理 composable |
| `src/components/ObjectiveModal.vue` | 修改 | 接入错题集 + SSE Modal |
| `src/components/SubjectiveModal.vue` | 修改 | 接入错题集 + SSE Modal |
| `src/views/WrongBookView.vue` | 创建 | 错题集独立页面 |
| `src/layouts/MainLayout.vue` | 修改 | 新增错题集菜单 |
| `src/router/index.ts` | 修改 | 新增错题集路由 |
| `src/types/index.ts` | 修改 | 新增 WrongBookItem 类型 |

## SSE Modal 设计参考

复用 `TopicView.vue` 的设计：
- 不可关闭（`:mask-closable="false"`，`:closable="false"`）
- 卡片样式 preset="card"
- 宽度 680px，最大高度 80vh
- 分两个区域：「思考过程」（如有）和「模型输出」
- 自动滚动到底部
- 流式更新内容
