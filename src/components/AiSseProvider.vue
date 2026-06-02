<script setup lang="ts">
import { provideAiSse } from '@/composables/llm/provider'
import SseStreamModal from './SseStreamModal.vue'

defineOptions({ inheritAttrs: false })

const ctx = provideAiSse()
</script>

<template>
  <slot />
  <SseStreamModal
    v-model:show="ctx.showStream.value"
    :streaming-text="ctx.streamingText.value"
    :reasoning-text="ctx.reasoningText.value"
    :blur="ctx.blur.value"
  />
</template>
