export interface Topic {
  id: string;
  name: string;
  description: string;
}

export interface Subject {
  id: string;
  name: string;
  icon: string;
  paper: 'paper1' | 'paper2' | 'both';
  hasSubjective: boolean;
  topics: Topic[];
}

export interface Option {
  label: string;
  text: string;
}

export interface ObjectiveQuestion {
  id: string;
  subjectId: string;
  topicId: string;
  type: 'single' | 'multiple';
  question: string;
  options: Option[];
  correctAnswer: string | string[];
  explanation: string;
}

export interface SubjectiveQuestion {
  id: string;
  subjectId: string;
  topicId: string;
  caseText: string;
  question: string;
  referenceAnswer?: string;
}

export interface ExamPaper {
  id: string;
  name: string;
  timeRange: string;
  duration: string;
  singleChoice: string;
  multipleChoice: string;
  totalScore: number;
  subjects: string[];
}

export interface PageInfo {
  index: number;
  title: string;
  route: string;
}

// === AI / Settings types from idea_extend ===

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

export interface Settings {
  providers: ProviderConfig[]
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface StreamCallbacks {
  thinking?: boolean
  onChunk?: (chunk: string, full: string) => void
  onFinish?: (full: string) => void
  onThinking?: (chunk: string, full: string) => void
}

export type PromptKey = 'system' | 'objective-judge' | 'subjective-judge' | 'objective-generate' | 'subjective-generate'

export interface WrongBookItem {
  id: string
  type: 'objective' | 'subjective'
  subjectName: string
  topicName: string
  subjectId: string
  topicId: string
  createdAt: number
  singleQuestion?: ObjectiveQuestion | null
  multiQuestion?: ObjectiveQuestion | null
  singleAnswer?: string | null
  multiAnswer?: string[]
  singleCorrect?: boolean
  multiCorrect?: boolean
  caseText?: string
  questionText?: string
  answer?: string
  aiJudgeResult?: string
  score?: [number, number]
  referenceAnswer?: string
  isWrong: boolean
}
