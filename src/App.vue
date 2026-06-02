<script setup lang="ts">
import { NDialogProvider, NMessageProvider, NNotificationProvider } from 'naive-ui'
import AiSseProvider from '@/components/AiSseProvider.vue'
</script>

<template>
  <AiSseProvider>
    <n-dialog-provider>
      <n-message-provider>
        <n-notification-provider>
          <router-view />
        </n-notification-provider>
      </n-message-provider>
    </n-dialog-provider>
  </AiSseProvider>
</template>
