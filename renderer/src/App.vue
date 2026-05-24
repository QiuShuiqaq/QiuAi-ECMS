<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import AppTopBar from './components/AppTopBar.vue'
import LegacyStudioApp from './components/LegacyStudioApp.vue'
import HotProductsPage from './components/ecms/HotProductsPage.vue'
import DraftBoardPage from './components/ecms/DraftBoardPage.vue'
import ListingCenterPage from './components/ecms/ListingCenterPage.vue'
import EcmsStudioPage from './components/ecms/EcmsStudioPage.vue'
import {
  clearStudioRuntimeState,
  generateEcmsText,
  getActivationStatus,
  getSettings,
  getStudioSnapshot,
  listNegativePromptTemplates,
  listPromptTemplates,
  removeNegativePromptTemplate,
  removePromptTemplate,
  saveNegativePromptTemplate,
  savePromptTemplate
} from './services/desktopBridge'

const themeOptions = [{ label: 'Dark', value: 'dark' }]
const activeTheme = ref('dark')
const activePage = ref('image')
const legacyStudioKey = ref(0)
const draftItems = ref([])
const activationState = ref(null)
const promptTemplates = ref([])
const negativePromptTemplates = ref([])
const sharedHostInfo = ref(createEmptyHostInfo())
const sharedCreditOverview = ref(createDefaultCreditOverview())
const sharedCreditMessages = ref(createDefaultCreditMessages())
const sharedNetworkMonitor = ref(createDefaultNetworkMonitor())

const notice = reactive({
  visible: false,
  type: 'success',
  title: '',
  message: ''
})

let noticeTimer = null

function createStatsCard(title, items) {
  return {
    title,
    items
  }
}

function createEmptyHostInfo() {
  return {
    systemName: '--',
    platformName: '--',
    architecture: '--',
    cpuModel: '--',
    userName: '--',
    runtimeName: 'QiuAi-ECMS Desktop'
  }
}

function createDefaultCreditOverview() {
  return {
    title: '积分仪表盘',
    items: [
      { label: '剩余积分', value: '0' },
      { label: '冻结积分', value: '0' },
      { label: '已用积分', value: '0' },
      { label: '累计充值积分', value: '0' },
      { label: '最近调整', value: '--' },
      { label: '按 gpt-image-2 约可生成', value: '0' }
    ]
  }
}

function createDefaultCreditMessages() {
  return {
    title: '积分消息记录',
    helperText: '当前先复用生图工作台的积分视图，后续可按文本/视频任务单独计费。',
    items: [
      {
        id: 'credit-message-text-video-1',
        label: '电商内容工坊已接入统一积分面板',
        description: '文本 / 视频当前与生图共用积分口径，后续再拆分到独立任务维度。',
        amountDisplay: '系统说明',
        createdAt: '刚刚'
      }
    ]
  }
}

function createDefaultNetworkMonitor() {
  return {
    title: '网络监控',
    summary: {
      latestLatencyMs: 186,
      averageLatencyMs: 214,
      successRate: '99.2%'
    },
    items: [
      { id: 'network-1', method: 'POST', requestPath: '/ecms/text/tasks', elapsedMs: 228, status: 'completed', timeLabel: '刚刚' },
      { id: 'network-2', method: 'POST', requestPath: '/ecms/video/tasks', elapsedMs: 242, status: 'completed', timeLabel: '1 分钟前' },
      { id: 'network-3', method: 'GET', requestPath: '/ecms/prompts', elapsedMs: 154, status: 'completed', timeLabel: '2 分钟前' },
      { id: 'network-4', method: 'GET', requestPath: '/studio/dashboard', elapsedMs: 196, status: 'completed', timeLabel: '3 分钟前' },
      { id: 'network-5', method: 'POST', requestPath: '/drafts/create', elapsedMs: 266, status: 'completed', timeLabel: '5 分钟前' },
      { id: 'network-6', method: 'GET', requestPath: '/activation/status', elapsedMs: 124, status: 'completed', timeLabel: '8 分钟前' }
    ]
  }
}

function normalizeHostInfo(hostInfo = {}, runtimeName) {
  return {
    systemName: hostInfo.systemName || '--',
    platformName: hostInfo.platformName || '--',
    architecture: hostInfo.architecture || '--',
    cpuModel: hostInfo.cpuModel || '--',
    userName: hostInfo.userName || '--',
    runtimeName: runtimeName || hostInfo.runtimeName || 'QiuAi-ECMS Desktop'
  }
}

function createTextWorkspaceDashboard() {
  return {
    singleImageStats: createStatsCard('标题生成统计', [
      { label: '标题任务数', value: '32' },
      { label: '已产出标题', value: '286' },
      { label: '发送到草稿', value: '18' },
      { label: 'AB 测试轮次', value: '6' },
      { label: '高点击方向', value: '结果感前置' },
      { label: '当前平台', value: '抖音 / 淘宝' }
    ]),
    singleDesignStats: createStatsCard('描述生成统计', [
      { label: '描述任务数', value: '21' },
      { label: '已产出描述', value: '148' },
      { label: '详情首屏方案', value: '12' },
      { label: '字幕描述方案', value: '9' },
      { label: '平均长度', value: '96 字' },
      { label: '当前结构', value: '痛点 -> 卖点 -> 收口' }
    ]),
    seriesDesignStats: createStatsCard('文本联动统计', [
      { label: '关联商品数', value: '14' },
      { label: '关联草稿数', value: '37' },
      { label: '待上架链接', value: '11' },
      { label: '跨页联动', value: '标题 / 描述' },
      { label: '重点类目', value: '家居 / 宠物 / 美妆' },
      { label: '更新频率', value: '按任务实时' }
    ]),
    seriesGenerateStats: createStatsCard('内容质量统计', [
      { label: '高转化模板', value: '8' },
      { label: '待优化模板', value: '3' },
      { label: '提示词版本', value: 'V1.0' },
      { label: '合规提醒数', value: '2' },
      { label: '常用风格', value: '强转化 / 场景型' },
      { label: '草稿回写率', value: '61%' }
    ]),
    creditOverview: sharedCreditOverview.value,
    creditMessages: sharedCreditMessages.value,
    networkMonitor: sharedNetworkMonitor.value
  }
}

