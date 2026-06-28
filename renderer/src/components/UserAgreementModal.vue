<script setup>
import { computed, nextTick, ref, watch } from 'vue'

const REQUIRED_SECONDS = 10

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  agreementState: {
    type: Object,
    default: () => ({})
  },
  isSubmitting: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['accept'])

const contentRef = ref(null)
const agreed = ref(false)
const countdown = ref(REQUIRED_SECONDS)
const hasScrolledToBottom = ref(false)
let countdownTimer = null

const agreementTitle = computed(() => {
  return props.agreementState?.title || '用户须知与使用协议暨责任认定书'
})

const canConfirm = computed(() => {
  return countdown.value <= 0 && hasScrolledToBottom.value && agreed.value && !props.isSubmitting
})

function stopCountdown() {
  if (countdownTimer) {
    window.clearInterval(countdownTimer)
    countdownTimer = null
  }
}

function resetState() {
  agreed.value = false
  countdown.value = REQUIRED_SECONDS
  hasScrolledToBottom.value = false
}

function startCountdown() {
  stopCountdown()
  countdownTimer = window.setInterval(() => {
    if (countdown.value <= 1) {
      countdown.value = 0
      stopCountdown()
      return
    }

    countdown.value -= 1
  }, 1000)
}

function checkScrolledToBottom() {
  const element = contentRef.value
  if (!element) {
    return
  }

  const remaining = element.scrollHeight - element.scrollTop - element.clientHeight
  if (remaining <= 8) {
    hasScrolledToBottom.value = true
  }
}

function handleConfirm() {
  if (!canConfirm.value) {
    return
  }

  emit('accept')
}

watch(
  () => props.visible,
  async (visible) => {
    stopCountdown()
    resetState()

    if (!visible) {
      return
    }

    await nextTick()
    if (contentRef.value) {
      contentRef.value.scrollTop = 0
    }
    checkScrolledToBottom()
    startCountdown()
  },
  { immediate: true }
)
</script>

