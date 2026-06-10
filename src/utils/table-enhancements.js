import { getUser } from '@/utils/auth'

const ENHANCED_ATTR = 'data-nexus-column-settings'
const STYLE_ID_PREFIX = 'nexus-table-columns-style-'
const WIDTH_STYLE_ID_PREFIX = 'nexus-table-widths-style-'
let tableSeq = 0
let observer = null
let scheduled = false
let installed = false
let resizeGuide = null
let resizeFrame = null
let resizeHoverHeader = null

function getRouteKey() {
  return (window.location.hash || window.location.pathname || 'root').replace(/[^\w-]+/g, '_')
}

function isDashboardRoute() {
  const hash = window.location.hash || ''
  return hash === '#/dashboard' || hash.startsWith('#/dashboard/')
}

function getUserKey() {
  const user = getUser()
  return user?.id || user?.username || 'guest'
}

function getHeaderCells(table) {
  const rows = table.querySelectorAll('.el-table__header-wrapper thead tr')
  const row = rows[rows.length - 1]
  if (!row) return []
  return Array.from(row.querySelectorAll('th')).map((th, index) => {
    const text = th.querySelector('.cell')?.textContent?.trim() || `第${index + 1}列`
    return { index: index + 1, label: text || `第${index + 1}列` }
  })
}

function makeStorageKey(table, cells) {
  const signature = cells.map(cell => cell.label).join('|').slice(0, 160)
  const tableKey = table.dataset.nexusColumnKey || `${getRouteKey()}_${table.dataset.nexusTableIndex || '0'}_${signature}`
  return `nexus_table_columns_${getUserKey()}_${tableKey}`
}

function loadVisible(key, cells) {
  const all = cells.map(cell => cell.index)
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null')
    const valid = new Set(all)
    const next = Array.isArray(parsed) ? parsed.map(Number).filter(value => valid.has(value)) : all
    return next.length ? next : all
  } catch {
    return all
  }
}

function saveVisible(key, visible) {
  localStorage.setItem(key, JSON.stringify(visible))
}

function makeWidthStorageKey(storageKey) {
  return `${storageKey}_widths`
}

function loadColumnWidths(key, cells) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null')
    if (!parsed || typeof parsed !== 'object') return {}
    const valid = new Set(cells.map(cell => String(cell.index)))
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([index, width]) => [String(index), Math.round(Number(width))])
        .filter(([index, width]) => valid.has(index) && Number.isFinite(width) && width >= 40 && width <= 1600)
    )
  } catch {
    return {}
  }
}

function saveColumnWidths(key, widths) {
  localStorage.setItem(key, JSON.stringify(widths))
}

function readColumnWidths(table, cells) {
  const rows = table.querySelectorAll('.el-table__header-wrapper thead tr')
  const row = rows[rows.length - 1]
  if (!row) return {}
  const headers = Array.from(row.querySelectorAll('th'))
  return Object.fromEntries(
    cells
      .map(cell => [String(cell.index), Math.round(headers[cell.index - 1]?.getBoundingClientRect().width || 0)])
      .filter(([, width]) => Number.isFinite(width) && width >= 40 && width <= 1600)
  )
}

function syncTableColumnState(table, cells, widths) {
  const columns = table.__vueParentComponent?.proxy?.store?.states?.columns?.value
  if (!Array.isArray(columns)) return false
  let changed = false
  cells.forEach(cell => {
    const width = widths[String(cell.index)]
    const column = columns[cell.index - 1]
    if (!column || !Number.isFinite(width) || width < 40 || width > 1600) return
    column.width = width
    column.realWidth = width
    changed = true
  })
  if (changed) table.__vueParentComponent?.proxy?.doLayout?.()
  return changed
}

function applyColumnWidths(table, tableId, cells, widths) {
  let style = document.getElementById(`${WIDTH_STYLE_ID_PREFIX}${tableId}`)
  if (!style) {
    style = document.createElement('style')
    style.id = `${WIDTH_STYLE_ID_PREFIX}${tableId}`
    document.head.appendChild(style)
  }
  style.textContent = ''
  syncTableColumnState(table, cells, widths)
}

function persistColumnWidths(table) {
  const tableId = table?.dataset?.nexusTableId
  const widthKey = table?.dataset?.nexusColumnWidthKey
  if (!tableId || !widthKey) return
  const cells = getHeaderCells(table)
  if (!cells.length) return
  const widths = readColumnWidths(table, cells)
  if (!Object.keys(widths).length) return
  saveColumnWidths(widthKey, widths)
  applyColumnWidths(table, tableId, cells, widths)
}

