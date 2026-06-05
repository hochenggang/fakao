<script setup lang="ts">
import { h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NLayout, NLayoutSider, NLayoutContent,
  NMenu, NButton, NTooltip, NIcon
} from 'naive-ui'
import type { MenuOption } from 'naive-ui'
import {
  ChevronLeft16Regular, ChevronRight16Regular,
  VehicleSubway20Regular,
  Settings16Regular, Notebook24Regular, NotebookError24Regular,
  ContentView20Regular
} from '@vicons/fluent'
import { useLocalStorage } from '@/composables/useLocalStorage'

const route = useRoute()
const router = useRouter()
const collapsed = useLocalStorage<boolean>('sidebar-collapsed', false)

const toggleCollapse = () => { collapsed.value = !collapsed.value }

const menuOptions: MenuOption[] = [
  {
    key: '/overview',
    label: '总览',
    icon: () => h(VehicleSubway20Regular)
  },
  {
    key: '/practice',
    label: '演练',
    icon: () => h(Notebook24Regular)
  },
  {
    key: '/wrongbook',
    label: '错题集',
    icon: () => h(NotebookError24Regular)
  },
  {
    key: '/outline-notes',
    label: '大纲',
    icon: () => h(ContentView20Regular)
  },
  {
    key: '/settings',
    label: '设置',
    icon: () => h(Settings16Regular)
  }
]

const handleMenuUpdate = (key: string) => {
  router.push(key)
}
</script>

<template>
  <n-layout has-sider style="height: 100vh">
    <n-layout-sider bordered collapse-mode="width" :collapsed-width="64" :width="220" :collapsed="collapsed"
      @collapse="collapsed = true" @expand="collapsed = false" style="background: #fff">
      <div style="height: 100%; display: flex; flex-direction: column">
        <div
          style="height: 64px; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid #f0f0f0">
          <n-icon :style="{ marginRight: collapsed ? '0' : '8px' }" :size="30">
            <svg t="1780293868339" class="icon" viewBox="0 0 1024 1024" version="1.1" width="30" height="30"
              xmlns="http://www.w3.org/2000/svg">
              <path
                d="M988.33184427 602.96891947L433.1879584 714.95300053c-14.25097173 45.02547307-13.45524907 89.04455787 4.5025472 132.85297814l543.49183893-122.68213334 7.57410347 33.6877856L431.44042453 884.567504l-16.1578688-2.86089173L48.5045088 654.3536256c-20.12884267-45.92925653-26.75113387-92.43920533 0-140.42926507l35.80971307-5.5089344 0 12.13013547 469.91421333 104.88260907c13.03937707-31.718672 20.98023253-72.55268267 3.3902816-109.54451947l-476.74826133-96.19733227 4.5025472-33.00012373 2.2769248-0.68984533 0-0.1069696 0.31763413 0 28.6056384-8.73985387 1.1133568-29.4002688 436.91299733 105.679424c11.53306987-32.13017707 18.33873813-63.89032747 3.2309184-101.33405653l-441.3096672-97.15132587 0.0523936-44.60086933 347.33795734-88.3558048 402.3214272 81.78699733c21.29568427 39.30478187 15.9974144 76.17327573 0 111.98408107l-29.08154347 16.63159146 53.65944853 8.26394774c23.04321813 41.31864853 17.37492053 81.4169696 0 120.98808426l-88.356896 54.77389654 187.0974848 50.9590112L988.33184427 602.96891947 988.33184427 602.96891947zM460.67914773 800.5013984l1.69514134 8.42331093 506.14853013-104.56497493-1.74753387-8.47679573L460.67914773 800.5013984 460.67914773 800.5013984zM459.090976 766.12267627l1.74753387 8.47679573 506.14743893-104.5671584-1.74753387-8.47461227L459.090976 766.12267627 459.090976 766.12267627zM457.18407893 735.71711147l2.0116832 10.0649664 506.14853014-104.5671584-2.06735147-10.0649664L457.18407893 735.71711147z"
                fill="#1296db"></path>
            </svg>
          </n-icon>
          <span v-if="!collapsed" style="font-size: 18px; font-weight: 700; color: #1296db; letter-spacing: 1px">
            易懂法考
          </span>

        </div>

        <n-menu :collapsed="collapsed" :collapsed-width="64" :options="menuOptions" :value="route.path"
          style="flex: 1; margin-top: 8px" @update:value="handleMenuUpdate" />

        <div style="padding: 12px; display: flex; justify-content: flex-end"
          :style="collapsed ? 'justify-content: center' : 'justify-content: flex-end'">
          <n-tooltip>
            <template #trigger>
              <n-button text @click="toggleCollapse">
                <template #icon>
                  <ChevronLeft16Regular v-if="!collapsed" />
                  <ChevronRight16Regular v-else />
                </template>
              </n-button>
            </template>
            {{ collapsed ? '展开' : '折叠' }}
          </n-tooltip>
        </div>
      </div>
    </n-layout-sider>

    <n-layout-content style="background: #f8fafc">
      <div style="padding: 24px; max-width: 1200px; margin: 0 auto">
        <router-view />
      </div>
    </n-layout-content>
  </n-layout>
</template>