<template>
  <div v-if="visible" class="user-agreement-modal" role="dialog" aria-modal="true" :aria-label="agreementTitle">
    <div class="user-agreement-modal__card">
      <header class="user-agreement-modal__header">
        <div class="user-agreement-modal__title-block">
          <span class="user-agreement-modal__eyebrow">Compliance</span>
          <strong>{{ agreementTitle }}</strong>
          <p>激活成功后，需完整阅读并同意本责任认定文件，方可继续使用 QiuAi。</p>
        </div>
        <div class="user-agreement-modal__status">
          <span>停留倒计时 {{ countdown }} 秒</span>
          <span>{{ hasScrolledToBottom ? '已滚动到底部' : '请滚动到最下方' }}</span>
        </div>
      </header>

      <div ref="contentRef" class="user-agreement-modal__content" @scroll="checkScrolledToBottom">
        <section>
          <h3>一、文件性质与适用范围</h3>
          <p>本《用户须知与使用协议暨责任认定书》既是你使用 QiuAi 全部功能的使用协议，也是平台在实际经营、合规、风控、争议处理、追责留证场景下用于明确责任边界的正式责任认定文件。其适用于你使用 QiuAi 客户端、配套授权平台、授权购买服务、算力包购买服务、算力直充服务、标题生成、描述生成、图片生成、视频生成、项目管理、模板调用、导出下载、发布辅助及与之相关的全部软件功能、网络接口、数据处理能力和运维支持能力的所有行为。</p>
          <p>你一旦点击“同意并继续使用”，或在系统提示阅读并签署后继续实际使用本软件，即视为你已经完整阅读、充分理解并同意受本文件全部条款约束。你明确知悉：本文件不仅用于说明软件使用方式，更用于确认你对自身上传、生成、导出、发布、经营及衍生行为承担独立、完整、不可向平台转嫁的法律责任。</p>
          <p>如你不同意本文件任一条款，或不同意平台后续依法依规对本文件进行的更新内容，你应立即停止激活、停止登录、停止购买、停止使用相关服务。继续使用即视为你再次确认并接受平台对责任边界的认定。</p>
        </section>

        <section>
          <h3>二、授权与使用边界</h3>
          <p>本软件采用“账号识别 + 授权校验 + 设备绑定 + 在线会话控制”的综合管理模式。具体授权以平台服务端记录为准。授权对象为已获得合法授权资格并已绑定至当前账号体系下的具体设备，不以你本地缓存、前端显示或单次页面状态作为最终依据。</p>
          <p>未经平台书面许可，你不得以任何方式实施或协助实施下列行为：破解、反编译、反汇编、逆向工程、修改客户端校验逻辑、篡改授权状态、伪造设备码、共享会话、绕过并发限制、盗刷算力、出租账号、转售授权、批量对外转供、恶意压测、利用漏洞套取额度、植入自动化攻击脚本、规避风控、规避支付验证、抓取受保护接口数据等。</p>
          <p>你理解并同意，平台有权根据订单状态、设备绑定状态、在线会话状态、风险分、账号行为、投诉情况、异常调用频次、支付异常、涉嫌违规线索等因素，单方决定是否允许你继续使用软件、是否限制相关功能、是否强制下线、是否暂停或终止服务。</p>
        </section>

        <section>
          <h3>三、用户信息与实名责任</h3>
          <p>你提交的用户名、手机号、邀请码、订单信息、设备信息、设备码、支付信息、导出记录、操作日志等，必须真实、合法、可归属、可核验。你不得冒用、盗用、借用、购买他人身份信息或联系方式进行注册、购买、激活、充值、申请售后、发起争议处理。</p>
          <p>因你提交虚假身份信息、冒名信息、伪造信息、错误联系方式、第三方联系方式、他人手机号、未经授权的邀请码、伪造设备身份等而引发的一切后果，包括但不限于激活失败、售后失败、支付争议、退款争议、投诉举报、民事纠纷、行政责任、刑事责任，均由你自行承担。</p>
        </section>

        <section>
          <h3>四、数据来源与内容合法性责任</h3>
          <p>你上传、录入、采集、整理、导入、编辑、生成、导出、传播、展示、出售、发布的商品资料、图片、视频、文案、品牌元素、标识、店铺信息、链接、脚本、源数据、原图素材、参考样例、模型参数及其他数据，均应具有合法来源、合法处理依据和合法使用授权。你必须确保相关数据不侵犯任何第三方的著作权、邻接权、商标权、专利权、肖像权、姓名权、名誉权、隐私权、商业秘密、数据权益、个人信息权益或其他合法权益。</p>
          <p>如果你处理的是来源于第三方平台、第三方商家、第三方服务商、第三方模特、第三方摄影机构或第三方版权方的数据和内容，你应当自行确认使用范围、授权期限、商业用途限制、地域限制、平台规则限制及是否允许 AI 加工处理。你不得将未经授权的素材通过本系统进行改写、扩写、二次生成、批量导出或对外发布。</p>
          <p>对于你通过本系统处理的全部数据与内容，其真实性、准确性、完整性、合法性、权属清晰性、适销性、可发布性、可审核通过性以及与目标平台规则的一致性，均由你独立判断并承担全部责任。平台不对你数据的来源、权利状态、真实性或可商业化程度进行事前审查或实质担保。</p>
        </section>

        <section>
          <h3>五、网络安全、数据安全与个人信息合规</h3>
          <p>你承诺在使用本系统过程中，严格遵守《中华人民共和国网络安全法》《中华人民共和国数据安全法》《中华人民共和国个人信息保护法》以及其他现行有效的法律法规、行政法规、部门规章、规范性文件、国家标准、行业标准、自律规则和第三方平台规则。</p>
          <p>你不得利用本系统从事任何危害网络安全、数据安全、个人信息安全、商业安全、平台安全、交易安全、社会公共利益或国家安全的行为。包括但不限于：非法侵入网络系统、探测漏洞、攻击接口、批量撞库、伪造身份、伪造流量、植入恶意代码、爬取受限资源、抓取含个人信息数据、非法处理或跨境传输个人信息、传播违法有害信息、规避平台规则、规避风控、虚假营销、诈骗、洗钱、制作或传播违禁商品信息、涉黄涉赌涉毒、侵害未成年人权益、扰乱市场秩序等。</p>
          <p>如你在本系统中处理任何包含个人信息、经营数据、客户数据、订单数据、店铺数据、联系方式、图像、生物识别信息或其他敏感数据的内容，你应自行取得合法授权并自行承担告知、同意、最小必要、保存期限、访问控制、数据删除等法定义务。平台不替代你履行这些合规义务。</p>
        </section>

        <section>
          <h3>六、人工智能生成内容特别条款</h3>
          <p>你理解并同意，本系统提供的标题生成、描述生成、图片生成、视频生成、项目模板调用、发布辅助等能力，本质上均属于技术工具和内容处理工具，相关输出仅为机器生成结果或机器辅助结果，不构成事实陈述保证、广告法保证、知识产权保证、平台审核保证、商业可用性保证、效果保证或法律意见。</p>
          <p>你承诺在使用相关能力时，严格遵守《生成式人工智能服务管理暂行办法》以及与人工智能生成内容相关的现行法律法规、监管要求和第三方平台规则，确保输入内容、提示词、约束条件、参考素材、输出结果和最终发布行为均不含违法违规、虚假误导、侵权、歧视、低俗、暴力、色情、恐怖、违背公序良俗、危害国家安全或其他不当信息。</p>
          <p>你应对 AI 生成内容进行人工复核。包括但不限于：核查是否存在虚构参数、夸大功效、侵权文案、平台禁用词、违规宣传、虚假承诺、错误适用场景、错误规格、错误品牌归属、错误版权归属、人物形象侵权、素材拼接侵权、视频内容误导等风险。你不得以“内容由 AI 自动生成”为由主张免责或减轻责任。</p>
          <p>若你利用本系统生成的内容对外展示、营销、售卖、投放广告、创建商品链接、上传第三方平台或交付第三方客户，由此引发的任何审核失败、侵权投诉、平台处罚、消费者索赔、行政执法、民事诉讼或刑事风险，均由你自行承担。</p>
        </section>

        <section>
          <h3>七、责任划分、责任认定与平台免责</h3>
          <p>你因使用本系统实施的任何违法违规行为、侵权行为、违约行为、虚假宣传行为、不正当竞争行为、违规经营行为、平台规则违反行为、行政处罚事项、平台处罚事项、商品纠纷、售后纠纷、投诉举报、索赔追偿、司法争议、刑事风险，均由你自行承担全部责任。平台在本文件中已明确告知并完成责任提示，你不得在事后以“系统未提醒”“协议不明确”“生成结果由 AI 提供”“平台应共同负责”等理由要求平台分担责任。</p>
          <p>在法律允许的最大范围内，平台运营方、软件开发方、授权方、技术服务方仅按“现状”和“当前可用”状态提供软件及服务，不对服务不中断、零故障、零误差、绝对安全、绝对稳定、绝对兼容、绝对合规、绝对可审通过、绝对可盈利作任何明示或默示保证。</p>
          <p>平台运营方、软件开发方、授权方、技术服务方不对你上传的数据、生成的内容、编辑后的内容、导出的内容、发布的内容、转售的内容承担实质审查责任，也不对你内容的合法性、合规性、真实性、可交易性、可上架性、可传播性或商业结果承担保证责任。你确认，平台不因提供了生成工具、模板、推荐词、默认参数、演示结果、流程引导、支付能力、授权能力而当然成为你经营行为的共同主体、共同发布者、共同销售者或共同侵权人。</p>
          <p>若因你的行为导致任何第三方索赔、律师函、投诉、仲裁、诉讼、行政调查、平台追责、罚款、封店、封号、商誉损失、带宽损失、服务中断损失、取证支出、律师费、公证费、保全费、执行费、差旅费及其他损失，你应独立承担，并应赔偿因此给平台运营方、软件开发方、授权方、技术服务方造成的全部损失。</p>
        </section>

        <section>
          <h3>八、系统风控与配合义务</h3>
          <p>如平台基于系统监控、日志分析、支付信息、设备信息、在线状态、接口访问行为、任务行为、内容特征、投诉记录、异常工单、代理渠道反馈或监管要求，判断你的使用行为存在异常、违规、高风险或可能危及平台运行安全，平台有权无需事先通知即采取必要措施，包括但不限于限制功能、禁止导出、冻结会话、强制下线、解绑设备、暂停授权、终止服务、拒绝继续提供技术支持、保留相关日志、配合监管部门提供必要材料等。</p>
          <p>你应当按照平台要求及时配合提供身份说明、订单说明、内容来源说明、素材权属证明、个人信息授权文件、ICP备案授权文件、平台处罚通知、异议说明或其他证明材料。你拒绝配合、拖延配合、虚假配合、消极配合所造成的一切后果，由你自行承担。</p>
        </section>

        <section>
          <h3>九、支付、订单与服务中断</h3>
          <p>授权购买、算力包购买、算力直充等交易，以服务端订单记录、支付通道返回状态、支付回调、后台确认结果和实际到账结果为准。客户端页面展示、浏览器跳转状态、本地缓存状态、短时间轮询状态仅作展示参考，不构成最终交付依据。</p>
          <p>因支付宝、网络线路、服务器、操作系统、浏览器环境、第三方接口、支付风控、账号风控、平台规则变更、外部故障、不可抗力等原因导致的延迟、失败、回调不及时、订单暂挂、页面不可达、状态短时不同步、激活延迟、算力到账延迟，不视为平台违约。平台将在合理范围内协助排查，但不对超出平台控制能力的外部故障承担责任。</p>
        </section>

        <section>
          <h3>十、日志留存、证据使用、责任追溯与争议处理</h3>
          <p>你同意平台在合规、风控、安全、售后、争议处理、司法协助、监管协助范围内，记录并保存与你使用本系统相关的必要日志、操作轨迹、设备信息、在线状态、接口调用、订单状态、协议签署记录、异常记录及其他必要审计信息。上述记录可作为风险识别、争议处理、责任追溯、合规审查和权利主张的证据材料。</p>
          <p>如发生争议，双方应先行协商处理；协商不成的，按照适用法律提交有管辖权的人民法院或依法约定的争议解决机构处理。除非法律另有强制性规定，本协议的解释、效力、履行及争议解决均适用中华人民共和国法律。</p>
        </section>

        <section>
          <h3>十一、文件更新、重新签署与持续生效</h3>
          <p>平台有权基于法律变化、监管要求、产品能力调整、商业模式变化、支付链路调整、风控策略升级、外部平台规则更新等情况，对本协议进行修改、补充、删除或重述，并以新版协议替代旧版协议。新版本生效后，平台可要求你重新阅读并签署；你继续使用本系统的行为，即视为你接受届时有效的最新版协议。</p>
          <p>你确认：本文件重点在于明确你的独立经营责任、内容合规责任、数据合规责任、支付与授权边界责任，以及平台在法律允许范围内的责任边界。你不得以未仔细阅读、未完全理解、内容较长、文件复杂、点击过快、未看完、由 AI 辅助生成内容、页面曾缓存旧状态或他人代为操作等理由，对你自身的违法违规或侵权行为主张免责、减责或将责任转嫁给平台。</p>
        </section>
      </div>

      <label class="user-agreement-modal__check" :class="{ 'user-agreement-modal__check--disabled': countdown > 0 || !hasScrolledToBottom }">
        <input v-model="agreed" type="checkbox" :disabled="countdown > 0 || !hasScrolledToBottom">
        <span>我已完整阅读并明确同意上述《用户须知与使用协议暨责任认定书》，并确认因我使用软件所产生的内容、经营、发布、侵权、违规、处罚及纠纷责任均由我自行承担。</span>
      </label>

      <footer class="user-agreement-modal__footer">
        <button type="button" class="primary-action" :disabled="!canConfirm" @click="handleConfirm">
          {{ isSubmitting ? '提交中...' : '同意并继续使用' }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.user-agreement-modal {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(5, 10, 18, 0.78);
  backdrop-filter: blur(16px);
}

.user-agreement-modal__card {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto auto;
  gap: 18px;
  width: min(920px, 100%);
  height: min(860px, calc(100vh - 48px));
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  background: rgba(11, 16, 27, 0.98);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
  overflow: hidden;
}

.user-agreement-modal__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.user-agreement-modal__title-block {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.user-agreement-modal__header strong {
  font-size: 26px;
}

.user-agreement-modal__eyebrow {
  color: rgba(118, 173, 255, 0.88);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.user-agreement-modal__status {
  display: grid;
  gap: 8px;
  min-width: 180px;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(220, 228, 246, 0.82);
  font-size: 13px;
}

.user-agreement-modal__header p,
.user-agreement-modal__content p,
.user-agreement-modal__check span {
  color: rgba(205, 214, 238, 0.78);
  overflow-wrap: anywhere;
  word-break: break-word;
}

.user-agreement-modal__content {
  display: grid;
  gap: 16px;
  min-height: 0;
  min-width: 0;
  overflow-y: auto;
  padding-right: 8px;
  line-height: 1.7;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.user-agreement-modal__content section {
  display: grid;
  gap: 8px;
}

.user-agreement-modal__content h3 {
  font-size: 15px;
}

.user-agreement-modal__check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}

.user-agreement-modal__check--disabled {
  opacity: 0.72;
}

.user-agreement-modal__check input {
  margin-top: 3px;
}

.user-agreement-modal__footer {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 760px) {
  .user-agreement-modal {
    padding: 16px;
  }

  .user-agreement-modal__card {
    padding: 18px;
    height: calc(100vh - 32px);
  }

  .user-agreement-modal__header {
    flex-direction: column;
  }

  .user-agreement-modal__status {
    min-width: 0;
  }
}
</style>
