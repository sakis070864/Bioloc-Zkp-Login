const path = require('path');
try {
  const tailwindPath = require.resolve('tailwindcss');
  console.log(`Successfully resolved tailwindcss at: ${tailwindPath}`);
} catch (error) {
  console.error('Failed to resolve tailwindcss:', error);
  process.exit(1);
}
