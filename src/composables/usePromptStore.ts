import type { ExamId, Subject, Topic } from '@/types/exam'
import { examById } from '@/data/exams'
import { knowledgeModules } from '@/data/knowledge'

// ──────────────────────────────────────────────────────────────────────────
//  类型
// ──────────────────────────────────────────────────────────────────────────

export type PromptScope = 'topic' | 'subject' | 'exam'

export type PromptKey =
  | 'objective-generate'
  | 'subjective-generate'
  | 'objective-judge'
  | 'subjective-judge'
  | 'keyword-memo'
  | 'keyword-evaluate'

export interface PromptContext {
  scope: PromptScope
  subject: Subject | null
  topic: Topic | null
  /** scope='topic': 含大纲 markdown;scope='subject': 科目级考点列表;scope='exam': 空字符串 */
  knowledgeContext: string
  /** scope='exam': 完整 Exam 的 JSON.stringify;其他场景: 空字符串 */
  examJson: string
  // 关键词背诵
  keyword?: string
  memoText?: string
  userRecall?: string
  // 客观题评卷
  singleQuestion?: string
  singleOptions?: string
  singleAnswer?: string | null
  singleCorrect?: string
  multiQuestion?: string
  multiOptions?: string
  multiAnswer?: string[] | string
  multiCorrect?: string[] | string
  // 主观题评卷
  caseText?: string
  question?: string
  answer?: string
}

// ──────────────────────────────────────────────────────────────────────────
//  System 提示词(全局身份)
// ──────────────────────────────────────────────────────────────────────────

export const SYSTEM_PROMPT: string = `你是一位资深的中国国家统一法律职业资格考试(法考)辅导名师,同时也是一位深谙命题人心理的考试策略专家。

你具备以下核心能力:
1. 精准拆解法考真题的干扰项陷阱(偷换概念、脑补情节、张冠李戴、混淆条件、以偏概全、时间错位)
2. 提炼每个考点的"秒杀口诀"和快速判断技巧
3. 从思维层面帮助学生建立"命题人视角",理解为什么这个选项是错的
4. 补充相关易混淆知识点,构建知识网络
5. 针对主观题,严格按照官方阅卷标准进行专业评分和深度点评

回答风格:专业、精准、有深度,善于用通俗语言解释复杂法律概念。`

// ──────────────────────────────────────────────────────────────────────────
//  知识上下文工具
// ──────────────────────────────────────────────────────────────────────────

function findModule(subjectName: string) {
  return knowledgeModules.find(m => m.name === subjectName)
}

export function buildKnowledgeContext(
  subject: Subject | null,
  topic: Topic | null,
  scope: PromptScope,
): string {
  if (scope === 'topic' && topic && subject) {
    const mod = findModule(subject.name)
    const knowledgeBase = mod?.content || ''
    return [
      `【科目】${subject.name}`,
      `【考点】${topic.name}`,
      `【考点关键词】${topic.keywords.join('、')}`,
      '',
      '【相关法考大纲知识】',
      knowledgeBase,
    ].join('\n')
  }
  if (scope === 'subject' && subject) {
    const topicsText = subject.topics
      .map(t => `- ${t.name}(关键词:${t.keywords.join('、')})`)
      .join('\n')
    return `【科目】${subject.name}\n\n【涵盖考点】\n${topicsText}`
  }
  return ''
}

export function buildExamJson(examId: ExamId): string {
  const exam = examById(examId)
  return exam ? JSON.stringify(exam, null, 2) : ''
}

// ──────────────────────────────────────────────────────────────────────────
//  在 exam 数据中根据 subjectId + topicId 反查真实 Subject / Topic。
//  整卷演练场景下 LLM 仅返回 ID,前端用此函数从原始数据回查名称,
//  避免 LLM 名称漂移。
// ──────────────────────────────────────────────────────────────────────────

export function findSubjectTopic(
  examId: ExamId,
  subjectId: string,
  topicId: string,
): { subject: Subject; topic: Topic } | null {
  if (!subjectId || !topicId) return null
  const exam = examById(examId)
  const subject = exam?.subjects.find(s => s.id === subjectId)
  const topic = subject?.topics.find(t => t.id === topicId)
  return subject && topic ? { subject, topic } : null
}

