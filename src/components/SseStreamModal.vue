<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { NModal } from 'naive-ui'

interface Props {
  show: boolean
  streamingText: string
  reasoningText: string
  blur?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  blur: false
})

const outputPreRef = ref<HTMLPreElement | null>(null)
const reasoningPreRef = ref<HTMLPreElement | null>(null)

watch(() => props.streamingText, () => {
  nextTick(() => {
    const el = outputPreRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
})

watch(() => props.reasoningText, () => {
  nextTick(() => {
    const el = reasoningPreRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
})
</script>

<template>
  <n-modal
    :show="show"
    :mask-closable="false"
    preset="card"
    style="width: 680px; max-height: 60vh; overflow-y: auto;"
    :closable="false"
    @update:show="$emit('update:show', $event)"
  >
    <div v-if="reasoningText" class="modal-reasoning">
      <div class="modal-section-label">请稍等，AI正在思考...</div>
      <pre ref="reasoningPreRef" class="modal-reasoning-content" :class="{ 'blur-text': blur }">{{ reasoningText }}</pre>
    </div>
    <div class="modal-output">
      <div class="modal-section-label">等待模型输出...</div>
      <pre ref="outputPreRef" class="modal-output-content" :class="{ 'blur-text': blur }">{{ streamingText || '正在等待模型响应...' }}</pre>
    </div>
  </n-modal>
</template>

<style scoped>
.modal-reasoning {
  margin-bottom: 16px;
}

.modal-section-label {
  font-size: 13px;
  font-weight: 600;
  color: #94a3b8;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.modal-reasoning-content {
  background: #ffffff;
  padding: 12px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.7;
  color: #475569;
  max-height: 20vh;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  border: 1px solid #e2e8f0;
}

.modal-output-content {
  background: #f8fafc;
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.7;
  color: #334155;
  max-height: 20vh;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  border: 1px solid #e2e8f0;
}

.blur-text {
  filter: blur(4px);
  user-select: none;
  pointer-events: none;
}
</style>
