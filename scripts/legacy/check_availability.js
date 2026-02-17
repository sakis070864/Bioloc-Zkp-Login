const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
    try {
        const envPath = path.join(__dirname, '.env.local');
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/GEMINI_API_KEY=(.*)/);
        const apiKey = match[1].trim().replace(/['"]/g, '');

        // Note: The Node SDK generic client doesn't have listModels directly exposed on the genAI instance easily 
        // in all versions, or it might need a specific manager. 
        // We'll use a fetch to the REST API directly for listing to be sure.

        // Actually, usually it's not exposed in the high-level Helper. 
        // Let's try to just hit a known working model to prove the KEY is good.
        const genAI = new GoogleGenerativeAI(apiKey);

        console.log("Checking available models for this key...");

        // Try gemini-1.5-flash
        try {
            const m1 = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            await m1.generateContent("test");
            console.log("- gemini-1.5-flash: AVAILABLE");
        } catch (e) { console.log("- gemini-1.5-flash: " + e.message.split('[')[0]); }

        // Try gemini-2.0-flash-exp
        try {
            const m2 = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
            await m2.generateContent("test");
            console.log("- gemini-2.0-flash-exp: AVAILABLE");
        } catch (e) { console.log("- gemini-2.0-flash-exp: " + e.message.split('[')[0]); }

        // Try gemini-3-flash
        try {
            const m3 = genAI.getGenerativeModel({ model: "gemini-3-flash" });
            await m3.generateContent("test");
            console.log("- gemini-3-flash: AVAILABLE");
        } catch (e) {
            console.log("- gemini-3-flash: FAILED");
            // console.log(e); // too verbose
        }

    } catch (error) {
        console.error("Script Error:", error);
    }
}

listModels();
