# PracticeModal 改为 LLM 返回后再呈现

## 0. 现状分析

### 当前行为（双模态框并存）

用户点击考点 → [PracticeView.vue#L108-111](file:///c:/Users/Administrator/Documents/codes/%E6%98%93%E6%87%82%E6%B3%95%E8%80%83/src/views/PracticeView.vue#L108-L111) `openTopic()` 触发 `triggerOpen({ show: true, ... })` → [PracticeView.vue#L251-260](file:///c:/Users/Administrator/Documents/codes/%E6%98%93%E6%87%82%E6%B3%95%E8%80%83/src/views/PracticeView.vue#L251-L260) `<PracticeModal :show="modal.show">` **立即**打开 PracticeModal → [PracticeModal.vue#L104-127](file:///c:/Users/Administrator/Documents/codes/%E6%98%93%E6%87%82%E6%B3%95%E8%80%83/src/components/PracticeModal.vue#L104-L127) `doGenerate()` 内 `generating = true` 显示**本地 spinner** + 文案 "AI 正在为您生成..." → 同时 [useLLM.ask()](file:///c:/Users/Administrator/Documents/codes/%E6%98%93%E6%87%82%E6%B3%95%E8%80%83/src/composables/llm/ask.ts#L41-L60) 调用 `streamChat()` 触发**库的模态框**弹窗。

**结果**：用户看到**两个模态框叠在一起**——下方是 PracticeModal（带 spinner + 空内容），上方是 LLM 流式模态框（带思考过程 + 模型输出）。LLM 返回后两者几乎同时关闭，PracticeModal 切换到题目内容。

### LLM 库的行为契约

[vue-llm-stream-chat](file:///c:/Users/Administrator/Documents/codes/%E6%98%93%E6%87%82%E6%B3%95%E8%80%83/node_modules/vue-llm-stream-chat/dist/index.js#L47-L94) 的 `streamChat` 行为：
- 调用瞬间：`loading = true`、激活当前 instance
- 库模态框自动出现（条件：`activeInstance.loading === true`）
- 调用结束（成功 / 抛错）：`loading = false`、模态框自动消失
- **库已经**全权负责"AI 正在处理"这一 UX 状态

### 需求解读

用户的两个约束是**互为因果**的：
1. **"练习弹窗应该等到 LLM 全文返回后再呈现"** → 模态框的出现时机 = LLM 完成时刻
2. **"loading 态由 llm 的第三方库已处理"** → 不要自己再做 loading UI

由此推得：**PracticeModal 内部**应该根据"LLM 是否完成"决定是否显示，而不是根据 `props.show` 直接显示。

---

## 1. 修复设计

### 1.1 新增 `displayed` 计算属性

`props.show` 是**外部意图**（"用户想打开这个题"），而 `displayed` 是**实际呈现**（"题目已就绪，可以呈现"）：

```ts
const displayed = computed(() =>
  props.show && (!!singleQ.value || !!multiQ.value || !!subjectiveQ.value || !!error.value)
)
```

**关键**：
- `props.show` 为 false → `displayed = false`（用户主动关闭）
- LLM 未完成（三个 Q 都是 null 且 error 为空）→ `displayed = false`（等 LLM）
- LLM 完成（任一 Q 有值）或失败（error 有值）→ `displayed = true`（呈现内容）
- 重新出题（`reset()` 清空 Q）→ `displayed = false`（隐藏）→ 库模态框接管 → LLM 返回后重新显示

### 1.2 模板修改

将 `<n-modal :show="show">` 改为 `<n-modal :show="displayed">`，并删除所有"生成中"相关 UI：

**删除**：[PracticeModal.vue#L241-247](file:///c:/Users/Administrator/Documents/codes/%E6%98%93%E6%87%82%E6%B3%95%E8%80%83/src/components/PracticeModal.vue#L241-L247) 的"生成中"spinner 块
**删除**：[PracticeModal.vue#L407-410](file:///c:/Users/Administrator/Documents/codes/%E6%98%93%E6%87%82%E6%B3%95%E8%80%83/src/components/PracticeModal.vue#L407-L410) 的"正在准备题目..." 兜底空态
**改写**：v-if 链从 4 个分支（generating / error / objective / subjective）简化为 3 个分支（error / objective / subjective），因为"generating"分支已经被外层 `displayed = false` 拦掉

### 1.3 删除 `generating` ref

`generating` ref 的**唯一用途**是驱动本地 spinner UI。Spinner 删除后，ref 本身也失去意义。

**例外**：保留 `judging` ref。评判是**第二个** LLM 调用，发生在用户已提交答案、模态框内显示题目之后——此时模态框不能隐藏（否则用户失去作答上下文）。`judging` 继续驱动 "AI 阅卷评判" 按钮的 `:loading` 状态，体现"评判进行中"的局部反馈。

### 1.4 `doGenerate` / `reset` 的逻辑调整

`doGenerate` 不再设 `generating`，仅做核心工作（调用 LLM、填充 Q、记录 practice）：

```ts
async function doGenerate() {
  error.value = ''
  try {
    const out = await flow.generate(props.subject, props.topic, props.scope)
    if ('caseText' in out) {
      subjectiveQ.value = out
    } else {
      singleQ.value = out.single
      multiQ.value = out.multiple
    }
    if (out.topicId) actualTopicId.value = out.topicId
    if (out.topicName) actualTopicName.value = out.topicName
    if (props.scope !== 'topic') {
      recordPractice(props.subject.id, actualTopicId.value, kind.value)
      emit('practice-recorded', props.subject.id, actualTopicId.value, kind.value)
    }
  } catch (e: any) {
    error.value = `出题失败：${e?.message || '未知错误'}`
  }
}
```

`reset` 中删除 `generating.value = false` 这一行（ref 已删除）。

### 1.5 `handleRegenerate` 的行为变化

**之前**：
- 点击"重新出题" → `reset()` → 模态框**仍可见**但内容清空 → `doGenerate()` → 库模态框弹出 → 库关闭 → 模态框显示新题

**之后**：
- 点击"重新出题" → `reset()` 清空 Q → `displayed` 变 false → 模态框**自动隐藏** → `doGenerate()` → 库模态框接管 → LLM 返回 → 模态框重新出现

**这个变化是符合预期的**——LLM 库接管期间不应该有"空白 PracticeModal"在屏幕上。同时也消除了"重新出题时短暂显示空内容"的视觉抖动。

### 1.6 行为契约表

| 操作 | 旧行为 | 新行为 |
|---|---|---|
| 点击考点 | PracticeModal 立即打开 + 库模态框弹出 | **库模态框** 单独弹出（PracticeModal 隐藏） |
| LLM 返回 | 库模态框关闭 + PracticeModal 显示题目 | 库模态框关闭 + PracticeModal 显示题目 |
| 点击"AI 深度评判" | 评判中 PracticeModal 内按钮显示 loading + 库模态框弹出 | **不变**（评判阶段不修改） |
| 点击"重新出题" | 模态框保留并清空 → 库模态框弹出 → 库关闭 → 模态框显示新题 | 模态框**自动隐藏** → 库模态框弹出 → 库关闭 → 模态框显示新题 |
| LLM 出错 | PracticeModal 一直显示 spinner → 库关闭后仍卡住 | PracticeModal 出现并显示错误 alert + 重试按钮 |

---

## 2. 改动文件清单

| 文件 | 关键变更 |
|---|---|
| `src/components/PracticeModal.vue` | 新增 `displayed` computed；`<n-modal :show="displayed">` 替代 `:show="show"`；删除 `generating` ref；删除"生成中"spinner 块；删除"正在准备题目..."兜底；v-if 链从 4 分支简化为 3 分支；`reset` 中删除 `generating.value = false`；`doGenerate` 删去 `generating = true/false` |

---

## 3. 实施步骤（按顺序）

### Step 1：新增 `displayed` computed
- 文件：[PracticeModal.vue](file:///c:/Users/Administrator/Documents/codes/%E6%98%93%E6%87%82%E6%B3%95%E8%80%83/src/components/PracticeModal.vue#L1-L86)
- 位置：与 `renderedReport` 等 computed 一起
- 内容：`props.show && (任一 Q 非空 || error 非空)`

### Step 2：`<n-modal>` 绑定 `displayed`
- 文件：[PracticeModal.vue#L228](file:///c:/Users/Administrator/Documents/codes/%E6%98%93%E6%87%82%E6%B3%95%E8%80%83/src/components/PracticeModal.vue#L228)
- `:show="show"` → `:show="displayed"`
- `@update:show="handleClose"` 不变

### Step 3：删除 `generating` 相关代码
- 删除 `const generating = ref(false)`（L45）
- 删除 `reset()` 中的 `generating.value = false`（L91）
- 删除 `doGenerate()` 中 `generating.value = true` 和 `generating.value = false`（L105, L125）
- 删除模板中"生成中"块（L242-247）
- 删除模板中"v-else 兜底"块（L407-410）

### Step 4：精简 v-if 链
- v-else-if 链中删除"generating"分支后，原来的"error / objective / subjective"分支的 v-else-if 改写为 v-if / v-else-if
- 验证：objective 题目、subjective 题目、error 三个状态正确切换

### Step 5：类型检查 + 构建
- 运行 `npm run check` 与 `npm run build`
- 验证：exit code 0，无类型错误

---

## 4. 验证步骤

1. **首次点击考点**：
   - 点击任意考点 → 库模态框弹出（PracticeModal 不出现）→ LLM 返回 → 库模态框关闭 → PracticeModal 出现并显示题目
2. **LLM 出错**：
   - 故意配置错误的 API Key → 库模态框弹出 → LLM 失败 → 库模态框关闭 → PracticeModal 出现并显示错误 alert + 重试按钮
3. **重新出题**：
   - 答完题后点击"重新出题" → PracticeModal **自动隐藏** → 库模态框弹出 → LLM 返回 → 库关闭 → PracticeModal 重新出现
4. **评判流程（未在本次修改范围内）**：
   - 点击"AI 深度评判" → PracticeModal 内按钮显示 loading + 库模态框弹出 → 库关闭 → PracticeModal 显示 AI 报告
5. **关闭**：
   - 点击 PracticeModal 关闭按钮 → `props.show` 变 false → `displayed` 变 false → 模态框关闭
6. **类型 & build**：`npm run check` 0 错误；`npm run build` 成功

---

## 5. 优雅性自检

- **关注点分离**：`props.show`（外部意图）与 `displayed`（实际呈现）解耦——这正是 Vue 3 受控组件的标准范式
- **状态语义统一**：`displayed` 由 4 个 state 派生（`props.show` + 3 个 Q + error），覆盖所有"应该出现"和"应该隐藏"的情况
- **消除重复 UI**：原本的"生成中"spinner 是对库模态框的**重复**——既然库已经接管，spinner 是**纯冗余**
- **错误处理下沉**：之前 LLM 失败时 PracticeModal 一直显示 spinner 直到库关闭、然后才显示 error；现在 LLM 失败时 PracticeModal **直接**显示 error alert——失败路径更快、更清晰
- **评判阶段不受影响**：`judging` 仍在 PracticeModal 内部维护——因为评判是"用户已可见题目后的补充操作"，与"出题"语义不同，保持原样
