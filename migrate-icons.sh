#!/bin/bash
# Icon Migration Script - Lucide to MynaUI
# This script automatically migrates Lucide icon imports to MynaUI icons

set -e

echo "Starting icon migration from Lucide to MynaUI..."
echo "================================================"

# Find all TypeScript/TSX files with Lucide imports
FILES=$(grep -rl "from ['\"]lucide-react['\"]" src --include="*.tsx" --include="*.ts" | grep -v "icons.ts" | grep -v ".backup.")

TOTAL=$(echo "$FILES" | wc -l)
echo "Found $TOTAL files to migrate"
echo ""

MIGRATED=0

# Process each file
for file in $FILES; do
  echo "Processing: $file"

  # Create backup
  cp "$file" "$file.lucide-backup"

  # Common icon replacements (most frequent first)
  sed -i 's/\bLoader2\b/LoaderIcon/g' "$file"
  sed -i 's/\bSparkles\b/SparklesIcon/g' "$file"
  sed -i 's/\bX\b\([^C]\)/CloseIcon\1/g' "$file" # X but not XCircle
  sed -i 's/\bEdit\b\([^I]\)/EditIcon\1/g' "$file" # Edit but not EditIcon already
  sed -i 's/\bTrash2\b/DeleteIcon/g' "$file"
  sed -i 's/\bPlusCircle\b/AddCircleIcon/g' "$file"
  sed -i 's/\bPlus\b\([^C]\)/AddIcon\1/g' "$file" # Plus but not PlusCircle
  sed -i 's/\bChevronDown\b/ChevronDownIcon/g' "$file"
  sed -i 's/\bChevronUp\b/ChevronUpIcon/g' "$file"
  sed -i 's/\bChevronLeft\b/ChevronLeftIcon/g' "$file"
  sed -i 's/\bChevronRight\b/ChevronRightIcon/g' "$file"
  sed -i 's/\bAlertTriangle\b/AlertTriangleIcon/g' "$file"
  sed -i 's/\bAlertCircle\b/AlertCircleIcon/g' "$file"
  sed -i 's/\bUser\b\([^sGI]\)/UserIcon\1/g' "$file" # User but not Users/UserGroup/UserIcon
  sed -i 's/\bUsers\b\([^GI]\)/UsersIcon\1/g' "$file" # Users but not UsersGroup
  sed -i 's/\bSave\b/SaveIcon/g' "$file"
  sed -i 's/\bEye\b\([^OS]\)/EyeIcon\1/g' "$file" # Eye but not EyeOff/EyeSlash
  sed -i 's/\bEyeOff\b/EyeOffIcon/g' "$file"
  sed -i 's/\bXCircle\b/XCircleIcon/g' "$file"
  sed -i 's/\bFileText\b/FileTextIcon/g' "$file"
  sed -i 's/\bCheck\b\([^CI]\)/CheckIcon\1/g' "$file" # Check but not CheckCircle/CheckIcon
  sed -i 's/\bCheckCircle2\b/CheckCircle2Icon/g' "$file"
  sed -i 's/\bCheckCircle\b\([^2I]\)/CheckCircleIcon\1/g' "$file"
  sed -i 's/\bUpload\b/UploadIcon/g' "$file"
  sed -i 's/\bDownload\b/DownloadIcon/g' "$file"
  sed -i 's/\bShield\b/SecurityIcon/g' "$file"
  sed -i 's/\bBrain\b/NeuralIcon/g' "$file"
  sed -i 's/\bZap\b/AutomationIcon/g' "$file"
  sed -i 's/\bSend\b/SendIcon/g' "$file"
  sed -i 's/\bSearch\b/SearchIcon/g' "$file"
  sed -i 's/\bMail\b/MailIcon/g' "$file"
  sed -i 's/\bLightbulb\b/LightbulbIcon/g' "$file"
  sed -i 's/\bRefreshCw\b/RefreshCwIcon/g' "$file"
  sed -i 's/\bRefresh\b\([^C]\)/RefreshIcon\1/g' "$file"
  sed -i 's/\bCircle\b\([^I]\)/CircleIcon\1/g' "$file"
  sed -i 's/\bMoreHorizontal\b/MoreHorizontalIcon/g' "$file"
  sed -i 's/\bBuilding2\b/Building2Icon/g' "$file"
  sed -i 's/\bBuilding\b\([^2I]\)/BuildingIcon\1/g' "$file"
  sed -i 's/\bTrendingUp\b/TrendingUpIcon/g' "$file"
  sed -i 's/\bSettings\b/SettingsIcon/g' "$file"
  sed -i 's/\bLock\b\([^OI]\)/LockIcon\1/g' "$file"
  sed -i 's/\bInfo\b/InfoIcon/g' "$file"
  sed -i 's/\bCalendar\b/CalendarIcon/g' "$file"
  sed -i 's/\bCopy\b/CopyIcon/g' "$file"
  sed -i 's/\bFilter\b/FilterIcon/g' "$file"
  sed -i 's/\bHome\b/HomeIcon/g' "$file"
  sed -i 's/\bArrowLeft\b/ArrowLeftIcon/g' "$file"
  sed -i 's/\bArrowRight\b/ArrowRightIcon/g' "$file"
  sed -i 's/\bFile\b\([^TI]\)/FileIcon\1/g' "$file"
  sed -i 's/\bFolder\b/FolderIcon/g' "$file"
  sed -i 's/\bImage\b/ImageIcon/g' "$file"
  sed -i 's/\bBell\b/BellIcon/g' "$file"
  sed -i 's/\bKey\b/KeyIcon/g' "$file"

  # Replace the import statement
  sed -i 's/from ['\''"]lucide-react['\''"]/from "@\/lib\/icons"/g' "$file"

  ((MIGRATED++))
  echo "  ✓ Migrated ($MIGRATED/$TOTAL)"
done

echo ""
echo "================================================"
echo "Migration complete!"
echo "Migrated $MIGRATED files"
echo ""
echo "Backups created with .lucide-backup extension"
echo "Run: npm run build"
echo "If successful, remove backups with: find src -name '*.lucide-backup' -delete"