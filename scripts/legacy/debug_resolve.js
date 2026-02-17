
const path = require('path');
const fs = require('fs');

console.log('Current Workbox:', process.cwd());
try {
    const tailwindPath = require.resolve('tailwindcss');
    console.log('Success! Found tailwindcss at:', tailwindPath);
} catch (e) {
    console.log('Error resolving tailwindcss using standard require.resolve:');
    console.log(e.message);

    // Trace parent directories
    let currentDir = process.cwd();
    console.log('\nScanning parent directories for node_modules:');
    while (currentDir !== path.parse(currentDir).root) {
        const nm = path.join(currentDir, 'node_modules');
        if (fs.existsSync(nm)) {
            console.log(`Found node_modules at: ${nm}`);
            if (fs.existsSync(path.join(nm, 'tailwindcss'))) {
                console.log('  - Contains tailwindcss');
            } else {
                console.log('  - DOES NOT contain tailwindcss');
            }
        }
        currentDir = path.dirname(currentDir);
    }
}
