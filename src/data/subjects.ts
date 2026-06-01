import type { Subject, ExamOutline } from '@/types'

const paper1Data: Subject[] = [
  {
    id: 'legal-thought',
    name: '习近平法治思想',
    icon: 'BalanceScale',
    paper: 'paper1',
    hasSubjective: true,
    topics: [
      { id: 'lt-1', name: '法治思想的形成发展', description: '习近平法治思想的历史背景与重大意义' },
      { id: 'lt-2', name: '核心要义', description: '十一个坚持的核心内容' },
      { id: 'lt-3', name: '实践要求', description: '全面依法治国的实践路径' }
    ]
  },
  {
    id: 'jurisprudence',
    name: '法理学',
    icon: 'Book',
    paper: 'paper1',
    hasSubjective: true,
    topics: [
      { id: 'ju-1', name: '法的本体', description: '法的概念、特征、作用与价值' },
      { id: 'ju-2', name: '法的运行', description: '立法、执法、司法、守法与法律监督' },
      { id: 'ju-3', name: '法的演进', description: '法的起源、发展与现代化' }
    ]
  },
  {
    id: 'constitution',
    name: '宪法',
    icon: 'DocumentText',
    paper: 'paper1',
    hasSubjective: true,
    topics: [
      { id: 'co-1', name: '宪法基本理论', description: '宪法的概念、特征、分类与原则' },
      { id: 'co-2', name: '国家基本制度', description: '国体、政体、国家结构形式' },
      { id: 'co-3', name: '公民基本权利', description: '平等权、政治权利、人身自由等' }
    ]
  },
  {
    id: 'legal-history',
    name: '中国法律史',
    icon: 'Time',
    paper: 'paper1',
    hasSubjective: false,
    topics: [
      { id: 'lh-1', name: '先秦法律制度', description: '西周礼刑、春秋战国变法' },
      { id: 'lh-2', name: '唐宋法律制度', description: '唐律疏议、宋刑统' },
      { id: 'lh-3', name: '明清法律制度', description: '大明律、大清律例' }
    ]
  },
  {
    id: 'international-law',
    name: '国际法',
    icon: 'Earth',
    paper: 'paper1',
    hasSubjective: false,
    topics: [
      { id: 'il-1', name: '国际法主体', description: '国家、国际组织、个人' },
      { id: 'il-2', name: '领土与海洋法', description: '领土取得、领海、专属经济区' },
      { id: 'il-3', name: '外交与领事关系', description: '外交特权与豁免、领事关系' }
    ]
  },
  {
    id: 'judicial-ethics',
    name: '司法制度和法律职业道德',
    icon: 'People',
    paper: 'paper1',
    hasSubjective: true,
    topics: [
      { id: 'je-1', name: '审判制度', description: '法院组织、审判组织、审判程序' },
      { id: 'je-2', name: '检察制度', description: '检察院组织、检察权行使' },
      { id: 'je-3', name: '律师制度', description: '律师执业、律师事务所管理' }
    ]
  },
  {
    id: 'criminal-law',
    name: '刑法',
    icon: 'Warning',
    paper: 'paper1',
    hasSubjective: true,
    topics: [
      { id: 'cl-1', name: '犯罪构成', description: '四要件：客体、客观方面、主体、主观方面' },
      { id: 'cl-2', name: '正当防卫与紧急避险', description: '排除犯罪性事由' },
      { id: 'cl-3', name: '共同犯罪', description: '主犯、从犯、胁从犯、教唆犯' },
      { id: 'cl-4', name: '刑罚裁量', description: '累犯、自首、立功、数罪并罚' }
    ]
  },
  {
    id: 'criminal-procedure',
    name: '刑事诉讼法',
    icon: 'Shield',
    paper: 'paper1',
    hasSubjective: true,
    topics: [
      { id: 'cp-1', name: '管辖与回避', description: '立案管辖、审判管辖、回避制度' },
      { id: 'cp-2', name: '辩护与代理', description: '辩护人权利、法律援助' },
      { id: 'cp-3', name: '证据规则', description: '证据种类、证明标准、非法证据排除' }
    ]
  },
  {
    id: 'administrative-law',
    name: '行政法与行政诉讼法',
    icon: 'Building',
    paper: 'paper1',
    hasSubjective: true,
    topics: [
      { id: 'al-1', name: '行政行为', description: '行政处罚、行政许可、行政强制' },
      { id: 'al-2', name: '行政复议', description: '复议范围、复议机关、复议决定' },
      { id: 'al-3', name: '行政诉讼', description: '受案范围、管辖、判决类型' }
    ]
  }
]

