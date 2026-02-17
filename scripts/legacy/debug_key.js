const fs = require('fs');
const path = require('path');

async function checkKey() {
    try {
        const envPath = path.join(__dirname, '.env.local');
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/GEMINI_API_KEY=(.*)/);
        if (!match) { console.log("No Key"); return; }

        const apiKey = match[1].trim().replace(/['"]/g, '');

        console.log(`Querying API with key: ...${apiKey.slice(-4)}`);

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (data.error) {
            console.log("API returned ERROR:");
            console.log(JSON.stringify(data.error, null, 2));
        } else {
            console.log("API Success. Available Models:");
            if (data.models) {
                data.models.forEach(m => console.log(`- ${m.name}`));
            } else {
                console.log("No models returned (Empty list).");
            }
        }

    } catch (err) {
        console.error("Fetch failed:", err.message);
    }
}

checkKey();
