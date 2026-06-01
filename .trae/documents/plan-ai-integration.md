# 易懂法考 - AI 大语言模型集成与界面优化计划

## 一、需求总览

参考 `idea_extend` 项目架构，引入内置大语言模型（LLM）支持，实现正常运行/降级运行双模式，同时优化全局鸟瞰页排版并移除 AppHeader。

## 二、具体任务分解

### 任务 1：复用 idea_extend 的 AI 基础设施

**1.1 类型定义扩展 (`src/types/index.ts`)**
- 从 idea_extend 引入 `ModelConfig`、`ProviderConfig`、`Settings`、`ChatMessage`、`StreamCallbacks`
- 新增 `PromptKey` 类型（法考专用提示词：objective-judge, subjective-judge, objective-generate）

**1.2 设置管理 Composable (`src/composables/useSettings.ts`)**
- 直接复用 idea_extend 的 `useSettings.ts` 实现
- localStorage key 改为 `fakao_settings`
- 提供 `settings`, `addProvider`, `removeProvider`, `addModel`, `removeModel`

**1.3 AI 调用服务 (`src/composables/useAiCall.ts`)**
- 直接复用 idea_extend 的 `useAiCall.ts` 实现
- 包含 `chat()` 非流式请求和 `streamChat()` SSE 流式请求
- 包含 `validate()`, `getUrl()`, `buildBody()`, `prependSystem()`

**1.4 提示词存储 (`src/composables/usePromptStore.ts`)**
- 复用架构，但替换为法考专用默认提示词：
  - `system`: 法考辅导名师角色设定
  - `objective-judge`: 客观题错因剖析 + 思维提升提示词
  - `subjective-judge`: 主观题阅卷点评提示词
  - `objective-generate`: 动态出题提示词（根据科目考点生成新的单选/多选题目）
- localStorage key 改为 `fakao_prompts`

**1.5 运行模式检测 Composable (`src/composables/useRuntimeMode.ts`)**
- 新增 composable，检测是否配置了有效的 LLM
- 逻辑：检查 `settings.providers` 中至少有一个 provider 的 `baseUrl` 和 `apiKey` 非空，且至少有一个 model 的 `name` 非空
- 返回 `{ isNormalMode: boolean, isDegradedMode: boolean }`
- 降级运行时全局可用

### 任务 2：新增设置页面 (`src/views/SettingsView.vue`)

- 直接复用 idea_extend 的 `SettingsView.vue` 布局与交互模式
- 标签页 1：模型设置（供应商配置：名称、Base URL、API Key、模型列表）
- 标签页 2：提示词设置（系统提示词、客观题评判、主观题评判、动态出题）
- 路由：`/settings`
- 侧边栏菜单新增"设置"入口

### 任务 3：移除 AppHeader，改为侧边栏菜单导航

**3.1 修改 `src/layouts/MainLayout.vue`**
- 移除 `<AppHeader>` 组件引用和导入
- 侧边栏菜单从 4 项扩展为 5 项（新增"设置"）
- 菜单项点击直接路由跳转，不再依赖 AppHeader 的上一页/下一页
- 移除 `usePageNavigation` 的引用（或保留但不再用于头部导航）

**3.2 删除 `src/components/AppHeader.vue`**
- 该组件不再使用

**3.3 修改 `src/composables/usePageNavigation.ts`**
- 保留 `pages` 数组和 `currentPage` computed，用于页面标题展示（如有需要）
- 移除 `canGoPrev`, `canGoNext`, `goPrev`, `goNext`（或保留但不使用）

### 任务 4：优化全局鸟瞰页 (`src/views/OverviewView.vue`)

- 完全复用 `overview-demo.html` 的排版设计
- 转换为 Vue + naive-ui 组件实现：
  - 标题区：带蓝色竖条的"第一页：法考，究竟怎么考？"
  - 双核卡片：左侧蓝渐变（客观题），右侧琥珀渐变（主观题），带大字水印"客"/"主"
  - 考试时间表格：白色卡片包裹，三段式布局（上午场/下午场/独立阶段），每段左侧标签+标题+时间，右侧题型分值+科目标签网格
  - 主观题段使用 amber 主题色区分

