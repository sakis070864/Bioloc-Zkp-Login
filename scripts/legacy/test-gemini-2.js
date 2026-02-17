const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function test() {
    try {
        // Manually parse .env.local
        const envPath = path.join(__dirname, '.env.local');
        if (!fs.existsSync(envPath)) {
            console.error("Error: .env.local not found at", envPath);
            return;
        }

        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/GEMINI_API_KEY=(.*)/);

        if (!match) {
            console.error("Error: GEMINI_API_KEY not found in .env.local");
            return;
        }

        const apiKey = match[1].trim().replace(/['"]/g, ''); // Remove quotes if present
        console.log("Found API Key length:", apiKey.length); // Log length, not key

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash" });

        console.log("Attempting to connect to model: gemini-3-flash");
        const result = await model.generateContent("Test connection. Respond with 'Online'.");
        console.log("Success:", result.response.text());

    } catch (error) {
        console.error("------ CONNECTION FAILED ------");
        console.error("Error Message:", error.message);
        if (error.response) {
            console.error("Status:", error.response.status);
        }
    }
}

test();
