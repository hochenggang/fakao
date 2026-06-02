# 实现 OverviewView 科目标签点击跳转

## 0. 现状分析

### OverviewView.vue L105-111 当前代码

```vue
<span
  v-for="subject in paper.subjects"
  :key="subject"
  :class="['subject-tag', paper.tagClass]"
>
  {{ subject }}
</span>
```

`paper.subjects` 当前是**字符串数组**（中文展示名，如 `'法治思想'`、`'法理学'`）。`papers` 数组三张试卷的 ID 分别是 `paper1` / `paper2` / `subjective`，分别对应 `exam1`（客观题卷一）/ `exam2`（客观题卷二）/ `exam3`（主观题）。

### 路由与视图

- [router/index.ts#L5-L42](file:///c:/Users/Administrator/Documents/codes/%E6%98%93%E6%87%82%E6%B3%95%E8%80%83/src/router/index.ts#L5-L42) 路由配置：`/practice` 是 name 为 `Practice` 的路由
- [PracticeView.vue](file:///c:/Users/Administrator/Documents/codes/%E6%98%93%E6%87%82%E6%B3%95%E8%80%83/src/views/PracticeView.vue) 维护 `examId` / `subjectId` / `expandedNames` 三个本地 ref
- `<n-collapse>` 的 `expandedNames` 是数组，元素是科目 `name`（中文名）；`:name="subject.name"` 作为 collapse item 的标识

### 关键数据差异

paper.subjects 展示名 ≠ exams.ts 中 subject.name，例如：
- paper: `'法治思想'` → exam1 subject: `'习近平法治思想'`（subjectId: `legal-thought`）
- paper: `'法理学'` → exam1 subject: `'法理学'`（subjectId: `jurisprudence`）

**所以不能用展示名直接匹配**——必须显式存储 `subjectId` 映射。

---

## 1. 修复设计

### 1.1 数据层：在 `papers` 中补全 `examId` 与 `subjectId`

将 `paper.subjects` 从 `string[]` 升级为 `Array<{ name: string; subjectId: string }>`：

```ts
const papers = [
  {
    id: 'paper1',
    examId: 'exam1' as ExamId,
    badge: '上午场',
    // ...
    subjects: [
      { name: '法治思想', subjectId: 'legal-thought' },
      { name: '法理学', subjectId: 'jurisprudence' },
      { name: '宪法', subjectId: 'constitution' },
      // ... 共 9 个
    ],
  },
  {
    id: 'paper2',
    examId: 'exam2' as ExamId,
    // ... 9 个
  },
  {
    id: 'subjective',
    examId: 'exam3' as ExamId,
    // ... 10 个
  },
]
```

完整映射表（每个 paper 的 9-10 个 subject 都填上 subjectId）：

| paper | subjectId |
|---|---|
| paper1: 法治思想 / 法理学 / 宪法 / 中国法律史 / 国际法 / 司法制度和法律职业道德 / 刑法 / 刑事诉讼法 / 行政法与行政诉讼法 | legal-thought / jurisprudence / constitution / legal-history / international-law / judicial-ethics / criminal-law / criminal-procedure / administrative-law |
| paper2: 民法 / 知识产权法 / 商法 / 经济法 / 环境资源法 / 劳动与社会保障法 / 国际私法 / 国际经济法 / 民事诉讼法（含仲裁制度） | civil-law / ip-law / commercial-law / economic-law / environment-law / labor-law / private-intl-law / intl-economic-law / civil-procedure |
| subjective: 法治思想 / 法理学 / 宪法 / 刑法 / 刑事诉讼法 / 民法 / 商法 / 民事诉讼法（含仲裁制度） / 行政法与行政诉讼法 / 司法制度和法律职业道德 | legal-thought / jurisprudence / constitution / criminal-law / criminal-procedure / civil-law / commercial-law / civil-procedure / administrative-law / judicial-ethics |

### 1.2 OverviewView 点击跳转

新增脚本逻辑：

```ts
import { useRouter } from 'vue-router'
import type { ExamId } from '@/types/exam'

const router = useRouter()

function goToPractice(examId: ExamId, subjectId: string) {
  router.push({ path: '/practice', query: { examId, subjectId } })
}
```

模板点击事件绑定：

```vue
<span
  v-for="subject in paper.subjects"
  :key="subject.subjectId"
  :class="['subject-tag', paper.tagClass, 'subject-tag-clickable']"
  @click="goToPractice(paper.examId, subject.subjectId)"
>
  {{ subject.name }}
</span>
```

样式（让用户感知"可点击"）：

```css
.subject-tag-clickable {
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}
.subject-tag-clickable:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
}
.subject-tag-clickable:active {
  transform: translateY(0);
}
```

### 1.3 PracticeView 读取 query 并应用

新增脚本逻辑：

```ts
import { useRoute, watch } from 'vue-router'
import { EXAM_IDS } from '@/types/exam'

const route = useRoute()

function applyRouteQuery() {
  const q = route.query
  const newExamId =
    typeof q.examId === 'string' && (EXAM_IDS as readonly string[]).includes(q.examId)
      ? (q.examId as ExamId)
      : null
  const newSubjectId = typeof q.subjectId === 'string' ? q.subjectId : null

  if (newExamId && newExamId !== examId.value) {
    examId.value = newExamId
    switchExamScope()
  }

  if (newSubjectId) {
    subjectId.value = newSubjectId
    const subject = examById(examId.value)?.subjects.find(s => s.id === newSubjectId)
    if (subject && !expandedNames.value.includes(subject.name)) {
      expandedNames.value = [...expandedNames.value, subject.name]
    }
  }
}

onMounted(() => {
  expandedNames.value = []
  applyRouteQuery()
})

watch(() => route.query, applyRouteQuery)
```

**关键点**：
- `watch(() => route.query, ...)` 处理"用户已停留在 /practice，从概览页又点了另一个标签"的场景——query 变化触发重新应用。
- `applyRouteQuery` 内**先**判断 `examId` 变化再处理 `subjectId`，避免先设置 `subjectId` 后被 `switchExamScope()` 重置。
- 通过 `EXAM_IDS` 校验确保恶意/脏 query 不会破坏 `examId` 类型。
- 找不到 `subject`（无效 subjectId）时**不抛错**——静默忽略，保持页面可用性。

### 1.4 行为契约

| 触发 | 结果 |
|---|---|
| 在概览页点击"法治思想"标签 | 路由跳转到 `/practice?examId=exam1&subjectId=legal-thought`；PracticeView 切换到 exam1，subjectId 筛选项设为 `legal-thought`，对应 collapse 展开 |
| 已在 /practice，再次点击概览页标签 | 路由 query 变化，watch 触发 applyRouteQuery，页面状态正确更新 |
| 直接访问 `/practice?examId=exam2&subjectId=civil-law` | onMounted 读取 query 并应用 |
| 访问非法 query 如 `/practice?examId=foo` | examId 校验失败，保留当前值；不抛错 |

---

## 2. 改动文件清单

| 文件 | 关键变更 |
|---|---|
| `src/views/OverviewView.vue` | `papers` 数据中 `subjects` 由 `string[]` 升级为 `Array<{name, subjectId}>`，新增 `examId` 字段；模板绑定 `@click="goToPractice(paper.examId, subject.subjectId)"`；新增 `goToPractice` 函数；新增 hover/active 样式 |
| `src/views/PracticeView.vue` | 新增 `useRoute` / `watch(route.query)` / `applyRouteQuery` 逻辑；onMounted 末尾调用 `applyRouteQuery()` |

---

## 3. 实施步骤（按顺序）

### Step 1：升级 `papers` 数据结构
- 文件：`src/views/OverviewView.vue#L1-L40`
- 为每张 paper 新增 `examId: ExamId` 字段（需 `import type { ExamId } from '@/types/exam'`）
- 将每张 paper 的 `subjects` 从 `string[]` 改为 `Array<{ name: string; subjectId: string }>`
- 验证：渲染不变（subject.name 替换原字符串）

### Step 2：实现点击跳转逻辑
- 文件：`src/views/OverviewView.vue`
- 新增 `import { useRouter } from 'vue-router'`
- 新增 `const router = useRouter()` 和 `goToPractice` 函数
- 模板上 `<span>` 增加 `@click="goToPractice(paper.examId, subject.subjectId)"` 和 `subject-tag-clickable` class
- 新增对应 CSS：cursor/hover/active 视觉反馈
- 验证：点击任一标签，控制台打印路由跳转日志

### Step 3：PracticeView 读取 query
- 文件：`src/views/PracticeView.vue`
- 新增 `import { useRoute, watch } from 'vue-router'`
- 新增 `import { EXAM_IDS } from '@/types/exam'`（若未导入）
- 新增 `const route = useRoute()` 和 `applyRouteQuery` 函数
- 在 `onMounted` 末尾追加 `applyRouteQuery()`
- 新增 `watch(() => route.query, applyRouteQuery)`
- 验证：手动访问 `/practice?examId=exam2&subjectId=civil-law`，页面正确显示民法并展开

### Step 4：类型检查与构建
- 运行 `npm run check` 与 `npm run build`
- 验证：exit code 0，无类型错误

---

## 4. 验证步骤

1. **点击跳转**：
   - 在概览页点击"民法"标签 → 跳转到 `/practice?examId=exam2&subjectId=civil-law`，页面显示"民法"collapse 展开
2. **跨 examId 切换**：
   - 在 exam2 页面下，点击概览页"法治思想" → 跳转到 exam1，"习近平法治思想"collapse 展开
3. **query 重复应用**：
   - 已在 /practice，点击概览页另一个标签 → 页面状态正确更新（不卡顿、不报错）
4. **无效 query 容错**：
   - 直接访问 `/practice?examId=invalid` → 保留默认 examId，不抛错
5. **类型 & build**：`npm run check` 0 错误；`npm run build` 成功

---

## 5. 优雅性自检

- **数据显式优于隐式**：`subjects` 从 `string[]` 升级为对象数组，让"展示名"和"导航 ID"两件事在数据层就清晰分离，避免模糊匹配带来的脆弱性。
- **路由作为唯一真相源**：query 是组件间通信的契约，PracticeView 是 query 的"消费者"——单向数据流，组件内部状态从外部驱动。
- **watch route.query 而非 examId**：保留 PracticeView 内部交互（n-select 改 examId 不污染 URL），同时支持外部跳转，符合"用户操作不写 URL、外部跳转写 URL"的常规模式。
- **onMounted + watch 双触发**：直接访问 URL 与 SPA 内部跳转都能命中。
- **零硬编码跳转目标**：所有跳转都通过 `router.push({path, query})` 走 vue-router，不破坏路由 history（用户可后退）。
