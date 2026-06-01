<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  NModal, NIcon, NCard, NRadio, NRadioGroup, NCheckbox,
  NCheckboxGroup, NSpace, NButton, NDivider, NTag, NAlert, NSpin
} from 'naive-ui'
import { Edit16Regular } from '@vicons/fluent'
import { marked } from 'marked'
import type { ObjectiveQuestion } from '@/types'
import { useClipboard } from '@/composables/useClipboard'
import { useRuntimeMode } from '@/composables/useRuntimeMode'
import { useStreamChatWithModel } from '@/composables/useStreamChatWithModel'
import { buildPrompt } from '@/composables/usePromptStore'
import { useWrongBook } from '@/composables/useWrongBook'
import SseStreamModal from './SseStreamModal.vue'

export type PracticeScope = 'topic' | 'subject' | 'paper'

interface Props {
  show: boolean
  subjectId: string
  subjectName: string
  topicId: string
  topicName: string
  scope?: PracticeScope
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'copied'): void
  (e: 'ai-judged'): void
}>()

const { copyText } = useClipboard()
const { isNormalMode } = useRuntimeMode()
const { showStreamModal, streamingText, reasoningText, startStreamChat } = useStreamChatWithModel()
const { add: addWrongBook } = useWrongBook()

const singleQuestion = ref<ObjectiveQuestion | null>(null)
const multiQuestion = ref<ObjectiveQuestion | null>(null)
const singleAnswer = ref<string | null>(null)
const multiAnswer = ref<string[]>([])
const submitted = ref(false)
const aiJudging = ref(false)
const aiResult = ref('')
const showAiResult = ref(false)
const generating = ref(false)
const generateError = ref('')
const blurStream = ref(false)

const singleCorrect = computed(() => {
  if (!singleQuestion.value || !singleAnswer.value) return false
  return singleAnswer.value === singleQuestion.value.correctAnswer
})

const multiCorrect = computed(() => {
  if (!multiQuestion.value || multiAnswer.value.length === 0) return false
  const correct = multiQuestion.value.correctAnswer as string[]
  const user = multiAnswer.value
  return user.length === correct.length && user.every(a => correct.includes(a))
})

const allCorrect = computed(() => {
  const s = !singleQuestion.value || singleCorrect.value
  const m = !multiQuestion.value || multiCorrect.value
  return s && m
})

const renderedAiResult = computed(() => {
  if (!aiResult.value) return ''
  return marked.parse(aiResult.value)
})

async function generateQuestions() {
  if (!isNormalMode.value) return
  generating.value = true
  generateError.value = ''
  singleQuestion.value = null
  multiQuestion.value = null
  blurStream.value = true

  const scope = props.scope || 'topic'
  const prompt = buildPrompt('objective-generate', props.subjectName, props.topicName, scope)

  try {
    await startStreamChat({
      messages: [{ role: 'user', content: prompt }],
      onFinish: (full) => {
        const match = full.match(/\{[\s\S]*\}/)
        if (match) {
          const data = JSON.parse(match[0])
          if (data.single) {
            singleQuestion.value = {
              id: 'ai-single',
              subjectId: props.subjectId,
              topicId: props.topicId,
              type: 'single',
              ...data.single
            }
          }
          if (data.multiple) {
            multiQuestion.value = {
              id: 'ai-multiple',
              subjectId: props.subjectId,
              topicId: props.topicId,
              type: 'multiple',
              ...data.multiple
            }
          }
        }
        generating.value = false
      },
      onError: (error) => {
        generateError.value = `出题失败：${error.message}`
        generating.value = false
      }
    })
  } catch {
    generating.value = false
  }
}

watch(() => props.show, (val) => {
  if (val) {
    reset()
    if (isNormalMode.value) {
      blurStream.value = true
      generateQuestions()
    }
  }
})

const handleCheck = () => {
  submitted.value = true
}

