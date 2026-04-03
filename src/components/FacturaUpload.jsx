// FacturaUpload.jsx
// Formulario de 2 pasos: datos del cliente → factura (PDF o CUPS).
// Al avanzar de Step 1 a Step 2, verifica proximidad a Comunidades Energéticas
// vía coordenadas del autocomplete Nominatim (OSM) o geocodificación Nominatim (fallback).
// Envía resultado al backend de quoting.

import { useState, useRef, useEffect } from "react";
import "./FacturaUpload.css";
import {
  FIELD_LABELS, MANUAL_FIELD_KEYS, PRECIOS_POT_3TD_KEYS,
  PRECIOS_ENERGIA_BASE_KEYS, PRECIOS_ENERGIA_3TD_KEYS, API_AUTO_KEYS,
  CE_API_URL, API_BASE, PLAN_REDIRECT_URL, QUOTING_URL, LEAD_URL,
  NOMINATIM_URL, CE_DETAIL_URL, CE_STATUS_LABELS,
  ASESOR_ENVIO_URL, ASESOR_REDIRECT_URL,
} from "../constants/appConstants";
import {
  hasValue, emptyManual, resolverIdGeneracion, getCeNombreById,
  haversineDistance, buildPayloadAsesor, buildRedirectURL, enviarLead,
} from "../utils/facturaUtils";
import OptimizerModal from "./OptimizerModal";
import PlanScreen from "./PlanScreen";

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
  const [ceFijada, setCeFijada]         = useState(null); // nombre CE fijada por id_generacion en URL
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
  const [modoAlquiler, setModoAlquiler]         = useState(false);
  const [cuotaAlquilerMes, setCuotaAlquilerMes] = useState(null);
  const [dealId, setDealId]                     = useState(null);
  const [mpklogId, setMpklogId]                 = useState(null);
  const [modalContratar, setModalContratar]     = useState(false);
  const [dniContrato, setDniContrato]           = useState("");
  const [dniError, setDniError]                 = useState("");
  const [enviandoContrato, setEnviandoContrato] = useState(false);

  // ── Modo asesor — detectar ?interno-asesores=true ────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("interno-asesores") === "true") {
      setModoAsesor(true);
    }
    const idGen = params.get("id_generacion");
    if (idGen) {
      setIdGeneracion(idGen);
      const nombre = getCeNombreById(idGen);
      if (nombre) setCeFijada(nombre);
    }

    // ── Demo plan-demo ────────────────────────────────────────────────────────
    if (params.get("demo") === "true" && params.get("fase") === "plan-demo") {
      const p = (key, fallback = null) => {
        const v = params.get(key);
        return v !== null ? parseFloat(v) : fallback;
      };
      const s = (key, fallback = "") => params.get(key) ?? fallback;

      setCliente(c => ({
        ...c,
        nombre:    s("cliente.nombre"),
        direccion: s("cliente.direccion"),
      }));
      setCeNombre(s("ceNombre"));
      setCeStatus(s("ceStatus"));
      setPanelesSel(p("panelesSel", 3));
      setPanelesPropuesta(p("panelesSel", 3));
      setPlanData({
        ahorro25Anos:           p("ahorro25Anos",           1575.35),
        pagoUnico:              p("pagoUnico",              3480.75),
        pagoFinanciado:         p("pagoFinanciado",         41.33),
        ahorroMensual:          p("ahorroMensual",          38.35),
        ahorroAnual:            p("ahorroAnual",            460.20),
        produccionAnual:        p("produccionAnual",        4101.25),
        potenciaTotal:          p("potenciaTotal",          3),
        coeficienteDistribucion:p("coeficienteDistribucion",5),
        plazoRecuperacion:      p("plazoRecuperacion",      6.7),
      });
      setStatus("sent");
      setLoading(false);
    }

    const modoParam = params.get("modo");
    setModoAlquiler(modoParam === "alquiler");

    const cuotaRaw = parseFloat(params.get("cuotaAlquilerMes"));
    if (!isNaN(cuotaRaw)) setCuotaAlquilerMes(cuotaRaw);
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
      const cesFiltradas = ceFijada ? ces.filter(ce => ce.name === ceFijada || ce.addressName === ceFijada) : ces;
      const ceResult = await runZonaCheck(userLat, userLon, cesFiltradas.length ? cesFiltradas : ces);
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
  // Builds the cliente object for all outgoing payloads.
  // Pass overrideDealId right after receiving it from /enviar so the value
  // is used in the same tick — state update (setDealId) is async.
  const buildClientePayload = (overrideDealId = null, overrideMpklogId = null) => ({
    nombre:     cliente.nombre,
    apellidos:  cliente.apellidos,
    correo:     cliente.correo,
    telefono:   cliente.telefono,
    direccion:  cliente.direccion,
    dealId:     overrideDealId   ?? dealId,
    mpklogId:   overrideMpklogId ?? mpklogId,
    databaseId: "",
    dni:        "",
    // TODO: elegir dinámicamente entre "Alquiler" y "Venta" según modoAlquiler
    tipoVenta:  "Alquiler",
  });

  const buildFactura = (d) => ({
    cups:             d.cups             || "",
    comercializadora: d.comercializadora || "",
    distribuidora:    d.distribuidora    || "",
    tarifa_acceso:    d.tarifa_acceso    || "",
    periodo_inicio:   d.periodo_inicio   || "",
    periodo_fin:      d.periodo_fin      || "",
    dias_facturados:  d.dias_facturados  || null,
    importe_factura:  parseFloat(d.importe_factura) || null,
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
    precios_energia: {
      pe_p1: parseFloat(d.pe_p1) || null, pe_p2: parseFloat(d.pe_p2) || null, pe_p3: parseFloat(d.pe_p3) || null,
      pe_p4: parseFloat(d.pe_p4) || null, pe_p5: parseFloat(d.pe_p5) || null, pe_p6: parseFloat(d.pe_p6) || null,
    },
    impuestos: { imp_ele: d.imp_ele || null, iva: d.iva || null },
    otros: {
      alq_eq_dia:       d.alq_eq_dia       || null,
      cuotaAlquilerMes: d.cuotaAlquilerMes ?? null,
    },
    archivo: {},
    api: { api_ok: d.api_ok ?? null, api_error: d.api_error || "" },
  });

  const buildFacturaPDF = () => {
    if (!facturaData) return {};
    const merged = { ...facturaData, ...Object.fromEntries(
      Object.entries(manualFields).filter(([, v]) => v !== "")
    ), modo: modoAlquiler ? "alquiler" : "venta", cuotaAlquilerMes: cuotaAlquilerMes ?? null };
    return buildFactura(merged);
  };

  const buildFacturaCUPS = () =>
    buildFactura({ cups, ...cupsData, ...manualFields, modo: modoAlquiler ? "alquiler" : "venta", cuotaAlquilerMes: cuotaAlquilerMes ?? null });

  const handleEnviarAsesor = async () => {
    if (sending) return;
    setSending(true); setError("");
    try {
      const fd = new FormData();
      fd.append("data", JSON.stringify({
        cliente,
        Fsmstate, FsmPrevious: fsmPrevious,
        ce: { nombre: ceNombre, direccion: ceDireccion, status: ceStatus, etiqueta: ceEtiqueta, id_generacion: resolverIdGeneracion(idGeneracion, ceNombre) },
      }));
      const res = await fetch(`${API_BASE}/enviar`, { method: "POST", body: fd });
      const dataAsesor = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = typeof dataAsesor.detail === "string" ? dataAsesor.detail : JSON.stringify(dataAsesor.detail) || `HTTP ${res.status}`;
        throw new Error(detail);
      }
      const dealIdRecebido   = dataAsesor?.dealId   ?? null;
      const mpklogIdRecebido = dataAsesor?.mpklogId ?? null;
      if (dealIdRecebido)   { setDealId(dealIdRecebido);     console.log("[handleEnviarAsesor] dealId recebido:", dealIdRecebido);     }
      if (mpklogIdRecebido) { setMpklogId(mpklogIdRecebido); console.log("[handleEnviarAsesor] mpklogId recebido:", mpklogIdRecebido); }
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
        const facturaAsesor = mode === "pdf" ? buildFacturaPDF() : buildFacturaCUPS();
        const cePayload = { nombre: ceNombre, direccion: ceDireccion, status: ceStatus, etiqueta: ceEtiqueta, id_generacion: resolverIdGeneracion(idGeneracion, ceNombre) };

        // Enviar ao Zoho Flow via /enviar (igual ao fluxo normal)
        const fd = new FormData();
        fd.append("data", JSON.stringify({ cliente: buildClientePayload(), factura: facturaAsesor, Fsmstate, FsmPrevious: fsmPrevious, ce: cePayload }));
        if (mode === "pdf" && file) fd.append("file", file, file.name);

        // Enviar em paralelo: /enviar (Zoho Flow) + ASESOR_ENVIO_URL
        const [resEnviar] = await Promise.all([
          fetch(`${API_BASE}/enviar`, { method: "POST", body: fd }),
          fetch(ASESOR_ENVIO_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildPayloadAsesor(mode, facturaData, cupsData, manualFields)),
          }),
        ]);
        const dataEnviar     = await resEnviar.json().catch(() => ({}));
        const dealIdRecebido   = dataEnviar?.dealId   ?? null;
        const mpklogIdRecebido = dataEnviar?.mpklogId ?? null;
        if (dealIdRecebido)   { setDealId(dealIdRecebido);     console.log("[handleEnviar/asesor] dealId recebido:", dealIdRecebido);     }
        if (mpklogIdRecebido) { setMpklogId(mpklogIdRecebido); console.log("[handleEnviar/asesor] mpklogId recebido:", mpklogIdRecebido); }

        const redirectUrl = buildRedirectURL(PLAN_REDIRECT_URL, cliente, facturaAsesor, resolverIdGeneracion(idGeneracion, ceNombre), manualFields, facturaData ?? cupsData, modoAlquiler, cuotaAlquilerMes);
        const redirectUrlWithDeal = dealIdRecebido ? `${redirectUrl}&dealId=${encodeURIComponent(dealIdRecebido)}` : redirectUrl;
        window.location.href = redirectUrlWithDeal;
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
    const cePayload = { nombre: ceNombre, direccion: ceDireccion, status: ceStatus, etiqueta: ceEtiqueta, id_generacion: resolverIdGeneracion(idGeneracion, ceNombre) };
    try {
      const fd = new FormData();
      fd.append("data", JSON.stringify({ cliente: buildClientePayload(), factura, Fsmstate, FsmPrevious: fsmPrevious, ce: cePayload }));
      if (mode === "pdf" && file) fd.append("file", file, file.name);
      const resEnviar  = await fetch(`${API_BASE}/enviar`, { method: "POST", body: fd });
      const dataEnviar = await resEnviar.json().catch(() => ({}));
      if (!resEnviar.ok) {
        const detail = typeof dataEnviar.detail === "string" ? dataEnviar.detail : JSON.stringify(dataEnviar.detail) || `HTTP ${resEnviar.status}`;
        throw new Error(detail);
      }
      const dealIdRecebido   = dataEnviar?.dealId   ?? null;
      const mpklogIdRecebido = dataEnviar?.mpklogId ?? null;
      if (dealIdRecebido)   { setDealId(dealIdRecebido);     console.log("[handleEnviar] dealId recebido:", dealIdRecebido);     }
      if (mpklogIdRecebido) { setMpklogId(mpklogIdRecebido); console.log("[handleEnviar] mpklogId recebido:", mpklogIdRecebido); }

      // Abrir quoting en nueva pestaña con los datos como query params
     //const redirectUrl = buildRedirectURL(PLAN_REDIRECT_URL, cliente, factura, resolverIdGeneracion(idGeneracion, ceNombre), manualFields, facturaData ?? cupsData, modoAlquiler, cuotaAlquilerMes);
     // console.log("[handleEnviar] redirect URL:", redirectUrl);
      // window.open(redirectUrl, "_blank");

      // Llamar al backend de quoting con los datos de la factura (cliente ya con dealId)
      const quotingRes = await fetch(QUOTING_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente: buildClientePayload(dealIdRecebido, mpklogIdRecebido),
          factura,
          Fsmstate,
          FsmPrevious: fsmPrevious,
          ce: cePayload,
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

  const handleContratar = async () => {
    const dniRegex = /^[0-9]{8}[A-Za-z]$/;
    if (!dniContrato.trim()) {
      setDniError("El DNI es obligatorio");
      return;
    }
    if (!dniRegex.test(dniContrato.trim())) {
      setDniError("Introduce un DNI válido (ej: 12345678A)");
      return;
    }
    setDniError("");
    setEnviandoContrato(true);

    // Usar dados disponíveis independentemente do modo
    const factura = mode === "pdf"
      ? buildFacturaPDF()
      : mode === "cups"
        ? buildFacturaCUPS()
        : {}; // modo demo — sem dados de factura

    // Fonte de dados raw para pe_p* e importe_factura
    const rawData = facturaData ?? cupsData ?? {};

    const payload = {
      cliente: {
        nombre:         cliente.nombre     || "",
        apellidos:      cliente.apellidos  || "",
        correo:         cliente.correo     || "",
        telefono:       cliente.telefono   || "",
        direccion:      cliente.direccion  || "",
        dealId:         dealId             ?? null,
        mpklogId:       mpklogId           ?? null,
        databaseId:     "00001",
        dni:            dniContrato.trim().toUpperCase(),
        tipoVenta:      modoAlquiler ? "Alquiler" : "Venta",
        planContratado: true,
      },
      factura: {
        ...factura,
        precios_energia: {
          pe_p1: parseFloat(manualFields.pe_p1 || rawData.pe_p1) || null,
          pe_p2: parseFloat(manualFields.pe_p2 || rawData.pe_p2) || null,
          pe_p3: parseFloat(manualFields.pe_p3 || rawData.pe_p3) || null,
          pe_p4: parseFloat(manualFields.pe_p4 || rawData.pe_p4) || null,
          pe_p5: parseFloat(manualFields.pe_p5 || rawData.pe_p5) || null,
          pe_p6: parseFloat(manualFields.pe_p6 || rawData.pe_p6) || null,
        },
        importe_factura: parseFloat(
          manualFields.importe_factura || rawData.importe_factura
        ) || null,
      },
      Fsmstate:    "08_PROPUESTA_ALQ",
      FsmPrevious: Fsmstate || null,
      ce: {
        nombre:        ceNombre,
        direccion:     ceDireccion,
        status:        ceStatus,
        etiqueta:      ceEtiqueta,
        id_generacion: resolverIdGeneracion(idGeneracion, ceNombre),
      },
    };

    try {
      const fd = new FormData();
      fd.append("data", JSON.stringify(payload));
      if (mode === "pdf" && file) fd.append("file", file, file.name);

      const res = await fetch(`${API_BASE}/enviar`, { method: "POST", body: fd });
      if (!res.ok) {
        const detail = await res.json()
          .then((d) => typeof d.detail === "string" ? d.detail : JSON.stringify(d.detail))
          .catch(() => `HTTP ${res.status}`);
        throw new Error(detail);
      }
      setModalContratar(false);
      setDniContrato("");
      setStatus("asesor_solicitado");
    } catch (err) {
      setDniError(err.message);
    } finally {
      setEnviandoContrato(false);
    }
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
          <PlanScreen
            cliente={cliente}
            ceNombre={ceNombre}
            ceStatus={ceStatus}
            modoAlquiler={modoAlquiler}
            cuotaAlquilerMes={cuotaAlquilerMes}
            planData={planData}
            panelesSel={panelesSel}
            panelesPropuesta={panelesPropuesta}
            tabActiva={tabActiva}
            onContratar={() => setModalContratar(true)}
            onVolver={handleReset}
            onOptimizar={handleOptimizar}
            onSetPanelesPropuesta={setPanelesPropuesta}
            onSetTabActiva={setTabActiva}
          />
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

            {ceFijada && (
              <p style={{ fontSize:12, color:"#aaa", marginBottom:16, textAlign:"center" }}>
                Comunidad Energética: <strong style={{ color:"#888" }}>{ceFijada}</strong>
              </p>
            )}

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

                {/* Precios energía — solo mostrar si el backend los extrajo */}
                {[
                  ...PRECIOS_ENERGIA_BASE_KEYS,
                  ...(facturaData?.tarifa_acceso !== "2.0TD" ? PRECIOS_ENERGIA_3TD_KEYS : []),
                ].filter((k) => hasValue(facturaData?.[k])).length > 0 && (
                  <>
                    <p className="cs-section-label">Precios de energía</p>
                    <div className="cs-manual-grid">
                      {[
                        ...PRECIOS_ENERGIA_BASE_KEYS,
                        ...(facturaData?.tarifa_acceso !== "2.0TD" ? PRECIOS_ENERGIA_3TD_KEYS : []),
                      ]
                        .filter((k) => hasValue(facturaData?.[k]))
                        .map((k) => (
                          <div key={k} className="cs-field-group">
                            <label className="cs-label">{FIELD_LABELS[k]}</label>
                            <div className="cs-input"
                              style={{ background:"#f7f7f5", color:"#555",
                                       cursor:"default", userSelect:"text" }}>
                              {facturaData[k]}
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  </>
                )}

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
                  {[
                    ...MANUAL_FIELD_KEYS,
                    ...(cupsData?.tarifa_acceso !== "2.0TD" ? PRECIOS_POT_3TD_KEYS : []),
                    ...PRECIOS_ENERGIA_BASE_KEYS,
                    ...(cupsData?.tarifa_acceso !== "2.0TD" ? PRECIOS_ENERGIA_3TD_KEYS : []),
                  ].map((k) => (
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
      <OptimizerModal
        modalOptimizar={modalOptimizar}
        panelesPropuesta={panelesPropuesta}
        modoAlquiler={modoAlquiler}
        cuotaAlquilerMes={cuotaAlquilerMes}
        onVolver={() => setModalOptimizar(null)}
        onAceptar={handleAceptarPropuesta}
      />

      {/* ── MODAL CONTRATAR ── */}
      {modalContratar && (
        <div style={{
          position:"fixed", inset:0, background:"rgba(0,0,0,0.55)",
          zIndex:1000, display:"flex", alignItems:"center",
          justifyContent:"center", padding:16,
        }}>
          <div style={{
            background:"#fff", borderRadius:16, padding:"32px 28px",
            maxWidth:400, width:"100%",
            boxShadow:"0 8px 40px rgba(0,0,0,0.18)",
          }}>
            <h3 style={{ fontSize:18, fontWeight:700, color:"#111", marginBottom:8 }}>
              Confirmar contratación
            </h3>
            <p style={{ fontSize:13, color:"#777", marginBottom:24 }}>
              Introduce tu DNI para completar la contratación.
            </p>

            <div className="cs-field-group" style={{ marginBottom:16 }}>
              <label className="cs-label">DNI</label>
              <input
                className={`cs-input${dniError ? " error" : ""}`}
                placeholder="12345678A"
                value={dniContrato}
                onChange={(e) => { setDniContrato(e.target.value); setDniError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleContratar()}
                autoFocus
              />
              {dniError && <span className="cs-field-error">{dniError}</span>}
            </div>

            <div style={{ display:"flex", gap:12 }}>
              <button
                className="cs-btn-ghost"
                style={{ flex:1, marginTop:0 }}
                onClick={() => { setModalContratar(false); setDniContrato(""); setDniError(""); }}
                disabled={enviandoContrato}
              >
                ← Volver
              </button>
              <button
                className="cs-btn-primary"
                style={{ flex:1, marginTop:0 }}
                onClick={handleContratar}
                disabled={enviandoContrato}
              >
                {enviandoContrato ? "Enviando..." : "Contratar ahora →"}
              </button>
            </div>
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
