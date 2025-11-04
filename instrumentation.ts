// This file runs once when the server starts
// Perfect place to add global BigInt serialization for all API routes

export async function register() {
  // Add toJSON method to BigInt prototype for JSON serialization
  if (typeof BigInt !== 'undefined') {
    // Check if toJSON is not already defined
    if (!('toJSON' in BigInt.prototype)) {
      (BigInt.prototype as any).toJSON = function() {
        return this.toString();
      };
    }
  }

  console.log('✅ BigInt JSON serialization enabled globally');
}
