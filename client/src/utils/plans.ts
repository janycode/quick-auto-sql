import type { PlanType } from '@/api/auth'

export interface PlanItem {
  id: PlanType
  name: string
  desc: string
  monthlyPrice: number
  yearlyPrice: number
  yearlyTotal: number
  gradient: string
  icon: string
  recommended: boolean
  cta: string
  highlights: string[]
}

export const PLANS: PlanItem[] = [
  {
    id: 'free',
    name: '免费版',
    desc: '体验核心功能，无需付费',
    monthlyPrice: 0,
    yearlyPrice: 0,
    yearlyTotal: 0,
    gradient: 'linear-gradient(135deg, #a9b2c3, #8a93a8)',
    icon: 'User',
    recommended: false,
    cta: '免费使用',
    highlights: [
      'AI 生成 SQL（自带 Key）30 次/月',
      'AI 生成 SQL（平台提供）10 次/月',
      'SQL 优化/分析 10 次/月',
      '2 个数据库连接',
      '3 个多 Tab',
    ],
  },
  {
    id: 'pro',
    name: '基础版',
    desc: '个人开发者的最佳选择',
    monthlyPrice: 15,
    yearlyPrice: 11.5,
    yearlyTotal: 138,
    gradient: 'linear-gradient(135deg, #5b8def, #7b5bff)',
    icon: 'MagicStick',
    recommended: false,
    cta: '选择基础版',
    highlights: [
      'AI 生成 SQL（自带 Key）500 次/月',
      'AI 生成 SQL（平台提供）200 次/月',
      'SQL 优化/分析 200 次/月',
      '10 个数据库连接',
      '不限查询执行次数',
      '提示词自定义',
    ],
  },
  {
    id: 'team',
    name: '专业版',
    desc: '高频使用与小团队的首选',
    monthlyPrice: 39,
    yearlyPrice: 29.8,
    yearlyTotal: 358,
    gradient: 'linear-gradient(135deg, #ff8a65, #ffb347)',
    icon: 'MagicStick',
    recommended: true,
    cta: '选择专业版',
    highlights: [
      'AI 生成 SQL（自带 Key）不限',
      'AI 生成 SQL（平台提供）1000 次/月',
      'SQL 优化/分析 不限',
      '50 个数据库连接',
      '不限查询执行与结果行数',
      '团队协作 & 操作审计',
      '优先客服支持',
    ],
  },
  {
    id: 'enterprise',
    name: '企业版',
    desc: '团队协作与私有化部署',
    monthlyPrice: 0,
    yearlyPrice: 0,
    yearlyTotal: 0,
    gradient: 'linear-gradient(135deg, #1f2a44, #2c3a60)',
    icon: 'Connection',
    recommended: false,
    cta: '联系我们',
    highlights: [
      '专业版全部功能',
      'AI 生成不限次数 / 按量',
      '数据库连接不限',
      '私有化部署',
      'SLA 保障',
      '定制开发与集成',
    ],
  },
]

export interface ComparisonRow {
  feature: string
  values: (string | boolean)[]
}

export interface PlanTier {
  id: string
  name: string
  recommended: boolean
}

export const COMPARISON_TIERS: PlanTier[] = [
  { id: 'free', name: '免费版', recommended: false },
  { id: 'pro', name: '基础版', recommended: false },
  { id: 'team', name: '专业版', recommended: true },
  { id: 'enterprise', name: '企业版', recommended: false },
]

export const COMPARISON_ROWS: ComparisonRow[] = [
  { feature: 'AI 生成 SQL（自带 Key）', values: ['30 次/月', '500 次/月', '不限', '不限'] },
  { feature: 'AI 生成 SQL（平台提供）', values: ['10 次/月', '200 次/月', '1000 次/月', '不限 / 按量'] },
  { feature: 'SQL 优化/分析', values: ['10 次/月', '200 次/月', '不限', '不限'] },
  { feature: '数据库连接数', values: ['2', '10', '50', '不限'] },
  { feature: '查询执行', values: ['100 次/天', '不限', '不限', '不限'] },
  { feature: '查询结果行数上限', values: ['1,000 行', '10,000 行', '不限', '不限'] },
  { feature: '执行历史保留', values: ['7 天', '90 天', '365 天', '不限'] },
  { feature: 'AI 配置', values: ['1 套', '5 套', '不限', '不限'] },
  { feature: '多 Tab', values: ['3 个', '10 个', '不限', '不限'] },
  { feature: '提示词自定义', values: [false, true, true, true] },
  { feature: '团队协作', values: [false, false, true, true] },
  { feature: '操作审计日志', values: [false, false, true, true] },
  { feature: '优先客服', values: [false, false, true, true] },
  { feature: '私有化部署', values: [false, false, false, true] },
  { feature: 'SLA 保障', values: [false, false, false, true] },
]

export const FAQ_LIST = [
  {
    q: '免费版和付费版有什么区别？',
    a: '免费版提供有限的 AI 生成次数（每月 10 次）和基础功能，足够体验核心能力。付费版大幅增加 AI 生成次数、数据库连接数，并解锁高级功能。',
  },
  {
    q: '年付和月付有什么区别？',
    a: '年付享受 8.5 折优惠，例如基础版月付 ¥15，年付仅 ¥138（平均 ¥11.5/月），相当于节省 2 个月费用。',
  },
  {
    q: '加油包会过期吗？',
    a: '不会。加油包购买后永久有效，用完再买，无使用期限。',
  },
  {
    q: '可以随时升级或降级吗？',
    a: '可以。升级立即生效，降级在当前订阅周期结束后生效。',
  },
  {
    q: '企业版如何定价？',
    a: '企业版根据团队规模和部署方式按需报价。5 人以下团队 ¥2,500/年起，支持私有化部署。请联系我们的销售团队获取详细方案。',
  },
]
