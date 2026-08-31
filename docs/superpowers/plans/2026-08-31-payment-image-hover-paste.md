# Payment Image Hover Paste Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route clipboard screenshots to the payment image dropzone currently under the mouse while preserving the dropzone's existing click-to-select and drag-and-drop behavior.

**Architecture:** Each `ImageGallery` instance tracks whether its editable dropzone is hovered and listens for page-level paste events only while mounted. A paste event is handled only by the hovered, editable, non-busy instance; all other instances return without preventing the event. Clipboard images continue through the existing `uploadFileList` path.

**Tech Stack:** Vue 3 Composition API, browser Mouse/Clipboard/DataTransfer/File APIs, Element Plus, Playwright.

---

## File Structure

- Modify `tests/payment-tracking/payment-tracking.spec.js`: dispatch paste on `window`, verify hover routing and mouse-leave cancellation, and retain a file-chooser assertion for click upload.
- Modify `src/components/payment-tracking/ImageGallery.vue`: track hover, register and remove the page paste listener, and retain all existing upload paths.

### Task 1: Define Hover-Routed Paste With Failing Tests

**Files:**
- Modify: `tests/payment-tracking/payment-tracking.spec.js`

- [ ] **Step 1: Change clipboard helpers to dispatch on the page and expose whether paste was handled**

```js
async function pasteClipboardImage(page, options = {}) {
  const file = {
    name: options.name ?? '',
    mimeType: options.mimeType || 'image/png',
    content: options.content || 'clipboard-image'
  }
  return page.evaluate(clipboardFile => {
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(new File(
      [clipboardFile.content],
      clipboardFile.name,
      { type: clipboardFile.mimeType }
    ))
    const event = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: dataTransfer
    })
    window.dispatchEvent(event)
    return event.defaultPrevented
  }, file)
}

async function pasteClipboardText(page, text) {
  return page.evaluate(value => {
    const dataTransfer = new DataTransfer()
    dataTransfer.setData('text/plain', value)
    const event = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: dataTransfer
    })
    window.dispatchEvent(event)
    return event.defaultPrevented
  }, text)
}
```

- [ ] **Step 2: Replace the existing selection paste test with hover-routing assertions**

```js
test('image dropzone pastes screenshots only while hovered and keeps click upload', async ({ page }) => {
  const uploads = []
  page.on('request', request => {
    if (request.method() === 'POST' && /\/api\/payment-tracking\/records\/111\/images\//.test(request.url())) {
      uploads.push(request)
    }
  })
  await page.goto('/#/payment-tracking/records/111/stages/selection')

  const detailGallery = page.locator('.image-gallery').filter({ hasText: '说明截图' })
  const dropzone = detailGallery.locator('.image-gallery-dropzone')

  const fileChooserPromise = page.waitForEvent('filechooser')
  await dropzone.click()
  await fileChooserPromise

  await page.mouse.move(0, 0)
  expect(await pasteClipboardImage(page)).toBe(false)
  expect(uploads).toHaveLength(0)

  await dropzone.hover()
  expect(await pasteClipboardImage(page)).toBe(true)
  await expect.poll(() => uploads.length).toBe(1)
  expect(new URL(uploads[0].url()).pathname).toBe('/api/payment-tracking/records/111/images/detail_screenshot')
  expect(uploads[0].postData()).toMatch(/filename="clipboard-\d+-1\.png"/)
  await expect(detailGallery).toContainText(/clipboard-\d+-1\.png/)

  expect(await pasteClipboardText(page, 'not an image')).toBe(false)
  expect(uploads).toHaveLength(1)

  await page.mouse.move(0, 0)
  expect(await pasteClipboardImage(page, { name: 'outside.png' })).toBe(false)
  expect(uploads).toHaveLength(1)
})
```

- [ ] **Step 3: Update the unsaved adjustment test to hover before page paste**

```js
const feedbackDropzone = newAdjustment.locator('.image-gallery-dropzone')
await feedbackDropzone.hover()
await pasteClipboardImage(page, { name: 'feedback-paste.png' })
```

Keep the existing waits and assertions proving the stage is saved first and the upload carries `adjustmentId`.

- [ ] **Step 4: Run focused tests and verify the old component fails the hover contract**

Run `npx playwright test --config=playwright.payment-tracking.config.js --grep "pastes screenshots only while hovered|第三阶段按链接状态"`.

Expected: the paste upload requests or handled-event assertions fail because the old component only listens for paste directly on the button.

### Task 2: Implement Hover-Routed Paste

**Files:**
- Modify: `src/components/payment-tracking/ImageGallery.vue`
- Test: `tests/payment-tracking/payment-tracking.spec.js`

- [ ] **Step 1: Track hover on the existing dropzone and keep click unchanged**

Replace the local paste binding with:

```vue
@mouseenter="pasteHovered = true"
@mouseleave="pasteHovered = false"
```

Keep `@click="fileInput?.click()"`, `@dragover.prevent`, and `@drop.prevent="handleDrop"` unchanged. Change the hint to:

```vue
<span>拖拽图片到此处、点击上传，或鼠标移入后粘贴截图</span>
```

- [ ] **Step 2: Register a lifecycle-safe page paste listener**

Change the Vue import and add hover state:

```js
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const pasteHovered = ref(false)
```

Guard `handlePaste` before reading the clipboard and let non-image events continue normally:

```js
async function handlePaste(event) {
  if (!pasteHovered.value || props.readonly || busy.value) return
  const timestamp = Date.now()
  const files = Array.from(event.clipboardData?.items || [])
    .filter(item => item.kind === 'file' && String(item.type || '').toLowerCase().startsWith('image/'))
    .map(item => item.getAsFile())
    .filter(Boolean)
    .map((file, index) => nameClipboardFile(file, timestamp, index))

  if (!files.length) return
  event.preventDefault()
  await uploadFileList(files)
}

onMounted(() => window.addEventListener('paste', handlePaste))
onBeforeUnmount(() => window.removeEventListener('paste', handlePaste))
```

- [ ] **Step 3: Run the focused tests**

Run `npx playwright test --config=playwright.payment-tracking.config.js --grep "pastes screenshots only while hovered|第三阶段按链接状态"`.

Expected: 4 tests pass across the `desktop` and `compact-desktop` projects.

- [ ] **Step 4: Run the complete payment-tracking suite**

Run `npm run test:payment-tracking`.

Expected: all 34 payment-tracking tests pass in both configured projects.

- [ ] **Step 5: Review and commit only the adjustment**

Run:

```powershell
git diff --check -- src/components/payment-tracking/ImageGallery.vue tests/payment-tracking/payment-tracking.spec.js
git diff -- src/components/payment-tracking/ImageGallery.vue tests/payment-tracking/payment-tracking.spec.js
```

Then commit:

```powershell
git add -- src/components/payment-tracking/ImageGallery.vue tests/payment-tracking/payment-tracking.spec.js
git commit -m "fix: paste payment images by hover target"
```

### Task 3: Verify the Running Local Frontend

**Files:**
- No source changes.

- [ ] **Step 1: Verify local services and the hot-loaded module without building**

Run:

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:18632/api/health' -TimeoutSec 5
curl.exe -s -o NUL -w '%{http_code}' 'http://127.0.0.1:5173/'
```

Expected: backend health is `code: 0`; frontend returns HTTP `200`. Do not run a build or packaging command.

- [ ] **Step 2: Confirm local-only Git state**

Run `git log -3 --oneline` and `git status --short`.

Expected: the design, plan, and implementation commits are local; unrelated pre-existing changes remain untouched. Do not push.
