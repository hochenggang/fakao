<script setup lang="ts">
import { ref, computed, watch, toRef } from 'vue'
import {
  NModal, NSpin, NAlert, NButton, NInput, NRadio, NRadioGroup, NCheckbox, NCheckboxGroup,
  NDivider, NTag, NSpace, useMessage, NIcon, NEmpty
} from 'naive-ui'
import { Edit16Regular } from '@vicons/fluent'
import { marked } from 'marked'
import type { ExamId, Subject, Topic } from '@/types/exam'
import {
  usePracticeFlow,
  type PracticeScope,
  type ObjectiveGenerateOut,
  type SubjectiveGenerateOut,
  type JudgeOut,
} from '@/composables/usePracticeFlow'
import { useWrongBook } from '@/composables/useWrongBook'
import { usePracticeTracker } from '@/composables/usePracticeTracker'
import { useRuntimeMode } from '@/composables/useRuntimeMode'

interface Props {
  show: boolean
  openKey: number
  examId: ExamId
  subject: Subject
  topic: Topic
  scope: PracticeScope
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
  (e: 'practice-recorded', subjectId: string, topicId: string, kind: 'objective' | 'subjective'): void
}>()

const message = useMessage()
const { isNormalMode } = useRuntimeMode()
const flow = usePracticeFlow(toRef(props, 'examId'))
const { add: addWrong } = useWrongBook()
const { record: recordPractice } = usePracticeTracker()

const isSubjective = computed(() => props.examId === 'exam3')
const kind = computed<'objective' | 'subjective'>(() => (isSubjective.value ? 'subjective' : 'objective'))

const generating = ref(false)
const judging = ref(false)
const submitted = ref(false)
const error = ref('')

const singleQ = ref<ObjectiveGenerateOut['single'] | null>(null)
const multiQ = ref<ObjectiveGenerateOut['multiple'] | null>(null)
const subjectiveQ = ref<SubjectiveGenerateOut | null>(null)

const actualTopicId = ref(props.topic.id)
const actualTopicName = ref(props.topic.name)

const singleAnswer = ref<string | null>(null)
const multiAnswer = ref<string[]>([])
const subjectiveAnswer = ref('')

const aiResult = ref<JudgeOut | null>(null)

const singleCorrect = computed(() => {
  if (!singleQ.value || !singleAnswer.value) return false
  return singleAnswer.value === singleQ.value.correctAnswer
})
const multiCorrect = computed(() => {
  if (!multiQ.value || multiAnswer.value.length === 0) return false
  const correct = multiQ.value.correctAnswer
  const user = multiAnswer.value
  return user.length === correct.length && user.every(a => correct.includes(a))
})
const allObjectiveCorrect = computed(() => {
  return (!singleQ.value || singleCorrect.value) && (!multiQ.value || multiCorrect.value)
})

const renderedReport = computed(() => {
  if (!aiResult.value?.report) return ''
  return marked.parse(aiResult.value.report)
})
const renderedReference = computed(() => {
  if (!aiResult.value?.referenceAnswer) return ''
  return marked.parse(aiResult.value.referenceAnswer)
})

const score = computed(() => aiResult.value?.score)

function reset() {
  error.value = ''
  generating.value = false
  judging.value = false
  submitted.value = false
  singleQ.value = null
  multiQ.value = null
  subjectiveQ.value = null
  singleAnswer.value = null
  multiAnswer.value = []
  subjectiveAnswer.value = ''
  aiResult.value = null
  actualTopicId.value = props.topic.id
  actualTopicName.value = props.topic.name
}

async function doGenerate() {
  generating.value = true
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
  } finally {
    generating.value = false
  }
}

watch(() => props.openKey, async (k) => {
  if (k > 0 && isNormalMode.value) {
    reset()
    await doGenerate()
  }
})

async function handleObjectiveSubmit() {
  if (!singleAnswer.value && multiAnswer.value.length === 0) return
  submitted.value = true
}

