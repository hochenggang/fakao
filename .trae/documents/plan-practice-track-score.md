# Plan: 练题追踪 + 错题集重构 + 主观题评分

## 背景
1. **练题追踪**：需要在 SubjectiveView.vue / ObjectiveView.vue 的考点旁边显示「已练习 X 题」tag，持久化到 localStorage
2. **错题集重构**：WrongBookView.vue 的列表改为 n-collapse 折叠展示，更漂亮地渲染所有数据
3. **清空错题集移动**：从 WrongBookView 移动到 SettingsView 的「错题集管理」板块
4. **主观题评分**：AI 评判结果需要包含参考答案和评分（[得分, 满分]），在评判结果和错题集中展示得分

## 当前状态

### 已完成
- `src/composables/usePracticeTracker.ts` — 练题追踪 composable 已创建
- `src/types/index.ts` — WrongBookItem 已增加 `score` 和 `referenceAnswer` 字段
- `src/composables/usePromptStore.ts` — subjective-judge 提示词已优化，要求返回 JSON 评分
- `src/views/ObjectiveView.vue` — 已集成练习追踪，显示「已练习 X 题」tag
- `src/views/SubjectiveView.vue` — 已集成练习追踪，显示「已练习 X 题」tag
- `src/components/SubjectiveModal.vue` — 已解析评分 JSON，展示得分和参考答案，保存到错题集

### 待完成
- `src/views/WrongBookView.vue` — 需改为 n-collapse 折叠列表，漂亮渲染所有字段，移除清空按钮
- `src/views/SettingsView.vue` — 需新增「错题集管理」tab，包含清空错题集功能

## 实现步骤

### Step 1: 修改 WrongBookView.vue — n-collapse 折叠 + 漂亮渲染 + 移除清空按钮

**结构变更：**
- 移除原有的操作栏（清空错题集按钮）
- 使用 `n-collapse` 替代 `n-card` 列表
- 每个错题是一个 `n-collapse-item`
- 标题（header）显示：类型tag + 科目·考点 + 得分tag（如有）+ 日期
- 展开后显示完整内容：
  - **客观题**：
    - 单选题：题干、选项（标出正确答案和用户答案）、AI 评判
    - 多选题：题干、选项、用户答案、正确答案、AI 评判
  - **主观题**：
    - 案情材料（完整展示）
    - 问题
    - 用户答案
    - 参考答案（如有）
    - 得分（如有，用 n-tag 展示）
    - AI 评判完整内容（Markdown 渲染）
- 每条错题底部有「删除」按钮

**得分展示规则：**
- header 中得分 tag 颜色：>=80% 绿色 success，>=60% 橙色 warning，<60% 红色 error
- 详细内容区也展示得分

**导入变更：**
- 新增 `NCollapse`, `NCollapseItem` 导入
- 移除 `NPopconfirm`（清空按钮的确认不再需要，但删除单条仍需）

### Step 2: 修改 SettingsView.vue — 新增「错题集管理」tab

**新增 tab：**
```vue
<n-tab-pane name="wrongbook" tab="错题集管理">
```

**内容设计：**
- 统计卡片：总错题数、客观题错题数、主观题错题数（与 WrongBookView 一致）
- 清空错题集按钮（带 n-popconfirm 确认）
- 提示文字：清空后不可恢复
- 空状态：暂无错题记录时的提示

**导入变更：**
- 新增 `NCard`, `NPopconfirm`, `NEmpty` 导入（如尚未导入）
- 导入 `useWrongBook` composable
- 导入 `Delete16Regular` 图标

### Step 3: 运行验证

- 检查 TypeScript 类型是否正确
- 检查 naive-ui 组件导入是否完整
- 确认所有功能协调一致

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/views/WrongBookView.vue` | 修改 | n-collapse 折叠，漂亮渲染，移除清空按钮 |
| `src/views/SettingsView.vue` | 修改 | 新增错题集管理 tab |

## 详细设计

### WrongBookView n-collapse 结构

```vue
<n-collapse>
  <n-collapse-item v-for="item in items" :key="item.id">
    <template #header>
      <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0">
        <n-tag :type="item.type === 'objective' ? 'warning' : 'success'" size="small">
          {{ item.type === 'objective' ? '客观题' : '主观题' }}
        </n-tag>
        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis">
          {{ item.subjectName }} · {{ item.topicName }}
        </span>
        <n-tag v-if="item.score" size="small" :type="scoreTagType(item.score)">
          {{ item.score[0] }}/{{ item.score[1] }} 分
        </n-tag>
        <span style="margin-left: auto; font-size: 12px; color: #94a3b8; white-space: nowrap">
          {{ formatDate(item.createdAt) }}
        </span>
      </div>
    </template>
    
    <!-- 详细内容 -->
    <div>...</div>
  </n-collapse-item>
</n-collapse>
```

### SettingsView 错题集管理 tab 结构

```vue
<n-tab-pane name="wrongbook" tab="错题集管理">
  <div class="tab-content">
    <!-- 统计卡片 -->
    <div style="display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap">
      <n-card ...>总错题数</n-card>
      <n-card ...>客观题错题</n-card>
      <n-card ...>主观题错题</n-card>
    </div>
    
    <!-- 清空按钮 -->
    <n-popconfirm @positive-click="clear">
      <template #trigger>
        <n-button type="error" secondary>清空错题集</n-button>
      </template>
      确定要清空所有错题记录吗？此操作不可恢复。
    </n-popconfirm>
    
    <n-empty v-if="items.length === 0" ... />
  </div>
</n-tab-pane>
```
