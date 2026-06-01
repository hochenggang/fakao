import legalThoughtContent from './legal-thought.md?raw'
import jurisprudenceContent from './jurisprudence.md?raw'
import constitutionContent from './constitution.md?raw'
import legalHistoryContent from './legal-history.md?raw'
import internationalLawContent from './international-law.md?raw'
import judicialEthicsContent from './judicial-ethics.md?raw'
import criminalLawContent from './criminal-law.md?raw'
import criminalProcedureContent from './criminal-procedure.md?raw'
import administrativeLawContent from './administrative-law.md?raw'
import civilLawContent from './civil-law.md?raw'
import ipLawContent from './ip-law.md?raw'
import commercialLawContent from './commercial-law.md?raw'
import economicLawContent from './economic-law.md?raw'
import environmentLawContent from './environment-law.md?raw'
import laborLawContent from './labor-law.md?raw'
import privateIntlLawContent from './private-intl-law.md?raw'
import intlEconomicLawContent from './intl-economic-law.md?raw'
import civilProcedureContent from './civil-procedure.md?raw'

export interface KnowledgeModule {
  id: string
  name: string
  content: string
}

export const knowledgeModules: KnowledgeModule[] = [
  { id: 'legal-thought', name: '习近平法治思想', content: legalThoughtContent },
  { id: 'jurisprudence', name: '法理学', content: jurisprudenceContent },
  { id: 'constitution', name: '宪法', content: constitutionContent },
  { id: 'legal-history', name: '中国法律史', content: legalHistoryContent },
  { id: 'international-law', name: '国际法', content: internationalLawContent },
  { id: 'judicial-ethics', name: '司法制度和法律职业道德', content: judicialEthicsContent },
  { id: 'criminal-law', name: '刑法', content: criminalLawContent },
  { id: 'criminal-procedure', name: '刑事诉讼法', content: criminalProcedureContent },
  { id: 'administrative-law', name: '行政法与行政诉讼法', content: administrativeLawContent },
  { id: 'civil-law', name: '民法', content: civilLawContent },
  { id: 'ip-law', name: '知识产权法', content: ipLawContent },
  { id: 'commercial-law', name: '商法', content: commercialLawContent },
  { id: 'economic-law', name: '经济法', content: economicLawContent },
  { id: 'environment-law', name: '环境资源法', content: environmentLawContent },
  { id: 'labor-law', name: '劳动与社会保障法', content: laborLawContent },
  { id: 'private-intl-law', name: '国际私法', content: privateIntlLawContent },
  { id: 'intl-economic-law', name: '国际经济法', content: intlEconomicLawContent },
  { id: 'civil-procedure', name: '民事诉讼法（含仲裁制度）', content: civilProcedureContent }
]
