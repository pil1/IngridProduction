import { test, expect, Page } from '@playwright/test';

/**
 * Console Error Monitoring Test for INFOtrac
 *
 * This test monitors the application for console errors and provides
 * detailed reporting and debugging capabilities for Claude Code.
 */

interface ConsoleError {
  type: 'error' | 'warning';
  message: string;
  source: string;
  line?: number;
  column?: number;
  timestamp: string;
  stack?: string;
}

class ConsoleMonitor {
  private errors: ConsoleError[] = [];
  private warnings: ConsoleError[] = [];
  private page: Page;

  constructor(page: Page) {
    this.page = page;
    this.setupConsoleListeners();
  }

  private setupConsoleListeners() {
    // Capture console errors and warnings
    this.page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      const location = msg.location();

      if (type === 'error') {
        this.errors.push({
          type: 'error',
          message: text,
          source: location.url,
          line: location.lineNumber,
          column: location.columnNumber,
          timestamp: new Date().toISOString(),
        });
        console.log(`❌ Console Error: ${text}`);
      } else if (type === 'warning') {
        this.warnings.push({
          type: 'warning',
          message: text,
          source: location.url,
          line: location.lineNumber,
          column: location.columnNumber,
          timestamp: new Date().toISOString(),
        });
        console.log(`⚠️  Console Warning: ${text}`);
      }
    });

    // Capture page errors (uncaught exceptions)
    this.page.on('pageerror', (error) => {
      this.errors.push({
        type: 'error',
        message: error.message,
        source: 'Uncaught Exception',
        timestamp: new Date().toISOString(),
        stack: error.stack,
      });
      console.log(`💥 Page Error: ${error.message}`);
    });

    // Capture request failures
    this.page.on('requestfailed', (request) => {
      const failure = request.failure();
      if (failure) {
        this.errors.push({
          type: 'error',
          message: `Request failed: ${request.url()} - ${failure.errorText}`,
          source: 'Network Request',
          timestamp: new Date().toISOString(),
        });
        console.log(`🌐 Request Failed: ${request.url()} - ${failure.errorText}`);
      }
    });
  }

  getErrors(): ConsoleError[] {
    return [...this.errors];
  }

  getWarnings(): ConsoleError[] {
    return [...this.warnings];
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  hasWarnings(): boolean {
    return this.warnings.length > 0;
  }

  generateReport(): string {
    let report = '📊 Console Monitor Report\\n';
    report += `=================================\\n`;
    report += `Timestamp: ${new Date().toISOString()}\\n`;
    report += `Total Errors: ${this.errors.length}\\n`;
    report += `Total Warnings: ${this.warnings.length}\\n\\n`;

    if (this.errors.length > 0) {
      report += '❌ ERRORS:\\n';
      report += '---------\\n';
      this.errors.forEach((error, index) => {
        report += `${index + 1}. ${error.message}\\n`;
        report += `   Source: ${error.source}\\n`;
        if (error.line) report += `   Line: ${error.line}:${error.column}\\n`;
        report += `   Time: ${error.timestamp}\\n`;
        if (error.stack) report += `   Stack: ${error.stack.split('\\n')[0]}\\n`;
        report += '\\n';
      });
    }

    if (this.warnings.length > 0) {
      report += '⚠️  WARNINGS:\\n';
      report += '-----------\\n';
      this.warnings.forEach((warning, index) => {
        report += `${index + 1}. ${warning.message}\\n`;
        report += `   Source: ${warning.source}\\n`;
        if (warning.line) report += `   Line: ${warning.line}:${warning.column}\\n`;
        report += `   Time: ${warning.timestamp}\\n\\n`;
      });
    }

    if (this.errors.length === 0 && this.warnings.length === 0) {
      report += '✅ No console errors or warnings detected!\\n';
    }

    return report;
  }
}

