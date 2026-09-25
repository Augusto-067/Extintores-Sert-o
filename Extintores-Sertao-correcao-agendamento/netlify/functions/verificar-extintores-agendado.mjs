import { schedule } from "@netlify/functions";
import { handler as verificar } from "./verificar-extintores.mjs";

// 07:30 no horário de Campo Grande/MS (UTC-3) = 10:30 UTC.
// A função agendada não devolve diretamente a Response do verificador.
// Isso evita que o wrapper do Scheduled Function tente serializar a Response
// e resulte em 502, mesmo quando o processamento do Bitrix terminou corretamente.
export const handler = schedule("30 12 * * *", async () => {
  const response = await verificar();
  const body = await response.text();

  console.log("Verificação agendada:", response.status, body);

  if (!response.ok) {
    throw new Error(`verificar-extintores retornou HTTP ${response.status}: ${body}`);
  }
});
