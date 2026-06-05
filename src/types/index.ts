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

// === Page metadata ===

export interface PageInfo {
  index: number
  title: string
  route: string
}