### 任务 5：客观题模态框 - 双模式交卷评判 (`src/components/ObjectiveModal.vue`)

**5.1 正常运行模式**
- 点击"交卷判定"后，调用 `useAiCall().chat()` 或 `streamChat()`
- 构建评判提示词：包含科目、考点、单/多选题干、学生答案、正确答案
- 提示词要求 AI 不仅指出对错，还要：
  - 拆解干扰项陷阱（偷换概念、脑补情节）
  - 给出思维提升建议（如何快速识别同类陷阱）
  - 总结秒杀口诀
  - 补充相关易混淆知识点
- 使用 `n-modal` 或 `n-spin` 展示加载状态
- AI 返回结果直接渲染在模态框内（Markdown 渲染）
- 显示"重新出题"按钮（正常运行时才显示）

**5.2 降级运行模式**
- 点击"交卷判定"后，执行本地判卷逻辑（保留现有红绿判定）
- 显示"为我评判"按钮，点击后复制 AI 提示词到剪贴板
- 弹出 Toast："客观题错因剖析提示词已复制！请前往'豆包'或'DeepSeek'粘贴（Ctrl+V），AI 将为您深度复盘选项陷阱。"
- 同时 Toast 中提示："配置内置 AI 模型可获得连贯的自动评判体验"
- 自动关闭模态框

**5.3 动态出题（仅正常运行）**
- 在考点列表中，正常运行时才显示"演练"按钮
- 降级运行时不显示演练按钮（或显示为禁用状态并提示配置 AI）
- 点击"重新出题"时，调用 AI 根据科目和考点动态生成新的单选/多选题
- 使用 `objective-generate` 提示词模板

### 任务 6：主观题模态框 - 双模式复制考卷 (`src/components/SubjectiveModal.vue`)

**6.1 正常运行模式**
- 点击"复制考卷"后，调用 `useAiCall().chat()` 发送案情+学生作答
- 使用流式输出展示 AI 阅卷过程（思考过程 + 评分结果）
- AI 返回：得分点分析、预估分数、答题规范点评、改进建议、知识延伸
- 结果直接渲染在模态框下方或新弹窗中

**6.2 降级运行模式**
- 点击"复制考卷"后，将主观题提示词复制到剪贴板
- 弹出 Toast："主观题答卷与评分提示词复制成功！请立即在'DeepSeek'或'豆包'中粘贴发送，AI 将以阅卷组专家标准为你出具判卷报告。"
- 同时提示配置 AI 获得连贯体验
- 自动关闭模态框

### 任务 7：客观题/主观题演练页 - 条件显示演练按钮

**7.1 修改 `src/views/ObjectiveView.vue`**
- 注入 `useRuntimeMode()` 获取运行模式
- 考点卡片上的"演练"按钮仅在 `isNormalMode` 时显示
- 降级运行时：隐藏"演练"按钮，或替换为提示文本"配置 AI 模型后可进行智能演练"

**7.2 修改 `src/views/SubjectiveView.vue`**
- 同样注入 `useRuntimeMode()`
- 考点卡片上的"演练"按钮仅在 `isNormalMode` 时显示

### 任务 8：路由更新 (`src/router/index.ts`)

- 新增 `/settings` 路由，指向 `SettingsView.vue`
- 保持现有路由不变

### 任务 9：依赖安装

- 安装 `marked` 用于 Markdown 渲染（AI 返回的内容）

## 三、文件变更清单