function createVideoWorkspaceDashboard() {
  return {
    singleImageStats: createStatsCard('视频生成统计', [
      { label: '视频任务数', value: '16' },
      { label: '已产出视频', value: '48' },
      { label: '发送到草稿', value: '9' },
      { label: '成片时长', value: '15-30 秒' },
      { label: '当前平台', value: '抖音 / 小红书' },
      { label: '当前节奏', value: '先结果后过程' }
    ]),
    singleDesignStats: createStatsCard('脚本结构统计', [
      { label: '镜头脚本数', value: '22' },
      { label: '封面方向数', value: '13' },
      { label: '口播钩子数', value: '19' },
      { label: '场景切换版', value: '7' },
      { label: '转化型脚本', value: '10' },
      { label: '种草型脚本', value: '12' }
    ]),
    seriesDesignStats: createStatsCard('视频联动统计', [
      { label: '已绑定标题', value: '15' },
      { label: '已绑定描述', value: '12' },
      { label: '草稿待补口播', value: '6' },
      { label: '草稿待补封面', value: '5' },
      { label: '重点场景', value: '厨房 / 宿舍 / 浴室' },
      { label: '封面方向', value: '前后对比' }
    ]),
    seriesGenerateStats: createStatsCard('投放准备统计', [
      { label: '待分发平台', value: '4' },
      { label: '待补素材', value: '8' },
      { label: '高表现题材', value: '安装演示' },
      { label: '常用片头', value: '痛点钩子' },
      { label: '平均镜头数', value: '6 镜头' },
      { label: '草稿回写率', value: '56%' }
    ]),
    creditOverview: sharedCreditOverview.value,
    creditMessages: sharedCreditMessages.value,
    networkMonitor: sharedNetworkMonitor.value
  }
}

const textWorkspaceDashboard = computed(() => createTextWorkspaceDashboard())
const videoWorkspaceDashboard = computed(() => createVideoWorkspaceDashboard())
const textHostInfo = computed(() => normalizeHostInfo(sharedHostInfo.value, 'QiuAi ECMS / 文本工坊'))
const videoHostInfo = computed(() => normalizeHostInfo(sharedHostInfo.value, 'QiuAi ECMS / 视频工坊'))

const modelPricingCatalog = [
  { name: 'nano-banana-fast', credits: '440 / 次' },
  { name: 'gpt-image-2', credits: '600 / 次' },
  { name: 'nano-banana-2', credits: '1200 / 次' },
  { name: 'nano-banana', credits: '1400 / 次' },
  { name: 'nano-banana-2-cl', credits: '1600 / 次' },
  { name: 'nano-banana-pro', credits: '1800 / 次' },
  { name: 'nano-banana-pro-vt', credits: '1800 / 次' },
  { name: 'nano-banana-2-4k-cl', credits: '3000 / 次' },
  { name: 'nano-banana-pro-cl', credits: '6000 / 次' },
  { name: 'nano-banana-pro-vip', credits: '10000 / 次' },
  { name: 'nano-banana-pro-4k-vip', credits: '16000 / 次' }
]

const textModelPricingCatalog = [
  { name: 'GLM-4.7-Flash', credits: '免费模型' }
]

const navItems = computed(() => {
  return [
    { key: 'hot', label: '爆款' },
    { key: 'text', label: '文本' },
    { key: 'image', label: '生图' },
    { key: 'video', label: '视频' },
    { key: 'draft', label: '草稿', badge: draftItems.value.length ? String(draftItems.value.length) : '' },
    { key: 'publish', label: '上架' }
  ]
})

const activationSummary = computed(() => {
  if (!activationState.value) {
    return null
  }

  return {
    customerName: activationState.value.customerName || '已激活'
  }
})

const hotPlatformCards = [
  { platform: '淘宝', hotCount: '126', description: '适合主图与详情页联动出图' },
  { platform: '抖音', hotCount: '84', description: '适合先跑标题、视频、封面组合' },
  { platform: '小红书', hotCount: '59', description: '更偏种草内容与场景图' },
  { platform: '拼多多', hotCount: '71', description: '转化逻辑更偏价格和卖点直给' }
]

const hotTrendProducts = [
  {
    id: 'hot-1',
    platform: '抖音',
    growth: '+188%',
    title: '免打孔旋转纸巾架',
    summary: '适合走“前后对比 + 安装过程 + 场景展示”的内容路线。',
    searchHeat: '9.4w',
    conversion: '6.8%',
    assetDirection: '主图 / 标题 / 视频联动',
    tags: ['家居收纳', '厨房', '前后对比']
  },
  {
    id: 'hot-2',
    platform: '淘宝',
    growth: '+126%',
    title: '宠物净味豆腐猫砂',
    summary: '适合把文本卖点、生图细节图和短视频体验感一起联动。',
    searchHeat: '7.8w',
    conversion: '5.2%',
    assetDirection: '详情图 / 卖点描述 / 测评视频',
    tags: ['宠物', '复购品', '除臭']
  },
  {
    id: 'hot-3',
    platform: '小红书',
    growth: '+94%',
    title: '轻氧奶油腮红棒',
    summary: '内容驱动明显，适合标题、妆效图、试色视频一起做。',
    searchHeat: '6.1w',
    conversion: '4.6%',
    assetDirection: '色号图 / 种草文案 / 妆效短视频',
    tags: ['美妆', '种草', '场景感']
  },
  {
    id: 'hot-4',
    platform: '拼多多',
    growth: '+142%',
    title: '速干冰丝防晒披肩',
    summary: '更适合季节节点型打法，重点突出场景、价格带和即时需求。',
    searchHeat: '8.3w',
    conversion: '7.4%',
    assetDirection: '主图海报 / 标题 / 场景视频',
    tags: ['服饰', '夏季', '防晒']
  }
]

const scoutingSteps = [
  { title: '站点白名单', description: '只抓你明确给出的站点和栏目，不做泛化爬取。' },
  { title: '少量采样', description: '默认只拉少量商品样本，先验证字段质量和可用性。' },
  { title: '限频执行', description: '默认低频、低并发，避免对目标站造成压力。' },
  { title: '人工复核', description: '热榜结果先人工确认，再流向文本、生图、视频流程。' }
]

const textMenuItems = [
  { key: 'workspace', label: '工作台' },
  { key: 'title-generate', label: '标题生成' },
  { key: 'description-generate', label: '描述生成' },
  { key: 'model-pricing', label: '模型价格' },
  { key: 'prompt-library', label: '提示词库' }
]

const videoMenuItems = [
  { key: 'workspace', label: '工作台' },
  { key: 'video-generate', label: '视频生成' },
  { key: 'model-pricing', label: '模型价格' },
  { key: 'prompt-library', label: '提示词库' }
]

const textOverviewCards = [
  { title: '标题流', description: '围绕点击率做单条标题生成，一条标题视为一组结果。', tags: ['标题生成', '点击率', '草稿联动'] },
  { title: '描述流', description: '围绕卖点与详情描述做分组生成，一条描述视为一组结果。', tags: ['描述生成', '详情页', '上架预备'] },
  { title: '价格与模板', description: '模型价格和提示词库沿用生图体系，方便后续统一参数。', tags: ['模型价格', '提示词库'] }
]

const videoOverviewCards = [
  { title: '视频流', description: '围绕单个视频任务做分组输出，一个视频视为一组结果。', tags: ['视频生成', '镜头脚本', '草稿联动'] },
  { title: '封面与口播', description: '后续会继续接文本页标题和描述成果，让视频页自然复用。', tags: ['封面', '口播', '联动'] },
  { title: '价格与模板', description: '模型价格和提示词库继续沿用生图体系，保证系统感统一。', tags: ['模型价格', '提示词库'] }
]

