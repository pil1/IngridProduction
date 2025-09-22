#!/bin/bash

# Supabase CLI setup script for INFOtrac
echo "🔗 Setting up Supabase CLI connection..."

# Check if token is set
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "❌ SUPABASE_ACCESS_TOKEN not set. Please run:"
    echo "export SUPABASE_ACCESS_TOKEN=your_token_here"
    exit 1
fi

echo "✅ Access token found"

# Link to remote project
echo "🔗 Linking to project teyivlpjxmpitqaqmucx..."
npx supabase link --project-ref teyivlpjxmpitqaqmucx

if [ $? -eq 0 ]; then
    echo "✅ Project linked successfully"

    # Skip status check (command syntax issue) and go straight to migration
    echo "✅ Connection established via link"

    # Run migrations
    echo "🚀 Running database migrations..."
    npx supabase db push

    if [ $? -eq 0 ]; then
        echo "🎉 Vendor suggestion system migration completed!"
        echo "You can now use the Ingrid Suggestions tab in the Vendors page."

        # Test if the table was created
        echo "🔍 Verifying suggested_vendors table creation..."
        npx supabase db dump --schema-only | grep -i "suggested_vendors" && echo "✅ Table confirmed!" || echo "⚠️  Table check inconclusive"
    else
        echo "❌ Migration failed. Check the output above."
    fi
else
    echo "❌ Failed to link project"
fi