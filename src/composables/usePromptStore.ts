import { reactive, watchEffect } from 'vue'
import type { PromptKey } from '@/types'
import { knowledgeModules } from '@/data/knowledge'

const STORAGE_KEY = 'fakao_prompts'

const DEFAULT_PROMPTS: Record<PromptKey, string> = {
  system: `你是一位资深的中国国家统一法律职业资格考试（法考）辅导名师，同时也是一位深谙命题人心理的考试策略专家。
你具备以下核心能力：
1. 精准拆解法考真题的干扰项陷阱（偷换概念、脑补情节、张冠李戴、混淆条件、以偏概全等）
2. 提炼每个考点的"秒杀口诀"和快速判断技巧
3. 从思维层面帮助学生建立"命题人视角"，理解为什么这个选项是错的
4. 补充相关易混淆知识点，构建知识网络
5. 针对主观题，严格按照官方阅卷标准进行专业评分和深度点评

你的回答风格：专业、精准、有深度，善于用通俗的语言解释复杂的法律概念。`,

  'objective-judge': `请对学生的如下法考客观题做题结果进行精准错因剖析，并给出思维提升建议。

【科目领域】: {subject}
【核心考点】: {topic}

【相关法考大纲知识】:
\`\`\`markdown
{knowledgeContext}
\`\`\`

【单选题】
题干：{singleQuestion}
学生作答：{singleAnswer} | 正确答案：{singleCorrect}

【多选题】
题干：{multiQuestion}
学生作答：{multiAnswer} | 正确答案：{multiCorrect}

【分析要求】
1. **错因剖析**：聚焦于学生做错的题目，逐一拆解每个干扰项的陷阱类型（偷换概念/以偏概全/脑补情节/张冠李戴/混淆条件/时间错位等），指出命题人常设的套路。
2. **思维提升**：遇到此类陷阱时应如何快速识别？给出具体的判断技巧和思维路径，帮助学生建立"命题人视角"。
3. **秒杀口诀**：总结该考点的一句精简独家口诀，帮助学生加深记忆、快速解题。
4. **知识延伸**：补充1-2个该考点的易混淆知识点或关联考点，构建知识网络。
5. **如果学生全部答对**：给予肯定，并补充该考点的进阶易错点和命题新趋势。`,

  'subjective-judge': `你是一位资深法考主观题阅卷组专家。请按照官方阅卷标准，对以下学生答卷进行专业评分和深度点评。

【科目领域】: {subject}
【核心考点】: {topic}

【相关法考大纲知识】:
{knowledgeContext}

【案情材料】:
{caseText}

【问题】:
{question}

【学生答卷】:
{answer}

--------------------------------------------------
【阅卷任务要求】:
1. **得分点分析**：列出本题的所有采分点，逐一标注学生答对/答错/遗漏的情况。
2. **评分与理由**：给出预估分数（满分30分），并详细说明每处扣分原因。
3. **答题规范点评**：指出学生在答题结构、法条引用准确性、逻辑表达清晰度等方面的问题。
4. **改进建议**：提供一份"参考答案要点"，指导学生如何组织更完美的答案（包括答题结构、关键法条、论证逻辑）。
5. **知识延伸**：针对该考点，补充1-2个易混淆或易遗漏的知识点，帮助学生完善知识体系。

【重要】请在完成上述评判报告后，在最后单独附加一行以下 JSON 格式的评分信息（不要添加任何额外说明文字在 JSON 前后）：

{"score": [预估得分数字, 30], "referenceAnswer": "参考答案要点，包含核心采分点和法律依据"}`,

  'objective-generate': `你是一位法考命题研究专家。请根据以下科目和考点，生成高质量的法考客观题模拟题。

【科目领域】: {subject}
【核心考点】: {topic}

【相关法考大纲知识】:
\`\`\`markdown
{knowledgeContext}
\`\`\`

【出题要求】:
- 生成1道单选题和1道多选题
- 题干要贴近法考真题风格，案情或情境设置要具有实务感
- 选项设计要包含典型的法考陷阱（如偷换概念、脑补情节、张冠李戴、混淆条件等）
- 难度适中偏上，符合近年法考真题难度
- 正确答案要有充分的法律依据，解释要清晰透彻
- 输出格式必须为以下JSON格式：

{
  "single": {
    "question": "单选题题干",
    "options": [
      {"label": "A", "text": "选项A内容"},
      {"label": "B", "text": "选项B内容"},
      {"label": "C", "text": "选项C内容"},
      {"label": "D", "text": "选项D内容"}
    ],
    "correctAnswer": "A",
    "explanation": "解析内容"
  },
  "multiple": {
    "question": "多选题题干",
    "options": [
      {"label": "A", "text": "选项A内容"},
      {"label": "B", "text": "选项B内容"},
      {"label": "C", "text": "选项C内容"},
      {"label": "D", "text": "选项D内容"}
    ],
    "correctAnswer": ["A", "B"],
    "explanation": "解析内容"
  }
}`,

  'subjective-generate': `你是一位法考主观题命题研究专家。请根据以下科目和考点，生成高质量的法考主观题模拟案例。

【科目领域】: {subject}
【核心考点】: {topic}

【相关法考大纲知识】:
\`\`\`markdown
{knowledgeContext}
\`\`\`

【出题要求】:
- 生成1道主观题案例，包含案情材料和问题
- 案情要贴近法考真题风格，具有实务感和争议性
- 问题要能够考察学生对该考点的深度理解和法律分析能力
- 输出格式必须为以下JSON格式：

{
  "caseText": "案情材料",
  "question": "问题"
}`,
}

