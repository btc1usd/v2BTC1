import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting merkle tree generation via script...');
    
    // Dynamically import the script
    const scriptPath = require('path').join(process.cwd(), 'scripts', 'generate-merkle-at-block.js');
    
    // Set environment variable for production table
    process.env.SUPABASE_TABLE = 'merkle_distributions_prod';
    
    console.log(`   📝 Using script: ${scriptPath}`);
    console.log(`   💾 Target table: merkle_distributions_prod`);
    
    // Import and run the script
    const { generateMerkleTree } = require(scriptPath);
    
    // Execute the merkle tree generation
    const result = await generateMerkleTree();
    
    console.log('✅ Merkle tree generation completed successfully');
    
    return NextResponse.json({
      success: true,
      merkleRoot: result.merkleRoot,
      totalRewards: result.totalRewards,
      activeHolders: result.activeHolders,
      distributionId: result.distributionId,
      claims: result.claims,
      blockNumber: result.blockNumber,
      table: 'merkle_distributions_prod'
    });

  } catch (error) {
    console.error('💥 Error generating merkle tree:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate merkle tree', 
        details: error instanceof Error ? error.message : 'Unknown error',
        suggestions: [
          'Check server logs for more details',
          'Verify RPC configuration',
          'Ensure Supabase is accessible',
          'Check that generate-merkle-at-block.js script exists'
        ]
      },
      { status: 500 }
    );
  }
}
