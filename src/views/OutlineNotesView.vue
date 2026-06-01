<script setup lang="ts">
import { computed } from 'vue'
import { NCollapse, NCollapseItem } from 'naive-ui'
import { marked } from 'marked'
import outlineContent from '@/data/knowledge/outline-overview.md?raw'
import { knowledgeModules } from '@/data/knowledge'

function renderMarkdown(text: string): string {
  return marked.parse(text) as string
}

const renderedOutline = computed(() => renderMarkdown(outlineContent))
</script>

<template>
  <div>
    <h1 style="font-size: 24px; font-weight: 700; color: #1e293b; margin-bottom: 8px">
      大纲笔记
    </h1>
    <p style="color: #64748b; margin-bottom: 24px">
      法考大纲总览与各科目知识要点
    </p>

    <n-collapse :accordion="false">
      <n-collapse-item title="法考大纲总览" name="outline">
        <div class="markdown-content" v-html="renderedOutline" />
      </n-collapse-item>

      <n-collapse-item
        v-for="module in knowledgeModules"
        :key="module.id"
        :title="module.name"
        :name="module.id"
      >
        <div class="markdown-content" v-html="renderMarkdown(module.content)" />
      </n-collapse-item>
    </n-collapse>
  </div>
</template>

<style scoped>
.markdown-content {
  color: #475569;
  font-size: 14px;
  line-height: 1.8;
}

.markdown-content :deep(h1) {
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
  margin: 24px 0 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e2e8f0;
}

.markdown-content :deep(h2) {
  font-size: 17px;
  font-weight: 700;
  color: #1e293b;
  margin: 20px 0 10px;
}

.markdown-content :deep(h3) {
  font-size: 15px;
  font-weight: 600;
  color: #334155;
  margin: 16px 0 8px;
}

.markdown-content :deep(p) {
  margin: 8px 0;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  padding-left: 20px;
  margin: 8px 0;
}

.markdown-content :deep(li) {
  margin: 4px 0;
}

.markdown-content :deep(strong) {
  font-weight: 600;
  color: #1e293b;
}

.markdown-content :deep(blockquote) {
  border-left: 3px solid #cbd5e1;
  padding-left: 12px;
  margin: 12px 0;
  color: #64748b;
}

.markdown-content :deep(code) {
  background: #e2e8f0;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}

.markdown-content :deep(pre) {
  background: #1e293b;
  color: #e2e8f0;
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 13px;
}
</style>
