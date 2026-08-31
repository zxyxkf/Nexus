# Payment Image Clipboard Paste Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow every editable payment-tracking image dropzone to upload screenshots pasted from the clipboard into that dropzone's existing image category.

**Architecture:** Keep clipboard handling inside the shared `ImageGallery.vue` component so every stage inherits identical behavior without page-level listeners. Convert clipboard image items to named `File` objects, then reuse the existing `uploadFileList` path so category ownership, adjustment preparation, version checks, API validation, and UI refresh remain unchanged.

**Tech Stack:** Vue 3 Composition API, browser Clipboard/DataTransfer/File APIs, Element Plus, Playwright.

---

## File Structure

- Modify `src/components/payment-tracking/ImageGallery.vue`: add the focused-dropzone paste entry point, clipboard image extraction, fallback names, and updated affordance text.
- Modify `tests/payment-tracking/payment-tracking.spec.js`: dispatch browser clipboard events and verify category isolation, generated names, non-image rejection, and adjustment ownership.

### Task 1: Define Clipboard Upload Behavior With Failing Browser Tests

**Files:**
- Modify: `tests/payment-tracking/payment-tracking.spec.js`

- [ ] **Step 1: Add clipboard event helpers near the existing test helpers**

```js
async function pasteClipboardImage(locator, options = {}) {
  const file = {
    name: options.name ?? '',
    mimeType: options.mimeType || 'image/png',
    content: options.content || 'clipboard-image'
  }
  await locator.evaluate((element, clipboardFile) => {
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(new File(
      [clipboardFile.content],
      clipboardFile.name,
      { type: clipboardFile.mimeType }
    ))
    element.dispatchEvent(new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: dataTransfer
    }))
  }, file)
}

async function pasteClipboardText(locator, text) {
  await locator.evaluate((element, value) => {
    const dataTransfer = new DataTransfer()
    dataTransfer.setData('text/plain', value)
    element.dispatchEvent(new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: dataTransfer
    }))
  }, text)
}
```

- [ ] **Step 2: Add a test proving a focused selection upload box receives only its own screenshot category**

```js
test('image dropzone pastes clipboard screenshots into its own category only', async ({ page }) => {
  const uploads = []
  page.on('request', request => {
    if (request.method() === 'POST' && /\/api\/payment-tracking\/records\/111\/images\//.test(request.url())) {
      uploads.push(request)
    }
  })
  await page.goto('/#/payment-tracking/records/111/stages/selection')

  const detailGallery = page.locator('.image-gallery').filter({ hasText: '说明截图' })
  const dropzone = detailGallery.locator('.image-gallery-dropzone')
  await dropzone.click()
  await pasteClipboardImage(dropzone)

  await expect.poll(() => uploads.length).toBe(1)
  expect(new URL(uploads[0].url()).pathname).toBe('/api/payment-tracking/records/111/images/detail_screenshot')
  expect(uploads[0].postData()).toMatch(/filename="clipboard-\d+-1\.png"/)
  await expect(detailGallery).toContainText(/clipboard-\d+-1\.png/)

  await pasteClipboardText(dropzone, 'not an image')
  await expect(page.getByText('剪贴板中没有图片')).toBeVisible()
  expect(uploads).toHaveLength(1)
})
```

- [ ] **Step 3: Change the unsaved adjustment upload step to paste a named screenshot**

Replace the existing `setInputFiles` call in `第三阶段按链接状态分支并隔离每次数据反馈` with:

```js
  const feedbackDropzone = newAdjustment.locator('.image-gallery-dropzone')
  await feedbackDropzone.click()
  await pasteClipboardImage(feedbackDropzone, { name: 'feedback-paste.png' })
```

Keep the existing `stageSave` and `imageUpload` request waits. Change the filename assertion to:

```js
  expect(uploadRequest.postData()).toContain('name="adjustmentId"')
  await expect(newAdjustment).toContainText('feedback-paste.png')
```

