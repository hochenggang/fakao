<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NModal, NAlert, NButton, NInput, NSpace } from 'naive-ui'
import type { Subject, Topic } from '@/types/exam'
import { useKeywordFlow } from '@/composables/useKeywordFlow'

interface Props {
  show: boolean
  openKey: number
  subject: Subject
  topic: Topic
  keyword: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:show', v: boolean): void
}>()

type Step = 'loading-memo' | 'view-memo' | 'recall' | 'loading-evaluate' | 'evaluated'

const step = ref<Step>('loading-memo')
const memoText = ref('')
const userRecall = ref('')
const evaluationText = ref('')
const error = ref('')

const flow = useKeywordFlow()

const displayed = computed(() => {
  if (!props.show) return false
  if (error.value) return true
  return step.value === 'view-memo' || step.value === 'recall' || step.value === 'evaluated'
})

function cacheKey(): string {
  return `fakao_keyword_memo:${props.subject.id}:${props.topic.id}:${props.keyword}`
}

function loadFromCache(): string | null {
  try {
    return localStorage.getItem(cacheKey())
  } catch {
    return null
  }
}

function saveToCache(text: string) {
  try {
    localStorage.setItem(cacheKey(), text)
  } catch {}
}

function clearCache() {
  try {
    localStorage.removeItem(cacheKey())
  } catch {}
}

function reset() {
  step.value = 'loading-memo'
  memoText.value = ''
  userRecall.value = ''
  evaluationText.value = ''
  error.value = ''
}

async function doGenerateMemo(useCache: boolean) {
  step.value = 'loading-memo'
  error.value = ''
  if (useCache) {
    const cached = loadFromCache()
    if (cached) {
      memoText.value = cached
      step.value = 'view-memo'
      return
    }
  }
  try {
    const text = await flow.generateMemo(props.subject, props.topic, props.keyword)
    memoText.value = text
    saveToCache(text)
    step.value = 'view-memo'
  } catch (e: any) {
    error.value = `生成必背失败：${e?.message || '未知错误'}`
    memoText.value = ''
    step.value = 'view-memo'
  }
}

async function regenerateMemo() {
  clearCache()
  await doGenerateMemo(false)
}

async function doEvaluate() {
  step.value = 'loading-evaluate'
  error.value = ''
  try {
    const text = await flow.evaluateMemo(
      props.subject,
      props.topic,
      props.keyword,
      memoText.value,
      userRecall.value,
    )
    evaluationText.value = text
    step.value = 'evaluated'
  } catch (e: any) {
    error.value = `AI 评析失败：${e?.message || '未知错误'}\n\n请检查模型配置是否正确。`
    evaluationText.value = ''
    step.value = 'evaluated'
  }
}

watch(() => props.openKey, async (k) => {
  if (k > 0) {
    reset()
    await doGenerateMemo(true)
  }
})
</script>

<template>
  <n-modal
    :show="displayed"
    preset="card"
    :bordered="false"
    style="width: 720px; max-width: 92vw; max-height: 88vh; overflow: auto"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <template #header>
      <span>📚 {{ subject.name }} · {{ topic.name }} · 「{{ keyword }}」背诵</span>
    </template>

    <n-alert v-if="error" type="error" style="margin-bottom: 12px; white-space: pre-wrap">
      {{ error }}
    </n-alert>

    <!-- 步骤 2：必背文本 -->
    <div v-if="step === 'view-memo'" class="plain-text">
      {{ memoText || '（生成失败，请关闭后重试）' }}
    </div>

    <!-- 步骤 3：默写输入 -->
    <div v-else-if="step === 'recall'">
      <n-input
        v-model:value="userRecall"
        type="textarea"
        :rows="12"
        placeholder="请输入你背诵的内容..."
        style="font-size: 14px; line-height: 1.8"
      />
    </div>

    <!-- 步骤 5：评析结果 -->
    <div v-else-if="step === 'evaluated'" class="plain-text">
      {{ evaluationText || '（评析失败）' }}
    </div>

    <template #footer>
      <n-space justify="end">
        <n-button
          v-if="step === 'view-memo'"
          secondary
          @click="regenerateMemo"
        >
          重新生成要点
        </n-button>
        <n-button
          v-if="step === 'view-memo'"
          type="primary"
          @click="step = 'recall'"
        >
          默写
        </n-button>
        <n-button
          v-else-if="step === 'recall'"
          type="primary"
          :disabled="!userRecall.trim()"
          @click="doEvaluate"
        >
          提交
        </n-button>
        <n-button
          v-else-if="step === 'evaluated'"
          @click="step = 'recall'; userRecall = ''"
        >
          重新默写
        </n-button>
        <n-button @click="emit('update:show', false)">关闭</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<style scoped>
.plain-text {
  white-space: pre-wrap;
  line-height: 1.8;
  font-size: 14px;
  color: #334155;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
  max-height: 60vh;
  overflow-y: auto;
}
</style>