const textParameterSections = {
  'title-generate': {
    description: '标题生成先按照真实电商场景拆成任务基础、商品信息、风格约束和输出规则。',
    groups: [
      {
        title: '任务基础',
        copy: '先确定本轮标题任务的用途和平台。',
        fields: [
          { key: 'text_title_task_name', label: '任务名称', placeholder: '例如：旋转纸巾架标题首轮', value: '旋转纸巾架标题首轮' },
          { key: 'text_title_platform', label: '目标平台', type: 'select', options: ['淘宝', '抖音', '小红书', '拼多多'], value: '抖音' },
          { key: 'text_title_channel', label: '投放位置', type: 'select', options: ['搜索标题', '主图大字', '商品卡标题', '短视频封面'], value: '商品卡标题' },
          { key: 'text_title_batch_count', label: '输出组数', type: 'number', placeholder: '例如 12', value: 12, hint: '每一条标题视作一组结果。' }
        ]
      },
      {
        title: '商品信息',
        copy: '把商品本身、卖点和人群讲清楚，后面标题会更稳。',
        fields: [
          { key: 'text_title_product_name', label: '商品名称', placeholder: '输入商品名称', value: '免打孔旋转纸巾架' },
          { key: 'text_title_core_selling_points', label: '核心卖点', type: 'textarea', rows: 4, placeholder: '输入 3-6 个核心卖点', value: '免打孔安装、旋转抽取、防潮防油烟、转角利用、台面整洁' },
          { key: 'text_title_target_people', label: '目标人群', placeholder: '例如：厨房收纳人群 / 宿舍党', value: '厨房收纳人群、租房用户、宿舍党' },
          { key: 'text_title_scene_words', label: '场景词', placeholder: '例如：厨房、宿舍、浴室', value: '厨房、宿舍、浴室、转角墙面' }
        ]
      },
      {
        title: '风格约束',
        copy: '控制标题长度、口吻和禁用词，方便更贴近平台风格。',
        fields: [
          { key: 'text_title_style', label: '标题风格', type: 'select', options: ['强转化', '种草型', '场景型', '价格刺激型'], value: '强转化' },
          { key: 'text_title_length_limit', label: '字数限制', placeholder: '例如：24-30 字', value: '24-30 字' },
          { key: 'text_title_must_keywords', label: '必带关键词', placeholder: '例如：免打孔 / 旋转纸巾架', value: '免打孔、旋转纸巾架' },
          { key: 'text_title_banned_words', label: '禁用词', placeholder: '例如：绝对 / 全网最低', value: '绝对、全网最低、唯一' }
        ]
      },
      {
        title: '输出规则',
        copy: '先用规则化方式控制结果，后面更好衔接草稿与上架。',
        fields: [
          { key: 'text_title_output_goal', label: '本轮目标', type: 'select', options: ['测试点击率', '详情页首屏', '主图副标题', '封面大字'], value: '测试点击率' },
          { key: 'text_title_reference_direction', label: '参考方向', type: 'textarea', rows: 4, placeholder: '输入希望靠近的标题表达', value: '突出结果感、痛点前置、场景清晰、前 8 个字就要有抓力。' }
        ]
      }
    ]
  },
  'description-generate': {
    description: '描述生成先按照详情页、商品卡和视频字幕会用到的方式拆字段。',
    groups: [
      {
        title: '任务基础',
        copy: '先确定描述要服务的页面位置。',
        fields: [
          { key: 'text_desc_task_name', label: '任务名称', placeholder: '例如：旋转纸巾架详情描述首轮', value: '旋转纸巾架详情描述首轮' },
          { key: 'text_desc_platform', label: '目标平台', type: 'select', options: ['淘宝', '抖音', '小红书', '拼多多'], value: '淘宝' },
          { key: 'text_desc_channel', label: '描述位置', type: 'select', options: ['详情页首屏', '详情页模块', '商品描述', '视频字幕'], value: '详情页首屏' },
          { key: 'text_desc_batch_count', label: '输出组数', type: 'number', placeholder: '例如 8', value: 8, hint: '每一条描述视作一组结果。' }
        ]
      },
      {
        title: '商品与卖点',
        copy: '把卖点层级与使用场景拆出来，方便后续链接草稿直接承接。',
        fields: [
          { key: 'text_desc_product_name', label: '商品名称', placeholder: '输入商品名称', value: '免打孔旋转纸巾架' },
          { key: 'text_desc_top_benefits', label: '优先卖点', type: 'textarea', rows: 4, placeholder: '输入排序后的卖点', value: '1. 安装不伤墙 2. 抽取顺手 3. 转角利用 4. 防潮防油烟' },
          { key: 'text_desc_usage_scene', label: '使用场景', type: 'textarea', rows: 4, placeholder: '输入典型场景', value: '厨房灶台边、宿舍书桌旁、浴室墙面、冰箱侧面' },
          { key: 'text_desc_specs', label: '规格信息', placeholder: '例如：尺寸 / 材质 / 安装方式', value: 'ABS 材质，免打孔粘贴安装，可旋转抽取' }
        ]
      },
      {
        title: '详情结构',
        copy: '提前把描述按模块组织，方便草稿页按链接逻辑继续收口。',
        fields: [
          { key: 'text_desc_structure', label: '结构模板', type: 'textarea', rows: 5, placeholder: '例如：痛点 -> 卖点 -> 场景 -> 规格 -> 收口', value: '痛点开场 -> 安装优势 -> 使用细节 -> 场景展示 -> 规格补充 -> 收口促转化' },
          { key: 'text_desc_tone', label: '表达口吻', type: 'select', options: ['直给转化', '生活化', '专业说明', '种草型'], value: '直给转化' },
          { key: 'text_desc_length_limit', label: '长度限制', placeholder: '例如：80-120 字', value: '80-120 字' },
          { key: 'text_desc_cta', label: '收口动作', placeholder: '例如：引导收藏加购', value: '引导收藏加购，强调安装方便和台面整洁结果' }
        ]
      },
      {
        title: '风险与禁用',
        copy: '先把禁用表达写进来，减少后续清洗成本。',
        fields: [
          { key: 'text_desc_banned_words', label: '禁用词', placeholder: '例如：根治 / 唯一 / 最低价', value: '根治、唯一、最低价、绝对无味' },
          { key: 'text_desc_compliance_hint', label: '合规提醒', type: 'textarea', rows: 3, placeholder: '输入需要规避的表达', value: '避免医疗化、绝对化和夸大承重的描述，强调体验而不是绝对承诺。' }
        ]
      }
    ]
  }
}

