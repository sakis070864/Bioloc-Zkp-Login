const { GoogleGenerativeAI } = require("@google/generative-ai");

async function test() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "TEST_KEY");
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash" });

    try {
        const result = await model.generateContent("Hello");
        console.log("Success:", result.response.text());
    } catch (error) {
        console.error("Error:", error.message);
    }
}

test();
