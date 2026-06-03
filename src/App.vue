<script setup lang="ts">
import { NDialogProvider, NMessageProvider, NNotificationProvider } from 'naive-ui'
import { StreamChatModalProvider } from 'vue-llm-stream-chat'
import 'vue-llm-stream-chat/style'

</script>

<template>
  <n-dialog-provider>
    <n-message-provider>
      <n-notification-provider>
        <StreamChatModalProvider>
          <router-view />
        </StreamChatModalProvider>
      </n-notification-provider>
    </n-message-provider>
  </n-dialog-provider>
</template>
