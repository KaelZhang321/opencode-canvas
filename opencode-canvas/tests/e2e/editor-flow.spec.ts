import { expect, test } from '@playwright/test'

test.describe('Opencode Canvas E2E', () => {
  test('can add a text node from toolbar', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: '+ Text' }).click()
    await expect(page.getByRole('button', { name: /New Text/i })).toBeVisible()
  })

  test('can select and delete a layer', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Heading/i }).click()
    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByRole('button', { name: /Heading/i })).toHaveCount(0)
  })

  test('can generate full page from AI panel', async ({ page }) => {
    await page.goto('/')
    const panel = page
      .getByText('AI Refactor')
      .locator('xpath=ancestor::section[1]')
    await panel
      .locator('textarea')
      .first()
      .fill('Create a modern SaaS landing page with hero and CTA')
    const generateButton = panel.getByRole('button', { name: 'Generate Full Page' })
    await expect(generateButton).toBeEnabled()
    await generateButton.click()
    await expect(page.getByText(/Generated page:/i)).toBeVisible()
  })
})