test.describe('Console Error Monitoring', () => {
  test('should monitor console errors during application load', async ({ page }) => {
    const monitor = new ConsoleMonitor(page);

    console.log('🚀 Starting console monitoring...');

    // Navigate to the application
    await page.goto('/');

    // Wait for the application to load
    await page.waitForSelector('body', { timeout: 10000 });

    // Wait for any initial JavaScript to execute
    await page.waitForTimeout(2000);

    // Generate and display report
    const report = monitor.generateReport();
    console.log(report);

    // Take screenshot if there are errors
    if (monitor.hasErrors()) {
      await page.screenshot({
        path: 'playwright-report/console-errors-homepage.png',
        fullPage: true,
      });
    }

    // Assert no critical errors (you can adjust this threshold)
    expect(monitor.getErrors().length, `Found ${monitor.getErrors().length} console errors. See report above for details.`).toBeLessThanOrEqual(0);
  });

  test('should monitor console errors during login flow', async ({ page }) => {
    const monitor = new ConsoleMonitor(page);

    console.log('🔐 Testing login flow for console errors...');

    // Navigate to login page
    await page.goto('/');

    // Wait for login form to appear
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });

    // Fill in login credentials (using test credentials)
    await page.fill('input[type="email"]', 'admin@infotrac.com');
    await page.fill('input[type="password"]', 'your-password-here'); // You'll need to update this

    // Click login button
    await page.click('button[type="submit"]');

    // Wait for potential navigation or error messages
    await page.waitForTimeout(5000);

    // Generate and display report
    const report = monitor.generateReport();
    console.log(report);

    // Take screenshot if there are errors
    if (monitor.hasErrors()) {
      await page.screenshot({
        path: 'playwright-report/console-errors-login.png',
        fullPage: true,
      });
    }

    // Log the current URL for debugging
    console.log(`Current URL: ${page.url()}`);

    // Don't fail the test for login errors, just report them
    if (monitor.hasErrors()) {
      console.log('⚠️  Console errors detected during login flow (this may be expected if credentials are invalid)');
    }
  });

  test('should monitor console errors during navigation', async ({ page }) => {
    const monitor = new ConsoleMonitor(page);

    console.log('🧭 Testing navigation for console errors...');

    // Start at homepage
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Try to navigate to different pages (even if authentication is required)
    const pagesToTest = [
      '/dashboard',
      '/expenses',
      '/vendors',
      '/customers',
      '/users',
      '/settings',
    ];

    for (const pagePath of pagesToTest) {
      console.log(`Testing page: ${pagePath}`);

      try {
        await page.goto(pagePath);
        await page.waitForTimeout(1000);
      } catch (error) {
        console.log(`Navigation to ${pagePath} failed: ${error}`);
      }
    }

    // Generate and display report
    const report = monitor.generateReport();
    console.log(report);

    // Take screenshot if there are errors
    if (monitor.hasErrors()) {
      await page.screenshot({
        path: 'playwright-report/console-errors-navigation.png',
        fullPage: true,
      });
    }

    // Report any errors found but don't fail (navigation might require auth)
    if (monitor.hasErrors()) {
      console.log('⚠️  Console errors detected during navigation (some may be expected for protected routes)');
    }
  });

  test('should generate comprehensive error report', async ({ page }) => {
    const monitor = new ConsoleMonitor(page);

    console.log('📝 Generating comprehensive application scan...');

    // Navigate through the app systematically
    await page.goto('/');
    await page.waitForTimeout(3000);

    // Try common user interactions
    try {
      // Click around the interface
      const buttons = await page.locator('button').all();
      for (let i = 0; i < Math.min(buttons.length, 5); i++) {
        try {
          await buttons[i].click({ timeout: 1000 });
          await page.waitForTimeout(500);
        } catch (e) {
          // Ignore click failures, we're just looking for console errors
        }
      }
    } catch (error) {
      console.log(`Error during interaction testing: ${error}`);
    }

    // Final report
    const report = monitor.generateReport();
    console.log('\\n📋 FINAL COMPREHENSIVE REPORT:');
    console.log(report);

    // Always take a final screenshot
    await page.screenshot({
      path: 'playwright-report/final-application-state.png',
      fullPage: true,
    });

    // Don't fail the test, just report findings
    console.log(`\\n🎯 Monitoring complete. Found ${monitor.getErrors().length} errors and ${monitor.getWarnings().length} warnings.`);
  });
});