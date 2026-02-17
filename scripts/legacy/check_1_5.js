const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function test() {
    const envPath = path.join(__dirname, '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/GEMINI_API_KEY=(.*)/);
    const apiKey = match[1].trim().replace(/['"]/g, '');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    try {
        await model.generateContent("hi");
        console.log("SUCCESS: gemini-1.5-flash");
    } catch (e) {
        console.log("FAIL: gemini-1.5-flash");
        console.log(e.message);
    }
}
test();
