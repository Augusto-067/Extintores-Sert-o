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
  hidro: "ufCrm45_1789999332",
  item: "ufCrm45_1790105444"
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
      select: ["id", "title", F.filial, F.modelo, F.vencimento, F.localizacao, F.hidro, F.item],
      order: { id: "ASC" }
    };
    if (start >= 0) params.start = start;
    const result = await bx("crm.item.list", params);
    items.push(...(result?.items || []));
    start = Number.isInteger(result?.next) ? result.next : -1;
  } while (start >= 0);
  return items;
}

function monthYearBR(value) {
  const date = dateOnly(value);
  if (!date) return "Período não informado";
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function monthKey(value) {
  const date = dateOnly(value);
  return date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` : "9999-99";
}

function capitalizeMonth(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function buildReport(items, enums) {
  const alerts = [];

  for (const item of items) {
    const filialId = String(rawValue(item[F.filial]) || "");
    const modeloId = String(rawValue(item[F.modelo]) || "");
    const itemCodigo = String(rawValue(item[F.item]) || "").trim();
    const filial = enums.filial.byId[filialId] || filialId || "Sem filial";
    const modelo = enums.modelo.byId[modeloId] || modeloId || "Modelo não informado";
    const vencDays = daysUntil(item[F.vencimento]);

    // Por enquanto, o alerta considera somente o vencimento.
    if (isAttention(vencDays)) {
      alerts.push({
        id: item.id,
        filial,
        modelo,
        itemCodigo,
        vencimento: item[F.vencimento],
        vencDays
      });
    }
  }

  alerts.sort((a, b) => {
    const ad = a.vencDays ?? Infinity;
    const bd = b.vencDays ?? Infinity;
    return ad - bd || String(a.filial).localeCompare(String(b.filial), "pt-BR") || String(a.modelo).localeCompare(String(b.modelo), "pt-BR");
  });

  if (!alerts.length) {
    return {
      count: 0,
      html: `Controle de Extintores\n\nNenhum extintor está vencido ou dentro dos próximos ${WARNING_DAYS} dias para vencimento.`
    };
  }

  // Agrupa por mês de vencimento e, dentro do mês, por filial/modelo.
  const monthGroups = new Map();
  for (const alert of alerts) {
    const mKey = monthKey(alert.vencimento);
    if (!monthGroups.has(mKey)) {
      monthGroups.set(mKey, {
        label: capitalizeMonth(monthYearBR(alert.vencimento)),
        items: []
      });
    }
    monthGroups.get(mKey).items.push(alert);
  }

  const sections = [];

  for (const group of [...monthGroups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const month = group[1];
    const filialGroups = new Map();

    for (const alert of month.items) {
      if (!filialGroups.has(alert.filial)) filialGroups.set(alert.filial, new Map());
      const modelGroups = filialGroups.get(alert.filial);

      if (!modelGroups.has(alert.modelo)) {
        modelGroups.set(alert.modelo, {
          quantity: 0,
          dates: new Set(),
          items: new Set(),
          minDays: Infinity,
          maxDays: -Infinity
        });
      }

      const model = modelGroups.get(alert.modelo);
      model.quantity += 1;
      model.dates.add(dateBR(alert.vencimento));
      model.items.add(alert.itemCodigo);
      if (alert.vencDays != null) {
        model.minDays = Math.min(model.minDays, alert.vencDays);
        model.maxDays = Math.max(model.maxDays, alert.vencDays);
      }
    }

    let text = `Vencimentos para ${month.label}\n\n`;

    for (const [filial, modelGroups] of filialGroups.entries()) {
      text += `${filial}\n`;

      for (const [modelo, data] of modelGroups.entries()) {
        const dates = [...data.dates].join(", ");
        const itemCodigo = [...data.items].filter(Boolean).join(", ");
        text += `${itemCodigo ? itemCodigo + " " : ""}${modelo}    ${data.quantity}${data.quantity === 1 ? " unidade" : " unidades"} — ${dates}\n`;
      }

      text += `\n`;
    }

    sections.push(text.trim());
  }

  const reportText = `⚠️ ALERTA — CONTROLE DE EXTINTORES\n\nForam encontrados ${alerts.length} extintor(es) vencido(s) ou com vencimento nos próximos ${WARNING_DAYS} dias.\n\n${sections.join("\n\n")}`;

  return { count: alerts.length, html: reportText };
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

    // Só atualiza o card quando o conteúdo realmente mudou.
    // Isso evita disparar o e-mail novamente todos os dias só porque a função rodou.
    const currentItem = await bx("crm.item.get", {
      entityTypeId: ENTITY_TYPE_ID,
      id: DISPARO_ITEM_ID
    });
    const currentReport = String(rawValue(currentItem?.[INFO_FIELD]) || "");
    const changed = currentReport !== report.html;

    if (changed) {
      await bx("crm.item.update", {
        entityTypeId: ENTITY_TYPE_ID,
        id: DISPARO_ITEM_ID,
        fields: {
          [INFO_FIELD]: report.html
        }
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      checked: items.length,
      alerts: report.count,
      itemId: DISPARO_ITEM_ID,
      changed
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
