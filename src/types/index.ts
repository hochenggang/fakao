// === AI / Settings types ===

export interface ModelConfig {
  name: string
  thinking: boolean
}

export interface ProviderConfig {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  models: ModelConfig[]
}

export interface DefaultModel {
  providerId: string
  modelName: string
}

export interface Settings {
  providers: ProviderConfig[]
  defaultModel?: DefaultModel
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type PromptKey = 'system' | 'objective-judge' | 'subjective-judge' | 'objective-generate' | 'subjective-generate' | 'keyword-memo' | 'keyword-evaluate'

// === Page metadata ===

export interface PageInfo {
  index: number
  title: string
  route: string
}
