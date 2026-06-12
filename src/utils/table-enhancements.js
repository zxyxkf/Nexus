import { getUser } from '@/utils/auth'

const ENHANCED_ATTR = 'data-nexus-column-settings'
const STYLE_ID_PREFIX = 'nexus-table-columns-style-'
const WIDTH_STYLE_ID_PREFIX = 'nexus-table-widths-style-'
const STORAGE_PREFIX = 'nexus_table_columns_v2'
const LEGACY_STORAGE_PREFIX = 'nexus_table_columns'
const MIN_COLUMN_WIDTH = 40
const MAX_COLUMN_WIDTH = 1600

let tableSeq = 0
let observer = null
let scheduled = false
let installed = false
let resizeGuide = null
let resizeFrame = null
let resizeHoverHeader = null
let headerMouseDownInfo = null

function hashText(value) {
  const text = String(value || '')
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

function token(prefix, value, fallback = 'x') {
  const text = String(value || '').trim() || fallback
  const readable = text
    .replace(/\s+/g, '_')
    .replace(/[^\w-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || fallback
  return `${prefix}_${readable}_${hashText(text)}`
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)))
}

function parseJson(raw) {
  try {
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function stableHashOrPath() {
  const raw = window.location.hash || window.location.pathname || 'root'
  return (raw.split('?')[0] || raw || 'root')
}

function legacyRouteKey(raw = window.location.hash || window.location.pathname || 'root') {
  return (raw || 'root').replace(/[^\w-]+/g, '_')
}

function getRouteKey() {
  return token('route', stableHashOrPath())
}

function isDashboardRoute() {
  const hash = stableHashOrPath()
  return hash === '#/dashboard' || hash.startsWith('#/dashboard/')
}

function getUserKey() {
  return token('user', getRawUserKey())
}

function getRawUserKey() {
  const user = getUser()
  return String(user?.id || user?.username || 'guest')
}

function getTableColumns(table) {
  const states = table.__vueParentComponent?.proxy?.store?.states
  const leafColumns = states?.leafColumns?.value
  const columns = states?.columns?.value
  return Array.isArray(leafColumns) && leafColumns.length
    ? leafColumns
    : (Array.isArray(columns) ? columns : [])
}

function getColumnBaseKey(column, label, index) {
  if (column?.columnKey) return token('ck', column.columnKey)
  if (column?.property) return token('prop', column.property)
  if (column?.prop) return token('prop', column.prop)
  if (column?.type && column.type !== 'default') return token('type', column.type)
  if (label) return token('label', label)
  return token('index', index + 1)
}

function makeUniqueCellKeys(cells) {
  const counts = new Map()
  return cells.map(cell => {
    const count = (counts.get(cell.baseKey) || 0) + 1
    counts.set(cell.baseKey, count)
    return {
      ...cell,
      key: count === 1 ? cell.baseKey : `${cell.baseKey}__${count}`
    }
  })
}

function getHeaderCells(table) {
  const rows = table.querySelectorAll('.el-table__header-wrapper thead tr')
  const row = rows[rows.length - 1]
  if (!row) return []

  const columns = getTableColumns(table)
  const rawCells = Array.from(row.querySelectorAll('th')).map((th, index) => {
    const column = columns[index]
    const label = (th.querySelector('.cell')?.textContent || column?.label || `Column ${index + 1}`).trim()
    const columnClass = Array.from(th.classList).find(className => /^el-table_\d+_column_\d+$/.test(className))
    return {
      index: index + 1,
      label: label || `Column ${index + 1}`,
      columnClass,
      baseKey: getColumnBaseKey(column, label, index)
    }
  })

  return makeUniqueCellKeys(rawCells)
}

function textContent(element) {
  return element?.textContent?.replace(/\s+/g, ' ').trim() || ''
}

function getTabContext(table) {
  const pane = table.closest('.el-tab-pane')
  if (!pane) return ''

  const labelledBy = pane.getAttribute('aria-labelledby')
  const label = labelledBy ? textContent(document.getElementById(labelledBy)) : ''
  if (label) return label

  const id = pane.getAttribute('id')
  if (id?.startsWith('pane-')) return id.slice(5)
  return id || ''
}

function getCardTitle(table) {
  const cardBody = table.closest('.el-card__body')
  const card = cardBody?.parentElement?.classList.contains('el-card')
    ? cardBody.parentElement
    : table.closest('.el-card')
  const title = card?.querySelector(':scope > .el-card__header .card-title')
  return textContent(title)
}

function getContextRoot(table) {
  return table.closest('.el-tab-pane') ||
    table.closest('.el-card__body') ||
    table.closest('.page-container') ||
    document.querySelector('.layout-main') ||
    document.body
}

function getLocalTableIndex(table) {
  const root = getContextRoot(table)
  const tables = Array.from(root.querySelectorAll('.el-table'))
  const index = tables.indexOf(table)
  return index >= 0 ? index : 0
}

function getTableContextKey(table) {
  if (table.dataset.nexusColumnKey) {
    return token('custom', table.dataset.nexusColumnKey)
  }

  const parts = []
  const tab = getTabContext(table)
  const title = getCardTitle(table)
  if (tab) parts.push(token('tab', tab))
  if (title) parts.push(token('card', title))
  parts.push(`table_${getLocalTableIndex(table)}`)
  return parts.join('_')
}

function legacyStorageKeyCandidates(table, cells, legacyIndex) {
  const userKey = getRawUserKey()
  const signature = cells.map(cell => cell.label).join('|').slice(0, 160)
  const rawHash = window.location.hash || window.location.pathname || 'root'
  const routeCandidates = unique([
    legacyRouteKey(rawHash),
    legacyRouteKey(stableHashOrPath())
  ])

  if (table.dataset.nexusColumnKey) {
    return [`${LEGACY_STORAGE_PREFIX}_${userKey}_${table.dataset.nexusColumnKey}`]
  }

  return routeCandidates.map(routeKey =>
    `${LEGACY_STORAGE_PREFIX}_${userKey}_${routeKey}_${legacyIndex || 0}_${signature}`
  )
}

function makeStorageInfo(table, cells, legacyIndex) {
  const storageKey = `${STORAGE_PREFIX}_${getUserKey()}_${getRouteKey()}_${getTableContextKey(table)}`
  const widthKey = `${storageKey}_widths`
  const sortKey = `${storageKey}_sort`
  const legacyKeys = legacyStorageKeyCandidates(table, cells, legacyIndex)
  return {
    storageKey,
    widthKey,
    sortKey,
    legacyKeys,
    legacyWidthKeys: legacyKeys.map(key => `${key}_widths`)
  }
}

function getCellKeyForStoredValue(value, cells) {
  const validKeys = new Set(cells.map(cell => cell.key))
  const text = String(value)
  if (validKeys.has(text)) return text

  const legacyIndex = Number(value)
  if (Number.isInteger(legacyIndex) && legacyIndex >= 1 && legacyIndex <= cells.length) {
    return cells[legacyIndex - 1]?.key
  }

  return ''
}

function normalizeVisible(value, cells) {
  const all = cells.map(cell => cell.key)
  if (!Array.isArray(value)) return all

  const visible = unique(value.map(item => getCellKeyForStoredValue(item, cells)))
  return visible.length ? visible : all
}

function readStoredValue(keys) {
  for (const key of keys) {
    const raw = localStorage.getItem(key)
    if (raw !== null) return { key, value: parseJson(raw) }
  }
  return { key: '', value: null }
}

function saveVisible(key, visible) {
  localStorage.setItem(key, JSON.stringify(visible))
}

function loadVisible(storageInfo, cells) {
  const stored = readStoredValue([storageInfo.storageKey])
  if (stored.key) return normalizeVisible(stored.value, cells)

  const legacy = readStoredValue(storageInfo.legacyKeys)
  if (!legacy.key) return cells.map(cell => cell.key)

  const visible = normalizeVisible(legacy.value, cells)
  saveVisible(storageInfo.storageKey, visible)
  return visible
}

function normalizeColumnWidths(value, cells) {
  if (!value || typeof value !== 'object') return {}

  const widths = {}
  for (const [storedKey, rawWidth] of Object.entries(value)) {
    const cellKey = getCellKeyForStoredValue(storedKey, cells)
    const width = Math.round(Number(rawWidth))
    if (!cellKey || !Number.isFinite(width) || width < MIN_COLUMN_WIDTH || width > MAX_COLUMN_WIDTH) continue
    widths[cellKey] = width
  }
  return widths
}

function saveColumnWidths(key, widths) {
  localStorage.setItem(key, JSON.stringify(widths))
}

function loadColumnWidths(storageInfo, cells) {
  const stored = readStoredValue([storageInfo.widthKey])
  if (stored.key) return normalizeColumnWidths(stored.value, cells)

  const legacy = readStoredValue(storageInfo.legacyWidthKeys)
  if (!legacy.key) return {}

  const widths = normalizeColumnWidths(legacy.value, cells)
  if (Object.keys(widths).length) saveColumnWidths(storageInfo.widthKey, widths)
  return widths
}

function getColumnPropForCell(table, cell) {
  const column = getTableColumns(table)[cell.index - 1]
  return String(column?.property || column?.prop || '')
}

function getCellForColumnProp(table, prop, cells) {
  if (!prop) return null
  return cells.find(cell => getColumnPropForCell(table, cell) === prop) || null
}

function getCellForSortInfo(table, sortInfo, cells) {
  if (!sortInfo || typeof sortInfo !== 'object') return null
  if (sortInfo.columnKey) {
    const direct = cells.find(cell => cell.key === sortInfo.columnKey)
    if (direct) return direct
  }
  return getCellForColumnProp(table, sortInfo.prop, cells)
}

function normalizeSortInfo(table, value, cells) {
  if (!value || typeof value !== 'object') return null
  const order = value.order === 'ascending' || value.order === 'descending' ? value.order : ''
  if (!order) return null
  const cell = getCellForSortInfo(table, value, cells)
  if (!cell) return null
  const prop = getColumnPropForCell(table, cell)
  if (!prop) return null
  return { prop, order, columnKey: cell.key }
}

function loadSortInfo(storageInfo, table, cells) {
  if (!storageInfo?.sortKey) return null
  const stored = readStoredValue([storageInfo.sortKey])
  if (!stored.key) return null
  return normalizeSortInfo(table, stored.value, cells)
}

function saveSortInfo(storageInfo, sortInfo) {
  if (!storageInfo?.sortKey) return
  if (!sortInfo?.prop || !sortInfo?.order) {
    localStorage.removeItem(storageInfo.sortKey)
    return
  }
  localStorage.setItem(storageInfo.sortKey, JSON.stringify(sortInfo))
}

function persistSortInfo(table, eventPayload = null) {
  const storageInfo = storageInfoFromDataset(table)
  if (!storageInfo) return
  const cells = getHeaderCells(table)
  if (!cells.length) return

  const prop = eventPayload?.prop || table.__vueParentComponent?.proxy?.store?.states?.sortProp?.value || ''
  const order = eventPayload?.order || table.__vueParentComponent?.proxy?.store?.states?.sortOrder?.value || ''
  if (!prop || !order) {
    saveSortInfo(storageInfo, null)
    table.__nexusAppliedSortSignature = ''
    return
  }

  const cell = getCellForColumnProp(table, prop, cells)
  const sortInfo = cell ? { prop, order, columnKey: cell.key } : { prop, order }
  saveSortInfo(storageInfo, sortInfo)
  table.__nexusAppliedSortSignature = `${sortInfo.prop}:${sortInfo.order}`
}

function applySortInfo(table, sortInfo) {
  if (!sortInfo?.prop || !sortInfo?.order) return
  const signature = `${sortInfo.prop}:${sortInfo.order}`
  if (table.__nexusAppliedSortSignature === signature) return
  table.__nexusAppliedSortSignature = signature
  const tableProxy = table.__vueParentComponent?.proxy
  requestAnimationFrame(() => {
    tableProxy?.sort?.(sortInfo.prop, sortInfo.order)
  })
}

function storageInfoFromDataset(table) {
  const storageKey = table?.dataset?.nexusColumnStorageKey
  const widthKey = table?.dataset?.nexusColumnWidthKey
  const sortKey = table?.dataset?.nexusColumnSortKey
  if (!storageKey || !widthKey) return null
  return {
    storageKey,
    widthKey,
    sortKey: sortKey || `${storageKey}_sort`,
    legacyKeys: (table.dataset.nexusLegacyColumnKeys || '').split('\n').filter(Boolean),
    legacyWidthKeys: (table.dataset.nexusLegacyColumnWidthKeys || '').split('\n').filter(Boolean)
  }
}

function removeStorageKeys(storageInfo) {
  for (const key of [
    storageInfo.storageKey,
    storageInfo.widthKey,
    storageInfo.sortKey,
    ...storageInfo.legacyKeys,
    ...storageInfo.legacyWidthKeys
  ].filter(Boolean)) {
    localStorage.removeItem(key)
  }
}

function escapeSelectorValue(value) {
  return window.CSS?.escape ? window.CSS.escape(value) : String(value).replace(/["\\]/g, '\\$&')
}

function escapeAttributeValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function getTableScopeSelectors(tableId) {
  return [
    `[data-nexus-table-id="${escapeAttributeValue(tableId)}"]`,
    `.nexus-table-${tableId}`
  ]
}

function readColumnWidths(table, cells) {
  const domWidths = readDomColumnWidths(table, cells)
  if (Object.keys(domWidths).length) return domWidths

  const columns = getTableColumns(table)
  if (Array.isArray(columns) && columns.length) {
    const stateWidths = Object.fromEntries(
      cells
        .map(cell => {
          const column = columns[cell.index - 1]
          return [cell.key, Math.round(Number(column?.realWidth || column?.width || 0))]
        })
        .filter(([, width]) => Number.isFinite(width) && width >= MIN_COLUMN_WIDTH && width <= MAX_COLUMN_WIDTH)
    )
    if (Object.keys(stateWidths).length) return stateWidths
  }

  const rows = table.querySelectorAll('.el-table__header-wrapper thead tr')
  const row = rows[rows.length - 1]
  if (!row) return {}
  const headers = Array.from(row.querySelectorAll('th'))
  return Object.fromEntries(
    cells
      .map(cell => [cell.key, Math.round(headers[cell.index - 1]?.getBoundingClientRect().width || 0)])
      .filter(([, width]) => Number.isFinite(width) && width >= MIN_COLUMN_WIDTH && width <= MAX_COLUMN_WIDTH)
  )
}

function readColumnWidthsFromState(table, cells) {
  const columns = getTableColumns(table)
  if (!Array.isArray(columns) || !columns.length) return {}

  return Object.fromEntries(
    cells
      .map(cell => {
        const column = columns[cell.index - 1]
        return [cell.key, Math.round(Number(column?.realWidth || column?.width || 0))]
      })
      .filter(([, width]) => Number.isFinite(width) && width >= MIN_COLUMN_WIDTH && width <= MAX_COLUMN_WIDTH)
  )
}

function readDomColumnWidths(table, cells) {
  const rows = table.querySelectorAll('.el-table__header-wrapper thead tr')
  const row = rows[rows.length - 1]
  const headers = row ? Array.from(row.querySelectorAll('th')) : []

  return Object.fromEntries(
    cells
      .map(cell => [cell.key, readDomColumnWidth(table, cell, headers)])
      .filter(([, width]) => Number.isFinite(width) && width >= MIN_COLUMN_WIDTH && width <= MAX_COLUMN_WIDTH)
  )
}

function readDomColumnWidth(table, cell, headers) {
  const widths = []

  if (cell.columnClass) {
    const columnName = escapeAttributeValue(cell.columnClass)
    table.querySelectorAll(`colgroup col[name="${columnName}"]`).forEach(col => {
      const attrWidth = Math.round(Number(col.getAttribute('width') || 0))
      const styleWidth = Math.round(Number(String(col.style.width || '').replace('px', '')) || 0)
      const rectWidth = Math.round(col.getBoundingClientRect?.().width || 0)
      widths.push(attrWidth, styleWidth, rectWidth)
    })

    const columnClass = escapeSelectorValue(cell.columnClass)
    table.querySelectorAll(`.el-table__header-wrapper .${columnClass}`).forEach(header => {
      widths.push(Math.round(header.getBoundingClientRect().width || 0))
    })
  }

  const header = headers[cell.index - 1]
  if (header) widths.push(Math.round(header.getBoundingClientRect().width || 0))

  return widths.find(width => Number.isFinite(width) && width >= MIN_COLUMN_WIDTH && width <= MAX_COLUMN_WIDTH) || 0
}

function readDefaultColumnState(table, cells) {
  const columns = getTableColumns(table)
  if (!Array.isArray(columns) || !columns.length) return {}

  return Object.fromEntries(
    cells.map(cell => {
      const column = columns[cell.index - 1]
      return [cell.key, {
        width: column?.width,
        minWidth: column?.minWidth
      }]
    })
  )
}

function restoreDefaultColumnState(table, cells) {
  const columns = getTableColumns(table)
  const defaults = table.__nexusDefaultColumnState || {}
  if (!Array.isArray(columns) || !columns.length) return

  cells.forEach(cell => {
    const column = columns[cell.index - 1]
    const state = defaults[cell.key]
    if (!column || !state) return
    column.width = state.width
    column.minWidth = state.minWidth
    column.realWidth = undefined
  })
  table.__vueParentComponent?.proxy?.doLayout?.()
  requestAnimationFrame(() => {
    table.__vueParentComponent?.proxy?.doLayout?.()
  })
}

function syncTableColumnState(table, cells, widths, persistAsColumnWidth = false) {
  const columns = getTableColumns(table)
  if (!Array.isArray(columns)) return false
  let changed = false
  cells.forEach(cell => {
    const width = widths[cell.key]
    const column = columns[cell.index - 1]
    if (!column || !Number.isFinite(width) || width < MIN_COLUMN_WIDTH || width > MAX_COLUMN_WIDTH) return
    if (persistAsColumnWidth) column.width = width
    column.realWidth = width
    changed = true
  })
  if (changed) table.__vueParentComponent?.proxy?.doLayout?.()
  return changed
}

function getColumnWidthSelectors(tableId, cell) {
  const scopeSelectors = getTableScopeSelectors(tableId)
  return scopeSelectors.flatMap(scope => {
    const indexSelectors = [
      `${scope} .el-table__header-wrapper th:nth-child(${cell.index})`,
      `${scope} .el-table__body-wrapper td:nth-child(${cell.index})`,
      `${scope} .el-table__footer-wrapper td:nth-child(${cell.index})`,
      `${scope} colgroup col:nth-child(${cell.index})`,
      `${scope} .el-table__fixed th:nth-child(${cell.index})`,
      `${scope} .el-table__fixed td:nth-child(${cell.index})`,
      `${scope} .el-table__fixed-right th:nth-child(${cell.index})`,
      `${scope} .el-table__fixed-right td:nth-child(${cell.index})`
    ]
    if (!cell.columnClass) return indexSelectors
    const columnClass = escapeSelectorValue(cell.columnClass)
    const columnName = escapeAttributeValue(cell.columnClass)
    return [
      `${scope} .${columnClass}`,
      `${scope} col[name="${columnName}"]`,
      ...indexSelectors
    ]
  })
}

function applyColumnWidths(table, tableId, cells, widths, persistAsColumnWidth = false, visible = null) {
  let style = document.getElementById(`${WIDTH_STYLE_ID_PREFIX}${tableId}`)
  if (!style) {
    style = document.createElement('style')
    style.id = `${WIDTH_STYLE_ID_PREFIX}${tableId}`
    document.head.appendChild(style)
  }

  const visibleSet = visible ? new Set(visible) : null
  const rules = cells.flatMap(cell => {
    if (visibleSet && !visibleSet.has(cell.key)) return []
    const width = Math.round(Number(widths[cell.key]))
    if (!Number.isFinite(width) || width < MIN_COLUMN_WIDTH || width > MAX_COLUMN_WIDTH) return []
    const selectors = getColumnWidthSelectors(tableId, cell)
    return `${selectors.join(',')}{width:${width}px!important;min-width:${width}px!important;max-width:${width}px!important;}`
  })
  style.textContent = rules.join('\n')

  if (!document.body.classList.contains('nexus-table-resizing') && !table.__nexusResizePending) {
    syncTableColumnState(table, cells, widths, persistAsColumnWidth)
  }
}

function persistColumnWidths(table) {
  const storageInfo = storageInfoFromDataset(table)
  if (!storageInfo) return
  const cells = getHeaderCells(table)
  if (!cells.length) return
  const widths = readColumnWidths(table, cells)
  if (!Object.keys(widths).length) return
  saveColumnWidths(storageInfo.widthKey, { ...loadColumnWidths(storageInfo, cells), ...widths })
}

function persistColumnWidthsFromState(table) {
  const storageInfo = storageInfoFromDataset(table)
  if (!storageInfo) return
  const cells = getHeaderCells(table)
  if (!cells.length) return
  const widths = readColumnWidthsFromState(table, cells)
  if (!Object.keys(widths).length) return
  saveColumnWidths(storageInfo.widthKey, { ...loadColumnWidths(storageInfo, cells), ...widths })
  reapplyTablePreferences(table, cells)
}

function bindTableEvents(table) {
  const instance = table.__vueParentComponent
  if (!instance || instance.__nexusColumnEmitWrapped) return

  const originalEmit = instance.emit?.bind(instance)
  if (typeof originalEmit !== 'function') return

  instance.__nexusOriginalEmit = instance.emit
  instance.emit = (eventName, ...args) => {
    const result = originalEmit(eventName, ...args)
    if (eventName === 'header-dragend') {
      requestAnimationFrame(() => {
        persistColumnWidthsFromState(table)
      })
    }
    if (eventName === 'sort-change') {
      persistSortInfo(table, args[0])
    }
    return result
  }
  instance.__nexusColumnEmitWrapped = true
}

function unbindTableEvents(table) {
  const instance = table.__vueParentComponent
  if (!instance?.__nexusColumnEmitWrapped) return
  if (instance.__nexusOriginalEmit) {
    instance.emit = instance.__nexusOriginalEmit
  }
  delete instance.__nexusOriginalEmit
  delete instance.__nexusColumnEmitWrapped
}

function schedulePersistColumnWidths(table) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      persistColumnWidths(table)
      if (table) table.__nexusResizePending = false
      const cells = table ? getHeaderCells(table) : []
      if (table && cells.length) reapplyTablePreferences(table, cells)
    })
  })
}

