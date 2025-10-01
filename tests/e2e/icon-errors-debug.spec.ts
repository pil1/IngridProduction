import { test, expect, Page } from '@playwright/test';

/**
 * Icon Error Debugging Test for INFOtrac
 *
 * This test systematically loads EVERY page route and captures icon-related
 * console errors one at a time for systematic debugging.
 */

interface IconError {
  page: string;
  error: string;
  missingIcon: string;
  file: string;
  line?: number;
  timestamp: string;
}

class IconErrorDebugger {
  private iconErrors: IconError[] = [];
  private allErrors: string[] = [];
  private currentPage: string = '';
  private page: Page;

  constructor(page: Page) {
    this.page = page;
    this.setupListeners();
  }

  setCurrentPage(pageName: string) {
    this.currentPage = pageName;
  }

  private setupListeners() {
    this.page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      const location = msg.location();

      if (type === 'error') {
        this.allErrors.push(text);

        // Check if this is an icon export error
        const iconExportMatch = text.match(/does not provide an export named ['"]([^'"]+)['"]/);
        const fileMatch = text.match(/at ([^:]+):(\d+):\d+/);

        if (iconExportMatch) {
          const missingIcon = iconExportMatch[1];
          const file = fileMatch ? fileMatch[1] : location.url;
          const line = fileMatch ? parseInt(fileMatch[2]) : location.lineNumber;

          this.iconErrors.push({
            page: this.currentPage,
            error: text,
            missingIcon: missingIcon,
            file: file,
            line: line,
            timestamp: new Date().toISOString(),
          });

          console.log(`\n🔍 ICON ERROR FOUND:`);
          console.log(`   Page: ${this.currentPage}`);
          console.log(`   Missing Icon: ${missingIcon}`);
          console.log(`   File: ${file}${line ? `:${line}` : ''}`);
        }
      }
    });

    this.page.on('pageerror', (error) => {
      this.allErrors.push(error.message);
    });
  }

  getIconErrors(): IconError[] {
    return [...this.iconErrors];
  }

  getAllErrors(): string[] {
    return [...this.allErrors];
  }

  hasIconErrors(): boolean {
    return this.iconErrors.length > 0;
  }

  generateReport(): string {
    let report = '\n' + '='.repeat(80) + '\n';
    report += '🎯 ICON ERROR DEBUG REPORT\n';
    report += '='.repeat(80) + '\n\n';
    report += `Total Icon Errors Found: ${this.iconErrors.length}\n`;
    report += `Total Console Errors: ${this.allErrors.length}\n\n`;

    if (this.iconErrors.length > 0) {
      report += '❌ MISSING ICON EXPORTS:\n';
      report += '-'.repeat(80) + '\n\n';

      // Group by missing icon name
      const groupedErrors = new Map<string, IconError[]>();
      this.iconErrors.forEach(error => {
        if (!groupedErrors.has(error.missingIcon)) {
          groupedErrors.set(error.missingIcon, []);
        }
        groupedErrors.get(error.missingIcon)!.push(error);
      });

      let errorNumber = 1;
      groupedErrors.forEach((errors, iconName) => {
        report += `${errorNumber}. Missing Icon: "${iconName}"\n`;
        report += `   Used in ${errors.length} location(s):\n`;
        errors.forEach(error => {
          report += `   - Page: ${error.page}\n`;
          report += `     File: ${error.file}${error.line ? `:${error.line}` : ''}\n`;
        });
        report += '\n';
        errorNumber++;
      });

      report += '\n📝 SUGGESTED FIXES:\n';
      report += '-'.repeat(80) + '\n';
      report += 'Add these exports to /root/INFOtracClaude/src/lib/icons.ts:\n\n';

      groupedErrors.forEach((errors, iconName) => {
        // Suggest a reasonable MynaUI icon mapping
        const cleanName = iconName.replace(/Icon$/, '');
        report += `export { /* MynaIcon */ as ${iconName} } from '@mynaui/icons-react';\n`;
      });
      report += '\n';
    } else {
      report += '✅ No icon export errors found!\n\n';
    }

    report += '='.repeat(80) + '\n';
    return report;
  }
}

