<script setup lang="ts">
import { computed } from 'vue'
import { NCollapse, NCollapseItem } from 'naive-ui'
import outlineContent from '@/data/knowledge/outline-overview.md?raw'
import { knowledgeModules } from '@/data/knowledge'
import { renderMarkdown } from '@/lib/format'

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
        <div class="markdown" v-html="renderedOutline" />
      </n-collapse-item>

      <n-collapse-item
        v-for="module in knowledgeModules"
        :key="module.id"
        :title="module.name"
        :name="module.id"
      >
        <div class="markdown" v-html="renderMarkdown(module.content)" />
      </n-collapse-item>
    </n-collapse>
  </div>
</template>