function applyVisibility(table, tableId, cells, visible) {
  const hidden = cells.map(cell => cell.index).filter(index => !visible.includes(index))
  let style = document.getElementById(`${STYLE_ID_PREFIX}${tableId}`)
  if (!style) {
    style = document.createElement('style')
    style.id = `${STYLE_ID_PREFIX}${tableId}`
    document.head.appendChild(style)
  }

  if (!hidden.length) {
    style.textContent = ''
    table.__vueParentComponent?.proxy?.doLayout?.()
    return
  }

  const selectors = hidden.flatMap(index => [
    `.nexus-table-${tableId} .el-table__header-wrapper th:nth-child(${index})`,
    `.nexus-table-${tableId} .el-table__body-wrapper td:nth-child(${index})`,
    `.nexus-table-${tableId} .el-table__footer-wrapper td:nth-child(${index})`,
    `.nexus-table-${tableId} colgroup col:nth-child(${index})`,
    `.nexus-table-${tableId} .el-table__fixed th:nth-child(${index})`,
    `.nexus-table-${tableId} .el-table__fixed td:nth-child(${index})`,
    `.nexus-table-${tableId} .el-table__fixed-right th:nth-child(${index})`,
    `.nexus-table-${tableId} .el-table__fixed-right td:nth-child(${index})`
  ])
  style.textContent = `${selectors.join(',')}{display:none!important;width:0!important;min-width:0!important;max-width:0!important;padding:0!important;border:0!important;}`

  table.__vueParentComponent?.proxy?.doLayout?.()
}

function closeOtherPanels(activePanel) {
  document.querySelectorAll('.nexus-column-panel.is-open').forEach(panel => {
    if (panel !== activePanel) {
      panel.classList.remove('is-open')
      panel.classList.remove('is-teleported')
      panel.removeAttribute('style')
    }
  })
}

function positionPanel(button, panel) {
  const rect = button.getBoundingClientRect()
  const width = Math.max(panel.offsetWidth || 220, 220)
  const margin = 8
  const preferRight = button.closest('.nexus-column-control--header')
  const rawLeft = preferRight ? rect.left : rect.right - width
  const left = Math.min(Math.max(margin, rawLeft), window.innerWidth - width - margin)
  const top = Math.min(rect.bottom + margin, window.innerHeight - margin)
  panel.style.position = 'fixed'
  panel.style.left = `${left}px`
  panel.style.top = `${top}px`
  panel.style.right = 'auto'
  panel.style.maxHeight = `${Math.max(180, window.innerHeight - top - margin)}px`
  panel.style.zIndex = '4000'
  panel.classList.add('is-teleported')
}

function ensureResizeGuide() {
  if (!resizeGuide) {
    resizeGuide = document.createElement('div')
    resizeGuide.className = 'nexus-column-resize-guide'
    document.body.appendChild(resizeGuide)
  }
  return resizeGuide
}

function getResizeHeader(event) {
  const th = event.target?.closest?.('.el-table th.el-table__cell.is-leaf')
  if (!th) return null
  const rect = th.getBoundingClientRect()
  return rect.right - event.clientX <= 10 ? th : null
}

function updateResizeGuide(x) {
  if (resizeFrame) cancelAnimationFrame(resizeFrame)
  resizeFrame = requestAnimationFrame(() => {
    ensureResizeGuide().style.transform = `translateX(${Math.round(x)}px)`
    resizeFrame = null
  })
}

function clearResizeHover() {
  resizeHoverHeader?.classList.remove('nexus-resize-hover')
  resizeHoverHeader = null
}

function handleResizeHover(event) {
  if (document.body.classList.contains('nexus-table-resizing')) return
  const th = getResizeHeader(event)
  if (th === resizeHoverHeader) return
  clearResizeHover()
  if (th) {
    th.classList.add('nexus-resize-hover')
    resizeHoverHeader = th
  }
}

function startResizeFeedback(event) {
  const th = getResizeHeader(event)
  if (!th) return

  const table = th.closest('.el-table')
  const guide = ensureResizeGuide()
  if (table?.dataset?.nexusTableId) {
    document.getElementById(`${WIDTH_STYLE_ID_PREFIX}${table.dataset.nexusTableId}`)?.remove()
  }
  document.body.classList.add('nexus-table-resizing')
  table?.classList.add('nexus-table-resizing-active')
  th.classList.add('nexus-resize-active')
  guide.classList.add('is-active')
  updateResizeGuide(event.clientX)

  const onMove = moveEvent => updateResizeGuide(moveEvent.clientX)
  const onUp = () => {
    document.removeEventListener('mousemove', onMove, true)
    if (resizeFrame) {
      cancelAnimationFrame(resizeFrame)
      resizeFrame = null
    }
    document.body.classList.remove('nexus-table-resizing')
    table?.classList.remove('nexus-table-resizing-active')
    th.classList.remove('nexus-resize-active')
    clearResizeHover()
    guide.classList.remove('is-active')
    requestAnimationFrame(() => persistColumnWidths(table))
  }

  document.addEventListener('mousemove', onMove, true)
  document.addEventListener('mouseup', onUp, { once: true, capture: true })
}

