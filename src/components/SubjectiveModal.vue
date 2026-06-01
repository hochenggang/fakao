<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import {
  NModal, NIcon, NCard, NInput, NButton, NTag, NSpin, NAlert, NDivider
} from 'naive-ui'
import { Edit16Regular } from '@vicons/fluent'
import { marked } from 'marked'
import type { SubjectiveQuestion } from '@/types'
import { useClipboard } from '@/composables/useClipboard'
import { useRuntimeMode } from '@/composables/useRuntimeMode'
import { useSettings } from '@/composables/useSettings'
import { useAiCall } from '@/composables/useAiCall'
import { getPrompt } from '@/composables/usePromptStore'
import { useWrongBook } from '@/composables/useWrongBook'

interface Props {
  show: boolean
  subjectId: string
  subjectName: string
  topicId: string
  topicName: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'copied'): void
}>()

const { copyText } = useClipboard()
const { isNormalMode } = useRuntimeMode()
const { settings } = useSettings()
const { streamChat } = useAiCall()
const { add: addWrongBook } = useWrongBook()

const question = ref<SubjectiveQuestion | null>(null)
const answer = ref('')
const aiJudging = ref(false)
const aiResult = ref('')
const showAiResult = ref(false)
const generating = ref(false)
const generateError = ref('')
const score = ref<[number, number] | null>(null)
const referenceAnswer = ref('')

const renderedAiResult = computed(() => {
  if (!aiResult.value) return ''
  return marked.parse(aiResult.value)
})

const renderedReferenceAnswer = computed(() => {
  if (!referenceAnswer.value) return ''
  return marked.parse(referenceAnswer.value)
})

// SSE Modal states
const showStreamModal = ref(false)
const streamingText = ref('')
const reasoningText = ref('')
const outputPreRef = ref<HTMLPreElement | null>(null)
const reasoningPreRef = ref<HTMLPreElement | null>(null)