function applyVisibility(table, tableId, cells, visible) {
  const visibleSet = new Set(visible)
  const hiddenCells = cells.filter(cell => !visibleSet.has(cell.key))
  let style = document.getElementById(`${STYLE_ID_PREFIX}${tableId}`)
  if (!style) {
    style = document.createElement('style')
    style.id = `${STYLE_ID_PREFIX}${tableId}`
    document.head.appendChild(style)
  }

  if (!hiddenCells.length) {
    style.textContent = ''
    table.__vueParentComponent?.proxy?.doLayout?.()
    return
  }

  const scopeSelectors = getTableScopeSelectors(tableId)
  const selectors = hiddenCells.flatMap(cell => scopeSelectors.flatMap(scope => {
    const indexSelectors = [
      `${scope} .el-table__header-wrapper th:nth-child(${cell.index})`,
      `${scope} .el-table__body-wrapper td:nth-child(${cell.index})`,
      `${scope} .el-table__footer-wrapper td:nth-child(${cell.index})`,
      `${scope} colgroup col:nth-child(${cell.index})`,
      `${scope} .el-table__fixed th:nth-child(${cell.index})`,
      `${scope} .el-table__fixed td:nth-child(${cell.index})`,
      `${scope} .el-table__fixed-right th:nth-child(${cell.index})`,
      `${scope} .el-table__fixed-right td:nth-child(${cell.index})`
    ]
    if (!cell.columnClass) return indexSelectors
    const columnClass = escapeSelectorValue(cell.columnClass)
    const columnName = escapeAttributeValue(cell.columnClass)
    return [
      `${scope} .${columnClass}`,
      `${scope} col[name="${columnName}"]`,
      ...indexSelectors
    ]
  }))
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
  const th = event.target?.closest?.('.el-table__header-wrapper th.el-table__cell')
  if (!th) return null
  const rect = th.getBoundingClientRect()
  const distance = rect.right - event.clientX
  return rect.width > 12 && distance >= 0 && distance < 16 ? th : null
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
  const headerTable = event.target?.closest?.('.el-table__header-wrapper')?.closest?.('.el-table') || null
  if (headerTable) {
    const cells = getHeaderCells(headerTable)
    headerMouseDownInfo = {
      table: headerTable,
      widths: readDomColumnWidths(headerTable, cells)
    }
  } else {
    headerMouseDownInfo = null
  }
  const th = getResizeHeader(event)
  if (!th) return

  const table = th.closest('.el-table')
  if (!table?.dataset?.nexusColumnWidthKey) return
  const guide = ensureResizeGuide()
  const startWidth = Math.round(th.getBoundingClientRect().width || 0)
  if (table) table.__nexusResizePending = true
  if (table?.dataset?.nexusTableId) {
    document.getElementById(`${WIDTH_STYLE_ID_PREFIX}${table.dataset.nexusTableId}`)?.remove()
  }
  document.body.classList.add('nexus-table-resizing')
  table?.classList.add('nexus-table-resizing-active')
  th.classList.add('nexus-resize-active')
  guide.classList.add('is-active')
  updateResizeGuide(event.clientX)

  const onMove = moveEvent => {
    const delta = Math.round(moveEvent.clientX - event.clientX)
    if (Math.abs(delta) >= 1) table.__nexusLastResizeDelta = delta
    updateResizeGuide(moveEvent.clientX)
  }
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
    if (table.__nexusLastResizeDelta) {
      const cells = getHeaderCells(table)
      const cell = cells.find(item => item.columnClass && th.classList.contains(item.columnClass)) ||
        cells[Array.from(th.parentElement?.children || []).indexOf(th)]
      const widthKey = table.dataset.nexusColumnWidthKey
      if (cell && widthKey) {
        const currentWidths = loadColumnWidths({
          storageKey: table.dataset.nexusColumnStorageKey,
          widthKey,
          legacyKeys: (table.dataset.nexusLegacyColumnKeys || '').split('\n').filter(Boolean),
          legacyWidthKeys: (table.dataset.nexusLegacyColumnWidthKeys || '').split('\n').filter(Boolean)
        }, cells)
        const nextWidth = Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(startWidth + table.__nexusLastResizeDelta)))
        saveColumnWidths(widthKey, { ...currentWidths, [cell.key]: nextWidth })
        applyColumnWidths(table, table.dataset.nexusTableId, cells, { ...currentWidths, [cell.key]: nextWidth }, true, loadVisible({
          storageKey: table.dataset.nexusColumnStorageKey,
          widthKey,
          legacyKeys: (table.dataset.nexusLegacyColumnKeys || '').split('\n').filter(Boolean),
          legacyWidthKeys: (table.dataset.nexusLegacyColumnWidthKeys || '').split('\n').filter(Boolean)
        }, cells))
      }
    }
    delete table.__nexusLastResizeDelta
    schedulePersistColumnWidths(table)
  }

  document.addEventListener('mousemove', onMove, true)
  document.addEventListener('mouseup', onUp, { once: true, capture: true })
}

