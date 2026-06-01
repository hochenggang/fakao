<script setup lang="ts">
import { NDialogProvider, NMessageProvider, NNotificationProvider } from 'naive-ui'
</script>

<template>
  <n-dialog-provider>
    <n-message-provider>
      <n-notification-provider>
        <router-view />
      </n-notification-provider>
    </n-message-provider>
  </n-dialog-provider>
</template>
