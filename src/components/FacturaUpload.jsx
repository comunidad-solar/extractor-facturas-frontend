// FacturaUpload.jsx
// Formulario de 2 pasos: datos del cliente → factura (PDF o CUPS).
// Al avanzar de Step 1 a Step 2, verifica proximidad a Comunidades Energéticas
// vía coordenadas del autocomplete Nominatim (OSM) o geocodificación Nominatim (fallback).
// Envía resultado al backend de quoting.

import { useState, useRef, useEffect } from "react";
import "./FacturaUpload.css";
import { CE_ID_MAP } from "../constants/ceMappings";


const FIELD_LABELS = {
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
};

const MANUAL_FIELD_KEYS = [
  "periodo_inicio", "periodo_fin", "comercializadora",
  "pp_p1", "pp_p2", "imp_ele", "iva", "alq_eq_dia",
];

const PRECIOS_POT_3TD_KEYS = ["pp_p3", "pp_p4", "pp_p5", "pp_p6"];

const API_AUTO_KEYS = [
  "tarifa_acceso", "distribuidora",
  "pot_p1_kw", "pot_p2_kw", "pot_p3_kw", "pot_p4_kw", "pot_p5_kw", "pot_p6_kw",
  "consumo_p1_kwh", "consumo_p2_kwh", "consumo_p3_kwh",
  "consumo_p4_kwh", "consumo_p5_kwh", "consumo_p6_kwh",
  "dias_facturados",
];

const hasValue = (v) => v !== null && v !== undefined && v !== "" && v != 0;

const emptyManual = () =>
  Object.fromEntries(
    [...MANUAL_FIELD_KEYS, ...PRECIOS_POT_3TD_KEYS].map((k) => [k, ""])
  );

