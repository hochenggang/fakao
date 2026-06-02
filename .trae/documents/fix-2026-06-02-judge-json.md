# 修复 Bug：AI 评判"未找到 JSON 内容"

## 0. 根因分析

错误链路：

```
createSseContext.ask → 3 次重试均失败 → throw "第 3 次失败: 未找到 JSON 内容"
```

逐层下钻：

### Bug A：`objective-judge` prompt **完全没要求 AI 输出 JSON**

[usePromptStore.ts#L20-L47](file:///c:/Users/Administrator/Documents/codes/%E6%98%93%E6%87%82%E6%B3%95%E8%80%83/src/composables/usePromptStore.ts#L20-L47) 中 `objective-judge` 模板：

```text
请对学生的如下法考客观题做题结果进行精准错因剖析……
【分析要求】1. 错因剖析  2. 思维提升  3. 秒杀口诀  4. 知识延伸  5. ...
```

**没有任何"输出 JSON"或"输出格式"指示**。AI 自然会写自由 markdown 评判。`extractJson` 用 `text.match(/\{[\s\S]*\}/)` 找不到 `{` → 抛"未找到 JSON 内容" → retry → 同样失败 → 最终报错。

### Bug B：`subjective-judge` prompt 要求"末尾附加 JSON"，但 AI 不稳定

[usePromptStore.ts#L74-L76](file:///c:/Users/Administrator/Documents/codes/%E6%98%93%E6%87%82%E6%B3%95%E8%80%83/src/composables/usePromptStore.ts#L74-L76) 末尾：

```text
【重要】请在完成上述评判报告后，在最后单独附加一行以下 JSON 格式的评分信息：
{"score": [预估得分数字, 30], "referenceAnswer": "参考答案要点，包含核心采分点和法律依据"}
```

实际 AI 输出常出现以下失败模式：
1. JSON 被 ` ```json ... ``` ` 代码块包裹 → 仍是合法 JSON，但有时 `\}` 之外被附加说明。
2. AI 报告内本身就含有 `{}`（如"采分点：{概念辨析}、{法律效果}"）→ 贪婪正则 `\{[\s\S]*\}` 跨过去 → `JSON.parse` 失败 → retry。
3. 严重时 AI 忘记在末尾附加 JSON → 整段报告没有结构化字段 → 抛错。
4. thinking 模式开启时，AI 思考链（reasoning_content）和正文混在一起，部分 provider 会在流中把 JSON 切断。

### Bug C：`extractJson` 贪婪匹配脆弱

[json.ts#L15-L19](file:///c:/Users/Administrator/Documents/codes/%E6%98%93%E6%87%82%E6%B3%95%E8%80%83/src/composables/llm/json.ts#L15-L19)：

```ts
export function extractJson(text: string): Record<string, unknown> {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('未找到 JSON 内容')
  return JSON.parse(m[0])
}
```

- `\{[\s\S]*\}` 是贪婪匹配：从**第一个** `{` 一直吃到**最后一个** `}`。如果 AI 报告中包含 `{}` 示例或多段 JSON，会匹配到过长的"伪 JSON" → parse 失败。
- 没有"平衡括号"找最外层完整 JSON 的逻辑。
- 没有"找不到 JSON 时的兜底"，直接抛错。

### Bug D：ask 没有为 judge 场景做兜底

[createSseContext.ts#L70-L88](file:///c:/Users/Administrator/Documents/codes/%E6%98%93%E6%87%82%E6%B3%95%E8%80%83/src/composables/llm/createSseContext.ts#L70-L88)：3 次重试都用同一个 prompt。即使 AI 第二次第三次仍然不返回 JSON，**不会**降级为"全文即 report"，而是直接报错。

---

## 1. 修复设计

### 1.1 改写两个 judge prompt：让 AI **整个输出就是 JSON**

**目标**：让 AI 在生成评判内容时**只**输出一段 `{}` 包裹的 JSON，**不再**"先 markdown 后 JSON"的双段结构。`report` 字段内部可以放任意 markdown 内容（作为字符串值），但**外层**必须是合法 JSON。

#### `objective-judge`（重写）

```text
请对学生的如下法考客观题做题结果进行精准错因剖析，并给出思维提升建议。

【科目领域】: {subject}
【核心考点】: {topic}

【相关法考大纲知识】:
{knowledgeContext}

【单选题】
题干：{singleQuestion}
选项：
{singleOptions}
学生作答：{singleAnswer} | 正确答案：{singleCorrect}

【多选题】
题干：{multiQuestion}
选项：
{multiOptions}
学生作答：{multiAnswer} | 正确答案：{multiCorrect}

【分析任务】:
1. **错因剖析**：聚焦做错的题，逐一拆解每个干扰项的陷阱类型（偷换概念/以偏概全/脑补情节/张冠李戴/混淆条件/时间错位等）。
2. **思维提升**：给出快速识别陷阱的判断技巧和思维路径。
3. **秒杀口诀**：总结该考点一句精简独家口诀。
4. **知识延伸**：补充 1-2 个易混淆知识点。
5. **如果学生全部答对**：给予肯定并补充进阶易错点。

【严格输出要求 — 必须遵守，否则视为失败】:
- 你的整个回复**只能**是一段合法 JSON 对象，且**第一字符**必须是 `{`，**最后一字符**必须是 `}`。
- **不要**在 JSON 前后添加任何文字、说明、代码块标记 ```、注释、Markdown 标题、空行、问候语。
- JSON 内不要使用未转义的双引号；markdown 内容中如出现 `"` 请改用 `「」` 或 `『』`。
- JSON 字段说明：
  - `report`：完整的 markdown 格式评判报告（涵盖上述 5 个分析任务），用 `\\n` 表示换行。
  - `score`：客观题无评分，固定为 `null`。
  - `referenceAnswer`：客观题无参考答案，固定为 `null`。
- 示例结构（**仅说明字段，不要照抄**）：
  {"report":"# 一、错因剖析\\n……","score":null,"referenceAnswer":null}
```

#### `subjective-judge`（重写）

```text
你是一位资深法考主观题阅卷组专家。请按照官方阅卷标准，对以下学生答卷进行专业评分和深度点评。

【科目领域】: {subject}
【核心考点】: {topic}

【相关法考大纲知识】:
{knowledgeContext}

【案情材料】: {caseText}
【问题】: {question}
【学生答卷】: {answer}

【阅卷任务】:
1. **得分点分析**：列出本题所有采分点，逐一标注学生答对/答错/遗漏。
2. **评分与理由**：给出预估分数（满分 30），详细说明每处扣分原因。
3. **答题规范点评**：从答题结构、法条引用准确性、逻辑表达清晰度等方面点评。
4. **改进建议**：给出参考答案要点（包含核心采分点、关键法条、论证逻辑）。
5. **知识延伸**：补充 1-2 个易混淆或易遗漏的知识点。

【严格输出要求 — 必须遵守，否则视为失败】:
- 你的整个回复**只能**是一段合法 JSON 对象，且**第一字符**必须是 `{`，**最后一字符**必须是 `}`。
- **不要**在 JSON 前后添加任何文字、说明、代码块标记 ```、注释、Markdown 标题、空行、问候语。
- JSON 内不要使用未转义的双引号；markdown 内容中如出现 `"` 请改用 `「」` 或 `『』`。
- JSON 字段说明：
  - `report`：完整的 markdown 格式评判报告（涵盖上述 5 个任务），用 `\\n` 表示换行。
  - `score`：固定为 `[预估得分数字, 30]` 两元素数组。
  - `referenceAnswer`：参考答案要点（markdown 格式），用 `\\n` 表示换行。
- 示例结构（**仅说明字段，不要照抄**）：
  {"report":"# 一、得分点分析\\n……","score":[25,30],"referenceAnswer":"# 参考答案\\n……"}
```

**关键变化**：
- 旧版本"先 markdown 后 JSON" → 新版本"整个输出就是 JSON"。
- 显式约束"第一字符 `{`、最后一字符 `}`"——配合 1.2 的 `extractJson` 改进正好命中。
- 要求 markdown 内不要用未转义 `"`——避免 JSON.parse 失败。
- 客观题 `score/referenceAnswer` 固定为 `null`——`validateShape` 不需要这俩字段（schema 只校验 `report`），由调用方处理缺失。

### 1.2 改进 `extractJson`：平衡括号 + 边界约束

**目标**：从 AI 输出中找到**最外层平衡**的 `{...}` 块，且首字符是 `{` 末字符是 `}`，避免贪婪匹配吞掉多个 JSON 段。

**实现**：在 [llm/json.ts](file:///c:/Users/Administrator/Documents/codes/%E6%98%93%E6%87%82%E6%B3%95%E8%80%83/src/composables/llm/json.ts) 增加 `findBalancedJson`：

```ts
function findBalancedJson(text: string): string | null {
  // 找到第一个 '{'
  const start = text.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (escape) { escape = false; continue }
    if (c === '\\') { escape = true; continue }
    if (inString) {
      if (c === '"') inString = false
      continue
    }
    if (c === '"') { inString = true; continue }
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

export function extractJson(text: string): Record<string, unknown> {
  // 优先级 1：trim 后是纯 JSON
  const trimmed = text.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try { return JSON.parse(trimmed) } catch {}
  }
  // 优先级 2：平衡括号找最外层 JSON
  const balanced = findBalancedJson(text)
  if (balanced) {
    try { return JSON.parse(balanced) } catch {}
  }
  throw new Error('未找到 JSON 内容')
}
```

**关键点**：
- 字符串内的 `{`/`}` 不会改变深度（正确处理转义）。
- 优先尝试"trim 后是纯 JSON"，快速路径。
- 回退到平衡括号匹配，处理"JSON 嵌在 markdown 中"的场景。
- 如果都失败，**仍然**抛"未找到 JSON 内容"——但 1.3 的 fallback 会接住。

### 1.3 ask 加 fallback：judge 场景下"全文即 report"

**目标**：当 AI 在 3 次重试中**任一次**返回的输出能被解析为某种结构（含 `report` 字段），就用结构；都失败时，**不**抛错而是把**最后一次**的全文作为 `report` 返回。

**实现**：在 [createSseContext.ts](file:///c:/Users/Administrator/Documents/codes/%E6%98%93%E6%87%82%E6%B3%95%E8%80%83/src/composables/llm/createSseContext.ts) 的 `ask` 中，区分"网络/API 错误"和"JSON 解析错误"：

```ts
let lastErr: Error | null = null
let lastFullText = ''
for (let i = 0; i < retries; i++) {
  try {
    const full = await streamChat(...)
    lastFullText = full
    let obj: Record<string, unknown>
    try {
      obj = extractJson(full)
      validateShape(obj, opts.schema)
    } catch (jsonErr: any) {
      // 兜底：仅当 schema 含 report 字段时，把全文作为 report
      if (opts.schema && 'report' in opts.schema) {
        obj = { report: full }
      } else {
        throw jsonErr  // generate 等结构化场景，正常 retry
      }
    }
    setTimeout(() => { isStreaming.value = false; showStream.value = false }, 200)
    return obj as T
  } catch (e: any) {
    lastErr = new Error(`第 ${i + 1} 次失败: ${e?.message || String(e)}`)
    if (e?.name === 'AbortError') break
  }
}
// 全部失败：judge 场景再次兜底，避免直接报错
isStreaming.value = false
showStream.value = false
lastError.value = lastErr
if (opts.schema && 'report' in opts.schema && lastFullText) {
  return { report: lastFullText } as T
}
throw lastErr ?? new Error('AI 调用失败')
```

**关键点**：
- `generate` 没有 `report` 字段，失败照常抛错重试（保持严谨）。
- `judge` 有 `report` 字段，**第一次**内部就 fallback 到全文，**不**消耗 retry 次数。
- 3 次都失败时，judge **仍然**兜底返回 `{report: lastFullText}`——保证 UI 至少有评判内容可显示。
- 用户体验：哪怕模型最不靠谱，至少能看到 AI 写的评判全文（marked 渲染），不会"AI 评判出错"的硬错误。

### 1.4 配套：`usePracticeFlow.judge` 让 schema `score` / `referenceAnswer` 可选

[usePracticeFlow.ts](file:///c:/Users/Administrator/Documents/codes/%E6%98%93%E6%87%82%E6%B3%95%E8%80%83/src/composables/usePracticeFlow.ts) 当前 `JUDGE_SCHEMA` 写：

```ts
const JUDGE_SCHEMA: JsonShape = {
  report: 'string',
  score: 'string[]',
  referenceAnswer: 'string',
}
```

但 `validateShape` 是"必填 key 都得有"——`score` / `referenceAnswer` 都是必填。但客观题 AI 应该返回 `null`，主观题不返回 `referenceAnswer`（如果没给）。

改为：

```ts
const JUDGE_SCHEMA: JsonShape = {
  report: 'string',                 // 必填
  // score / referenceAnswer 走 fallback 兜底
}
```

这样 validateShape 只校验 `report` 是 string（兜底时 `report` 也是 string），其它字段可有可无。`useLLM().ask<JudgeOut>` 的 `JudgeOut` 接口保持 `score?` / `referenceAnswer?` 可选，调用方根据 `out.score` / `out.referenceAnswer` 是否存在决定渲染。

---

## 2. 实施步骤（按顺序执行）

执行顺序：**先改 prompt 与 schema（契约层）→ 再改 `extractJson`（解析层）→ 最后改 `ask`（兜底层）**。每步独立可验证。

### Step 1：重写 `objective-judge` prompt
- 文件：`src/composables/usePromptStore.ts#L20-L47`
- 替换 DEFAULT_PROMPTS['objective-judge'] 整段。
- 关键约束：第一字符 `{`、最后一字符 `}`、禁止代码块标记、markdown 内不出现未转义 `"`。
- 验证：调用 `getPrompt('objective-judge')` 返回新内容；`localStorage` 中若用户已自定义，需要提示"重置为默认"按钮生效。

### Step 2：重写 `subjective-judge` prompt
- 文件：`src/composables/usePromptStore.ts#L49-L76`
- 替换 DEFAULT_PROMPTS['subjective-judge'] 整段。
- 关键约束同 Step 1，但 `score` 固定为 `[预估得分数字, 30]`，`referenceAnswer` 必须返回 markdown 要点。
- 验证：调用 `getPrompt('subjective-judge')` 返回新内容。

### Step 3：新增 `findBalancedJson` 并改写 `extractJson`
- 文件：`src/composables/llm/json.ts#L15-L19`
- 替换 `extractJson`：先尝试 `trim()` 后 `JSON.parse` 纯 JSON；失败回退到 `findBalancedJson`；都失败抛 "未找到 JSON 内容"。
- 验证：单测
  - 输入 `'{"a":1}'` → 返回 `{a:1}`
  - 输入 `'报告：xxx\n```json\n{"a":1}\n```'` → 返回 `{a:1}`
  - 输入 `'采分点：{概念}、{效果}\n{"score":25,"referenceAnswer":"..."}'` → 返回 `score:25`
  - 输入 `'hello'` → 抛 "未找到 JSON 内容"

### Step 4：`JUDGE_SCHEMA` 只校验 `report`
- 文件：`src/composables/usePracticeFlow.ts#L77-L81`
- 删掉 `score` / `referenceAnswer` 必填，仅保留 `report: 'string'`。
- 调用方 `usePracticeFlow.judge` 返回 `JudgeOut`，其中 `score?` / `referenceAnswer?` 可选，UI 端判空。
- 验证：`validateShape({report: "hi"}, {report: "string"})` 不抛错。

### Step 5：`createSseContext.ask` 加 judge 兜底
- 文件：`src/composables/llm/createSseContext.ts#L70-L95`
- 在 `try` 内部 `extractJson` + `validateShape` 失败时，若 `opts.schema` 含 `report` 字段，把 `full` 当作 `report` 返回；不含则按原路径抛错。
- 循环结束后若 `lastFullText` 非空且 `schema.report`，**仍**返回 `{report: lastFullText}` 兜底。
- 验证：
  - 故意让 AI 不返回 JSON（mock streamChat）→ judge 走兜底返回 `{report: '<full text>'}`；generate 仍抛错。
  - 3 次网络失败 → judge 仍返回最后一次全文，UI 显示完整评判。

### Step 6（可选）`usePromptStore` 增加"重置为默认"按钮
- 旧用户 localStorage 中存了老的 `objective-judge` / `subjective-judge` 自定义 prompt，会持续走老 prompt。
- 在设置页 Prompt 编辑区增加"恢复默认"按钮 → 调用 `removeCustom(key)` 并触发响应式更新。

---

## 3. 改动文件清单

| 文件 | 关键变更 |
|---|---|
| `src/composables/usePromptStore.ts` | 重写 `'objective-judge'` 和 `'subjective-judge'` 两个 prompt，要求"整个输出就是 JSON"，附严格输出约束（首字符 `{` 末字符 `}`、禁止代码块标记、markdown 内禁未转义 `"`） |
| `src/composables/llm/json.ts` | 新增 `findBalancedJson` 平衡括号匹配；`extractJson` 优先 trim-纯 JSON，回退到平衡括号 |
| `src/composables/llm/createSseContext.ts` | `ask` 内部区分"JSON 解析失败"与"网络失败"；schema 含 `report` 字段时首次失败即兜底为 `{report: full}`；3 次全失败时仍兜底 |
| `src/composables/usePracticeFlow.ts` | `JUDGE_SCHEMA` 只校验 `report`，移除 `score` / `referenceAnswer` 必填约束 |

---

## 4. 验证步骤

1. **客观题 AI 评判**：
   - 进入客观题练习 → 提交答案 → 点"AI 深度评判" → AI 评判报告正确显示（含错因剖析、秒杀口诀等），不报"未找到 JSON 内容"。
2. **主观题 AI 评判**：
   - 进入主观题演练 → 输入答案 → 点"AI 阅卷评判" → AI 评判报告 + 评分（如 `[25, 30]`）+ 参考答案要点**同时**显示，不报错。
3. **判错场景兜底**：
   - 模拟一个故意不返回 JSON 的模型（手动改 system prompt 让 AI 不输出 JSON）→ 仍能看到全文评判内容；不报硬错误。
4. **生成题不被影响**：
   - 客观题生成、主观题生成依然走严格 schema 校验（无 `report` 字段，不会触发兜底），失败时仍正常 retry + 报错。
5. **类型 & build**：`npm run check` 0 错误；`npm run build` 成功。

---

## 5. 优雅性自检

- **契约优先**：prompt 是契约，`extractJson` 是契约的执行者，**双管齐下**而非单点防御。prompt 要求"整个输出就是 JSON" + extractJson 用平衡括号鲁棒解析——契约+验证。
- **失败可降级**：judge 是"消费 AI 输出"的场景，**结构化失败**比"硬错误"用户体验更好。generate 是"产出结构化数据"的场景，**不能**降级——所以 fallback 只对 judge 启用（用 `'report' in schema` 自动判断）。
- **可观测**：fallback 走的是"全文即 report"，前端 `renderedReport` 直接 `marked.parse(out.report)`，UI 无需任何分支判断。
- **零兼容包袱**：不需要在调用方改任何东西；`usePracticeFlow` / `PracticeModal` 都不变。
