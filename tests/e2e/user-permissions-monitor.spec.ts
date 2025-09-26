import { test, expect, Page } from '@playwright/test';

/**
 * User Permission Editing Console Monitor Test for INFOtrac
 *
 * This test specifically monitors console errors during the user permission editing flow.
 * Requested scenario: Navigate to users → select user → edit permissions → monitor console output
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

class UserPermissionConsoleMonitor {
  private errors: ConsoleError[] = [];
  private warnings: ConsoleError[] = [];
  private page: Page;
  private startTime: string;

  constructor(page: Page) {
    this.page = page;
    this.startTime = new Date().toISOString();
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
        console.log(`❌ [USER PERMISSIONS] Console Error: ${text}`);
      } else if (type === 'warning') {
        this.warnings.push({
          type: 'warning',
          message: text,
          source: location.url,
          line: location.lineNumber,
          column: location.columnNumber,
          timestamp: new Date().toISOString(),
        });
        console.log(`⚠️  [USER PERMISSIONS] Console Warning: ${text}`);
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
      console.log(`💥 [USER PERMISSIONS] Page Error: ${error.message}`);
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
        console.log(`🌐 [USER PERMISSIONS] Request Failed: ${request.url()} - ${failure.errorText}`);
      }
    });

    // Capture successful API calls for context
    this.page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/api/') && (response.status() >= 400 || url.includes('permission') || url.includes('user'))) {
        console.log(`🔗 [USER PERMISSIONS] API Response: ${response.status()} ${url}`);
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
    const duration = new Date().getTime() - new Date(this.startTime).getTime();

    let report = '🔐 User Permission Editing Console Report\\n';
    report += '==========================================\\n';
    report += `Test Started: ${this.startTime}\\n`;
    report += `Test Duration: ${duration}ms\\n`;
    report += `Total Errors: ${this.errors.length}\\n`;
    report += `Total Warnings: ${this.warnings.length}\\n\\n`;

    if (this.errors.length > 0) {
      report += '❌ PERMISSION EDITING ERRORS:\\n';
      report += '-----------------------------\\n';
      this.errors.forEach((error, index) => {
        report += `${index + 1}. ${error.message}\\n`;
        report += `   Source: ${error.source}\\n`;
        if (error.line) report += `   Location: ${error.line}:${error.column}\\n`;
        report += `   Time: ${error.timestamp}\\n`;
        if (error.stack) report += `   Stack: ${error.stack.split('\\n')[0]}\\n`;
        report += '\\n';
      });
    }

    if (this.warnings.length > 0) {
      report += '⚠️  PERMISSION EDITING WARNINGS:\\n';
      report += '-------------------------------\\n';
      this.warnings.forEach((warning, index) => {
        report += `${index + 1}. ${warning.message}\\n`;
        report += `   Source: ${warning.source}\\n`;
        if (warning.line) report += `   Location: ${warning.line}:${warning.column}\\n`;
        report += `   Time: ${warning.timestamp}\\n\\n`;
      });
    }

    if (this.errors.length === 0 && this.warnings.length === 0) {
      report += '✅ No console errors or warnings detected during user permission editing!\\n';
    }

    report += '\\n🎯 Test completed successfully!\\n';
    return report;
  }
}

test.describe('User Permission Editing Console Monitor', () => {
  test('should monitor console errors during user permission editing flow', async ({ page }) => {
    const monitor = new UserPermissionConsoleMonitor(page);

    console.log('🚀 Starting user permission editing console monitor...');

    // Step 1: Navigate to the application
    console.log('📍 Step 1: Navigating to application homepage...');
    await page.goto('/');
    await page.waitForSelector('body', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Step 2: Try to access users page directly (may require login)
    console.log('📍 Step 2: Attempting to navigate to users page...');
    try {
      await page.goto('/users');
      await page.waitForTimeout(3000);
      console.log(`Current URL after users navigation: ${page.url()}`);
    } catch (error) {
      console.log(`Users page navigation encountered: ${error}`);
    }

    // Step 3: Check if we're on login page and need to authenticate
    const currentUrl = page.url();
    if (currentUrl.includes('/') && !currentUrl.includes('/users') && !currentUrl.includes('/dashboard')) {
      console.log('📍 Step 3: Detected login page, attempting authentication...');

      try {
        // Wait for login form elements
        await page.waitForSelector('input[type="email"]', { timeout: 5000 });
        console.log('Login form detected, filling credentials...');

        await page.fill('input[type="email"]', 'admin@infotrac.com');
        await page.fill('input[type="password"]', 'password123'); // Test credentials

        await page.click('button[type="submit"]');
        await page.waitForTimeout(5000);

        console.log(`URL after login attempt: ${page.url()}`);
      } catch (loginError) {
        console.log(`Login process: ${loginError}`);
      }
    }

    // Step 4: Navigate to users page (post-authentication)
    console.log('📍 Step 4: Navigating to users page...');
    try {
      await page.goto('/users');
      await page.waitForTimeout(3000);
    } catch (error) {
      console.log(`Users page access: ${error}`);
    }

    // Step 5: Look for user management interface
    console.log('📍 Step 5: Searching for user management interface...');

    try {
      // Wait for any table or user list to appear
      const userElements = [
        'table tbody tr', // Table rows
        '[data-testid*="user"]', // User test elements
        'button:has-text("Edit")', // Edit buttons
        'button:has-text("Permissions")', // Permission buttons
        '.user-row', // User row classes
        '[role="row"]', // ARIA row elements
      ];

      let foundUserInterface = false;
      for (const selector of userElements) {
        try {
          await page.waitForSelector(selector, { timeout: 2000 });
          console.log(`✅ Found user interface: ${selector}`);
          foundUserInterface = true;
          break;
        } catch {
          // Continue to next selector
        }
      }

      if (!foundUserInterface) {
        console.log('⚠️  No user management interface found, checking page content...');
        const pageContent = await page.textContent('body');
        console.log(`Page content preview: ${pageContent?.substring(0, 200)}...`);
      }
    } catch (error) {
      console.log(`User interface detection: ${error}`);
    }

    // Step 6: Attempt to interact with user permission controls
    console.log('📍 Step 6: Attempting to interact with user permission controls...');

    try {
      // Look for common permission editing patterns
      const permissionSelectors = [
        'button:has-text("Edit Permissions")',
        'button:has-text("Permissions")',
        'button:has-text("Edit")',
        '[data-testid="edit-user"]',
        '[data-testid="user-permissions"]',
        'button[aria-label*="permission"]',
        'button[title*="permission"]',
      ];

      let interactionMade = false;
      for (const selector of permissionSelectors) {
        try {
          const element = await page.locator(selector).first();
          if (await element.isVisible({ timeout: 1000 })) {
            console.log(`🎯 Found permission control: ${selector}`);
            await element.click();
            await page.waitForTimeout(2000);
            interactionMade = true;
            console.log('✅ Successfully clicked permission control');
            break;
          }
        } catch {
          // Continue to next selector
        }
      }

      if (!interactionMade) {
        console.log('⚠️  No permission controls found, attempting generic interactions...');

        // Try clicking any buttons that might open permission dialogs
        const buttons = await page.locator('button').all();
        for (let i = 0; i < Math.min(buttons.length, 5); i++) {
          try {
            const buttonText = await buttons[i].textContent();
            if (buttonText && (buttonText.includes('Edit') || buttonText.includes('Permission') || buttonText.includes('User'))) {
              console.log(`🔄 Clicking button: "${buttonText}"`);
              await buttons[i].click({ timeout: 1000 });
              await page.waitForTimeout(1000);
              interactionMade = true;
            }
          } catch {
            // Continue to next button
          }
        }
      }
    } catch (error) {
      console.log(`Permission control interaction: ${error}`);
    }

    // Step 7: Look for permission dialog or form
    console.log('📍 Step 7: Checking for permission editing dialog/form...');

    try {
      const dialogSelectors = [
        '[role="dialog"]',
        '.dialog',
        '.modal',
        '[data-testid*="dialog"]',
        '[data-testid*="permission"]',
        'form:has(input[type="checkbox"])',
      ];

      for (const selector of dialogSelectors) {
        try {
          const element = await page.locator(selector).first();
          if (await element.isVisible({ timeout: 1000 })) {
            console.log(`✅ Found permission interface: ${selector}`);

            // Try to interact with checkboxes or form elements
            const checkboxes = await element.locator('input[type="checkbox"]').all();
            if (checkboxes.length > 0) {
              console.log(`🔄 Found ${checkboxes.length} permission checkboxes, toggling first few...`);
              for (let i = 0; i < Math.min(checkboxes.length, 3); i++) {
                try {
                  await checkboxes[i].click();
                  await page.waitForTimeout(500);
                  console.log(`✅ Toggled checkbox ${i + 1}`);
                } catch {
                  console.log(`⚠️  Could not toggle checkbox ${i + 1}`);
                }
              }
            }
            break;
          }
        } catch {
          // Continue to next selector
        }
      }
    } catch (error) {
      console.log(`Permission dialog detection: ${error}`);
    }

    // Step 8: Final wait and screenshot
    console.log('📍 Step 8: Final monitoring and screenshot capture...');
    await page.waitForTimeout(3000);

    // Always take a screenshot of the final state
    await page.screenshot({
      path: 'playwright-report/user-permissions-final-state.png',
      fullPage: true,
    });

    // Generate and display comprehensive report
    const report = monitor.generateReport();
    console.log('\\n📋 USER PERMISSION EDITING CONSOLE REPORT:');
    console.log(report);

    // Take error screenshot if needed
    if (monitor.hasErrors()) {
      await page.screenshot({
        path: 'playwright-report/user-permissions-errors.png',
        fullPage: true,
      });
      console.log('📸 Error screenshot saved');
    }

    // Log final status
    const finalUrl = page.url();
    console.log(`\\n🏁 Test completed at URL: ${finalUrl}`);
    console.log(`🎯 Monitoring Results: ${monitor.getErrors().length} errors, ${monitor.getWarnings().length} warnings`);

    // Don't fail the test, just report findings
    if (monitor.hasErrors()) {
      console.log('⚠️  Console errors detected during user permission editing flow');
      console.log('📊 Check the detailed report above for specific error information');
    } else {
      console.log('✅ No console errors detected during user permission editing flow');
    }
  });

  test('should test user permission editing with authentication', async ({ page }) => {
    const monitor = new UserPermissionConsoleMonitor(page);

    console.log('🔐 Testing authenticated user permission editing flow...');

    // Navigate to app and wait
    await page.goto('/');
    await page.waitForTimeout(3000);

    // If we see a login form, try to login first
    try {
      const emailInput = page.locator('input[type="email"]');
      if (await emailInput.isVisible({ timeout: 2000 })) {
        console.log('🔑 Attempting authentication...');
        await emailInput.fill('admin@infotrac.com');
        await page.locator('input[type="password"]').fill('password123');
        await page.locator('button[type="submit"]').click();
        await page.waitForTimeout(5000);
      }
    } catch {
      console.log('💡 No login form detected or login failed');
    }

    // Try direct navigation to permission management
    const permissionRoutes = [
      '/permissions',
      '/admin/users',
      '/users',
      '/admin/permissions',
      '/settings/users',
    ];

    for (const route of permissionRoutes) {
      console.log(`🔄 Trying route: ${route}`);
      try {
        await page.goto(route);
        await page.waitForTimeout(2000);

        const url = page.url();
        console.log(`Result URL: ${url}`);

        if (!url.includes('/login') && !url.includes('/?')) {
          console.log(`✅ Successfully accessed: ${route}`);
          break;
        }
      } catch (error) {
        console.log(`Route ${route}: ${error}`);
      }
    }

    // Generate final report
    await page.waitForTimeout(2000);
    const report = monitor.generateReport();
    console.log('\\n📋 AUTHENTICATED USER PERMISSION TEST REPORT:');
    console.log(report);

    await page.screenshot({
      path: 'playwright-report/user-permissions-authenticated.png',
      fullPage: true,
    });
  });
});