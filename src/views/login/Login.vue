<template>
  <div class="login-split">
    <!-- ==================== 左侧：动画角色 ==================== -->
    <div class="login-left" @mousemove="onCharMouseMove">
      <!-- Logo -->
      <div class="left-brand">
        <div class="left-brand-icon">
          <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="13" fill="rgba(255,255,255,0.15)"/>
            <path d="M12 36L24 6L36 36Z" fill="white" opacity="0.9"/>
            <line x1="24" y1="14" x2="24" y2="31" stroke="rgba(255,255,255,0.3)" stroke-width="2.5" stroke-linecap="round"/>
            <circle cx="24" cy="12" r="2.5" fill="white"/>
          </svg>
        </div>
        <span class="left-brand-text">Nexus</span>
      </div>

      <!-- 角色容器 -->
      <div class="characters-stage">
        <div class="characters-wrap" ref="charWrapRef">
          <!-- Purple 角色 (后层) -->
          <div
            ref="purpleRef"
            class="char char-purple"
            :style="purpleStyle"
          >
            <div class="char-eyes" :style="purpleEyeStyle">
              <EyeBall
                :size="18" :pupil-size="7" :max-distance="5"
                eye-color="#fff" pupil-color="#2D2D2D"
                :is-blinking="isPurpleBlinking"
                :force-look-x="purpleForceLook.x"
                :force-look-y="purpleForceLook.y"
              />
              <EyeBall
                :size="18" :pupil-size="7" :max-distance="5"
                eye-color="#fff" pupil-color="#2D2D2D"
                :is-blinking="isPurpleBlinking"
                :force-look-x="purpleForceLook.x"
                :force-look-y="purpleForceLook.y"
              />
            </div>
          </div>

          <!-- Black 角色 (中层) -->
          <div
            ref="blackRef"
            class="char char-black"
            :style="blackStyle"
          >
            <div class="char-eyes" :style="blackEyeStyle">
              <EyeBall
                :size="16" :pupil-size="6" :max-distance="4"
                eye-color="#fff" pupil-color="#2D2D2D"
                :is-blinking="isBlackBlinking"
                :force-look-x="blackForceLook.x"
                :force-look-y="blackForceLook.y"
              />
              <EyeBall
                :size="16" :pupil-size="6" :max-distance="4"
                eye-color="#fff" pupil-color="#2D2D2D"
                :is-blinking="isBlackBlinking"
                :force-look-x="blackForceLook.x"
                :force-look-y="blackForceLook.y"
              />
            </div>
          </div>

          <!-- Orange 角色 (前左) -->
          <div
            ref="orangeRef"
            class="char char-orange"
            :style="orangeStyle"
          >
            <div class="char-eyes" :style="orangeEyeStyle">
              <Pupil :size="12" :max-distance="5" pupil-color="#2D2D2D"
                :force-look-x="pwdVisibleForce.x" :force-look-y="pwdVisibleForce.y" />
              <Pupil :size="12" :max-distance="5" pupil-color="#2D2D2D"
                :force-look-x="pwdVisibleForce.x" :force-look-y="pwdVisibleForce.y" />
            </div>
          </div>

          <!-- Yellow 角色 (前右) -->
          <div
            ref="yellowRef"
            class="char char-yellow"
            :style="yellowStyle"
          >
            <div class="char-eyes" :style="yellowEyeStyle">
              <Pupil :size="12" :max-distance="5" pupil-color="#2D2D2D"
                :force-look-x="pwdVisibleForce.x" :force-look-y="pwdVisibleForce.y" />
              <Pupil :size="12" :max-distance="5" pupil-color="#2D2D2D"
                :force-look-x="pwdVisibleForce.x" :force-look-y="pwdVisibleForce.y" />
            </div>
            <div class="char-mouth" :style="yellowMouthStyle"></div>
          </div>
        </div>
      </div>



      <!-- 装饰 -->
      <div class="left-deco left-deco-1"></div>
      <div class="left-deco left-deco-2"></div>
      <div class="left-grid"></div>
    </div>

    <!-- ==================== 右侧：登录表单 ==================== -->
    <div class="login-right">
      <InfiniteGridBg grid-color="#7b8ba3" />
      <div class="login-form-wrap">
        <!-- 移动端 Logo -->
        <div class="mobile-brand">
          <div class="left-brand-icon">
            <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
              <linearGradient id="mobileGrad" x1="0" y1="0" x2="48" y2="48">
                <stop stop-color="#4361ee"/><stop offset="1" stop-color="#2ec4b6"/>
              </linearGradient>
              <rect width="48" height="48" rx="13" fill="url(#mobileGrad)"/>
              <path d="M12 36L24 6L36 36Z" fill="white" opacity="0.9"/>
            </svg>
          </div>
          <span class="left-brand-text" style="color:#1a1d29;">Nexus</span>
        </div>

        <div class="form-header">
          <h1 class="form-title">欢迎回来!</h1>
          <p class="form-sub">请输入账号密码登录</p>
        </div>

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-width="0"
          size="large"
          class="login-form-el"
          @keyup.enter="handleLogin"
        >
          <el-form-item prop="username">
            <el-input
              v-model="form.username"
              placeholder="请输入用户名"
              :prefix-icon="User"
              @focus="onTyping(true)"
              @blur="onTyping(false)"
            />
          </el-form-item>

          <el-form-item prop="password">
            <div class="pwd-wrap">
              <el-input
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="请输入密码"
                :prefix-icon="Lock"
                autocomplete="current-password"
              />
              <button type="button" class="pwd-toggle" @click="showPassword = !showPassword">
                <el-icon :size="18"><component :is="showPassword ? View : Hide" /></el-icon>
              </button>
            </div>
          </el-form-item>

          <div v-if="loginError" class="form-error">{{ loginError }}</div>

          <div class="form-options">
            <el-checkbox v-model="form.remember" size="small">记住用户名</el-checkbox>
            <el-checkbox v-model="form.rememberPwd" size="small">记住密码</el-checkbox>
          </div>

          <el-button
            type="primary"
            size="large"
            :loading="loading"
            class="login-btn"
            @click="handleLogin"
          >
            <span v-if="!loading">登 录</span>
            <span v-else>登录中...</span>
          </el-button>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock, View, Hide } from '@element-plus/icons-vue'