const handleAiJudge = async () => {
  aiJudging.value = true
  aiResult.value = ''
  showAiResult.value = true
  blurStream.value = false


  const scope = props.scope || 'topic'
  const prompt = buildPrompt('objective-judge', props.subjectName, props.topicName, scope, {
    singleQuestion: singleQuestion.value?.question || '无',
    singleAnswer: singleAnswer.value || '未作答',
    singleCorrect: (singleQuestion.value?.correctAnswer as string) || '',
    multiQuestion: multiQuestion.value?.question || '无',
    multiAnswer: multiAnswer.value.length > 0 ? multiAnswer.value.join('、') : '未作答',
    multiCorrect: multiQuestion.value ? (multiQuestion.value.correctAnswer as string[]).join('、') : ''
  })

  try {
    await startStreamChat({
      messages: [{ role: 'user', content: prompt }],
      onFinish: (full) => {
        aiResult.value = full
        aiJudging.value = false
        emit('ai-judged')

        const hasWrong = (!singleCorrect.value && singleQuestion.value !== null) ||
          (!multiCorrect.value && multiQuestion.value !== null)
        if (hasWrong) {
          addWrongBook({
            id: `${props.subjectId}-${props.topicId}-${Date.now()}`,
            type: 'objective',
            subjectName: props.subjectName,
            topicName: props.topicName,
            subjectId: props.subjectId,
            topicId: props.topicId,
            createdAt: Date.now(),
            singleQuestion: singleQuestion.value,
            multiQuestion: multiQuestion.value,
            singleAnswer: singleAnswer.value,
            multiAnswer: multiAnswer.value,
            singleCorrect: singleCorrect.value,
            multiCorrect: multiCorrect.value,
            aiJudgeResult: full,
            isWrong: true,
          })
        }
      },
      onError: (error) => {
        aiJudging.value = false
        aiResult.value = `AI 评判出错：${error.message}\n\n请检查模型配置是否正确。`
      }
    })
  } catch (e: any) {
    aiJudging.value = false
    aiResult.value = `AI 评判出错：${e.message}\n\n请检查模型配置是否正确。`
  }
}

const buildCopyPrompt = (): string => {
  const sq = singleQuestion.value
  const mq = multiQuestion.value
  const scope = props.scope || 'topic'
  const scopeLabel = scope === 'paper' ? '整卷综合' : scope === 'subject' ? '科目综合' : props.topicName
  let text = `你是一位高胜率的中国国家统一法律职业资格考试（法考）客观题辅导名师。\n请对学生的如下做题结果、考点上下文进行精准错因剖析，指出干扰项的挖坑套路。\n\n【科目领域】: ${props.subjectName}\n【出题范围】: ${scopeLabel}\n\n`
  if (sq) {
    text += `【单选题干】: ${sq.question}\n【学生作答】: ${singleAnswer.value || '未作答'} | 【正确答案】: ${sq.correctAnswer}\n\n`
  }
  if (mq) {
    text += `【多选题干】: ${mq.question}\n【学生作答】: ${multiAnswer.value.length > 0 ? multiAnswer.value.join('、') : '未作答'} | 【正确答案】: ${Array.isArray(mq.correctAnswer) ? mq.correctAnswer.join('、') : mq.correctAnswer}\n\n`
  }
  text += `--------------------------------------------------\n【分析任务要求】:\n1. 聚焦于学生做错的题型。拆解选项中似是而非的错误表述，指出命题人在法考真题里常设的"偷换概念"或"脑补情节"陷阱。\n2. 总结该考点的一句精简独家"秒杀口诀"，帮助学生加深记忆。\n3. 如果学生全部答对，请给予肯定并补充该考点的易混淆点。`
  return text
}

const handleCopyAiPrompt = async () => {
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
  await generateQuestions()
}

const reset = () => {
  singleAnswer.value = null
  multiAnswer.value = []
  submitted.value = false
  aiResult.value = ''
  showAiResult.value = false
  generateError.value = ''
}

const handleClose = () => {
  emit('update:show', false)
  reset()
}
</script>

