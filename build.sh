#!/bin/bash

# 1. Setup Variables
VERSION="0.5.0"
SOURCE_DIR="extension"  # This tells the script where your code actually lives
DIST_DIR="dist/ral-v$VERSION"
ZIP_NAME="ral-context-v$VERSION.zip"

echo ">> INITIALIZING BUILD PROTOCOL: v$VERSION"

# 2. Clean previous builds
rm -rf dist
mkdir -p "$DIST_DIR"

# 3. Copy ONLY Critical Runtime Files
# We prefix everything with "$SOURCE_DIR/" to find the files correctly
echo ">> MIGRATING RUNTIME ASSETS FROM '$SOURCE_DIR'..."

# Check if source directory exists first
if [ ! -d "$SOURCE_DIR" ]; then
    echo "ERROR: Source directory '$SOURCE_DIR' not found!"
    exit 1
fi

# Copy Manifest
cp "$SOURCE_DIR/manifest.json" "$DIST_DIR/"

# Copy Directories (Recursive)
# We check if they exist to avoid error messages if a folder is missing
[ -d "$SOURCE_DIR/background" ] && cp -r "$SOURCE_DIR/background" "$DIST_DIR/"
[ -d "$SOURCE_DIR/content-scripts" ] && cp -r "$SOURCE_DIR/content-scripts" "$DIST_DIR/"
[ -d "$SOURCE_DIR/popup" ] && cp -r "$SOURCE_DIR/popup" "$DIST_DIR/"
[ -d "$SOURCE_DIR/options" ] && cp -r "$SOURCE_DIR/options" "$DIST_DIR/"
[ -d "$SOURCE_DIR/icons" ] && cp -r "$SOURCE_DIR/icons" "$DIST_DIR/"

# 4. Sanitize (The "Safety" Step)
# Remove dev junk that might be inside those folders
find "$DIST_DIR" -name "*.map" -type f -delete
find "$DIST_DIR" -name ".DS_Store" -type f -delete
find "$DIST_DIR" -name "*test*" -type f -delete
find "$DIST_DIR" -name "*.py" -type f -delete # Remove that generate_icons.py script

# 5. Create the Artifact
echo ">> PACKAGING ARTIFACT..."
cd dist
zip -r "../$ZIP_NAME" "$(basename "$DIST_DIR")"
cd ..

echo ">> BUILD COMPLETE."
echo ">> OUTPUT: $ZIP_NAME"
echo ">> SIZE: $(du -h $ZIP_NAME | cut -f1)"