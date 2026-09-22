import { schedule } from "@netlify/functions";
import { handler as verificar } from "./verificar-extintores.mjs";

// 07:30 no horário de Campo Grande/MS (UTC-3) = 10:30 UTC.
export const handler = schedule("30 10 * * *", verificar);
