#!/usr/bin/env node

/**
 * Console Monitor CLI Tool for INFOtrac
 *
 * This script provides an easy way for Claude Code to monitor
 * console errors in the INFOtrac application.
 */

const { spawn } = require('child_process');
const path = require('path');

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${color}${message}${COLORS.reset}`);
}

function showUsage() {
  log(COLORS.cyan, `
🎭 INFOtrac Console Monitor
==========================

Usage: node tests/console-monitor.js [command]

Commands:
  quick       - Quick console error check (headless)
  watch       - Monitor with browser window (headed)
  report      - Generate detailed HTML report
  debug       - Debug mode with step-by-step execution
  help        - Show this help message

Examples:
  node tests/console-monitor.js quick
  node tests/console-monitor.js watch
  npm run monitor:console
  npm run test:console:report
`);
}

async function runMonitor(mode = 'quick') {
  log(COLORS.bright, `🚀 Starting Console Monitor in ${mode} mode...`);

  let command, args;

  switch (mode) {
    case 'quick':
      command = 'npx';
      args = ['playwright', 'test', 'console-monitor.spec.ts'];
      break;
    case 'watch':
      command = 'npx';
      args = ['playwright', 'test', 'console-monitor.spec.ts', '--headed'];
      break;
    case 'report':
      command = 'npx';
      args = ['playwright', 'test', 'console-monitor.spec.ts'];
      break;
    case 'debug':
      command = 'npx';
      args = ['playwright', 'test', 'console-monitor.spec.ts', '--debug'];
      break;
    default:
      showUsage();
      return;
  }

  const child = spawn(command, args, {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  child.on('close', (code) => {
    if (code === 0) {
      log(COLORS.green, '✅ Console monitoring completed successfully!');

      if (mode === 'report') {
        log(COLORS.yellow, '📊 Opening HTML report...');
        setTimeout(() => {
          spawn('npx', ['playwright', 'show-report'], { stdio: 'inherit' });
        }, 1000);
      }
    } else {
      log(COLORS.red, `❌ Console monitoring failed with code ${code}`);
      log(COLORS.yellow, '💡 Try running with --headed flag to see what happened:');
      log(COLORS.cyan, '   npm run test:console');
    }
  });

  child.on('error', (error) => {
    log(COLORS.red, `❌ Error running console monitor: ${error.message}`);
    log(COLORS.yellow, '💡 Make sure Playwright is installed:');
    log(COLORS.cyan, '   npm install --save-dev @playwright/test');
    log(COLORS.cyan, '   npx playwright install chromium');
  });
}

// Parse command line arguments
const args = process.argv.slice(2);
const mode = args[0] || 'quick';

if (mode === 'help' || mode === '--help' || mode === '-h') {
  showUsage();
} else {
  runMonitor(mode);
}