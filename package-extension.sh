#!/bin/bash
# package-extension.sh — Creates a clean ZIP for Chrome Web Store & Firefox Add-on submission

# Navigate to the extension directory
cd "$(dirname "$0")/extension" || exit 1

OUTPUT="../ai-chat-export-extension.zip"

# Remove old package
rm -f "$OUTPUT"

# Create ZIP excluding test files, git, or os files
zip -r "$OUTPUT" . \
  -x "*.test.js" \
  -x "*.test.mjs" \
  -x ".DS_Store" \
  -x "Thumbs.db"

echo "Packaged: $OUTPUT ($(du -h "$OUTPUT" | cut -f1))"
