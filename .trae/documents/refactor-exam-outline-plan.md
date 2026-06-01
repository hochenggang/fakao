# 法考大纲重构计划

## 目标
重构 `subjects.ts`，将主题从多个独立数组改为统一的树形结构 `ExamOutline`，并实现练习计数功能的层级统计。

## 当前状态分析

### 现有数据结构
- `paper1Subjects`: 卷一科目数组（9个科目）
- `paper2Subjects`: 卷二科目数组（9个科目）
- `subjectiveSubjects`: 主观题科目数组（10个科目，从上面两个数组引用）
- `allSubjects`: 所有科目合并数组

### 现有引用位置
1. `ObjectiveView.vue`: 使用 `paper1Subjects`, `paper2Subjects`
2. `SubjectiveView.vue`: 使用 `subjectiveSubjects`

### 现有练习计数
- `usePracticeTracker.ts`: 简单的扁平记录，没有层级统计

---

## 实施步骤

### 阶段1: 重构数据结构

#### 1.1 更新 `src/types/index.ts`
添加新的类型定义：

```typescript
// 考试大纲树形结构
export interface ExamOutline {
  id: 'fakao-outline'
  name: '法考大纲'
  children: {
    objective: ObjectiveSection
    subjective: SubjectiveSection
  }
}

export interface ObjectiveSection {
  id: 'objective'
  name: '客观题'
  children: {
    paper1: PaperSection  // 卷一
    paper2: PaperSection  // 卷二
  }
}

export interface SubjectiveSection {
  id: 'subjective'
  name: '主观题'
  children: Subject[]    // 主观题科目直接作为子节点
}

export interface PaperSection {
  id: 'paper1' | 'paper2'
  name: string
  children: Subject[]
}

// 保持原有的 Subject 和 Topic 类型不变
```

#### 1.2 重构 `src/data/subjects.ts`
将现有数据重组为树形结构：

```typescript
export const examOutline: ExamOutline = {
  id: 'fakao-outline',
  name: '法考大纲',
  children: {
    objective: {
      id: 'objective',
      name: '客观题',
      children: {
        paper1: {
          id: 'paper1',
          name: '卷一（公法卷）',
          children: [/* 9个科目 */]
        },
        paper2: {
          id: 'paper2',
          name: '卷二（私法卷）',
          children: [/* 9个科目 */]
        }
      }
    },
    subjective: {
      id: 'subjective',
      name: '主观题',
      children: [/* 10个科目，独立定义不引用 */]
    }
  }
}

// 提供便捷的导出，保持向后兼容
export const paper1Subjects = examOutline.children.objective.children.paper1.children
export const paper2Subjects = examOutline.children.objective.children.paper2.children
export const subjectiveSubjects = examOutline.children.subjective.children
export const allSubjects = [...paper1Subjects, ...paper2Subjects]
```

### 阶段2: 创建练习计数对象

#### 2.1 更新 `src/types/index.ts`
添加练习计数相关类型：

```typescript
// 练习计数节点（继承 ExamOutline 结构）
export interface PracticeCountNode {
  id: string
  count: number
  children?: PracticeCountNode[] | Record<string, PracticeCountNode>
}

export interface ExamOutlinePracticeCount {
  id: 'fakao-outline-practice'
  name: '练习统计'
  children: {
    objective: {
      id: 'objective'
      count: number
      children: {
        paper1: PaperPracticeCount
        paper2: PaperPracticeCount
      }
    }
    subjective: {
      id: 'subjective'
      count: number
      children: SubjectPracticeCount[]
    }
  }
}

export interface PaperPracticeCount {
  id: 'paper1' | 'paper2'
  count: number
  children: SubjectPracticeCount[]
}

export interface SubjectPracticeCount {
  id: string
  count: number
  children: TopicPracticeCount[]
}

export interface TopicPracticeCount {
  id: string
  count: number
}
```

#### 2.2 创建 `src/composables/usePracticeCount.ts`
实现层级统计逻辑：