// Define all application routes to test
const APP_ROUTES = [
  { path: '/', name: 'Login/Home' },
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/expenses', name: 'Expenses' },
  { path: '/expenses/new', name: 'New Expense' },
  { path: '/expenses/review', name: 'Expense Review' },
  { path: '/vendors', name: 'Vendors' },
  { path: '/customers', name: 'Customers' },
  { path: '/gl-accounts', name: 'GL Accounts' },
  { path: '/expense-categories', name: 'Expense Categories' },
  { path: '/locations', name: 'Locations' },
  { path: '/users', name: 'User Management' },
  { path: '/settings', name: 'Settings' },
  { path: '/settings/company', name: 'Company Settings' },
  { path: '/settings/notifications', name: 'Notification Settings' },
  { path: '/billing', name: 'Billing' },
  { path: '/ingrid', name: 'Ingrid AI' },
  { path: '/analytics', name: 'Analytics' },
  { path: '/super-admin', name: 'Super Admin Dashboard' },
  { path: '/super-admin/api-keys', name: 'API Keys' },
];

test.describe('Icon Error Debugging - Systematic Page Testing', () => {

  test('should scan all pages for icon errors and report them', async ({ page }) => {
    const monitor = new IconErrorDebugger(page);

    console.log('\n🚀 Starting systematic icon error scan...\n');
    console.log(`Testing ${APP_ROUTES.length} routes...\n`);

    let testedPages = 0;
    let failedPages = 0;

    for (const route of APP_ROUTES) {
      console.log(`\n📄 Testing: ${route.name} (${route.path})`);
      monitor.setCurrentPage(route.name);

      try {
        // Navigate to the page
        await page.goto(route.path, {
          waitUntil: 'domcontentloaded',
          timeout: 10000
        });

        // Wait for page to render
        await page.waitForTimeout(2000);

        // Wait for any dynamic content
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
          // Ignore timeout, we'll still capture errors
        });

        testedPages++;
        console.log(`   ✅ Page loaded`);

      } catch (error) {
        failedPages++;
        console.log(`   ⚠️  Page failed to load: ${error}`);
      }
    }

    // Generate comprehensive report
    const report = monitor.generateReport();
    console.log(report);

    // Summary statistics
    console.log('\n📊 SCAN SUMMARY:');
    console.log(`   Pages Tested: ${testedPages}/${APP_ROUTES.length}`);
    console.log(`   Pages Failed: ${failedPages}`);
    console.log(`   Icon Errors: ${monitor.getIconErrors().length}`);
    console.log(`   Total Errors: ${monitor.getAllErrors().length}`);

    // Take screenshot of final state
    await page.screenshot({
      path: 'playwright-report/icon-debug-final-state.png',
      fullPage: true,
    });

    // Optionally fail if icon errors found (you can comment this out if you just want reporting)
    if (monitor.hasIconErrors()) {
      const iconErrors = monitor.getIconErrors();
      const uniqueIcons = new Set(iconErrors.map(e => e.missingIcon));
      console.log(`\n❌ Found ${uniqueIcons.size} unique missing icon(s)`);
      console.log(`   Missing icons: ${Array.from(uniqueIcons).join(', ')}`);
    }
  });

  test('should test individual problematic pages in isolation', async ({ page }) => {
    // This test can be used to debug specific pages one at a time
    const monitor = new IconErrorDebugger(page);

    // Add specific pages you want to debug here
    const problematicPages = [
      { path: '/', name: 'Home' },
      { path: '/dashboard', name: 'Dashboard' },
    ];

    console.log('\n🔬 Detailed debugging of specific pages...\n');

    for (const route of problematicPages) {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Testing: ${route.name}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      monitor.setCurrentPage(route.name);

      await page.goto(route.path);
      await page.waitForTimeout(3000);

      // Log current page state
      const title = await page.title();
      const url = page.url();
      console.log(`   Title: ${title}`);
      console.log(`   URL: ${url}`);

      // Check for icon errors on this specific page
      const iconErrors = monitor.getIconErrors().filter(e => e.page === route.name);
      if (iconErrors.length > 0) {
        console.log(`\n   ❌ Found ${iconErrors.length} icon error(s) on this page:`);
        iconErrors.forEach((error, i) => {
          console.log(`      ${i + 1}. ${error.missingIcon} in ${error.file}`);
        });

        // Take screenshot
        await page.screenshot({
          path: `playwright-report/icon-error-${route.name.replace(/\s+/g, '-').toLowerCase()}.png`,
          fullPage: true,
        });
      } else {
        console.log(`   ✅ No icon errors on this page`);
      }
    }

    const report = monitor.generateReport();
    console.log(report);
  });
});