// ──────────────────────────────────────────────────────────────────────────
//  6 个业务提示词
//  每个函数内部按 scope 分支,直接使用模板字面量拼接,
//  不再走任何正则改写。
// ──────────────────────────────────────────────────────────────────────────

const TRAPS = '偷换概念 / 脑补情节 / 张冠李戴 / 混淆条件 / 以偏概全 / 时间错位'

const JSON_OUTPUT_RULE = `【严格输出要求 — 必须遵守,否则视为失败】:
- 你的整个回复只能是一段合法 JSON 对象,且第一字符必须是 {,最后一字符必须是 }。
- 不要在 JSON 前后添加任何文字、说明、代码块标记 \`\`\`、注释、Markdown 标题、空行、问候语。
- JSON 内的字符串中如出现英文双引号请改用「」或『』;换行用 \\n 表示。`

function formatJoin(value: string[] | string | undefined, sep = '、'): string {
  if (!value) return ''
  return Array.isArray(value) ? value.join(sep) : value
}

// ── objective-generate ──
const objectiveGenerate = (ctx: PromptContext): string => {
  const schema = `{
  "subjectId": "subjectId",
  "subjectName": "subjectName",
  "topicId": "topicId",
  "topicName": "topicName",
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
}`

  if (ctx.scope === 'exam') {
    return `你是法考命题研究专家。请基于下方完整试卷结构,从任意科目与考点中任选其一,生成 1 道高质量单选题 + 1 道高质量多选题。

【试卷完整结构(JSON)】:
\`\`\`json
${ctx.examJson}
\`\`\`

【出题要求】:
- 从上方 JSON 的 subjects 中任选一个 subject,再从该 subject 的 topics 中任选一个 topic
- subjectId / topicId 必须真实存在于上方 JSON 中
- 题干贴近法考真题风格,案情/情境要具有实务感
- 选项设计要包含典型法考陷阱(${TRAPS})
- 难度适中偏上,符合近年法考真题难度
- 正确答案要有充分法律依据,解释清晰透彻
- 单选 4 个选项 A/B/C/D;多选 4 个选项 A/B/C/D

${JSON_OUTPUT_RULE}
- JSON 字段说明:
  - subjectId / subjectName: 所选 subject 的 id 与 name(必须取自上方 JSON)
  - topicId / topicName: 所选 topic 的 id 与 name(必须取自上方 JSON)
  - single.correctAnswer: 字符串,值为 "A" / "B" / "C" / "D" 之一
  - multiple.correctAnswer: 字符串数组,值为 "A"/"B"/"C"/"D" 的子集
- 示例结构(仅说明字段,不要照抄):
  ${schema}`
  }

  if (ctx.scope === 'subject') {
    const subjectName = ctx.subject?.name ?? ''
    return `你是法考命题研究专家。请按"科目综合"模式:围绕下方科目涵盖的任意考点,生成 1 道单选题 + 1 道多选题。

【科目】: ${subjectName}

【涵盖考点】:
${ctx.knowledgeContext}

【出题要求】:
- 从上方考点列表中任选一个 topic 作为本次出题目标
- 题干贴近法考真题风格,案情/情境要具有实务感
- 选项设计要包含典型法考陷阱(${TRAPS})
- 难度适中偏上
- 正确答案要有充分法律依据,解释清晰透彻
- 单选 4 个选项 A/B/C/D;多选 4 个选项 A/B/C/D

${JSON_OUTPUT_RULE}
- JSON 字段说明:
  - subjectId / subjectName: 取自上方考点所属科目
  - topicId / topicName: 取自上方考点列表中实际命中的那一项
  - single.correctAnswer: 字符串 "A"/"B"/"C"/"D" 之一
  - multiple.correctAnswer: 字符串数组
- 示例结构(仅说明字段,不要照抄):
  ${schema}`
  }

  // topic scope
  const subjectName = ctx.subject?.name ?? ''
  const topicName = ctx.topic?.name ?? ''
  const subjectId = ctx.subject?.id ?? ''
  const topicId = ctx.topic?.id ?? ''
  return `你是法考命题研究专家。请围绕下方指定科目与考点,生成 1 道单选题 + 1 道多选题。

【科目】: ${subjectName}
【核心考点】: ${topicName}

【相关法考大纲知识】:
\`\`\`markdown
${ctx.knowledgeContext}
\`\`\`

【出题要求】:
- 紧密围绕(${subjectName} | ${topicName})命题,不得偏离
- 题干贴近法考真题风格,案情/情境要具有实务感
- 选项设计要包含典型法考陷阱(${TRAPS})
- 难度适中偏上
- 正确答案要有充分法律依据,解释清晰透彻
- 单选 4 个选项 A/B/C/D;多选 4 个选项 A/B/C/D

${JSON_OUTPUT_RULE}
- JSON 字段说明:
  - subjectId / subjectName: 取自上方【科目】
  - topicId / topicName: 取自上方【核心考点】
  - single.correctAnswer: 字符串 "A"/"B"/"C"/"D" 之一
  - multiple.correctAnswer: 字符串数组
- 示例结构(仅说明字段,不要照抄):
  ${schema.replace('"subjectId": "subjectId"', `"subjectId": "${subjectId}"`).replace('"subjectName": "subjectName"', `"subjectName": "${subjectName}"`).replace('"topicId": "topicId"', `"topicId": "${topicId}"`).replace('"topicName": "topicName"', `"topicName": "${topicName}"`)}`
}