```typescript
// 根据 examOutline 结构生成练习计数对象
// 提供计算属性，父节点自动汇总子节点数量
// 保持与现有 usePracticeTracker 的数据兼容
```

### 阶段3: 更新视图组件

#### 3.1 更新 `ObjectiveView.vue`
- 使用新的数据结构
- 显示层级练习计数（卷级、科目级、考点级）
- 保持现有UI和交互

#### 3.2 更新 `SubjectiveView.vue`
- 使用新的数据结构
- 显示层级练习计数（主观题级、科目级、考点级）

### 阶段4: 添加大纲笔记模块

#### 4.1 更新 `MainLayout.vue`
- 在菜单中添加"大纲笔记"模块（位置：设置之前）
- 路由路径：`/outline-notes`

#### 4.2 创建 `src/views/OutlineNotesView.vue`
- 使用 `n-collapse` 组件
- 第一个 `n-collapse-item`: 展开后渲染 `法考大纲.md`
- 后续18个 `n-collapse-item`: 对应知识库的18个模块

#### 4.3 创建知识库文件
在 `src/data/knowledge/` 目录下创建18个模块的md文件：
- `legal-thought.md` - 习近平法治思想
- `jurisprudence.md` - 法理学
- `constitution.md` - 宪法
- ... 等等

#### 4.4 创建 `src/data/knowledge/index.ts`
导出所有知识库内容：

```typescript
export { default as legalThoughtContent } from './legal-thought.md?raw'
export { default as jurisprudenceContent } from './jurisprudence.md?raw'
// ...
```

#### 4.5 更新路由 `src/router/index.ts`
添加大纲笔记路由：

```typescript
{
  path: 'outline-notes',
  name: 'OutlineNotes',
  component: () => import('@/views/OutlineNotesView.vue'),
  meta: { title: '大纲笔记', index: 5 }
}
```

---

## 文件变更清单

### 修改文件
1. `src/types/index.ts` - 添加新类型
2. `src/data/subjects.ts` - 重构为树形结构
3. `src/views/ObjectiveView.vue` - 使用新数据结构
4. `src/views/SubjectiveView.vue` - 使用新数据结构
5. `src/layouts/MainLayout.vue` - 添加菜单项
6. `src/router/index.ts` - 添加路由

### 新增文件
1. `src/composables/usePracticeCount.ts` - 层级练习计数
2. `src/views/OutlineNotesView.vue` - 大纲笔记页面
3. `src/data/knowledge/` 目录及18个md文件
4. `法考大纲.md` - 根大纲文档

---

## 数据结构对比

### 重构前
```
paper1Subjects: Subject[]
paper2Subjects: Subject[]
subjectiveSubjects: Subject[] (引用上面两个)
allSubjects: Subject[]
```

### 重构后
```
examOutline: ExamOutline
  └── children
       ├── objective: ObjectiveSection
       │    └── children
       │         ├── paper1: PaperSection
       │         │    └── children: Subject[]
       │         └── paper2: PaperSection
       │              └── children: Subject[]
       └── subjective: SubjectiveSection
            └── children: Subject[] (独立定义)

// 便捷导出（向后兼容）
paper1Subjects = examOutline.children.objective.children.paper1.children
paper2Subjects = examOutline.children.objective.children.paper2.children
subjectiveSubjects = examOutline.children.subjective.children
allSubjects = [...paper1Subjects, ...paper2Subjects]
```

---

## 练习计数层级关系

```
法考大纲 (总计)
├── 客观题 (卷一 + 卷二)
│   ├── 卷一 (科目1 + 科目2 + ...)
│   │   ├── 科目1 (考点1 + 考点2 + ...)
│   │   │   ├── 考点1: count
│   │   │   └── 考点2: count
│   │   └── 科目2: ...
│   └── 卷二: ...
└── 主观题 (科目1 + 科目2 + ...)
    ├── 科目1: ...
    └── 科目2: ...
```

父节点的 `count` = 所有子节点 `count` 之和
