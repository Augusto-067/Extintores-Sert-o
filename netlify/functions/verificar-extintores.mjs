const ENTITY_TYPE_ID = Number(process.env.BITRIX_ENTITY_TYPE_ID || 1130);
const CATEGORY_ID = Number(process.env.BITRIX_CATEGORY_ID || 75);
const DISPARO_ITEM_ID = Number(process.env.BITRIX_DISPARO_ITEM_ID || 131);
const INFO_FIELD = process.env.BITRIX_INFO_FIELD || "ufCrm45_1790082660";
const WARNING_DAYS = Number(process.env.EXTINTORES_AVISO_DIAS || 30);

const F = {
  filial: "ufCrm45_1789664364",
  modelo: "ufCrm45_1789994407",
  vencimento: "ufCrm45_1789995511",
  localizacao: "ufCrm45_1789999303",
  hidro: "ufCrm45_1789999332"
};

function webhookUrl() {
  const base = String(process.env.BITRIX_WEBHOOK_URL || "").trim().replace(/\/$/, "");
  if (!base) throw new Error("BITRIX_WEBHOOK_URL não foi configurada no Netlify.");
  return base;
}

async function bx(method, params = {}) {
  const url = `${webhookUrl()}/${method}.json`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });

  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`Resposta inválida do Bitrix em ${method}: ${text.slice(0, 500)}`); }
  if (!response.ok || data.error) {
    throw new Error(`Bitrix ${method}: ${data.error_description || data.error || `HTTP ${response.status}`}`);
  }
  return data.result;
}

function rawValue(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.length ? rawValue(value[0]) : "";
  if (typeof value === "object") {
    return value.value ?? value.VALUE ?? value.NAME ?? value.name ?? value.ID ?? value.id ?? "";
  }
  return value;
}

function values(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap(values).filter(Boolean);
  if (typeof value === "object") return [rawValue(value)].filter(Boolean);
  return [value].filter(Boolean);
}

function enumInfo(meta, key) {
  const field = meta?.fields?.[key] || {};
  const byId = {};
  const byName = {};

  function walk(x) {
    if (!x) return;
    if (Array.isArray(x)) { x.forEach(walk); return; }
    if (typeof x !== "object") return;
    const id = x.ID ?? x.id ?? x.VALUE_ID ?? x.value_id;
    const name = x.VALUE ?? x.value ?? x.NAME ?? x.name;
    if (id != null && name != null) {
      byId[String(id)] = String(name);
      byName[String(name).trim().toLowerCase()] = String(id);
    }
    for (const v of Object.values(x)) {
      if (v && typeof v === "object") walk(v);
    }
  }
  walk(field);
  return { byId, byName };
}

function fieldEnum(meta, key, legacyKey) {
  return enumInfo(meta, key) || enumInfo(meta, legacyKey);
}