function closeAllPanels() {
  closeOtherPanels(null)
}

function getControlHost(table) {
  const cardBody = table.closest('.el-card__body')
  const card = cardBody?.parentElement?.classList.contains('el-card')
    ? cardBody.parentElement
    : table.closest('.el-card')
  const header = card?.querySelector(':scope > .el-card__header .card-header')
  const tablesInCard = cardBody ? cardBody.querySelectorAll('.el-table').length : 0
  if (header && tablesInCard <= 1) return { host: header, placement: 'header' }
  return { host: table, placement: 'table' }
}

function removeControl(tableId, table) {
  document.querySelectorAll('.nexus-column-control').forEach(control => {
    if (control.dataset.tableId === tableId) control.remove()
  })
  table?.querySelector(':scope > .nexus-column-control')?.remove()
}

function removeEnhancement(table) {
  if (table.dataset.nexusTableId) {
    document.getElementById(`${STYLE_ID_PREFIX}${table.dataset.nexusTableId}`)?.remove()
    document.getElementById(`${WIDTH_STYLE_ID_PREFIX}${table.dataset.nexusTableId}`)?.remove()
    removeControl(table.dataset.nexusTableId, table)
  }
  table.querySelector(':scope > .nexus-column-control')?.remove()
  for (const className of [...table.classList]) {
    if (className.startsWith('nexus-table-')) table.classList.remove(className)
  }
  table.removeAttribute(ENHANCED_ATTR)
  delete table.dataset.nexusTableId
  delete table.dataset.nexusTableIndex
  delete table.dataset.nexusColumnSignature
  delete table.dataset.nexusColumnWidthKey
}

function createControl(table, tableId, cells, storageKey, visible, placement, widthKey) {
  const control = document.createElement('div')
  control.className = `nexus-column-control nexus-column-control--${placement}`
  control.dataset.tableId = tableId

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'nexus-column-button'
  button.title = '列设置'
  button.setAttribute('aria-label', '列设置')
  button.textContent = ''
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  icon.setAttribute('viewBox', '0 0 24 24')
  icon.setAttribute('aria-hidden', 'true')
  icon.setAttribute('focusable', 'false')
  const eyePath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  eyePath.setAttribute('d', 'M2.1 12s3.6-6.3 9.9-6.3S21.9 12 21.9 12s-3.6 6.3-9.9 6.3S2.1 12 2.1 12Z')
  const eyeCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  eyeCircle.setAttribute('cx', '12')
  eyeCircle.setAttribute('cy', '12')
  eyeCircle.setAttribute('r', '3')
  icon.append(eyePath, eyeCircle)
  button.appendChild(icon)

  const panel = document.createElement('div')
  panel.className = 'nexus-column-panel'

  const actions = document.createElement('div')
  actions.className = 'nexus-column-actions'

  const allButton = document.createElement('button')
  allButton.type = 'button'
  allButton.textContent = '全选'

  const resetButton = document.createElement('button')
  resetButton.type = 'button'
  resetButton.textContent = '默认'

  actions.append(allButton, resetButton)
  panel.appendChild(actions)

  const currentVisible = new Set(visible)
  for (const cell of cells) {
    const label = document.createElement('label')
    label.className = 'nexus-column-option'
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = currentVisible.has(cell.index)
    checkbox.addEventListener('change', () => {
      const next = cells
        .filter(item => panel.querySelector(`input[data-index="${item.index}"]`)?.checked)
        .map(item => item.index)
      const finalVisible = next.length ? next : [cell.index]
      saveVisible(storageKey, finalVisible)
      applyVisibility(table, tableId, cells, finalVisible)
      panel.querySelectorAll('input[type="checkbox"]').forEach(input => {
        input.checked = finalVisible.includes(Number(input.dataset.index))
      })
    })
    checkbox.dataset.index = String(cell.index)
    const span = document.createElement('span')
    span.textContent = cell.label
    label.append(checkbox, span)
    panel.appendChild(label)
  }

  allButton.addEventListener('click', () => {
    const all = cells.map(cell => cell.index)
    saveVisible(storageKey, all)
    panel.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = true })
    applyVisibility(table, tableId, cells, all)
  })

  resetButton.addEventListener('click', () => {
    const all = cells.map(cell => cell.index)
    localStorage.removeItem(storageKey)
    localStorage.removeItem(widthKey)
    panel.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = true })
    document.getElementById(`${WIDTH_STYLE_ID_PREFIX}${tableId}`)?.remove()
    applyVisibility(table, tableId, cells, all)
    table.__vueParentComponent?.proxy?.doLayout?.()
  })

  button.addEventListener('click', event => {
    event.stopPropagation()
    const willOpen = !panel.classList.contains('is-open')
    closeOtherPanels(willOpen ? panel : null)
    panel.classList.toggle('is-open', willOpen)
    if (willOpen) positionPanel(button, panel)
    else {
      panel.classList.remove('is-teleported')
      panel.removeAttribute('style')
    }
  })
  panel.addEventListener('click', event => event.stopPropagation())

  control.append(button, panel)
  return control
}

