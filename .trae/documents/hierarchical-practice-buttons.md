# 计划：层级刷题按钮

## 目标

为每一级（卷级、科目级、考点级）都添加"刷题"按钮，越高级的层级出题范围越广。将现有的"演练"按钮改名为"刷题"。且 hover刷题按钮 时对应行的文字设为按钮颜色。

---

## 当前状态

### ObjectiveView.vue / SubjectiveView.vue
- 只有最底层（考点/Topic）有"演练"按钮
- 卷级和科目级只有练习计数 tag，没有刷题按钮

### ObjectiveModal.vue / SubjectiveModal.vue
- 接收 `subjectId`, `subjectName`, `topicId`, `topicName`
- 提示词中 `{topic}` 是单个考点名称
- 需要扩展为支持范围出题（如"民法全部考点"）

---

## 实施步骤

### 阶段1：扩展 Modal 组件支持范围出题

#### 1.1 修改 ObjectiveModal.vue

新增 `scope` prop，表示出题范围：

```typescript
interface Props {
  show: boolean
  subjectId: string
  subjectName: string
  topicId: string
  topicName: string
  scope: 'topic' | 'subject' | 'paper'  // 新增
}
```

修改 `generateQuestions`：
- `scope === 'topic'`：现有行为，针对单个考点出题
- `scope === 'subject'`：针对科目全部考点出题（题目涵盖多个考点）
- `scope === 'paper'`：针对整卷全部科目出题（题目涵盖多个科目）

修改提示词构建逻辑：
- `topic` 范围：现有提示词
- `subject` 范围：修改提示词为"请根据以下科目生成题目，题目可以涵盖该科目的任意考点"
- `paper` 范围：修改提示词为"请根据以下试卷范围生成题目，题目可以涵盖该试卷任意科目的任意考点"

#### 1.2 修改 SubjectiveModal.vue

与 ObjectiveModal 相同的 `scope` prop 和逻辑调整。

### 阶段2：修改视图组件添加刷题按钮

#### 2.1 ObjectiveView.vue

**卷级刷题**（标题栏旁）：
```vue
<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px">
  <h1>...</h1>
  <n-space>
    <n-tag v-if="paperTotalCount > 0">...</n-tag>
    <n-button v-if="isNormalMode" size="small" type="primary" @click="openPaperModal">
      <template #icon><Edit16Regular /></template>
      刷题
    </n-button>
  </n-space>
</div>
```

**科目级刷题**（n-collapse-item header-extra）：
```vue
<template #header-extra>
  <n-space>
    <n-tag v-if="getSubjectCount(...) > 0">...</n-tag>
    <n-button v-if="isNormalMode" size="tiny" dashed type="info" @click.stop="openSubjectModal(subject)">
      <template #icon><Edit16Regular /></template>
      刷题
    </n-button>
    <n-tag size="small">{{ subject.topics.length }} 个考点</n-tag>
  </n-space>
</template>
```

**考点级刷题**（将"演练"改为"刷题"，保持不变）。

新增状态管理：
```typescript
const selectedScope = ref<'topic' | 'subject' | 'paper'>('topic')

const openTopicModal = (subject: Subject, topic: Topic) => {
  selectedSubject.value = subject
  selectedTopic.value = topic
  selectedScope.value = 'topic'
  recordPractice(subject.id, topic.id, 'objective')
  showModal.value = true
}

const openSubjectModal = (subject: Subject) => {
  selectedSubject.value = subject
  selectedTopic.value = subject.topics[0]  // 默认取第一个考点作为标识
  selectedScope.value = 'subject'
  // 记录练习：subject 级练习记录到每个考点
  subject.topics.forEach(t => recordPractice(subject.id, t.id, 'objective'))
  showModal.value = true
}

const openPaperModal = () => {
  const firstSubject = subjects.value[0]
  selectedSubject.value = firstSubject
  selectedTopic.value = firstSubject.topics[0]
  selectedScope.value = 'paper'
  // 记录练习：paper 级练习记录到所有科目的所有考点
  subjects.value.forEach(s => s.topics.forEach(t => recordPractice(s.id, t.id, 'objective')))
  showModal.value = true
}
```