// ── subjective-generate ──
const subjectiveGenerate = (ctx: PromptContext): string => {
  const schema = `{
  "subjectId": "subjectId",
  "subjectName": "subjectName",
  "topicId": "topicId",
  "topicName": "topicName",
  "caseText": "案情材料",
  "question": "问题"
}`

  if (ctx.scope === 'exam') {
    return `你是法考主观题命题研究专家。请基于下方完整试卷结构,从任意科目与考点中任选其一,生成 1 道高质量主观题案例。

【试卷完整结构(JSON)】:
\`\`\`json
${ctx.examJson}
\`\`\`

【出题要求】:
- 从上方 JSON 的 subjects 中任选一个 subject,再从该 subject 的 topics 中任选一个 topic
- subjectId / topicId 必须真实存在于上方 JSON 中
- 案情要贴近法考真题风格,具有实务感和争议性
- 问题要能考察学生对该考点的深度理解和法律分析能力
- 不要附带答案或解析,阅卷环节会独立进行

${JSON_OUTPUT_RULE}
- JSON 字段说明:
  - subjectId / subjectName: 所选 subject 的 id 与 name(取自上方 JSON)
  - topicId / topicName: 所选 topic 的 id 与 name(取自上方 JSON)
  - caseText: 案情材料(注意题目不要写"参考答案"等元信息)
  - question: 问题
- 示例结构(仅说明字段,不要照抄):
  ${schema}`
  }

  if (ctx.scope === 'subject') {
    const subjectName = ctx.subject?.name ?? ''
    return `你是法考主观题命题研究专家。请按"科目综合"模式:围绕下方科目涵盖的任意考点,生成 1 道主观题案例。

【科目】: ${subjectName}

【涵盖考点】:
${ctx.knowledgeContext}

【出题要求】:
- 从上方考点列表中任选一个 topic 作为本次出题目标
- 案情贴近法考真题风格,具有实务感和争议性
- 问题要能考察学生对该考点的深度理解和法律分析能力
- 不要附带答案或解析

${JSON_OUTPUT_RULE}
- JSON 字段说明:
  - subjectId / subjectName: 取自上方考点所属科目
  - topicId / topicName: 取自上方考点列表中实际命中的那一项
  - caseText: 案情材料
  - question: 问题
- 示例结构(仅说明字段,不要照抄):
  ${schema}`
  }

  // topic scope
  const subjectName = ctx.subject?.name ?? ''
  const topicName = ctx.topic?.name ?? ''
  const subjectId = ctx.subject?.id ?? ''
  const topicId = ctx.topic?.id ?? ''
  return `你是法考主观题命题研究专家。请围绕下方指定科目与考点,生成 1 道主观题案例。

【科目】: ${subjectName}
【核心考点】: ${topicName}

【相关法考大纲知识】:
\`\`\`markdown
${ctx.knowledgeContext}
\`\`\`

【出题要求】:
- 紧密围绕(${subjectName} | ${topicName})命题
- 案情贴近法考真题风格,具有实务感和争议性
- 问题要能考察学生对该考点的深度理解和法律分析能力
- 不要附带答案或解析

${JSON_OUTPUT_RULE}
- JSON 字段说明:
  - subjectId / subjectName: 取自上方【科目】
  - topicId / topicName: 取自上方【核心考点】
  - caseText: 案情材料
  - question: 问题
- 示例结构(仅说明字段,不要照抄):
  ${schema.replace('"subjectId": "subjectId"', `"subjectId": "${subjectId}"`).replace('"subjectName": "subjectName"', `"subjectName": "${subjectName}"`).replace('"topicId": "topicId"', `"topicId": "${topicId}"`).replace('"topicName": "topicName"', `"topicName": "${topicName}"`)}`
}