const paper2Data: Subject[] = [
  {
    id: 'civil-law',
    name: '民法',
    icon: 'Home',
    paper: 'paper2',
    hasSubjective: true,
    topics: [
      { id: 'cv-1', name: '民事法律行为', description: '效力类型：有效、无效、可撤销、效力待定' },
      { id: 'cv-2', name: '物权变动', description: '不动产登记、动产交付、善意取得' },
      { id: 'cv-3', name: '担保物权', description: '抵押权、质权、留置权' },
      { id: 'cv-4', name: '合同效力与履行', description: '要约承诺、抗辩权、违约责任' }
    ]
  },
  {
    id: 'ip-law',
    name: '知识产权法',
    icon: 'Lightbulb',
    paper: 'paper2',
    hasSubjective: false,
    topics: [
      { id: 'ip-1', name: '著作权', description: '作品、权利内容、保护期限' },
      { id: 'ip-2', name: '专利权', description: '授予条件、权利内容、侵权判定' },
      { id: 'ip-3', name: '商标权', description: '注册条件、权利内容、侵权判定' }
    ]
  },
  {
    id: 'commercial-law',
    name: '商法',
    icon: 'Briefcase',
    paper: 'paper2',
    hasSubjective: true,
    topics: [
      { id: 'cm-1', name: '公司法', description: '公司设立、组织机构、股东权利' },
      { id: 'cm-2', name: '破产法', description: '破产申请、管理人、重整与和解' },
      { id: 'cm-3', name: '票据法', description: '汇票、本票、支票' }
    ]
  },
  {
    id: 'economic-law',
    name: '经济法',
    icon: 'TrendingUp',
    paper: 'paper2',
    hasSubjective: false,
    topics: [
      { id: 'el-1', name: '反垄断法', description: '垄断协议、滥用市场支配地位' },
      { id: 'el-2', name: '反不正当竞争法', description: '不正当竞争行为类型' },
      { id: 'el-3', name: '消费者权益保护法', description: '消费者权利、经营者义务' }
    ]
  },
  {
    id: 'environment-law',
    name: '环境资源法',
    icon: 'Leaf',
    paper: 'paper2',
    hasSubjective: false,
    topics: [
      { id: 'en-1', name: '环境保护法', description: '环境影响评价、排污许可' },
      { id: 'en-2', name: '自然资源法', description: '土地、水、矿产资源' }
    ]
  },
  {
    id: 'labor-law',
    name: '劳动与社会保障法',
    icon: 'Person',
    paper: 'paper2',
    hasSubjective: false,
    topics: [
      { id: 'll-1', name: '劳动合同', description: '订立、履行、变更、解除' },
      { id: 'll-2', name: '劳动争议', description: '调解、仲裁、诉讼' }
    ]
  },
  {
    id: 'private-intl-law',
    name: '国际私法',
    icon: 'Globe',
    paper: 'paper2',
    hasSubjective: false,
    topics: [
      { id: 'pi-1', name: '冲突规范', description: '系属公式、连结点' },
      { id: 'pi-2', name: '涉外民事关系', description: '合同、侵权、婚姻家庭' }
    ]
  },
  {
    id: 'intl-economic-law',
    name: '国际经济法',
    icon: 'Trade',
    paper: 'paper2',
    hasSubjective: false,
    topics: [
      { id: 'ie-1', name: '国际贸易术语', description: 'Incoterms 主要术语' },
      { id: 'ie-2', name: '国际货物买卖', description: 'CISG 核心规则' }
    ]
  },
  {
    id: 'civil-procedure',
    name: '民事诉讼法（含仲裁制度）',
    icon: 'Hammer',
    paper: 'paper2',
    hasSubjective: true,
    topics: [
      { id: 'cv-p-1', name: '管辖制度', description: '级别管辖、地域管辖、专属管辖' },
      { id: 'cv-p-2', name: '当事人制度', description: '原告被告、第三人、共同诉讼' },
      { id: 'cv-p-3', name: '证据与证明', description: '举证责任、证明标准' }
    ]
  }
]

