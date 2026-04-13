// Constantes globais da aplicação — labels, chaves de campos e URLs de API.

export const FIELD_LABELS = {
  cups:             "CUPS",
  periodo_inicio:   "Período inicio",
  periodo_fin:      "Período fin",
  comercializadora: "Comercializadora",
  pp_p1:            "Precio potencia P1 (€/kW·día)",
  pp_p2:            "Precio potencia P2 (€/kW·día)",
  pp_p3:            "Precio potencia P3 (€/kW·día)",
  pp_p4:            "Precio potencia P4 (€/kW·día)",
  pp_p5:            "Precio potencia P5 (€/kW·día)",
  pp_p6:            "Precio potencia P6 (€/kW·día)",
  imp_ele:          "Impuesto eléctrico (%)",
  iva:              "IVA (%)",
  alq_eq_dia:       "Alquiler equipo (€/día)",
  bono_social:      "Bono social (€)",
  tarifa_acceso:    "Tarifa de acceso",
  distribuidora:    "Distribuidora",
  pot_p1_kw:        "Potencia contratada P1 (kW)",
  pot_p2_kw:        "Potencia contratada P2 (kW)",
  pot_p3_kw:        "Potencia contratada P3 (kW)",
  pot_p4_kw:        "Potencia contratada P4 (kW)",
  pot_p5_kw:        "Potencia contratada P5 (kW)",
  pot_p6_kw:        "Potencia contratada P6 (kW)",
  consumo_p1_kwh:   "Consumo P1 (kWh)",
  consumo_p2_kwh:   "Consumo P2 (kWh)",
  consumo_p3_kwh:   "Consumo P3 (kWh)",
  consumo_p4_kwh:   "Consumo P4 (kWh)",
  consumo_p5_kwh:   "Consumo P5 (kWh)",
  consumo_p6_kwh:   "Consumo P6 (kWh)",
  dias_facturados:  "Días facturados",
  pe_p1:            "Precio energía P1 (€/kWh)",
  pe_p2:            "Precio energía P2 (€/kWh)",
  pe_p3:            "Precio energía P3 (€/kWh)",
  pe_p4:            "Precio energía P4 (€/kWh)",
  pe_p5:            "Precio energía P5 (€/kWh)",
  pe_p6:            "Precio energía P6 (€/kWh)",
  importe_factura:  "Importe factura (€)",
};

// Campos que o utilizador pode preencher/corrigir manualmente no passo 2
export const MANUAL_FIELD_KEYS = [
  "periodo_inicio", "periodo_fin", "comercializadora",
  "pp_p1", "pp_p2", "imp_ele", "iva", "alq_eq_dia", "bono_social", "importe_factura",
];

export const PRECIOS_POT_3TD_KEYS      = ["pp_p3", "pp_p4", "pp_p5", "pp_p6"];
export const PRECIOS_ENERGIA_BASE_KEYS = ["pe_p1", "pe_p2", "pe_p3"];
export const PRECIOS_ENERGIA_3TD_KEYS  = ["pe_p4", "pe_p5", "pe_p6"];

// Campos preenchidos automaticamente pela API (não editáveis no modo PDF)
export const API_AUTO_KEYS = [
  "tarifa_acceso", "distribuidora",
  "pot_p1_kw", "pot_p2_kw", "pot_p3_kw", "pot_p4_kw", "pot_p5_kw", "pot_p6_kw",
  "consumo_p1_kwh", "consumo_p2_kwh", "consumo_p3_kwh",
  "consumo_p4_kwh", "consumo_p5_kwh", "consumo_p6_kwh",
  "dias_facturados",
];

// Tarifas que requerem faturas adicionais para análise completa
export const TARIFAS_MULTI_FACTURA = ["3.0TD", "6.0TD", "6.1TD"];

// Mapeamento de períodos activos por mês para tarifa 3.0TD
export const PERIODOS_POR_MES_3TD = {
  1:  ["p1","p2","p6"],
  2:  ["p1","p2","p6"],
  3:  ["p2","p3","p6"],
  4:  ["p4","p5","p6"],
  5:  ["p4","p5","p6"],
  6:  ["p3","p4","p6"],
  7:  ["p1","p2","p6"],
  8:  ["p3","p4","p6"],
  9:  ["p3","p4","p6"],
  10: ["p4","p5","p6"],
  11: ["p2","p3","p6"],
  12: ["p1","p2","p6"],
};

// CE API proxiada por Vite em dev (evita CORS); em produção usa URL absoluta
export const CE_API_URL = "https://comunidades-energeticas-api-20084454554.catalystserverless.eu/server/api/get-ce-info-lat-lng";

export const API_BASE           = "https://extractor.13.38.9.119.nip.io";
export const SESION_URL         = `${API_BASE}/sesion`;
export const PLAN_REDIRECT_URL  = "https://main.d3rqv6h66vhq03.amplifyapp.com/";
export const QUOTING_URL        = "https://dummyjson.com/test";
export const LEAD_URL           = "https://dummyjson.com/test";
export const NOMINATIM_URL      = "https://nominatim.openstreetmap.org";
export const CE_DETAIL_URL      = "https://comunidades-energeticas-api-20084454554.catalystserverless.eu";

// Mapa de estados de la CE a etiquetas visibles
export const CE_STATUS_LABELS = {
  "Waiting list": "En Espera",
  "Available":    "En Contratación",
};

// TODO: confirmar endpoint com o backend
export const ASESOR_ENVIO_URL    = "https://dummyjson.com/test";
// TODO: confirmar URL de redirecionamento após envío
export const ASESOR_REDIRECT_URL = "https://main.d3rqv6h66vhq03.amplifyapp.com?cups={{cups}}";