const videoParameterSections = {
  'video-generate': {
    description: '视频生成先按任务基础、镜头脚本、口播封面和发布要求来拆参数。',
    groups: [
      {
        title: '任务基础',
        copy: '先确定平台、时长和本轮任务目标。',
        fields: [
          { key: 'video_task_name', label: '任务名称', placeholder: '例如：旋转纸巾架视频首轮', value: '旋转纸巾架视频首轮' },
          { key: 'video_platform', label: '发布平台', type: 'select', options: ['抖音', '快手', '视频号', '小红书'], value: '抖音' },
          { key: 'video_duration', label: '时长', type: 'select', options: ['15 秒', '20 秒', '30 秒', '45 秒'], value: '30 秒' },
          { key: 'video_batch_count', label: '输出组数', type: 'number', placeholder: '例如 6', value: 6, hint: '每一个视频方案视作一组结果。' }
        ]
      },
      {
        title: '商品与镜头',
        copy: '先把商品信息和镜头节奏放进来，后面更容易扩成完整视频流。',
        fields: [
          { key: 'video_product_name', label: '商品名称', placeholder: '输入商品名称', value: '免打孔旋转纸巾架' },
          { key: 'video_storyline', label: '镜头思路', type: 'textarea', rows: 5, placeholder: '输入镜头结构', value: '痛点开场 -> 安装过程 -> 抽取演示 -> 使用场景 -> 收口转化' },
          { key: 'video_scene_list', label: '场景列表', placeholder: '例如：厨房 / 宿舍 / 浴室', value: '厨房、宿舍、浴室' },
          { key: 'video_proof_points', label: '证据点', type: 'textarea', rows: 4, placeholder: '输入镜头里必须出现的证据', value: '安装过程、承重效果、转角使用、潮湿环境抽取' }
        ]
      },
      {
        title: '口播与封面',
        copy: '封面和口播后续会继续与文本页联动，这里先把基础字段补齐。',
        fields: [
          { key: 'video_hook', label: '开场钩子', type: 'textarea', rows: 3, placeholder: '输入开头 3 秒钩子', value: '你家厨房纸巾是不是永远放得又油又乱？' },
          { key: 'video_voice_tone', label: '口播风格', type: 'select', options: ['强转化', '生活化', '测评型', '教程型'], value: '生活化' },
          { key: 'video_cover_title', label: '封面标题方向', placeholder: '例如：三秒装好，台面立刻清爽', value: '三秒装好，台面立刻清爽' },
          { key: 'video_cta', label: '结尾动作', placeholder: '例如：引导收藏加购', value: '引导收藏加购，突出好装不占地' }
        ]
      },
      {
        title: '发布约束',
        copy: '先把平台限制和禁用表达前置，方便后面生成更稳。',
        fields: [
          { key: 'video_output_goal', label: '本轮目标', type: 'select', options: ['起量测试', '商品转化', '详情视频位', '种草引流'], value: '商品转化' },
          { key: 'video_banned_words', label: '禁用词', placeholder: '例如：绝对 / 全网第一', value: '绝对、全网第一、唯一' },
          { key: 'video_style_reference', label: '风格参考', type: 'textarea', rows: 4, placeholder: '输入希望靠近的节奏和表达', value: '节奏快、画面清晰、先结果后过程、镜头切换不要过杂。' }
        ]
      }
    ]
  }
}

const initialTextResultSections = {
  'title-generate': {
    description: '效果展示保持与生图一致的结果区结构，单个标题就是一组。',
    groups: [
      {
        id: 'title-1',
        title: '标题组 01',
        subtitle: '单标题结果',
        outputTitle: '免打孔旋转纸巾架，厨房台面立刻清爽一半',
        summary: '这一组强调结果感和场景痛点，适合先拉点击。',
        detail: '适用方向：抖音短标题 / 主图大字 / 首屏卖点',
        metadata: [
          { label: '平台', value: '抖音' },
          { label: '风格', value: '点击导向' }
        ],
        tags: ['标题', '点击率', '厨房'],
        draftPayload: {
          draftType: 'listing_title',
          productName: '免打孔旋转纸巾架',
          targetPlatform: '抖音',
          contentType: '标题',
          listingTitle: '免打孔旋转纸巾架，厨房台面立刻清爽一半',
          sellingPoint: '结果感强，适合点击率测试',
          nextAction: '进入草稿后可与主图方案绑定'
        }
      },
      {
        id: 'title-2',
        title: '标题组 02',
        subtitle: '单标题结果',
        outputTitle: '不占台面不伤墙，宿舍厨房都能挂的旋转纸巾架',
        summary: '这一组更适合双场景扩展，兼顾宿舍与厨房。',
        detail: '适用方向：详情标题 / 场景切换素材 / 平台标题 AB 测试',
        metadata: [
          { label: '平台', value: '淘宝' },
          { label: '风格', value: '场景导向' }
        ],
        tags: ['标题', '场景化'],
        draftPayload: {
          draftType: 'listing_title',
          productName: '免打孔旋转纸巾架',
          targetPlatform: '淘宝',
          contentType: '标题',
          listingTitle: '不占台面不伤墙，宿舍厨房都能挂的旋转纸巾架',
          sellingPoint: '双场景覆盖，适合详情页与商品卡',
          nextAction: '进入草稿后可继续关联详情描述'
        }
      }
    ]
  },
  'description-generate': {
    description: '效果展示保持与生图一致的结果区结构，单个描述就是一组。',
    groups: [
      {
        id: 'desc-1',
        title: '描述组 01',
        subtitle: '单描述结果',
        outputTitle: '详情描述文案',
        summary: '免打孔安装，抽取顺手，防潮防油烟，转角也能充分利用，让厨房纸巾真正回到顺手的位置。',
        detail: '适用方向：详情页首屏 / 商品描述 / 主图副标题',
        metadata: [
          { label: '平台', value: '淘宝 / 拼多多' },
          { label: '层级', value: '首屏卖点' }
        ],
        tags: ['描述', '详情页', '卖点'],
        draftPayload: {
          draftType: 'listing_description',
          productName: '免打孔旋转纸巾架',
          targetPlatform: '淘宝 / 拼多多',
          contentType: '描述',
          listingDescription: '免打孔安装，抽取顺手，防潮防油烟，转角也能充分利用，让厨房纸巾真正回到顺手的位置。',
          sellingPoint: '适合详情页首屏承接',
          nextAction: '进入草稿后可直接作为详情模块初稿'
        }
      },
      {
        id: 'desc-2',
        title: '描述组 02',
        subtitle: '单描述结果',
        outputTitle: '场景型描述文案',
        summary: '厨房、宿舍、浴室都能快速上墙，整洁不占地，抽纸时不用再一手扶盒一手抽纸。',
        detail: '适用方向：场景描述 / 短视频字幕 / 图文详情补充',
        metadata: [
          { label: '平台', value: '抖音 / 小红书' },
          { label: '层级', value: '场景扩展' }
        ],
        tags: ['描述', '场景', '字幕'],
        draftPayload: {
          draftType: 'listing_description',
          productName: '免打孔旋转纸巾架',
          targetPlatform: '抖音 / 小红书',
          contentType: '描述',
          listingDescription: '厨房、宿舍、浴室都能快速上墙，整洁不占地，抽纸时不用再一手扶盒一手抽纸。',
          sellingPoint: '场景扩展强，适合短视频字幕与图文详情',
          nextAction: '进入草稿后可继续和视频脚本绑定'
        }
      }
    ]
  }
}

