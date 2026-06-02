<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { ExamId } from '@/types/exam'

const router = useRouter()

const papers: Array<{
  id: string
  examId: ExamId
  badge: string
  badgeClass: string
  title: string
  time: string
  questionType: string
  questionTypeClass: string
  labelClass: string
  tagClass: string
  subjects: Array<{ name: string; subjectId: string }>
}> = [
  {
    id: 'paper1',
    examId: 'exam1',
    badge: '上午场',
    badgeClass: 'badge-morning',
    title: '试卷一（公法卷）',
    time: '09:00 - 12:00 (3小时)',
    questionType: '单选 50 题 × 1 分 + 多选/不定项 50 题 × 2 分 = 满分 150 分',
    questionTypeClass: 'qt-default',
    labelClass: 'label-default',
    tagClass: 'tag-default',
    subjects: [
      { name: '法治思想', subjectId: 'legal-thought' },
      { name: '法理学', subjectId: 'jurisprudence' },
      { name: '宪法', subjectId: 'constitution' },
      { name: '中国法律史', subjectId: 'legal-history' },
      { name: '国际法', subjectId: 'international-law' },
      { name: '司法制度和法律职业道德', subjectId: 'judicial-ethics' },
      { name: '刑法', subjectId: 'criminal-law' },
      { name: '刑事诉讼法', subjectId: 'criminal-procedure' },
      { name: '行政法与行政诉讼法', subjectId: 'administrative-law' }
    ]
  },
  {
    id: 'paper2',
    examId: 'exam2',
    badge: '下午场',
    badgeClass: 'badge-afternoon',
    title: '试卷二（私法卷）',
    time: '14:30 - 17:30 (3小时)',
    questionType: '单选 50 题 × 1 分 + 多选/不定项 50 题 × 2 分 = 满分 150 分',
    questionTypeClass: 'qt-default',
    labelClass: 'label-default',
    tagClass: 'tag-default',
    subjects: [
      { name: '民法', subjectId: 'civil-law' },
      { name: '知识产权法', subjectId: 'ip-law' },
      { name: '商法', subjectId: 'commercial-law' },
      { name: '经济法', subjectId: 'economic-law' },
      { name: '环境资源法', subjectId: 'environment-law' },
      { name: '劳动与社会保障法', subjectId: 'labor-law' },
      { name: '国际私法', subjectId: 'private-intl-law' },
      { name: '国际经济法', subjectId: 'intl-economic-law' },
      { name: '民事诉讼法（含仲裁制度）', subjectId: 'civil-procedure' }
    ]
  },
  {
    id: 'subjective',
    examId: 'exam3',
    badge: '上午场',
    badgeClass: 'badge-subjective',
    title: '主观题试卷',
    time: '09:00 - 13:00 (4小时)',
    questionType: '案例分析题、法律文书题、论述题 = 满分 180 分',
    questionTypeClass: 'qt-amber',
    labelClass: 'label-amber',
    tagClass: 'tag-amber',
    subjects: [
      { name: '法治思想', subjectId: 'legal-thought' },
      { name: '法理学', subjectId: 'jurisprudence' },
      { name: '宪法', subjectId: 'constitution' },
      { name: '刑法', subjectId: 'criminal-law' },
      { name: '刑事诉讼法', subjectId: 'criminal-procedure' },
      { name: '民法', subjectId: 'civil-law' },
      { name: '商法', subjectId: 'commercial-law' },
      { name: '民事诉讼法（含仲裁制度）', subjectId: 'civil-procedure' },
      { name: '行政法与行政诉讼法', subjectId: 'administrative-law' },
      { name: '司法制度和法律职业道德', subjectId: 'judicial-ethics' }
    ]
  }
]

function goToPractice(examId: ExamId, subjectId: string) {
  router.push({ path: '/practice', query: { examId, subjectId } })
}
</script>

