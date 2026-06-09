<template>
  <el-container class="layout-container">
    <!-- 全局公告气泡 -->
    <AnnouncementBanner />

    <!-- 连接状态条 -->
    <div v-if="!isConnected" class="reconnect-bar">
      <el-icon class="reconnect-icon"><WarningFilled /></el-icon>
      服务端连接断开，正在重连...
    </div>
    <!-- ===== 侧边栏 ===== -->
    <el-aside
      :width="sidebarWidth"
      class="layout-aside"
      :class="{ 'is-collapsed': effectiveCollapse }"
      @mouseenter="onSidebarEnter"
      @mouseleave="onSidebarLeave"
    >
      <!-- 顶部品牌区 -->
      <div class="sidebar-top">
        <div class="sidebar-brand">
          <div class="brand-avatar">
            <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="url(#logoGrad2)"/>
              <path d="M14 4L22 14L14 24L6 14Z" fill="white" opacity="0.9"/>
              <defs>
                <linearGradient id="logoGrad2" x1="0" y1="0" x2="28" y2="28">
                  <stop stop-color="#4361ee"/>
                  <stop offset="1" stop-color="#2ec4b6"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div class="brand-name">
            <span class="brand-title">Nexus</span>
            <span class="brand-sub"></span>
          </div>
        </div>
      </div>

      <SidebarMenu :active-path="activeMenu" :is-collapsed="effectiveCollapse" @navigate="nav => router.push(nav)" />

      <!-- 底部区 -->
      <div class="sidebar-bottom">
        <div
          class="nav-item collapse-toggle"
          :title="isCollapse ? '展开侧边栏' : '折叠侧边栏'"
          @click="toggleSidebar"
        >
          <el-icon :size="18">
            <Fold v-if="!isCollapse" />
            <Expand v-else />
          </el-icon>
          <span class="nav-text">{{ isCollapse ? '展开菜单' : '折叠菜单' }}</span>
        </div>
        <div class="sidebar-version">
          <span class="version-text">v15.2.2</span>
          <span class="version-dot">·</span>
          <span class="version-text">企业版</span>
        </div>
      </div>
    </el-aside>

    <!-- ===== 主内容区 ===== -->
    <el-container>
      <!-- 顶部栏 -->
      <el-header class="layout-header">
        <div class="header-left">
          <el-icon
            :size="26"
            class="collapse-btn"
            @click="toggleSidebar"
          >
            <Fold v-if="!isCollapse" />
            <Expand v-else />
          </el-icon>
          <el-breadcrumb separator="/" class="custom-breadcrumb">
            <el-breadcrumb-item :to="homeRoute">
              <el-icon :size="14" style="vertical-align:-2px;"><HomeFilled /></el-icon>
              <span style="margin-left:4px;">首页</span>
            </el-breadcrumb-item>
            <el-breadcrumb-item v-if="route.meta.title">
              {{ route.meta.title }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <div class="header-right">
          <!-- 实时时钟 -->
          <span class="header-clock">{{ currentTime }}</span>

          <QuickActions />

          <GlobalTaskSearch />

          <!-- 通知 -->
          <el-popover
            placement="bottom-end"
            :width="360"
            trigger="click"
            v-model:visible="notifyPopoverVisible"
            @show="loadNotifications"
            popper-class="notify-popper"
          >
            <template #reference>
              <el-badge :value="unreadCount" :hidden="unreadCount === 0" class="notify-badge" :max="99">
                <el-icon :size="34" class="header-icon-btn" :class="{ 'notify-pulse': hasNewNotify }">
                  <Bell />
                </el-icon>
              </el-badge>
            </template>

            <!-- 通知面板 -->
            <div class="notify-panel">
              <div class="notify-header">
                <span class="notify-title">消息通知</span>
                <div class="notify-actions">
                  <el-button v-if="unreadCount > 0" type="primary" link size="small" @click="markAllRead">
                    全部已读
                  </el-button>
                  <el-button type="danger" link size="small" @click="clearAllNotifications">
                    清空
                  </el-button>
                </div>
              </div>

              <div class="notify-list" v-loading="notifyLoading">
                <div v-if="notifications.length === 0 && !notifyLoading" class="notify-empty">
                  <el-icon :size="32" color="#9ca3af"><Bell /></el-icon>
                  <p>暂无新通知</p>
                </div>
                <div
                  v-for="item in notifications"
                  :key="item.id"
                  class="notify-item"
                  :class="{ 'notify-unread': !item.is_read }"
                  @click="handleNotifyClick(item)"
                >
                  <div class="notify-dot" v-if="!item.is_read"></div>
                  <div class="notify-content">
                    <div class="notify-item-title">{{ item.title }}</div>
                    <div class="notify-item-desc">{{ item.content }}</div>
                    <div class="notify-item-time">{{ item.create_time }}</div>
                  </div>
                </div>
              </div>
            </div>
          </el-popover>

          <!-- 主题切换 - 幕布效果 -->
          <el-tooltip :content="isDark ? '切换到亮色模式' : '切换到暗色模式'" placement="bottom">
            <div
              class="theme-toggle-btn"
              :class="{ 'is-hovered': themeBtnHovered, 'is-pressed': themeBtnPressed }"
              @click="toggleTheme"
              @mouseenter="themeBtnHovered = true"
              @mouseleave="themeBtnHovered = false; themeBtnPressed = false"
              @mousedown="themeBtnPressed = true"
              @mouseup="themeBtnPressed = false"
            >
              <el-icon :size="16">
                <Moon v-if="!isDark" />
                <Sunny v-else />
              </el-icon>
            </div>
          </el-tooltip>

          <div class="header-divider"></div>

          <!-- 角色标签 -->
          <el-tag
            :type="roleTagType"
            size="small"
            effect="dark"
            class="role-tag"
          >
            {{ roleLabel }}
          </el-tag>

          <!-- 用户下拉 -->
          <el-dropdown trigger="click" @command="handleCommand">
            <span class="user-dropdown">
              <el-avatar
                :size="34"
                class="user-avatar"
                :style="{ backgroundColor: avatarColor }"
              >
                {{ userStore.realName?.charAt(0) || userStore.username?.charAt(0) }}
              </el-avatar>
              <span class="user-name">{{ userStore.realName || userStore.username }}</span>
              <el-icon class="user-arrow"><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <div class="dropdown-user-header">
                  <el-avatar :size="40" :style="{ backgroundColor: avatarColor }" class="dropdown-avatar">
                    {{ userStore.realName?.charAt(0) || userStore.username?.charAt(0) }}
                  </el-avatar>
                  <div class="dropdown-user-info">
                    <div class="dropdown-user-name">{{ userStore.realName || userStore.username }}</div>
                    <div class="dropdown-user-role">{{ roleLabel }}</div>
                  </div>
                </div>
                <el-dropdown-item divided command="profile">
                  <el-icon><User /></el-icon>个人信息
                </el-dropdown-item>
                <el-dropdown-item command="password">
                  <el-icon><Edit /></el-icon>修改密码
                </el-dropdown-item>
                <el-dropdown-item divided command="logout">
                  <el-icon><SwitchButton /></el-icon>退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <!-- 内容区域 -->
      <el-main class="layout-main">
        <InfiniteGridBg grid-color="#7b8ba3" />
        <div class="main-content-wrap">
          <router-view />
        </div>
      </el-main>
    </el-container>
  </el-container>

  <!-- 修改密码对话框 -->
  <el-dialog v-model="pwdDialogVisible" title="修改密码" width="440px" :close-on-click-modal="false" top="12vh">
    <el-form :model="pwdForm" :rules="pwdRules" ref="pwdFormRef" label-width="90px" size="default">
      <el-form-item label="旧密码" prop="oldPassword">
        <el-input v-model="pwdForm.oldPassword" type="password" show-password placeholder="请输入当前密码" />
      </el-form-item>
      <el-form-item label="新密码" prop="newPassword">
        <el-input v-model="pwdForm.newPassword" type="password" show-password placeholder="至少6位新密码" />
      </el-form-item>
      <el-form-item label="确认密码" prop="confirmPassword">
        <el-input v-model="pwdForm.confirmPassword" type="password" show-password placeholder="再次输入新密码" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="pwdDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="changePassword" :loading="pwdLoading">确认修改</el-button>
    </template>
  </el-dialog>

  <!-- 个人信息对话框 -->
  <el-dialog v-model="profileVisible" title="个人信息" width="400px" :close-on-click-modal="false" top="15vh">
    <div class="profile-content">
      <div class="profile-avatar-section">
        <el-avatar :size="64" :style="{ backgroundColor: avatarColor }" class="profile-avatar">
          {{ userStore.realName?.charAt(0) || userStore.username?.charAt(0) }}
        </el-avatar>
        <div class="profile-name-section">
          <div class="profile-name">{{ userStore.realName || userStore.username }}</div>
          <el-tag :type="roleTagType" size="small" effect="dark">{{ roleLabel }}</el-tag>
        </div>
      </div>
      <el-descriptions :column="1" border size="small" class="profile-details">
        <el-descriptions-item label="用户名">{{ userStore.username }}</el-descriptions-item>
        <el-descriptions-item label="姓名">{{ userStore.realName || '未设置' }}</el-descriptions-item>
        <el-descriptions-item label="角色">{{ roleLabel }}</el-descriptions-item>
      </el-descriptions>
    </div>
  </el-dialog>

  <!-- 主题切换幕布 -->
  <div class="theme-curtain" :class="curtainPhase" :style="{ background: curtainColor }"></div>


</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/store'
import { changePasswordApi, getNotificationList, getUnreadCount, readNotification, deleteNotification, onConnectionChange, getOnlineStatus, getTaskDetailApi } from '@/api'
import { ROLE_LABEL, ROLE_TAG_TYPE } from '@/utils/format'
import { useConfig } from '@/composables/useConfig'
import { HomeFilled, Bell, Moon, Sunny, User, Connection, WarningFilled } from '@element-plus/icons-vue'
import InfiniteGridBg from '@/components/InfiniteGridBg.vue'
import SidebarMenu from '@/components/SidebarMenu.vue'
import AnnouncementBanner from '@/components/AnnouncementBanner.vue'
import GlobalTaskSearch from '@/components/GlobalTaskSearch.vue'
import QuickActions from '@/components/QuickActions.vue'
import { initNotificationToast, destroyNotificationToast } from '@/composables/useNotificationToast'
import { openTask } from '@/utils/task-navigation'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const isConnected = ref(getOnlineStatus())

const homeRoute = computed(() => {
  const role = userStore.role
  if (role === 'operator') return { path: '/operator/publish' }
  if (role === 'cs_agent') return { path: '/cs/publish' }
  if (role === 'designer') return { path: '/designer/hall' }
  if (role === 'basic_designer') return { path: '/basic/hall' }
  return { path: '/dashboard' }
})

// ===== 消息通知 =====
const notifyPopoverVisible = ref(false)
const notifyLoading = ref(false)
const notifications = ref([])
const unreadCount = ref(0)
const hasNewNotify = ref(false)
let pulseTimer = null

// 获取通知列表
async function loadNotifications() {
  try {
    notifyLoading.value = true
    const res = await getNotificationList({ pageSize: 20 })
    if (res.code === 0) {
      notifications.value = res.data.list || []
    }
  } catch (e) {
    console.error('[Notify] 加载通知失败:', e)
  } finally {
    notifyLoading.value = false
  }
}

// 获取未读数量
async function loadUnreadCount() {
  try {
    const res = await getUnreadCount()
    if (res.code === 0) {
      const newCount = res.data.count || 0
      if (newCount > unreadCount.value) {
        hasNewNotify.value = true
        if (pulseTimer) clearTimeout(pulseTimer)
        pulseTimer = setTimeout(() => { hasNewNotify.value = false }, 2000)
      }
      unreadCount.value = newCount
      updateDocTitle()
    }
  } catch (e) {}
}

function updateDocTitle() {
  const title = route.meta?.title || 'Nexus'
  document.title = unreadCount.value > 0
    ? `(${unreadCount.value}) Nexus · ${title}`
    : `Nexus · ${title}`
}

// 全部标记已读
async function markAllRead() {
  try {
    const res = await readNotification({ all: true })
    if (res.code === 0) {
      notifications.value.forEach(n => { n.is_read = 1 })
      unreadCount.value = 0
      updateDocTitle()
    }
  } catch (e) {}
}

// 清空所有通知
async function clearAllNotifications() {
  try {
    await ElMessageBox.confirm('确认清空所有通知？', '提示')
    const res = await deleteNotification({ all: true })
    if (res.code === 0) {
      notifications.value = []
      unreadCount.value = 0
      updateDocTitle()
    }
  } catch (e) {}
}

// 点击通知
async function handleNotifyClick(item) {
  if (!item.is_read) {
    try {
      await readNotification({ id: item.id })
      item.is_read = 1
      unreadCount.value = Math.max(0, unreadCount.value - 1)
      updateDocTitle()
    } catch (e) {}
  }
  if (item.task_id) {
    notifyPopoverVisible.value = false
    try {
      const res = await getTaskDetailApi({ taskId: item.task_id })
      openTask(res.code === 0 ? res.data : { ...item, id: item.task_id })
    } catch {
      openTask({ ...item, id: item.task_id })
    }
  }
}

// 实时时钟
const currentTime = ref('')
let timeTimer = null

function updateClock() {
  const now = new Date()
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const wd = weekdays[now.getDay()]
  currentTime.value = `${h}:${m}:${s} 周${wd}`
}

onMounted(() => {
  useConfig().ensureLoaded()
  updateClock()
  timeTimer = setInterval(updateClock, 1000)
  onConnectionChange(online => { isConnected.value = online })
  initNotificationToast(loadUnreadCount)
})

onUnmounted(() => {
  if (timeTimer) clearInterval(timeTimer)
  if (hoverTimer) clearTimeout(hoverTimer)
  if (curtainTimer) clearTimeout(curtainTimer)
  destroyNotificationToast()
})

// 侧边栏
const SIDEBAR_STATE_KEY = 'd_design_sidebar_collapsed'
const isCollapse = ref(localStorage.getItem(SIDEBAR_STATE_KEY) === 'true')
const hovering = ref(false)
let hoverTimer = null
const effectiveCollapse = computed(() => isCollapse.value && !hovering.value)
const sidebarWidth = computed(() => effectiveCollapse.value ? '56px' : '220px')

function toggleSidebar() {
  isCollapse.value = !isCollapse.value
  localStorage.setItem(SIDEBAR_STATE_KEY, isCollapse.value)
}

function onSidebarEnter() {
  clearTimeout(hoverTimer)
  hovering.value = true
}

function onSidebarLeave() {
  hoverTimer = setTimeout(() => {
    hovering.value = false
  }, 120)
}

// 当前激活菜单
const activeMenu = computed(() => route.path)

const roleLabel = computed(() => ROLE_LABEL[userStore.role] || '')
const roleTagType = computed(() => ROLE_TAG_TYPE[userStore.role] || 'info')
const avatarColor = computed(() => {
  const colors = ['#4361ee', '#2ec4b6', '#f7931a', '#e63946', '#7b8ba3']
  const index = (userStore.username?.length || 0) % colors.length
  return colors[index]
})

// 主题切换 - 幕布效果
const THEME_KEY = 'design_theme'
const isDark = ref(localStorage.getItem(THEME_KEY) === 'dark')
const curtainPhase = ref('idle') // 'idle' | 'falling' | 'rising'
const curtainColor = ref('')
const themeBtnHovered = ref(false)
const themeBtnPressed = ref(false)
let curtainTimer = null

// 初始化主题
if (isDark.value) {
  document.documentElement.classList.add('dark')
}

function toggleTheme() {
  if (curtainPhase.value !== 'idle') return

  const nextIsDark = !isDark.value
  curtainColor.value = nextIsDark ? '#0f1117' : '#f0f2f5'
  curtainPhase.value = 'falling'

  curtainTimer = setTimeout(() => {
    isDark.value = nextIsDark
    if (nextIsDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem(THEME_KEY, 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem(THEME_KEY, 'light')
    }

    curtainPhase.value = 'rising'
    curtainTimer = setTimeout(() => {
      curtainPhase.value = 'idle'
    }, 550)
  }, 550)
}

// 下拉菜单
function handleCommand(command) {
  if (command === 'logout') {
    ElMessageBox.confirm('确认退出登录？', '提示', {
      confirmButtonText: '确认退出',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(() => {
      userStore.logout()
      router.push('/login')
      ElMessage.success('已安全退出')
    }).catch(() => {})
  } else if (command === 'password') {
    pwdDialogVisible.value = true
  } else if (command === 'profile') {
    profileVisible.value = true
  }
}

// 修改密码
const pwdDialogVisible = ref(false)
const pwdLoading = ref(false)
const pwdFormRef = ref(null)
const profileVisible = ref(false)

const pwdForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})
const pwdRules = {
  oldPassword: [{ required: true, message: '请输入旧密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== pwdForm.value.newPassword) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

async function changePassword() {
  const valid = await pwdFormRef.value.validate().catch(() => false)
  if (!valid) return

  pwdLoading.value = true
  try {
    const res = await changePasswordApi({
      oldPassword: pwdForm.value.oldPassword,
      newPassword: pwdForm.value.newPassword
    })
    if (res.code === 0) {
      ElMessage.success('密码修改成功，请重新登录')
      pwdDialogVisible.value = false
      userStore.logout()
      router.push('/login')
    } else {
      ElMessage.error(res.msg)
    }
  } finally {
    pwdLoading.value = false
  }
}
</script>

<style scoped>
/* ===== 布局容器 ===== */
.layout-container {
  height: 100vh;
  background: var(--dd-bg);
}

/* ===== 侧边栏容器 ===== */
.layout-aside {
  background: var(--dd-bg-sidebar);
  overflow-y: auto;
  overflow-x: hidden;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 100;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
}

/* ===== 顶部品牌区 ===== */
.sidebar-top {
  height: 54px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding: 0 12px;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.brand-avatar {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-name {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  white-space: nowrap;
}

.brand-title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 1px;
  background: linear-gradient(135deg, #4361ee, #2ec4b6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1.2;
}

.brand-sub {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.3);
  letter-spacing: 0.5px;
  line-height: 1.2;
}

/* ===== 导航菜单区 ===== */
.sidebar-nav {
  flex: 1;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

/* 菜单项 */
.nav-item {
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0 8px;
  border-radius: 8px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.55);
  transition: all 0.15s ease;
  flex-shrink: 0;
  position: relative;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.9);
}

.nav-item:active {
  transform: scale(0.97);
}

.nav-item.active {
  background: rgba(67, 97, 238, 0.2);
  color: #6c83f5;
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 3px;
  background: #4361ee;
  border-radius: 0 3px 3px 0;
}

.nav-item .el-icon {
  flex-shrink: 0;
}

/* 菜单文本 */
.nav-text {
  margin-left: 10px;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  opacity: 0;
  transition: opacity 0.15s ease 0.05s;
}

.layout-aside:not(.is-collapsed) .nav-text {
  opacity: 1;
}

/* 品牌名文本 */
.brand-name {
  opacity: 0;
  transition: opacity 0.15s ease 0.05s;
}

.layout-aside:not(.is-collapsed) .brand-name {
  opacity: 1;
}

/* 分区标签 */
.nav-section-label {
  font-size: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.2);
  text-transform: uppercase;
  letter-spacing: 1.5px;
  padding: 12px 10px 4px;
  white-space: nowrap;
  overflow: hidden;
  opacity: 0;
  transition: opacity 0.15s ease 0.05s;
  flex-shrink: 0;
}

.layout-aside:not(.is-collapsed) .nav-section-label {
  opacity: 1;
}

/* 分隔线 */
.nav-separator {
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 4px 8px;
  flex-shrink: 0;
}

/* ===== 底部区 ===== */
.sidebar-bottom {
  flex-shrink: 0;
  padding: 4px 8px 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.collapse-toggle {
  opacity: 0.5;
}

.collapse-toggle:hover {
  opacity: 0.9;
}

.sidebar-version {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 0;
  opacity: 0;
  transition: opacity 0.15s ease 0.05s;
}

.layout-aside:not(.is-collapsed) .sidebar-version {
  opacity: 1;
}

.sidebar-version .version-text {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.2);
  letter-spacing: 0.3px;
}

.version-dot {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.15);
}

/* ===== 顶部栏 ===== */
.layout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--dd-bg-header);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid var(--dd-border);
  padding: 0 24px;
  height: 60px;
  position: sticky;
  top: 0;
  z-index: 99;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 折叠按钮 */
.collapse-btn {
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all var(--dd-transition-fast);
  color: var(--dd-text-secondary);
}

.collapse-btn:hover {
  background: var(--dd-border-light);
  color: var(--dd-primary);
}

/* 面包屑 */
.custom-breadcrumb {
  font-size: 13px;
}

.custom-breadcrumb :deep(.el-breadcrumb__inner) {
  color: var(--dd-text-muted);
}

.custom-breadcrumb :deep(.el-breadcrumb__inner:hover) {
  color: var(--dd-primary);
}

.custom-breadcrumb :deep(.el-breadcrumb__item:last-child .el-breadcrumb__inner) {
  color: var(--dd-text-primary);
  font-weight: 500;
}

/* 顶部图标按钮 */
.header-icon-btn {
  padding: 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  color: var(--dd-text-secondary);
  position: relative;
}
.header-icon-btn:hover {
  background: var(--dd-primary-lighter);
  color: var(--dd-primary);
}
.header-icon-btn:active {
  opacity: 0.8;
}

/* 铃铛角标 */
.notify-badge :deep(.el-badge__content) {
  font-size: 10px; height: 18px; line-height: 18px; padding: 0 5px;
}

/* 时钟 */
.header-clock {
  font-size: 13px;
  color: var(--dd-text-muted);
  font-family: var(--dd-font-mono);
  letter-spacing: 0.5px;
  user-select: none;
  padding: 4px 8px;
}

/* 分割线 */
.header-divider {
  width: 1px;
  height: 24px;
  background: var(--dd-border);
  margin: 0 4px;
}

/* 角色标签 */
.role-tag {
  font-weight: 500;
  letter-spacing: 0.5px;
}

/* 用户下拉 */
.user-dropdown {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 10px 4px 4px;
  border-radius: 20px;
  transition: all var(--dd-transition-fast);
}

.user-dropdown:hover {
  background: var(--dd-border-light);
}

.user-avatar {
  flex-shrink: 0;
}

.user-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--dd-text-primary);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-arrow {
  font-size: 12px;
  color: var(--dd-text-muted);
  transition: transform var(--dd-transition-fast);
}

.user-dropdown:hover .user-arrow {
  transform: rotate(180deg);
}

/* 下拉菜单用户信息 */
.dropdown-user-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--dd-border-light);
  margin-bottom: 4px;
}

