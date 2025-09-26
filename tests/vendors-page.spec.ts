import { test, expect } from '@playwright/test';

test.describe('Vendors Page', () => {
  test('should load vendors page and check for console errors', async ({ page }) => {
    // Capture console messages
    const consoleMessages: string[] = [];
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push(`[${msg.type()}] ${text}`);

      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    // Capture network errors
    const networkErrors: string[] = [];
    page.on('response', (response) => {
      if (!response.ok()) {
        networkErrors.push(`${response.status()} ${response.url()}`);
      }
    });

    // Navigate to vendors page
    await page.goto('http://localhost:8080/vendors');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Wait a bit for any async operations
    await page.waitForTimeout(3000);

    // Check if the page loaded properly
    const title = await page.title();
    console.log('Page title:', title);

    // Check for main vendors heading
    const heading = page.locator('h1, [class*="title"], [class*="heading"]');
    const headingText = await heading.first().textContent();
    console.log('Main heading:', headingText);

    // Look for any error messages on page
    const errorElements = page.locator('[class*="error"], [class*="alert"], .text-red-600, .text-destructive');
    const errorCount = await errorElements.count();
    if (errorCount > 0) {
      console.log('\n=== PAGE ERRORS ===');
      for (let i = 0; i < errorCount; i++) {
        const errorText = await errorElements.nth(i).textContent();
        console.log(`Error ${i + 1}: ${errorText}`);
      }
    }

    // Check for loading states
    const loadingElements = page.locator('[class*="loading"], [class*="spinner"], [class*="animate-spin"]');
    const loadingCount = await loadingElements.count();
    console.log('Loading elements count:', loadingCount);

    // Print all console messages
    if (consoleMessages.length > 0) {
      console.log('\n=== CONSOLE MESSAGES ===');
      consoleMessages.forEach((msg, i) => {
        console.log(`${i + 1}. ${msg}`);
      });
    }

    // Print console errors specifically
    if (consoleErrors.length > 0) {
      console.log('\n=== CONSOLE ERRORS ===');
      consoleErrors.forEach((error, i) => {
        console.log(`${i + 1}. ${error}`);
      });
    }

    // Print network errors
    if (networkErrors.length > 0) {
      console.log('\n=== NETWORK ERRORS ===');
      networkErrors.forEach((error, i) => {
        console.log(`${i + 1}. ${error}`);
      });
    }

    // Check if vendor components are present
    const vendorCards = page.locator('[data-testid="vendor-card"], .vendor-card, [class*="vendor"], [class*="card"]');
    const cardCount = await vendorCards.count();
    console.log('Vendor-related elements count:', cardCount);

    // Check for specific component errors
    const componentErrors = page.locator('text=Error, text=Failed, text=undefined, text=null');
    const componentErrorCount = await componentErrors.count();
    if (componentErrorCount > 0) {
      console.log('\n=== COMPONENT ERRORS ===');
      for (let i = 0; i < componentErrorCount; i++) {
        const errorText = await componentErrors.nth(i).textContent();
        console.log(`Component Error ${i + 1}: ${errorText}`);
      }
    }

    // Take a screenshot for visual inspection
    await page.screenshot({ path: 'vendors-page-test.png', fullPage: true });
    console.log('\nScreenshot saved as vendors-page-test.png');

    // Check for React/JS errors in the DOM
    const reactErrors = await page.evaluate(() => {
      const errors = [];
      // Check for React error boundaries
      const errorBoundaries = document.querySelectorAll('[class*="error"], [class*="crash"], [data-error]');
      errorBoundaries.forEach((el, i) => {
        errors.push(`React Error ${i + 1}: ${el.textContent}`);
      });
      return errors;
    });

    if (reactErrors.length > 0) {
      console.log('\n=== REACT ERRORS ===');
      reactErrors.forEach(error => console.log(error));
    }

    // Final assessment
    console.log('\n=== SUMMARY ===');
    console.log(`Console errors: ${consoleErrors.length}`);
    console.log(`Network errors: ${networkErrors.length}`);
    console.log(`Page errors: ${errorCount}`);
    console.log(`Component errors: ${componentErrorCount}`);

    // Fail if there are critical errors
    if (consoleErrors.length > 0) {
      throw new Error(`Found ${consoleErrors.length} console errors. Check the logs above.`);
    }
  });
});