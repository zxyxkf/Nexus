import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import { ElTable } from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia'
import Pagination from './components/Pagination.vue'
import './utils/auth'
import './assets/styles/global.css'
import { installTableEnhancements } from './utils/table-enhancements'
import { installDetailDismiss } from './utils/detail-dismiss'

const app = createApp(App)
const pinia = createPinia()
app.component('Pagination', Pagination)

// Element Plus requires border mode before table columns can be resized by dragging.
if (ElTable?.props?.border === Boolean) {
  ElTable.props.border = { type: Boolean, default: true }
} else if (ElTable?.props?.border) {
  ElTable.props.border.default = true
}

function isResizeObserverNoise(value) {
  const message = String(value?.message || value || '')
  return message.includes('ResizeObserver loop completed with undelivered notifications') ||
    message.includes('ResizeObserver loop limit exceeded')
}

app.config.errorHandler = (err, instance, info) => {
  if (isResizeObserverNoise(err)) return
  console.error('[Vue Error]', err, info)
}

window.onerror = (msg, url, line, col, err) => {
  if (isResizeObserverNoise(msg) || isResizeObserverNoise(err)) return true
  console.error('[Window Error]', msg, url, line, col, err)
  return false
}

window.addEventListener('unhandledrejection', (event) => {
  if (isResizeObserverNoise(event.reason)) return
  console.error('[Promise Rejection]', event.reason)
})

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(ElementPlus, { locale: zhCn })
app.use(pinia)
app.use(router)
app.mount('#app')
installTableEnhancements()
installDetailDismiss()