function persistAfterHeaderMouseUp(event) {
  if (!headerMouseDownInfo) return
  const { table, widths: beforeWidths } = headerMouseDownInfo
  headerMouseDownInfo = null
  if (event.target?.closest?.('.nexus-column-control')) return
  const cells = getHeaderCells(table)
  const afterWidths = readDomColumnWidths(table, cells)
  const changed = cells.some(cell => {
    const before = beforeWidths[cell.key]
    const after = afterWidths[cell.key]
    return Number.isFinite(before) && Number.isFinite(after) && Math.abs(after - before) >= 2
  })
  if (!changed) return
  schedulePersistColumnWidths(table)
}

function closeAllPanels() {
  closeOtherPanels(null)
}

function persistCurrentTables() {
  document.querySelectorAll(`.el-table[${ENHANCED_ATTR}="1"]`).forEach(table => {
    persistSortInfo(table)
  })
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
  unbindTableEvents(table)
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
  delete table.dataset.nexusColumnStorageKey
  delete table.dataset.nexusColumnWidthKey
  delete table.dataset.nexusColumnSortKey
  delete table.dataset.nexusLegacyColumnKeys
  delete table.dataset.nexusLegacyColumnWidthKeys
  delete table.__nexusDefaultColumnWidths
  delete table.__nexusDefaultColumnState
  delete table.__nexusResizePending
  delete table.__nexusAppliedSortSignature
}

