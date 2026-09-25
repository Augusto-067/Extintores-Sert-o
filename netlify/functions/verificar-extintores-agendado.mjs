import { schedule } from "@netlify/functions";
import { handler as verificar } from "./verificar-extintores.mjs";

// 08:45 no horário UTC-4 = 12:45 UTC
export const handler = schedule("45 12 * * *", async () => {
  try {
    const response = await verificar();
    const body = await response.text();

    console.log("Verificação agendada:", response.status, body);

    // Não lança erro para evitar retries do Scheduler.
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Erro na verificação agendada:", error);

    // Mantém HTTP 200 para impedir novas tentativas duplicadas.
    return new Response("Erro registrado na verificação", { status: 200 });
  }
});