.dropdown-avatar {
  flex-shrink: 0;
}

.dropdown-user-info {
  flex: 1;
  min-width: 0;
}

.dropdown-user-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--dd-text-primary);
  line-height: 1.3;
}

.dropdown-user-role {
  font-size: 11px;
  color: var(--dd-text-muted);
  margin-top: 2px;
}

/* ===== 内容区域 ===== */
.layout-main {
  background: var(--dd-bg);
  padding: 24px;
  overflow-y: auto;
  height: calc(100vh - 60px);
  position: relative;
  z-index: 1;
}

/* ===== 页面过渡动画 ===== */
.page-fade-enter-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.page-fade-leave-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.page-fade-enter-from { opacity: 0; transform: translateY(8px); }
.page-fade-leave-to { opacity: 0; transform: translateY(-6px); }

/* 通知脉冲动画 */
.notify-pulse { animation: notifyPulse 0.6s ease-in-out 2; }
@keyframes notifyPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.65; color: var(--dd-primary); }
}

/* 重连状态条 */
.reconnect-bar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
  background: var(--dd-warning); color: #fff; font-size: 13px;
  text-align: center; padding: 6px 0; font-weight: 500;
}
.reconnect-icon { vertical-align: -2px; margin-right: 4px; }

/* 页面骨架屏 */
.page-skeleton { padding: 24px; }