// ── objective-judge ──
const objectiveJudge = (ctx: PromptContext): string => {
  const subjectName = ctx.subject?.name ?? '（未指定）'
  const topicName = ctx.topic?.name ?? '（未指定）'

  const header = ctx.scope === 'exam'
    ? `【试卷完整结构(JSON)】:\n\`\`\`json\n${ctx.examJson}\n\`\`\``
    : ctx.scope === 'subject'
      ? `【科目】: ${subjectName}\n【涵盖考点】:\n${ctx.knowledgeContext}`
      : `【科目】: ${subjectName}\n【核心考点】: ${topicName}\n\n【相关法考大纲知识】:\n\`\`\`markdown\n${ctx.knowledgeContext}\n\`\`\``

  return `请对学生的法考客观题做题结果进行精准错因剖析,并给出思维提升建议。

${header}

【单选题】
题干:${ctx.singleQuestion ?? '（无）'}
选项:
${ctx.singleOptions ?? '（无）'}
学生作答:${ctx.singleAnswer ?? '未作答'} | 正确答案:${ctx.singleCorrect ?? ''}

【多选题】
题干:${ctx.multiQuestion ?? '（无）'}
选项:
${ctx.multiOptions ?? '（无）'}
学生作答:${formatJoin(ctx.multiAnswer)} | 正确答案:${formatJoin(ctx.multiCorrect)}

【分析任务】:
1. 错因剖析:聚焦做错的题,逐一拆解每个干扰项的陷阱类型(${TRAPS}),指出命题人常设的套路。
2. 思维提升:遇到此类陷阱应如何快速识别?给出具体的判断技巧和思维路径,帮助学生建立"命题人视角"。
3. 秒杀口诀:总结该考点的一句精简独家口诀,帮助学生加深记忆、快速解题。
4. 知识延伸:补充 1-2 个该考点的易混淆知识点或关联考点,构建知识网络。
5. 如果学生全部答对:给予肯定,并补充该考点的进阶易错点和命题新趋势。

${JSON_OUTPUT_RULE}
- JSON 字段说明:
  - report: 完整的 markdown 格式评判报告(涵盖上述 5 个分析任务),用 \\n 表示换行
  - score: 客观题无评分,固定为 null
  - referenceAnswer: 客观题无参考答案,固定为 null
- 示例结构(仅说明字段,不要照抄):
  {"report":"# 一、错因剖析\\n……","score":null,"referenceAnswer":null}`
}

