import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userMessage = body.request?.command?.trim() || body.request?.original_utterance?.trim();

    if (!userMessage) {
      return NextResponse.json({
        response: { text: "Скажите, чем я могу помочь.", end_session: false },
        session_state: body.state?.session || {},
        version: "1.0",
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        response: { text: "Сервис временно недоступен.", end_session: false },
        session_state: body.state?.session || {},
        version: "1.0",
      });
    }

    const previousState = body.state?.session || {};
    const history = Array.isArray(previousState.history) ? previousState.history.slice(-10) : [];

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: "Ты дружелюбный голосовой помощник для ребенка. Отвечай по-русски, очень коротко (1-2 предложения), простым и понятным языком. Не используй markdown, списки или эмодзи.",
    });

    const chat = model.startChat({
      history: history.map((msg: any) => ({
        role: msg.role === "model" ? "model" : "user",
        parts: [{ text: msg.text }],
      })),
    });

    const result = await chat.sendMessage(userMessage);
    const responseText = result.response.text().trim() || "Я не смог понять вопрос.";

    const nextState = {
      history: [
        ...history,
        { role: "user", text: userMessage },
        { role: "model", text: responseText },
      ],
    };

    return NextResponse.json({
      response: { text: responseText, end_session: false },
      session_state: nextState,
      version: "1.0",
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({
      response: { text: "Не получилось обработать запрос. Попробуйте ещё раз.", end_session: false },
      session_state: {},
      version: "1.0",
    });
  }
}
