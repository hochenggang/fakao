# Vue 3 + naive-ui 项目开发规范

> **技术栈**：Vue 3 Composition API + TypeScript + Vue Router + naive-ui + @vicons/*
>
> **核心原则**：复用、抽象、封装为本，有序、简单、稳健为纲。重复、对齐、对比就是最好的设计。

---

## 目录

1. [总体布局（Layout）](#1-总体布局layout)
2. [路由与内容区](#2-路由与内容区)
3. [组件选择优先级](#3-组件选择优先级)
4. [交互规范](#4-交互规范)
5. [样式与约定](#5-样式与约定)
6. [代码生成要求](#6-代码生成要求)
7. [引入与 Provider 配置](#7-引入与-provider-配置)
8. [TypeScript 规范](#8-typescript-规范)
9. [状态与数据管理](#9-状态与数据管理)
10. [性能优化](#10-性能优化)
11. [可访问性（a11y）](#11-可访问性a11y)

---

## 1. 总体布局（Layout）

- 页面采用 **左右两栏布局**：
  - **左侧菜单栏**：宽度建议 `240px`，包含一个位于底部的**折叠按钮**（该按钮折叠前靠右对齐，折叠后居中对齐）；折叠后宽度缩小为 `64px`，菜单项仅显示图标。
  - **右侧内容区**：用于渲染路由匹配的页面组件。
- 使用 naive-ui 的 `n-layout`（必须配置 `has-sider`）、`n-layout-sider`、`n-layout-content` 实现。
- 折叠状态通过 `ref` 管理，建议持久化到 `localStorage` 以提升用户体验。

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NLayout, NLayoutSider, NLayoutContent } from 'naive-ui'

const collapsed = ref(false)

onMounted(() => {
  const saved = localStorage.getItem('sidebar-collapsed')
  if (saved !== null) collapsed.value = saved === 'true'
})

const toggleCollapse = () => {
  collapsed.value = !collapsed.value
  localStorage.setItem('sidebar-collapsed', String(collapsed.value))
}
</script>

<template>
  <n-layout has-sider style="height: 100vh">
    <n-layout-sider
      bordered
      collapse-mode="width"
      :collapsed-width="64"
      :width="240"
      :collapsed="collapsed"
      @collapse="collapsed = true"
      @expand="collapsed = false"
    >
      <!-- 菜单内容 -->
    </n-layout-sider>
    <n-layout-content>
      <router-view />
    </n-layout-content>
  </n-layout>
</template>
```

---

## 2. 路由与内容区

- 右侧内容区必须是 **`<router-view>`**，支持 Vue Router 4。
- 路由切换时，若存在异步数据加载，必须显示 **Spin**（`n-spin`）。
- 路由配置单独抽离为 `src/router/index.ts`，按功能模块拆分路由文件。

```ts
// src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/DashboardView.vue'),
        meta: { title: '仪表盘' }
      }
    ]
  }
]

export const router = createRouter({
  history: createWebHistory(),
  routes
})
```

---

## 3. 组件选择优先级

| 场景 | 推荐组件 | 备注 |
|------|---------|------|
| 弹窗类交互 | `n-dialog` / `useDialog` | 复杂表单、正式确认 |
| 短暂反馈（成功/警告/信息） | `n-message` / `useMessage` | 3 秒后自动消失 |
| 系统错误/错误上报 | `n-notification` / `useNotification` | 类型为 `error`，需用户手动关闭 |
| 二次确认（删除等） | `n-popover` 包裹触发按钮 | 内含"确认"/"取消"按钮；正式场景可用 `n-dialog` |
| 区块加载 | `n-spin` | 包裹内容区 |
| 按钮提交 | `n-button` 的 `loading` 属性 | — |

> **原则**：任何异步请求（初始加载、提交、刷新）都必须伴随加载状态，禁止无反馈等待。

---

## 4. 交互规范

### 4.1 删除操作

1. 点击删除按钮后，弹出 `n-popover`，文案为"确认删除吗？"。
2. 点击"确认"后执行删除请求。
3. 请求期间按钮显示 `loading`。
4. 结束后用 `n-message` 提示结果。

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { NButton, NPopover, useMessage } from 'naive-ui'

const message = useMessage()
const loading = ref(false)

const handleDelete = async (id: string) => {
  loading.value = true
  try {
    await api.deleteItem(id)
    message.success('删除成功')
  } catch (err) {
    message.error('删除失败，请重试')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <n-popover trigger="click">
    <template #trigger>
      <n-button type="error" size="small">删除</n-button>
    </template>
    <div style="display: flex; align-items: center; gap: 8px">
      <span>确认删除吗？</span>
      <n-button size="small" @click="handleDelete(itemId)" :loading="loading">确认</n-button>
    </div>
  </n-popover>
</template>
```

### 4.2 表单提交

1. 提交前进行表单校验。
2. 提交时按钮进入 `loading` 状态。
3. 成功后 `n-message.success`。
4. 失败用 `n-notification.error`（而非 `message.error`），确保用户感知。

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { NForm, NFormItem, NInput, NButton, useMessage, useNotification } from 'naive-ui'
import type { FormInst, FormRules } from 'naive-ui'

const message = useMessage()
const notification = useNotification()
const formRef = ref<FormInst | null>(null)
const loading = ref(false)

const model = ref({ name: '', email: '' })

const rules: FormRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' }
  ]
}

const handleSubmit = async () => {
  try {
    await formRef.value?.validate()
    loading.value = true
    await api.createItem(model.value)
    message.success('提交成功')
  } catch (err: any) {
    if (err.msg) {
      notification.error({ title: '提交失败', content: err.msg })
    }
  } finally {
    loading.value = false
  }
}
</script>
```

### 4.3 全局错误捕获

在 axios 拦截器中统一使用 `n-notification.error` 展示错误，避免错误静默。

```ts
// src/utils/http.ts
import axios from 'axios'
import { useNotification } from 'naive-ui'

const http = axios.create({ baseURL: import.meta.env.VITE_API_BASE })

http.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const notification = useNotification()
    const msg = err.response?.data?.message || '网络异常，请稍后重试'
    notification.error({ title: '请求错误', content: msg, duration: 5000 })
    return Promise.reject(err)
  }
)

export default http
```

---

## 5. 样式与约定

- 使用 naive-ui 原生样式，**不额外引入第三方 CSS 库**（如 Element Plus、Ant Design 的样式）。
- 左侧菜单折叠过渡使用 `n-layout-sider` 自带的 `collapsed` 属性和 `collapse-mode="width"`。
- 全局样式仅用于重置或 naive-ui 无法覆盖的场景，写在 `src/styles/global.css` 中。
- 组件局部样式使用 `<style scoped>`，避免全局污染。

---

## 6. 代码生成要求

- 提供完整可运行的组件代码，包含 `<script setup lang="ts">`、`<template>` 和 `<style scoped>`（如需要）。
- 路由配置文件单独列出，按模块拆分。
- 生成的项目应可直接复制到 `src/` 下运行（假设已配置好 Vue Router 和 naive-ui）。
- 每个组件只负责单一职责，复杂页面按功能拆分为多个子组件。

---

## 7. 引入与 Provider 配置

### 7.1 组件按需引入

所有 naive-ui 组件必须直接从 `'naive-ui'` 导入：

```ts
import { NButton, NLayout, NLayoutSider, useMessage } from 'naive-ui'
```

**禁止**全量导入（如 `import * as NaiveUI from 'naive-ui'`）。

### 7.2 图标按需引入

图标必须从对应图标包按需导入：

```ts
import { Money16Regular } from '@vicons/fluent'
import { Delete16Regular } from '@vicons/fluent'
```

**禁止**全量导入图标。若使用其他图标集（如 `@vicons/carbon`），同样按需导入。

### 7.3 Provider 包裹

为了让 `useDialog`、`useMessage`、`useNotification` 等组合式 API 正常工作，必须在 `App.vue` 中用相应的 Provider 组件包裹整个路由视图：

```vue
<template>
  <n-dialog-provider>
    <n-message-provider>
      <n-notification-provider>
        <router-view />
      </n-notification-provider>
    </n-message-provider>
  </n-dialog-provider>
</template>
```

> 若项目中未使用某个 Provider（如从未使用 `useDialog`），可不添加，但建议全部添加以便后续扩展。

### 7.4 Treeshaking 保证

所有导入（组件、图标、工具函数）必须做到按需引入，确保打包时能 treeshake 掉未使用的代码。

---

## 8. TypeScript 规范

- 所有组件文件使用 `<script setup lang="ts">`。
- 定义清晰的 Props 和 Emits 类型：

```ts
interface Props {
  title: string
  visible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  visible: false
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'confirm'): void
}>()
```

- 接口/API 返回类型统一定义在 `src/types/` 目录下，避免魔法类型。
- 优先使用 `type` 定义对象结构，使用 `interface` 定义类或组件契约。

---

## 9. 状态与数据管理

- 局部状态：使用 `ref` / `reactive` / `computed`。
- 跨组件状态：优先使用 Vue 的 `provide` / `inject` 或组合式函数（Composables）。
- 全局复杂状态：引入 Pinia，按模块拆分 Store。
- 异步数据请求封装为 Composable，统一处理 loading 和 error 状态：

```ts
// src/composables/useAsync.ts
import { ref, type Ref } from 'vue'

export function useAsync<T>(fn: () => Promise<T>) {
  const data: Ref<T | null> = ref(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)

  const execute = async () => {
    loading.value = true
    error.value = null
    try {
      data.value = await fn()
    } catch (e) {
      error.value = e as Error
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, execute }
}
```

---

## 10. 性能优化

- 路由懒加载：所有页面组件使用 `() => import('@/views/xxx.vue')`。
- 大数据列表使用 `n-data-table` 的虚拟滚动或分页，避免一次性渲染过多 DOM。
- 频繁触发的事件（如搜索输入）使用 `lodash-es/debounce` 或 `useDebounceFn` 节流。
- 避免在 `v-for` 中使用复杂计算，提前用 `computed` 处理好数据源。

---

## 11. 可访问性（a11y）

- 所有图片必须包含 `alt` 属性。
- 表单输入必须关联 `<label>` 或使用 `aria-label`。
- 按钮和链接必须有明确的文案或 `aria-label`，禁止空按钮。
- 颜色对比度符合 WCAG 2.1 AA 标准（naive-ui 默认主题已满足）。
- 弹窗打开时焦点应自动进入弹窗内部，关闭后焦点回到触发元素。

---

> **审查清单**：在输出最终代码前，请确认——
> 1. 是否消灭了重复逻辑？能否进一步复用？
> 2. 调用者是否需要理解内部细节？接口是否稳定？
> 3. 是否泄露了可变状态或实现细节？
> 4. 文件结构、导入顺序是否利于快速定位？
> 5. 是否有更直接、更少分支的写法？
> 6. 异常输入、网络超时、空数据等边界是否已处理？
