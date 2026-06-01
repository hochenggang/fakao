# 重构计划：subjects.ts 与新增大纲笔记模块

## 一、需求概述

1. **重构 `src/data/subjects.ts`**：依照 `知识库/法考大纲.md` 完全对应，构建一颗独立的大树结构，不再相互依赖。
2. **新增"大纲笔记"模块**：在 `MainLayout.vue` 导航中新增入口，创建 `OutlineView.vue`，以折叠列表形式展示法考大纲及18个知识库模块内容。

---

## 二、现有问题分析

### 2.1 subjects.ts 当前结构
- `paper1Subjects`：9个科目（卷一）
- `paper2Subjects`：9个科目（卷二）
- `subjectiveSubjects`：通过 `find()` 从 paper1/paper2 中抽取，存在相互依赖
- `allSubjects`：简单合并

### 2.2 与大纲的差异
当前 `subjects.ts` 中的 `topics` 仅为简化的3-4个高频考点，与大纲章节结构**不完全对应**。用户要求依照大纲完全对应。

### 2.3 类型定义
`types/index.ts` 中 `Subject` 和 `Topic` 接口需要扩展以支持新的树形结构。

---

## 三、新数据结构设计方案

### 3.1 类型扩展（types/index.ts）

```typescript
export interface OutlineNode {
  id: string
  name: string
  description?: string
  children?: OutlineNode[]
}

export interface ExamSubject {
  id: string
  name: string
  icon: string
  paper: 'paper1' | 'paper2' | 'both'
  hasSubjective: boolean
  outline: OutlineNode[]
}

export interface ExamPaper {
  id: 'paper1' | 'paper2' | 'subjective'
  name: string
  subjects: ExamSubject[]
}

export interface ExamOutline {
  objective: {
    paper1: ExamPaper
    paper2: ExamPaper
  }
  subjective: ExamPaper
}
```

### 3.2 subjects.ts 新结构

```typescript
export const examOutline: ExamOutline = {
  objective: {
    paper1: {
      id: 'paper1',
      name: '客观题 · 试卷一（公法卷）',
      subjects: [ /* 9个科目，每个含完整大纲章节树 */ ]
    },
    paper2: {
      id: 'paper2',
      name: '客观题 · 试卷二（私法卷）',
      subjects: [ /* 9个科目，每个含完整大纲章节树 */ ]
    }
  },
  subjective: {
    id: 'subjective',
    name: '主观题',
    subjects: [ /* 10个科目，独立定义，不依赖客观题 */ ]
  }
}
```

### 3.3 向后兼容
保留 `paper1Subjects`、`paper2Subjects`、`subjectiveSubjects`、`allSubjects` 作为兼容导出，但从新结构映射生成，消除相互依赖。

---

## 四、大纲章节数据整理

### 4.1 卷一（9科）

| # | 科目 | 大纲章节数 |
|---|------|-----------|
| 1 | 习近平法治思想 | 3章 |
| 2 | 法理学 | 4章 |
| 3 | 宪法 | 6章+附录 |
| 4 | 中国法律史 | 6章 |
| 5 | 国际法 | 8章+附录 |
| 6 | 司法制度和法律职业道德 | 6章+附录 |
| 7 | 刑法 | 上编13章+下编11章+附录 |
| 8 | 刑事诉讼法 | 三编25章+附录 |
| 9 | 行政法与行政诉讼法 | 四编23章+附录 |

### 4.2 卷二（9科）

| # | 科目 | 大纲章节数 |
|---|------|-----------|
| 1 | 民法 | 七编35章+附录 |
| 2 | 知识产权法 | 4章+附录 |
| 3 | 商法 | 10章+附录 |
| 4 | 经济法 | 5章 |
| 5 | 环境资源法 | 2章 |
| 6 | 劳动与社会保障法 | 2章 |
| 7 | 国际私法 | 7章+附录 |
| 8 | 国际经济法 | 7章+附录 |
| 9 | 民事诉讼法与仲裁制度 | 五编28章+附录 |

### 4.3 主观题（10科）
独立定义：法治思想、法理学、宪法、刑法、刑事诉讼法、民法、商法、民事诉讼法与仲裁制度、行政法与行政诉讼法、司法制度和法律职业道德。

---

## 五、实施步骤

### Step 1: 扩展类型定义（types/index.ts）
- 添加 `OutlineNode`、`ExamSubject`、`ExamPaper`、`ExamOutline` 接口
- 保留现有 `Subject`/`Topic` 接口以兼容旧代码

### Step 2: 重构 subjects.ts
- 按大纲构建 `examOutline` 大树
- 每个科目包含完整的 `outline: OutlineNode[]`
- 提供兼容层：`paper1Subjects`、`paper2Subjects`、`subjectiveSubjects`、`allSubjects`
- 消除 `subjectiveSubjects` 对 paper1/paper2 的 `find()` 依赖

### Step 3: 更新 MainLayout.vue
- 在 `menuOptions` 中新增 `/outline` 路由项
- 使用 `DocumentText` 或类似图标
- 放置在"如何考？"之后或"错题集"之前

### Step 4: 创建 OutlineView.vue
- 使用 `n-collapse` + `n-collapse-item`
- 第一个 item："法考大纲总览"，展开后渲染 `法考大纲.md` 内容（或提取的关键信息）
- 后续18个 item：对应18个知识库模块
- 每个模块 item 内部用嵌套结构展示章节树
- 支持通过 `examOutline` 数据驱动渲染

### Step 5: 配置路由（router/index.ts）
- 添加 `/outline` 路由
- 指向 `OutlineView.vue`
- 设置 meta 信息

### Step 6: 验证与测试
- 检查 TypeScript 类型兼容性
- 检查所有引用 `subjects.ts` 的文件是否正常工作
- 运行 dev server 验证页面渲染

---

## 六、文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/types/index.ts` | 修改 | 添加新类型接口 |
| `src/data/subjects.ts` | 重写 | 大树结构 + 兼容层 |
| `src/layouts/MainLayout.vue` | 修改 | 新增导航项 |
| `src/views/OutlineView.vue` | 新建 | 大纲笔记页面 |
| `src/router/index.ts` | 修改 | 新增路由 |

---

## 七、兼容性说明

- `ObjectiveView.vue` 使用 `paper1Subjects`/`paper2Subjects` → 由兼容层提供
- `SubjectiveView.vue` 使用 `subjectiveSubjects` → 由兼容层提供
- 兼容层将新结构的 `ExamSubject` 映射为旧的 `Subject` 格式（`topics` 从 `outline` 扁平化或取关键节点）
- 或者更新视图直接消费新结构（推荐，但工作量大）

**决策**：先保持兼容层，让旧视图不改动即可工作；新视图 `OutlineView.vue` 直接消费新结构。
