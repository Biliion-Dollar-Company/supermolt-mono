#!/bin/bash

# Script to apply production migration to Railway database
# Usage: ./apply-prod-migration.sh

echo "Applying migration to Railway Postgres..."
echo "Host: caboose.proxy.rlwy.net:16739"
echo "User: postgres"
echo ""
echo -n "Enter database password (hidden): "
read -s DB_PASSWORD
echo ""

if [ -z "$DB_PASSWORD" ]; then
  echo "Error: Password cannot be empty"
  exit 1
fi

# Construct DATABASE_URL
# Note: Default database name on Railway is usually 'railway'
export DATABASE_URL="postgresql://postgres:$DB_PASSWORD@caboose.proxy.rlwy.net:16739/railway"

echo "Using Database URL: postgresql://postgres:***@caboose.proxy.rlwy.net:16739/railway"
echo "Running prisma migrate deploy..."

# Run migration using local prisma binary
./node_modules/.bin/prisma migrate deploy

if [ $? -eq 0 ]; then
  echo "✅ Migration applied successfully!"
else
  echo "❌ Migration failed"
  exit 1
fi
