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
        path: 'overview',
        name: 'Overview',
        component: () => import('@/views/OverviewView.vue'),
        meta: { title: '如何考？', index: 1 }
      },
      {
        path: 'objective/paper1',
        name: 'ObjectivePaper1',
        component: () => import('@/views/ObjectiveView.vue'),
        meta: { title: '客观题 · 卷一（公法）', index: 2, paper: 'paper1' }
      },
      {
        path: 'objective/paper2',
        name: 'ObjectivePaper2',
        component: () => import('@/views/ObjectiveView.vue'),
        meta: { title: '客观题 · 卷二（私法）', index: 3, paper: 'paper2' }
      },
      {
        path: 'subjective',
        name: 'Subjective',
        component: () => import('@/views/SubjectiveView.vue'),
        meta: { title: '主观题案例演练', index: 4 }
      },
      {
        path: 'wrongbook',
        name: 'WrongBook',
        component: () => import('@/views/WrongBookView.vue'),
        meta: { title: '错题集', index: 5 }
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/SettingsView.vue'),
        meta: { title: '设置', index: 6 }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