function mountControl(table, control, placementHost) {
  const { host, placement } = placementHost
  if (placement === 'header') {
    const title = host.querySelector(':scope > .card-title')
    if (title) title.appendChild(control)
    else host.appendChild(control)
    return
  }
  host.appendChild(control)
}

function enhanceTable(table, index) {
  const cells = getHeaderCells(table)
  if (!cells.length) return
  const signature = cells.map(cell => cell.label).join('|')
  if (table.getAttribute(ENHANCED_ATTR) === '1' && table.dataset.nexusColumnSignature === signature) return

  removeEnhancement(table)

  const tableId = `${Date.now()}_${tableSeq++}`
  table.classList.add(`nexus-table-${tableId}`)
  table.dataset.nexusTableId = tableId
  table.dataset.nexusTableIndex = String(index)
  table.dataset.nexusColumnSignature = signature
  table.setAttribute(ENHANCED_ATTR, '1')

  const storageKey = makeStorageKey(table, cells)
  const widthKey = makeWidthStorageKey(storageKey)
  const visible = loadVisible(storageKey, cells)
  const widths = loadColumnWidths(widthKey, cells)
  table.dataset.nexusColumnWidthKey = widthKey
  applyColumnWidths(table, tableId, cells, widths)
  applyVisibility(table, tableId, cells, visible)
  const placementHost = getControlHost(table)
  const control = createControl(table, tableId, cells, storageKey, visible, placementHost.placement, widthKey)
  mountControl(table, control, placementHost)
  requestAnimationFrame(() => {
    applyColumnWidths(table, tableId, cells, widths)
    table.__vueParentComponent?.proxy?.doLayout?.()
  })
}

function enhanceTables() {
  const tables = document.querySelectorAll('.el-table')
  if (isDashboardRoute()) {
    tables.forEach(removeEnhancement)
    return
  }
  tables.forEach((table, index) => enhanceTable(table, index))
}

export function installTableEnhancements() {
  if (typeof window === 'undefined') return
  if (installed) return
  installed = true

  const scheduleEnhance = () => {
    if (scheduled) return
    scheduled = true
    window.requestAnimationFrame(() => {
      scheduled = false
      enhanceTables()
    })
  }
  installTableEnhancements.scheduleEnhance = scheduleEnhance
  scheduleEnhance()
  window.addEventListener('hashchange', scheduleEnhance)
  window.addEventListener('resize', closeAllPanels)
  window.addEventListener('scroll', closeAllPanels, true)
  document.addEventListener('click', closeAllPanels)
  document.addEventListener('mousemove', handleResizeHover, true)
  document.addEventListener('mousedown', startResizeFeedback, true)

  observer = new MutationObserver(scheduleEnhance)
  observer.observe(document.body, { childList: true, subtree: true })
}

export function uninstallTableEnhancements() {
  const scheduleEnhance = installTableEnhancements.scheduleEnhance
  if (scheduleEnhance) {
    window.removeEventListener('hashchange', scheduleEnhance)
  }
  window.removeEventListener('resize', closeAllPanels)
  window.removeEventListener('scroll', closeAllPanels, true)
  document.removeEventListener('click', closeAllPanels)
  document.removeEventListener('mousemove', handleResizeHover, true)
  document.removeEventListener('mousedown', startResizeFeedback, true)
  observer?.disconnect()
  observer = null
  installed = false
  clearResizeHover()
  resizeGuide?.remove()
  resizeGuide = null
  document.body?.classList.remove('nexus-table-resizing')
}
