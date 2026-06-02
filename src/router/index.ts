import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: MainLayout,
    redirect: '/overview',
    children: [
      {
        path: 'practice',
        name: 'Practice',
        component: () => import('@/views/PracticeView.vue'),
        meta: { title: '法考演练', index: 1 }
      },
      {
        path: 'overview',
        name: 'Overview',
        component: () => import('@/views/OverviewView.vue'),
        meta: { title: '如何考？', index: 2 }
      },
      {
        path: 'wrongbook',
        name: 'WrongBook',
        component: () => import('@/views/WrongBookView.vue'),
        meta: { title: '错题集', index: 3 }
      },
      {
        path: 'outline-notes',
        name: 'OutlineNotes',
        component: () => import('@/views/OutlineNotesView.vue'),
        meta: { title: '大纲笔记', index: 4 }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/SettingsView.vue'),
        meta: { title: '设置', index: 5 }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