function createControl(table, tableId, cells, storageInfo, visible, placement) {
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
    checkbox.checked = currentVisible.has(cell.key)
    checkbox.dataset.key = cell.key
    checkbox.addEventListener('change', () => {
      const next = cells
        .filter(item => panel.querySelector(`input[data-key="${escapeAttributeValue(item.key)}"]`)?.checked)
        .map(item => item.key)
      const finalVisible = next.length ? next : [cell.key]
      saveVisible(storageInfo.storageKey, finalVisible)
      applyColumnWidths(table, tableId, cells, loadColumnWidths(storageInfo, cells), true, finalVisible)
      applyVisibility(table, tableId, cells, finalVisible)
      panel.querySelectorAll('input[type="checkbox"]').forEach(input => {
        input.checked = finalVisible.includes(input.dataset.key)
      })
    })
    const span = document.createElement('span')
    span.textContent = cell.label
    label.append(checkbox, span)
    panel.appendChild(label)
  }

  allButton.addEventListener('click', () => {
    const all = cells.map(cell => cell.key)
    saveVisible(storageInfo.storageKey, all)
    panel.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = true })
    applyColumnWidths(table, tableId, cells, loadColumnWidths(storageInfo, cells), true, all)
    applyVisibility(table, tableId, cells, all)
  })

  resetButton.addEventListener('click', () => {
    const all = cells.map(cell => cell.key)
    removeStorageKeys(storageInfo)
    table.__nexusAppliedSortSignature = ''
    panel.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = true })
    document.getElementById(`${WIDTH_STYLE_ID_PREFIX}${tableId}`)?.remove()
    restoreDefaultColumnState(table, cells)
    table.__vueParentComponent?.proxy?.clearSort?.()
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

