#!/bin/bash

# Build only for main (production) and staging (preview)
if [[ "$VERCEL_GIT_COMMIT_REF" == "main" || "$VERCEL_GIT_COMMIT_REF" == "staging" ]]; then
  echo "✅ Building branch: $VERCEL_GIT_COMMIT_REF"
  exit 1
else
  echo "⛔️ Skipping build for branch: $VERCEL_GIT_COMMIT_REF"
  exit 0
fi

