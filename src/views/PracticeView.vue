<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  NSelect, NButton, NCollapse, NCollapseItem, NTag, NSpace, NAlert, NEmpty,
} from 'naive-ui'
import { Edit16Regular } from '@vicons/fluent'
import { examById } from '@/data/exams'
import { EXAM_IDS, EXAM_NAMES } from '@/types/exam'
import type { ExamId, Subject, Topic } from '@/types/exam'
import { useRuntimeMode } from '@/composables/useRuntimeMode'
import { usePracticeTracker } from '@/composables/usePracticeTracker'
import { usePracticeCount } from '@/composables/usePracticeCount'
import { kindOf, type PracticeScope } from '@/composables/usePracticeFlow'
import PracticeModal from '@/components/PracticeModal.vue'
import TopicCard from '@/components/TopicCard.vue'

const route = useRoute()

const { isNormalMode } = useRuntimeMode()
const { record: recordPractice } = usePracticeTracker()
const { getSubjectCount, getExamCount, getTopicPracticeCount } = usePracticeCount()

const examId = ref<ExamId>('exam1')
const subjectId = ref<string | null>(null)
const expandedNames = ref<string[]>([])

interface ModalState {
  show: boolean
  subject: Subject
  topic: Topic
  scope: PracticeScope
}

const FALLBACK_SUBJECT: Subject = { id: '', name: '', topics: [] }
const FALLBACK_TOPIC: Topic = { id: '', name: '', keywords: [] }

const modal = ref<ModalState>({
  show: false,
  subject: FALLBACK_SUBJECT,
  topic: FALLBACK_TOPIC,
  scope: 'topic',
})

const openKey = ref(0)

const examOptions = EXAM_IDS.map(id => ({ label: EXAM_NAMES[id], value: id }))

const currentExam = computed(() => examById(examId.value)!)
const currentKind = computed(() => kindOf(examId.value))
const isSubjective = computed(() => currentKind.value === 'subjective')

const subjectOptions = computed(() =>
  currentExam.value.subjects.map(s => ({ label: s.name, value: s.id }))
)

const visibleSubjects = computed(() => {
  const list = currentExam.value.subjects
  return subjectId.value ? list.filter(s => s.id === subjectId.value) : list
})

const totalTopicCount = computed(() =>
  visibleSubjects.value.reduce((s, sub) => s + sub.topics.length, 0)
)

const totalCount = computed(() => getExamCount(examId.value))

onMounted(() => {
  expandedNames.value = []
  applyRouteQuery()
})

function applyRouteQuery() {
  const q = route.query
  const newExamId =
    typeof q.examId === 'string' && (EXAM_IDS as readonly string[]).includes(q.examId)
      ? (q.examId as ExamId)
      : null
  const newSubjectId = typeof q.subjectId === 'string' ? q.subjectId : null

  if (newExamId && newExamId !== examId.value) {
    examId.value = newExamId
    switchExamScope()
  }

  if (newSubjectId) {
    subjectId.value = newSubjectId
    const subject = examById(examId.value)?.subjects.find(s => s.id === newSubjectId)
    if (subject && !expandedNames.value.includes(subject.name)) {
      expandedNames.value = [...expandedNames.value, subject.name]
    }
  }
}

watch(() => route.query, applyRouteQuery)

function switchExamScope() {
  subjectId.value = null
  expandedNames.value = []
  // currentExam.value.subjects.map(s => s.name)
}

function triggerOpen(next: ModalState) {
  modal.value = next
  openKey.value++
}

function openTopic(subject: Subject, topic: Topic) {
  triggerOpen({ show: true, subject, topic, scope: 'topic' })
  recordPractice(subject.id, topic.id, currentKind.value)
}

function openSubject(subject: Subject) {
  const t = subject.topics[0]
  if (!t) return
  triggerOpen({ show: true, subject, topic: t, scope: 'subject' })
}

function openExam() {
  const first = currentExam.value.subjects[0]
  if (!first || !first.topics[0]) return
  triggerOpen({ show: true, subject: first, topic: first.topics[0], scope: 'exam' })
}

function onModalPracticeRecorded(subjectId: string, topicId: string) {
  recordPractice(subjectId, topicId, currentKind.value)
}

function onModalClose() {
  modal.value.show = false
}