import { useUserStore } from '@/store'
import EyeBall from './EyeBall.vue'
import Pupil from './Pupil.vue'
import InfiniteGridBg from '@/components/InfiniteGridBg.vue'

// ==================== 子组件：Pupil & EyeBall ====================
// 使用 Vue renderless 模式，直接在模板中通过内联样式实现

const router = useRouter()
const userStore = useUserStore()
const formRef = ref(null)
const loading = ref(false)
const loginError = ref('')

const form = reactive({
  username: '',
  password: '',
  remember: false,
  rememberPwd: false
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

// ==================== 角色动画状态 ====================
const showPassword = ref(false)
const isTyping = ref(false)
const isPurpleBlinking = ref(false)
const isBlackBlinking = ref(false)
const isLookingAtEachOther = ref(false)
const isPurplePeeking = ref(false)
const charMouseX = ref(0)
const charMouseY = ref(0)

const purpleRef = ref(null)
const blackRef = ref(null)
const orangeRef = ref(null)
const yellowRef = ref(null)
const charWrapRef = ref(null)

function onTyping(v) { isTyping.value = v }

function onCharMouseMove(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  charMouseX.value = e.clientX - rect.left
  charMouseY.value = e.clientY - rect.top
}

// 密码可见时的强制视线（向左下看）
const pwdVisibleForce = computed(() => {
  if (form.password && showPassword.value) return { x: -5, y: -4 }
  return { x: undefined, y: undefined }
})

// 紫色角色强制视线
const purpleForceLook = computed(() => {
  if (form.password && showPassword.value) {
    if (isPurplePeeking.value) return { x: 4, y: 5 }
    return { x: -4, y: -4 }
  }
  if (isLookingAtEachOther.value) return { x: 3, y: 4 }
  return { x: undefined, y: undefined }
})

// 黑色角色强制视线
const blackForceLook = computed(() => {
  if (form.password && showPassword.value) return { x: -4, y: -4 }
  if (isLookingAtEachOther.value) return { x: 0, y: -4 }
  return { x: undefined, y: undefined }
})

// 计算每个角色的位置偏移
function calcCharPos(refEl) {
  if (!refEl || !charWrapRef.value) return { faceX: 0, faceY: 0, bodySkew: 0 }
  const wrapRect = charWrapRef.value.getBoundingClientRect()
  const rect = refEl.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2 - wrapRect.left
  const centerY = rect.top + rect.height / 3 - wrapRect.top
  const deltaX = charMouseX.value - centerX
  const deltaY = charMouseY.value - centerY
  const faceX = Math.max(-15, Math.min(15, deltaX / 20))
  const faceY = Math.max(-10, Math.min(10, deltaY / 30))
  const bodySkew = Math.max(-6, Math.min(6, -deltaX / 120))
  return { faceX, faceY, bodySkew }
}

// 角色样式（响应式计算）
const purpleStyle = computed(() => {
  const p = calcCharPos(purpleRef.value)
  const showPwd = form.password && showPassword.value
  const peek = form.password && !showPassword.value
  let skew = p.bodySkew
  let tx = 0
  let height = '400px'
  if (showPwd) { skew = 0 }
  else if (isTyping.value || peek) { skew = (p.bodySkew || 0) - 12; tx = 40 }
  if (isTyping.value || peek) height = '440px'
  return {
    transform: `skewX(${skew}deg) translateX(${tx}px)`,
    height,
    transformOrigin: 'bottom center'
  }
})

const purpleEyeStyle = computed(() => {
  const p = calcCharPos(purpleRef.value)
  const showPwd = form.password && showPassword.value
  let left, top
  if (showPwd) { left = '20px'; top = '35px' }
  else if (isLookingAtEachOther.value) { left = '55px'; top = '65px' }
  else { left = `${45 + p.faceX}px`; top = `${40 + p.faceY}px` }
  return { left, top }
})

const blackStyle = computed(() => {
  const p = calcCharPos(blackRef.value)
  const showPwd = form.password && showPassword.value
  const peek = form.password && !showPassword.value
  let skew = p.bodySkew
  let tx = 0
  if (showPwd) { skew = 0 }
  else if (isLookingAtEachOther.value) { skew = p.bodySkew * 1.5 + 10; tx = 20 }
  else if (isTyping.value || peek) { skew = p.bodySkew * 1.5 }
  else { skew = p.bodySkew }
  return {
    transform: `skewX(${skew}deg) translateX(${tx}px)`,
    transformOrigin: 'bottom center'
  }
})

const blackEyeStyle = computed(() => {
  const p = calcCharPos(blackRef.value)
  const showPwd = form.password && showPassword.value
  let left, top
  if (showPwd) { left = '10px'; top = '28px' }
  else if (isLookingAtEachOther.value) { left = '32px'; top = '12px' }
  else { left = `${26 + p.faceX}px`; top = `${32 + p.faceY}px` }
  return { left, top }
})

const orangeStyle = computed(() => {
  const p = calcCharPos(orangeRef.value)
  const showPwd = form.password && showPassword.value
  return {
    transform: `skewX(${showPwd ? 0 : p.bodySkew}deg)`,
    transformOrigin: 'bottom center'
  }
})

const orangeEyeStyle = computed(() => {
  const p = calcCharPos(orangeRef.value)
  const showPwd = form.password && showPassword.value
  let left, top
  if (showPwd) { left = '50px'; top = '85px' }
  else { left = `${82 + p.faceX}px`; top = `${90 + p.faceY}px` }
  return { left, top }
})

const yellowStyle = computed(() => {
  const p = calcCharPos(yellowRef.value)
  const showPwd = form.password && showPassword.value
  return {
    transform: `skewX(${showPwd ? 0 : p.bodySkew}deg)`,
    transformOrigin: 'bottom center'
  }
})

const yellowEyeStyle = computed(() => {
  const p = calcCharPos(yellowRef.value)
  const showPwd = form.password && showPassword.value
  let left, top
  if (showPwd) { left = '20px'; top = '35px' }
  else { left = `${52 + p.faceX}px`; top = `${40 + p.faceY}px` }
  return { left, top }
})

const yellowMouthStyle = computed(() => {
  const p = calcCharPos(yellowRef.value)
  const showPwd = form.password && showPassword.value
  let left, top
  if (showPwd) { left = '10px'; top = '88px' }
  else { left = `${40 + p.faceX}px`; top = `${88 + p.faceY}px` }
  return { left, top }
})

// 紫色角色随机眨眼
let purpleBlinkTimer = null
function schedulePurpleBlink() {
  const delay = Math.random() * 4000 + 3000
  purpleBlinkTimer = setTimeout(() => {
    isPurpleBlinking.value = true
    setTimeout(() => {
      isPurpleBlinking.value = false
      schedulePurpleBlink()
    }, 150)
  }, delay)
}

// 黑色角色随机眨眼
let blackBlinkTimer = null
function scheduleBlackBlink() {
  const delay = Math.random() * 4000 + 3000
  blackBlinkTimer = setTimeout(() => {
    isBlackBlinking.value = true
    setTimeout(() => {
      isBlackBlinking.value = false
      scheduleBlackBlink()
    }, 150)
  }, delay)
}

// 输入时互相对视
let lookTimer = null
watch(isTyping, (v) => {
  if (v) {
    isLookingAtEachOther.value = true
    clearTimeout(lookTimer)
    lookTimer = setTimeout(() => { isLookingAtEachOther.value = false }, 800)
  } else {
    isLookingAtEachOther.value = false
  }
})

// 密码可见时紫色窥视
let peekTimer = null
function schedulePeek() {
  const delay = Math.random() * 3000 + 2000
  peekTimer = setTimeout(() => {
    if (form.password && showPassword.value) {
      isPurplePeeking.value = true
      setTimeout(() => {
        isPurplePeeking.value = false
        if (form.password && showPassword.value) schedulePeek()
      }, 800)
    }
  }, delay)
}
watch([() => form.password, showPassword], ([pwd, show]) => {
  if (pwd && show) {
    isPurplePeeking.value = false
    schedulePeek()
  } else {
    clearTimeout(peekTimer)
    isPurplePeeking.value = false
  }
})

// ==================== 登录逻辑 ====================
function handleGlobalKeydown(e) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    handleLogin()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
  schedulePurpleBlink()
  scheduleBlackBlink()
  setTimeout(() => {
    const input = document.querySelector('.login-form-el input')
    if (input) input.focus()
  }, 600)
  const saved = localStorage.getItem('d_design_remember_user')
  if (saved) {
    form.username = saved
    form.remember = true
  }
  const savedPwd = localStorage.getItem('d_design_remember_pwd')
  if (savedPwd) {
    form.password = savedPwd
    form.rememberPwd = true
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  clearTimeout(purpleBlinkTimer)
  clearTimeout(blackBlinkTimer)
  clearTimeout(lookTimer)
  clearTimeout(peekTimer)
})

async function handleLogin() {
  loginError.value = ''
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    const res = await userStore.login({
      username: form.username,
      password: form.password
    })

    if (res.code === 0) {
      ElMessage.success('登录成功')
      if (form.remember) {
        localStorage.setItem('d_design_remember_user', form.username)
      } else {
        localStorage.removeItem('d_design_remember_user')
      }
      if (form.rememberPwd) {
        localStorage.setItem('d_design_remember_pwd', form.password)
      } else {
        localStorage.removeItem('d_design_remember_pwd')
      }

      const role = res.data.user.role
      if (role === 'admin' || role === 'sub_admin') {
        router.push('/dashboard')
      } else if (role === 'operator') {
        router.push('/operator/publish')
      } else if (role === 'cs_agent') {
        router.push('/cs/publish')
      } else if (role === 'designer') {
        router.push('/designer/hall')
      } else if (role === 'basic_designer') {
        router.push('/basic/hall')
      } else if (role === 'operator_assistant') {
        router.push('/operator-assistant/hall')
      }
    } else {
      loginError.value = res.msg || '登录失败'
      ElMessage.error(res.msg)
    }
  } catch (err) {
    console.error('[Login]', err)
    loginError.value = '网络异常，请检查连接'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
/* ==================== Pupil & EyeBall 内联样式 ==================== */
/* 这两个"组件"直接在模板中通过 style binding 渲染 */

/* ==================== 布局 ==================== */
.login-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 100vh;
}

/* ==================== 左侧：角色区 ==================== */
.login-left {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: linear-gradient(135deg, #4361ee 0%, #3451d1 40%, #2a3fb8 100%);
  padding: 48px;
  overflow: hidden;
  color: #fff;
}

.left-brand {
  position: relative;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
}

.left-brand-icon {
  width: 32px;
  height: 32px;
}

.left-brand-text {
  letter-spacing: 2px;
}

/* 角色舞台 */
.characters-stage {
  position: relative;
  z-index: 20;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  flex: 1;
  min-height: 420px;
}

.characters-wrap {
  position: relative;
  width: 550px;
  height: 400px;
}

/* 基础角色样式 */
.char {
  position: absolute;
  bottom: 0;
  transition: all 0.7s ease-in-out;
}

.char-eyes {
  position: absolute;
  display: flex;
  gap: 32px;
  transition: all 0.7s ease-in-out;
}

/* Purple - 后层，最高 */
.char-purple {
  left: 70px;
  width: 180px;
  height: 400px;
  background: #6C3FF5;
  border-radius: 10px 10px 0 0;
  z-index: 1;
}

/* Black - 中层 */
.char-black {
  left: 240px;
  width: 120px;
  height: 310px;
  background: #2D2D2D;
  border-radius: 8px 8px 0 0;
  z-index: 2;
}

/* Orange - 前左，半圆 */
.char-orange {
  left: 0px;
  width: 240px;
  height: 200px;
  background: #FF9B6B;
  border-radius: 120px 120px 0 0;
  z-index: 3;
}

/* Yellow - 前右，圆顶 */
.char-yellow {
  left: 310px;
  width: 140px;
  height: 230px;
  background: #E8D754;
  border-radius: 70px 70px 0 0;
  z-index: 4;
}

.char-mouth {
  position: absolute;
  width: 80px;
  height: 4px;
  background: #2D2D2D;
  border-radius: 2px;
  transition: all 0.2s ease-out;
}

/* 底部链接 */
.left-links {
  position: relative;
  z-index: 20;
  display: flex;
  gap: 32px;
}

.left-link {
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  text-decoration: none;
  transition: color 0.2s;
}

.left-link:hover {
  color: #fff;
}

/* 装饰元素 */
.left-deco {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  pointer-events: none;
}

.left-deco-1 {
  width: 256px;
  height: 256px;
  background: rgba(255, 255, 255, 0.1);
  top: 25%;
  right: 25%;
}

.left-deco-2 {
  width: 384px;
  height: 384px;
  background: rgba(255, 255, 255, 0.05);
  bottom: 25%;
  left: 25%;
}

.left-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 20px 20px;
  pointer-events: none;
}

/* ==================== 右侧：表单区 ==================== */
.login-right {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  background: #f8f9fb;
  position: relative;
}

.login-form-wrap {
  width: 100%;
  max-width: 420px;
  position: relative;
  z-index: 1;
}

.mobile-brand {
  display: none;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 48px;
}

.form-header {
  text-align: center;
  margin-bottom: 40px;
}

.form-title {
  font-size: 30px;
  font-weight: 800;
  margin: 0 0 6px;
  color: #1a1d29;
}

.form-sub {
  margin: 0;
  font-size: 14px;
  color: #909399;
}

/* Element Plus 表单微调 */
.login-form-el :deep(.el-input__wrapper) {
  height: 48px;
  border-radius: 10px;
  background: #fff;
  box-shadow: none !important;
  border: 1.5px solid #e8eaee;
  transition: all 0.25s ease;
}

.login-form-el :deep(.el-input__wrapper:hover) {
  border-color: #6c83f5;
}

.login-form-el :deep(.el-input__wrapper.is-focus) {
  border-color: #4361ee;
  box-shadow: 0 0 0 4px rgba(67, 97, 238, 0.1) !important;
}

.login-form-el :deep(.el-input__prefix-inner) {
  color: #9ca3af;
}

.login-form-el :deep(.el-input__wrapper.is-focus .el-input__prefix-inner) {
  color: #4361ee;
}

.pwd-wrap {
  position: relative;
}

.pwd-toggle {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: #9ca3af;
  padding: 4px;
  display: flex;
  align-items: center;
  z-index: 2;
  transition: color 0.2s;
}

.pwd-toggle:hover {
  color: #4361ee;
}

.form-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  font-size: 13px;
  padding: 8px 12px;
  border-radius: 8px;
  margin: 4px 0 12px;
  text-align: center;
}

.form-options {
  display: flex;
  justify-content: flex-end;
  margin: 4px 0 12px;
}

.login-btn {
  width: 100%;
  margin-top: 8px;
  font-size: 16px;
  height: 48px;
  border-radius: 10px;
  font-weight: 600;
  letter-spacing: 4px;
  background: linear-gradient(135deg, #4361ee, #3451d1);
  border: none;
  box-shadow: 0 4px 16px rgba(67, 97, 238, 0.3);
  transition: all 0.25s ease;
}

.login-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(67, 97, 238, 0.4);
}

.login-btn:active {
  transform: translateY(0);
}

/* ==================== 响应式 ==================== */
@media (max-width: 1024px) {
  .login-split {
    grid-template-columns: 1fr;
  }
  .login-left {
    display: none;
  }
  .mobile-brand {
    display: flex;
  }
}
</style>