async function handleJudge() {
  judging.value = true
  error.value = ''
  try {
    let extras: Record<string, string>
    if (isSubjective.value && subjectiveQ.value) {
      extras = {
        caseText: subjectiveQ.value.caseText,
        question: subjectiveQ.value.question,
        answer: subjectiveAnswer.value || '（学生未作答）',
      }
    } else {
      const singleOpts = singleQ.value
        ? singleQ.value.options.map(o => `${o.label}. ${o.text}`).join('\n')
        : '（无）'
      const multiOpts = multiQ.value
        ? multiQ.value.options.map(o => `${o.label}. ${o.text}`).join('\n')
        : '（无）'
      extras = {
        singleQuestion: singleQ.value?.question || '（无）',
        singleOptions: singleOpts,
        singleAnswer: singleAnswer.value || '未作答',
        singleCorrect: singleQ.value?.correctAnswer || '',
        multiQuestion: multiQ.value?.question || '（无）',
        multiOptions: multiOpts,
        multiAnswer: multiAnswer.value.length > 0 ? multiAnswer.value.join('、') : '未作答',
        multiCorrect: multiQ.value ? multiQ.value.correctAnswer.join('、') : '',
      }
    }
    const r = await flow.judge(props.subject, props.topic, props.scope, extras)
    aiResult.value = r

    if (isSubjective.value && subjectiveQ.value) {
      addWrong({
        examId: props.examId,
        type: 'subjective',
        subjectId: props.subject.id,
        topicId: actualTopicId.value,
        subjectName: props.subject.name,
        topicName: actualTopicName.value,
        caseText: subjectiveQ.value.caseText,
        questionText: subjectiveQ.value.question,
        answer: subjectiveAnswer.value,
        aiJudgeResult: r.report,
        score: r.score,
        referenceAnswer: r.referenceAnswer,
        isWrong: true,
      })
    } else {
      addWrong({
        examId: props.examId,
        type: 'objective',
        subjectId: props.subject.id,
        topicId: actualTopicId.value,
        subjectName: props.subject.name,
        topicName: actualTopicName.value,
        singleQuestion: singleQ.value || undefined,
        multiQuestion: multiQ.value || undefined,
        singleAnswer: singleAnswer.value,
        multiAnswer: [...multiAnswer.value],
        singleCorrect: singleCorrect.value,
        multiCorrect: multiCorrect.value,
        aiJudgeResult: r.report,
        isWrong: !allObjectiveCorrect.value,
      })
    }

    message.success('AI 评判完成')
  } catch (e: any) {
    error.value = `AI 评判出错：${e?.message || '未知错误'}\n\n请检查模型配置是否正确。`
  } finally {
    judging.value = false
  }
}

async function handleRegenerate() {
  reset()
  await doGenerate()
}

function handleClose() {
  emit('update:show', false)
  reset()
}
</script>

