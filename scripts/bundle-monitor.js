#!/usr/bin/env node

/**
 * Bundle Size Monitor
 *
 * This script monitors bundle sizes and alerts if they exceed thresholds.
 * Run this script after builds to track bundle size trends.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bundle size thresholds (in KB)
const THRESHOLDS = {
  // Main bundles
  'index': { warning: 300, critical: 400 },
  'charts-vendor': { warning: 350, critical: 450 },
  'pdf-vendor': { warning: 300, critical: 400 },

  // Individual pages/components
  'AiRedesignTemplateDialog': { warning: 200, critical: 300 },
  'AddEditExpenseDialog': { warning: 30, critical: 50 },
  'SystemNotificationSettingsPage': { warning: 35, critical: 50 },

  // Vendor chunks
  'react-vendor': { warning: 180, critical: 250 },
  'radix-vendor': { warning: 120, critical: 180 },
  'supabase-vendor': { warning: 100, critical: 150 },
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  bold: '\x1b[1m'
};

function formatSize(bytes) {
  return (bytes / 1024).toFixed(2) + ' KB';
}

function getStatusColor(size, threshold) {
  if (size > threshold.critical) return colors.red;
  if (size > threshold.warning) return colors.yellow;
  return colors.green;
}

function analyzeBundleFiles() {
  const distPath = path.join(__dirname, '..', 'dist', 'assets');

  if (!fs.existsSync(distPath)) {
    console.log(`${colors.red}Error: dist/assets directory not found. Run 'npm run build' first.${colors.reset}`);
    process.exit(1);
  }

  const files = fs.readdirSync(distPath);
  const jsFiles = files.filter(file => file.endsWith('.js'));

  console.log(`${colors.bold}${colors.blue}📊 Bundle Size Analysis${colors.reset}\n`);
  console.log(`Total JS files: ${jsFiles.length}`);
  console.log(`Generated: ${new Date().toLocaleString()}\n`);

  let totalSize = 0;
  let alerts = [];

  const results = jsFiles.map(file => {
    const filePath = path.join(distPath, file);
    const stats = fs.statSync(filePath);
    const sizeKB = stats.size / 1024;
    totalSize += stats.size;

    // Extract bundle name for threshold checking
    const bundleName = file.split('-')[0];
    const threshold = THRESHOLDS[bundleName];

    let status = 'OK';
    let statusColor = colors.green;

    if (threshold) {
      statusColor = getStatusColor(sizeKB, threshold);
      if (sizeKB > threshold.critical) {
        status = 'CRITICAL';
        alerts.push({
          file: file,
          size: sizeKB,
          threshold: threshold.critical,
          type: 'critical'
        });
      } else if (sizeKB > threshold.warning) {
        status = 'WARNING';
        alerts.push({
          file: file,
          size: sizeKB,
          threshold: threshold.warning,
          type: 'warning'
        });
      }
    }

    return {
      file,
      size: sizeKB,
      status,
      statusColor,
      threshold
    };
  });

  // Sort by size (largest first)
  results.sort((a, b) => b.size - a.size);

  // Display results
  console.log('Largest bundles:');
  console.log('─'.repeat(80));

  results.slice(0, 15).forEach(result => {
    const sizeStr = formatSize(result.size * 1024).padStart(10);
    const fileName = result.file.padEnd(50);
    const thresholdStr = result.threshold ?
      `(warning: ${result.threshold.warning}KB, critical: ${result.threshold.critical}KB)` :
      '(no threshold)';

    console.log(
      `${result.statusColor}${sizeStr} ${fileName} ${result.status}${colors.reset} ${colors.blue}${thresholdStr}${colors.reset}`
    );
  });

  console.log('\n' + '─'.repeat(80));
  console.log(`${colors.bold}Total bundle size: ${formatSize(totalSize)}${colors.reset}`);

  // Show alerts
  if (alerts.length > 0) {
    console.log(`\n${colors.bold}${colors.red}⚠️  Bundle Size Alerts:${colors.reset}`);
    alerts.forEach(alert => {
      const color = alert.type === 'critical' ? colors.red : colors.yellow;
      const icon = alert.type === 'critical' ? '🚨' : '⚠️ ';
      console.log(
        `${icon} ${color}${alert.file}: ${formatSize(alert.size * 1024)} exceeds ${alert.type} threshold (${alert.threshold}KB)${colors.reset}`
      );
    });
    console.log('\nConsider:');
    console.log('- Code splitting large components');
    console.log('- Lazy loading non-critical features');
    console.log('- Tree shaking unused imports');
    console.log('- Moving large dependencies to separate chunks\n');
  } else {
    console.log(`\n${colors.green}✅ All bundles are within acceptable size limits!${colors.reset}\n`);
  }

  // Save results to JSON for tracking
  const reportPath = path.join(__dirname, '..', 'bundle-report.json');
  const report = {
    timestamp: new Date().toISOString(),
    totalSize: totalSize,
    totalSizeKB: totalSize / 1024,
    files: results.map(r => ({
      file: r.file,
      sizeKB: r.size,
      status: r.status
    })),
    alerts: alerts
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`${colors.blue}📄 Report saved to: bundle-report.json${colors.reset}`);

  // Exit with error code if critical alerts
  if (alerts.some(a => a.type === 'critical')) {
    console.log(`\n${colors.red}❌ Build contains critical bundle size violations!${colors.reset}`);
    process.exit(1);
  }
}

analyzeBundleFiles();