<template>
  <div class="overview-container">
    <div class="overview-header">
      <h1 class="overview-title">
        <span>法考怎么考？</span>
      </h1>
      <p class="overview-subtitle">流程、分值与科目分布</p>
    </div>

    <!-- 双核通关公式卡片 -->
    <div class="cards-grid">
      <div class="card card-objective">
        <div class="card-watermark">客</div>
        <h3 class="card-title">
          <span class="card-icon">📝</span>
          客观题阶段（选择题）
        </h3>
        <p class="card-desc">
          一天内连考两场，每场3小时，每卷100题。两卷合计总分
          <strong>300分</strong>，全国统一合格线固定为 <strong class="highlight-blue">180分</strong>。通过客观题后，成绩可保留两年。
        </p>
      </div>

      <div class="card card-subjective">
        <div class="card-watermark">主</div>
        <h3 class="card-title">
          <span class="card-icon">⌨️</span>
          主观题阶段（案例问答）
        </h3>
        <p class="card-desc">
          全面采用计算机输入作答（敲键盘）。满分
          <strong>180分</strong>，考试时间长达4小时，合格分数线每年固定为 <strong class="highlight-amber">108分</strong>。
        </p>
      </div>
    </div>

    <!-- 考试时间节点与试卷分值拆解表 -->
    <div class="schedule-card">
      <div class="schedule-header">
        <h2 class="schedule-header-title">
          <span class="schedule-icon">📅</span>
          考试时间节点与试卷分值拆解
        </h2>
      </div>
      <div class="schedule-body">
        <div
          v-for="(paper, index) in papers"
          :key="paper.id"
          class="schedule-row"
          :class="{ 'row-amber': paper.id === 'subjective' }"
        >
          <div class="row-left">
            <span :class="['row-badge', paper.badgeClass]">{{ paper.badge }}</span>
            <h4 class="row-title">{{ paper.title }}</h4>
            <p class="row-time">时间：{{ paper.time }}</p>
          </div>
          <div class="row-right">
            <p :class="['row-question-type', paper.questionTypeClass]">
              题型：{{ paper.questionType }}
            </p>
            <div>
              <span :class="['row-label', paper.labelClass]">考察科目：</span>
              <div class="tags-wrap">
                <span
                  v-for="subject in paper.subjects"
                  :key="subject.subjectId"
                  :class="['subject-tag', paper.tagClass, 'subject-tag-clickable']"
                  :title="`跳转到 ${subject.name} 演练`"
                  @click="goToPractice(paper.examId, subject.subjectId)"
                >
                  {{ subject.name }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overview-container {
  max-width: 1152px;
  margin: 0 auto;
  animation: fadeIn 0.5s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.overview-header {
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 16px;
  margin-bottom: 32px;
}

.overview-title {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
}

.title-bar {
  width: 8px;
  height: 28px;
  background: #2563eb;
  border-radius: 4px;
  display: inline-block;
}

.overview-subtitle {
  font-size: 14px;
  color: #64748b;
  margin-top: 8px;
  margin-bottom: 0;
}

/* Cards Grid */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

.card {
  border-radius: 16px;
  padding: 24px;
  position: relative;
  overflow: hidden;
  border: 1px solid;
}

.card-objective {
  background: linear-gradient(135deg, #eff6ff 0%, #eef2ff 100%);
  border-color: #dbeafe;
}

.card-subjective {
  background: linear-gradient(135deg, #fffbeb 0%, #fff7ed 100%);
  border-color: #fef3c7;
}

.card-watermark {
  position: absolute;
  right: -16px;
  bottom: -16px;
  font-size: 96px;
  font-weight: 700;
  pointer-events: none;
  user-select: none;
  line-height: 1;
}

.card-objective .card-watermark {
  color: rgba(37, 99, 235, 0.08);
}

.card-subjective .card-watermark {
  color: rgba(245, 158, 11, 0.08);
}

.card-title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-objective .card-title {
  color: #1e3a5f;
}

.card-subjective .card-title {
  color: #78350f;
}

.card-icon {
  font-size: 20px;
}

.card-desc {
  font-size: 14px;
  line-height: 1.8;
  margin: 0;
}

.card-objective .card-desc {
  color: #1e3a5f;
  opacity: 0.9;
}

.card-subjective .card-desc {
  color: #78350f;
  opacity: 0.9;
}

.highlight-blue {
  color: #2563eb;
  font-size: 18px;
}

.highlight-amber {
  color: #d97706;
  font-size: 18px;
}

/* Schedule Card */
.schedule-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.schedule-header {
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  padding: 16px 24px;
}

.schedule-header-title {
  font-size: 16px;
  font-weight: 700;
  color: #334155;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.schedule-icon {
  font-size: 18px;
}

.schedule-body {
  display: flex;
  flex-direction: column;
}

.schedule-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  padding: 24px;
  border-bottom: 1px solid #f1f5f9;
}

@media (min-width: 768px) {
  .schedule-row {
    grid-template-columns: 240px 1fr;
    gap: 24px;
    align-items: start;
  }
}

.schedule-row:last-child {
  border-bottom: none;
}

.row-amber {
  background: rgba(251, 191, 36, 0.04);
}

.row-left {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.row-badge {
  display: inline-block;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
  width: fit-content;
  margin-bottom: 4px;
}

.badge-morning {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
}

.badge-afternoon {
  background: #eef2ff;
  color: #4338ca;
  border: 1px solid #c7d2fe;
}

.badge-subjective {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
}

.row-title {
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.row-time {
  font-size: 12px;
  color: #64748b;
  margin: 0;
}

.row-right {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.row-question-type {
  font-size: 14px;
  font-weight: 500;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px dashed;
  width: fit-content;
  margin: 0;
}

.qt-default {
  color: #475569;
  background: #f8fafc;
  border-color: #cbd5e1;
}

.qt-amber {
  color: #78350f;
  background: #fffbeb;
  border-color: #fcd34d;
}

.row-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: block;
  margin-bottom: 6px;
}

.label-default {
  color: #94a3b8;
}

.label-amber {
  color: #b45309;
  opacity: 0.6;
}

.tags-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.subject-tag {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 4px;
}

.subject-tag-clickable {
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s, filter 0.15s;
}
.subject-tag-clickable:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  filter: brightness(0.97);
}
.subject-tag-clickable:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.tag-default {
  background: #f1f5f9;
  color: #334155;
  border: 1px solid #e2e8f0;
}

.tag-amber {
  background: rgba(251, 191, 36, 0.15);
  color: #78350f;
  border: 1px solid #fde68a;
}
</style>