<template>
  <n-modal :show="show" preset="card" :style="isSubjective
    ? 'width: 840px; max-width: 90vw; max-height: 90vh; overflow: auto'
    : 'width: 760px; max-width: 90vw; max-height: 90vh; overflow: auto'" :bordered="false"
    @update:show="handleClose">
    <template #header>
      <div style="display: flex; align-items: center; gap: 8px">
        <n-icon>
          <Edit16Regular />
        </n-icon>
        <span>{{ subject.name }} · {{ actualTopicName }}</span>
      </div>
    </template>

    <!-- 生成中 -->
    <div v-if="generating" style="display: flex; flex-direction: column; align-items: center; padding: 40px 0">
      <n-spin size="medium" />
      <div style="margin-top: 16px; color: #64748b; font-size: 14px">
        AI 正在为您生成{{ isSubjective ? '案例题目' : '题目' }}，请稍候...
      </div>
    </div>

    <!-- 错误 -->
    <n-alert v-else-if="error" type="error" style="margin-bottom: 16px">
      {{ error }}
      <div v-if="!isNormalMode" style="margin-top: 8px; font-size: 12px">
        请前往「设置」配置 AI 大语言模型。
      </div>
      <div v-else style="margin-top: 8px">
        <n-button size="small" @click="doGenerate">重试</n-button>
      </div>
    </n-alert>

    <!-- 客观题 -->
    <template v-else-if="!isSubjective && (singleQ || multiQ)">
      <div v-if="singleQ" style="margin-bottom: 24px">
        <n-tag type="info" size="small" style="margin-bottom: 12px">单选题</n-tag>
        <div style="font-size: 15px; line-height: 1.8; color: #1e293b; margin-bottom: 16px">
          {{ singleQ.question }}
        </div>
        <n-radio-group v-model:value="singleAnswer" :disabled="submitted">
          <n-space vertical>
            <n-radio v-for="opt in singleQ.options" :key="opt.label" :value="opt.label" :style="submitted ? {
              color: opt.label === singleQ.correctAnswer ? '#10b981' :
                (opt.label === singleAnswer && !singleCorrect) ? '#ef4444' : undefined
            } : {}">
              <span :style="submitted && opt.label === singleQ.correctAnswer
                ? 'color: #10b981; font-weight: 600'
                : submitted && opt.label === singleAnswer && !singleCorrect
                  ? 'color: #ef4444' : ''">
                {{ opt.label }}. {{ opt.text }}
              </span>
            </n-radio>
          </n-space>
        </n-radio-group>
      </div>

      <n-divider v-if="singleQ && multiQ" />

      <div v-if="multiQ" style="margin-bottom: 24px">
        <n-tag type="warning" size="small" style="margin-bottom: 12px">多选题</n-tag>
        <div style="font-size: 15px; line-height: 1.8; color: #1e293b; margin-bottom: 16px">
          {{ multiQ.question }}
        </div>
        <n-checkbox-group v-model:value="multiAnswer" :disabled="submitted">
          <n-space vertical>
            <n-checkbox v-for="opt in multiQ.options" :key="opt.label" :value="opt.label">
              <span :style="submitted && multiQ.correctAnswer.includes(opt.label)
                ? 'color: #10b981; font-weight: 600'
                : submitted && multiAnswer.includes(opt.label) && !multiQ.correctAnswer.includes(opt.label)
                  ? 'color: #ef4444' : ''">
                {{ opt.label }}. {{ opt.text }}
              </span>
            </n-checkbox>
          </n-space>
        </n-checkbox-group>
      </div>

      <n-alert v-if="submitted" :type="allObjectiveCorrect ? 'success' : 'error'" style="margin: 16px 0"
        :title="allObjectiveCorrect ? '全部答对！' : '有错题'">
        <div v-if="singleQ && !singleCorrect">
          单选题：你的答案 {{ singleAnswer || '未作答' }}，正确答案 {{ singleQ.correctAnswer }}
        </div>
        <div v-if="multiQ && !multiCorrect">
          多选题：你的答案 {{ multiAnswer.length ? multiAnswer.join('、') : '未作答' }}，正确答案 {{ multiQ.correctAnswer.join('、') }}
        </div>
      </n-alert>

      <div v-if="aiResult" style="margin-top: 20px">
        <n-divider />
        <div style="font-size: 14px; font-weight: 600; color: #2563eb; margin-bottom: 12px">
          AI 深度评判报告
        </div>
        <div class="ai-result" v-html="renderedReport" />
      </div>

      <div style="display: flex; justify-content: center; gap: 12px; margin-top: 24px; flex-wrap: wrap">
        <n-button v-if="!submitted" type="primary" size="large" :disabled="!singleAnswer && multiAnswer.length === 0"
          @click="handleObjectiveSubmit">
          提交答案
        </n-button>
        <n-button v-if="submitted && isNormalMode && !judging && !aiResult" type="primary" size="large"
          @click="handleJudge">
          AI 深度评判
        </n-button>
        <n-button v-if="aiResult && !judging" secondary type="info" size="large" @click="handleRegenerate">
          重新出题
        </n-button>
        <n-button size="large" @click="handleClose">关闭</n-button>
      </div>
    </template>

    <!-- 主观题 -->
    <template v-else-if="isSubjective && subjectiveQ">
      <div style="margin-bottom: 20px">
        <n-tag type="warning" size="small" style="margin-bottom: 10px">全真精选案情</n-tag>
        <div class="hide-scrollbar case-block" style="
            max-height: 6.5rem;
            overflow-y: auto;
            padding: 16px;
            background: #f1f5f9;
            border-radius: 8px;
            font-size: 14px;
            line-height: 1.8;
            color: #334155;
          ">
          {{ subjectiveQ.caseText }}
        </div>
      </div>

      <div style="margin-bottom: 20px">
        <n-tag type="info" size="small" style="margin-bottom: 10px">问题</n-tag>
        <div style="font-size: 15px; font-weight: 600; color: #1e293b; line-height: 1.8">
          {{ subjectiveQ.question }}
        </div>
      </div>

      <div style="margin-bottom: 20px">
        <n-tag type="success" size="small" style="margin-bottom: 10px">键盘流作答区</n-tag>
        <n-input v-model:value="subjectiveAnswer" type="textarea" placeholder="请在此处输入你的答案..." :rows="10"
          style="font-size: 14px; line-height: 1.8" />
      </div>

      <div v-if="aiResult" style="margin-bottom: 20px">
        <n-divider />
        <div v-if="score" style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px">
          <div style="font-size: 14px; font-weight: 600; color: #1e293b">AI 评分</div>
          <n-tag size="large"
            :type="score[0] / score[1] >= 0.8 ? 'success' : score[0] / score[1] >= 0.6 ? 'warning' : 'error'">
            {{ score[0] }} / {{ score[1] }} 分
          </n-tag>
          <span style="font-size: 13px; color: #64748b">
            （{{ Math.round((score[0] / score[1]) * 100) }}%）
          </span>
        </div>

        <div v-if="renderedReference" style="margin-bottom: 16px">
          <div style="font-size: 14px; font-weight: 600; color: #2563eb; margin-bottom: 8px">
            参考答案要点
          </div>
          <div class="ai-result" style="background: #f0fdf4; border: 1px solid #bbf7d0;" v-html="renderedReference" />
        </div>

        <div style="font-size: 14px; font-weight: 600; color: #2563eb; margin-bottom: 12px">
          AI 阅卷组专家点评
        </div>
        <div class="ai-result" v-html="renderedReport" />
      </div>

      <div style="display: flex; justify-content: center; gap: 12px; flex-wrap: wrap">
        <n-button v-if="!aiResult" type="primary" size="large" :loading="judging" @click="handleJudge">
          AI 阅卷评判
        </n-button>
        <n-button v-if="aiResult && !judging" secondary type="info" size="large" @click="handleRegenerate">
          重新出题
        </n-button>
        <n-button size="large" @click="handleClose">关闭</n-button>
      </div>
    </template>

    <div v-else style="display: flex; flex-direction: column; align-items: center; padding: 40px 0">
      <n-spin v-if="generating" />
      <n-empty v-else description="正在准备题目..." />
    </div>
  </n-modal>
</template>

<style scoped>
.case-block {
  white-space: pre-wrap;
}

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