传递 scope 到 Modal：
```vue
<ObjectiveModal
  v-model:show="showModal"
  :subject-id="selectedSubject?.id || ''"
  :subject-name="selectedSubject?.name || ''"
  :topic-id="selectedTopic?.id || ''"
  :topic-name="selectedTopic?.name || ''"
  :scope="selectedScope"
/>
```

#### 2.2 SubjectiveView.vue

与 ObjectiveView 相同的调整：
- 主观题总标题旁添加"刷题"按钮（scope='subjective'）
- 每个科目 header-extra 添加"刷题"按钮（scope='subject'）
- 考点级"演练"改为"刷题"

### 阶段3：扩展提示词支持范围出题

#### 3.1 修改 usePromptStore.ts

添加新的提示词模板：

```typescript
'objective-generate-subject': `你是一位法考命题研究专家。请根据以下科目生成高质量的法考客观题模拟题。

【科目领域】: {subject}
【涵盖考点】: {topicList}

【相关法考大纲知识】:
{knowledgeContext}

【出题要求】:
- 生成1道单选题和1道多选题
- 题目可以涵盖该科目的任意考点，不限于单一考点
- ...`,

'objective-generate-paper': `你是一位法考命题研究专家。请根据以下试卷范围生成高质量的法考客观题模拟题。

【试卷范围】: {paperName}
【涵盖科目】: {subjectList}

【出题要求】:
- 生成1道单选题和1道多选题
- 题目可以涵盖该试卷任意科目的任意考点
- ...`,

'subjective-generate-subject': `...`,
'subjective-generate-paper': `...`
```

修改 `buildPrompt` 支持 `scope` 参数：

```typescript
export function buildPrompt(
  key: PromptKey,
  subjectName: string,
  topicName: string,
  scope: 'topic' | 'subject' | 'paper' = 'topic',
  extraReplacements: Record<string, string> = {}
): string {
  const promptKey = scope === 'topic' ? key : `${key}-${scope}` as PromptKey
  const basePrompt = getPrompt(promptKey)
  // ...
}
```

### 阶段4：练习计数处理

范围刷题时，练习计数需要记录到所有涉及的考点：

- `topic` 范围：记录到该考点（现有行为）
- `subject` 范围：记录到该科目下的所有考点
- `paper` 范围：记录到该卷下所有科目的所有考点

已在阶段2的 `openSubjectModal` 和 `openPaperModal` 中通过循环调用 `recordPractice` 实现。

---

## 文件变更清单

### 修改文件
1. `src/types/index.ts` — 如有需要添加 scope 相关类型
2. `src/components/ObjectiveModal.vue` — 添加 scope prop，调整出题逻辑
3. `src/components/SubjectiveModal.vue` — 添加 scope prop，调整出题逻辑
4. `src/views/ObjectiveView.vue` — 添加卷级/科目级刷题按钮
5. `src/views/SubjectiveView.vue` — 添加总级/科目级刷题按钮
6. `src/composables/usePromptStore.ts` — 添加范围出题提示词

---

## 用户体验

### 客观题页面
```
客观题 · 卷一（公法卷）                    [本卷已练习 X 题] [刷题]
├── 习近平法治思想                         [已练习 X 题] [刷题] [3个考点]
│   ├── 法治思想的形成发展                  [已练习 X 题] [刷题]
│   ├── 核心要义                           [已练习 X 题] [刷题]
│   └── 实践要求                           [已练习 X 题] [刷题]
├── 法理学                                [已练习 X 题] [刷题] [3个考点]
│   └── ...
```

### 主观题页面
```
主观题案例演练                             [已练习 X 题] [刷题]
├── 习近平法治思想                         [已练习 X 题] [刷题] [3个考点]
│   ├── 法治思想的形成发展                  [已练习 X 题] [刷题]
│   ├── 核心要义                           [已练习 X 题] [刷题]
│   └── 实践要求                           [已练习 X 题] [刷题]
```
