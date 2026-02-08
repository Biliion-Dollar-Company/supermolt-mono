#!/bin/bash

# SuperMolt Database Migration Runner
# Run this after setting DATABASE_URL environment variable

echo "🔄 Running database migration..."
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL not set"
    echo ""
    echo "Get it from Railway:"
    echo "1. Go to Railway dashboard"
    echo "2. Select SuperMolt project → PostgreSQL"
    echo "3. Connect tab → copy DATABASE_URL"
    echo "4. Run: export DATABASE_URL='your-url-here'"
    echo ""
    exit 1
fi

# Run the migration SQL
echo "📝 Executing SQL migration..."
psql "$DATABASE_URL" < prisma/migrations/add_xp_level_optional_mint.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
    echo ""
    echo "Verifying columns..."
    psql "$DATABASE_URL" -c "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'trading_agents' AND column_name IN ('xp', 'level');"
    echo ""
    psql "$DATABASE_URL" -c "SELECT is_nullable FROM information_schema.columns WHERE table_name = 'agent_tasks' AND column_name = 'tokenMint';"
else
    echo ""
    echo "❌ Migration failed!"
    exit 1
fi