function ensureControlMounted(table, cells, storageInfo, visible) {
  const tableId = table.dataset.nexusTableId
  if (!tableId || !storageInfo?.storageKey || !storageInfo?.widthKey) return
  if (document.querySelector(`.nexus-column-control[data-table-id="${escapeSelectorValue(tableId)}"]`)) return
  const placementHost = getControlHost(table)
  const control = createControl(table, tableId, cells, storageInfo, visible, placementHost.placement)
  mountControl(table, control, placementHost)
}

function reapplyTablePreferences(table, cells) {
  const tableId = table.dataset.nexusTableId
  const storageKey = table.dataset.nexusColumnStorageKey
  const widthKey = table.dataset.nexusColumnWidthKey
  if (!tableId || !storageKey || !widthKey) return

  const storageInfo = {
    storageKey,
    widthKey,
    legacyKeys: (table.dataset.nexusLegacyColumnKeys || '').split('\n').filter(Boolean),
    legacyWidthKeys: (table.dataset.nexusLegacyColumnWidthKeys || '').split('\n').filter(Boolean)
  }
  const visible = loadVisible(storageInfo, cells)
  const widths = loadColumnWidths(storageInfo, cells)
  const sortInfo = loadSortInfo(storageInfo, table, cells)
  applyColumnWidths(table, tableId, cells, widths, true, visible)
  applyVisibility(table, tableId, cells, visible)
  applySortInfo(table, sortInfo)
  ensureControlMounted(table, cells, storageInfo, visible)
}

