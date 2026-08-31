/**
 * 路由配置 - 权限守卫 + 角色识别
 */

import { createRouter, createWebHashHistory } from 'vue-router'
import { getToken, getUser } from '@/utils/auth'
import { ElMessage } from 'element-plus'
import { canUseManagerReview, hasAnyPermission } from '@/utils/permissions'

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
        meta: { title: '发布任务', roles: ['operator', 'admin'], permission: 'operator.publish.design', role: 'operator', taskGroup: 'design' }
      },
      {
        path: 'operator/tasks',
        name: 'OperatorTasks',
        component: () => import('@/views/shared/MyTasksPub.vue'),
        meta: { title: '我的任务', roles: ['operator', 'admin'], permission: 'operator.tasks.design', role: 'operator', taskGroup: 'design' }
      },
      {
        path: 'operator/review',
        name: 'OperatorReview',
        component: () => import('@/views/shared/Review.vue'),
        meta: { title: '作品审核', roles: ['operator', 'admin'], permissions: ['operator.review.design', 'payment.open'], role: 'operator', taskGroup: 'design' }
      },
      {
        path: 'operator/stats',
        name: 'OperatorStats',
        component: () => import('@/views/operator/Stats.vue'),
        meta: { title: '个人统计', roles: ['operator', 'admin'], permission: 'stats.personal' }
      },
      // 运营任务管理（运营发布给运营助理的任务）
      {
        path: 'operator/op-publish',
        name: 'OperatorOpPublish',
        component: () => import('@/views/operator/OpPublishTask.vue'),
        meta: { title: '发布运营任务', roles: ['operator', 'admin'], permission: 'operator.publish.assistant', role: 'operator', taskGroup: 'operator' }
      },
      {
        path: 'operator/op-tasks',
        name: 'OperatorOpTasks',
        component: () => import('@/views/operator/OpMyTasks.vue'),
        meta: { title: '我的运营任务', roles: ['operator', 'admin'], permission: 'operator.tasks.assistant', role: 'operator', taskGroup: 'operator' }
      },
      {
        path: 'operator/op-review',
        name: 'OperatorOpReview',
        component: () => import('@/views/operator/OpReview.vue'),
        meta: { title: '任务审核', roles: ['operator', 'admin'], permission: 'operator.review.assistant', role: 'operator', taskGroup: 'operator' }
      },
      // 客服端（与运营共用组件，通过 meta.role 区分）
      {
        path: 'cs/publish',
        name: 'CsPublish',
        component: () => import('@/views/shared/PublishTask.vue'),
        meta: { title: '发布任务', roles: ['cs_agent', 'admin'], permission: 'cs.publish.basic', role: 'cs_agent', taskGroup: 'cs' }
      },
      {
        path: 'cs/tasks',
        name: 'CsTasks',
        component: () => import('@/views/shared/MyTasksPub.vue'),
        meta: { title: '我的任务', roles: ['cs_agent', 'admin'], permission: 'cs.tasks.basic', role: 'cs_agent', taskGroup: 'cs' }
      },
      {
        path: 'cs/review',
        name: 'CsReview',
        component: () => import('@/views/shared/Review.vue'),
        meta: { title: '作品审核', roles: ['cs_agent', 'admin'], permission: 'cs.review.basic', role: 'cs_agent', taskGroup: 'cs' }
      },
      {
        path: 'cs/stats',
        name: 'CsStats',
        component: () => import('@/views/cs/Stats.vue'),
        meta: { title: '个人统计', roles: ['cs_agent', 'admin'], permission: 'stats.personal' }
      },
      // 美工端（任务大厅与基础美工共用组件）
      {
        path: 'designer/hall',
        name: 'DesignerHall',
        component: () => import('@/views/shared/TaskHall.vue'),
        meta: { title: '任务大厅', roles: ['designer', 'admin'], permission: 'designer.hall.design', role: 'designer' }
      },
      {
        path: 'designer/tasks',
        name: 'DesignerTasks',
        component: () => import('@/views/designer/MyTasks.vue'),
        meta: { title: '我的任务', roles: ['designer', 'admin'], permission: 'designer.tasks.design' }
      },
      {
        path: 'designer/tasks/todo',
        name: 'DesignerTodoTasks',
        component: () => import('@/views/designer/MyTasks.vue'),
        meta: { title: '待做任务', roles: ['designer', 'admin'], permission: 'designer.tasks.design', fixedStatus: 'accepted' }
      },
      {
        path: 'designer/tasks/pending',
        name: 'DesignerPendingTasks',
        component: () => import('@/views/designer/MyTasks.vue'),
        meta: { title: '待审核任务', roles: ['designer', 'admin'], permission: 'designer.tasks.design', fixedStatus: 'doing' }
      },
      {
        path: 'designer/stats',
        name: 'DesignerStats',
        component: () => import('@/views/designer/Stats.vue'),
        meta: { title: '个人统计', roles: ['designer', 'admin'], permission: 'stats.personal' }
      },
      // 基础美工端（任务大厅与美工共用组件）
      {
        path: 'basic/hall',
        name: 'BasicHall',
        component: () => import('@/views/shared/TaskHall.vue'),
        meta: { title: '任务大厅', roles: ['basic_designer', 'admin'], permission: 'basic.hall.cs', role: 'basic_designer' }
      },
      {
        path: 'basic/tasks',
        name: 'BasicTasks',
        component: () => import('@/views/basic/MyTasks.vue'),
        meta: { title: '我的任务', roles: ['basic_designer', 'admin'], permission: 'basic.tasks.cs' }
      },
      {
        path: 'basic/tasks/todo',
        name: 'BasicTodoTasks',
        component: () => import('@/views/basic/MyTasks.vue'),
        meta: { title: '待做任务', roles: ['basic_designer', 'admin'], permission: 'basic.tasks.cs', fixedStatus: 'accepted' }
      },
      {
        path: 'basic/tasks/pending',
        name: 'BasicPendingTasks',
        component: () => import('@/views/basic/MyTasks.vue'),
        meta: { title: '待审核任务', roles: ['basic_designer', 'admin'], permission: 'basic.tasks.cs', fixedStatus: 'doing' }
      },
      {
        path: 'basic/stats',
        name: 'BasicStats',
        component: () => import('@/views/basic/Stats.vue'),
        meta: { title: '个人统计', roles: ['basic_designer', 'admin'], permission: 'stats.personal' }
      },
      {
        path: 'basic/score-review',
        name: 'BasicScoreReview',
        component: () => import('@/views/basic/ScoreReview.vue'),
        meta: { title: '分值审核', roles: ['basic_designer', 'admin', 'sub_admin'], permission: 'score.review.basic' }
      },
      {
        path: 'basic/review-records',
        name: 'BasicReviewRecords',
        component: () => import('@/views/basic/ReviewRecords.vue'),
        meta: { title: '审核记录', roles: ['basic_designer', 'admin', 'sub_admin'], permission: 'score.records.basic' }
      },
      // 运营助理端（任务大厅与美工共用组件）
      {
        path: 'operator-assistant/hall',
        name: 'OperatorAssistantHall',
        component: () => import('@/views/shared/TaskHall.vue'),
        meta: { title: '任务大厅', roles: ['operator_assistant', 'admin'], permission: 'assistant.hall.operator', role: 'operator_assistant' }
      },
      {
        path: 'operator-assistant/tasks',
        name: 'OperatorAssistantTasks',
        component: () => import('@/views/operator-assistant/MyTasks.vue'),
        meta: { title: '我的任务', roles: ['operator_assistant', 'admin'], permission: 'assistant.tasks.operator' }
      },
      {
        path: 'operator-assistant/tasks/todo',
        name: 'OperatorAssistantTodoTasks',
        component: () => import('@/views/operator-assistant/MyTasks.vue'),
        meta: { title: '待做任务', roles: ['operator_assistant', 'admin'], permission: 'assistant.tasks.operator', fixedStatus: 'accepted' }
      },
      {
        path: 'operator-assistant/tasks/pending',
        name: 'OperatorAssistantPendingTasks',
        component: () => import('@/views/operator-assistant/MyTasks.vue'),
        meta: { title: '待审核任务', roles: ['operator_assistant', 'admin'], permission: 'assistant.tasks.operator', fixedStatus: 'doing' }
      },
      {
        path: 'operator-assistant/stats',
        name: 'OperatorAssistantStats',
        component: () => import('@/views/operator-assistant/Stats.vue'),
        meta: { title: '个人统计', roles: ['operator_assistant', 'admin'], permission: 'stats.personal' }
      },
      {
        path: 'payment-tracking/selections',
        name: 'PaymentSelectionList',
        component: () => import('@/views/payment-tracking/SelectionList.vue'),
        meta: { title: '选品收集', permission: 'payment.selection.view' }
      },
      {
        path: 'payment-tracking/records',
        name: 'PaymentRecordsList',
        component: () => import('@/views/payment-tracking/RecordsList.vue'),
        meta: { title: '打款记录', permission: 'payment.records.view' }
      },
      {
        path: 'payment-tracking/manager-reviews',
        name: 'PaymentManagerReviews',
        component: () => import('@/views/payment-tracking/ManagerReviewList.vue'),
        meta: { title: '店长审核', managerReview: true }
      },
      {
        path: 'payment-tracking/records/:id/stages/:stageCode',
        name: 'PaymentStageDetail',
        component: () => import('@/views/payment-tracking/StageDetail.vue'),
        meta: { title: '选品阶段详情', permissions: ['payment.selection.view', 'payment.records.view'] }
      },
      // 管理员端
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/admin/Dashboard.vue'),
        meta: { title: '高级美工仪表盘', roles: ['admin', 'sub_admin', 'operator', 'designer'], permission: 'dashboard.design', dashboardGroups: ['design'] }
      },
      {
        path: 'dashboard/operator-assistant',
        name: 'OperatorAssistantDashboard',
        component: () => import('@/views/admin/Dashboard.vue'),
        meta: { title: '运营助理仪表盘', roles: ['admin', 'sub_admin', 'operator', 'operator_assistant'], permission: 'dashboard.operator', dashboardGroups: ['operator'] }
      },
      {
        path: 'dashboard/basic-designer',
        name: 'BasicDesignerDashboard',
        component: () => import('@/views/admin/Dashboard.vue'),
        meta: { title: '基础美工仪表盘', roles: ['admin', 'sub_admin', 'cs_agent', 'basic_designer'], permission: 'dashboard.cs', dashboardGroups: ['cs'] }
      },
      {
        path: 'admin/users',
        name: 'AdminUsers',
        component: () => import('@/views/admin/Users.vue'),
        meta: { title: '用户管理', roles: ['admin'], permission: 'admin.users' }
      },
      {
        path: 'admin/tasks',
        redirect: '/admin/tasks/design'
      },
      {
        path: 'admin/tasks/design',
        name: 'AdminDesignTasks',
        component: () => import('@/views/admin/AllTasks.vue'),
        meta: { title: '运营美工全量任务', roles: ['admin', 'sub_admin'], permission: 'admin.tasks.design', taskGroup: 'design' }
      },
      {
        path: 'admin/tasks/operator',
        name: 'AdminOperatorTasks',
        component: () => import('@/views/admin/AllTasks.vue'),
        meta: { title: '运营助理全量任务', roles: ['admin', 'sub_admin'], permission: 'admin.tasks.operator', taskGroup: 'operator' }
      },
      {
        path: 'admin/tasks/cs',
        name: 'AdminCsTasks',
        component: () => import('@/views/admin/AllTasks.vue'),
        meta: { title: '客服基础美工全量任务', roles: ['admin', 'sub_admin'], permission: 'admin.tasks.cs', taskGroup: 'cs' }
      },
      {
        path: 'admin/logs',
        name: 'AdminLogs',
        component: () => import('@/views/admin/Logs.vue'),
        meta: { title: '操作日志', roles: ['admin'], permission: 'admin.logs' }
      },
      {
        path: 'admin/config',
        name: 'AdminConfig',
        component: () => import('@/views/admin/Config.vue'),
        meta: { title: '系统配置', roles: ['admin'], permission: 'admin.config' }
      },
      {
        path: 'notifications',
        name: 'Notifications',
        component: () => import('@/views/shared/Notifications.vue'),
        meta: { title: '通知中心', permission: 'notification.center' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

const DEFAULT_ROUTE_BY_ROLE = {
  operator: '/operator/publish',
  cs_agent: '/cs/publish',
  designer: '/designer/hall',
  basic_designer: '/basic/hall',
  operator_assistant: '/operator-assistant/hall',
  sub_admin: '/dashboard',
  admin: '/dashboard'
}

function firstAllowedPath(user) {
  const children = routes.find(r => r.path === '/')?.children || []
  const matched = children.find(r =>
    r.path &&
    !r.redirect &&
    !isLockedAdminRoute(r, user) &&
    (!r.meta?.managerReview || canUseManagerReview(user)) &&
    ((!r.meta?.permission && !r.meta?.permissions) || hasAnyPermission(r.meta.permissions || [r.meta.permission], user))
  )
  return matched ? `/${matched.path}` : (DEFAULT_ROUTE_BY_ROLE[user.role] || '/dashboard')
}

function isLockedAdminRoute(to, user) {
  return to.meta.permission === 'admin.users' && user.role !== 'admin'
}

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

  const roleAllowed = !to.meta.roles || to.meta.roles.length === 0 || to.meta.roles.includes(user.role)
  const permissionAllowed = (!to.meta.permission && !to.meta.permissions) || hasAnyPermission(to.meta.permissions || [to.meta.permission], user)

  if (to.meta.managerReview && !canUseManagerReview(user)) {
    next(firstAllowedPath(user))
    return
  }

  if (isLockedAdminRoute(to, user)) {
    next(firstAllowedPath(user))
    return
  }

  if (!roleAllowed && !permissionAllowed) {
    next(firstAllowedPath(user))
    return
  }

  if ((to.meta.permission || to.meta.permissions) && !permissionAllowed) {
    next(firstAllowedPath(user))
    return
  }

  next()
})

export default router