watch(streamingText, () => {
  nextTick(() => {
    const el = outputPreRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
})

watch(reasoningText, () => {
  nextTick(() => {
    const el = reasoningPreRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
})

function openStreamModal() {
  streamingText.value = ''
  reasoningText.value = ''
  showStreamModal.value = true
}

function closeStreamModal() {
  showStreamModal.value = false
}

async function generateQuestion() {
  if (!isNormalMode.value) return
  generating.value = true
  generateError.value = ''
  question.value = null

  const provider = settings.value.providers[0]
  const model = provider.models[0]?.name

  const template = getPrompt('subjective-generate')
  const prompt = template
    .replace(/\{subject\}/g, props.subjectName)
    .replace(/\{topic\}/g, props.topicName)

  openStreamModal()
  streamingText.value = ''

  try {
    await streamChat(provider, model!, [{ role: 'user', content: prompt }], {
      onChunk(_, full) {
        streamingText.value = full
      },
      onThinking(_, full) {
        reasoningText.value = full
      },
      onFinish(full) {
        const match = full.match(/\{[\s\S]*\}/)
        if (match) {
          const data = JSON.parse(match[0])
          if (data.caseText && data.question) {
            question.value = {
              id: 'ai-subjective',
              subjectId: props.subjectId,
              topicId: props.topicId,
              caseText: data.caseText,
              question: data.question
            }
          }
        }
        closeStreamModal()
      },
    })
  } catch (e: any) {
    generateError.value = `出题失败：${e.message}`
    closeStreamModal()
  } finally {
    generating.value = false
  }
}

watch(() => props.show, (val) => {
  if (val) {
    reset()
    if (isNormalMode.value) {
      generateQuestion()
    }
  }
})

const handleSubmit = async () => {
  if (isNormalMode.value) {
    await handleAiJudge()
  } else {
    await handleCopyExam()
  }
}

const handleAiJudge = async () => {
  if (!question.value) return
  aiJudging.value = true
  aiResult.value = ''
  showAiResult.value = true
  score.value = null
  referenceAnswer.value = ''

  const provider = settings.value.providers[0]
  const model = provider.models[0]?.name

  const template = getPrompt('subjective-judge')
  const prompt = template
    .replace(/\{subject\}/g, props.subjectName)
    .replace(/\{topic\}/g, props.topicName)
    .replace(/\{caseText\}/g, question.value.caseText)
    .replace(/\{question\}/g, question.value.question)
    .replace(/\{answer\}/g, answer.value || '（学生未作答）')

  openStreamModal()

  try {
    await streamChat(provider, model!, [{ role: 'user', content: prompt }], {
      onChunk(_, full) {
        streamingText.value = full
      },
      onThinking(_, full) {
        reasoningText.value = full
      },
      onFinish(full) {
        let reportText = full
        let parsedScore: [number, number] | null = null
        let parsedRef = ''

        const jsonMatch = full.match(/\{[\s\S]*"score"[\s\S]*\}/)
        if (jsonMatch) {
          try {
            const data = JSON.parse(jsonMatch[0])
            if (Array.isArray(data.score) && data.score.length === 2) {
              parsedScore = [data.score[0], data.score[1]]
            }
            if (data.referenceAnswer) {
              parsedRef = data.referenceAnswer
            }
            reportText = full.slice(0, full.indexOf(jsonMatch[0])).trim()
          } catch {
            // ignore parse error
          }
        }

        aiResult.value = reportText
        score.value = parsedScore
        referenceAnswer.value = parsedRef
        aiJudging.value = false
        closeStreamModal()

        addWrongBook({
          id: `${props.subjectId}-${props.topicId}-${Date.now()}`,
          type: 'subjective',
          subjectName: props.subjectName,
          topicName: props.topicName,
          subjectId: props.subjectId,
          topicId: props.topicId,
          createdAt: Date.now(),
          caseText: question.value!.caseText,
          questionText: question.value!.question,
          answer: answer.value,
          aiJudgeResult: reportText,
          score: parsedScore || undefined,
          referenceAnswer: parsedRef || undefined,
          isWrong: true,
        })
      },
    })
  } catch (e: any) {
    aiJudging.value = false
    closeStreamModal()
    aiResult.value = `AI 评判出错：${e.message}\n\n请检查模型配置是否正确。`
  }
}

const buildCopyPrompt = (): string => {
  const q = question.value
  if (!q) return ''
  return `你是一位资深的中国国家统一法律职业资格考试（法考）主观题阅卷组专家。
请按照官方阅卷标准，对以下学生答卷进行专业评分和深度点评。

【科目领域】: ${props.subjectName}
【核心考点】: ${props.topicName}

【案情材料】:
${q.caseText}

【问题】:
${q.question}

【学生答卷】:
${answer.value || '（学生未作答）'}

--------------------------------------------------
【阅卷任务要求】:
1. **得分点分析**：列出本题的所有采分点，标注学生答对/答错/遗漏的情况。
2. **评分与理由**：给出预估分数（满分建议30分），并说明扣分原因。
3. **答题规范点评**：指出学生在答题结构、法条引用、逻辑表达等方面的问题。
4. **改进建议**：提供一份"参考答案要点"，指导学生如何组织更完美的答案。
5. **知识延伸**：针对该考点，补充1-2个易混淆或易遗漏的知识点。`
}

const handleCopyExam = async () => {
  if (!question.value) return
  const prompt = buildCopyPrompt()
  const success = await copyText(prompt)
  if (success) {
    emit('copied')
    emit('update:show', false)
    reset()
  }
}

const handleRegenerate = async () => {
  reset()
  await generateQuestion()
}

const reset = () => {
  answer.value = ''
  aiResult.value = ''
  showAiResult.value = false
  generateError.value = ''
  score.value = null
  referenceAnswer.value = ''
}

const handleClose = () => {
  emit('update:show', false)
  reset()
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    style="width: 840px; max-width: 90vw; max-height: 90vh; overflow: auto"
    :bordered="false"
    @update:show="handleClose"
  >
    <template #header>
      <div style="display: flex; align-items: center; gap: 8px">
        <n-icon>
          <Edit16Regular />
        </n-icon>
        <span>{{ subjectName }} · {{ topicName }}</span>
      </div>
    </template>

    <!-- AI 出题中 -->
    <div v-if="generating" style="display: flex; flex-direction: column; align-items: center; padding: 40px 0">
      <n-spin size="medium" />
      <div style="margin-top: 16px; color: #64748b; font-size: 14px">
        AI 正在为您生成案例题目，请稍候...
      </div>
    </div>

    <!-- 出题失败 -->
    <n-alert v-else-if="generateError" type="error" style="margin-bottom: 16px">
      {{ generateError }}
      <div style="margin-top: 8px">
        <n-button size="small" @click="generateQuestion">重试</n-button>
      </div>
    </n-alert>

    <!-- 降级模式提示 -->
    <n-alert v-else-if="!isNormalMode" type="warning" style="margin-bottom: 16px">
      降级模式下无法使用 AI 动态出题。请前往「设置」配置 AI 大语言模型。
    </n-alert>

    <!-- 题目内容 -->
    <template v-else-if="question">
      <!-- 案情区域 -->
      <div style="margin-bottom: 20px">
        <n-tag type="warning" size="small" style="margin-bottom: 10px">全真精选案情</n-tag>
        <div
          class="hide-scrollbar"
          style="
            max-height: 6.5rem;
            overflow-y: auto;
            padding: 16px;
            background: #f1f5f9;
            border-radius: 8px;
            font-size: 14px;
            line-height: 1.8;
            color: #334155;
          "
        >
          {{ question.caseText }}
        </div>
      </div>

      <!-- 问题 -->
      <div style="margin-bottom: 20px">
        <n-tag type="info" size="small" style="margin-bottom: 10px">问题</n-tag>
        <div style="font-size: 15px; font-weight: 600; color: #1e293b; line-height: 1.8">
          {{ question.question }}
        </div>
      </div>

      <!-- 作答区 -->
      <div style="margin-bottom: 20px">
        <n-tag type="success" size="small" style="margin-bottom: 10px">键盘流作答区</n-tag>
        <n-input
          v-model:value="answer"
          type="textarea"
          placeholder="请在此处输入你的答案...（模拟真实考试键盘输入作答体验）"
          :rows="10"
          style="font-size: 14px; line-height: 1.8"
        />
      </div>

      <!-- AI 评判结果区域 -->
      <div v-if="showAiResult && isNormalMode" style="margin-bottom: 20px">
        <n-divider />
        <!-- 得分展示 -->
        <div v-if="score" style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px">
          <div style="font-size: 14px; font-weight: 600; color: #1e293b">AI 评分</div>
          <n-tag
            size="large"
            :type="score[0] / score[1] >= 0.8 ? 'success' : score[0] / score[1] >= 0.6 ? 'warning' : 'error'"
          >
            {{ score[0] }} / {{ score[1] }} 分
          </n-tag>
          <span style="font-size: 13px; color: #64748b">
            （{{ Math.round((score[0] / score[1]) * 100) }}%）
          </span>
        </div>

        <!-- 参考答案 -->
        <div v-if="referenceAnswer" style="margin-bottom: 16px">
          <div style="font-size: 14px; font-weight: 600; color: #2563eb; margin-bottom: 8px">
            参考答案要点
          </div>
          <div
            class="ai-result"
            style="background: #f0fdf4; border: 1px solid #bbf7d0;"
            v-html="renderedReferenceAnswer"
          />
        </div>

        <div style="font-size: 14px; font-weight: 600; color: #2563eb; margin-bottom: 12px">
          AI 阅卷组专家点评
        </div>
        <n-spin v-if="aiJudging" size="small" />
        <div
          v-else
          class="ai-result"
          v-html="renderedAiResult"
        />
      </div>

      <!-- 操作按钮 -->
      <div style="display: flex; justify-content: center; gap: 12px; flex-wrap: wrap">
        <n-button type="primary" size="large" @click="handleSubmit">
          {{ isNormalMode ? 'AI 阅卷评判' : '复制考卷 (AI穿透式评分)' }}
        </n-button>
        <n-button
          v-if="isNormalMode && !aiJudging"
          secondary
          type="info"
          size="large"
          @click="handleRegenerate"
        >
          重新出题
        </n-button>
        <n-button size="large" @click="handleClose">
          关闭
        </n-button>
      </div>
    </template>
  </n-modal>

  <!-- SSE Stream Modal -->
  <n-modal
    v-model:show="showStreamModal"
    :mask-closable="false"
    preset="card"
    style="width: 680px; max-height: 80vh; overflow-y: auto;"
    :closable="false"
  >
    <div v-if="reasoningText" class="modal-reasoning">
      <div class="modal-section-label">思考过程</div>
      <pre ref="reasoningPreRef" class="modal-reasoning-content">{{ reasoningText }}</pre>
    </div>
    <div class="modal-output">
      <div class="modal-section-label">模型输出</div>
      <pre ref="outputPreRef" class="modal-output-content">{{ streamingText || '正在等待模型响应...' }}</pre>
    </div>
  </n-modal>
</template>

<style scoped>
.ai-result {
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.8;
  color: #334155;
  max-height: 400px;
  overflow-y: auto;
}

.ai-result :deep(h1),
.ai-result :deep(h2),
.ai-result :deep(h3) {
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
  margin: 16px 0 8px;
}

.ai-result :deep(p) {
  margin: 8px 0;
}

.ai-result :deep(strong) {
  font-weight: 600;
  color: #1e293b;
}

.ai-result :deep(ul),
.ai-result :deep(ol) {
  padding-left: 20px;
  margin: 8px 0;
}

.ai-result :deep(li) {
  margin: 4px 0;
}

.ai-result :deep(blockquote) {
  border-left: 3px solid #cbd5e1;
  padding-left: 12px;
  margin: 8px 0;
  color: #64748b;
}

.ai-result :deep(code) {
  background: #e2e8f0;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}

.ai-result :deep(pre) {
  background: #1e293b;
  color: #e2e8f0;
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
}

.modal-reasoning {
  margin-bottom: 16px;
}

.modal-section-label {
  font-size: 13px;
  font-weight: 600;
  color: #94a3b8;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.modal-reasoning-content {
  background: #ffffff;
  padding: 12px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.7;
  color: #475569;
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  border: 1px solid #e2e8f0;
}

.modal-output-content {
  background: #f8fafc;
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.7;
  color: #334155;
  max-height: 400px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  border: 1px solid #e2e8f0;
}
</style>
