import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
    try {
        const { history } = await req.json(); // history is array of { role: 'user' | 'model', parts: string }

        // Security check for API Key
        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ error: 'AI System Offline (Missing Key)' }, { status: 503 });
        }

        // Validated available model from user key
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // DETERMINE NEXT STEP BASED ON HISTORY LENGTH
        // Count only USER messages to determine the phase
        const userTurns = history.filter((msg: any) => msg.role === 'user').length;
        let prompt = "";

        // System Prompt to enforce persona
        const systemInstruction = `
            You are the "Sentient Guardian", a high-security AI gatekeeper for the BioLock ZKP System.
            Your job is to verify that the human requesting access is a capable professional, not a script kiddie or bot.
            Maintain a cold, precise, cyber-security aesthetic. Use terminology like "Verifying vector", "Analyzing semantics", "Identity challenge".
            Keep responses concise (under 2 sentences).
        `;

        // PHASE 1: INITIALIZATION (User has minimal history)
        if (userTurns === 0) {
            prompt = `${systemInstruction}
            
            Action: The user has initiated the connection.
            Task: Ask them to state their profession and specific role within their organization.
            Tone: Authoritative but neutral.`;
        }
        // PHASE 2: PROFESSION STATED (We have 1 user msg)
        else if (userTurns === 1) {
            prompt = `${systemInstruction}
             
             TRANSCRIPT SO FAR:
             ${JSON.stringify(history)}
             
             Action: The user has stated their profession.
             Task: Ask them exactly how long they have operated in this field (Years/Months).
             Tone: Skeptical.`;
        }
        // PHASE 3: EXPERIENCE STATED (We have 2 user msgs)
        else if (userTurns === 2) {
            prompt = `${systemInstruction}
             
             TRANSCRIPT SO FAR:
             ${JSON.stringify(history)}
             
             Action: The user has stated their experience.
             Task: Generate a ONE very clever, highly technical question relevant to their profession to prove they are an expert. 
             If they are a developer, ask about specific stack nuances. If a doctor, ask about protocols.
             Make it a "Trap" question that specific knowledge is required to answer.
             Tone: Challenging.`;
        }
        // PHASE 4: ANSWER PROVIDED (We have 3 user msgs)
        else if (userTurns >= 3) {
            prompt = `${systemInstruction}
             
             TRANSCRIPT SO FAR:
             ${JSON.stringify(history)}
             
             Action: The user has answered your technical challenge.
             Task: Evaluate the answer based on the question YOU asked previously.

             OUTPUT FORMAT: You must respond with a JSON object.
             {
                "verdict": "APPROVED" | "REJECTED" | "CONTINUE", 
                "reply": "Your explanation here..."
             }
             
             - If answer is NONSENSE/WRONG: verdict="REJECTED", reply="Access Denied: Inaccurate Response."
             - If answer is CORRECT: verdict="APPROVED", reply="Identity Verified. Generating Keys..."
             - If unsure: verdict="CONTINUE", reply="Elaborate on..."
             
             Do not include markdown blocks. Just the raw JSON.`;
        }

        const result = await model.generateContent(prompt);
        const response = result.response;
        let text = response.text();

        // Clean up markdown code blocks if AI adds them
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        let status = "CONTINUE";
        let reply = text;

        try {
            // Attempt to parse structured response
            if (text.startsWith('{')) {
                const json = JSON.parse(text);
                status = json.verdict || "CONTINUE";
                reply = json.reply || text;
            } else {
                // Fallback for earlier phases (non-JSON)
                reply = text;
            }
        } catch (e) {
            console.error("AI JSON Parse Error", e);
            // Fail safe
            status = "CONTINUE";
        }

        return NextResponse.json({
            reply: reply,
            status: status
        });

    } catch (error: any) {
        console.error('AI Error:', error);
        return NextResponse.json({
            error: error.message || 'AI Protocol Failed',
            details: error.toString()
        }, { status: 500 });
    }
}
