const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testModels() {
    try {
        const envPath = path.join(__dirname, '.env.local');
        if (!fs.existsSync(envPath)) {
            console.log("No .env.local found");
            return;
        }
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/GEMINI_API_KEY=(.*)/);
        if (!match) { console.log("No key found"); return; }

        const apiKey = match[1].trim().replace(/['"]/g, '');
        const genAI = new GoogleGenerativeAI(apiKey);

        const candidates = [
            "gemini-1.5-flash",
            "gemini-1.5-flash-001",
            "gemini-1.5-flash-latest",
            "gemini-1.5-pro",
            "gemini-pro",
            "gemini-1.0-pro"
        ];

        console.log(`Checking ${candidates.length} models with key ending in ...${apiKey.slice(-4)}`);

        for (const modelName of candidates) {
            process.stdout.write(`Testing ${modelName.padEnd(25)} ... `);
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                await model.generateContent("Test");
                console.log("✅ SUCCESS");
            } catch (error) {
                if (error.message.includes("404")) {
                    console.log("❌ 404 (Not Found)");
                } else {
                    console.log(`❌ ERROR: ${error.message.split('[')[0].trim()}`);
                }
            }
        }

    } catch (err) {
        console.error("Script crash:", err);
    }
}

testModels();
