<template>
  <div class="box">
    <h1 style="font-size: 24px; font-weight: 700; color: #1e293b; margin-bottom: 8px">
      设置
    </h1>
    <p style="color: #64748b; margin-bottom: 24px">
      配置 AI 大语言模型，获得连贯的智能辅导体验
    </p>

    <n-tabs type="line">
      <n-tab-pane name="models" tab="模型设置">
        <div class="tab-content">
          <n-collapse v-if="settings.providers.length" v-model:expanded-names="expandedNames">
            <n-collapse-item
              v-for="(provider, pi) in settings.providers"
              :key="provider.id"
              :name="provider.id"
              :title="provider.name || '未命名供应商'"
            >
              <template #header-extra>
                <n-popconfirm :show-icon="false" @positive-click="removeProvider(pi)">
                  <template #trigger>
                    <n-button size="tiny" quaternary type="error" aria-label="移除供应商" @click.stop>
                      <n-icon>
                        <TrashOutline />
                      </n-icon>
                    </n-button>
                  </template>
                  确认移除 [ {{ provider.name }} ] 吗？
                </n-popconfirm>
              </template>

              <n-form label-placement="top" class="provider-form">
                <n-form-item label="供应商名称">
                  <n-input :ref="el => setNameInputRef(el, provider.id)" v-model:value="provider.name" placeholder="例如：OpenAI / DeepSeek" />
                </n-form-item>
                <n-form-item label="Base URL">
                  <n-input v-model:value="provider.baseUrl" placeholder="https://api.openai.com/v1/chat/completions" />
                </n-form-item>
                <n-form-item label="API Key">
                  <n-input
                    v-model:value="provider.apiKey"
                    type="password"
                    show-password-on="click"
                    placeholder="sk-..."
                  />
                </n-form-item>

                <n-form-item>
                  <template #label>
                    <div class="label-row">
                      <span>模型列表</span>
                      <n-button style="margin-left: 5px;" size="tiny" quaternary aria-label="添加模型" @click="addModel(pi)">
                        <n-icon>
                          <AddOutline />
                        </n-icon>
                      </n-button>
                    </div>
                  </template>
                  <div class="model-list">
                    <div v-for="(model, mi) in provider.models" :key="mi" class="model-row">
                      <n-input v-model:value="model.name" placeholder="例如：gpt-4o" />
                      <n-switch v-model:value="model.thinking" size="small">
                        <template #checked>思考开</template>
                        <template #unchecked>思考关</template>
                      </n-switch>

                      <n-popconfirm :show-icon="false" @positive-click="removeModel(pi, mi)">
                        <template #trigger>
                          <n-button size="tiny" quaternary type="error" aria-label="移除模型">
                            <n-icon>
                              <TrashOutline />
                            </n-icon>
                          </n-button>
                        </template>
                        确认移除这个模型名称吗？
                      </n-popconfirm>
                    </div>
                  </div>
                </n-form-item>
              </n-form>
            </n-collapse-item>
          </n-collapse>

          <n-empty v-else description="暂无供应商配置" :style="{ marginTop: '60px' }" />

          <div class="tab-header">
            <n-button size="small" secondary type="primary" @click="handleAddProvider">
              + 添加供应商
            </n-button>
          </div>

          <n-alert :show-icon="false" type="info" :style="{ maxWidth: '640px', margin: '12px 0' }">
            支持任意兼容 OpenAI 接口风格的服务商，例如 OpenAI、DeepSeek、通义千问等。配置后将自动启用 AI 智能评判和动态出题功能。
          </n-alert>
        </div>
      </n-tab-pane>

      <n-tab-pane name="prompts" tab="提示词设置">
        <div class="tab-content">
          <n-collapse>
            <n-collapse-item v-for="item in promptItems" :key="item.key" :title="item.label">
              <n-input
                v-model:value="custom[item.key]"
                :placeholder="defaults[item.key]"
                type="textarea"
                :autosize="{ minRows: 6, maxRows: 20 }"
              />
              <div v-if="hasCustom(item.key)" class="reset-row">
                <n-button text type="warning" size="small" @click="onResetPrompt(item.key)">
                  恢复默认
                </n-button>
              </div>
            </n-collapse-item>
          </n-collapse>

          <n-alert :show-icon="false" type="info" :style="{ marginTop: '16px' }">
            <p>提示词中可以使用以下占位符：</p>
            <ul :style="{ paddingLeft: '20px', margin: '8px 0 0' }">
              <li><code>{subject}</code> — 科目名称</li>
              <li><code>{topic}</code> — 考点名称</li>
              <li><code>{singleQuestion}</code> / <code>{multiQuestion}</code> — 单选/多选题干</li>
              <li><code>{singleAnswer}</code> / <code>{multiAnswer}</code> — 学生作答</li>
              <li><code>{singleCorrect}</code> / <code>{multiCorrect}</code> — 正确答案</li>
              <li><code>{caseText}</code> — 案情材料</li>
              <li><code>{question}</code> — 问题</li>
              <li><code>{answer}</code> — 学生答卷</li>
            </ul>
          </n-alert>
        </div>
      </n-tab-pane>

      <n-tab-pane name="wrongbook" tab="错题集管理">
        <div class="tab-content">
          <!-- 统计卡片 -->
          <div style="display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap">
            <n-card style="flex: 1; min-width: 160px" :bordered="false">
              <div style="font-size: 28px; font-weight: 700; color: #2563eb">{{ wrongBookItems.length }}</div>
              <div style="font-size: 13px; color: #64748b; margin-top: 4px">总错题数</div>
            </n-card>
            <n-card style="flex: 1; min-width: 160px" :bordered="false">
              <div style="font-size: 28px; font-weight: 700; color: #f59e0b">{{ objectiveCount }}</div>
              <div style="font-size: 13px; color: #64748b; margin-top: 4px">客观题错题</div>
            </n-card>
            <n-card style="flex: 1; min-width: 160px" :bordered="false">
              <div style="font-size: 28px; font-weight: 700; color: #10b981">{{ subjectiveCount }}</div>
              <div style="font-size: 13px; color: #64748b; margin-top: 4px">主观题错题</div>
            </n-card>
          </div>

          <!-- 操作区 -->
          <div v-if="wrongBookItems.length > 0" style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px">
            <n-popconfirm :show-icon="false" @positive-click="clearWrongBook">
              <template #trigger>
                <n-button type="error" secondary>
                  <template #icon>
                    <n-icon>
                      <TrashOutline />
                    </n-icon>
                  </template>
                  清空错题集
                </n-button>
              </template>
              确定要清空所有错题记录吗？此操作不可恢复。
            </n-popconfirm>
            <span style="font-size: 13px; color: #94a3b8">清空后将无法恢复，请谨慎操作</span>
          </div>

          <n-empty
            v-if="wrongBookItems.length === 0"
            description="暂无错题记录"
            :style="{ marginTop: '60px' }"
          />
        </div>
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, computed } from 'vue'
import type { InputInst } from 'naive-ui'
import {
  NForm, NFormItem, NInput, NButton, NCollapse,
  NCollapseItem, NSwitch, NEmpty, NIcon, NAlert, NPopconfirm,
  NTabs, NTabPane, NCard,
} from 'naive-ui'
import { TrashOutline, AddOutline } from '@vicons/ionicons5'
import { useSettings } from '@/composables/useSettings'
import { usePromptStore } from '@/composables/usePromptStore'
import { useWrongBook } from '@/composables/useWrongBook'
import type { PromptKey } from '@/types'