function createPreview(title, accent) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <defs>
        <linearGradient id="bg" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="#18122b" />
          <stop offset="100%" stop-color="${accent}" />
        </linearGradient>
      </defs>
      <rect width="640" height="360" rx="28" fill="url(#bg)" />
      <rect x="34" y="34" width="240" height="292" rx="22" fill="rgba(255,255,255,0.08)" />
      <rect x="308" y="52" width="250" height="16" rx="8" fill="rgba(255,255,255,0.72)" />
      <rect x="308" y="88" width="198" height="12" rx="6" fill="rgba(255,255,255,0.34)" />
      <rect x="308" y="122" width="280" height="98" rx="18" fill="rgba(255,255,255,0.1)" />
      <rect x="308" y="240" width="140" height="40" rx="20" fill="rgba(255,255,255,0.82)" />
      <text x="308" y="316" fill="white" font-size="28" font-family="Segoe UI, PingFang SC, sans-serif">${title}</text>
    </svg>
  `

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

const videoResultSections = {
  'video-generate': {
    description: '效果展示保持与生图一致的结果区结构，单个视频就是一组。',
    groups: [
      {
        id: 'video-1',
        title: '视频组 01',
        subtitle: '单视频结果',
        outputTitle: '30 秒转化短视频',
        summary: '先展示台面凌乱，再演示安装，最后展示抽取和收纳效果，节奏清晰。',
        detail: '适用方向：抖音短视频 / 商品橱窗内容 / 详情页视频位',
        metadata: [
          { label: '平台', value: '抖音' },
          { label: '时长', value: '30 秒' }
        ],
        tags: ['视频', '转化', '安装演示'],
        preview: createPreview('视频方案 01', '#f97316'),
        draftPayload: {
          draftType: 'listing_video',
          productName: '免打孔旋转纸巾架',
          targetPlatform: '抖音',
          contentType: '视频',
          videoTheme: '30 秒转化短视频',
          coverDirection: '台面整洁前后对比',
          sellingPoint: '安装快、结果明显、镜头转化路径清晰',
          nextAction: '进入草稿后可继续绑定封面和标题'
        }
      },
      {
        id: 'video-2',
        title: '视频组 02',
        subtitle: '单视频结果',
        outputTitle: '场景型种草短视频',
        summary: '突出宿舍与厨房双场景切换，强化“不占地、不伤墙、顺手抽取”的体验感。',
        detail: '适用方向：小红书 / 场景种草 / 多平台分发',
        metadata: [
          { label: '平台', value: '小红书' },
          { label: '时长', value: '20 秒' }
        ],
        tags: ['视频', '种草', '双场景'],
        preview: createPreview('视频方案 02', '#22c55e'),
        draftPayload: {
          draftType: 'listing_video',
          productName: '免打孔旋转纸巾架',
          targetPlatform: '小红书',
          contentType: '视频',
          videoTheme: '双场景种草短视频',
          coverDirection: '宿舍 / 厨房切换感',
          sellingPoint: '更适合种草与生活化内容',
          nextAction: '进入草稿后可继续补口播和配图'
        }
      }
    ]
  }
}

const textQueueCards = [
  { title: '草稿联动', description: '标题生成与描述生成的每一组结果都可以直接发送到草稿。' },
  { title: '后续细化', description: '参数设置部分先占位，后面你补规则我再按你的逻辑展开。' },
  { title: '上架承接', description: '草稿页会继续按上架链接逻辑承接这些文本结果。' }
]

const videoQueueCards = [
  { title: '草稿联动', description: '视频生成的每一组结果都可以直接发送到草稿。' },
  { title: '后续细化', description: '参数设置部分先占位，后面你补镜头、封面、口播规则我再展开。' },
  { title: '跨页协同', description: '后续可以继续把文本页标题与描述自动带入视频页。' }
]

const TEXT_MODEL_NAME = 'glm-4.7-flash'
const textResultSections = ref(cloneResultSections(initialTextResultSections))
const textSubmitStates = reactive({
  'title-generate': false,
  'description-generate': false
})
const textStatusStates = reactive({
  'title-generate': createTextStatusState({
    tone: 'info',
    title: '文本模型待命',
    badge: '未检测',
    message: '正在准备 GLM-4.7-Flash 文本能力。',
    detail: '当前模型：GLM-4.7-Flash'
  }),
  'description-generate': createTextStatusState({
    tone: 'info',
    title: '文本模型待命',
    badge: '未检测',
    message: '正在准备 GLM-4.7-Flash 文本能力。',
    detail: '当前模型：GLM-4.7-Flash'
  })
})

function cloneResultSections(sectionMap = {}) {
  return JSON.parse(JSON.stringify(sectionMap))
}

function createTextStatusState({
  tone = 'info',
  title = '',
  badge = '',
  message = '',
  detail = ''
} = {}) {
  return {
    tone,
    title,
    badge,
    message,
    detail
  }
}

function applyTextStatusState(statusState = {}) {
  const nextStatusState = createTextStatusState(statusState)
  textStatusStates['title-generate'] = { ...nextStatusState }
  textStatusStates['description-generate'] = { ...nextStatusState }
}

function buildReadyTextStatusState() {
  return createTextStatusState({
    tone: 'info',
    title: 'GLM-4.7-Flash 已就绪',
    badge: '可提交',
    message: '已检测到本机可用 API-Key，提交后会直接请求智谱官方文本接口。',
    detail: '当前模型：GLM-4.7-Flash'
  })
}

function buildMissingKeyTextStatusState() {
  return createTextStatusState({
    tone: 'warning',
    title: '未检测到 API-Key',
    badge: '需配置',
    message: '当前文本功能没有可用的 API-Key，提交任务前需要先在本机设置里保存可用密钥。',
    detail: '当前模型：GLM-4.7-Flash'
  })
}

function buildSuccessTextStatusState(groupCount) {
  return createTextStatusState({
    tone: 'success',
    title: '接口调用成功',
    badge: '已连通',
    message: `本次请求已成功返回 ${groupCount} 组文本结果，可以继续发送到草稿。`,
    detail: '当前模型：GLM-4.7-Flash'
  })
}

function buildRateLimitTextStatusState(errorMessage = '') {
  return createTextStatusState({
    tone: 'warning',
    title: '接口被限流',
    badge: '429',
    message: '智谱官方当前拒绝了这次请求，请降低调用频率或等待一段时间后重试。',
    detail: errorMessage || '当前模型：GLM-4.7-Flash'
  })
}

function buildTimeoutTextStatusState(errorMessage = '') {
  return createTextStatusState({
    tone: 'error',
    title: '网络请求超时',
    badge: '超时',
    message: '请求已经发出，但等待模型返回时超时。通常是网络波动或服务端响应较慢。',
    detail: errorMessage || '当前模型：GLM-4.7-Flash'
  })
}

function buildNetworkTextStatusState(errorMessage = '') {
  return createTextStatusState({
    tone: 'error',
    title: '无法连接到文本接口',
    badge: '网络异常',
    message: '当前桌面应用未能稳定连接到智谱官方接口，请检查网络、代理或防火墙设置。',
    detail: errorMessage || '当前模型：GLM-4.7-Flash'
  })
}

function buildGenericErrorTextStatusState(errorMessage = '') {
  return createTextStatusState({
    tone: 'error',
    title: '文本接口返回异常',
    badge: '请求失败',
    message: '模型请求没有成功完成，请根据错误信息排查后重试。',
    detail: errorMessage || '当前模型：GLM-4.7-Flash'
  })
}

function classifyTextStatusState(error) {
  const errorMessage = String(error?.message || '').trim()
  const normalizedMessage = errorMessage.toLowerCase()

  if (!errorMessage) {
    return buildGenericErrorTextStatusState('当前模型：GLM-4.7-Flash')
  }

  if (normalizedMessage.includes('api-key') || normalizedMessage.includes('api key') || errorMessage.includes('API-Key')) {
    return buildMissingKeyTextStatusState()
  }

  if (errorMessage.includes('速率限制') || normalizedMessage.includes('429') || normalizedMessage.includes('1302')) {
    return buildRateLimitTextStatusState(errorMessage)
  }

  if (normalizedMessage.includes('timeout') || errorMessage.includes('超时')) {
    return buildTimeoutTextStatusState(errorMessage)
  }

  if (
    normalizedMessage.includes('network') ||
    normalizedMessage.includes('enotfound') ||
    normalizedMessage.includes('econnrefused') ||
    normalizedMessage.includes('socket hang up') ||
    normalizedMessage.includes('failed to fetch') ||
    errorMessage.includes('无法连接')
  ) {
    return buildNetworkTextStatusState(errorMessage)
  }

  return buildGenericErrorTextStatusState(errorMessage)
}

function resolveHasApiKey(settings = {}) {
  if (typeof settings.apiKey === 'string' && settings.apiKey.trim()) {
    return true
  }

  const activeIndex = Number.isInteger(settings.activeApiKeyIndex) ? settings.activeApiKeyIndex : 0
  const apiKey = Array.isArray(settings.apiKeys) ? settings.apiKeys[activeIndex] : ''
  return typeof apiKey === 'string' && Boolean(apiKey.trim())
}

async function initializeTextStatusState() {
  try {
    const settings = await getSettings()
    applyTextStatusState(resolveHasApiKey(settings) ? buildReadyTextStatusState() : buildMissingKeyTextStatusState())
  } catch {
    applyTextStatusState(createTextStatusState({
      tone: 'info',
      title: '文本配置待确认',
      badge: '未读取',
      message: '当前未能读取本机设置，提交任务时会再次检测文本接口配置。',
      detail: '当前模型：GLM-4.7-Flash'
    }))
  }
}

function padGroupIndex(index) {
  return String(index + 1).padStart(2, '0')
}

function normalizeTextCount(value, fallback = 6) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return fallback
  }

  return Math.min(20, Math.max(1, Math.round(numericValue)))
}

function buildTitlePrompt(formState = {}) {
  return [
    `商品名称：${formState.text_title_product_name || ''}`,
    `目标平台：${formState.text_title_platform || ''}`,
    `投放位置：${formState.text_title_channel || ''}`,
    `目标人群：${formState.text_title_target_people || ''}`,
    `场景词：${formState.text_title_scene_words || ''}`,
    `核心卖点：${formState.text_title_core_selling_points || ''}`,
    `标题风格：${formState.text_title_style || ''}`,
    `字数限制：${formState.text_title_length_limit || ''}`,
    `必须包含关键词：${formState.text_title_must_keywords || ''}`,
    `禁用词：${formState.text_title_banned_words || ''}`,
    `本轮目标：${formState.text_title_output_goal || ''}`,
    `参考方向：${formState.text_title_reference_direction || ''}`,
    '请输出适合电商使用的中文标题，每条都要有明确吸引力，并尽量避免重复表达。'
  ].filter(Boolean).join('\n')
}

function buildDescriptionPrompt(formState = {}) {
  return [
    `商品名称：${formState.text_desc_product_name || ''}`,
    `目标平台：${formState.text_desc_platform || ''}`,
    `描述位置：${formState.text_desc_channel || ''}`,
    `优先卖点：${formState.text_desc_top_benefits || ''}`,
    `使用场景：${formState.text_desc_usage_scene || ''}`,
    `规格信息：${formState.text_desc_specs || ''}`,
    `结构模板：${formState.text_desc_structure || ''}`,
    `表达口吻：${formState.text_desc_tone || ''}`,
    `长度要求：${formState.text_desc_length_limit || ''}`,
    `收口动作：${formState.text_desc_cta || ''}`,
    `禁用词：${formState.text_desc_banned_words || ''}`,
    `合规提醒：${formState.text_desc_compliance_hint || ''}`,
    '请输出可直接用于电商详情、商品卖点或字幕文案的中文描述，每条单独成组。'
  ].filter(Boolean).join('\n')
}

function buildTextGenerationDraft(menuKey, formState = {}) {
  if (menuKey === 'title-generate') {
    return {
      mode: 'title-generate',
      model: TEXT_MODEL_NAME,
      quantity: normalizeTextCount(formState.text_title_batch_count, 12),
      prompt: buildTitlePrompt(formState)
    }
  }

  return {
    mode: 'description-generate',
    model: TEXT_MODEL_NAME,
    quantity: normalizeTextCount(formState.text_desc_batch_count, 8),
    prompt: buildDescriptionPrompt(formState)
  }
}

function createTextResultGroup(menuKey, item, index, formState = {}) {
  const order = padGroupIndex(index)

  if (menuKey === 'title-generate') {
    return {
      id: item.id || `title-${order}`,
      title: `标题组 ${order}`,
      subtitle: '单标题结果',
      outputTitle: item.content,
      summary: '已按当前参数生成，可直接发送到草稿。',
      detail: `适用方向：${formState.text_title_channel || '标题生成'} / ${formState.text_title_output_goal || '电商标题'} / ${formState.text_title_platform || '默认平台'}`,
      metadata: [
        { label: '平台', value: formState.text_title_platform || '未设置' },
        { label: '风格', value: formState.text_title_style || '未设置' }
      ],
      tags: ['标题', formState.text_title_style || '文案', formState.text_title_platform || '电商'].filter(Boolean),
      draftPayload: {
        draftType: 'listing_title',
        productName: formState.text_title_product_name || '',
        targetPlatform: formState.text_title_platform || '',
        contentType: '标题',
        listingTitle: item.content,
        sellingPoint: formState.text_title_core_selling_points || '',
        nextAction: '可继续补充描述或直接进入草稿整理'
      }
    }
  }

  return {
    id: item.id || `desc-${order}`,
    title: `描述组 ${order}`,
    subtitle: '单描述结果',
    outputTitle: '商品描述文案',
    summary: item.content,
    detail: `适用方向：${formState.text_desc_channel || '描述生成'} / ${formState.text_desc_tone || '默认口吻'} / ${formState.text_desc_platform || '默认平台'}`,
    metadata: [
      { label: '平台', value: formState.text_desc_platform || '未设置' },
      { label: '口吻', value: formState.text_desc_tone || '未设置' }
    ],
    tags: ['描述', formState.text_desc_tone || '文案', formState.text_desc_platform || '电商'].filter(Boolean),
    draftPayload: {
      draftType: 'listing_description',
      productName: formState.text_desc_product_name || '',
      targetPlatform: formState.text_desc_platform || '',
      contentType: '描述',
      listingDescription: item.content,
      sellingPoint: formState.text_desc_top_benefits || '',
      nextAction: '可继续补充标题或进入草稿整理'
    }
  }
}

function updateTextResultGroups(menuKey, groups = []) {
  const currentSections = textResultSections.value || {}
  const currentSection = currentSections[menuKey] || initialTextResultSections[menuKey] || { description: '', groups: [] }

  textResultSections.value = {
    ...currentSections,
    [menuKey]: {
      ...currentSection,
      groups
    }
  }
}

async function handleTextSubmit({ menuKey, formState } = {}) {
  if (!['title-generate', 'description-generate'].includes(menuKey) || textSubmitStates[menuKey]) {
    return
  }

  textSubmitStates[menuKey] = true

  try {
    const draft = buildTextGenerationDraft(menuKey, formState)
    const results = await generateEcmsText({
      taskId: `ecms-text-${menuKey}-${Date.now()}`,
      draft
    })
    const groups = (Array.isArray(results) ? results : []).map((item, index) => {
      return createTextResultGroup(menuKey, item, index, formState)
    })

    if (!groups.length) {
      throw new Error('文本模型没有返回可展示的结果')
    }

    updateTextResultGroups(menuKey, groups)
    applyTextStatusState(buildSuccessTextStatusState(groups.length))
    showNotice('success', '文本生成完成', `已生成 ${groups.length} 组${menuKey === 'title-generate' ? '标题' : '描述'}结果`)
  } catch (error) {
    const statusState = classifyTextStatusState(error)
    applyTextStatusState(statusState)
    showNotice('error', statusState.title || '文本生成失败', statusState.detail || statusState.message || error?.message || '请检查 API-Key 或网络后重试')
  } finally {
    textSubmitStates[menuKey] = false
  }
}

function showNotice(type, title, message) {
  if (noticeTimer) {
    clearTimeout(noticeTimer)
  }

  notice.visible = true
  notice.type = type
  notice.title = title
  notice.message = message

  noticeTimer = setTimeout(() => {
    notice.visible = false
    noticeTimer = null
  }, 2200)
}

function createDraftEditorPayload(payload = {}, createdAt = '') {
  const baseDraft = payload.draftPayload || {}
  const draftType = baseDraft.draftType || 'listing_content'
  const productName = baseDraft.productName || '待补商品名'
  const targetPlatform = baseDraft.targetPlatform || '待选平台'
  const contentType = baseDraft.contentType || '待定内容'
  const listingTitle = baseDraft.listingTitle || payload.title || ''
  const listingDescription = baseDraft.listingDescription || payload.summary || ''
  const videoTheme = baseDraft.videoTheme || ''
  const coverDirection = baseDraft.coverDirection || ''
  const sellingPoint = baseDraft.sellingPoint || ''
  const nextAction = baseDraft.nextAction || '继续补齐上架字段'
  const preview = payload.preview || ''

  return {
    ...baseDraft,
    draftType,
    productName,
    targetPlatform,
    contentType,
    listingTitle,
    listingDescription,
    videoTheme,
    coverDirection,
    sellingPoint,
    nextAction,
    editor: {
      categoryPath: baseDraft.editor?.categoryPath || '',
      brandName: baseDraft.editor?.brandName || '',
      storeName: baseDraft.editor?.storeName || '',
      priceMin: baseDraft.editor?.priceMin || '',
      priceMax: baseDraft.editor?.priceMax || '',
      marketPrice: baseDraft.editor?.marketPrice || '',
      skuName: baseDraft.editor?.skuName || '默认款',
      skuValue: baseDraft.editor?.skuValue || '标准版',
      inventory: baseDraft.editor?.inventory || '100',
      shippingTemplate: baseDraft.editor?.shippingTemplate || '',
      coverImage: baseDraft.editor?.coverImage || preview,
      mainImagePlan: baseDraft.editor?.mainImagePlan || (preview ? '已从来源结果挂载一张主视觉' : ''),
      detailImagePlan: baseDraft.editor?.detailImagePlan || '',
      videoAssetPlan: baseDraft.editor?.videoAssetPlan || videoTheme,
      videoScriptNote: baseDraft.editor?.videoScriptNote || '',
      publishStatus: baseDraft.editor?.publishStatus || '待整理',
      publishWindow: baseDraft.editor?.publishWindow || '',
      operator: baseDraft.editor?.operator || '',
      remarks: baseDraft.editor?.remarks || '',
      lastSyncedAt: createdAt
    },
    checklist: {
      titleReady: baseDraft.checklist?.titleReady ?? Boolean(listingTitle),
      descriptionReady: baseDraft.checklist?.descriptionReady ?? Boolean(listingDescription),
      imageReady: baseDraft.checklist?.imageReady ?? Boolean(preview || baseDraft.editor?.mainImagePlan),
      videoReady: baseDraft.checklist?.videoReady ?? Boolean(videoTheme || baseDraft.editor?.videoAssetPlan),
      categoryReady: baseDraft.checklist?.categoryReady ?? false,
      priceReady: baseDraft.checklist?.priceReady ?? false,
      skuReady: baseDraft.checklist?.skuReady ?? false,
      complianceReady: baseDraft.checklist?.complianceReady ?? false
    }
  }
}

function updateNestedValue(target, path, value) {
  const segments = Array.isArray(path) ? path : String(path || '').split('.').filter(Boolean)
  if (!segments.length) {
    return target
  }

  const clone = Array.isArray(target) ? [...target] : { ...(target || {}) }
  let current = clone

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]
    const nextValue = current[segment]
    current[segment] = Array.isArray(nextValue) ? [...nextValue] : { ...(nextValue || {}) }
    current = current[segment]
  }

  current[segments[segments.length - 1]] = value
  return clone
}

async function handleCleanupClick() {
  try {
    await clearStudioRuntimeState()
    legacyStudioKey.value += 1
    showNotice('success', '清理完成', '运行态数据已清理，生图页会重新加载。')
  } catch (error) {
    showNotice('error', '清理失败', error?.message || '一键清理未完成')
  }
}

function handleSendToDraft(payload) {
  const createdAt = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date())

  draftItems.value = [
    {
      id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt,
      source: payload.source || '未知来源',
      module: payload.module || '未命名模块',
      section: payload.section || '默认分组',
      title: payload.title || '未命名草稿',
      summary: payload.summary || '待补充摘要',
      preview: payload.preview || '',
      tags: Array.isArray(payload.tags) ? payload.tags : [],
      metadata: Array.isArray(payload.metadata) ? payload.metadata : [],
      draftPayload: createDraftEditorPayload(payload, createdAt),
      raw: payload.raw || null
    },
    ...draftItems.value
  ]

  showNotice('success', '已加入草稿', `${payload.title || '当前结果'} 已发送到草稿。`)
}

function handleDraftFieldUpdate({ draftId, path, value }) {
  if (!draftId || !path) {
    return
  }

  draftItems.value = draftItems.value.map((item) => {
    if (item.id !== draftId) {
      return item
    }

    return {
      ...item,
      draftPayload: updateNestedValue(item.draftPayload || {}, path, value)
    }
  })
}

async function handleSavePromptTemplate(payload) {
  try {
    await savePromptTemplate(payload)
    promptTemplates.value = await listPromptTemplates().catch(() => promptTemplates.value)
    showNotice('success', '保存成功', '提示词模板已更新。')
  } catch (error) {
    showNotice('error', '保存失败', error?.message || '提示词模板保存未完成')
  }
}

async function handleRemovePromptTemplate(templateId) {
  try {
    await removePromptTemplate({
      id: templateId
    })
    promptTemplates.value = await listPromptTemplates().catch(() => promptTemplates.value)
    showNotice('success', '删除成功', '提示词模板已删除。')
  } catch (error) {
    showNotice('error', '删除失败', error?.message || '提示词模板删除未完成')
  }
}

async function handleSaveNegativePromptTemplate(payload) {
  try {
    await saveNegativePromptTemplate(payload)
    negativePromptTemplates.value = await listNegativePromptTemplates().catch(() => negativePromptTemplates.value)
    showNotice('success', '保存成功', '反向提示词模板已更新。')
  } catch (error) {
    showNotice('error', '保存失败', error?.message || '反向提示词模板保存未完成')
  }
}

async function handleRemoveNegativePromptTemplate(templateId) {
  try {
    await removeNegativePromptTemplate({
      id: templateId
    })
    negativePromptTemplates.value = await listNegativePromptTemplates().catch(() => negativePromptTemplates.value)
    showNotice('success', '删除成功', '反向提示词模板已删除。')
  } catch (error) {
    showNotice('error', '删除失败', error?.message || '反向提示词模板删除未完成')
  }
}

onMounted(async () => {
  const [activation, , prompts, negativePrompts, snapshot] = await Promise.all([
    getActivationStatus().catch(() => null),
    initializeTextStatusState(),
    listPromptTemplates().catch(() => []),
    listNegativePromptTemplates().catch(() => []),
    getStudioSnapshot().catch(() => null)
  ])

  activationState.value = activation
  promptTemplates.value = Array.isArray(prompts) ? prompts : []
  negativePromptTemplates.value = Array.isArray(negativePrompts) ? negativePrompts : []

  if (snapshot?.hostInfo) {
    sharedHostInfo.value = normalizeHostInfo(snapshot.hostInfo)
  }

  if (snapshot?.workspaceDashboard?.creditOverview) {
    sharedCreditOverview.value = snapshot.workspaceDashboard.creditOverview
  }

  if (snapshot?.workspaceDashboard?.creditMessages) {
    sharedCreditMessages.value = snapshot.workspaceDashboard.creditMessages
  }

  if (snapshot?.workspaceDashboard?.networkMonitor) {
    sharedNetworkMonitor.value = snapshot.workspaceDashboard.networkMonitor
  }
})

onBeforeUnmount(() => {
  if (noticeTimer) {
    clearTimeout(noticeTimer)
  }
})
</script>

<template>
  <main class="app-shell" :data-theme="activeTheme">
    <AppTopBar
      brand-label="QiuAi-ECMS"
      :theme-options="themeOptions"
      :active-theme="activeTheme"
      :activation-summary="activationSummary"
      :nav-items="navItems"
      :active-nav="activePage"
      @nav-select="activePage = $event"
      @cleanup-click="handleCleanupClick"
    />

    <div v-if="notice.visible" class="app-notice-layer" role="status" aria-live="polite">
      <div class="app-notice" :class="`app-notice--${notice.type}`">
        <strong>{{ notice.title }}</strong>
        <span>{{ notice.message }}</span>
      </div>
    </div>

    <section class="ecms-shell">
      <HotProductsPage
        v-if="activePage === 'hot'"
        :platform-cards="hotPlatformCards"
        :trend-products="hotTrendProducts"
        :scouting-steps="scoutingSteps"
      />

      <EcmsStudioPage
        v-else-if="activePage === 'text'"
        title="文本工坊"
        description="严格参照生图页的布局和切换逻辑，当前聚焦标题生成与描述生成。"
        :menu-items="textMenuItems"
        :overview-cards="textOverviewCards"
        :parameter-sections="textParameterSections"
        :result-sections="textResultSections"
        :queue-cards="textQueueCards"
        :workspace-dashboard="textWorkspaceDashboard"
        :host-info="textHostInfo"
        :model-pricing-catalog="textModelPricingCatalog"
        :status-states="textStatusStates"
        :submit-states="textSubmitStates"
        :prompt-templates="promptTemplates"
        :negative-prompt-templates="negativePromptTemplates"
        default-menu="workspace"
        @send-to-draft="handleSendToDraft"
        @submit-task="handleTextSubmit"
        @save-template="handleSavePromptTemplate"
        @remove-template="handleRemovePromptTemplate"
        @save-negative-template="handleSaveNegativePromptTemplate"
        @remove-negative-template="handleRemoveNegativePromptTemplate"
      />

      <section v-else-if="activePage === 'image'" class="ecms-page ecms-page--legacy">
        <LegacyStudioApp :key="legacyStudioKey" embedded @send-to-draft="handleSendToDraft" />
      </section>

      <EcmsStudioPage
        v-else-if="activePage === 'video'"
        title="视频工坊"
        description="严格参照生图页的布局和切换逻辑，当前聚焦视频生成。"
        :menu-items="videoMenuItems"
        :overview-cards="videoOverviewCards"
        :parameter-sections="videoParameterSections"
        :result-sections="videoResultSections"
        :queue-cards="videoQueueCards"
        :workspace-dashboard="videoWorkspaceDashboard"
        :host-info="videoHostInfo"
        :model-pricing-catalog="modelPricingCatalog"
        :prompt-templates="promptTemplates"
        :negative-prompt-templates="negativePromptTemplates"
        default-menu="workspace"
        @send-to-draft="handleSendToDraft"
        @save-template="handleSavePromptTemplate"
        @remove-template="handleRemovePromptTemplate"
        @save-negative-template="handleSaveNegativePromptTemplate"
        @remove-negative-template="handleRemoveNegativePromptTemplate"
      />

      <DraftBoardPage
        v-else-if="activePage === 'draft'"
        :draft-items="draftItems"
        @update-draft-field="handleDraftFieldUpdate"
      />

      <ListingCenterPage
        v-else
        :draft-items="draftItems"
        @update-draft-field="handleDraftFieldUpdate"
      />
    </section>
  </main>
</template>