- [ ] **Step 4: Run the focused tests and verify they fail before implementation**

Run `npx playwright test --config=playwright.payment-tracking.config.js --grep "image dropzone pastes|第三阶段按链接状态"`.

Expected: the new clipboard upload requests time out or the new image assertion fails because `ImageGallery.vue` does not yet handle `paste`.

### Task 2: Implement Focused Dropzone Clipboard Upload

**Files:**
- Modify: `src/components/payment-tracking/ImageGallery.vue`
- Test: `tests/payment-tracking/payment-tracking.spec.js`

- [ ] **Step 1: Bind paste to the existing editable dropzone and update its visible hint**

Add `@paste="handlePaste"` beside the existing click/drop handlers and change the primary hint to:

```vue
<span>拖拽图片到此处、点击上传，或点击后粘贴截图</span>
```

- [ ] **Step 2: Add minimal clipboard extraction and fallback naming**

```js
const CLIPBOARD_EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif'
}

function nameClipboardFile(file, timestamp, index) {
  if (String(file.name || '').trim()) return file
  const mimeType = String(file.type || 'image/png').toLowerCase()
  const extension = CLIPBOARD_EXTENSIONS[mimeType] || 'png'
  return new File(
    [file],
    `clipboard-${timestamp}-${index + 1}.${extension}`,
    { type: mimeType, lastModified: file.lastModified || timestamp }
  )
}

async function handlePaste(event) {
  if (busy.value) return
  const timestamp = Date.now()
  const files = Array.from(event.clipboardData?.items || [])
    .filter(item => item.kind === 'file' && item.type?.toLowerCase().startsWith('image/'))
    .map(item => item.getAsFile())
    .filter(Boolean)
    .map((file, index) => nameClipboardFile(file, timestamp, index))

  if (!files.length) {
    ElMessage.warning('剪贴板中没有图片')
    return
  }
  event.preventDefault()
  await uploadFileList(files)
}
```

Do not change `uploadFileList`, `beforeUpload`, category filtering, API calls, delete, sort, or preview behavior.

- [ ] **Step 3: Run the focused clipboard tests**

Run `npx playwright test --config=playwright.payment-tracking.config.js --grep "image dropzone pastes|第三阶段按链接状态"`.

Expected: 4 tests pass because the two matching tests run in both configured desktop projects.

- [ ] **Step 4: Run the complete payment-tracking browser suite**

Run `npm run test:payment-tracking`.

Expected: all payment-tracking tests pass in both `desktop` and `compact-desktop` projects, with zero failures.

- [ ] **Step 5: Check the focused diff and whitespace**

Run:

```powershell
git diff --check -- src/components/payment-tracking/ImageGallery.vue tests/payment-tracking/payment-tracking.spec.js
git diff -- src/components/payment-tracking/ImageGallery.vue tests/payment-tracking/payment-tracking.spec.js
```

Expected: no whitespace errors; every changed line maps to clipboard paste behavior or its tests.

- [ ] **Step 6: Commit only the implementation and test**

```powershell
git add -- src/components/payment-tracking/ImageGallery.vue tests/payment-tracking/payment-tracking.spec.js
git commit -m "feat: paste screenshots into payment image fields"
```

### Task 3: Runtime Verification

**Files:**
- No source changes.

- [ ] **Step 1: Verify local services without building**

Run:

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:18632/api/health' -TimeoutSec 5
curl.exe -s -o NUL -w '%{http_code}' 'http://127.0.0.1:5173/'
```

Expected: backend returns `{ code: 0, msg: 'ok' }`; frontend returns HTTP `200`.

- [ ] **Step 2: Confirm local-only Git state**

Run:

```powershell
git log -2 --oneline
git status --short
```

Expected: the design, plan, and implementation commits exist only on the local branch; unrelated pre-existing worktree changes remain untouched. Do not run any build, package, or push command.
