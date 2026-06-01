<script setup lang="ts">
import { computed } from 'vue'
import {
  NCard, NButton, NTag, NEmpty, NSpace, NPopconfirm, NDivider, NAlert, NCollapse, NCollapseItem
} from 'naive-ui'
import { Delete16Regular, BookOpen16Regular } from '@vicons/fluent'
import { useWrongBook } from '@/composables/useWrongBook'
import { marked } from 'marked'

const { items, remove } = useWrongBook()

const objectiveCount = computed(() => items.value.filter(i => i.type === 'objective').length)
const subjectiveCount = computed(() => items.value.filter(i => i.type === 'subjective').length)

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function renderMarkdown(text: string): string {
  return marked.parse(text) as string
}

function scoreTagType(score: [number, number]): 'success' | 'warning' | 'error' {
  const ratio = score[0] / score[1]
  if (ratio >= 0.8) return 'success'
  if (ratio >= 0.6) return 'warning'
  return 'error'
}
</script>

<template>
  <div>
    <h1 style="font-size: 24px; font-weight: 700; color: #1e293b; margin-bottom: 8px">
      错题集
    </h1>
    <p style="color: #64748b; margin-bottom: 24px">
      自动记录 AI 出题和评判中的错题，帮助你针对性复习薄弱考点
    </p>

    <n-alert v-if="items.length === 0" type="info" :show-icon="false" style="margin-bottom: 20px">
      暂无错题记录。前往「客观题」或「主观题」进行 AI 演练，答错的题目会自动收录到这里。
    </n-alert>

    <div v-else>
      <!-- 统计卡片 -->
      <div style="display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap">
        <n-card style="flex: 1; min-width: 160px" :bordered="false">
          <div style="font-size: 28px; font-weight: 700; color: #2563eb">{{ items.length }}</div>
          <div style="font-size: 13px; color: #64748b; margin-top: 4px">总错题数</div>
        </n-card>
        <n-card style="flex: 1; min-width: 160px" :bordered="false">
          <div style="font-size: 28px; font-weight: 700; color: #f59e0b">{{ objectiveCount }}</div>
          <div style="font-size: 13px; color: #64748b; margin-top: 4px">客观题错题</div>
        </n-card>
        <n-card style="flex: 1; min-width: 160px" :bordered="false">
          <div style="font-size: 28px; font-weight: 700; color: #10b981">{{ subjectiveCount }}</div>
          <div style="font-size: 13px; color: #64748b; margin-top: 4px">主观题错题</div>
        </n-card>
      </div>

      <!-- 错题列表 -->
      <n-collapse>
        <n-collapse-item
          v-for="item in items"
          :key="item.id"
          :name="item.id"
        >
          <template #header>
            <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; padding-right: 8px">
              <n-tag :type="item.type === 'objective' ? 'warning' : 'success'" size="small">
                {{ item.type === 'objective' ? '客观题' : '主观题' }}
              </n-tag>
              <span style="font-weight: 600; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">
                {{ item.subjectName }} · {{ item.topicName }}
              </span>
              <n-tag v-if="item.score" size="small" :type="scoreTagType(item.score)">
                {{ item.score[0] }}/{{ item.score[1] }} 分
              </n-tag>
              <span style="margin-left: auto; font-size: 12px; color: #94a3b8; white-space: nowrap">
                {{ formatDate(item.createdAt) }}
              </span>
            </div>
          </template>

          <!-- 客观题详细内容 -->
          <div v-if="item.type === 'objective'" style="color: #475569; font-size: 14px; line-height: 1.7">
            <!-- 单选题 -->
            <div v-if="item.singleQuestion && !item.singleCorrect" style="margin-bottom: 16px">
              <n-tag size="small" type="error" style="margin-bottom: 8px">单选题答错</n-tag>
              <div style="font-weight: 600; color: #1e293b; margin-bottom: 8px">
                {{ item.singleQuestion.question }}
              </div>
              <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px">
                <div
                  v-for="opt in item.singleQuestion.options"
                  :key="opt.label"
                  :style="{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    background: opt.label === item.singleQuestion?.correctAnswer ? '#dcfce7' : opt.label === item.singleAnswer ? '#fee2e2' : '#f8fafc',
                    color: opt.label === item.singleQuestion?.correctAnswer ? '#166534' : opt.label === item.singleAnswer ? '#991b1b' : '#475569',
                    border: opt.label === item.singleQuestion?.correctAnswer ? '1px solid #86efac' : opt.label === item.singleAnswer ? '1px solid #fca5a5' : '1px solid #e2e8f0'
                  }"
                >
                  <strong>{{ opt.label }}.</strong> {{ opt.text }}
                  <span v-if="opt.label === item.singleQuestion?.correctAnswer" style="margin-left: 8px; color: #16a34a; font-weight: 600">✓ 正确答案</span>
                  <span v-if="opt.label === item.singleAnswer && opt.label !== item.singleQuestion?.correctAnswer" style="margin-left: 8px; color: #dc2626; font-weight: 600">✗ 你的答案</span>
                </div>
              </div>
            </div>

            <!-- 多选题 -->
            <div v-if="item.multiQuestion && !item.multiCorrect" style="margin-bottom: 16px">
              <n-tag size="small" type="error" style="margin-bottom: 8px">多选题答错</n-tag>
              <div style="font-weight: 600; color: #1e293b; margin-bottom: 8px">
                {{ item.multiQuestion.question }}
              </div>
              <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px">
                <div
                  v-for="opt in item.multiQuestion.options"
                  :key="opt.label"
                  :style="{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    background: (Array.isArray(item.multiQuestion?.correctAnswer) && item.multiQuestion.correctAnswer.includes(opt.label)) ? '#dcfce7' : (item.multiAnswer?.includes(opt.label)) ? '#fee2e2' : '#f8fafc',
                    color: (Array.isArray(item.multiQuestion?.correctAnswer) && item.multiQuestion.correctAnswer.includes(opt.label)) ? '#166534' : (item.multiAnswer?.includes(opt.label)) ? '#991b1b' : '#475569',
                    border: (Array.isArray(item.multiQuestion?.correctAnswer) && item.multiQuestion.correctAnswer.includes(opt.label)) ? '1px solid #86efac' : (item.multiAnswer?.includes(opt.label)) ? '1px solid #fca5a5' : '1px solid #e2e8f0'
                  }"
                >
                  <strong>{{ opt.label }}.</strong> {{ opt.text }}
                  <span v-if="Array.isArray(item.multiQuestion?.correctAnswer) && item.multiQuestion.correctAnswer.includes(opt.label)" style="margin-left: 8px; color: #16a34a; font-weight: 600">✓ 正确答案</span>
                  <span v-if="item.multiAnswer?.includes(opt.label) && !(Array.isArray(item.multiQuestion?.correctAnswer) && item.multiQuestion.correctAnswer.includes(opt.label))" style="margin-left: 8px; color: #dc2626; font-weight: 600">✗ 你的答案</span>
                </div>
              </div>
              <div style="font-size: 13px; color: #64748b">
                你的答案：{{ item.multiAnswer?.length ? item.multiAnswer.join('、') : '未作答' }} | 正确答案：{{ Array.isArray(item.multiQuestion.correctAnswer) ? item.multiQuestion.correctAnswer.join('、') : item.multiQuestion.correctAnswer }}
              </div>
            </div>

            <!-- AI 评判 -->
            <n-divider style="margin: 12px 0" />
            <div style="font-size: 13px; font-weight: 600; color: #2563eb; margin-bottom: 8px">AI 错因剖析</div>
            <div
              class="ai-judge-content"
              v-html="renderMarkdown(item.aiJudgeResult || '')"
            />
          </div>

          <!-- 主观题详细内容 -->
          <div v-else style="color: #475569; font-size: 14px; line-height: 1.7">
            <!-- 得分展示 -->
            <div v-if="item.score" style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px">
              <div style="font-size: 14px; font-weight: 600; color: #1e293b">AI 评分</div>
              <n-tag
                size="large"
                :type="scoreTagType(item.score)"
              >
                {{ item.score[0] }} / {{ item.score[1] }} 分
              </n-tag>
              <span style="font-size: 13px; color: #64748b">
                （{{ Math.round((item.score[0] / item.score[1]) * 100) }}%）
              </span>
            </div>

            <!-- 案情材料 -->
            <div style="margin-bottom: 16px">
              <div style="font-size: 13px; font-weight: 600; color: #1e293b; margin-bottom: 8px">案情材料</div>
              <div
                style="padding: 12px; background: #f8fafc; border-radius: 8px; font-size: 13px; line-height: 1.8; color: #334155; border: 1px solid #e2e8f0"
              >
                {{ item.caseText }}
              </div>
            </div>

            <!-- 问题 -->
            <div style="margin-bottom: 16px">
              <div style="font-size: 13px; font-weight: 600; color: #1e293b; margin-bottom: 8px">问题</div>
              <div style="font-size: 14px; font-weight: 500; color: #1e293b; line-height: 1.8">
                {{ item.questionText }}
              </div>
            </div>

            <!-- 用户答案 -->
            <div style="margin-bottom: 16px">
              <div style="font-size: 13px; font-weight: 600; color: #1e293b; margin-bottom: 8px">你的答案</div>
              <div
                style="padding: 12px; background: #fef2f2; border-radius: 8px; font-size: 13px; line-height: 1.8; color: #7f1d1d; border: 1px solid #fecaca"
              >
                {{ item.answer || '未作答' }}
              </div>
            </div>

            <!-- 参考答案 -->
            <div v-if="item.referenceAnswer" style="margin-bottom: 16px">
              <div style="font-size: 13px; font-weight: 600; color: #15803d; margin-bottom: 8px">参考答案要点</div>
              <div
                class="ai-judge-content"
                style="background: #f0fdf4; border: 1px solid #bbf7d0;"
                v-html="renderMarkdown(item.referenceAnswer)"
              />
            </div>

            <!-- AI 评判 -->
            <n-divider style="margin: 12px 0" />
            <div style="font-size: 13px; font-weight: 600; color: #2563eb; margin-bottom: 8px">AI 阅卷组专家点评</div>
            <div
              class="ai-judge-content"
              v-html="renderMarkdown(item.aiJudgeResult || '')"
            />
          </div>

          <!-- 删除按钮 -->
          <div style="display: flex; justify-content: flex-end; margin-top: 16px">
            <n-button
              size="small"
              quaternary
              type="error"
              @click="remove(item.id)"
            >
              <template #icon>
                <Delete16Regular />
              </template>
              删除此记录
            </n-button>
          </div>
        </n-collapse-item>
      </n-collapse>
    </div>
  </div>
</template>

<style scoped>
.ai-judge-content {
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.8;
  color: #334155;
}

.ai-judge-content :deep(p) {
  margin: 8px 0;
}

.ai-judge-content :deep(strong) {
  font-weight: 600;
  color: #1e293b;
}

.ai-judge-content :deep(ul),
.ai-judge-content :deep(ol) {
  padding-left: 20px;
  margin: 8px 0;
}

.ai-judge-content :deep(li) {
  margin: 4px 0;
}

.ai-judge-content :deep(blockquote) {
  border-left: 3px solid #cbd5e1;
  padding-left: 12px;
  margin: 8px 0;
  color: #64748b;
}

.ai-judge-content :deep(code) {
  background: #e2e8f0;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}

.ai-judge-content :deep(pre) {
  background: #1e293b;
  color: #e2e8f0;
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
}

.ai-judge-content :deep(h1),
.ai-judge-content :deep(h2),
.ai-judge-content :deep(h3) {
  font-size: 15px;
  font-weight: 700;
  color: #1e293b;
  margin: 16px 0 8px;
}
</style>
