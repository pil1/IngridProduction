#!/bin/bash
# Safe Icon Migration Script - Lucide to MynaUI
# Migrates common icon patterns without breaking complex imports

set -e

echo "🔄 Starting safe icon migration..."
echo "=================================="

# Array of files to migrate (excluding already migrated ones)
EXCLUDE_PATTERN="icons\.ts|\.backup\.|IconTestPage|Dashboard\.tsx|enhanced-stat-card|enhanced-dialog|enhanced-sheet|enhanced-drawer|enhanced-dashboard-header|expanded-action-card|enhanced-select"

FILES=$(grep -rl "from ['\"]lucide-react['\"]" src --include="*.tsx" --include="*.ts" | grep -Ev "$EXCLUDE_PATTERN")

TOTAL=$(echo "$FILES" | wc -l)
echo "📁 Found $TOTAL files to migrate"
echo ""

MIGRATED=0
FAILED=0

for file in $FILES; do
  echo "Processing: $file"

  # Skip if already using @/lib/icons
  if grep -q 'from "@/lib/icons"' "$file"; then
    echo "  ⏭️  Already using @/lib/icons, skipping"
    continue
  fi

  # Create backup
  cp "$file" "$file.backup-icons"

  # Extract current lucide imports
  LUCIDE_LINE=$(grep "from ['\"]lucide-react['\"]" "$file" | head -1)

  if [ -z "$LUCIDE_LINE" ]; then
    echo "  ⏭️  No lucide imports found, skipping"
    rm "$file.backup-icons"
    continue
  fi

  # Simple icon replacements (most common, safe patterns)
  # Only replace whole words to avoid partial matches
  sed -i '
    s/\bLoader2\b/LoaderIcon/g
    s/\bSparkles\b/SparklesIcon/g
    s/\bEdit\b/EditIcon/g
    s/\bTrash2\b/DeleteIcon/g
    s/\bPlusCircle\b/AddCircleIcon/g
    s/\bPlus\b/AddIcon/g
    s/\bChevronDown\b/ChevronDownIcon/g
    s/\bChevronUp\b/ChevronUpIcon/g
    s/\bChevronLeft\b/ChevronLeftIcon/g
    s/\bChevronRight\b/ChevronRightIcon/g
    s/\bAlertTriangle\b/AlertTriangleIcon/g
    s/\bAlertCircle\b/AlertCircleIcon/g
    s/\bSave\b/SaveIcon/g
    s/\bEyeOff\b/EyeOffIcon/g
    s/\bEye\b/EyeIcon/g
    s/\bXCircle\b/XCircleIcon/g
    s/\bFileText\b/FileTextIcon/g
    s/\bCheckCircle2\b/CheckCircle2Icon/g
    s/\bCheckCircle\b/CheckCircleIcon/g
    s/\bCheck\b/CheckIcon/g
    s/\bUpload\b/UploadIcon/g
    s/\bDownload\b/DownloadIcon/g
    s/\bShield\b/SecurityIcon/g
    s/\bBrain\b/NeuralIcon/g
    s/\bZap\b/AutomationIcon/g
    s/\bSend\b/SendIcon/g
    s/\bSearch\b/SearchIcon/g
    s/\bMail\b/MailIcon/g
    s/\bLightbulb\b/LightbulbIcon/g
    s/\bRefreshCw\b/RefreshCwIcon/g
    s/\bRefresh\b/RefreshIcon/g
    s/\bCircle\b/CircleIcon/g
    s/\bMoreHorizontal\b/MoreHorizontalIcon/g
    s/\bBuilding2\b/Building2Icon/g
    s/\bBuilding\b/BuildingIcon/g
    s/\bTrendingUp\b/TrendingUpIcon/g
    s/\bTrendingDown\b/TrendingDownIcon/g
    s/\bSettings\b/SettingsIcon/g
    s/\bLock\b/LockIcon/g
    s/\bInfo\b/InfoIcon/g
    s/\bCalendar\b/CalendarIcon/g
    s/\bCopy\b/CopyIcon/g
    s/\bFilter\b/FilterIcon/g
    s/\bHome\b/HomeIcon/g
    s/\bArrowLeft\b/ArrowLeftIcon/g
    s/\bArrowRight\b/ArrowRightIcon/g
    s/\bArrowUp\b/ArrowUpIcon/g
    s/\bArrowDown\b/ArrowDownIcon/g
    s/\bFile\b/FileIcon/g
    s/\bFolder\b/FolderIcon/g
    s/\bImage\b/ImageIcon/g
    s/\bBell\b/BellIcon/g
    s/\bKey\b/KeyIcon/g
    s/\bUser\b/UserIcon/g
    s/\bUsers\b/UsersIcon/g
    s/\bX\b/CloseIcon/g
  ' "$file"

  # Replace import statement
  sed -i 's/from ['\''"]lucide-react['\''"]/from "@\/lib\/icons"/g' "$file"

  # Verify the file still compiles (basic syntax check)
  if node --check "$file" 2>/dev/null; then
    rm "$file.backup-icons"
    ((MIGRATED++))
    echo "  ✅ Migrated ($MIGRATED/$TOTAL)"
  else
    # Restore backup if syntax is broken
    mv "$file.backup-icons" "$file"
    ((FAILED++))
    echo "  ❌ Failed - syntax error, restored backup"
  fi
done

echo ""
echo "=================================="
echo "✨ Migration complete!"
echo "✅ Successfully migrated: $MIGRATED files"
if [ $FAILED -gt 0 ]; then
  echo "❌ Failed: $FAILED files (restored from backup)"
fi
echo ""
echo "Next steps:"
echo "1. Run: npm run build"
echo "2. Fix any build errors manually"
echo "3. Test the application"
echo "4. If successful, remove .backup-icons files"