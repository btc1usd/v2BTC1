// Global BigInt serializer for JSON
// This ensures BigInt values are automatically converted to strings when JSON.stringify is called

// Add toJSON method to BigInt prototype
if (typeof BigInt !== 'undefined') {
  // Check if toJSON is not already defined
  if (!('toJSON' in BigInt.prototype)) {
    (BigInt.prototype as any).toJSON = function() {
      return this.toString();
    };
  }
}

export {};
