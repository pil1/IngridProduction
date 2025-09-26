#!/bin/bash

# INFOtrac Docker Entrypoint Script
# Handles environment setup and application startup

set -e

echo "🚀 Starting INFOtrac Production Container..."
echo "Target: info.onbb.ca:4211"
echo ""

# Check if environment file exists
if [ ! -f "/app/config/.env.local" ]; then
    echo "⚠️  Environment file not found. Running interactive setup..."
    /app/scripts/setup-environment.sh
fi

# Validate required environment variables
echo "🔍 Validating environment configuration..."

# Source the environment file
if [ -f "/app/config/.env.local" ]; then
    set -a  # Automatically export all variables
    source /app/config/.env.local
    set +a
    echo "✅ Environment variables loaded"
else
    echo "❌ Environment file not found after setup!"
    exit 1
fi

# Validate critical variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "❌ Missing critical Supabase configuration!"
    echo "   Please ensure SUPABASE_URL and SUPABASE_ANON_KEY are set."
    exit 1
fi

echo "✅ Environment validation passed"
echo ""

# Test Supabase connectivity
echo "🔌 Testing Supabase connection..."
if command -v node >/dev/null 2>&1; then
    # Create a simple connectivity test
    cat > /tmp/test-connection.js << 'EOF'
const https = require('https');
const url = process.env.SUPABASE_URL;

if (!url) {
    console.log('❌ SUPABASE_URL not set');
    process.exit(1);
}

const testUrl = url + '/rest/v1/';
const options = {
    method: 'HEAD',
    timeout: 5000
};

https.request(testUrl, options, (res) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log('✅ Supabase connectivity test passed');
        process.exit(0);
    } else {
        console.log(`⚠️  Supabase returned status: ${res.statusCode}`);
        process.exit(0); // Don't fail startup for this
    }
}).on('error', (err) => {
    console.log('⚠️  Supabase connectivity test failed:', err.message);
    console.log('   Application will still start...');
    process.exit(0); // Don't fail startup for connectivity issues
}).on('timeout', () => {
    console.log('⚠️  Supabase connectivity test timed out');
    console.log('   Application will still start...');
    process.exit(0);
}).end();
EOF

    timeout 10s node /tmp/test-connection.js || echo "   (Connection test skipped)"
    rm -f /tmp/test-connection.js
fi

echo ""

# Create runtime configuration for the frontend
echo "⚙️  Preparing frontend configuration..."

# Create a config.js file that can be loaded by the frontend
cat > /usr/share/nginx/html/config.js << EOF
window.ENV = {
    VITE_SUPABASE_URL: "$SUPABASE_URL",
    VITE_SUPABASE_ANON_KEY: "$SUPABASE_ANON_KEY",
    VITE_APP_ENV: "${VITE_APP_ENV:-production}",
    VITE_API_BASE_URL: "${VITE_API_BASE_URL:-https://info.onbb.ca:4211}",
    VITE_APP_VERSION: "${VITE_APP_VERSION:-2.0.0}",
    VITE_APP_NAME: "${VITE_APP_NAME:-INFOtrac}",
    timestamp: "$(date -Iseconds)"
};
EOF

echo "✅ Frontend configuration created"
echo ""

# Update the index.html to include the config
if [ -f "/usr/share/nginx/html/index.html" ]; then
    # Add config script if not already present
    if ! grep -q "config.js" /usr/share/nginx/html/index.html; then
        sed -i 's|<head>|<head><script src="/config.js"></script>|' /usr/share/nginx/html/index.html
        echo "✅ Configuration script added to index.html"
    fi
fi

# Display startup information
echo "📋 INFOtrac Configuration Summary:"
echo "=================================="
echo "• Environment: ${VITE_APP_ENV:-production}"
echo "• Version: ${VITE_APP_VERSION:-2.0.0}"
echo "• Supabase URL: $SUPABASE_URL"
echo "• Port: 4211"
echo "• Domain: info.onbb.ca"
echo "• Health Check: https://info.onbb.ca:4211/health.json"
echo ""

# Start nginx with proper signal handling
echo "🎯 Starting Nginx on port 4211..."
echo "🌐 Application will be available at: https://info.onbb.ca:4211"
echo ""

# Replace the shell with nginx so signals are handled properly
exec "$@"