# Controle de Extintores — Bitrix24 + Netlify

Projeto baseado na V21 que está funcionando dentro do Bitrix24.

## Estrutura

- Bitrix24 continua sendo a base dos extintores.
- Cada registro da categoria 75 é um extintor físico.
- O Netlify faz a verificação automática diária.
- O Netlify atualiza o card técnico **DISPARO E-MAIL**:
  - Entity Type ID: `1130`
  - Card: `131`
  - Campo de informação: `ufCrm45_1790082660`
- O envio do e-mail pode ser feito pela automação nativa do Bitrix24 a partir desse card.

## Verificação automática

Todos os dias às **07:30 (Campo Grande/MS)** a função verifica:

- vencimento do extintor;
- teste hidrostático;
- itens vencidos;
- itens que vencem dentro de 30 dias.

O resultado consolidado é gravado no campo `ufCrm45_1790082660` do card 131.

## Arquivos

- `index.html`, `app.js`, `styles.css`: aplicativo do Bitrix24.
- `netlify/functions/verificar-extintores.mjs`: rotina de verificação e atualização do card.
- `netlify/functions/verificar-extintores-agendado.mjs`: agendamento diário.
- `netlify.toml`: configuração do Netlify.
- `package.json`: dependência das Netlify Functions.

## Configuração no Netlify

No projeto do Netlify, abra **Site configuration → Environment variables** e crie:

```text
BITRIX_WEBHOOK_URL=https://sertao.bitrix24.com.br/rest/SEU_USUARIO/SEU_WEBHOOK
```

Opcionalmente:

```text
BITRIX_ENTITY_TYPE_ID=1130
BITRIX_CATEGORY_ID=75
BITRIX_DISPARO_ITEM_ID=131
BITRIX_INFO_FIELD=ufCrm45_1790082660
EXTINTORES_AVISO_DIAS=30
```

### Importante sobre o webhook

O endereço do webhook contém uma credencial. **Não coloque o webhook dentro do `app.js` nem publique o endereço no GitHub.** Ele deve ficar somente como variável de ambiente privada do Netlify.

## Teste manual

Depois do deploy, a função HTTP pode ser chamada pelo endereço:

```text
/.netlify/functions/verificar-extintores
```

Ela executa a mesma rotina do agendamento e retorna um JSON com a quantidade de registros analisados e de alertas encontrados.

## Próximo passo no Bitrix24

No card **DISPARO E-MAIL**, configurar a automação nativa do Bitrix24 para ler o campo `ufCrm45_1790082660` e enviar o e-mail aos destinatários desejados.

O Netlify não guarda senha nem credencial de e-mail e não usa Supabase.