function dateOnly(value) {
  const s = String(rawValue(value) || "");
  if (!s) return null;
  let m = s.match(/(\d{4})-(\d\d)-(\d\d)/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = s.match(/(\d\d)\/(\d\d)\/(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return null;
}

function daysUntil(value) {
  const date = dateOnly(value);
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((date - today) / 86400000);
}

function dateBR(value) {
  const date = dateOnly(value);
  return date ? date.toLocaleDateString("pt-BR") : "não informado";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function statusLabel(days) {
  if (days == null) return "não informado";
  if (days < 0) return `VENCIDO há ${Math.abs(days)} dia(s)`;
  if (days === 0) return "VENCE HOJE";
  return `vence em ${days} dia(s)`;
}

function isAttention(days) {
  return days != null && days <= WARNING_DAYS;
}

async function listAllItems() {
  const items = [];
  let start = -1;
  do {
    const params = {
      entityTypeId: ENTITY_TYPE_ID,
      filter: { categoryId: CATEGORY_ID },
      select: ["id", "title", F.filial, F.modelo, F.vencimento, F.localizacao, F.hidro],
      order: { id: "ASC" }
    };
    if (start >= 0) params.start = start;
    const result = await bx("crm.item.list", params);
    items.push(...(result?.items || []));
    start = Number.isInteger(result?.next) ? result.next : -1;
  } while (start >= 0);
  return items;
}

function buildReport(items, enums) {
  const alerts = [];

  for (const item of items) {
    const filialId = String(rawValue(item[F.filial]) || "");
    const modeloId = String(rawValue(item[F.modelo]) || "");
    const filial = enums.filial.byId[filialId] || filialId || "Sem filial";
    const modelo = enums.modelo.byId[modeloId] || modeloId || "Modelo não informado";
    const location = values(item[F.localizacao]).join(", ") || "não informado";
    const vencDays = daysUntil(item[F.vencimento]);
    const hidroDays = daysUntil(item[F.hidro]);

    if (isAttention(vencDays) || isAttention(hidroDays)) {
      alerts.push({
        id: item.id,
        title: item.title || `Extintor #${item.id}`,
        filial,
        modelo,
        location,
        vencimento: item[F.vencimento],
        vencDays,
        hidro: item[F.hidro],
        hidroDays
      });
    }
  }

  alerts.sort((a, b) => {
    const ad = Math.min(a.vencDays ?? Infinity, a.hidroDays ?? Infinity);
    const bd = Math.min(b.vencDays ?? Infinity, b.hidroDays ?? Infinity);
    return ad - bd || String(a.filial).localeCompare(String(b.filial), "pt-BR");
  });

  const checkedAt = new Date().toLocaleString("pt-BR", { timeZone: "America/Campo_Grande" });

  if (!alerts.length) {
    return {
      count: 0,
      html: `<p><b>Controle de Extintores</b></p><p>Nenhum extintor está vencido ou dentro dos próximos ${WARNING_DAYS} dias para vencimento/teste hidrostático.</p><p><small>Última verificação: ${escapeHtml(checkedAt)}</small></p>`
    };
  }

  const rows = alerts.map(a => {
    const venc = a.vencDays != null && a.vencDays <= WARNING_DAYS
      ? `<b>${escapeHtml(dateBR(a.vencimento))}</b> — ${escapeHtml(statusLabel(a.vencDays))}`
      : "fora da janela";
    const hidro = a.hidroDays != null && a.hidroDays <= WARNING_DAYS
      ? `<b>${escapeHtml(dateBR(a.hidro))}</b> — ${escapeHtml(statusLabel(a.hidroDays))}`
      : "fora da janela";
    const link = `https://sertao.bitrix24.com.br/page/uso_e_consumo/rtqioc/type/${ENTITY_TYPE_ID}/details/${a.id}/`;
    return `<tr><td><a href="${link}">${escapeHtml(a.title)} #${escapeHtml(a.id)}</a></td><td>${escapeHtml(a.filial)}</td><td>${escapeHtml(a.modelo)}</td><td>${escapeHtml(a.location)}</td><td>${venc}</td><td>${hidro}</td></tr>`;
  }).join("");

  const html = `<div><p><b>ATENÇÃO — Controle de Extintores</b></p><p>Foram encontrados <b>${alerts.length}</b> extintor(es) vencido(s) ou dentro dos próximos <b>${WARNING_DAYS} dias</b> para vencimento/teste hidrostático.</p><table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%"><thead><tr><th>Extintor</th><th>Filial</th><th>Modelo</th><th>Localização</th><th>Vencimento</th><th>Hidrostático</th></tr></thead><tbody>${rows}</tbody></table><p><small>Última verificação: ${escapeHtml(checkedAt)}</small></p></div>`;
  return { count: alerts.length, html };
}

export async function handler(event) {
  try {
    const meta = await bx("crm.item.fields", { entityTypeId: ENTITY_TYPE_ID });
    const enums = {
      filial: fieldEnum(meta, F.filial, "UF_CRM_45_1789664364"),
      modelo: fieldEnum(meta, F.modelo, "UF_CRM_45_1789994407")
    };

    const items = await listAllItems();
    const report = buildReport(items, enums);

    await bx("crm.item.update", {
      entityTypeId: ENTITY_TYPE_ID,
      id: DISPARO_ITEM_ID,
      fields: {
        [INFO_FIELD]: report.html
      }
    });

    return new Response(JSON.stringify({
      ok: true,
      checked: items.length,
      alerts: report.count,
      itemId: DISPARO_ITEM_ID
    }), { status: 200, headers: { "content-type": "application/json; charset=utf-8" } });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }
}

export default handler;
