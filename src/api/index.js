/**
 * API 层 barrel export — 保持向后兼容
 * 实际实现已按领域拆分到各子模块
 */
export { default as request, getOnlineStatus, onConnectionChange } from './http'
export * from './auth'
export * from './user'
export * from './task'
export * from './notification'
export * from './log'
export * from './config'
export * from './score'
export * from './export'
export * from './upload'
export * from './announcement'
export * from './shop'
