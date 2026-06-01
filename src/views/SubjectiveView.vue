<script setup lang="ts">
import { ref } from 'vue'
import {
  NCollapse, NCollapseItem, NCard, NButton, NTag, useMessage, NAlert, NSpace
} from 'naive-ui'
import { Edit16Regular } from '@vicons/fluent'
import { subjectiveSubjects } from '@/data/subjects'
import SubjectiveModal from '@/components/SubjectiveModal.vue'
import { useRuntimeMode } from '@/composables/useRuntimeMode'
import { usePracticeTracker } from '@/composables/usePracticeTracker'
import { usePracticeCount } from '@/composables/usePracticeCount'
import type { Subject, Topic } from '@/types'

const message = useMessage()
const { isNormalMode } = useRuntimeMode()
const { record: recordPractice, getCount: getPracticeCount } = usePracticeTracker()
const { getSubjectCount, getSubjectiveTotalCount } = usePracticeCount()

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
    '主观题答卷与评分提示词复制成功！请立即在「DeepSeek」或「豆包」中粘贴发送，AI 将以阅卷组专家标准为你出具判卷报告。提示：配置内置 AI 模型可获得连贯的自动评判体验。',
    { duration: 5000, closable: true }
  )
}
</script>

<template>
  <div>
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px">
      <h1 style="font-size: 24px; font-weight: 700; color: #1e293b; margin: 0">
        主观题案例演练
      </h1>
      <n-tag v-if="getSubjectiveTotalCount() > 0" size="small" :bordered="false" type="success">
        已练习 {{ getSubjectiveTotalCount() }} 题
      </n-tag>
    </div>
    <p style="color: #64748b; margin-bottom: 24px">
      {{ isNormalMode ? '点击科目展开高频考点' : '点击科目展开高频考点，配置 AI 模型后可进行智能演练' }}
    </p>

    <n-alert
      v-if="!isNormalMode"
      type="warning"
      :show-icon="false"
      style="margin-bottom: 20px"
    >
      当前为降级运行模式。前往「设置」配置 AI 大语言模型，即可启用 AI 阅卷点评等高级功能。
    </n-alert>

    <n-collapse :accordion="false">
      <n-collapse-item
        v-for="subject in subjectiveSubjects"
        :key="subject.id"
        :title="subject.name"
      >
        <template #header-extra>
          <n-space>
            <n-tag v-if="getSubjectCount(subject.id) > 0" size="small" :bordered="false" type="success">
              已练习 {{ getSubjectCount(subject.id) }} 题
            </n-tag>
            <n-tag size="small" :bordered="false" type="warning">
              {{ subject.topics.length }} 个考点
            </n-tag>
          </n-space>
        </template>

        <div style="display: flex; flex-direction: column; gap: 8px">
          <n-card
            v-for="topic in subject.topics"
            :key="topic.id"
            :bordered="false"
            size="small"
            style="background: #f8fafc;"
          >
            <div style="display: flex; align-items: center; justify-content: space-between">
              <div>
                <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px">
                  {{ topic.name }}
                </div>
                <div style="font-size: 13px; color: #64748b">
                  {{ topic.description }}
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 8px">
                <n-tag v-if="getPracticeCount(subject.id, topic.id) > 0" size="small" :bordered="false" type="success">
                  已练习 {{ getPracticeCount(subject.id, topic.id) }} 题
                </n-tag>
                <n-button
                  v-if="isNormalMode"
                  type="warning"
                  dashed
                  style="color: #f59e0b"
                  @click="openModal(subject, topic)"
                >
                  <template #icon>
                    <Edit16Regular />
                  </template>
                  演练
                </n-button>
                <n-tag
                  v-else
                  size="small"
                  :bordered="false"
                  style="background: #f1f5f9; color: #94a3b8"
                >
                  需配置 AI
                </n-tag>
              </div>
            </div>
          </n-card>
        </div>
      </n-collapse-item>
    </n-collapse>

    <SubjectiveModal
      v-model:show="showModal"
      :subject-id="selectedSubject?.id || ''"
      :subject-name="selectedSubject?.name || ''"
      :topic-id="selectedTopic?.id || ''"
      :topic-name="selectedTopic?.name || ''"
      @copied="handleCopied"
    />
  </div>
</template>
