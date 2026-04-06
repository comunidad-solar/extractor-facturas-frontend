// Utilitários puros — sem dependências de estado React.

import { CE_ID_MAP } from "../constants/ceMappings";
import {
  MANUAL_FIELD_KEYS,
  PRECIOS_POT_3TD_KEYS,
  PRECIOS_ENERGIA_BASE_KEYS,
  PRECIOS_ENERGIA_3TD_KEYS,
} from "../constants/appConstants";

// ── Validação de valor ────────────────────────────────────────────────────────
export const hasValue = (v) => v !== null && v !== undefined && v !== "" && v != 0;

// Objeto inicial para campos manuais do passo 2
export const emptyManual = () =>
  Object.fromEntries(
    [
      ...MANUAL_FIELD_KEYS,
      ...PRECIOS_POT_3TD_KEYS,
      ...PRECIOS_ENERGIA_BASE_KEYS,
      ...PRECIOS_ENERGIA_3TD_KEYS,
    ].map((k) => [k, ""])
  );

// ── Helpers — proximidad CE ───────────────────────────────────────────────────
// Resolve el id_generacion: prioriza query param, luego mapa por nombre
export function resolverIdGeneracion(idGeneracionParam, ceNombre) {
  if (idGeneracionParam) return idGeneracionParam;
  return CE_ID_MAP[ceNombre] || null;
}

// Lookup inverso: dado un id_generacion devuelve el nombre de la CE o null
export function getCeNombreById(id) {
  if (!id) return null;
  return Object.keys(CE_ID_MAP).find(nombre => CE_ID_MAP[nombre] === id) || null;
}

export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Formatação ────────────────────────────────────────────────────────────────
export function fmtES(valor, decimais = 2) {
  if (valor == null) return "0";
  return Number(valor).toLocaleString("es-ES", {
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais,
  });
}

// ── Payloads ──────────────────────────────────────────────────────────────────
// Monta el payload para el endpoint interno de asesores
// TODO: ajustar campos conforme especificación del backend
export function buildPayloadAsesor(mode, facturaData, cupsData, manualFields) {
  if (mode === "pdf") {
    return { origen: "pdf", ...facturaData };
  }
  if (mode === "cups") {
    return { origen: "cups", ...cupsData, ...manualFields };
  }
  return {};
}

// Construye la URL de redirección al quoting con todos los datos como query params
export function buildRedirectURL(baseUrl, cliente, factura, idGen, manualFields, rawData, modoAlquiler, cuotaAlquilerMes) {
  const f = factura ?? {};
  const c = cliente ?? {};
  const mf = manualFields ?? {};
  const rd = rawData ?? {};
  const p = new URLSearchParams();
  p.set("cups",             f.cups             ?? "");
  p.set("periodo_inicio",   f.periodo_inicio   ?? "");
  p.set("periodo_fin",      f.periodo_fin      ?? "");
  p.set("comercializadora", f.comercializadora ?? "");
  p.set("pp_p1",  f.precios_potencia?.p1 ?? "");
  p.set("pp_p2",  f.precios_potencia?.p2 ?? "");
  p.set("pp_p3",  f.precios_potencia?.p3 ?? "");
  p.set("pp_p4",  f.precios_potencia?.p4 ?? "");
  p.set("pp_p5",  f.precios_potencia?.p5 ?? "");
  p.set("pp_p6",  f.precios_potencia?.p6 ?? "");
  p.set("imp_ele",          f.impuestos?.imp_ele  ?? "");
  p.set("iva",              f.impuestos?.iva      ?? "");
  p.set("alq_eq_dia",       f.otros?.alq_eq_dia   ?? "");
  if (hasValue(rd?.importe_factura)) p.set("importe_factura", rd.importe_factura);
  p.set("tarifa_acceso",    f.tarifa_acceso    ?? "");
  p.set("distribuidora",    f.distribuidora    ?? "");
  p.set("pot_p1_kw", f.potencias_kw?.p1 ?? "");
  p.set("pot_p2_kw", f.potencias_kw?.p2 ?? "");
  p.set("pot_p3_kw", f.potencias_kw?.p3 ?? "");
  p.set("pot_p4_kw", f.potencias_kw?.p4 ?? "");
  p.set("pot_p5_kw", f.potencias_kw?.p5 ?? "");
  p.set("pot_p6_kw", f.potencias_kw?.p6 ?? "");
  p.set("consumo_p1_kwh", f.consumos_kwh?.p1 ?? "");
  p.set("consumo_p2_kwh", f.consumos_kwh?.p2 ?? "");
  p.set("consumo_p3_kwh", f.consumos_kwh?.p3 ?? "");
  p.set("consumo_p4_kwh", f.consumos_kwh?.p4 ?? "");
  p.set("consumo_p5_kwh", f.consumos_kwh?.p5 ?? "");
  p.set("consumo_p6_kwh", f.consumos_kwh?.p6 ?? "");
  p.set("dias_facturados", f.dias_facturados ?? "");
  p.set("api_ok",    f.api?.api_ok    ?? "");
  p.set("api_error", f.api?.api_error ?? "");
  p.set("nombre",    c.nombre    ?? "");
  p.set("apellidos", c.apellidos ?? "");
  p.set("correo",    c.correo    ?? "");
  p.set("direccion", c.direccion ?? "");
  // pe_p* — prioridad: manualFields → rawData (facturaData/cupsData)
  [...PRECIOS_ENERGIA_BASE_KEYS, ...PRECIOS_ENERGIA_3TD_KEYS].forEach((k) => {
    const val = mf[k] || rd[k] || "";
    if (val) p.set(k, val);
  });
  if (idGen) p.set("id_generacion", idGen);
  p.set("modo", modoAlquiler ? "alquiler" : "venta");
  if (hasValue(cuotaAlquilerMes)) p.set("cuotaAlquilerMes", cuotaAlquilerMes);
  return `${baseUrl}?${p.toString()}`;
}

// ── Validación ──────────────────────────────────────────────────────────────────────

export function validarDNI(dni) {
  const dniRegex = /^[0-9]{8}[A-Za-z]$/;
  if (!dniRegex.test(dni)) return false;
  const letras = "TRWAGMYFPDXBNJZSQVHLCKE";
  const numero = parseInt(dni.substring(0, 8), 10);
  const letraEsperada = letras[numero % 23];
  return dni.charAt(8).toUpperCase() === letraEsperada;
}

export function validarIBAN(iban) {
  const ibanLimpio = iban.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/.test(ibanLimpio)) return false;
  const reordenado = ibanLimpio.slice(4) + ibanLimpio.slice(0, 4);
  const numerico = reordenado.split("").map(c =>
    isNaN(c) ? c.charCodeAt(0) - 55 : c
  ).join("");
  let resto = 0;
  for (const digito of numerico) {
    resto = (resto * 10 + parseInt(digito, 10)) % 97;
  }
  return resto === 1;
}


// ── Lead ──────────────────────────────────────────────────────────────────────

export async function enviarLead(url, payload, onWarn) {
  if (!url) { onWarn?.(); return; }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    console.log("📤 Lead enviado al backend:", { status: res.status, payload });
  } catch (e) {
    console.warn("⚠️ Error enviando lead al backend:", e);
  }
}
