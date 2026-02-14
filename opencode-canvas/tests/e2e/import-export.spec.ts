import { expect, test } from '@playwright/test'

test('import source to canvas and export patched file', async ({ page }) => {
  await page.goto('/')

  const source = [
    "import React from 'react'",
    '',
    'export function TargetCanvas() {',
    '  return (',
    '    <div className="relative h-[1200px] w-[1600px]">',
    '      <div key="hero-e2e" className="absolute text-3xl" style={{ left: 18, top: 18, width: 360, minHeight: 72 }} data-node-type="text">E2E Imported Hero</div>',
    '    </div>',
    '  )',
    '}',
    '',
  ].join('\n')

  const sourceInput = page.getByLabel('Patch target source')
  await sourceInput.fill(source)
  await expect(sourceInput).toHaveValue(/hero-e2e/)

  await page.getByRole('button', { name: /Import.*Canvas/ }).click()

  await expect(page.getByText(/Imported 1 nodes from source\./)).toBeVisible()
  await expect(page.getByText('E2E Imported Hero').first()).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /^Export$/ }).click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toBe('generated-canvas-patch.tsx')
})