const { settings, addProvider, removeProvider, addModel, removeModel } = useSettings()
const { custom, defaults, removeCustom, hasCustom } = usePromptStore()
const { items: wrongBookItems, clear: clearWrongBook } = useWrongBook()

const objectiveCount = computed(() => wrongBookItems.value.filter(i => i.type === 'objective').length)
const subjectiveCount = computed(() => wrongBookItems.value.filter(i => i.type === 'subjective').length)

const expandedNames = ref<string[]>([])
const nameInputRefs = ref<Record<string, InputInst>>({})

function setNameInputRef(el: unknown, id: string) {
  if (el) nameInputRefs.value[id] = el as InputInst
}

function expandAndFocus(id: string) {
  if (!expandedNames.value.includes(id)) {
    expandedNames.value.push(id)
  }
  nextTick(() => {
    nameInputRefs.value[id]?.focus()
  })
}

function handleAddProvider() {
  if (settings.value.providers.length === 0) {
    addProvider()
    nextTick(() => {
      const id = settings.value.providers[0]?.id
      if (id) expandAndFocus(id)
    })
  } else {
    addProvider()
    nextTick(() => {
      const last = settings.value.providers[settings.value.providers.length - 1]
      if (last) expandAndFocus(last.id)
    })
  }
}

onMounted(() => {
  if (settings.value.providers.length === 1) {
    const id = settings.value.providers[0].id
    expandAndFocus(id)
  }
})

const promptItems: { key: PromptKey; label: string }[] = [
  { key: 'system', label: '系统提示词' },
  { key: 'objective-judge', label: '客观题评判提示词' },
  { key: 'subjective-judge', label: '主观题评判提示词' },
  { key: 'objective-generate', label: '动态出题提示词' },
]

function onResetPrompt(key: PromptKey) {
  removeCustom(key)
}
</script>

<style scoped>
.box {
  padding: 24px 32px;
  max-width: 720px;
}

.tab-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin-top: 14px;
}

.provider-form {
  padding-left: 20px;
  padding-right: 10px;
}

.model-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.model-row {
  width: 100%;
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.model-row> :first-child {
  flex: 1;
}

.label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.reset-row {
  margin-top: 8px;
  display: flex;
  justify-content: flex-end;
}
</style>