const subjectiveData: Subject[] = [
  {
    id: 'legal-thought',
    name: '习近平法治思想',
    icon: 'BalanceScale',
    paper: 'both',
    hasSubjective: true,
    topics: [
      { id: 'lt-1', name: '法治思想的形成发展', description: '习近平法治思想的历史背景与重大意义' },
      { id: 'lt-2', name: '核心要义', description: '十一个坚持的核心内容' },
      { id: 'lt-3', name: '实践要求', description: '全面依法治国的实践路径' }
    ]
  },
  {
    id: 'jurisprudence',
    name: '法理学',
    icon: 'Book',
    paper: 'both',
    hasSubjective: true,
    topics: [
      { id: 'ju-1', name: '法的本体', description: '法的概念、特征、作用与价值' },
      { id: 'ju-2', name: '法的运行', description: '立法、执法、司法、守法与法律监督' },
      { id: 'ju-3', name: '法的演进', description: '法的起源、发展与现代化' }
    ]
  },
  {
    id: 'constitution',
    name: '宪法',
    icon: 'DocumentText',
    paper: 'both',
    hasSubjective: true,
    topics: [
      { id: 'co-1', name: '宪法基本理论', description: '宪法的概念、特征、分类与原则' },
      { id: 'co-2', name: '国家基本制度', description: '国体、政体、国家结构形式' },
      { id: 'co-3', name: '公民基本权利', description: '平等权、政治权利、人身自由等' }
    ]
  },
  {
    id: 'criminal-law',
    name: '刑法',
    icon: 'Warning',
    paper: 'both',
    hasSubjective: true,
    topics: [
      { id: 'cl-1', name: '犯罪构成', description: '四要件：客体、客观方面、主体、主观方面' },
      { id: 'cl-2', name: '正当防卫与紧急避险', description: '排除犯罪性事由' },
      { id: 'cl-3', name: '共同犯罪', description: '主犯、从犯、胁从犯、教唆犯' },
      { id: 'cl-4', name: '刑罚裁量', description: '累犯、自首、立功、数罪并罚' }
    ]
  },
  {
    id: 'criminal-procedure',
    name: '刑事诉讼法',
    icon: 'Shield',
    paper: 'both',
    hasSubjective: true,
    topics: [
      { id: 'cp-1', name: '管辖与回避', description: '立案管辖、审判管辖、回避制度' },
      { id: 'cp-2', name: '辩护与代理', description: '辩护人权利、法律援助' },
      { id: 'cp-3', name: '证据规则', description: '证据种类、证明标准、非法证据排除' }
    ]
  },
  {
    id: 'civil-law',
    name: '民法',
    icon: 'Home',
    paper: 'both',
    hasSubjective: true,
    topics: [
      { id: 'cv-1', name: '民事法律行为', description: '效力类型：有效、无效、可撤销、效力待定' },
      { id: 'cv-2', name: '物权变动', description: '不动产登记、动产交付、善意取得' },
      { id: 'cv-3', name: '担保物权', description: '抵押权、质权、留置权' },
      { id: 'cv-4', name: '合同效力与履行', description: '要约承诺、抗辩权、违约责任' }
    ]
  },
  {
    id: 'commercial-law',
    name: '商法',
    icon: 'Briefcase',
    paper: 'both',
    hasSubjective: true,
    topics: [
      { id: 'cm-1', name: '公司法', description: '公司设立、组织机构、股东权利' },
      { id: 'cm-2', name: '破产法', description: '破产申请、管理人、重整与和解' },
      { id: 'cm-3', name: '票据法', description: '汇票、本票、支票' }
    ]
  },
  {
    id: 'civil-procedure',
    name: '民事诉讼法（含仲裁制度）',
    icon: 'Hammer',
    paper: 'both',
    hasSubjective: true,
    topics: [
      { id: 'cv-p-1', name: '管辖制度', description: '级别管辖、地域管辖、专属管辖' },
      { id: 'cv-p-2', name: '当事人制度', description: '原告被告、第三人、共同诉讼' },
      { id: 'cv-p-3', name: '证据与证明', description: '举证责任、证明标准' }
    ]
  },
  {
    id: 'administrative-law',
    name: '行政法与行政诉讼法',
    icon: 'Building',
    paper: 'both',
    hasSubjective: true,
    topics: [
      { id: 'al-1', name: '行政行为', description: '行政处罚、行政许可、行政强制' },
      { id: 'al-2', name: '行政复议', description: '复议范围、复议机关、复议决定' },
      { id: 'al-3', name: '行政诉讼', description: '受案范围、管辖、判决类型' }
    ]
  },
  {
    id: 'judicial-ethics',
    name: '司法制度和法律职业道德',
    icon: 'People',
    paper: 'both',
    hasSubjective: true,
    topics: [
      { id: 'je-1', name: '审判制度', description: '法院组织、审判组织、审判程序' },
      { id: 'je-2', name: '检察制度', description: '检察院组织、检察权行使' },
      { id: 'je-3', name: '律师制度', description: '律师执业、律师事务所管理' }
    ]
  }
]

export const examOutline: ExamOutline = {
  id: 'fakao-outline',
  name: '法考大纲',
  children: {
    objective: {
      id: 'objective',
      name: '客观题',
      children: {
        paper1: {
          id: 'paper1',
          name: '卷一（公法卷）',
          children: paper1Data
        },
        paper2: {
          id: 'paper2',
          name: '卷二（私法卷）',
          children: paper2Data
        }
      }
    },
    subjective: {
      id: 'subjective',
      name: '主观题',
      children: subjectiveData
    }
  }
}

export const paper1Subjects = examOutline.children.objective.children.paper1.children
export const paper2Subjects = examOutline.children.objective.children.paper2.children
export const subjectiveSubjects = examOutline.children.subjective.children
export const allSubjects = [...paper1Subjects, ...paper2Subjects]
