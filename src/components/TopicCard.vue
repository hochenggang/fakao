<script setup lang="ts">
import { NCard, NTag, NSpace, NButton, NEmpty } from 'naive-ui'
import { Edit16Regular } from '@vicons/fluent'
import type { Topic } from '@/types/exam'
import type { PracticeKind } from '@/composables/usePracticeFlow'

interface Props {
  topic: Topic
  subjectId: string
  kind: PracticeKind
  practicedCount: number
  isNormalMode: boolean
}

defineProps<Props>()
const emit = defineEmits<{ (e: 'practice', subjectId: string, topicId: string): void }>()

function clickPractice(subjectId: string, topicId: string) {
  emit('practice', subjectId, topicId)
}
</script>

<template>
  <n-card :bordered="false" size="small" style="background: #f8fafc">
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px">
      <div style="flex: 1; min-width: 0">
        <div
          style="font-weight: 600; color: #1e293b; margin-bottom: 6px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap">
          <span>{{ topic.name }}</span>
        </div>
        <n-space v-if="topic.keywords.length > 0" size="small" :wrap="true" style="margin-top: 4px">

          <n-tag v-for="kw in topic.keywords" :key="kw" size="small" :bordered="false"
            style="background: #e2e8f0; color: #475569">
            {{ kw }}
          </n-tag>
        </n-space>
      </div>
      <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0">
        <n-tag v-if="practicedCount > 0" size="small" :bordered="false" type="success">
          +{{ practicedCount }}
        </n-tag>
        <n-button v-if="isNormalMode" size="tiny" type="success" secondary @click="clickPractice(subjectId, topic.id)">
          <template #icon>
            <Edit16Regular />
          </template>
          考点练习
        </n-button>
        <n-tag v-else size="small" :bordered="false" style="background: #f1f5f9; color: #94a3b8">
          需配置 AI
        </n-tag>
      </div>
    </div>
  </n-card>
</template>