// ── Helpers — proximidad CE ───────────────────────────────────────────────────
// Resolve el id_generacion: prioriza query param, luego mapa por nombre
function resolverIdGeneracion(idGeneracionParam, ceNombre) {
  if (idGeneracionParam) return idGeneracionParam;
  return CE_ID_MAP[ceNombre] || null;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// CE API proxiada por Vite (evita CORS en dev)
const CE_API_URL = "https://comunidades-energeticas-api-20084454554.catalystserverless.eu/server/api/get-ce-info-lat-lng";

const API_BASE        = "https://extractor.13.38.9.119.nip.io";
const PLAN_REDIRECT_URL = "https://main.d3rqv6h66vhq03.amplifyapp.com/";
const QUOTING_URL       = "https://dummyjson.com/test";
const LEAD_URL        = "https://dummyjson.com/test";
const NOMINATIM_URL   = "https://nominatim.openstreetmap.org";
const CE_DETAIL_URL   = "https://comunidades-energeticas-api-20084454554.catalystserverless.eu";

// Mapa de estados de la CE a etiquetas visibles
const CE_STATUS_LABELS = {
  "Waiting list": "En Espera",
  "Available":    "En Contratación",
};

// TODO: confirmar endpoint com o backend
const ASESOR_ENVIO_URL    = "https://dummyjson.com/test";
// TODO: confirmar URL de redirecionamento após envío
const ASESOR_REDIRECT_URL = "https://main.d3rqv6h66vhq03.amplifyapp.com?cups={{cups}}";

function fmtES(valor, decimais = 2) {
  if (valor == null) return "0";
  return Number(valor).toLocaleString("es-ES", {
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais,
  });
}

// Monta el payload para el endpoint interno de asesores
// TODO: ajustar campos conforme especificación del backend
function buildPayloadAsesor(mode, facturaData, cupsData, manualFields) {
  if (mode === "pdf") {
    return { origen: "pdf", ...facturaData };
  }
  if (mode === "cups") {
    return { origen: "cups", ...cupsData, ...manualFields };
  }
  return {};
}

// Construye la URL de redirección al quoting con todos los datos como query params
function buildRedirectURL(baseUrl, cliente, factura, idGen) {
  const f = factura ?? {};
  const c = cliente ?? {};
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
  if (idGen) p.set("id_generacion", idGen);
  return `${baseUrl}?${p.toString()}`;
}

async function enviarLead(url, payload, onWarn) {
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

export default function FacturaUpload() {
  // ── Steps & navigation ───────────────────────────────────────────────────
  const [step, setStep] = useState(1);  // 1 | 2
  const [mode, setMode] = useState(null); // null | "pdf" | "cups"
  const [modoAsesor, setModoAsesor] = useState(false);

  // ── Step 1 — client data ─────────────────────────────────────────────────
  const [cliente, setCliente] = useState({
    nombre: "", apellidos: "", correo: "", telefono: "", direccion: "",
  });
  const [clienteErrors, setClienteErrors] = useState({});

  // ── Autocomplete dirección (Nominatim) ───────────────────────────────────
  const [nominatimSuggestions, setNominatimSuggestions] = useState([]);
  const [showDropdown, setShowDropdown]                 = useState(false);
  const [userCoords, setUserCoords]                     = useState(null); // {lat, lon}
  const nominatimTimerRef = useRef(null);
  const dropdownRef       = useRef(null);

  // ── Zona check result ─────────────────────────────────────────────────────
  const [Fsmstate, setFsmstate]       = useState(""); // "01_DENTRO_ZONA" | "02_FUERA_ZONA"
  const [fsmPrevious, setFsmPrevious] = useState(null);
  const [ceNombre, setCeNombre]       = useState("");
  const [idGeneracion, setIdGeneracion] = useState("");
  const [ceDireccion, setCeDireccion] = useState("");
  const [ceStatus, setCeStatus]       = useState("");
  const [ceEtiqueta, setCeEtiqueta]   = useState("");
  const [ceDistancia, setCeDistancia] = useState(null); // metros — para banner
  const [ceRadio, setCeRadio]         = useState(null); // radioMetros — para banner
  const [zonaWarn, setZonaWarn]       = useState("");   // aviso no bloqueante
  const [listaCE, setListaCE]         = useState(null); // caché de comunidades
  const listaCERef                    = useRef([]);     // ref para evitar stale closure

  // ── Step 2A — PDF upload ──────────────────────────────────────────────────
  const [file, setFile]               = useState(null);
  const [isDragging, setIsDragging]   = useState(false);
  const [facturaData, setFacturaData] = useState(null);
  const fileRef = useRef();

  // ── Step 2B — CUPS ───────────────────────────────────────────────────────
  const [cups, setCups]               = useState("");
  const [cupsData, setCupsData]       = useState(null);
  const [manualFields, setManualFields] = useState(emptyManual());

  // ── Shared ───────────────────────────────────────────────────────────────
  const [loading, setLoading]         = useState(false);
  const [loadingMsg, setLoadingMsg]   = useState("");
  const [error, setError]             = useState("");
  const [status, setStatus]           = useState("idle"); // "idle"|"analyzed"|"sent"
  const [sending, setSending]         = useState(false);
  const [leadWarn, setLeadWarn]       = useState(false);
  const [planData, setPlanData]       = useState(null);
  const [panelesSel, setPanelesSel]             = useState(3); // valor confirmado — sección Tu plan
  const [panelesPropuesta, setPanelesPropuesta] = useState(3); // valor provisional — stepper
  const [modalOptimizar, setModalOptimizar]     = useState(null); // null | "loading" | planProposta
  const [tabActiva, setTabActiva]     = useState("como"); // "como" | "plan" | "condiciones"

  // ── Modo asesor — detectar ?interno-asesores=true ────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("interno-asesores") === "true") {
      setModoAsesor(true);
    }
    const idGen = params.get("id_generacion");
    if (idGen) setIdGeneracion(idGen);
  }, []);

  // ── Pre-fetch lista CE al montar ──────────────────────────────────────────
  useEffect(() => {
    console.log("🔄 Llamando API de CEs...");
    fetch(CE_API_URL)
      .then(async (response) => {
        console.log("📥 Respuesta API CEs - status:", response.status);
        const data = await response.json();
        console.log("📥 Datos CEs recibidos:", data);
        console.log("📥 Tipo de data:", typeof data, Array.isArray(data));
        console.log("📥 data.data:", data?.data);
        console.log("📥 data.data length:", data?.data?.length);
        const arr = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
        listaCERef.current = arr;
        setListaCE(arr);
      })
      .catch((error) => {
        console.log("❌ Error cargando CEs:", error);
        setListaCE([]);
      });
  }, []);

  // ── Cerrar dropdown al click fuera ────────────────────────────────────────
  useEffect(() => {
    const onClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // ── Handlers — step 1 ────────────────────────────────────────────────────
  const handleCliente = (e) =>
    setCliente({ ...cliente, [e.target.name]: e.target.value });

  const handleDireccionChange = (e) => {
    const val = e.target.value;
    setCliente({ ...cliente, direccion: val });
    setUserCoords(null); // limpiar coords al editar manualmente

    clearTimeout(nominatimTimerRef.current);
    if (val.length < 4) { setNominatimSuggestions([]); setShowDropdown(false); return; }

    nominatimTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${NOMINATIM_URL}/search?q=${encodeURIComponent(val)}&format=json&limit=5&countrycodes=es&addressdetails=1`,
          { headers: { "User-Agent": "ComunidadSolar/1.0", "Accept": "application/json" } }
        );
        const data = await res.json();
        setNominatimSuggestions(data);
        setShowDropdown(data.length > 0);
      } catch {
        setNominatimSuggestions([]); setShowDropdown(false);
      }
    }, 500);
  };

  const handleSelectSuggestion = (item) => {
    setCliente((prev) => ({ ...prev, direccion: item.display_name }));
    setUserCoords({ lat: parseFloat(item.lat), lon: parseFloat(item.lon) });
    setNominatimSuggestions([]);
    setShowDropdown(false);
  };

  const validateCliente = () => {
    const errs = {};
    if (!cliente.nombre.trim())     errs.nombre    = "Obligatorio";
    if (!cliente.apellidos.trim())  errs.apellidos = "Obligatorio";
    if (!cliente.correo.trim())     errs.correo    = "Obligatorio";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cliente.correo.trim()))
      errs.correo = "Introduce un correo electrónico válido";
    if (!cliente.telefono.trim())   errs.telefono  = "Obligatorio";
    else if (!/^(?:\+34|0034)?[679]\d{8}$/.test(cliente.telefono.replace(/\s/g, "")))
      errs.telefono = "Introduce un teléfono español válido (ej: 612345678 o +34 612345678)";
    if (!cliente.direccion.trim())  errs.direccion = "Obligatorio";
    setClienteErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const updateFsmstate = (newState) => {
    setFsmPrevious((prev) => prev !== newState ? (Fsmstate || null) : prev);
    setFsmstate(newState);
  };

  const runZonaCheck = async (lat, lon, ces) => {
    let nearest = null;
    let nearestDist = Infinity;
    let nearestAll = null;
    let nearestAllDist = Infinity;

    for (const ce of ces) {
      const dist = haversineDistance(lat, lon, parseFloat(ce.lat), parseFloat(ce.lng));
      if (dist < nearestAllDist) { nearestAllDist = dist; nearestAll = ce; }
      if (dist <= parseFloat(ce.radioMetros) && dist < nearestDist) { nearestDist = dist; nearest = ce; }
    }

    if (nearest) {
      const distanciaCEMasCercana = Math.round(nearestDist);
      setCeDistancia(distanciaCEMasCercana);
      setCeRadio(nearest.radioMetros);
      updateFsmstate("01_DENTRO_ZONA");

      // Fallback con datos de la lista
      let ceNombreVal    = nearest.name || nearest.addressName || "";
      let ceDireccionVal = nearest.addressName || "";
      let ceStatusVal    = nearest.status || "";
      let ceEtiquetaVal  = nearest.etiqueta || "";

      try {
        const detailRes = await fetch(
          `${CE_DETAIL_URL}/server/api/get-ce-info?name=${encodeURIComponent(ceNombreVal)}`,
          { method: "POST" }
        );
        const detailData = await detailRes.json();
        console.log("📋 Detalle CE:", detailData);
        if (detailData?.data) {
          ceNombreVal    = detailData.data.name    || ceNombreVal;
          ceDireccionVal = detailData.data.addressName || ceDireccionVal;
          ceStatusVal    = detailData.data.status  || "";
          ceEtiquetaVal  = detailData.data.etiqueta || "";
        }
      } catch (e) {
        console.log("⚠️ Error cargando detalle CE, usando datos de lista:", e);
      }

      setCeNombre(ceNombreVal);
      setCeDireccion(ceDireccionVal);
      setCeStatus(ceStatusVal);
      setCeEtiqueta(ceEtiquetaVal);
      console.log("📊 Resultado:", { Fmstate: "01_DENTRO_ZONA", ceNombreVal, ceDireccionVal, ceStatusVal, ceEtiquetaVal, distanciaCEMasCercana });
      return { fsmstate: "01_DENTRO_ZONA", ceNombre: ceNombreVal, ceDireccion: ceDireccionVal, ceStatus: ceStatusVal, ceEtiqueta: ceEtiquetaVal };
    } else {
      const distanciaCEMasCercana = nearestAll ? Math.round(nearestAllDist) : null;
      updateFsmstate("02_FUERA_ZONA");
      setCeDistancia(distanciaCEMasCercana);
      setCeRadio(nearestAll ? nearestAll.radioMetros : null);

      let ceNombreVal    = nearestAll ? (nearestAll.name || nearestAll.addressName || "") : "";
      let ceDireccionVal = nearestAll ? (nearestAll.addressName || "") : "";
      let ceStatusVal    = "";
      let ceEtiquetaVal  = "";

      if (nearestAll && ceNombreVal) {
        try {
          const detailRes = await fetch(
            `${CE_DETAIL_URL}/server/api/get-ce-info?name=${encodeURIComponent(ceNombreVal)}`,
            { method: "POST" }
          );
          const detailData = await detailRes.json();
          console.log("📋 Detalle CE (fuera zona):", detailData);
          if (detailData?.data) {
            ceNombreVal    = detailData.data.name        || ceNombreVal;
            ceDireccionVal = detailData.data.addressName || ceDireccionVal;
            ceStatusVal    = detailData.data.status      || "";
            ceEtiquetaVal  = detailData.data.etiqueta    || "";
          }
        } catch (e) {
          console.log("⚠️ Error cargando detalle CE (fuera zona), usando datos de lista:", e);
        }
      }

      setCeNombre(ceNombreVal);
      setCeDireccion(ceDireccionVal);
      setCeStatus(ceStatusVal);
      setCeEtiqueta(ceEtiquetaVal);
      console.log("📊 Resultado:", { Fmstate: "02_FUERA_ZONA", ceNombreVal, ceDireccionVal, ceStatusVal, ceEtiquetaVal, distanciaCEMasCercana });
      return { fsmstate: "02_FUERA_ZONA", ceNombre: ceNombreVal, ceDireccion: ceDireccionVal, ceStatus: ceStatusVal, ceEtiqueta: ceEtiquetaVal };
    }
  };

  const handleContinuar = async () => {
    if (!validateCliente()) return;

    setLoading(true);
    setLoadingMsg("Verificando tu ubicación...");
    setZonaWarn("");

    try {
      // 1. Obtener coordenadas del usuario
      let userLat, userLon;

      if (userCoords) {
        // Coordenadas ya guardadas del autocomplete Photon
        userLat = userCoords.lat;
        userLon = userCoords.lon;
      } else {
        // Fallback: geocodificar con Nominatim (solo 1 req/s, solo si no hay coords)
        const geoRes = await fetch(
          `${NOMINATIM_URL}/search?q=${encodeURIComponent(cliente.direccion)}&format=json&limit=1&countrycodes=es`,
          { headers: { "User-Agent": "ComunidadSolar/1.0" } }
        );
        const geoData = await geoRes.json();
        if (!geoData.length) {
          setZonaWarn("No pudimos verificar tu dirección. Continuamos sin verificación de zona.");
          updateFsmstate("02_FUERA_ZONA");
          setCeNombre(""); setCeDireccion(""); setCeDistancia(null); setCeRadio(null);
          setStep(2);
          return;
        }
        userLat = parseFloat(geoData[0].lat);
        userLon = parseFloat(geoData[0].lon);
      }

      console.log("📍 Coordenadas usuario:", { lat: userLat, lon: userLon });

      // 2. Usar caché o pedir lista de CEs
      console.log("🔍 CEs en state (listaCE):", listaCE?.length);
      console.log("🔍 CEs en ref (listaCERef):", listaCERef.current?.length);
      console.log("🔍 Primer CE:", listaCERef.current?.[0]);
      let ces = listaCERef.current.length > 0 ? listaCERef.current : listaCE;
      if (!ces || ces.length === 0) {
        const ceRes = await fetch(CE_API_URL);
        const ceData = await ceRes.json();
        ces = Array.isArray(ceData.data) ? ceData.data : (Array.isArray(ceData) ? ceData : []);
        listaCERef.current = ces;
        setListaCE(ces);
      }

      console.log("🏘️ Total CEs cargadas:", ces.length);
      ces.forEach((ce, i) => {
        const dist = haversineDistance(userLat, userLon, ce.lat, ce.lng);
        console.log(`  CE[${i}]: "${ce.name || ce.addressName}" | lat: ${ce.lat} | lng: ${ce.lng} | radioMetros: ${ce.radioMetros} | distancia: ${Math.round(dist)}m | dentro: ${dist <= ce.radioMetros}`);
      });

      // 3. Calcular proximidad con Haversine
      const ceResult = await runZonaCheck(userLat, userLon, ces);
      enviarLead(LEAD_URL, { cliente, ...ceResult, id_generacion: resolverIdGeneracion(idGeneracion, ceResult?.ceNombre) }, () => setLeadWarn(true)); // fire-and-forget
      if (ceResult?.fsmstate === "02_FUERA_ZONA") {
        setStatus("fuera_zona");
      } else {
        setStep(2);
      }
    } catch {
      setZonaWarn("No pudimos verificar tu zona. Continuamos sin verificación de cobertura.");
      updateFsmstate("02_FUERA_ZONA");
      setCeNombre(""); setCeDireccion(""); setCeDistancia(null); setCeRadio(null);
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  // ── Handlers — PDF ───────────────────────────────────────────────────────
  const handleFile = (f) => {
    if (f && f.type === "application/pdf") { setFile(f); setError(""); }
  };

  const handleDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleAnalizarPDF = async () => {
    if (!file) return;
    setLoading(true); setLoadingMsg("Analizando tu factura..."); setError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${API_BASE}/facturas/extraer`, { method: "POST", body: formData });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFacturaData(data);
      setStatus("analyzed");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Handlers — CUPS ──────────────────────────────────────────────────────
  const handleManual = (e) =>
    setManualFields({ ...manualFields, [e.target.name]: e.target.value });

  const handleConsultarCUPS = async () => {
    if (!cups.trim()) return;
    setLoading(true); setLoadingMsg("Consultando CUPS..."); setError("");
    try {
      const res = await fetch(`${API_BASE}/cups/consultar?cups=${encodeURIComponent(cups.trim())}`);
      if (!res.ok) {
        const detail = await res.json().then((d) => d.detail).catch(() => `HTTP ${res.status}`);
        throw new Error(detail);
      }
      const data = await res.json();
      setCupsData(data);
      setManualFields((prev) => ({
        ...prev,
        periodo_inicio: data.periodo_inicio || prev.periodo_inicio,
        periodo_fin:    data.periodo_fin    || prev.periodo_fin,
      }));
      setStatus("analyzed");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Final send ───────────────────────────────────────────────────────────
  const buildFactura = (d) => ({
    cups:             d.cups             || "",
    comercializadora: d.comercializadora || "",
    distribuidora:    d.distribuidora    || "",
    tarifa_acceso:    d.tarifa_acceso    || "",
    periodo_inicio:   d.periodo_inicio   || "",
    periodo_fin:      d.periodo_fin      || "",
    dias_facturados:  d.dias_facturados  || null,
    potencias_kw: {
      p1: d.pot_p1_kw || null, p2: d.pot_p2_kw || null, p3: d.pot_p3_kw || null,
      p4: d.pot_p4_kw || null, p5: d.pot_p5_kw || null, p6: d.pot_p6_kw || null,
    },
    consumos_kwh: {
      p1: d.consumo_p1_kwh || null, p2: d.consumo_p2_kwh || null, p3: d.consumo_p3_kwh || null,
      p4: d.consumo_p4_kwh || null, p5: d.consumo_p5_kwh || null, p6: d.consumo_p6_kwh || null,
    },
    precios_potencia: {
      p1: d.pp_p1 || null, p2: d.pp_p2 || null, p3: d.pp_p3 || null,
      p4: d.pp_p4 || null, p5: d.pp_p5 || null, p6: d.pp_p6 || null,
    },
    impuestos: { imp_ele: d.imp_ele || null, iva: d.iva || null },
    otros: { alq_eq_dia: d.alq_eq_dia || null },
    archivo: {},
    api: { api_ok: d.api_ok ?? null, api_error: d.api_error || "" },
  });

  const buildFacturaPDF = () => {
    if (!facturaData) return {};
    const merged = { ...facturaData, ...Object.fromEntries(
      Object.entries(manualFields).filter(([, v]) => v !== "")
    )};
    return buildFactura(merged);
  };

  const buildFacturaCUPS = () =>
    buildFactura({ cups, ...cupsData, ...manualFields });

  const handleEnviarAsesor = async () => {
    if (sending) return;
    setSending(true); setError("");
    try {
      const fd = new FormData();
      fd.append("data", JSON.stringify({
        cliente, Fsmstate, FsmPrevious: fsmPrevious,
        ce: { nombre: ceNombre, direccion: ceDireccion, status: ceStatus, etiqueta: ceEtiqueta, id_generacion: resolverIdGeneracion(idGeneracion, ceNombre) },
      }));
      const res = await fetch(`${API_BASE}/enviar`, { method: "POST", body: fd });
      if (!res.ok) {
        const detail = await res.json()
          .then((d) => typeof d.detail === "string" ? d.detail : JSON.stringify(d.detail))
          .catch(() => `HTTP ${res.status}`);
        throw new Error(detail);
      }
      setStatus("asesor_solicitado");
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleEnviar = async () => {
    if (sending) return;

    // ── Modo asesor ───────────────────────────────────────────────────────
    if (modoAsesor) {
      if (import.meta.env.DEV) {
        if (!ASESOR_ENVIO_URL) console.warn("[asesor] ASESOR_ENVIO_URL não configurada");
        if (!ASESOR_REDIRECT_URL) console.warn("[asesor] ASESOR_REDIRECT_URL não configurada");
      }
      if (!ASESOR_ENVIO_URL) {
        console.error("[asesor] ASESOR_ENVIO_URL não configurada");
        return;
      }
      setSending(true); setError("");
      try {
        const payload = buildPayloadAsesor(mode, facturaData, cupsData, manualFields);
        await fetch(ASESOR_ENVIO_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const facturaAsesor = mode === "pdf" ? buildFacturaPDF() : buildFacturaCUPS();
        window.location.href = buildRedirectURL(PLAN_REDIRECT_URL, cliente, facturaAsesor, resolverIdGeneracion(idGeneracion, ceNombre));
      } catch (err) {
        console.error("[asesor] Erro no envío:", err);
        setError(err.message);
      } finally {
        setSending(false);
      }
      return; // não continuar para o fluxo normal
    }

    setSending(true); setError(""); setStatus("loading_plan");
    const factura = mode === "pdf" ? buildFacturaPDF() : buildFacturaCUPS();
    try {
      const fd = new FormData();
      fd.append("data", JSON.stringify({
        cliente, factura, Fsmstate, FsmPrevious: fsmPrevious,
        ce: { nombre: ceNombre, direccion: ceDireccion, status: ceStatus, etiqueta: ceEtiqueta, id_generacion: resolverIdGeneracion(idGeneracion, ceNombre) },
      }));
      if (mode === "pdf" && file) fd.append("file", file, file.name);
      const res = await fetch(`${API_BASE}/enviar`, { method: "POST", body: fd });
      if (!res.ok) {
        const detail = await res.json()
          .then((d) => typeof d.detail === "string" ? d.detail : JSON.stringify(d.detail))
          .catch(() => `HTTP ${res.status}`);
        throw new Error(detail);
      }

      // Abrir quoting en nueva pestaña con los datos como query params
      window.open(buildRedirectURL(PLAN_REDIRECT_URL, cliente, factura, resolverIdGeneracion(idGeneracion, ceNombre)), "_blank");

      // Llamar al backend de quoting con los datos de la factura
      const quotingRes = await fetch(QUOTING_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente,
          factura,
          Fsmstate,
          FsmPrevious: fsmPrevious,
          ce: { nombre: ceNombre, direccion: ceDireccion, status: ceStatus, etiqueta: ceEtiqueta, id_generacion: resolverIdGeneracion(idGeneracion, ceNombre) },
        }),
      });
      if (!quotingRes.ok) {
        const detail = await quotingRes.json()
          .then((d) => typeof d.detail === "string" ? d.detail : JSON.stringify(d.detail))
          .catch(() => `HTTP ${quotingRes.status}`);
        throw new Error(detail);
      }
      const plan = await quotingRes.json();
      setPlanData(plan ?? null);
      setPanelesSel(plan?.numeroPaneles ?? 3);
      setPanelesPropuesta(plan?.numeroPaneles ?? 3);
      setStatus("sent");
    } catch (err) {
      setError(err.message);
      setStatus("analyzed");
    } finally {
      setSending(false);
    }
  };

  const handleOptimizar = async () => {
    setModalOptimizar("loading");
    const factura = mode === "pdf" ? buildFacturaPDF() : buildFacturaCUPS();
    const payload = {
      cliente, factura, Fsmstate, FsmPrevious: fsmPrevious,
      ce: { nombre: ceNombre, direccion: ceDireccion, status: ceStatus, etiqueta: ceEtiqueta, id_generacion: resolverIdGeneracion(idGeneracion, ceNombre) },
      numeroPaneles: panelesPropuesta,
    };
    console.log("[optimizar] payload enviado:", payload);
    try {
      const res = await fetch(QUOTING_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const plan = await res.json();
      setModalOptimizar(plan);
    } catch (err) {
      setModalOptimizar(null);
      setError(err.message);
    }
  };

  const handleAceptarPropuesta = () => {
    const proposta = modalOptimizar;
    setPlanData(proposta);
    setPanelesSel(panelesPropuesta);
    setModalOptimizar(null);
    // fire-and-forget: señal de aceptación al backend
    fetch(QUOTING_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...proposta, numeroPaneles: panelesPropuesta, aceptado: true }),
    }).catch(() => {});
  };

  const handleReset = () => {
    setStep(1); setMode(null); setFile(null); setFacturaData(null);
    setCups(""); setCupsData(null); setManualFields(emptyManual());
    setError(""); setStatus("idle"); setSending(false); setClienteErrors({});
    setCliente({ nombre: "", apellidos: "", correo: "", telefono: "", direccion: "" });
    setFsmstate(""); setFsmPrevious(null); setCeNombre(""); setCeDireccion(""); setZonaWarn("");
    setUserCoords(null); setNominatimSuggestions([]); setShowDropdown(false);
    setCeDistancia(null); setCeRadio(null); setPlanData(null); setPanelesSel(3);
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const visibleApiKeys = (data) =>
    API_AUTO_KEYS.filter((k) => hasValue(data?.[k]));

  const ZonaBanner = () => {
    if (!Fsmstate) return null;
    if (Fsmstate === "01_DENTRO_ZONA") {
      return (
        <div style={{
          background:"#f0fdf4", border:"2px solid #22c55e", borderRadius:10,
          padding:"12px 16px", fontSize:13, color:"#166534", marginBottom:20, fontWeight:600,
        }}>
          ✅ DENTRO DE ZONA — CE: {ceNombre} ({ceDistancia}m)
        </div>
      );
    }
    return (
      <div style={{
        background:"#fffbeb", border:"2px solid #f59e0b", borderRadius:10,
        padding:"12px 16px", fontSize:13, color:"#92400e", marginBottom:20, fontWeight:600,
      }}>
        ⚠️ FUERA DE ZONA{ceNombre
          ? ` — CE más cercana: ${ceNombre} a ${ceDistancia}m (radio: ${ceRadio}m)`
          : ""}
      </div>
    );
  };

  return (
    <>


      <div className="cs-page">

        {/* Header */}
        <div className="cs-header">
          <a href="https://comunidad.solar" target="_blank" rel="noreferrer" className="cs-header-logo">
            <img src="/logo.png" alt="Comunidad Solar" style={{ height:38 }} />
          </a>
          <nav className="cs-header-nav">
            <span>🏘️ 3072 comuneros</span>
            <span>🚩 Misión</span>
            <span>📊 Soluciones ∨</span>
            <span>👥 Nosotros</span>
            <span>🎧 Contacto</span>
          </nav>
        </div>

        {/* Indicador modo asesor */}
        {modoAsesor && (
          <div style={{
            textAlign: "center",
            fontSize: 11,
            fontWeight: 600,
            color: "#E48409",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}>
            🔒 Modo interno — Asesores
          </div>
        )}

        {/* ── LOADING ── */}
        {loading && (
          <div className="cs-card fade-in" style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16, padding:"48px 40px" }}>
            <div className="cs-spinner" />
            <span style={{ fontSize:14, color:"#555" }}>{loadingMsg}</span>
            <span style={{ fontSize:12, color:"#aaa" }}>Esto puede tardar unos segundos</span>
          </div>
        )}

        {/* ── PLAN PERSONALIZADO ── */}
        {!loading && status === "sent" && (
          <>
          <div className="cs-results-card fade-in" style={{ maxWidth:1000, padding:"0 0 40px", backgroundColor:"#EEECE8" }}>

            {/* ── HERO ── */}
            <div style={{borderRadius:"16px 16px 0 0", padding:"36px 48px 32px", color:"#fff", marginBottom:0 }}>
              <div className="cs-plan-hero">
                {/* Columna izquierda: texto + ahorro */}
                <div style={{ flex:1, minWidth:220, display:"flex", flexDirection:"column", gap:0 }}>
                  <p style={{ fontSize:22, fontWeight:400, opacity:0.9, marginBottom:4, color:"#000000" }}>
                    Hola <strong>{cliente.nombre}</strong>, estás a un paso de tener
                  </p>
                  <p className="cs-plan-hero-title" style={{ fontSize:46, fontWeight:800, lineHeight:1.1, marginBottom:12, color:"#E48409" }}>
                    tu propia energía a 0€
                  </p>
                  <p style={{ fontSize:18, opacity:0.8, marginBottom:4, color:"#000000"}}>
                    Este es tu fantástico plan en la Comunidad Energética de
                  </p>
                  <p style={{ fontSize:18, fontWeight:700, color:"#000000", marginBottom:20 }}>{ceNombre || "—"}</p>
                  {/* Ahorro destacado — abaixo do texto */}
                  <div style={{ background:"rgb(255, 255, 255)", borderRadius:12, padding:"20px 28px", display:"inline-block", maxWidth:400, boxShadow:"0 2px 12px rgba(0,0,0,0.1)" }}>
                    <p style={{ fontSize:11, opacity:0.8, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6, color:"#000000" }}>Ahorro previsto en 25 años</p>
                    <p style={{ fontSize:48, fontWeight:800, lineHeight:1, color:"#000000"}}>
                      {fmtES(planData?.ahorro25Anos ?? 1575.35 /* TODO: confirmar nombre del campo con el backend */)}€<span style={{ fontSize:22 }}>*</span>
                    </p>
                  </div>
                </div>
                {/* Columna derecha: imagen del edificio */}
                <div className="cs-plan-hero-img" style={{ flex:"0 0 auto", display:"flex", alignItems:"flex-start"}}>
                  <img
                    src="/Intersect.png"
                    alt="Instalación solar"
                    style={{ width:300, height:340, objectFit:"cover", borderRadius:20, display:"block" }}
                  />
                </div>
              </div>
            </div>

            <div className="cs-plan-inner">

              {/* ── IMPORTE A PAGAR ── */}
              <p className="cs-section-label" style={{ marginTop:0, color:"#000000" }}>Importe a pagar</p>
              <div className="cs-plan-pagos">
                {/* Pago único */}
                <div style={{ background:"#fff", border:"2px solid #EEECE8", borderRadius:14, padding:"24px 20px", display:"flex", flexDirection:"column", alignItems:"center", gap:6, boxShadow:"0 2px 12px rgba(0,0,0,0.03)" }}>
                  <p style={{ fontSize:11, fontWeight:700, color:"#000000", textTransform:"uppercase", letterSpacing:"0.08em" }}>Pago único</p>
                  <p style={{ fontSize:38, fontWeight:800, color:"#121212", lineHeight:1.1 }}>
                    {fmtES(planData?.pagoUnico ?? 3480.75 /* TODO: confirmar nombre del campo con el backend */)}€
                  </p>
                  <p style={{ fontSize:11, color:"#aaa" }}>(IVA 21% incluido)</p>
                  <button
                    style={{ marginTop:10, background:"#E48409", color:"#fff", border:"none", borderRadius:24, padding:"10px 28px", fontSize:13, fontWeight:700, fontFamily:"inherit", cursor:"pointer", letterSpacing:"0.05em" }}
                    onClick={() => {}}>
                    CONTRATAR
                  </button>
                </div>
                {/* Financiado */}
                <div style={{ background:"#fff", border:"2px solid #EEECE8", borderRadius:14, padding:"24px 20px", display:"flex", flexDirection:"column", alignItems:"center", gap:6, boxShadow:"0 2px 12px rgba(0,0,0,0.03)"}}>
                  <p style={{ fontSize:11, fontWeight:700, color:"#000000", textTransform:"uppercase", letterSpacing:"0.08em" }}>Financiado</p>
                  <p style={{ fontSize:12, color:"#000000", marginBottom:2 }}>Hasta 120 cuotas mensuales</p>
                  <p style={{ fontSize:38, fontWeight:800, color:"#121212", lineHeight:1.1 }}>
                    {fmtES(planData?.pagoFinanciado ?? 41.33/* TODO: confirmar nombre del campo con el backend */)}€
                  </p>
                  <p style={{ fontSize:11, color:"#aaa" }}>(IVA 21% incluido)</p>
                </div>
              </div>
              {/* ── ORIGEN / DESTINO ── */}
              <div className="cs-plan-origen">
                {/* Tarjeta Origen — CE */}
                <div style={{ flex:1, background:"#fff", borderRadius:14, overflow:"hidden", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
                  <div style={{ position:"relative" }}>
                    <img src="/Intersect.png" alt="Comunidad Energética" style={{ width:"100%", height:160, objectFit:"cover", display:"block" }} />
                    <span style={{ position:"absolute", top:10, left:10, background:"#E48409", color:"#fff", fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", padding:"4px 10px", borderRadius:6 }}>
                      {CE_STATUS_LABELS[ceStatus] || ceStatus || "—"}
                    </span>
                  </div>
                  <div style={{ padding:"14px 16px" }}>
                    <p style={{ fontSize:11, color:"#aaa", marginBottom:2 }}>Origen</p>
                    <p style={{ fontSize:12, color:"#555", marginBottom:2 }}>Comunidad Energética</p>
                    <p style={{ fontSize:14, fontWeight:700, color:"#111", marginBottom:12 }}><strong>{ceNombre || "—"}</strong></p>
                    <button style={{ width:"100%", background:"#E48409", color:"#fff", border:"none", borderRadius:8, padding:"10px", fontSize:13, fontWeight:700, fontFamily:"inherit", cursor:"pointer", letterSpacing:"0.08em" }}>
                      VER MÁS
                    </button>
                  </div>
                </div>

                {/* Conector */}
                <div className="cs-plan-connector">
                  <div style={{ width:12, height:12, borderRadius:"50%", background:"#E48409", flexShrink:0 }} />
                  <div style={{ width:30, height:2, background:"#E48409" }} />
                  <div style={{ width:12, height:12, borderRadius:"50%", background:"#E48409", flexShrink:0 }} />
                </div>

                {/* Tarjeta Destino — domicilio */}
                <div style={{ flex:1, background:"#fff", borderRadius:14, overflow:"hidden", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
                  <img src="/domicilio.png" alt="Domicilio" style={{ width:"100%", height:160, objectFit:"cover", display:"block" }} />
                  <div style={{ padding:"14px 16px" }}>
                    <p style={{ fontSize:11, color:"#aaa", marginBottom:4 }}>Destino</p>
                    <p style={{ fontSize:20, fontWeight:500, color:"#111" }}>{cliente.direccion || "—"}</p>
                  </div>
                </div>

                {/* Métricas de ahorro */}
                <div className="cs-plan-ahorro" style={{ flexShrink:0, marginLeft:16, border:"2px solid #E48409", borderRadius:14, padding:"20px 20px", display:"flex", flexDirection:"column", gap:12, background:"#fff", minWidth:160, justifyContent:"center", alignItems:"center" }}>
                  <p style={{ fontSize:12, fontWeight:700, color:"#E48409", textTransform:"uppercase", letterSpacing:"0.08em", textAlign:"center" }}>AHORRO*</p>
                  <div style={{ textAlign:"center" }}>
                    <p style={{ fontSize:22, fontWeight:800, color:"#E48409", lineHeight:1 }}>{fmtES(planData?.ahorroMensual ?? 38.35)}€</p>
                    <p style={{ fontSize:11, color:"#555", marginTop:4 }}>Al mes</p>
                  </div>
                  <div style={{ textAlign:"center" }}>
                    <p style={{ fontSize:22, fontWeight:800, color:"#E48409", lineHeight:1 }}>{fmtES(planData?.ahorroAnual ?? 460.20)}€</p>
                    <p style={{ fontSize:11, color:"#555", marginTop:4 }}>Al año</p>
                  </div>
                  <div style={{ textAlign:"center" }}>
                    <p style={{ fontSize:22, fontWeight:800, color:"#E48409", lineHeight:1 }}>{fmtES(planData?.ahorro25Anos ?? 1575.35)}€</p>
                    <p style={{ fontSize:11, color:"#555", marginTop:4 }}>En 25 años (estimado)</p>
                  </div>
                </div>
              </div>

              {/* ── TU PLAN + OPTIMIZADOR ── */}
              <div className="cs-plan-tabla">
                {/* Tabla */}
                <div>
                  <p className="cs-section-label" style={{ marginTop:0, color:"#000000" }}>Tu plan</p>
                  <table className="cs-table">
                    <tbody >
                      <tr ><td style={{color:"#000000"}}>Numero de paneles</td><td>{panelesSel}</td></tr>
                      <tr><td style={{color:"#000000"}}>Potencia total</td><td>{parseInt(fmtES(planData?.potenciaTotal ?? 3) /* TODO: confirmar nombre del campo con el backend */)} kWh</td></tr>
                      <tr><td style={{color:"#000000"}}>Producción de energía anual estimada*</td><td>{fmtES(planData?.produccionAnual ?? 4101.25 /* TODO: confirmar nombre del campo con el backend */)} kWh</td></tr>
                      <tr><td style={{color:"#000000"}}>Ahorro anual medio estimado*</td><td>{fmtES(planData?.ahorroAnual ?? 522.48 /* TODO: confirmar nombre del campo con el backend */)} €</td></tr>
                      <tr><td style={{color:"#000000"}}>Ahorro total estimado durante 25 años*</td><td>{fmtES(planData?.ahorro25Anos ?? 15707.25 /* TODO: confirmar nombre del campo con el backend */)} €</td></tr>
                      <tr><td style={{color:"#000000"}}>Coeficiente de distribución sobre total de la instalación</td><td>{fmtES(planData?.coeficienteDistribucion ?? 5  /* TODO: confirmar nombre del campo con el backend */, 0)} %</td></tr>
                      <tr><td style={{color:"#000000"}}>Pago al contado</td><td>{fmtES(planData?.pagoUnico ?? 3480.75 /* TODO: confirmar nombre del campo con el backend */)} €</td></tr>
                      <tr><td style={{color:"#000000"}}>Plazo estimado de recuperación del coste inicial*</td><td>{fmtES(planData?.plazoRecuperacion ?? 6.7 /* TODO: confirmar nombre del campo con el backend */, 1)} años</td></tr>
                    </tbody>
                  </table>
                </div>

                {/* Optimizador de paneles */}
                <div style={{ background:"#F3D5A9", borderRadius:12, padding:"20px 18px", textAlign:"center", minWidth:160, maxWidth:180, display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
                  <p style={{ fontSize:12, fontWeight:700, color:"#000000", textTransform:"uppercase", letterSpacing:"0.06em" }}>Optimiza tu plan</p>
                  <p style={{ fontSize:11, color:"#000000", lineHeight:1.4 }}>Añade o quita paneles solares</p>
                  {/* Stepper */}
                  <div style={{ display:"flex", alignItems:"center", gap:0, background:"#fff", borderRadius:10, border:"1.5px solid #000000", overflow:"hidden" }}>
                    <button
                      onClick={() => setPanelesPropuesta(p => Math.max(1, p - 1))}
                      style={{ background:"none", border:"none", padding:"8px 14px", fontSize:18, fontWeight:700, cursor:"pointer", color:"#E48409", fontFamily:"inherit" }}>
                      −
                    </button>
                    <span style={{ fontSize:20, fontWeight:700, color:"#121212", minWidth:32, textAlign:"center" }}>
                      {panelesPropuesta}
                    </span>
                    <button
                      onClick={() => setPanelesPropuesta(p => p + 1)}
                      style={{ background:"none", border:"none", padding:"8px 14px", fontSize:18, fontWeight:700, cursor:"pointer", color:"#E48409", fontFamily:"inherit" }}>
                      +
                    </button>
                  </div>
                  <p style={{ fontSize:11, color:"#000000", lineHeight:1.4 }}>Te recomendamos 3 paneles
solares, pero puedes solicitar
una cantidad diferente
optimizando tu plan de
participación con un asesor
energético.</p>
                  <button
                    onClick={handleOptimizar}
                    style={{ background:"#fff", color:"#E48409", border:"2px solid #E48409", borderRadius:8, padding:"8px 20px", fontSize:12, fontWeight:700, fontFamily:"inherit", cursor:"pointer", letterSpacing:"0.05em", width:"100%" }}>
                    OPTIMIZAR
                  </button>
                </div>
              </div>

              {/* ── TABS: CÓMO FUNCIONA / TU PLAN / CONDICIONES ── */}
              <div style={{ borderRadius:14, overflow:"hidden", marginBottom:65, boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
                {/* Cabecera de tabs */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr" }}>
                  {[
                    { id:"como",         label:"Cómo funciona" },
                    { id:"plan",         label:"Tu plan" },
                    { id:"condiciones",  label:"Condiciones" },
                  ].map(({ id, label }) => (
                    <button
                      key={id}
                      className="cs-tab-btn"
                      onClick={() => setTabActiva(id)}
                      style={{
                        background: tabActiva === id ? "#fff" : "#F2C080",
                        border: "none",
                        borderBottom: tabActiva === id ? "none" : "2px solid #F3D5A9",
                        padding: "14px 8px",
                        fontSize: 14,
                        fontWeight: 700,
                        fontFamily: "inherit",
                        cursor: "pointer",
                        color: "#111",
                      }}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* Contenido */}
                <div style={{ background:"#fff", padding:"24px 28px", fontSize:13, color:"#333", lineHeight:1.7 }}>

                  {/* ── Cómo funciona ── */}
                  {tabActiva === "como" && (
                    <div>
                      <p style={{ fontWeight:700, color:"#E48409", marginBottom:12 }}>Abierta la fase de Contratación:</p>
                      <p style={{ marginBottom:8 }}>Al pulsar "Contratar", comenzaremos a generar tres documentos:</p>
                      <ul style={{ paddingLeft:20, marginBottom:8 }}>
                        <li>La orden de compra de tus paneles.</li>
                        <li>La participación en la asociación Light for Humanity.</li>
                        <li>Tu alta en la comercializadora de Comunidad Solar, para recibir electricidad a coste cero.</li>
                      </ul>
                      <p style={{ marginBottom:8 }}>Es muy importante que tengas a mano una factura actual de la luz.</p>
                      <p style={{ marginBottom:8 }}>Tus paneles quedarán reservados durante 48 horas; si no firmas la documentación en ese plazo, la reserva quedará sin efecto y volverás a lista de espera. Tras la firma de la documentación, dispondrás de 5 días para realizar el primer pago.</p>
                      <p>Si estás interesado en financiación, podrás solicitarla después de firmar el contrato. En caso de que la entidad bancaria no apruebe la financiación, el contrato no entrará en vigor.</p>
                    </div>
                  )}

                  {/* ── Tu plan ── */}
                  {tabActiva === "plan" && (
                    <div>
                      <p style={{ marginBottom:8 }}>A continuación detallamos tu plan recomendado de participación de autoconsumo en la Comunidad Energética <strong>{ceNombre || "—"}</strong>. Este plan está basado en el consumo eléctrico que nos has facilitado y que te permitirá ahorrar hasta un 70% en tu factura de la luz.</p>
                      <p style={{ marginBottom:8 }}>El plan incluye la compra de <strong>{panelesSel} paneles solares</strong> que generarán un total aproximado de <strong>{fmtES(planData?.produccionAnual)} kWh</strong> de electricidad en un periodo de <strong>{fmtES(planData?.plazoRecuperacion, 0)} años</strong> con un coste inicial de <strong>{fmtES(planData?.pagoUnico)}€</strong>. (El precio podría ser mayor en función del coste final de la instalación para verter a la red eléctrica, de lo que se informaría claramente por anticipado antes de cualquier contratación)</p>
                      <p style={{ marginBottom:8 }}>Al unirte a la Comunidad Energética de <strong>{ceNombre || "—"}</strong>, podrás disfrutar de la electricidad a <strong>0€ por kWh</strong> en tu factura de la luz.</p>
                      <p style={{ marginBottom:4 }}>Basándonos en los precios de energía de los últimos años, obtendrás los siguientes beneficios:</p>
                      <ul style={{ paddingLeft:20, marginBottom:8 }}>
                        <li>Ahorro promedio de <strong>{fmtES(planData?.ahorroAnual)}€</strong> al año.</li>
                        <li>Recuperación de la inversión inicial en solo <strong>{fmtES(planData?.plazoRecuperacion, 1)} años</strong>.</li>
                        <li>Ahorro total estimado de <strong>{fmtES(planData?.ahorro25Anos)}€</strong> en 25 años (considerando una subida del precio de la energía del 0% anual).</li>
                      </ul>
                      <p>Los <strong>{panelesSel} paneles</strong> contienen una potencia nominal total de <strong>{fmtES(planData?.potenciaTotal)} kW</strong>. Lo que quiere decir que el coeficiente de reparto que te pertenece es del <strong>{fmtES(planData?.coeficienteDistribucion, 0)}%</strong> de toda la Comunidad Energética.</p>
                    </div>
                  )}

                  {/* ── Condiciones ── */}
                  {tabActiva === "condiciones" && (
                    <div>
                      <p style={{ marginBottom:8 }}>Al adquirir tu participación en la comunidad energética <strong>{ceNombre || "—"}</strong>, verás reflejada la electricidad generada por tus paneles en tu hogar a través de tu comercializadora. Durante los próximos 25 años, verás reflejada en tu factura de la luz la energía producida por tus paneles solares, con un coste de <strong>0€/kWh</strong>.</p>
                      <p style={{ marginBottom:8 }}>Para el mantenimiento y seguro de tus paneles solares, pagarás una cuota mensual de <strong>0€ + IVA</strong> por cada panel solar. Estos paneles están diseñados para tener una vida útil de 25 años, y esta cuota es necesaria para asegurar su buen funcionamiento.</p>
                      <p style={{ marginBottom:8 }}>Una vez firmada la documentación, el pago se realizará en 3 fases: 50% del total se abonará tras la firma de los documentos, un 25% al finalizar la instalación y el 25% restante al comenzar la producción de la planta.</p>
                      <p style={{ marginBottom:8 }}>Podrás cambiarte a otra comercializadora en cualquier momento, ya que no hay permanencia con la comercializadora de Comunidad Solar. La distribuidora de electricidad ya conoce el porcentaje de producción solar que te corresponde, y la nueva comercializadora deberá descontarte esa producción en tu factura de la luz. Debes tener en cuenta que aunque te cambies de comercializadora, tendrás que seguir abonando la cuota de mantenimiento de tus paneles.</p>
                      <p style={{ marginBottom:8 }}>Toda la electricidad que no consumas será vendida a la red pública a precio de mercado, y ese valor se descontará de tu factura. Para cualquier energía adicional que necesites, pagarás el precio de coste junto con los cargos regulados, sin ningún margen adicional.</p>
                      <p style={{ marginBottom:8 }}>Comunidad Solar no busca obtener beneficios a través de la comercializadora; este es simplemente el mecanismo necesario para llevar la energía a tu hogar.</p>
                      <p>Este es un resumen de las condiciones. Te recomendamos leer toda la documentación para conocer todos los términos y detalles antes de proceder con la contratación.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── MÉTRICAS DE AHORRO ── */}
              <div style={{ background:"#ffffff", borderRadius:12, padding:"20px 28px", marginBottom:65, display:"flex", justifyContent:"space-around", alignItems:"center", textAlign:"center", gap:8, boxShadow:"0 2px 12px rgba(0,0,0,0.05)" }}>
                <div>
                  <p style={{ fontSize:26, fontWeight:800, color:"#E48409", lineHeight:1 }}>{fmtES(planData?.ahorroMensual ?? 38.35 /* TODO: confirmar nombre del campo con el backend */)}€</p>
                  <p style={{ fontSize:11, color:"#000000", marginTop:4 }}>Al mes</p>
                </div>
                <div style={{ width:1, background:"#d0cfc9", alignSelf:"stretch" }} />
                <div>
                  <p style={{ fontSize:26, fontWeight:800, color:"#E48409", lineHeight:1 }}>{fmtES(planData?.ahorroAnual ?? 460.20 /* TODO: confirmar nombre del campo con el backend */)}€</p>
                  <p style={{ fontSize:11, color:"#000000", marginTop:4 }}>Al año</p>
                </div>
                <div style={{ width:1, background:"#d0cfc9", alignSelf:"stretch" }} />
                <div>
                  <p style={{ fontSize:26, fontWeight:800, color:"#E48409", lineHeight:1 }}>{fmtES(planData?.ahorro25Anos ?? 1575.35 /* TODO: confirmar nombre del campo con el backend */)}€</p>
                  <p style={{ fontSize:11, color:"#000000", marginTop:4 }}>En 25 años (estimado)</p>
                </div>
              </div>

              {/* ── REGALO APP ── */}
              <div className="cs-plan-regalo" style={{ background:"#ffffff", boxShadow:"0 2px 12px rgba(0,0,0,0.05)" }}>
                {/* Columna texto */}
                <div style={{ flex:1, minWidth:240 }}>
                  <p style={{ fontSize:30, fontWeight:800, color:"#000000", lineHeight:1.2, marginBottom:16 }}>
                    Tenemos un regalo para ti
                  </p>
                  <p style={{ fontSize:17, fontWeight:700, color:"#000000", lineHeight:1.4, marginBottom:20 }}>
                    Aunque no nos contrates puedes descargarte gratis el asistente energético
                  </p>
                  <p style={{ fontSize:13, color:"rgba(0, 0, 0, 0.75)", lineHeight:1.7, marginBottom:32 }}>
                    Nuestra aplicación te permitirá <strong style={{ color:"#000000" }}>optimizar el uso de energía</strong> en tu hogar, proporcionándote toda la información necesaria para ahorrar y mejorar tu eficiencia energética.
                  </p>
                  <button style={{ background:"#E48409", color:"#000000", border:"none", borderRadius:28, padding:"14px 36px", fontSize:14, fontWeight:800, fontFamily:"inherit", cursor:"pointer", letterSpacing:"0.08em" }}>
                    DESCARGAR
                  </button>
                </div>
                {/* Columna imagen */}
                <div style={{ flex:"0 0 auto" }}>
                  <img src="/App.png" alt="App Comunidad Solar" style={{ height:280, display:"block", objectFit:"contain" }} />
                </div>
              </div>

              {/* ── CONTACTAR CON ASESOR ── */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"#fff", border:"1.5px solid #EEECE8", borderRadius:12, padding:"16px 20px", marginBottom:50, boxShadow:"0 2px 12px rgba(0,0,0,0.03)" }}>
                <span style={{ fontSize:13, color:"#555" }}>¿Tienes dudas?</span>
                <button style={{ background:"transparent", color:"#121212", border:"1.5px solid #121212", borderRadius:24, padding:"8px 20px", fontSize:12, fontWeight:700, fontFamily:"inherit", cursor:"pointer" }} onClick={() => {}}>
                  Contacta con TU asesor
                </button>
              </div>

              {/* ── VOLVER ── */}
              <button className="cs-btn-ghost" onClick={handleReset}>← Volver al inicio</button>

              {/* ── FOOTNOTE ── */}
              <p style={{ fontSize:11, color:"#aaa", marginTop:16, lineHeight:1.6 }}>
                * La electricidad a 0€ es la producida por tus paneles solares, seguirás pagando la energía que no produzcas.
              </p>
            </div>
          </div>

          </>
        )}

        {/* ── FUERA DE ZONA ── */}
        {!loading && status === "fuera_zona" && (
          <div className="cs-card fade-in" style={{ textAlign:"center" }}>
            <div style={{ fontSize:48, marginBottom:16 }}>🕐</div>
            <h2 style={{ fontSize:20, fontWeight:700, color:"#111", marginBottom:8 }}>
              Estás en lista de espera
            </h2>
            <p style={{ fontSize:14, color:"#555", marginBottom:28 }}>
              La comunidad energética más cercana a tu domicilio es{" "}
              <strong>{ceNombre}</strong> y actualmente está en periodo de espera.
              Nos pondremos en contacto contigo en cuanto esté disponible.
            </p>
            <button className="cs-btn-primary" style={{ marginTop:0 }} onClick={() => { setStatus("idle"); setStep(1); }}>
              ← Volver y corregir dirección
            </button>
          </div>
        )}

        {/* ── CARGANDO PLAN ── */}
        {!loading && status === "loading_plan" && (
          <div className="cs-card fade-in" style={{ textAlign:"center", padding:"60px 24px" }}>
            <div style={{ fontSize:48, marginBottom:24 }}>☀️</div>
            <h2 style={{ fontSize:18, fontWeight:700, color:"#111", marginBottom:12 }}>
              Estamos calculando tu plan personalizado…
            </h2>
            <p style={{ fontSize:13, color:"#777", marginBottom:32 }}>
              Esto puede tardar unos segundos.
            </p>
            <div style={{ display:"flex", justifyContent:"center", gap:8 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width:10, height:10, borderRadius:"50%", background:"#E48409",
                  animation:"cs-bounce 1s infinite", animationDelay:`${i*0.2}s`,
                }}/>
              ))}
            </div>
          </div>
        )}

        {/* ── ASESOR SOLICITADO ── */}
        {!loading && status === "asesor_solicitado" && (
          <div className="cs-card fade-in" style={{ textAlign:"center" }}>
            <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
            <h2 style={{ fontSize:20, fontWeight:700, color:"#111", marginBottom:8 }}>
              ¡Solicitud recibida!
            </h2>
            <p style={{ fontSize:14, color:"#555", marginBottom:28, lineHeight:1.7 }}>
              En breve, uno de nuestros asesores se pondrá en contacto contigo.
            </p>
            <button className="cs-btn-ghost" onClick={handleReset}>← Volver al inicio</button>
          </div>
        )}

        {/* ── STEP 1 — Datos del cliente ── */}
        {!loading && status !== "sent" && status !== "fuera_zona" && status !== "asesor_solicitado" && step === 1 && (
          <div className="cs-card fade-in">
            <div className="cs-step-indicator">
              <div className="cs-step-dot active">1</div>
              <span className="cs-step-label active">Datos personales</span>
              <div className="cs-step-line" />
              <div className="cs-step-dot inactive">2</div>
              <span className="cs-step-label inactive">Factura</span>
            </div>

            <h1 style={{ fontSize:22, fontWeight:700, color:"#111", marginBottom:6 }}>
              Tus datos de contacto
            </h1>
            <p style={{ fontSize:14, color:"#777", marginBottom:28 }}>
              Rellena tus datos para que podamos presentarte tu estudio de ahorro solar.
            </p>

            <div className="cs-row">
              <div className="cs-field-group">
                <label className="cs-label">Nombre</label>
                <input className={`cs-input${clienteErrors.nombre ? " error" : ""}`}
                  name="nombre" placeholder="Tu nombre"
                  value={cliente.nombre} onChange={handleCliente} />
                {clienteErrors.nombre && <span className="cs-field-error">{clienteErrors.nombre}</span>}
              </div>
              <div className="cs-field-group">
                <label className="cs-label">Apellidos</label>
                <input className={`cs-input${clienteErrors.apellidos ? " error" : ""}`}
                  name="apellidos" placeholder="Tus apellidos"
                  value={cliente.apellidos} onChange={handleCliente} />
                {clienteErrors.apellidos && <span className="cs-field-error">{clienteErrors.apellidos}</span>}
              </div>
            </div>

            <div className="cs-field-group" style={{ marginBottom:16 }}>
              <label className="cs-label">Correo electrónico</label>
              <input className={`cs-input${clienteErrors.correo ? " error" : ""}`}
                name="correo" type="email" placeholder="tu@correo.com"
                value={cliente.correo} onChange={handleCliente} />
              {clienteErrors.correo && <span className="cs-field-error">{clienteErrors.correo}</span>}
            </div>

            <div className="cs-field-group" style={{ marginBottom:16 }}>
              <label className="cs-label">Teléfono</label>
              <input className={`cs-input${clienteErrors.telefono ? " error" : ""}`}
                name="telefono" type="tel" placeholder="+34 600 000 000"
                value={cliente.telefono} onChange={handleCliente} />
              {clienteErrors.telefono && <span className="cs-field-error">{clienteErrors.telefono}</span>}
            </div>

            <div className="cs-field-group" style={{ marginBottom:16 }} ref={dropdownRef}>
              <label className="cs-label">
                Dirección{userCoords && (
                  <span style={{ color:"#2d7a2d", fontSize:11, fontWeight:600, marginLeft:6 }}>
                    📍 ubicación confirmada
                  </span>
                )}
              </label>
              <div className="cs-autocomplete-wrapper">
                <input
                  className={`cs-input${clienteErrors.direccion ? " error" : ""}`}
                  name="direccion"
                  placeholder="Calle, número, ciudad..."
                  value={cliente.direccion}
                  onChange={handleDireccionChange}
                  autoComplete="off"
                />
                {showDropdown && nominatimSuggestions.length > 0 && (
                  <div className="cs-autocomplete-dropdown">
                    {nominatimSuggestions.map((item, i) => (
                      <div key={i} className="cs-autocomplete-item"
                        onMouseDown={() => handleSelectSuggestion(item)}>
                        {item.display_name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {clienteErrors.direccion && <span className="cs-field-error">{clienteErrors.direccion}</span>}
            </div>

            <button className="cs-btn-primary" onClick={handleContinuar}>
              Continuar →
            </button>
          </div>
        )}

        {/* ── STEP 2 — Factura ── */}
        {!loading && status !== "sent" && status !== "asesor_solicitado" && status !== "loading_plan" && step === 2 && (
          <>
            {/* Option selector */}
            {mode === null && (
              <div className="cs-card fade-in">
                <div className="cs-step-indicator">
                  <div className="cs-step-dot done">✓</div>
                  <span className="cs-step-label active">Datos personales</span>
                  <div className="cs-step-line" />
                  <div className="cs-step-dot active">2</div>
                  <span className="cs-step-label active">Factura</span>
                </div>

                {/* Banner de test — resultado verificación zona */}
                <ZonaBanner />

                {leadWarn && (
                  <div style={{ fontSize:11, color:"#aaa", textAlign:"center", marginBottom:8 }}>
                    ⚠️ VITE_LEAD_URL no configurada — datos no enviados al backend
                  </div>
                )}

                <h1 style={{ fontSize:22, fontWeight:700, color:"#111", marginBottom:6 }}>
                  ¿Tienes tu factura?
                </h1>
                <p style={{ fontSize:14, color:"#777", marginBottom: zonaWarn ? 16 : 28 }}>
                  Elige cómo quieres introducir los datos de tu suministro.
                </p>

                {zonaWarn && (
                  <div className="cs-alert-warn" style={{ marginBottom:20 }}>
                    <span>⚠️</span><div>{zonaWarn}</div>
                  </div>
                )}

                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  <button className="cs-option-btn" onClick={() => setMode("pdf")}>
                    <span className="cs-option-icon">📄</span>
                    <div>
                      <div className="cs-option-title">Subir factura PDF</div>
                      <div className="cs-option-desc">Extraemos automáticamente todos los datos</div>
                    </div>
                  </button>
                  <button className="cs-option-btn" onClick={() => setMode("cups")}>
                    <span className="cs-option-icon">🔍</span>
                    <div>
                      <div className="cs-option-title">No tengo factura — Introducir CUPS</div>
                      <div className="cs-option-desc">Consulta los datos de tu suministro con el código CUPS</div>
                    </div>
                  </button>
                </div>

                <div className="cs-divider" style={{ marginTop:20 }}>
                  <div className="cs-divider-line" />
                  <span>o</span>
                  <div className="cs-divider-line" />
                </div>

                {error && (
                  <div className="cs-alert-err" style={{ marginBottom:12 }}>
                    <span>⚠️</span><div>{error}</div>
                  </div>
                )}

                <button className="cs-btn-phone" onClick={handleEnviarAsesor} disabled={sending}>
                  📞 {sending ? "Enviando..." : "Hablar con un asesor"}
                </button>
                <p style={{ fontSize:12, color:"#aaa", textAlign:"center", marginTop:8 }}>
                  Te llamaremos para ayudarte personalmente
                </p>

                {!modoAsesor && (
                  <button className="cs-btn-ghost" style={{ marginTop:12 }} onClick={() => setStep(1)}>
                    ← Volver
                  </button>
                )}
              </div>
            )}

            {/* ── OPTION A — PDF upload ── */}
            {mode === "pdf" && status === "idle" && (
              <div className="cs-card fade-in">
                <button className="cs-btn-ghost" style={{ marginTop:0, marginBottom:20, width:"auto", padding:"8px 14px", fontSize:13 }}
                  onClick={() => { setMode(null); setFile(null); setError(""); }}>
                  ← Cambiar opción
                </button>

                <h2 style={{ fontSize:20, fontWeight:700, color:"#111", marginBottom:20 }}>
                  Sube tu factura
                </h2>

                {error && (
                  <div className="cs-alert-err">
                    <span>⚠️</span>
                    <div>
                      <strong>Error al analizar la factura</strong>
                      <p style={{ marginTop:4 }}>{error}</p>
                    </div>
                  </div>
                )}

                <div
                  className={`cs-dropzone${isDragging ? " dragging" : ""}${file ? " has-file" : ""}`}
                  onClick={() => fileRef.current.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                >
                  <div style={{ fontSize:32, marginBottom:8 }}>{file ? "📄" : "☁️"}</div>
                  <p style={{ fontSize:14, color:"#555", marginBottom:4 }}>
                    {file ? "Factura cargada correctamente" : "Arrastra tu factura aquí o haz clic para seleccionarla"}
                  </p>
                  {file
                    ? <p style={{ fontSize:13, fontWeight:600, color:"#2d7a2d", marginTop:8 }}>📎 {file.name}</p>
                    : <p style={{ fontSize:12, color:"#aaa" }}>Solo archivos PDF</p>
                  }
                  <input ref={fileRef} type="file" accept=".pdf" style={{ display:"none" }}
                    onChange={(e) => handleFile(e.target.files[0])} />
                </div>

                <button className="cs-btn-primary" onClick={handleAnalizarPDF} disabled={!file}>
                  Analizar factura →
                </button>
              </div>
            )}

            {/* ── OPTION A — PDF results + send ── */}
            {mode === "pdf" && status === "analyzed" && facturaData && (
              <div className="cs-results-card fade-in">
                <div className="cs-results-header">
                  <p style={{ fontSize:18, fontWeight:700, color:"#111" }}>✅ Factura analizada</p>
                  <button className="cs-btn-secondary" onClick={() => { setStatus("idle"); setFacturaData(null); setFile(null); }}>
                    Nueva factura
                  </button>
                </div>

                {error && (
                  <div className="cs-alert-err" style={{ marginBottom:16 }}>
                    <span>⚠️</span><div>{error}</div>
                  </div>
                )}

                <p className="cs-section-label" style={{ marginTop:0 }}>Datos del cliente</p>
                <div className="cs-client-grid" style={{ marginBottom:16 }}>
                  <div className="cs-client-item">
                    <span className="ci-label">Nombre</span>
                    <span className="ci-value">{cliente.nombre} {cliente.apellidos}</span>
                  </div>
                  <div className="cs-client-item">
                    <span className="ci-label">Correo</span>
                    <span className="ci-value">{cliente.correo}</span>
                  </div>
                  <div className="cs-client-item">
                    <span className="ci-label">Teléfono</span>
                    <span className="ci-value">{cliente.telefono}</span>
                  </div>
                  <div className="cs-client-item" style={{ gridColumn:"1 / -1" }}>
                    <span className="ci-label">Dirección</span>
                    <span className="ci-value">{cliente.direccion}</span>
                  </div>
                </div>

                <p className="cs-section-label">Datos extraídos de la factura</p>
                <table className="cs-table" style={{ marginBottom:24 }}>
                  <tbody>
                    {Object.entries(FIELD_LABELS)
                      .filter(([k]) => hasValue(facturaData[k]))
                      .map(([k, label]) => (
                        <tr key={k}>
                          <td>{label}</td>
                          <td>{facturaData[k]}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>

                <button className="cs-btn-primary" style={{ marginTop:0 }} onClick={handleEnviar} disabled={sending}>
                  {sending ? "Enviando..." : "Enviar datos →"}
                </button>
              </div>
            )}

            {/* ── OPTION B — CUPS ── */}
            {mode === "cups" && status === "idle" && (
              <div className="cs-card fade-in">
                <button className="cs-btn-ghost" style={{ marginTop:0, marginBottom:20, width:"auto", padding:"8px 14px", fontSize:13 }}
                  onClick={() => { setMode(null); setCups(""); setCupsData(null); setError(""); }}>
                  ← Cambiar opción
                </button>

                <h2 style={{ fontSize:20, fontWeight:700, color:"#111", marginBottom:8 }}>
                  Introduce tu CUPS
                </h2>
                <p style={{ fontSize:13, color:"#777", marginBottom:20 }}>
                  El CUPS es el código de identificación de tu punto de suministro eléctrico. Puedes encontrarlo en cualquier factura anterior o en tu contrato.
                </p>

                {error && (
                  <div className="cs-alert-err">
                    <span>⚠️</span>
                    <div>
                      <strong>Error al consultar el CUPS</strong>
                      <p style={{ marginTop:4 }}>{error}</p>
                    </div>
                  </div>
                )}

                <div className="cs-field-group">
                  <label className="cs-label">CUPS</label>
                  <input className="cs-input" placeholder="ES0021000000000000AA"
                    value={cups} onChange={(e) => setCups(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleConsultarCUPS()} />
                </div>

                <button className="cs-btn-primary" onClick={handleConsultarCUPS} disabled={!cups.trim()}>
                  Consultar CUPS →
                </button>
              </div>
            )}

            {/* ── OPTION B — CUPS results + manual form + send ── */}
            {mode === "cups" && status === "analyzed" && cupsData && (
              <div className="cs-results-card fade-in">
                <div className="cs-results-header">
                  <p style={{ fontSize:18, fontWeight:700, color:"#111" }}>🔍 Datos del suministro</p>
                  <button className="cs-btn-secondary"
                    onClick={() => { setStatus("idle"); setCupsData(null); setManualFields(emptyManual()); }}>
                    Otro CUPS
                  </button>
                </div>

                {error && (
                  <div className="cs-alert-err" style={{ marginBottom:16 }}>
                    <span>⚠️</span><div>{error}</div>
                  </div>
                )}

                <p className="cs-section-label" style={{ marginTop:0 }}>
                  Datos obtenidos automáticamente
                </p>
                <div className="cs-auto-grid" style={{ marginBottom:20 }}>
                  {visibleApiKeys(cupsData).map((k) => (
                    <div key={k} className="cs-auto-item">
                      <span className="ai-label">{FIELD_LABELS[k]}</span>
                      <span className="ai-value">{cupsData[k]}</span>
                    </div>
                  ))}
                </div>

                <p className="cs-section-label">Completa los datos restantes</p>
                <div className="cs-manual-grid">
                  {(cupsData?.tarifa_acceso !== "2.0TD"
                    ? [...MANUAL_FIELD_KEYS, ...PRECIOS_POT_3TD_KEYS]
                    : MANUAL_FIELD_KEYS
                  ).map((k) => (
                    <div key={k} className="cs-field-group">
                      <label className="cs-label">{FIELD_LABELS[k]}</label>
                      <input className="cs-input" name={k}
                        placeholder="Introduce el valor"
                        value={manualFields[k]} onChange={handleManual} />
                    </div>
                  ))}
                </div>

                <button className="cs-btn-primary" style={{ marginTop:8 }} onClick={handleEnviar} disabled={sending}>
                  {sending ? "Enviando..." : "Enviar datos →"}
                </button>
              </div>
            )}
          </>
        )}

      </div>

      {/* ── MODAL OPTIMIZAR ── */}
      {modalOptimizar !== null && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#fff", borderRadius:16, padding:"32px 28px", maxWidth:560, width:"100%", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 8px 40px rgba(0,0,0,0.18)" }}>
            {modalOptimizar === "loading" ? (
              <div style={{ textAlign:"center", padding:"40px 0" }}>
                <div style={{ fontSize:40, marginBottom:20 }}>☀️</div>
                <p style={{ fontSize:15, fontWeight:700, color:"#111", marginBottom:8 }}>Calculando tu nueva propuesta…</p>
                <p style={{ fontSize:13, color:"#777", marginBottom:28 }}>Esto puede tardar unos segundos.</p>
                <div style={{ display:"flex", justifyContent:"center", gap:8 }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width:10, height:10, borderRadius:"50%", background:"#E48409", animation:"cs-bounce 1s infinite", animationDelay:`${i*0.2}s` }} />
                  ))}
                </div>
              </div>
            ) : (
              <>
                <h3 style={{ fontSize:16, fontWeight:700, color:"#111", marginBottom:20 }}>
                  Propuesta con {panelesPropuesta} paneles
                </h3>
                <table className="cs-table" style={{ marginBottom:20 }}>
                  <tbody>
                    <tr><td>Numero de paneles</td><td>{panelesPropuesta}</td></tr>
                    <tr><td>Potencia total</td><td>{parseInt(fmtES(modalOptimizar?.potenciaTotal ?? 0))} kWh</td></tr>
                    <tr><td>Producción de energía anual estimada*</td><td>{fmtES(modalOptimizar?.produccionAnual ?? 0)} kWh</td></tr>
                    <tr><td>Ahorro anual medio estimado*</td><td>{fmtES(modalOptimizar?.ahorroAnual ?? 0)} €</td></tr>
                    <tr><td>Ahorro total estimado durante 25 años*</td><td>{fmtES(modalOptimizar?.ahorro25Anos ?? 0)} €</td></tr>
                    <tr><td>Coeficiente de distribución</td><td>{fmtES(modalOptimizar?.coeficienteDistribucion ?? 0, 0)} %</td></tr>
                    <tr><td>Pago al contado</td><td>{fmtES(modalOptimizar?.pagoUnico ?? 0)} €</td></tr>
                    <tr><td>Plazo estimado de recuperación*</td><td>{fmtES(modalOptimizar?.plazoRecuperacion ?? 0, 1)} años</td></tr>
                  </tbody>
                </table>
                <div style={{ display:"flex", gap:12 }}>
                  <button className="cs-btn-ghost" style={{ flex:1, marginTop:0 }} onClick={() => setModalOptimizar(null)}>
                    ← Volver
                  </button>
                  <button className="cs-btn-primary" style={{ flex:1, marginTop:0 }} onClick={handleAceptarPropuesta}>
                    Aceptar propuesta
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── FOOTER ── */}
          <footer style={{ background:"#121212", color:"#fff", padding:"48px 40px 0", width:"100vw", marginLeft:"calc(-50vw + 50%)" }}>
            <div style={{ maxWidth:1000, margin:"0 auto" }}>
              <div style={{ display:"flex", flexWrap:"wrap", gap:40, justifyContent:"space-between", paddingBottom:40, borderBottom:"1px solid rgba(255,255,255,0.1)" }}>

                {/* Columna logo */}
                <div style={{ minWidth:160 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20 }}>
                    <img src="/logo.png" alt="Comunidad Solar" style={{ height:32 }} />
                  </div>
                  <div style={{ display:"flex", gap:12, marginBottom:16 }}>
                    {["f", "▶", "in", "ig"].map((icon, i) => (
                      <div key={i} style={{ width:32, height:32, borderRadius:"50%", background:"rgba(255,255,255,0.12)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                        {icon}
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize:12, color:"rgba(255,255,255,0.5)", marginBottom:8, cursor:"pointer" }}>CS en medios de comunicación</p>
                  <p style={{ fontSize:12, color:"rgba(255,255,255,0.5)", cursor:"pointer" }}>Blog</p>
                </div>

                {/* Servicios */}
                <div style={{ minWidth:160 }}>
                  <p style={{ fontWeight:700, fontSize:13, marginBottom:16, color:"#fff" }}>Servicios</p>
                  {["Autoconsumo Remoto","Comunidades Energéticas","Autoconsumo Individual","Anfitrión Solar","Comercializadora"].map(item => (
                    <p key={item} style={{ fontSize:13, color:"rgba(255,255,255,0.6)", marginBottom:10, cursor:"pointer" }}>{item}</p>
                  ))}
                </div>

                {/* Compañía */}
                <div style={{ minWidth:140 }}>
                  <p style={{ fontWeight:700, fontSize:13, marginBottom:16, color:"#fff" }}>Compañía</p>
                  {["Sobre nosotros","Trabaja con nosotros","Centro de ayuda","Soporte","Eventos"].map(item => (
                    <p key={item} style={{ fontSize:13, color:"rgba(255,255,255,0.6)", marginBottom:10, cursor:"pointer" }}>{item}</p>
                  ))}
                </div>

                {/* Contacta */}
                <div style={{ minWidth:180 }}>
                  <p style={{ fontWeight:700, fontSize:13, marginBottom:16, color:"#fff" }}>Contacta</p>
                  {[
                    { icon:"📞", text:"+34 900 102 172" },
                    { icon:"💬", text:"+34 699 752 019" },
                    { icon:"✉️", text:"info@comunidad.solar" },
                    { icon:"❓", text:"Preguntas frecuentes" },
                  ].map(({ icon, text }) => (
                    <p key={text} style={{ fontSize:13, color:"rgba(255,255,255,0.6)", marginBottom:10, cursor:"pointer" }}>
                      <span style={{ marginRight:8 }}>{icon}</span>{text}
                    </p>
                  ))}
                </div>
              </div>

              {/* Barra inferior */}
              <div style={{ display:"flex", flexWrap:"wrap", gap:16, justifyContent:"space-between", alignItems:"center", padding:"20px 0", fontSize:12, color:"rgba(255,255,255,0.4)" }}>
                <span>Copyright © 2025 Comunidad Solar</span>
                <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
                  {["Política de Privacidad","Política de Cookies","Aviso legal","Términos y Condiciones"].map(item => (
                    <span key={item} style={{ cursor:"pointer", color:"rgba(255,255,255,0.55)" }}>{item}</span>
                  ))}
                </div>
              </div>
            </div>
          </footer>
    </>
  );
}
