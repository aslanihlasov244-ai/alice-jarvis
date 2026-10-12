import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userMessage = body.request?.command?.trim() || body.request?.original_utterance?.trim();

    // Если это первый запуск (приветствие от Алисы) или пустой запрос
    if (!userMessage) {
      return NextResponse.json({
        response: { text: "Скажите, чем я могу помочь.", end_session: false },
        session_state: body.state?.session || {},
        version: "1.0",
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("Критическая ошибка: Переменная GEMINI_API_KEY не найдена!");
      return NextResponse.json({
        response: { text: "Сервис временно недоступен из-за настроек ключа.", end_session: false },
        session_state: body.state?.session || {},
        version: "1.0",
      });
    }

    const previousState = body.state?.session || {};
    // Храним только последние 4 сообщения, чтобы не превысить лимит памяти Яндекса (10Кб)
    const history = Array.isArray(previousState.history) ? previousState.history.slice(-4) : [];

    const genAI = new GoogleGenerativeAI(apiKey);
    // Используем gemini-1.5-flash — она самая стабильная, быстрая и дешевая
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: "Ты дружелюбный голосовой помощник для ребенка. Отвечай по-русски, очень коротко (1-2 предложения), простым и понятным языком. Не используй markdown, списки или эмодзи.",
    });

    // Безопасное форматирование истории для Google API
    const formattedHistory = history
      .filter((msg: any) => msg && msg.text)
      .map((msg: any) => ({
        role: msg.role === "model" ? "model" : "user",
        parts: [{ text: String(msg.text) }],
      }));

    const chat = model.startChat({
      history: formattedHistory,
    });

    const result = await chat.sendMessage(userMessage);
    const responseText = result.response.text().trim() || "Я не смог придумать ответ.";

    // Записываем текущую реплику в историю для следующего шага
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
    console.error("Ошибка на сервере (Gemini Route Error):", error);
    // В случае сбоя не сбрасываем историю полностью, возвращаем старую сессию
    return NextResponse.json({
      response: { text: "Произошла ошибка при генерации ответа. Пожалуйста, повторите запрос.", end_session: false },
      session_state: body?.state?.session || {},
      version: "1.0",
    });
  }
}