function onTopicPractice(subject: Subject, topicId: string) {
  const t = subject.topics.find(x => x.id === topicId)
  if (t) openTopic(subject, t)
}
</script>

<template>
  <div>
    <div
      style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; flex-wrap: wrap; gap: 12px"
    >
      <h1 style="font-size: 24px; font-weight: 700; color: #1e293b; margin: 0">
        法考智能演练
      </h1>
      <n-space>
        <n-tag v-if="totalCount > 0" size="small" :bordered="false" type="success">
          +{{ totalCount }}
        </n-tag>
        <n-button v-if="isNormalMode" size="tiny" type="success" secondary @click="openExam">
          <template #icon>
            <Edit16Regular />
          </template>
          整卷演练
        </n-button>
      </n-space>
    </div>
    <p style="color: #64748b; margin-bottom: 16px">
      {{ isNormalMode
        ? '选择考试类型与科目，开启 AI 智能演练'
        : '当前为降级模式，请先在「设置」中配置 AI 大语言模型' }}
    </p>

    <n-alert v-if="!isNormalMode" type="warning" :show-icon="false" style="margin-bottom: 20px">
      降级模式下无法使用 AI 智能演练、动态出题、深度评判等高级功能。
    </n-alert>

    <n-space :wrap="true" align="end" justify="start" size="medium" style="margin-bottom: 20px">
      <div>
        <div style="font-size: 12px; color: #64748b; margin-bottom: 4px">考试类型</div>
        <n-select
          size="medium"
          :value="examId"
          :options="examOptions"
          style="width: 200px"
          @update:value="(v) => { if (v && v !== examId) { examId = v; switchExamScope() } }"
        />
      </div>
      <div>
        <div style="font-size: 12px; color: #64748b; margin-bottom: 4px">筛选科目</div>
        <n-select
          size="medium"
          :value="subjectId"
          :options="subjectOptions"
          placeholder="全部科目"
          clearable
          filterable
          style="width: 240px"
          @update:value="(v) => subjectId = v"
        />
      </div>
      <n-tag size="large" :bordered="false" :type="isSubjective ? 'warning' : 'info'">
        共 {{ visibleSubjects.length }} 个科目 · {{ totalTopicCount }} 个考点
      </n-tag>
    </n-space>

    <n-empty v-if="visibleSubjects.length === 0" description="该考试暂无科目" />

    <n-collapse v-else :expanded-names="expandedNames" @update:expanded-names="(v: string[]) => expandedNames = v">
      <n-collapse-item
        v-for="subject in visibleSubjects"
        :key="subject.id"
        :name="subject.name"
        :title="subject.name"
      >
        <template #header-extra>
          <n-space>
            <n-tag
              v-if="getSubjectCount(subject.id, currentKind) > 0"
              size="small"
              :bordered="false"
              type="success"
            >
               +{{ getSubjectCount(subject.id, currentKind) }} 
            </n-tag>
            <n-tag size="small" :bordered="false" :type="isSubjective ? 'warning' : 'info'">
              {{ subject.topics.length }} 个考点
            </n-tag>
            <n-button
              v-if="isNormalMode"
              size="tiny"
              type="success"
              secondary
              @click.stop="openSubject(subject)"
            >
              <template #icon>
                <Edit16Regular />
              </template>
              专题练习
            </n-button>
          </n-space>
        </template>

        <div style="display: flex; flex-direction: column; gap: 8px">
          <TopicCard
            v-for="topic in subject.topics"
            :key="topic.id"
            style="border-bottom: 1px solid #e5e7eb"
            :topic="topic"
            :subject-id="subject.id"
            :kind="currentKind"
            :practiced-count="getTopicPracticeCount(subject.id, topic.id, currentKind)"
            :is-normal-mode="isNormalMode"
            @practice="(sId, tId) => onTopicPractice(subject, tId)"
          />
        </div>
      </n-collapse-item>
    </n-collapse>

    <PracticeModal
      :show="modal.show"
      :open-key="openKey"
      :exam-id="examId"
      :subject="modal.subject"
      :topic="modal.topic"
      :scope="modal.scope"
      @practice-recorded="onModalPracticeRecorded"
      @update:show="onModalClose"
    />
  </div>
</template>