| 操作 | 文件路径 | 说明 |
|------|----------|------|
| 新增 | `src/composables/useSettings.ts` | 复用 idea_extend |
| 新增 | `src/composables/useAiCall.ts` | 复用 idea_extend |
| 新增 | `src/composables/usePromptStore.ts` | 复用架构，法考提示词 |
| 新增 | `src/composables/useRuntimeMode.ts` | 新增运行模式检测 |
| 新增 | `src/views/SettingsView.vue` | 复用 idea_extend 设置页 |
| 修改 | `src/types/index.ts` | 扩展类型定义 |
| 修改 | `src/layouts/MainLayout.vue` | 移除 AppHeader，新增设置菜单 |
| 删除 | `src/components/AppHeader.vue` | 不再使用 |
| 修改 | `src/views/OverviewView.vue` | 复用 overview-demo.html 排版 |
| 修改 | `src/components/ObjectiveModal.vue` | 双模式交卷评判 + AI 调用 |
| 修改 | `src/components/SubjectiveModal.vue` | 双模式复制考卷 + AI 调用 |
| 修改 | `src/views/ObjectiveView.vue` | 条件显示演练按钮 |
| 修改 | `src/views/SubjectiveView.vue` | 条件显示演练按钮 |
| 修改 | `src/router/index.ts` | 新增 settings 路由 |
| 安装 | `marked` | Markdown 渲染依赖 |

## 四、AI 提示词设计

### 4.1 客观题评判提示词 (objective-judge)
```
你是一位高胜率的中国国家统一法律职业资格考试（法考）客观题辅导名师。
请对学生的如下做题结果进行精准错因剖析，并给出思维提升建议。

【科目领域】: {subject}
【核心考点】: {topic}

【单选题】
题干：{singleQuestion}
学生作答：{singleAnswer} | 正确答案：{singleCorrect}

【多选题】
题干：{multiQuestion}
学生作答：{multiAnswer} | 正确答案：{multiCorrect}

【分析要求】
1. 聚焦于做错的题目，拆解每个干扰项的陷阱类型（偷换概念/以偏概全/脑补情节/张冠李戴/混淆条件）
2. 给出思维提升：遇到此类陷阱时应如何快速识别？有什么判断技巧？
3. 总结该考点的"秒杀口诀"
4. 补充1-2个该考点的易混淆知识点
```

### 4.2 主观题评判提示词 (subjective-judge)
```
你是一位资深法考主观题阅卷组专家。请按官方阅卷标准评分。

【科目】: {subject}
【考点】: {topic}
【案情】: {caseText}
【问题】: {question}
【学生答卷】: {answer}

【阅卷要求】
1. 得分点分析：列出所有采分点，标注答对/答错/遗漏
2. 预估分数（满分30分）及扣分理由
3. 答题规范点评：结构、法条引用、逻辑表达
4. 改进建议：提供参考答案要点
5. 知识延伸：补充易混淆知识点
```

### 4.3 动态出题提示词 (objective-generate)
```
你是一位法考命题研究专家。请根据以下科目和考点，生成一道高质量的法考客观题。

【科目】: {subject}
【考点】: {topic}
【要求】:
- 生成1道单选题和1道多选题
- 选项设计要包含典型的法考陷阱（偷换概念、脑补情节等）
- 难度适中，符合法考真题风格
- 输出格式为JSON：
{
  "single": {"question":"","options":[{"label":"A","text":""},...],"correctAnswer":"","explanation":""},
  "multiple": {"question":"","options":[{"label":"A","text":""},...],"correctAnswer":[""],"explanation":""}
}
```

## 五、降级运行提示文案

- 客观题 Toast："客观题错因剖析提示词已复制！请前往'豆包'或'DeepSeek'粘贴（Ctrl+V），AI 将为您深度复盘选项陷阱。提示：配置内置 AI 模型可获得连贯的自动评判体验。"
- 主观题 Toast："主观题答卷与评分提示词复制成功！请立即在'DeepSeek'或'豆包'中粘贴发送，AI 将以阅卷组专家标准为你出具判卷报告。提示：配置内置 AI 模型可获得连贯的自动评判体验。"