function load(): Partial<Record<PromptKey, string>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { }
  return {}
}

const custom = reactive<Partial<Record<PromptKey, string>>>(load())

watchEffect(() => {
  const filtered: Partial<Record<PromptKey, string>> = {}
  for (const key of Object.keys(custom) as PromptKey[]) {
    if (custom[key]) filtered[key] = custom[key]
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
})

function save(key: PromptKey, text: string) {
  custom[key] = text
}

function removeCustom(key: PromptKey) {
  delete custom[key]
}

function getPrompt(key: PromptKey): string {
  return custom[key] || DEFAULT_PROMPTS[key] || ''
}

function hasCustom(key: PromptKey): boolean {
  return !!custom[key]
}

export function getKnowledgeContext(subjectName: string): string {
  const module = knowledgeModules.find(m => m.name === subjectName)
  return module?.content || ''
}

export function buildPrompt(
  key: PromptKey,
  subjectName: string,
  topicName: string,
  scope: 'topic' | 'subject' | 'paper' = 'topic',
  extraReplacements: Record<string, string> = {}
): string {
  let basePrompt = getPrompt(key)
  const knowledgeContext = getKnowledgeContext(subjectName)

  if (scope === 'subject') {
    basePrompt = basePrompt.replace(/【核心考点】: \{topic\}/g, '【出题范围】: 科目综合（可涵盖该科目任意考点）')
  } else if (scope === 'paper') {
    basePrompt = basePrompt.replace(/【科目领域】: \{subject\}/g, '【出题范围】: 整卷综合')
      .replace(/【核心考点】: \{topic\}/g, '【出题范围】: 整卷综合（可涵盖该试卷任意科目的任意考点）')
  }

  let prompt = basePrompt
    .replace(/\{subject\}/g, subjectName)
    .replace(/\{topic\}/g, topicName)
    .replace(/\{knowledgeContext\}/g, knowledgeContext)

  for (const [k, v] of Object.entries(extraReplacements)) {
    const regex = new RegExp(`\\{${k}\\}`, 'g')
    prompt = prompt.replace(regex, v)
  }

  return prompt
}

export function usePromptStore() {
  return {
    custom,
    defaults: DEFAULT_PROMPTS,
    save,
    removeCustom,
    getPrompt,
    hasCustom,
    getKnowledgeContext,
    buildPrompt,
  }
}

export { getPrompt }
