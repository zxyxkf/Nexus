/**
 * 路由配置 - 权限守卫 + 角色识别
 */

import { createRouter, createWebHashHistory } from 'vue-router'
import { getToken, getUser } from '@/utils/auth'
import { ElMessage } from 'element-plus'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/Login.vue'),
    meta: { title: '登录', noAuth: true }
  },
  {
    path: '/',
    component: () => import('@/views/Layout.vue'),
    redirect: '/dashboard',
    meta: { requiresAuth: true },
    children: [
      // 运营端（发布/审核 与客服共用组件，通过 meta.role 区分）
      {
        path: 'operator/publish',
        name: 'OperatorPublish',
        component: () => import('@/views/shared/PublishTask.vue'),
        meta: { title: '发布任务', roles: ['operator', 'admin'], role: 'operator', taskGroup: 'design' }
      },
      {
        path: 'operator/tasks',
        name: 'OperatorTasks',
        component: () => import('@/views/shared/MyTasksPub.vue'),
        meta: { title: '我的任务', roles: ['operator', 'admin'], role: 'operator', taskGroup: 'design' }
      },
      {
        path: 'operator/review',
        name: 'OperatorReview',
        component: () => import('@/views/shared/Review.vue'),
        meta: { title: '作品审核', roles: ['operator', 'admin'], role: 'operator', taskGroup: 'design' }
      },
      {
        path: 'operator/stats',
        name: 'OperatorStats',
        component: () => import('@/views/operator/Stats.vue'),
        meta: { title: '个人统计', roles: ['operator', 'admin'] }
      },
      {
        path: 'operator/board',
        name: 'OperatorBoard',
        component: () => import('@/views/admin/Dashboard.vue'),
        meta: { title: '数据看板', roles: ['operator', 'admin'], dashboardGroups: ['design', 'operator'] }
      },
      // 运营任务管理（运营发布给运营助理的任务）
      {
        path: 'operator/op-publish',
        name: 'OperatorOpPublish',
        component: () => import('@/views/operator/OpPublishTask.vue'),
        meta: { title: '发布运营任务', roles: ['operator', 'admin'], role: 'operator', taskGroup: 'operator' }
      },
      {
        path: 'operator/op-tasks',
        name: 'OperatorOpTasks',
        component: () => import('@/views/operator/OpMyTasks.vue'),
        meta: { title: '我的运营任务', roles: ['operator', 'admin'], role: 'operator', taskGroup: 'operator' }
      },
      {
        path: 'operator/op-review',
        name: 'OperatorOpReview',
        component: () => import('@/views/operator/OpReview.vue'),
        meta: { title: '任务审核', roles: ['operator', 'admin'], role: 'operator', taskGroup: 'operator' }
      },
      // 客服端（与运营共用组件，通过 meta.role 区分）
      {
        path: 'cs/publish',
        name: 'CsPublish',
        component: () => import('@/views/shared/PublishTask.vue'),
        meta: { title: '发布任务', roles: ['cs_agent', 'admin'], role: 'cs_agent' }
      },
      {
        path: 'cs/tasks',
        name: 'CsTasks',
        component: () => import('@/views/shared/MyTasksPub.vue'),
        meta: { title: '我的任务', roles: ['cs_agent', 'admin'], role: 'cs_agent' }
      },
      {
        path: 'cs/review',
        name: 'CsReview',
        component: () => import('@/views/shared/Review.vue'),
        meta: { title: '作品审核', roles: ['cs_agent', 'admin'], role: 'cs_agent' }
      },
      {
        path: 'cs/stats',
        name: 'CsStats',
        component: () => import('@/views/cs/Stats.vue'),
        meta: { title: '个人统计', roles: ['cs_agent', 'admin'] }
      },
      {
        path: 'cs/board',
        name: 'CsBoard',
        component: () => import('@/views/admin/Dashboard.vue'),
        meta: { title: '数据看板', roles: ['cs_agent', 'admin'], dashboardGroups: ['cs'] }
      },
      // 美工端（任务大厅与基础美工共用组件）
      {
        path: 'designer/hall',
        name: 'DesignerHall',
        component: () => import('@/views/shared/TaskHall.vue'),
        meta: { title: '任务大厅', roles: ['designer', 'admin'], role: 'designer' }
      },
      {
        path: 'designer/tasks',
        name: 'DesignerTasks',
        component: () => import('@/views/designer/MyTasks.vue'),
        meta: { title: '我的任务', roles: ['designer', 'admin'] }
      },
      {
        path: 'designer/stats',
        name: 'DesignerStats',
        component: () => import('@/views/designer/Stats.vue'),
        meta: { title: '个人统计', roles: ['designer', 'admin'] }
      },
      {
        path: 'designer/board',
        name: 'DesignerBoard',
        component: () => import('@/views/admin/Dashboard.vue'),
        meta: { title: '数据看板', roles: ['designer', 'admin'], dashboardGroups: ['design'] }
      },
      // 基础美工端（任务大厅与美工共用组件）
      {
        path: 'basic/hall',
        name: 'BasicHall',
        component: () => import('@/views/shared/TaskHall.vue'),
        meta: { title: '任务大厅', roles: ['basic_designer', 'admin'], role: 'basic_designer' }
      },
      {
        path: 'basic/tasks',
        name: 'BasicTasks',
        component: () => import('@/views/basic/MyTasks.vue'),
        meta: { title: '我的任务', roles: ['basic_designer', 'admin'] }
      },
      {
        path: 'basic/stats',
        name: 'BasicStats',
        component: () => import('@/views/basic/Stats.vue'),
        meta: { title: '个人统计', roles: ['basic_designer', 'admin'] }
      },
      {
        path: 'basic/board',
        name: 'BasicBoard',
        component: () => import('@/views/admin/Dashboard.vue'),
        meta: { title: '数据看板', roles: ['basic_designer', 'admin'], dashboardGroups: ['cs'] }
      },
      {
        path: 'basic/score-review',
        name: 'BasicScoreReview',
        component: () => import('@/views/basic/ScoreReview.vue'),
        meta: { title: '分值审核', roles: ['basic_designer', 'admin', 'sub_admin'] }
      },
      {
        path: 'basic/review-records',
        name: 'BasicReviewRecords',
        component: () => import('@/views/basic/ReviewRecords.vue'),
        meta: { title: '审核记录', roles: ['basic_designer', 'admin', 'sub_admin'] }
      },
      // 运营助理端（任务大厅与美工共用组件）
      {
        path: 'operator-assistant/hall',
        name: 'OperatorAssistantHall',
        component: () => import('@/views/shared/TaskHall.vue'),
        meta: { title: '任务大厅', roles: ['operator_assistant', 'admin'], role: 'operator_assistant' }
      },
      {
        path: 'operator-assistant/tasks',
        name: 'OperatorAssistantTasks',
        component: () => import('@/views/operator-assistant/MyTasks.vue'),
        meta: { title: '我的任务', roles: ['operator_assistant', 'admin'] }
      },
      {
        path: 'operator-assistant/stats',
        name: 'OperatorAssistantStats',
        component: () => import('@/views/operator-assistant/Stats.vue'),
        meta: { title: '个人统计', roles: ['operator_assistant', 'admin'] }
      },
      {
        path: 'operator-assistant/board',
        name: 'OperatorAssistantBoard',
        component: () => import('@/views/admin/Dashboard.vue'),
        meta: { title: '数据看板', roles: ['operator_assistant', 'admin'], dashboardGroups: ['operator'] }
      },
      // 管理员端
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/admin/Dashboard.vue'),
        meta: { title: '数据仪表盘', roles: ['admin', 'sub_admin'] }
      },
      {
        path: 'admin/users',
        name: 'AdminUsers',
        component: () => import('@/views/admin/Users.vue'),
        meta: { title: '用户管理', roles: ['admin'] }
      },
      {
        path: 'admin/tasks',
        redirect: '/admin/tasks/design'
      },
      {
        path: 'admin/tasks/design',
        name: 'AdminDesignTasks',
        component: () => import('@/views/admin/AllTasks.vue'),
        meta: { title: '运营美工全量任务', roles: ['admin', 'sub_admin'], taskGroup: 'design' }
      },
      {
        path: 'admin/tasks/operator',
        name: 'AdminOperatorTasks',
        component: () => import('@/views/admin/AllTasks.vue'),
        meta: { title: '运营助理全量任务', roles: ['admin', 'sub_admin'], taskGroup: 'operator' }
      },
      {
        path: 'admin/tasks/cs',
        name: 'AdminCsTasks',
        component: () => import('@/views/admin/AllTasks.vue'),
        meta: { title: '客服基础美工全量任务', roles: ['admin', 'sub_admin'], taskGroup: 'cs' }
      },
      {
        path: 'admin/logs',
        name: 'AdminLogs',
        component: () => import('@/views/admin/Logs.vue'),
        meta: { title: '操作日志', roles: ['admin'] }
      },
      {
        path: 'admin/config',
        name: 'AdminConfig',
        component: () => import('@/views/admin/Config.vue'),
        meta: { title: '系统配置', roles: ['admin'] }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// 路由守卫 - 权限校验
router.beforeEach((to, from, next) => {
  // 设置页面标题
  document.title = to.meta.title ? `Nexus · ${to.meta.title}` : 'Nexus'

  // 不需要登录的页面直接放行
  if (to.meta.noAuth) {
    next()
    return
  }

  const token = getToken()
  const user = getUser()

  // 未登录，跳转登录页
  if (!token || !user) {
    ElMessage.warning('请先登录')
    next('/login')
    return
  }

  // 检查角色权限
  if (to.meta.roles && to.meta.roles.length > 0) {
    if (!to.meta.roles.includes(user.role)) {
      // 静默跳转到角色默认页，不弹窗
      if (user.role === 'operator') {
        next('/operator/publish')
      } else if (user.role === 'cs_agent') {
        next('/cs/publish')
      } else if (user.role === 'designer') {
        next('/designer/hall')
      } else if (user.role === 'basic_designer') {
        next('/basic/hall')
      } else if (user.role === 'operator_assistant') {
        next('/operator-assistant/hall')
      } else if (user.role === 'sub_admin') {
        next('/dashboard')
      } else {
        next('/dashboard')
      }
      return
    }
  }

  next()
})

export default router