<template>
  <n-modal :show="show" preset="card" style="width: 760px; max-width: 90vw; max-height: 90vh; overflow: auto"
    :bordered="false" @update:show="handleClose">
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
        AI 正在为您生成题目，请稍候...
      </div>
    </div>

    <!-- 出题失败 -->
    <n-alert v-else-if="generateError" type="error" style="margin-bottom: 16px">
      {{ generateError }}
      <div style="margin-top: 8px">
        <n-button size="small" @click="generateQuestions">重试</n-button>
      </div>
    </n-alert>

    <!-- 降级模式提示 -->
    <n-alert v-else-if="!isNormalMode" type="warning" style="margin-bottom: 16px">
      降级模式下无法使用 AI 动态出题。请前往「设置」配置 AI 大语言模型。
    </n-alert>

    <!-- 题目内容 -->
    <template v-else>
      <div v-if="singleQuestion" style="margin-bottom: 24px">
        <n-tag type="info" size="small" style="margin-bottom: 12px">单选题</n-tag>
        <div style="font-size: 15px; line-height: 1.8; color: #1e293b; margin-bottom: 16px">
          {{ singleQuestion.question }}
        </div>
        <n-radio-group v-model:value="singleAnswer" :disabled="submitted">
          <n-space vertical>
            <n-radio v-for="opt in singleQuestion.options" :key="opt.label" :value="opt.label" :style="submitted ? {
              color: opt.label === singleQuestion.correctAnswer ? '#10b981' :
                (opt.label === singleAnswer && !singleCorrect) ? '#ef4444' : undefined
            } : {}">
              <span :style="submitted && opt.label === singleQuestion.correctAnswer ? 'color: #10b981; font-weight: 600' :
                submitted && opt.label === singleAnswer && !singleCorrect ? 'color: #ef4444' : ''">
                {{ opt.label }}. {{ opt.text }}
              </span>
            </n-radio>
          </n-space>
        </n-radio-group>
      </div>

      <n-divider v-if="singleQuestion && multiQuestion" />

      <div v-if="multiQuestion" style="margin-bottom: 24px">
        <n-tag type="warning" size="small" style="margin-bottom: 12px">多选题</n-tag>
        <div style="font-size: 15px; line-height: 1.8; color: #1e293b; margin-bottom: 16px">
          {{ multiQuestion.question }}
        </div>
        <n-checkbox-group v-model:value="multiAnswer" :disabled="submitted">
          <n-space vertical>
            <n-checkbox v-for="opt in multiQuestion.options" :key="opt.label" :value="opt.label">
              <span
                :style="submitted && (multiQuestion.correctAnswer as string[]).includes(opt.label) ? 'color: #10b981; font-weight: 600' :
                  submitted && multiAnswer.includes(opt.label) && !(multiQuestion.correctAnswer as string[]).includes(opt.label) ? 'color: #ef4444' : ''">
                {{ opt.label }}. {{ opt.text }}
              </span>
            </n-checkbox>
          </n-space>
        </n-checkbox-group>
      </div>

      <!-- 提交后显示对错结果 -->
      <n-alert v-if="submitted" :type="allCorrect ? 'success' : 'error'" style="margin: 16px 0"
        :title="allCorrect ? '全部答对！' : '有错题'">
        <div v-if="singleQuestion && !singleCorrect">
          单选题：你的答案 {{ singleAnswer || '未作答' }}，正确答案 {{ singleQuestion.correctAnswer }}
        </div>
        <div v-if="multiQuestion && !multiCorrect">
          多选题：你的答案 {{ multiAnswer.length ? multiAnswer.join('、') : '未作答' }}，正确答案 {{ (multiQuestion.correctAnswer as
            string[]).join('、') }}
        </div>
      </n-alert>

      <!-- AI 评判结果区域 -->
      <div v-if="showAiResult && isNormalMode" style="margin-top: 20px">
        <n-divider />
        <div style="font-size: 14px; font-weight: 600; color: #2563eb; margin-bottom: 12px">
          AI 深度评判报告
        </div>
        <n-spin v-if="aiJudging" size="small" />
        <div v-else class="ai-result" v-html="renderedAiResult" />
      </div>

      <div style="display: flex; justify-content: center; gap: 12px; margin-top: 24px; flex-wrap: wrap">
        <!-- 提交前 -->
        <n-button v-if="!submitted" type="primary" size="large" :disabled="!singleAnswer && multiAnswer.length === 0"
          @click="handleCheck">
          提交答案
        </n-button>

        <!-- 提交后：AI 深度评判 -->
        <n-button v-if="submitted && isNormalMode && !aiJudging && !aiResult" type="primary" size="large"
          @click="handleAiJudge">
          AI 深度评判
        </n-button>

        <!-- 降级模式：复制提示词 -->
        <n-button v-if="submitted && !isNormalMode" type="primary" size="large" @click="handleCopyAiPrompt">
          为我评判 (复制AI提示词)
        </n-button>

        <!-- AI 评判完成后：重新出题 -->
        <n-button v-if="submitted && isNormalMode && aiResult && !aiJudging" secondary type="info" size="large"
          @click="handleRegenerate">
          重新出题
        </n-button>

        <n-button size="large" @click="handleClose">
          关闭
        </n-button>
      </div>
    </template>
  </n-modal>

  <SseStreamModal v-model:show="showStreamModal" :streaming-text="streamingText" :reasoning-text="reasoningText"
    :blur="blurStream" />
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
</style>
