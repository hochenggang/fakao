# 易懂法考

> 基于 Vue 3 + TypeScript + Vite 的法考智能演练应用，以「AI 出题 + AI 评判 + 错题管理 + 大纲笔记」四位一体辅助法考备考。

## 项目特点

- **AI 智能出题**：支持客观题（单选+多选）和主观题（案例分析），可按考点 / 科目 / 整卷三种粒度生成。
- **AI 深度评判**：客观题给出错因剖析、思维提升、秒杀口诀、知识延伸；主观题按官方阅卷标准打分并给出参考答案。
- **多 Provider 兼容**：统一的 SSE 流式调用抽象，可对接任意 OpenAI 兼容的 API（DeepSeek / 通义千问 / 智谱 GLM 等）。
- **优雅降级**：未配置 API 时进入降级模式，仍可使用大纲笔记、错题管理、考试概览等基础功能。
- **错题管理**：自动追踪练习记录，支持错题回顾与重做。
- **大纲笔记**：内置 18 个科目的法考大纲知识库，作为 AI 出题与评判的 RAG 上下文。

## 技术栈

| 类别 | 选型 |
|---|---|
| 框架 | Vue 3 (`<script setup>` SFC) |
| 语言 | TypeScript |
| 构建 | Vite 5 |
| UI 库 | naive-ui |
| 样式 | Tailwind CSS |
| 路由 | vue-router 4 |
| Markdown 渲染 | marked |
| 图标 | @vicons/fluent, lucide-vue-next |

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 类型检查
npm run check

# 生产构建
npm run build
```

## 项目结构

```
src/
├── assets/                # 静态资源
├── components/            # 公共组件
│   ├── AiSseProvider.vue  # AI 流式调用 Provider
│   ├── PracticeModal.vue  # 演练模态框（客观/主观二合一）
│   ├── SseStreamModal.vue # SSE 流式输出浮层
│   └── TopicCard.vue      # 考点卡片
├── composables/           # 组合式函数
│   ├── llm/               # LLM 抽象层（SSE / JSON 解析 / 错误兜底）
│   ├── usePracticeFlow.ts # 出题 + 评判的核心编排
│   ├── usePromptStore.ts  # Prompt 模板与用户自定义
│   ├── useSettings.ts     # API / 模型配置
│   ├── usePracticeTracker.ts / usePracticeCount.ts # 练习追踪
│   └── ...
├── data/
│   ├── exams.ts           # 考试 / 科目 / 考点数据
│   └── knowledge/         # 各科目大纲知识库（md 格式）
├── layouts/MainLayout.vue # 全局布局
├── router/index.ts        # 路由配置
├── types/                 # 类型定义
└── views/                 # 页面
    ├── PracticeView.vue   # 法考演练（核心）
    ├── OverviewView.vue   # 考试概览
    ├── WrongBookView.vue  # 错题集
    ├── OutlineNotesView.vue # 大纲笔记
    └── SettingsView.vue   # 设置（API / Prompt / 主题）
```

## 核心设计

### LLM 抽象层

`src/composables/llm/` 是与具体 Provider 解耦的核心抽象：

- [createSseContext.ts](./src/composables/llm/createSseContext.ts) — 统一的 SSE 流式调用入口，封装 3 次重试 + JSON 解析 + judge 场景兜底。
- [json.ts](./src/composables/llm/json.ts) — 三级 JSON 提取策略（纯 JSON / 平衡括号 / 围栏代码块），容忍 AI 输出格式漂移。
- [provider.ts](./src/composables/llm/provider.ts) — Vue `provide` / `inject` 注入，任何组件通过 `useLLM()` 即可调用。

### Prompt 工程

- [usePromptStore.ts](./src/composables/usePromptStore.ts) — 内置 5 类 Prompt 模板（system / objective-generate / subjective-generate / objective-judge / subjective-judge），支持 localStorage 自定义 + 一键恢复默认。
- 评判类 Prompt 采用"整个输出就是 JSON"契约，配合 `extractJson` 的三级策略确保解析成功率。

## 使用指南

1. 启动后默认进入"法考演练"页面。
2. 首次使用需进入「设置」配置 API（Base URL + API Key + 模型名）。
3. 配置完成后选择考试类型（客观题卷一/卷二/主观题）→ 选择科目 → 选择考点 → 点击"开始演练"。
4. 答题后可点击"AI 深度评判"获取解析。

## 路线图

- [ ] 错题自动归集与重做
- [ ] 移动端适配

## 特别鸣谢

本项目的法考考试大纲与考点划分参考了以下开源资料：

- [CacinieP/LPQE-Learning](https://github.com/CacinieP/LPQE-Learning)

感谢 [@CacinieP](https://github.com/CacinieP) 开源的高质量法考学习资料。

## License

MIT
