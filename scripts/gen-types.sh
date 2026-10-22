#!/usr/bin/env bash
# Regenerates database types for reference (src/types/db.ts is hand-written and stricter).
set -euo pipefail
: "${SUPABASE_PROJECT_ID:?Set SUPABASE_PROJECT_ID}"
npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_ID" > src/types/supabase.generated.ts
echo "Wrote src/types/supabase.generated.ts"
