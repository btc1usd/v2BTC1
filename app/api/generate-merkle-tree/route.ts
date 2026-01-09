import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting merkle tree generation via script...');
    
    // Path to the script
    const scriptPath = path.join(process.cwd(), 'scripts', 'generate-merkle-at-block.js');
    console.log('📝 Script path:', scriptPath);
    
    // Execute the Node.js script
    console.log('⚡ Executing script...');
    const { stdout, stderr } = await execAsync(`node "${scriptPath}"`, {
      cwd: process.cwd(),
      env: { ...process.env },
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large output
      timeout: 300000 // 5 minutes timeout
    });
    
    // Log the output
    if (stdout) {
      console.log('📊 Script output:');
      console.log(stdout);
    }
    
    if (stderr) {
      console.warn('⚠️ Script warnings:');
      console.warn(stderr);
    }
    
    // Parse the output to extract merkle root and other info
    // Look for patterns like "Merkle Root: 0x..."
    const merkleRootMatch = stdout.match(/Merkle Root: (0x[a-fA-F0-9]{64})/);
    const totalRewardsMatch = stdout.match(/Total Rewards: ([\d.]+)/);
    const totalClaimsMatch = stdout.match(/Total Claims: (\d+)/);
    const successMatch = stdout.match(/Saved to Supabase successfully/);
    
    if (!successMatch) {
      throw new Error('Script execution did not complete successfully. Check logs for details.');
    }
    
    const merkleRoot = merkleRootMatch ? merkleRootMatch[1] : null;
    const totalRewards = totalRewardsMatch ? totalRewardsMatch[1] : null;
    const totalClaims = totalClaimsMatch ? parseInt(totalClaimsMatch[1]) : null;
    
    if (!merkleRoot) {
      throw new Error('Could not extract merkle root from script output');
    }
    
    console.log('✅ Merkle tree generation completed successfully');
    
    return NextResponse.json({
      success: true,
      merkleRoot,
      totalRewards,
      activeHolders: totalClaims,
      distributionId: '1', // The script handles this internally
      claims: totalClaims,
      message: 'Merkle tree generated and saved to Supabase successfully'
    });
    
  } catch (error) {
    console.error('💥 Error executing merkle generation script:', error);
    
    // Provide detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error && 'stderr' in error 
      ? (error as any).stderr 
      : errorMessage;
    
    return NextResponse.json(
      { 
        error: 'Failed to generate merkle tree', 
        details: errorDetails,
        suggestions: [
          'Check if SUPABASE_SERVICE_ROLE_KEY is set in .env.production',
          'Ensure Alchemy API key is valid',
          'Check if contracts are deployed on the correct network',
          'Review server logs for detailed error messages'
        ]
      },
      { status: 500 }
    );
  }
}