// ── subjective-judge ──
const subjectiveJudge = (ctx: PromptContext): string => {
  const subjectName = ctx.subject?.name ?? '（未指定）'
  const topicName = ctx.topic?.name ?? '（未指定）'

  const header = ctx.scope === 'exam'
    ? `【试卷完整结构(JSON)】:\n\`\`\`json\n${ctx.examJson}\n\`\`\``
    : ctx.scope === 'subject'
      ? `【科目】: ${subjectName}\n【涵盖考点】:\n${ctx.knowledgeContext}`
      : `【科目】: ${subjectName}\n【核心考点】: ${topicName}\n\n【相关法考大纲知识】:\n${ctx.knowledgeContext}`

  return `你是法考主观题阅卷组专家。请按官方阅卷标准对以下学生答卷进行专业评分和深度点评。

${header}

【案情材料】: ${ctx.caseText ?? '（无）'}
【问题】: ${ctx.question ?? '（无）'}
【学生答卷】: ${ctx.answer ?? '（学生未作答）'}

【阅卷任务】:
1. 得分点分析:列出本题所有采分点,逐一标注学生答对 / 答错 / 遗漏的情况。
2. 评分与理由:给出预估分数(满分 30 分),详细说明每处扣分原因。
3. 答题规范点评:指出学生在答题结构、法条引用准确性、逻辑表达清晰度等方面的问题。
4. 改进建议:提供一份"参考答案要点",指导学生如何组织更完美的答案(包括答题结构、关键法条、论证逻辑)。
5. 知识延伸:针对该考点补充 1-2 个易混淆或易遗漏的知识点。

${JSON_OUTPUT_RULE}
- JSON 字段说明:
  - report: 完整的 markdown 格式评判报告(涵盖上述 5 个任务),用 \\n 表示换行
  - score: 固定为 [预估得分数字, 30] 两元素数组
  - referenceAnswer: 参考答案要点(markdown 格式),用 \\n 表示换行
- 示例结构(仅说明字段,不要照抄):
  {"report":"# 一、得分点分析\\n……","score":[25,30],"referenceAnswer":"# 参考答案\\n……"}`
}

// ── keyword-memo ──
const keywordMemo = (ctx: PromptContext): string => {
  return `你是法考辅导名师。请围绕下方指定科目、考点、关键词,输出一段"考点必背"纯文本。

【科目】: ${ctx.subject?.name ?? ''}
【考点】: ${ctx.topic?.name ?? ''}
【关键词】: ${ctx.keyword ?? ''}

【相关法考大纲知识】:
\`\`\`markdown
${ctx.knowledgeContext}
\`\`\`

【要求】:
1. 简洁、结构清晰、便于背诵,不超过 300 字。
2. 包含核心概念 + 关键构成要件 + 易混淆点 + 一句秒杀口诀。
3. 不要输出 JSON、不要代码块标记、不要 Markdown 标题。
4. 用换行分段即可。`
}

// ── keyword-evaluate ──
const keywordEvaluate = (ctx: PromptContext): string => {
  return `你是法考辅导阅卷专家。学生在默写"考点必背"时可能漏点、错点或加入自己的理解,请对学生默写进行精准评析。

【科目】: ${ctx.subject?.name ?? ''}
【考点】: ${ctx.topic?.name ?? ''}
【关键词】: ${ctx.keyword ?? ''}

【原必背内容】:
${ctx.memoText ?? ''}

【学生默写】:
${ctx.userRecall ?? ''}

【相关法考大纲知识】:
\`\`\`markdown
${ctx.knowledgeContext}
\`\`\`

【评析要求】:
1. 漏点清单:逐条列出原必背中出现但学生漏掉的内容。
2. 错点清单:学生写错或有偏差之处。
3. 加分项:学生补充得当、值得肯定的内容。
4. 综合点评:一段简短的鼓励 + 改进建议。
5. 不要输出 JSON、不要代码块标记、不要 Markdown 标题,仅输出纯文本(用换行分段)。`
}

// ──────────────────────────────────────────────────────────────────────────
//  统一入口
// ──────────────────────────────────────────────────────────────────────────

const PROMPT_FNS: Record<PromptKey, (ctx: PromptContext) => string> = {
  'objective-generate': objectiveGenerate,
  'subjective-generate': subjectiveGenerate,
  'objective-judge': objectiveJudge,
  'subjective-judge': subjectiveJudge,
  'keyword-memo': keywordMemo,
  'keyword-evaluate': keywordEvaluate,
}

export function buildPrompt(key: PromptKey, ctx: PromptContext): string {
  const fn = PROMPT_FNS[key]
  if (!fn) throw new Error(`Unknown prompt key: ${key}`)
  return fn(ctx)
}
