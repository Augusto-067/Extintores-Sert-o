import { schedule } from "@netlify/functions";

export const handler = schedule("30 10 * * *", async () => {
  const url = "https://extintoressertao.netlify.app/.netlify/functions/verificar-extintores";

  const response = await fetch(url);
  const text = await response.text();

  console.log("verificar-extintores:", response.status, text);

  if (!response.ok) {
    throw new Error(
      `verificar-extintores retornou HTTP ${response.status}: ${text}`
    );
  }

  return {
    statusCode: 200,
    body: text
  };
});
