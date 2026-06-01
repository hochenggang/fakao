<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  NCollapse, NCollapseItem, NCard, NButton, NEmpty, NTag, NSpace, NAlert, useMessage
} from 'naive-ui'
import { Edit16Regular } from '@vicons/fluent'
import { paper1Subjects, paper2Subjects } from '@/data/subjects'
import ObjectiveModal from '@/components/ObjectiveModal.vue'
import { useRuntimeMode } from '@/composables/useRuntimeMode'
import { usePracticeTracker } from '@/composables/usePracticeTracker'
import { usePracticeCount } from '@/composables/usePracticeCount'
import type { Subject, Topic } from '@/types'

const route = useRoute()
const message = useMessage()
const { isNormalMode } = useRuntimeMode()
const { record: recordPractice, getCount: getPracticeCount } = usePracticeTracker()
const { getPaperCount, getSubjectCount } = usePracticeCount()

const paper = computed(() => route.meta.paper as string)
const subjects = computed(() => {
  return paper.value === 'paper1' ? paper1Subjects : paper2Subjects
})

const paperTotalCount = computed(() => getPaperCount(paper.value as 'paper1' | 'paper2'))

const showModal = ref(false)
const selectedSubject = ref<Subject | null>(null)
const selectedTopic = ref<Topic | null>(null)

const openModal = (subject: Subject, topic: Topic) => {
  selectedSubject.value = subject
  selectedTopic.value = topic
  recordPractice(subject.id, topic.id)
  showModal.value = true
}

const handleCopied = () => {
  message.success(
    '客观题错因剖析提示词已复制！请前往「豆包」或「DeepSeek」粘贴（Ctrl+V），AI 将为您深度复盘选项陷阱。提示：配置内置 AI 模型可获得连贯的自动评判体验。',
    { duration: 5000, closable: true }
  )
}

const handleAiJudged = () => {
  message.success('AI 深度评判完成！请查看评判报告中的错因剖析和思维提升建议。', {
    duration: 3000,
    closable: true
  })
}
</script>

<template>
  <div>
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px">
      <h1 style="font-size: 24px; font-weight: 700; color: #1e293b; margin: 0">
        {{ paper === 'paper1' ? '客观题 · 卷一（公法卷）' : '客观题 · 卷二（私法卷）' }}
      </h1>
      <n-tag v-if="paperTotalCount > 0" size="small" :bordered="false" type="success">
        本卷已练习 {{ paperTotalCount }} 题
      </n-tag>
    </div>
    <p style="color: #64748b; margin-bottom: 24px">
      {{ isNormalMode ? '点击科目展开高频考点' : '点击科目展开高频考点，配置 AI 模型后可进行智能演练' }}
    </p>

    <n-alert v-if="!isNormalMode" type="warning" :show-icon="false" style="margin-bottom: 20px">
      当前为降级运行模式。前往「设置」配置 AI 大语言模型，即可启用智能评判、动态出题等高级功能。
    </n-alert>

    <n-collapse :accordion="false">
      <n-collapse-item v-for="subject in subjects" :key="subject.id" :title="subject.name">
        <template #header-extra>
          <n-space>
            <n-tag v-if="getSubjectCount(subject.id) > 0" size="small" :bordered="false" type="success">
              已练习 {{ getSubjectCount(subject.id) }} 题
            </n-tag>
            <n-tag size="small" :bordered="false" type="info">
              {{ subject.topics.length }} 个考点
            </n-tag>
          </n-space>
        </template>

        <div style="display: flex; flex-direction: column; gap: 8px">
          <n-card v-for="topic in subject.topics" :key="topic.id" :bordered="false" size="small"
            style="background: #f8fafc;">
            <div style="display: flex; align-items: center; justify-content: space-between">
              <div>
                <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px">
                  {{ topic.name }}
                  <n-tag v-if="getPracticeCount(subject.id, topic.id) > 0" size="small" :bordered="false"
                     type="success">
                    已练习 {{ getPracticeCount(subject.id, topic.id) }} 题
                  </n-tag>
                </div>
                <div style="font-size: 13px; color: #64748b">
                  {{ topic.description }}
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 8px">

                <n-button v-if="isNormalMode" dashed type="info" style="color: #2563eb" @click="openModal(subject, topic)">
                  <template #icon>
                    <Edit16Regular />
                  </template>
                  演练
                </n-button>
                <n-tag v-else size="small" :bordered="false" style="background: #f1f5f9; color: #94a3b8">
                  需配置 AI
                </n-tag>
              </div>
            </div>
          </n-card>
        </div>
      </n-collapse-item>
    </n-collapse>

    <ObjectiveModal v-model:show="showModal" :subject-id="selectedSubject?.id || ''"
      :subject-name="selectedSubject?.name || ''" :topic-id="selectedTopic?.id || ''"
      :topic-name="selectedTopic?.name || ''" @copied="handleCopied" @ai-judged="handleAiJudged" />
  </div>
</template>
