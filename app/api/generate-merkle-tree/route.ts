import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({
    success: false,
    message: 'Please run the merkle generation script locally',
    instructions: [
      '1. Run: node ./scripts/generate-merkle-at-block.js',
      '2. Ensure SUPABASE_SERVICE_ROLE_KEY is set in .env.production',
      '3. Script will generate merkle tree and save to Supabase',
      '4. Check Supabase for the generated distribution'
    ],
    localCommand: 'node ./scripts/generate-merkle-at-block.js'
  }, { status: 200 });
}
