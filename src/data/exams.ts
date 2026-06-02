import type { Exam, ExamId, Subject, Topic } from '@/types/exam'

export const exams: Exam[] = [
  {
    id: 'exam1',
    name: '客观题（卷一）',
    subjects: [
      {
        id: 'legal-thought',
        name: '习近平法治思想',
        topics: [
          { id: 'lt-1', name: '法治思想的形成发展', keywords: ['形成背景', '发展历程', '重大意义'] },
          { id: 'lt-2', name: '核心要义', keywords: ['十一个坚持', '全面依法治国', '依宪治国'] },
          { id: 'lt-3', name: '实践要求', keywords: ['法治政府', '司法体制改革', '法治社会'] }
        ]
      },
      {
        id: 'jurisprudence',
        name: '法理学',
        topics: [
          { id: 'ju-1', name: '法的本体', keywords: ['法的概念', '法的特征', '法的作用', '法的价值'] },
          { id: 'ju-2', name: '法的运行', keywords: ['立法', '执法', '司法', '守法', '法律监督'] },
          { id: 'ju-3', name: '法的演进', keywords: ['法的起源', '法系', '法律现代化', '法治国家'] }
        ]
      },
      {
        id: 'constitution',
        name: '宪法',
        topics: [
          { id: 'co-1', name: '宪法基本理论', keywords: ['宪法概念', '宪法特征', '宪法原则', '宪法分类'] },
          { id: 'co-2', name: '国家基本制度', keywords: ['国体', '政体', '国家结构形式', '选举制度'] },
          { id: 'co-3', name: '公民基本权利', keywords: ['平等权', '政治权利', '人身自由', '社会经济权利'] }
        ]
      },
      {
        id: 'legal-history',
        name: '中国法律史',
        topics: [
          { id: 'lh-1', name: '先秦法律制度', keywords: ['西周礼刑', '春秋战国变法', '铸刑书'] },
          { id: 'lh-2', name: '唐宋法律制度', keywords: ['唐律疏议', '宋刑统', '十恶八议'] },
          { id: 'lh-3', name: '明清法律制度', keywords: ['大明律', '大清律例', '会典'] }
        ]
      },
      {
        id: 'international-law',
        name: '国际法',
        topics: [
          { id: 'il-1', name: '国际法主体', keywords: ['国家', '国际组织', '个人国际法地位'] },
          { id: 'il-2', name: '领土与海洋法', keywords: ['领土取得', '领海', '专属经济区', '公海'] },
          { id: 'il-3', name: '外交与领事关系', keywords: ['外交特权', '外交豁免', '领事关系'] }
        ]
      },
      {
        id: 'judicial-ethics',
        name: '司法制度和法律职业道德',
        topics: [
          { id: 'je-1', name: '审判制度', keywords: ['法院组织', '审判组织', '审判程序'] },
          { id: 'je-2', name: '检察制度', keywords: ['检察院组织', '检察权', '法律监督'] },
          { id: 'je-3', name: '律师制度', keywords: ['律师执业', '律师事务所', '律师权利义务'] }
        ]
      },
      {
        id: 'criminal-law',
        name: '刑法',
        topics: [
          { id: 'cl-1', name: '犯罪构成', keywords: ['四要件', '犯罪客体', '犯罪客观方面', '犯罪主体', '犯罪主观方面'] },
          { id: 'cl-2', name: '正当防卫与紧急避险', keywords: ['正当防卫', '防卫过当', '紧急避险'] },
          { id: 'cl-3', name: '共同犯罪', keywords: ['主犯', '从犯', '胁从犯', '教唆犯'] },
          { id: 'cl-4', name: '刑罚裁量', keywords: ['累犯', '自首', '立功', '数罪并罚'] }
        ]
      },
      {
        id: 'criminal-procedure',
        name: '刑事诉讼法',
        topics: [
          { id: 'cp-1', name: '管辖与回避', keywords: ['立案管辖', '审判管辖', '回避制度'] },
          { id: 'cp-2', name: '辩护与代理', keywords: ['辩护人', '法律援助', '诉讼代理'] },
          { id: 'cp-3', name: '证据规则', keywords: ['证据种类', '证明标准', '非法证据排除'] }
        ]
      },
      {
        id: 'administrative-law',
        name: '行政法与行政诉讼法',
        topics: [
          { id: 'al-1', name: '行政行为', keywords: ['行政许可', '行政处罚', '行政强制', '行政确认'] },
          { id: 'al-2', name: '行政复议', keywords: ['复议范围', '复议机关', '复议决定'] },
          { id: 'al-3', name: '行政诉讼', keywords: ['受案范围', '管辖', '判决类型'] }
        ]
      }
    ]
  },
  {
    id: 'exam2',
    name: '客观题（卷二）',
    subjects: [
      {
        id: 'civil-law',
        name: '民法',
        topics: [
          { id: 'cv-1', name: '民事法律行为', keywords: ['效力类型', '有效', '无效', '可撤销', '效力待定'] },
          { id: 'cv-2', name: '物权变动', keywords: ['不动产登记', '动产交付', '善意取得'] },
          { id: 'cv-3', name: '担保物权', keywords: ['抵押权', '质权', '留置权'] },
          { id: 'cv-4', name: '合同效力与履行', keywords: ['要约承诺', '抗辩权', '违约责任'] }
        ]
      },
      {
        id: 'ip-law',
        name: '知识产权法',
        topics: [
          { id: 'ip-1', name: '著作权', keywords: ['作品', '权利内容', '保护期限', '合理使用'] },
          { id: 'ip-2', name: '专利权', keywords: ['授予条件', '权利内容', '侵权判定'] },
          { id: 'ip-3', name: '商标权', keywords: ['注册条件', '权利内容', '侵权判定'] }
        ]
      },
      {
        id: 'commercial-law',
        name: '商法',
        topics: [
          { id: 'cm-1', name: '公司法', keywords: ['公司设立', '组织机构', '股东权利'] },
          { id: 'cm-2', name: '破产法', keywords: ['破产申请', '管理人', '重整与和解'] },
          { id: 'cm-3', name: '票据法', keywords: ['汇票', '本票', '支票'] }
        ]
      },
      {
        id: 'economic-law',
        name: '经济法',
        topics: [
          { id: 'el-1', name: '反垄断法', keywords: ['垄断协议', '滥用市场支配地位', '经营者集中'] },
          { id: 'el-2', name: '反不正当竞争法', keywords: ['混淆行为', '商业贿赂', '虚假宣传'] },
          { id: 'el-3', name: '消费者权益保护法', keywords: ['消费者权利', '经营者义务', '争议解决'] }
        ]
      },
      {
        id: 'environment-law',
        name: '环境资源法',
        topics: [
          { id: 'en-1', name: '环境保护法', keywords: ['环境影响评价', '排污许可', '环境侵权'] },
          { id: 'en-2', name: '自然资源法', keywords: ['土地', '水', '矿产资源'] }
        ]
      },
      {
        id: 'labor-law',
        name: '劳动与社会保障法',
        topics: [
          { id: 'll-1', name: '劳动合同', keywords: ['订立', '履行', '变更', '解除终止'] },
          { id: 'll-2', name: '劳动争议', keywords: ['调解', '仲裁', '诉讼'] }
        ]
      },
      {
        id: 'private-intl-law',
        name: '国际私法',
        topics: [
          { id: 'pi-1', name: '冲突规范', keywords: ['系属公式', '连结点', '准据法'] },
          { id: 'pi-2', name: '涉外民事关系', keywords: ['合同', '侵权', '婚姻家庭'] }
        ]
      },
      {
        id: 'intl-economic-law',
        name: '国际经济法',
        topics: [
          { id: 'ie-1', name: '国际贸易术语', keywords: ['Incoterms', 'FOB', 'CIF'] },
          { id: 'ie-2', name: '国际货物买卖', keywords: ['CISG', '买卖双方义务', '风险转移'] }
        ]
      },
      {
        id: 'civil-procedure',
        name: '民事诉讼法（含仲裁制度）',
        topics: [
          { id: 'cv-p-1', name: '管辖制度', keywords: ['级别管辖', '地域管辖', '专属管辖'] },
          { id: 'cv-p-2', name: '当事人制度', keywords: ['原告被告', '第三人', '共同诉讼'] },
          { id: 'cv-p-3', name: '证据与证明', keywords: ['举证责任', '证明标准', '证据规则'] }
        ]
      }
    ]
  },
  {
    id: 'exam3',
    name: '主观题',
    subjects: [
      {
        id: 'legal-thought',
        name: '习近平法治思想',
        topics: [
          { id: 'lt-1', name: '法治思想的形成发展', keywords: ['形成背景', '发展历程', '重大意义'] },
          { id: 'lt-2', name: '核心要义', keywords: ['十一个坚持', '全面依法治国', '依宪治国'] },
          { id: 'lt-3', name: '实践要求', keywords: ['法治政府', '司法体制改革', '法治社会'] }
        ]
      },
      {
        id: 'jurisprudence',
        name: '法理学',
        topics: [
          { id: 'ju-1', name: '法的本体', keywords: ['法的概念', '法的特征', '法的作用', '法的价值'] },
          { id: 'ju-2', name: '法的运行', keywords: ['立法', '执法', '司法', '守法', '法律监督'] },
          { id: 'ju-3', name: '法的演进', keywords: ['法的起源', '法系', '法律现代化'] }
        ]
      },
      {
        id: 'constitution',
        name: '宪法',
        topics: [
          { id: 'co-1', name: '宪法基本理论', keywords: ['宪法概念', '宪法特征', '宪法原则'] },
          { id: 'co-2', name: '国家基本制度', keywords: ['国体', '政体', '国家结构形式'] },
          { id: 'co-3', name: '公民基本权利', keywords: ['平等权', '政治权利', '人身自由'] }
        ]
      },
      {
        id: 'criminal-law',
        name: '刑法',
        topics: [
          { id: 'cl-1', name: '犯罪构成', keywords: ['四要件', '犯罪客体', '犯罪主观方面'] },
          { id: 'cl-2', name: '正当防卫与紧急避险', keywords: ['正当防卫', '防卫过当', '紧急避险'] },
          { id: 'cl-3', name: '共同犯罪', keywords: ['主犯', '从犯', '教唆犯'] },
          { id: 'cl-4', name: '刑罚裁量', keywords: ['累犯', '自首', '立功', '数罪并罚'] }
        ]
      },
      {
        id: 'criminal-procedure',
        name: '刑事诉讼法',
        topics: [
          { id: 'cp-1', name: '管辖与回避', keywords: ['立案管辖', '审判管辖', '回避制度'] },
          { id: 'cp-2', name: '辩护与代理', keywords: ['辩护人', '法律援助', '诉讼代理'] },
          { id: 'cp-3', name: '证据规则', keywords: ['证据种类', '证明标准', '非法证据排除'] }
        ]
      },
      {
        id: 'civil-law',
        name: '民法',
        topics: [
          { id: 'cv-1', name: '民事法律行为', keywords: ['效力类型', '有效', '无效', '可撤销'] },
          { id: 'cv-2', name: '物权变动', keywords: ['不动产登记', '动产交付', '善意取得'] },
          { id: 'cv-3', name: '担保物权', keywords: ['抵押权', '质权', '留置权'] },
          { id: 'cv-4', name: '合同效力与履行', keywords: ['要约承诺', '抗辩权', '违约责任'] }
        ]
      },
      {
        id: 'commercial-law',
        name: '商法',
        topics: [
          { id: 'cm-1', name: '公司法', keywords: ['公司设立', '组织机构', '股东权利'] },
          { id: 'cm-2', name: '破产法', keywords: ['破产申请', '管理人', '重整与和解'] },
          { id: 'cm-3', name: '票据法', keywords: ['汇票', '本票', '支票'] }
        ]
      },
      {
        id: 'civil-procedure',
        name: '民事诉讼法（含仲裁制度）',
        topics: [
          { id: 'cv-p-1', name: '管辖制度', keywords: ['级别管辖', '地域管辖', '专属管辖'] },
          { id: 'cv-p-2', name: '当事人制度', keywords: ['原告被告', '第三人', '共同诉讼'] },
          { id: 'cv-p-3', name: '证据与证明', keywords: ['举证责任', '证明标准', '证据规则'] }
        ]
      },
      {
        id: 'administrative-law',
        name: '行政法与行政诉讼法',
        topics: [
          { id: 'al-1', name: '行政行为', keywords: ['行政许可', '行政处罚', '行政强制'] },
          { id: 'al-2', name: '行政复议', keywords: ['复议范围', '复议机关', '复议决定'] },
          { id: 'al-3', name: '行政诉讼', keywords: ['受案范围', '管辖', '判决类型'] }
        ]
      },
      {
        id: 'judicial-ethics',
        name: '司法制度和法律职业道德',
        topics: [
          { id: 'je-1', name: '审判制度', keywords: ['法院组织', '审判组织', '审判程序'] },
          { id: 'je-2', name: '检察制度', keywords: ['检察院组织', '检察权', '法律监督'] },
          { id: 'je-3', name: '律师制度', keywords: ['律师执业', '律师事务所', '律师权利义务'] }
        ]
      }
    ]
  }
]

export const examById = (id: ExamId): Exam | undefined => exams.find(e => e.id === id)

export const findSubject = (id: ExamId, subjectId: string): Subject | undefined =>
  examById(id)?.subjects.find(s => s.id === subjectId)

export const findTopic = (id: ExamId, subjectId: string, topicId: string): Topic | undefined =>
  findSubject(id, subjectId)?.topics.find(t => t.id === topicId)

export const allTopics = (): Array<{ exam: Exam; subject: Subject; topic: Topic }> =>
  exams.flatMap(e => e.subjects.flatMap(s => s.topics.map(t => ({ exam: e, subject: s, topic: t }))))
