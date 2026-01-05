#!/bin/bash

# RAL v4.0 Test Runner
# Helps validate the extension features

echo "🧠 RAL v4.0 Extreme Intelligence - Test Checklist"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📋 Pre-flight Checks${NC}"
echo "--------------------"

# Check if extension directory exists
if [ -d "extension" ]; then
    echo -e "  ${GREEN}✓${NC} Extension directory found"
else
    echo -e "  ${RED}✗${NC} Extension directory not found!"
    exit 1
fi

# Check key files
files=("extension/manifest.json" "extension/content-scripts/selection-tracker.js" "extension/background/service-worker.js" "extension/popup/popup.html")
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "  ${GREEN}✓${NC} $file exists"
    else
        echo -e "  ${RED}✗${NC} $file missing!"
    fi
done

# Check manifest version
version=$(grep '"version"' extension/manifest.json | head -1 | sed 's/.*"\([0-9.]*\)".*/\1/')
echo -e "  ${GREEN}✓${NC} Version: v$version"

echo ""
echo -e "${BLUE}🔍 Code Verification${NC}"
echo "--------------------"

# Check for v4.0 features in selection-tracker.js
tracker="extension/content-scripts/selection-tracker.js"

check_feature() {
    pattern=$1
    name=$2
    if grep -q "$pattern" "$tracker" 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} $name found"
        return 0
    else
        echo -e "  ${RED}✗${NC} $name NOT found!"
        return 1
    fi
}

check_feature "trackUserFrustration" "Frustration Detection"
check_feature "BroadcastChannel" "Cross-Tab Fusion"
check_feature "getBattery" "Battery API"
check_feature "maskSensitiveData" "Privacy Scrubbing"
check_feature "globalContext" "Global Context"

echo ""
echo -e "${BLUE}📊 Line Count Analysis${NC}"
echo "----------------------"
tracker_lines=$(wc -l < "$tracker" | tr -d ' ')
sw_lines=$(wc -l < "extension/background/service-worker.js" | tr -d ' ')
echo "  selection-tracker.js: $tracker_lines lines"
echo "  service-worker.js: $sw_lines lines"

echo ""
echo -e "${BLUE}🧪 Manual Test Instructions${NC}"
echo "----------------------------"
echo ""
echo -e "${YELLOW}Step 1: Load Extension in Chrome${NC}"
echo "  1. Open chrome://extensions"
echo "  2. Enable 'Developer mode'"
echo "  3. Click 'Load unpacked'"
echo "  4. Select: $(pwd)/extension"
echo ""
echo -e "${YELLOW}Step 2: Open Test Page${NC}"
echo "  1. Right-click extension icon > 'Manage extension'"
echo "  2. Find 'Extension ID'"
echo "  3. Navigate to: chrome-extension://<ID>/test/test-v4-features.html"
echo "  OR open: file://$(pwd)/extension/test/test-v4-features.html"
echo ""
echo -e "${YELLOW}Step 3: Test Each Feature${NC}"
echo ""
echo "  ${BLUE}Module 1: Frustration Detection${NC}"
echo "  ├─ [ ] Select same text 4+ times in 60s → Should log FRUSTRATION_DETECTED"
echo "  ├─ [ ] Click code block 5+ times rapidly → Should detect rage clicks"
echo "  └─ [ ] Move mouse in circles rapidly → Should detect rage movement"
echo ""
echo "  ${BLUE}Module 2: Cross-Tab Semantic Fusion${NC}"
echo "  ├─ [ ] Open test page in 2 tabs"
echo "  ├─ [ ] Select different code in each tab"
echo "  └─ [ ] Check console for cross-tab updates"
echo ""
echo "  ${BLUE}Module 3: Hardware-Aware Reality${NC}"
echo "  ├─ [ ] Check battery status in popup"
echo "  └─ [ ] Verify system_constraint when battery <10%"
echo ""
echo "  ${BLUE}Module 4: Privacy Scrubbing${NC}"
echo "  ├─ [ ] Copy text with fake API key (sk-xxx)"
echo "  ├─ [ ] Copy text with email addresses"
echo "  └─ [ ] Console should show 'Privacy scrubbing applied'"
echo ""
echo -e "${YELLOW}Step 4: Test AI Chat Integration${NC}"
echo "  1. Visit ChatGPT or Claude"
echo "  2. Copy code from another tab"
echo "  3. Verify context injection includes:"
echo "     - Global context (if multiple tabs)"
echo "     - System constraints (if low battery)"
echo "     - Behavioral state (if frustrated)"
echo ""
echo -e "${GREEN}✓ Test checklist complete!${NC}"
echo ""
echo "Open the test page and work through each test case."
echo "Check browser console (F12) for RAL v4.0 logs."
