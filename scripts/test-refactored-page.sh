#!/bin/bash

# Test Refactored Page Script
# This script helps swap and test refactored pages

set -e

PAGE_NAME=${1:-"EnhancedExpensesPage"}
ACTION=${2:-"swap"}

ORIGINAL="src/pages/${PAGE_NAME}.tsx"
REFACTORED="src/pages/${PAGE_NAME}.refactored.tsx"
BACKUP="src/pages/${PAGE_NAME}.backup.tsx"

echo "🧪 Testing Navigation System Refactored Pages"
echo "=============================================="
echo ""

case $ACTION in
  swap)
    if [ ! -f "$REFACTORED" ]; then
      echo "❌ Error: Refactored file not found: $REFACTORED"
      exit 1
    fi

    if [ -f "$ORIGINAL" ]; then
      echo "📦 Backing up original file..."
      mv "$ORIGINAL" "$BACKUP"
      echo "✅ Original backed up to: $BACKUP"
    fi

    echo "🔄 Swapping to refactored version..."
    mv "$REFACTORED" "$ORIGINAL"
    echo "✅ Refactored version is now active!"
    echo ""
    echo "📋 Next steps:"
    echo "  1. Check for TypeScript errors: npx tsc --noEmit"
    echo "  2. Start dev server: docker-compose -f docker-compose.dev.yml up -d"
    echo "  3. Access at: https://dev.onbb.ca:8443"
    echo "  4. Test tab navigation, filters, and actions"
    echo ""
    echo "💡 To rollback: ./scripts/test-refactored-page.sh $PAGE_NAME rollback"
    ;;

  rollback)
    if [ ! -f "$BACKUP" ]; then
      echo "❌ Error: Backup file not found: $BACKUP"
      echo "Cannot rollback without backup."
      exit 1
    fi

    if [ -f "$ORIGINAL" ]; then
      echo "🗑️  Removing current version..."
      mv "$ORIGINAL" "$REFACTORED"
    fi

    echo "⏮️  Rolling back to original..."
    mv "$BACKUP" "$ORIGINAL"
    echo "✅ Rollback complete! Original version restored."
    ;;

  check)
    echo "🔍 Checking TypeScript compilation..."
    npx tsc --noEmit

    if [ $? -eq 0 ]; then
      echo "✅ No TypeScript errors found!"
    else
      echo "❌ TypeScript errors detected. Fix them before deploying."
      exit 1
    fi
    ;;

  *)
    echo "Usage: ./scripts/test-refactored-page.sh [PAGE_NAME] [ACTION]"
    echo ""
    echo "Actions:"
    echo "  swap     - Swap original with refactored version (default)"
    echo "  rollback - Restore original version from backup"
    echo "  check    - Check for TypeScript errors"
    echo ""
    echo "Example:"
    echo "  ./scripts/test-refactored-page.sh EnhancedExpensesPage swap"
    echo "  ./scripts/test-refactored-page.sh EnhancedExpensesPage rollback"
    exit 1
    ;;
esac