import { test, expect, Page } from '@playwright/test';

/**
 * Comprehensive Error Capture for dev.onbb.ca:8443
 *
 * Captures ALL console errors, warnings, and network failures
 */

interface ConsoleMessage {
  type: string;
  text: string;
  location: string;
  timestamp: string;
}

test('Capture ALL console errors on dev.onbb.ca:8443', async ({ page }) => {
  const allMessages: ConsoleMessage[] = [];

  // Capture ALL console messages
  page.on('console', (msg) => {
    allMessages.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location().url,
      timestamp: new Date().toISOString(),
    });

    // Print in real-time
    if (msg.type() === 'error') {
      console.log(`\n❌ ERROR: ${msg.text()}`);
      console.log(`   Location: ${msg.location().url}:${msg.location().lineNumber}`);
    } else if (msg.type() === 'warning') {
      console.log(`\n⚠️  WARNING: ${msg.text()}`);
    }
  });

  // Capture page errors
  page.on('pageerror', (error) => {
    console.log(`\n💥 PAGE ERROR: ${error.message}`);
    console.log(`   Stack: ${error.stack}`);
  });

  // Capture failed requests
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    console.log(`\n🌐 REQUEST FAILED: ${request.url()}`);
    console.log(`   Reason: ${failure?.errorText}`);
  });

  console.log('\n🚀 Loading https://dev.onbb.ca:8443...\n');

  // Navigate to home page
  await page.goto('/');
  await page.waitForTimeout(5000);

  console.log('\n📊 CAPTURED MESSAGES SUMMARY:\n');
  console.log('═'.repeat(80));

  const errors = allMessages.filter(m => m.type === 'error');
  const warnings = allMessages.filter(m => m.type === 'warning');
  const logs = allMessages.filter(m => m.type === 'log');

  console.log(`Total Messages: ${allMessages.length}`);
  console.log(`  - Errors: ${errors.length}`);
  console.log(`  - Warnings: ${warnings.length}`);
  console.log(`  - Logs: ${logs.length}`);

  if (errors.length > 0) {
    console.log('\n❌ ALL ERRORS:\n');
    errors.forEach((error, i) => {
      console.log(`${i + 1}. ${error.text}`);
      console.log(`   Location: ${error.location}`);
      console.log(`   Time: ${error.timestamp}\n`);
    });
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  ALL WARNINGS:\n');
    warnings.forEach((warning, i) => {
      console.log(`${i + 1}. ${warning.text}`);
      console.log(`   Location: ${warning.location}\n`);
    });
  }

  console.log('═'.repeat(80));

  // Take screenshot
  await page.screenshot({
    path: 'playwright-report/dev-environment-state.png',
    fullPage: true,
  });

  console.log('\n📸 Screenshot saved to: playwright-report/dev-environment-state.png\n');
});
