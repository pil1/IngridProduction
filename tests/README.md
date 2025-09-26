# INFOtrac Console Error Monitoring

🎭 **Automated browser testing with real-time console error detection for Claude Code**

This testing infrastructure provides Claude Code with the ability to automatically detect and monitor console errors in the INFOtrac application using Playwright browser automation.

## Quick Start

```bash
# Quick console error check (recommended)
npm run monitor:console

# Visual debugging with browser window
npm run test:console

# Generate detailed HTML report
npm run monitor:report
```

## Test Results Analysis

### ✅ **Current Status (Latest Test)**
- **Errors**: 1 (Rate limiting - 429 Too Many Requests)
- **Warnings**: 14 (React Router Future Flags + Auth Token warnings)
- **Pages Tested**: Homepage, Dashboard, Expenses, Vendors, Customers, Users, Settings
- **Overall Health**: **Good** - No critical JavaScript errors

### 📊 **Identified Issues**

#### 🔴 **Critical (Needs Attention)**
1. **429 Rate Limiting Error**: `http://localhost:3001/api/auth/login`
   - **Impact**: Login functionality affected during rapid testing
   - **Solution**: Implement #ratelimited command or wait periods
   - **Status**: Also detected in user permission testing flow

#### 🟡 **Non-Critical (Informational)**
1. **React Router Future Flag Warnings**: 14 instances
   - **Issue**: React Router v7 compatibility warnings
   - **Impact**: No functional impact, just future compatibility notices
   - **Fix**: Add `v7_startTransition` future flag to router config

2. **Auth Token Warnings**: "No access token available for modules fetch"
   - **Issue**: Expected when not logged in
   - **Impact**: Normal behavior for protected routes

## Available Commands

### Basic Monitoring
```bash
npm run monitor:console          # Quick headless check
npm run test:console            # Visual browser mode
npm run test:console:report     # Generate HTML report
```

### 🆕 User Permission Testing
```bash
npm run monitor:permissions      # Test user permission editing flow (headless)
npm run test:permissions         # Visual user permission testing
npm run test:permissions:headless # Headless user permission testing
```

### Advanced Testing
```bash
npm run test:e2e               # Full end-to-end suite
npm run test:e2e:headed        # Visual end-to-end testing
npm run test:e2e:debug         # Step-by-step debugging
```

### Custom CLI Tool
```bash
node tests/console-monitor.js quick    # Quick check
node tests/console-monitor.js watch    # Visual mode
node tests/console-monitor.js report   # HTML report
node tests/console-monitor.js debug    # Debug mode
```

## Test Coverage

The console monitor tests:

1. **Application Load Monitoring**
   - Homepage console errors
   - Initial JavaScript execution
   - React component mounting

2. **Login Flow Testing**
   - Authentication form interactions
   - Login API calls
   - Error handling

3. **Navigation Testing**
   - Multi-page navigation
   - Route protection behavior
   - Component rendering across pages

4. **Comprehensive Scanning**
   - UI interaction testing
   - Error aggregation
   - Screenshot capture on failures

5. **🆕 User Permission Flow Testing**
   - Navigate to user management interface
   - Attempt user permission editing
   - Monitor permission-specific console errors
   - Test both authenticated and unauthenticated flows
   - Capture permission dialog interactions

## Output Files

- `playwright-report/` - HTML test reports with screenshots
- `playwright-report/results.json` - Machine-readable test results
- Screenshots saved when errors are detected

## For Claude Code Usage

This system enables Claude Code to:
- ✅ **Automatically detect console errors** during development
- ✅ **Monitor application health** across different pages
- ✅ **Generate detailed error reports** with timestamps and stack traces
- ✅ **Capture visual evidence** via screenshots
- ✅ **Test user flows** without manual interaction

## Configuration

Playwright configuration is in `playwright.config.ts`:
- **Base URL**: `http://localhost:8080`
- **Browser**: Chromium (Chrome)
- **Timeout**: 60 seconds per test
- **Reports**: HTML, JSON, and console output

## Troubleshooting

### Common Issues
1. **"Server not responding"**: Ensure `npm run dev` is running
2. **"Browser not found"**: Run `npx playwright install chromium`
3. **"Tests failing"**: Check console output for specific error details

### Debug Mode
Use `npm run test:e2e:debug` to step through tests interactively and identify issues visually.