/* ===== 滚动条美化 ===== */
.layout-aside::-webkit-scrollbar {
  width: 3px;
}

.layout-aside::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.layout-aside::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* 个人信息对话框 */
.profile-content { padding: 8px 0; }
.profile-avatar-section { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--dd-border-light); }
.profile-name-section { flex: 1; }
.profile-name { font-size: 18px; font-weight: 700; color: var(--dd-text-primary); margin-bottom: 6px; }
.profile-details { margin-top: 4px; }

/* ===== 通知面板样式 ===== */
.notify-popper {
  padding: 0 !important;
}
.notify-panel { max-height: 460px; display: flex; flex-direction: column; }
.notify-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--dd-border-light); flex-shrink: 0; }
.notify-title { font-size: 15px; font-weight: 600; color: var(--dd-text-primary); }
.notify-actions { display: flex; gap: 8px; }
.notify-list { max-height: 380px; overflow-y: auto; flex: 1; }
.notify-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 16px; color: var(--dd-text-muted); gap: 8px; }
.notify-empty p { margin: 0; font-size: 13px; }
.notify-item { display: flex; gap: 10px; padding: 12px 16px; cursor: pointer; transition: background var(--dd-transition-fast); border-bottom: 1px solid var(--dd-border-light); }
.notify-item:last-child { border-bottom: none; }
.notify-item:hover { background: var(--dd-primary-lighter); }
.notify-unread { background: rgba(67, 97, 238, 0.03); }
.notify-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--dd-primary); flex-shrink: 0; margin-top: 6px; }
.notify-content { flex: 1; min-width: 0; }
.notify-item-title { font-size: 13px; font-weight: 600; color: var(--dd-text-primary); margin-bottom: 2px; }
.notify-item-desc { font-size: 12px; color: var(--dd-text-secondary); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.notify-item-time { font-size: 11px; color: var(--dd-text-muted); margin-top: 4px; }

/* ===== 无限网格背景上层内容 ===== */
.main-content-wrap {
  position: relative;
  z-index: 1;
}

/* ===== 主题切换幕布 ===== */
.theme-curtain {
  position: fixed;
  inset: 0;
  transform-origin: top;
  transform: scaleY(0);
  z-index: 9997;
  pointer-events: none;
  transition: none;
}

.theme-curtain.falling {
  transform: scaleY(1);
  transition: transform 550ms cubic-bezier(0.76, 0, 0.24, 1);
}

.theme-curtain.rising {
  transform: scaleY(0);
  transition: transform 550ms cubic-bezier(0.76, 0, 0.24, 1);
}

/* ===== 主题切换按钮 ===== */
.theme-toggle-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--dd-bg-card);
  color: var(--dd-text-secondary);
  box-shadow: 0 0 0 1.5px var(--dd-border);
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.theme-toggle-btn:hover,
.theme-toggle-btn.is-hovered {
  color: var(--dd-primary);
  box-shadow: 0 0 0 1.5px var(--dd-primary-light);
}

.theme-toggle-btn:active,
.theme-toggle-btn.is-pressed {
  opacity: 0.8;
}
</style>
