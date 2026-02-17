const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testGemini3() {
    console.log("----- STARTING GEMINI 3 FLASH DIAGNOSTIC -----");

    // 1. Get Key
    const envPath = path.join(__dirname, '.env.local');
    if (!fs.existsSync(envPath)) { console.log("ERROR: No .env.local file."); return; }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/GEMINI_API_KEY=(.*)/);
    if (!match) { console.log("ERROR: No GEMINI_API_KEY in .env.local"); return; }

    const apiKey = match[1].trim().replace(/['"]/g, '');
    console.log(`API Key Loaded: ...${apiKey.slice(-4)}`);

    // 2. Test v1beta SDK
    console.log("\n[TEST 1] SDK (v1beta) - gemini-3-flash");
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash" });
        await model.generateContent("Hello");
        console.log("✅ SDK SUCCESS!");
    } catch (e) {
        console.log(`❌ SDK FAILED: ${e.message.split('[')[0].trim()}`);
    }

    // 3. Test Raw Fetch v1 (Production)
    console.log("\n[TEST 2] Raw Fetch (v1) - gemini-3-flash");
    try {
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-3-flash:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: "Hello" }] }] })
        });
        const data = await res.json();
        if (res.ok) {
            console.log("✅ V1 SUCCESS!");
        } else {
            console.log(`❌ V1 FAILED: ${data.error ? data.error.message : res.statusText}`);
        }
    } catch (e) {
        console.log(`❌ V1 NETWORK ERROR: ${e.message}`);
    }

    // 4. Test Raw Fetch v1beta (Beta)
    console.log("\n[TEST 3] Raw Fetch (v1beta) - gemini-3-flash");
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: "Hello" }] }] })
        });
        const data = await res.json();
        if (res.ok) {
            console.log("✅ V1BETA SUCCESS!");
        } else {
            console.log(`❌ V1BETA FAILED: ${data.error ? data.error.message : res.statusText}`);
        }
    } catch (e) {
        console.log(`❌ V1BETA NETWORK ERROR: ${e.message}`);
    }

    console.log("\n----- DIAGNOSTIC COMPLETE -----");
}

testGemini3();