function enhanceTable(table, index) {
  const cells = getHeaderCells(table)
  if (!cells.length) return
  const signature = cells.map(cell => cell.key).join('|')
  if (table.getAttribute(ENHANCED_ATTR) === '1' && table.dataset.nexusColumnSignature === signature) {
    reapplyTablePreferences(table, cells)
    return
  }

  removeEnhancement(table)

  const tableId = `${Date.now()}_${tableSeq++}`
  table.classList.add(`nexus-table-${tableId}`)
  table.dataset.nexusTableId = tableId
  table.dataset.nexusTableIndex = String(index)
  table.dataset.nexusColumnSignature = signature
  table.setAttribute(ENHANCED_ATTR, '1')

  const storageInfo = makeStorageInfo(table, cells, index)
  const visible = loadVisible(storageInfo, cells)
  const widths = loadColumnWidths(storageInfo, cells)
  const sortInfo = loadSortInfo(storageInfo, table, cells)
  table.__nexusDefaultColumnState = readDefaultColumnState(table, cells)
  bindTableEvents(table)
  table.dataset.nexusColumnStorageKey = storageInfo.storageKey
  table.dataset.nexusColumnWidthKey = storageInfo.widthKey
  table.dataset.nexusColumnSortKey = storageInfo.sortKey
  table.dataset.nexusLegacyColumnKeys = storageInfo.legacyKeys.join('\n')
  table.dataset.nexusLegacyColumnWidthKeys = storageInfo.legacyWidthKeys.join('\n')

  applyColumnWidths(table, tableId, cells, widths, true, visible)
  applyVisibility(table, tableId, cells, visible)
  applySortInfo(table, sortInfo)
  const placementHost = getControlHost(table)
  const control = createControl(table, tableId, cells, storageInfo, visible, placementHost.placement)
  mountControl(table, control, placementHost)
  requestAnimationFrame(() => {
    applyColumnWidths(table, tableId, cells, widths, true, visible)
    table.__vueParentComponent?.proxy?.doLayout?.()
    requestAnimationFrame(() => {
      applyColumnWidths(table, tableId, cells, widths, true, visible)
      table.__vueParentComponent?.proxy?.doLayout?.()
    })
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
  window.addEventListener('beforeunload', persistCurrentTables)
  window.addEventListener('hashchange', scheduleEnhance)
  window.addEventListener('hashchange', persistCurrentTables, true)
  window.addEventListener('resize', closeAllPanels)
  window.addEventListener('scroll', closeAllPanels, true)
  document.addEventListener('click', closeAllPanels)
  document.addEventListener('mousemove', handleResizeHover, true)
  document.addEventListener('mousedown', startResizeFeedback, true)
  document.addEventListener('mouseup', persistAfterHeaderMouseUp, true)

  observer = new MutationObserver(scheduleEnhance)
  observer.observe(document.body, { childList: true, subtree: true })
}

export function uninstallTableEnhancements() {
  const scheduleEnhance = installTableEnhancements.scheduleEnhance
  if (scheduleEnhance) {
    window.removeEventListener('hashchange', scheduleEnhance)
  }
  window.removeEventListener('beforeunload', persistCurrentTables)
  window.removeEventListener('hashchange', persistCurrentTables, true)
  window.removeEventListener('resize', closeAllPanels)
  window.removeEventListener('scroll', closeAllPanels, true)
  document.removeEventListener('click', closeAllPanels)
  document.removeEventListener('mousemove', handleResizeHover, true)
  document.removeEventListener('mousedown', startResizeFeedback, true)
  document.removeEventListener('mouseup', persistAfterHeaderMouseUp, true)
  observer?.disconnect()
  observer = null
  installed = false
  clearResizeHover()
  resizeGuide?.remove()
  resizeGuide = null
  document.body?.classList.remove('nexus-table-resizing')
}
