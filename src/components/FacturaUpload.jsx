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
  PERIODOS_POR_MES_3TD, TARIFAS_MULTI_FACTURA,
  CE_API_URL, API_BASE, SESION_URL, PLAN_REDIRECT_URL, QUOTING_URL, LEAD_URL,
  NOMINATIM_URL, CE_STATUS_LABELS, CE_ESTATUS_MAP,
  ASESOR_ENVIO_URL, ASESOR_REDIRECT_URL, RESTRICT_TO_CE, FORCE_WAITING_LIST, SUMINISTRO_ZONA_CHECK, CUPS_ENABLED, ASESOR_ENABLED,
} from "../constants/appConstants";
import {
  hasValue, emptyManual, resolverIdGeneracion, getCeNombreById,
  haversineDistance, buildPayloadAsesor, enviarLead,
  validarDNI, validarIBAN, sugerirMeses3TD, calcularMotivoDeEspera,
} from "../utils/facturaUtils";
import OptimizerModal from "./OptimizerModal";
import PlanScreen from "./PlanScreen";
import { CE_ID_MAP } from "../constants/ceMappings";

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
  const urlParamsRef      = useRef({
    cliente: {}, factura: null, ce: {},
    dealId: null, mpklogId: null, idGen: null,
    fsmstate: null, fsmPrevious: null,
    facturaLS: null, modeLS: null,
  });

  // ── Zona check result ─────────────────────────────────────────────────────
  const [Fsmstate, setFsmstate]       = useState(""); // "01_DENTRO_ZONA" | "02_FUERA_ZONA"
  const [fsmPrevious, setFsmPrevious] = useState(null);
  const [ceNombre, setCeNombre]       = useState("");
  const [idGeneracion, setIdGeneracion] = useState("");
  const [ceFijada, setCeFijada]         = useState(null); // nombre CE fijada por id_generacion en URL
  const [ceDireccion, setCeDireccion] = useState("");
  const [ceStatus, setCeStatus]       = useState("");
  const [ceEtiqueta, setCeEtiqueta]   = useState("");
  const [cePanelesDisponibles, setCePanelesDisponibles] = useState(null); // Paneles_disponibles del CRM
  const [cePanelesALaVenta, setCePanelesALaVenta]       = useState(null); // N_mero_de_paneles_a_la_venta del CRM
  const [cePanelesTotales, setCePanelesTotales]         = useState(null); // N_mero_de_paneles_totales del CRM
  const [ceDistancia, setCeDistancia] = useState(null); // metros — para banner
  const [ceRadio, setCeRadio]         = useState(null); // radioMetros — para banner
  const [zonaWarn, setZonaWarn]       = useState("");   // aviso no bloqueante
  const [listaCE, setListaCE]         = useState(null); // caché de comunidades
  const [suministroLat, setSuministroLat]             = useState(null);
  const [suministroLon, setSuministroLon]             = useState(null);
  const [nombreCliente, setNombreCliente]             = useState(null);
  const [direccionSuministro, setDireccionSuministro] = useState(null);
  const [devCESelected, setDevCESelected] = useState("");
  const listaCERef                    = useRef([]);     // ref para evitar stale closure
  const cotizacionEnviadaRef          = useRef(false);  // guard: dispara 09_COTIZACION_ALQ só uma vez

  // ── Step 2A — PDF upload ──────────────────────────────────────────────────
  const [file, setFile]               = useState(null);
  const [isDragging, setIsDragging]   = useState(false);
  const [facturaData, setFacturaData] = useState(null);
  const fileRef  = useRef();
  const fileRef1 = useRef();
  const fileRef2 = useRef();

  // ── Faturas adicionais 3.0TD / 6.0TD / 6.1TD ────────────────────────────
  const [factura1Data, setFactura1Data]         = useState(null); // segunda fatura
  const [factura2Data, setFactura2Data]         = useState(null); // terceira fatura
  const [_file1, setFile1]                      = useState(null);
  const [_file2, setFile2]                      = useState(null);
  const [loading1, setLoading1]                 = useState(false);
  const [loading2, setLoading2]                 = useState(false);
  const [error1, setError1]                     = useState("");           // PDF inválido (2ª)
  const [error2, setError2]                     = useState("");           // PDF inválido (3ª)
  const [errorMes1, setErrorMes1]               = useState(false);        // mês não coincide (2ª)
  const [errorMes2, setErrorMes2]               = useState(false);        // mês não coincide (3ª)
  const [mesesSugeridos1, setMesesSugeridos1]   = useState([]); // sugestões para 2ª fatura
  const [mesesSugeridos2, setMesesSugeridos2]   = useState([]); // sugestões para 3ª fatura
  const [modalConfirmarEnvio, setModalConfirmarEnvio] = useState(false);
  const [aceptaPrivacidad, setAceptaPrivacidad] = useState(false);

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
  const importeDeposito = cuotaAlquilerMes != null ? String(cuotaAlquilerMes * 2) : null;
  const [extractSessionId,  setExtractSessionId]  = useState(null);
  const [extract1SessionId, setExtract1SessionId] = useState(null);
  const [extract2SessionId, setExtract2SessionId] = useState(null);
  const [continuarSessionId, setContinuarSessionId] = useState(null);
  const [dealId, setDealId]                     = useState(null);
  const [mpklogId, setMpklogId]                 = useState(null);
  const [sesionData, setSesionData]             = useState(null);
  const [_sesionError, setSesionError]          = useState(false);
  const [facturaPreviewData, setFacturaPreviewData] = useState(null);
  const [modalContratar, setModalContratar]     = useState(false);
  const [dniContrato, setDniContrato]           = useState("");
  const [dniError, setDniError]                 = useState("");
  const [enviandoContrato, setEnviandoContrato] = useState(false);
  const [accionRealizada, setAccionRealizada]   = useState(null); // null | "contratado" | "lista_espera"
  const [motivoListaEspera, setMotivoListaEspera] = useState(null); // null | "Sin plazas" | "Quoting"
  const [planAbierto, setPlanAbierto]           = useState(false);
  const [advertenciaAno, setAdvertenciaAno]     = useState(false);
  const [ibanContrato, setIbanContrato]         = useState("");
  const [ibanError, setIbanError]               = useState("");
  // Verificação por código
  const [modalCodigo, setModalCodigo]           = useState(false);
  const [codigoVerificacion, setCodigoVerificacion] = useState("");
  const [codigoError, setCodigoError]           = useState("");
  const [enviandoCodigo, setEnviandoCodigo]     = useState(false); // loading reenviar
  const [verificandoCodigo, setVerificandoCodigo] = useState(false); // loading confirmar
  // Ref para Promise pendente — handleContratar aguarda confirmação do código
  const codigoResolveRef                        = useRef(null);
  // Guarda o último mpklogId usado para gerar/verificar — útil para "Reenviar"
  const codigoMpklogIdRef                       = useRef(null);
  const codigoSessionIdRef                      = useRef(null);

  // ── Leitura inicial da URL ────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = (key, fallback = "") => params.get(key) ?? fallback;
    const n = (key) => parseFloat(params.get(key)) || null;

    // ── Preencher urlParamsRef SEMPRE — independente do modo ─────────────────
    urlParamsRef.current = {
      cliente: {
        nombre:    s("cliente.nombre")    || s("nombre"),
        apellidos: s("cliente.apellidos") || s("apellidos"),
        correo:    s("cliente.correo")    || s("correo"),
        telefono:  s("cliente.telefono")  || s("telefono"),
        direccion: s("cliente.direccion") || s("direccion"),
      },
      ce: {
        nombre:    s("ceNombre")    || s("ce.nombre"),
        status:    s("ceStatus")    || s("ce.status"),
        etiqueta:  s("ceEtiqueta")  || s("ce.etiqueta"),
        direccion: s("ceDireccion") || s("ce.direccion"),
      },
      dealId:      s("dealId")        || null,
      mpklogId:    s("mpklogId")      || null,
      idGen:       s("id_generacion") || null,
      fsmstate:    s("Fsmstate")      || s("fsmstate")    || null,
      fsmPrevious: s("FsmPrevious")   || s("fsmPrevious") || null,
      facturaLS:   null,
      modeLS:      null,
      factura: {
        cups:             s("cups"),
        comercializadora: s("comercializadora"),
        distribuidora:    s("distribuidora"),
        tarifa_acceso:    s("tarifa_acceso"),
        periodo_inicio:   s("periodo_inicio"),
        periodo_fin:      s("periodo_fin"),
        dias_facturados:  n("dias_facturados"),
        importe_factura:  n("importe_factura"),
        pot_p1_kw: n("pot_p1_kw"), pot_p2_kw: n("pot_p2_kw"),
        pot_p3_kw: n("pot_p3_kw"), pot_p4_kw: n("pot_p4_kw"),
        pot_p5_kw: n("pot_p5_kw"), pot_p6_kw: n("pot_p6_kw"),
        consumo_p1_kwh: n("consumo_p1_kwh"), consumo_p2_kwh: n("consumo_p2_kwh"),
        consumo_p3_kwh: n("consumo_p3_kwh"), consumo_p4_kwh: n("consumo_p4_kwh"),
        consumo_p5_kwh: n("consumo_p5_kwh"), consumo_p6_kwh: n("consumo_p6_kwh"),
        pp_p1: n("pp_p1"), pp_p2: n("pp_p2"), pp_p3: n("pp_p3"),
        pp_p4: n("pp_p4"), pp_p5: n("pp_p5"), pp_p6: n("pp_p6"),
        pe_p1: n("pe_p1"), pe_p2: n("pe_p2"), pe_p3: n("pe_p3"),
        pe_p4: n("pe_p4"), pe_p5: n("pe_p5"), pe_p6: n("pe_p6"),
        imp_ele:    n("imp_ele"),
        iva:        n("iva"),
        alq_eq_dia: n("alq_eq_dia"),
        api_ok:    params.get("api_ok") === "true"  ? true
                 : params.get("api_ok") === "false" ? false : null,
        api_error: s("api_error"),
      },
    };

    if (params.get("interno-asesores") !== "false") {
      if (!params.has("interno-asesores")) {
        params.set("interno-asesores", "true");
        window.history.replaceState({}, "", `${window.location.origin}/?${params.toString()}`);
      }
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

      setPanelesSel(p("panelesSel", 3));
      setPanelesPropuesta(p("panelesSel", 3));
      const planFromUrl = {
        ahorro25Anos:            parseFloat(params.get("ahorro25Anos"))            || null,
        pagoUnico:               parseFloat(params.get("pagoUnico"))               || null,
        pagoFinanciado:          parseFloat(params.get("pagoFinanciado"))          || null,
        ahorroMensual:           parseFloat(params.get("ahorroMensual"))           || null,
        ahorroAnual:             parseFloat(params.get("ahorroAnual"))             || null,
        produccionAnual:         parseFloat(params.get("produccionAnual"))         || null,
        potenciaTotal:           parseFloat(params.get("potenciaTotal"))           || null,
        coeficienteDistribucion: parseFloat(params.get("coeficienteDistribucion")) || null,
        plazoRecuperacion:       params.get("plazoRecuperacion")                   || null,
        panelesSel:              parseInt(params.get("panelesSel"))                || null,
        cuotaAlquilerMes:        parseFloat(params.get("cuotaAlquilerMes"))        || null,
        ahorroAnualPercent:      parseFloat(params.get("ahorroAnualPercent"))      || null,
      };
      setPlanData(planFromUrl);
      setLoading(false);

      // ── PATCH /sesion con plan (fire-and-forget) ────────────────────────────
      // Persistir el plan en el DB del backend (campo `plan` del payload de
      // sesión). Permite que un segundo navegador o un acceso 10 días después
      // recupere el plan vía GET /sesion (en vez de depender de los params URL,
      // que vamos a limpiar a seguir).
      const sidForPatch = params.get("session_id");
      const hasAnyPlanValue = Object.values(planFromUrl).some(v => v != null);
      if (sidForPatch && hasAnyPlanValue) {
        // Resolver `modo` a partir de múltiplas fontes para garantir que é sempre
        // gravado no DB. Ordem: URL param > localStorage cs_mode (ex.: "pdf"
        // não interessa, mas se houver `cs_modoAlquiler` ou similar...) > null.
        // Em última análise, se o cliente tiver feito o passo 1/2 sem usar param URL
        // `modo`, ainda assim podemos derivar de localStorage que o frontend grava.
        const modoFromUrl = params.get("modo");
        const modoForPatch = modoFromUrl || null;
        const payloadPatch = { plan: planFromUrl, ...(modoForPatch && { modo: modoForPatch }) };
        console.log("[plan-demo] PATCH /sesion fire-and-forget:", payloadPatch);
        fetch(`${SESION_URL}/${encodeURIComponent(sidForPatch)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadPatch),
        })
          .then(r => {
            if (!r.ok) console.warn("[plan-demo] PATCH /sesion respondeu", r.status);
            else console.log("[plan-demo] PATCH /sesion OK — plan persistido no DB");
          })
          .catch(e => console.warn("[plan-demo] PATCH /sesion falhou (utilizando localStorage como fallback):", e?.message));
      }

      const cleanUrl = (val) => (!val || val === "—") ? "" : val;

      setCliente(c => ({
        nombre:    c.nombre    || cleanUrl(s("cliente.nombre"))    || cleanUrl(s("nombre"))    || "",
        apellidos: c.apellidos || cleanUrl(s("cliente.apellidos")) || cleanUrl(s("apellidos")) || "",
        correo:    c.correo    || cleanUrl(s("cliente.correo"))    || cleanUrl(s("correo"))    || "",
        telefono:  c.telefono  || cleanUrl(s("cliente.telefono"))  || cleanUrl(s("telefono"))  || "",
        direccion: c.direccion || cleanUrl(s("cliente.direccion")) || cleanUrl(s("direccion")) || "",
      }));

      setCeNombre(prev    => prev || s("ceNombre")    || "");
      setCeStatus(prev    => prev || s("ceStatus")    || "");
      setCeEtiqueta(prev  => prev || s("ceEtiqueta")  || "");
      setCeDireccion(prev => prev || s("ceDireccion") || "");

      const urlDealId   = s("dealId");
      const urlMpklogId = s("mpklogId");
      const urlIdGen    = s("id_generacion");
      if (urlDealId)   setDealId(prev        => prev || urlDealId);
      if (urlMpklogId) setMpklogId(prev      => prev || urlMpklogId);
      if (urlIdGen)    setIdGeneracion(prev   => prev || urlIdGen);

      const urlFsmstate    = s("Fsmstate")    || s("fsmstate");
      const urlFsmPrevious = s("FsmPrevious") || s("fsmPrevious");
      if (urlFsmstate)    setFsmstate(prev    => prev || urlFsmstate);
      if (urlFsmPrevious) setFsmPrevious(prev => prev || urlFsmPrevious);

      // Restaurar dados guardados antes do redirect
      const csCliente  = localStorage.getItem("cs_cliente");
      const csFactura  = localStorage.getItem("cs_factura");
      const csCe       = localStorage.getItem("cs_ce");
      const csDealId   = localStorage.getItem("cs_dealId");
      const csMpklogId = localStorage.getItem("cs_mpklogId");
      const csFsmstate = localStorage.getItem("cs_fsmstate");
      const csMode     = localStorage.getItem("cs_mode");

      if (csCliente) {
        const c = JSON.parse(csCliente);
        setCliente(prev => ({
          nombre:    prev.nombre    || c.nombre    || "",
          apellidos: prev.apellidos || c.apellidos || "",
          correo:    prev.correo    || c.correo    || "",
          telefono:  prev.telefono  || c.telefono  || "",
          direccion: prev.direccion || c.direccion || "",
        }));
        if (c.dealId)   setDealId(c.dealId);
        if (c.mpklogId) setMpklogId(c.mpklogId);
      }

      if (csFactura) {
        const f = JSON.parse(csFactura);
        if (csMode === "pdf")  setFacturaData(f);
        if (csMode === "cups") setCupsData(f);
        if (csMode) setMode(csMode);
        urlParamsRef.current.facturaLS = f;
        if (csMode) urlParamsRef.current.modeLS = csMode;
      }

      if (csCe) {
        const ce = JSON.parse(csCe);
        setCeNombre(prev    => prev || ce.nombre    || "");
        setCeDireccion(prev => prev || ce.direccion || "");
        setCeStatus(prev    => prev || ce.status    || "");
        setCeEtiqueta(prev  => prev || ce.etiqueta  || "");
        if (ce.paneles_disponibles != null) {
          setCePanelesDisponibles(prev => prev != null ? prev : ce.paneles_disponibles);
        }
        if (ce.paneles_a_la_venta != null) {
          setCePanelesALaVenta(prev => prev != null ? prev : ce.paneles_a_la_venta);
        }
        if (ce.paneles_totales != null) {
          setCePanelesTotales(prev => prev != null ? prev : ce.paneles_totales);
        }
        if (ce.id_generacion) setIdGeneracion(String(ce.id_generacion));
      }

      if (csDealId)   setDealId(prev   => prev || csDealId);
      if (csMpklogId) setMpklogId(prev => prev || csMpklogId);
      if (csFsmstate) setFsmstate(prev => prev || csFsmstate);

      // Se session_id veio na URL, persistir para PlanScreen
      const urlSessionId = params.get("session_id");
      if (urlSessionId) {
        console.log("[plan-demo] session_id encontrado na URL:", urlSessionId, "→ guardando em cs_session_id");
        localStorage.setItem("cs_session_id", urlSessionId);
      }

      // Limpar localStorage após restaurar
      localStorage.removeItem("cs_cliente");
      localStorage.removeItem("cs_factura");
      localStorage.removeItem("cs_ce");
      localStorage.removeItem("cs_dealId");
      localStorage.removeItem("cs_mpklogId");
      localStorage.removeItem("cs_fsmstate");
      localStorage.removeItem("cs_mode");

      setStatus("sent");
    }

    const modoParam = params.get("modo");
    setModoAlquiler(modoParam === "alquiler");

    const cuotaRaw = parseFloat(params.get("cuotaAlquilerMes"));
    if (!isNaN(cuotaRaw)) setCuotaAlquilerMes(cuotaRaw);

    // ── Sessão recuperada — session_id solitário (sem demo=true&fase=plan-demo) ──
    // Cenário: utilizador chega via URL limpa (outro navegador, link partilhado,
    // dias depois). Buscamos a sessão no backend e, se tiver `plan`, montamos
    // a PlanScreen como se fosse plan-demo.
    const isPlanDemo = params.get("demo") === "true" && params.get("fase") === "plan-demo";
    const sidSolo    = params.get("session_id");
    if (sidSolo && !isPlanDemo) {
      console.log("[useEffect] session_id solitário detetado:", sidSolo, "→ GET /sesion para recuperar plan");
      setLoading(true);
      setLoadingMsg("Recuperando tu plan...");
      (async () => {
        try {
          const r = await fetch(`${SESION_URL}/${encodeURIComponent(sidSolo)}`);
          if (!r.ok) {
            console.warn("[useEffect] GET /sesion respondeu", r.status, "— sessão não recuperada");
            setLoading(false);
            return;
          }
          const data = await r.json();
          console.log("[useEffect] sessão recuperada:", data);
          // Popular state a partir do payload da sessão.
          if (data?.cliente) {
            setCliente(prev => ({
              nombre:    prev.nombre    || data.cliente.nombre    || "",
              apellidos: prev.apellidos || data.cliente.apellidos || "",
              correo:    prev.correo    || data.cliente.correo    || "",
              telefono:  prev.telefono  || data.cliente.telefono  || "",
              direccion: prev.direccion || data.cliente.direccion || "",
            }));
            if (data.cliente.dealId)   { setDealId(data.cliente.dealId);     urlParamsRef.current.dealId   = data.cliente.dealId;   }
            if (data.cliente.mpklogId) { setMpklogId(data.cliente.mpklogId); urlParamsRef.current.mpklogId = data.cliente.mpklogId; }
          }
          if (data?.dealId)   { setDealId(prev   => prev || data.dealId);   if (data.dealId)   urlParamsRef.current.dealId   = data.dealId;   }
          const mpklogFromVerification = data?.verification?.mpklog_id ?? null;
          const mpklogResolved = data?.mpklogId ?? mpklogFromVerification;
          if (mpklogResolved) { setMpklogId(prev => prev || mpklogResolved); urlParamsRef.current.mpklogId = mpklogResolved; }
          if (data?.ce) {
            if (data.ce.nombre)        setCeNombre(data.ce.nombre);
            if (data.ce.status)        setCeStatus(data.ce.status);
            if (data.ce.etiqueta)      setCeEtiqueta(data.ce.etiqueta);
            if (data.ce.direccion)     setCeDireccion(data.ce.direccion);
            if (data.ce.id_generacion) setIdGeneracion(String(data.ce.id_generacion));
            if (data.ce.paneles_disponibles != null) setCePanelesDisponibles(Number(data.ce.paneles_disponibles));
            if (data.ce.paneles_a_la_venta  != null) setCePanelesALaVenta(Number(data.ce.paneles_a_la_venta));
            if (data.ce.paneles_totales     != null) setCePanelesTotales(Number(data.ce.paneles_totales));
          }
          if (data?.Fsmstate)    setFsmstate(data.Fsmstate);
          if (data?.FsmPrevious) setFsmPrevious(data.FsmPrevious);
          // Hidratar modoAlquiler a partir de múltiplas fontes:
          //   1ª prioridade: data.modo (se algum dia gravado no PATCH)
          //   2ª prioridade: data.cliente.tipoVenta — sempre presente após /enviar
          if (data?.modo) {
            setModoAlquiler(data.modo === "alquiler");
          } else if (data?.cliente?.tipoVenta) {
            const isAlquiler = String(data.cliente.tipoVenta).toLowerCase() === "alquiler";
            console.log("[useEffect] modoAlquiler derivado de cliente.tipoVenta:", data.cliente.tipoVenta, "→", isAlquiler);
            setModoAlquiler(isAlquiler);
          }
          if (data?.facturaPreview) setFacturaPreviewData(data.facturaPreview);
          if (data?.factura) {
            // factura está em formato Claude (estruturado) — guardar como facturaData direto.
            setFacturaData(data.factura);
            setMode("pdf");
          }
          if (data?.plan) {
            setPlanData(data.plan);
            if (data.plan.panelesSel != null) {
              setPanelesSel(Number(data.plan.panelesSel));
              setPanelesPropuesta(Number(data.plan.panelesSel));
            }
            if (data.plan.cuotaAlquilerMes != null) setCuotaAlquilerMes(Number(data.plan.cuotaAlquilerMes));
          } else {
            console.warn("[useEffect] sessão não contém plan — PlanScreen pode ficar com dados em falta");
          }
          // urlParamsRef.facturaLS para handleContratar fallback
          if (data?.factura) urlParamsRef.current.facturaLS = data.factura;
          urlParamsRef.current.modeLS = "pdf";
          setStatus("sent");
          setLoading(false);
        } catch (e) {
          console.warn("[useEffect] erro a recuperar sessão:", e?.message);
          setLoading(false);
        }
      })();
    }

    // ── Limpiar URL — mantener sólo session_id ─────────────────────────────
    // SÓLO limpiamos cuando hay session_id en la URL (cenário PlanScreen /
    // vuelta del cotizador, donde queremos esconder los dados sensíveis
    // recebidos). En la página inicial (passo 1, sin session_id), la URL
    // permanece como el utilizador la abrió — por ex., ?interno-asesores=true
    // tiene de permanecer visible para asesores.
    try {
      const sidUrl = params.get("session_id");
      if (sidUrl) {
        const cleanUrl = `${window.location.origin}/?session_id=${encodeURIComponent(sidUrl)}`;
        // Sólo aplica si la URL actual tiene más params que session_id
        if (window.location.search && window.location.search !== `?session_id=${encodeURIComponent(sidUrl)}`) {
          window.history.replaceState({}, "", cleanUrl);
          console.log("[URL] limpa — só session_id mantido na barra:", cleanUrl);
        }
      } else {
        console.log("[URL] sem session_id na URL — não limpamos (preservamos params iniciais como interno-asesores)");
      }
    } catch (e) {
      console.warn("[URL] erro a limpar URL:", e);
    }
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

  const handleDevCESelect = (ceName) => {
    setDevCESelected(ceName || "");
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

      const ceNombreVal    = nearest.name || nearest.addressName || "";
      const ceDireccionVal = nearest.addressName || "";
      const ceStatusVal    = CE_ESTATUS_MAP[nearest.status] ?? "Waiting list";
      const ceEtiquetaVal  = nearest.etiqueta || "";
      const ceIdGenVal     = nearest.id_generacion ? String(nearest.id_generacion) : "";
      const cePanelesVal       = (nearest.paneles_disponibles != null) ? Number(nearest.paneles_disponibles) : null;
      const cePanelesVentaVal  = (nearest.paneles_a_la_venta != null) ? Number(nearest.paneles_a_la_venta) : null;
      const cePanelesTotVal    = (nearest.paneles_totales != null) ? Number(nearest.paneles_totales) : null;

      setCeNombre(ceNombreVal);
      setCeDireccion(ceDireccionVal);
      setCeStatus(ceStatusVal);
      setCeEtiqueta(ceEtiquetaVal);
      setCePanelesDisponibles(cePanelesVal);
      setCePanelesALaVenta(cePanelesVentaVal);
      setCePanelesTotales(cePanelesTotVal);
      if (ceIdGenVal) setIdGeneracion(ceIdGenVal);
      console.log("📊 Resultado:", { Fmstate: "01_DENTRO_ZONA", ceNombreVal, ceDireccionVal, ceStatusVal, ceEtiquetaVal, ceIdGenVal, cePanelesVal, cePanelesVentaVal, cePanelesTotVal, distanciaCEMasCercana });
      console.log("[runZonaCheck] paneles capturados (DENTRO_ZONA):", { cePanelesVal, cePanelesVentaVal, cePanelesTotVal, ce: ceNombreVal });
      return { fsmstate: "01_DENTRO_ZONA", ceNombre: ceNombreVal, ceDireccion: ceDireccionVal, ceStatus: ceStatusVal, ceEtiqueta: ceEtiquetaVal, idGeneracion: ceIdGenVal, panelesDisponibles: cePanelesVal, panelesALaVenta: cePanelesVentaVal, panelesTotales: cePanelesTotVal };
    } else {
      const distanciaCEMasCercana = nearestAll ? Math.round(nearestAllDist) : null;
      updateFsmstate("02_FUERA_ZONA");
      setCeDistancia(distanciaCEMasCercana);
      setCeRadio(nearestAll ? nearestAll.radioMetros : null);

      const ceNombreVal    = nearestAll ? (nearestAll.name || nearestAll.addressName || "") : "";
      const ceDireccionVal = nearestAll ? (nearestAll.addressName || "") : "";
      const ceStatusVal    = nearestAll ? (CE_ESTATUS_MAP[nearestAll.status] ?? "Waiting list") : "";
      const ceEtiquetaVal  = nearestAll ? (nearestAll.etiqueta || "") : "";
      const ceIdGenVal     = nearestAll?.id_generacion ? String(nearestAll.id_generacion) : "";
      const cePanelesVal       = (nearestAll && nearestAll.paneles_disponibles != null) ? Number(nearestAll.paneles_disponibles) : null;
      const cePanelesVentaVal  = (nearestAll && nearestAll.paneles_a_la_venta != null) ? Number(nearestAll.paneles_a_la_venta) : null;
      const cePanelesTotVal    = (nearestAll && nearestAll.paneles_totales != null) ? Number(nearestAll.paneles_totales) : null;

      setCeNombre(ceNombreVal);
      setCeDireccion(ceDireccionVal);
      setCeStatus(ceStatusVal);
      setCeEtiqueta(ceEtiquetaVal);
      setCePanelesDisponibles(cePanelesVal);
      setCePanelesALaVenta(cePanelesVentaVal);
      setCePanelesTotales(cePanelesTotVal);
      if (ceIdGenVal) setIdGeneracion(ceIdGenVal);
      console.log("📊 Resultado:", { Fmstate: "02_FUERA_ZONA", ceNombreVal, ceDireccionVal, ceStatusVal, ceEtiquetaVal, ceIdGenVal, cePanelesVal, cePanelesVentaVal, cePanelesTotVal, distanciaCEMasCercana });
      console.log("[runZonaCheck] paneles capturados (FUERA_ZONA):", { cePanelesVal, cePanelesVentaVal, cePanelesTotVal, ce: ceNombreVal });
      return { fsmstate: "02_FUERA_ZONA", ceNombre: ceNombreVal, ceDireccion: ceDireccionVal, ceStatus: ceStatusVal, ceEtiqueta: ceEtiquetaVal, idGeneracion: ceIdGenVal, panelesDisponibles: cePanelesVal, panelesALaVenta: cePanelesVentaVal, panelesTotales: cePanelesTotVal };
    }
  };

  const chamarContinuar = async (ceResult) => {
    try {
      const payload = {
        cliente: { nombre: cliente.nombre, apellidos: cliente.apellidos, correo: cliente.correo, telefono: cliente.telefono, direccion: cliente.direccion },
        ce: { nombre: ceResult?.ceNombre ?? ceNombre, direccion: ceResult?.ceDireccion ?? ceDireccion, status: FORCE_WAITING_LIST ? "Waiting list" : (ceResult?.ceStatus ?? ceStatus), etiqueta: ceResult?.ceEtiqueta ?? ceEtiqueta, id_generacion: ceResult?.idGeneracion || resolverIdGeneracion(idGeneracion, ceResult?.ceNombre ?? ceNombre), paneles_disponibles: ceResult?.panelesDisponibles ?? cePanelesDisponibles ?? null, paneles_a_la_venta: ceResult?.panelesALaVenta ?? cePanelesALaVenta ?? null, paneles_totales: ceResult?.panelesTotales ?? cePanelesTotales ?? null },
        Fsmstate: ceResult?.fsmstate ?? "02_FUERA_ZONA",
        FsmPrevious: null,
      };
      console.log("[/continuar] enviando payload:", payload);
      const fd = new FormData();
      fd.append("data", JSON.stringify(payload));
      const res = await fetch(`${API_BASE}/continuar`, { method: "POST", body: fd });
      if (res.ok) {
        const { session_id } = await res.json();
        console.log("[/continuar] session_id recebido:", session_id ?? null);
        if (session_id) {
          setContinuarSessionId(session_id);
          localStorage.setItem("cs_session_id", session_id);
          // Polling background: Zoho callback chega ~3-4s depois
          (async () => {
            for (let i = 0; i < 15; i++) {
              await new Promise(r => setTimeout(r, 3000));
              try {
                const pr = await fetch(`${API_BASE}/sesion/${session_id}`);
                if (!pr.ok) break;
                const pd = await pr.json();
                if (pd.dealId && pd.mpklogId) {
                  console.log("[/continuar] polling IDs recebidos:", { dealId: pd.dealId, mpklogId: pd.mpklogId });
                  // El polling/sesión es la fuente de verdad (callback del Zoho Flow ya escribió en la sesión).
                  // Si el state actual tiene un ID diferente (pegajoso de sesión anterior o del fallback por email),
                  // lo sobrescribimos y dejamos aviso en consola.
                  setDealId(prev => {
                    if (prev && prev !== pd.dealId) {
                      console.warn("[/continuar] dealId sobrescrito:", { antes: prev, depois: pd.dealId });
                    }
                    return pd.dealId;
                  });
                  setMpklogId(prev => {
                    if (prev && prev !== pd.mpklogId) {
                      console.warn("[/continuar] mpklogId sobrescrito:", { antes: prev, depois: pd.mpklogId });
                    }
                    return pd.mpklogId;
                  });
                  return;
                }
              } catch (_) {}
            }
            console.warn("[/continuar] polling encerrado sem IDs");
          })();
        }
      } else {
        console.warn("[/continuar] resposta não ok:", res.status);
      }
    } catch (e) { console.error("[/continuar] erro:", e); }
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
        setUserCoords({ lat: userLat, lon: userLon });
      }

      console.log("📍 Coordenadas usuario:", { lat: userLat, lon: userLon });
      console.log("[userCoords] lat:", userCoords?.lat, "lon:", userCoords?.lon);

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
      const cesParaDev = devCESelected ? ces.filter(ce => ce.name === devCESelected || ce.addressName === devCESelected) : null;
      const cesFiltradas = cesParaDev?.length ? cesParaDev : (ceFijada ? ces.filter(ce => ce.name === ceFijada || ce.addressName === ceFijada) : ces);
      const ceResult = await runZonaCheck(userLat, userLon, cesFiltradas.length ? cesFiltradas : ces);
      enviarLead(LEAD_URL, { cliente, ...ceResult, id_generacion: ceResult?.idGeneracion || resolverIdGeneracion(idGeneracion, ceResult?.ceNombre) }, () => setLeadWarn(true)); // fire-and-forget
      const ceRestringida = !devCESelected && RESTRICT_TO_CE && ceResult?.fsmstate === "01_DENTRO_ZONA" && ceResult?.ceNombre !== RESTRICT_TO_CE;
      if (ceRestringida) {
        updateFsmstate("02_FUERA_ZONA");
        await chamarContinuar({ ...ceResult, fsmstate: "02_FUERA_ZONA" });
        setStatus("fuera_zona");
      } else if (ceResult?.fsmstate === "02_FUERA_ZONA") {
        await chamarContinuar(ceResult);
        setStatus("fuera_zona");
      } else {
        if (FORCE_WAITING_LIST) {
          setCeStatus("Waiting list");
        }
        await chamarContinuar(ceResult);
        setStep(2);
      }
    } catch {
      setZonaWarn("No pudimos verificar tu zona. Continuamos sin verificación de cobertura.");
      updateFsmstate("02_FUERA_ZONA");
      setCeNombre(""); setCeDireccion(""); setCeDistancia(null); setCeRadio(null);
      await chamarContinuar(null);
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  // ── Handlers — PDF ───────────────────────────────────────────────────────
  const handleFile = (f) => {
    if (!f) return;
    if (f.type === "application/pdf") {
      setFile(f); setError("");
    } else {
      setFile(null);
      setError("Archivo no válido. Asegúrate de que sea una factura en formato PDF.");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const NOMBRES_MESES = {
    1:"enero", 2:"febrero", 3:"marzo", 4:"abril", 5:"mayo", 6:"junio",
    7:"julio", 8:"agosto", 9:"septiembre", 10:"octubre", 11:"noviembre", 12:"diciembre",
  };

  // Achata a resposta do novo /facturas/extraer (estrutura aninhada) para o formato plano usado pelo código
  const flattenFacturaResponse = (raw) => {
    const f = raw.factura ?? raw;
    const pot  = f.potencias_kw    ?? {};
    const con  = f.consumos_kwh    ?? {};
    const pp   = f.precios_potencia ?? {};
    const pe   = f.precios_energia  ?? {};
    const imp  = f.impuestos        ?? {};
    const otros = f.otros           ?? {};
    const desc  = otros.descuentos  ?? {};
    return {
      cups:             f.cups,
      comercializadora: f.comercializadora,
      distribuidora:    f.distribuidora,
      tarifa_acceso:    f.tarifa_acceso,
      periodo_inicio:   f.periodo_inicio,
      periodo_fin:      f.periodo_fin,
      dias_facturados:  f.dias_facturados,
      importe_factura:  f.importe_factura,
      // potencias
      pot_p1_kw: pot.p1 ?? f.pot_p1_kw, pot_p2_kw: pot.p2 ?? f.pot_p2_kw, pot_p3_kw: pot.p3 ?? f.pot_p3_kw,
      pot_p4_kw: pot.p4 ?? f.pot_p4_kw, pot_p5_kw: pot.p5 ?? f.pot_p5_kw, pot_p6_kw: pot.p6 ?? f.pot_p6_kw,
      // consumos
      consumo_p1_kwh: con.p1 ?? f.consumo_p1_kwh, consumo_p2_kwh: con.p2 ?? f.consumo_p2_kwh, consumo_p3_kwh: con.p3 ?? f.consumo_p3_kwh,
      consumo_p4_kwh: con.p4 ?? f.consumo_p4_kwh, consumo_p5_kwh: con.p5 ?? f.consumo_p5_kwh, consumo_p6_kwh: con.p6 ?? f.consumo_p6_kwh,
      // precios potencia
      pp_p1: pp.p1 ?? f.pp_p1, pp_p2: pp.p2 ?? f.pp_p2, pp_p3: pp.p3 ?? f.pp_p3,
      pp_p4: pp.p4 ?? f.pp_p4, pp_p5: pp.p5 ?? f.pp_p5, pp_p6: pp.p6 ?? f.pp_p6,
      // precios energia
      pe_p1: pe.pe_p1 ?? f.pe_p1, pe_p2: pe.pe_p2 ?? f.pe_p2, pe_p3: pe.pe_p3 ?? f.pe_p3,
      pe_p4: pe.pe_p4 ?? f.pe_p4, pe_p5: pe.pe_p5 ?? f.pe_p5, pe_p6: pe.pe_p6 ?? f.pe_p6,
      // impuestos
      imp_ele: imp.imp_ele ?? f.imp_ele, iva: imp.iva ?? f.iva,
      // otros básicos
      alq_eq_dia: otros.alq_eq_dia ?? f.alq_eq_dia, bono_social: desc.bono_social ?? f.bono_social,
      // otros nuevos
      consumo_periodo1_kwh:        otros.consumo_periodo1_kwh,
      precio_periodo1_eur_kwh:     otros.precio_periodo1_eur_kwh,
      importe_periodo1_eur:        otros.importe_periodo1_eur,
      consumo_periodo2_kwh:        otros.consumo_periodo2_kwh,
      precio_periodo2_eur_kwh:     otros.precio_periodo2_eur_kwh,
      importe_periodo2_eur:        otros.importe_periodo2_eur,
      subtotal_sin_ie:             otros.subtotal_sin_ie,
      cuantia_peajes_cargos:       otros.cuantia_peajes_cargos,
      cnae:                        otros.cnae,
      boe_peajes_fecha:            otros.boe_peajes_fecha,
      boe_cargos_fecha:            otros.boe_cargos_fecha,
      fecha_final_contrato:        otros.fecha_final_contrato,
      potencia_maxima_p1_kw:       otros.potencia_maxima_p1_kw,
      potencia_maxima_p2_kw:       otros.potencia_maxima_p2_kw,
      consumo_medio_cp_kwh:        otros.consumo_medio_cp_kwh,
      mix_naturgy_renovable_pct:          otros.mix_naturgy_renovable_pct,
      mix_naturgy_cogeneracion_pct:       otros.mix_naturgy_cogeneracion_pct,
      mix_naturgy_cc_gas_natural_pct:     otros.mix_naturgy_cc_gas_natural_pct,
      mix_naturgy_carbon_pct:             otros.mix_naturgy_carbon_pct,
      mix_naturgy_fuel_gas_pct:           otros.mix_naturgy_fuel_gas_pct,
      mix_naturgy_nuclear_pct:            otros.mix_naturgy_nuclear_pct,
      mix_naturgy_otras_no_renovables_pct:otros.mix_naturgy_otras_no_renovables_pct,
      mix_nacional_renovable_pct:          otros.mix_nacional_renovable_pct,
      mix_nacional_cogeneracion_pct:       otros.mix_nacional_cogeneracion_pct,
      mix_nacional_cc_gas_natural_pct:     otros.mix_nacional_cc_gas_natural_pct,
      mix_nacional_carbon_pct:             otros.mix_nacional_carbon_pct,
      mix_nacional_fuel_gas_pct:           otros.mix_nacional_fuel_gas_pct,
      mix_nacional_nuclear_pct:            otros.mix_nacional_nuclear_pct,
      mix_nacional_otras_no_renovables_pct:otros.mix_nacional_otras_no_renovables_pct,
      emisiones_co2_eq_g_kwh:      otros.emisiones_co2_eq_g_kwh,
      media_nacional_co2_g_kwh:    otros.media_nacional_co2_g_kwh,
      residuos_radiactivos_ug_kwh: otros.residuos_radiactivos_ug_kwh,
      media_nacional_residuos_ug_kwh: otros.media_nacional_residuos_ug_kwh,
      segmento_cargos:             otros.segmento_cargos,
      distribucion_energia_pct:    otros.distribucion_energia_pct,
      distribucion_impuestos_pct:  otros.distribucion_impuestos_pct,
      distribucion_alquiler_pct:   otros.distribucion_alquiler_pct,
      distribucion_peajes_pct:     otros.distribucion_peajes_pct,
      distribucion_cargos_pct:     otros.distribucion_cargos_pct,
      cargos_recore_pct:           otros.cargos_recore_pct,
      cargos_deficit_pct:          otros.cargos_deficit_pct,
      cargos_tnp_pct:              otros.cargos_tnp_pct,
      cargos_otros_pct:            otros.cargos_otros_pct,
    };
  };

  const handleAnalizarPDF = async () => {
    if (!file) return;
    setLoading(true); setLoadingMsg("Analizando tu factura..."); setError("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${API_BASE}/facturas/extraer`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Tu factura requiere revisión manual. Un asesor se pondrá en contacto contigo en breve.");
      const data = await res.json();
      if (data.session_id) setExtractSessionId(data.session_id);
      console.log("[extraer] session_id recebido:", data.session_id ?? null);
      const flat = flattenFacturaResponse(data);
      setFacturaData(flat);
      setAdvertenciaAno(data.advertencia_ano === true);
      setSuministroLat(data.suministro_lat ?? null);
      setSuministroLon(data.suministro_lon ?? null);
      setNombreCliente(data.nombre_cliente ?? null);
      setDireccionSuministro(data.direccion_suministro ?? null);
      if (SUMINISTRO_ZONA_CHECK && data.suministro_lat && data.suministro_lon) {
        const ces = listaCERef.current.length > 0 ? listaCERef.current : listaCE;
        if (ces && ces.length > 0) {
          const dentroZona = ces.some(ce =>
            haversineDistance(data.suministro_lat, data.suministro_lon, parseFloat(ce.lat), parseFloat(ce.lng)) <= parseFloat(ce.radioMetros)
          );
          if (!dentroZona) setZonaWarn("El punto de suministro de la factura está fuera de la zona de cobertura.");
        }
      }
      const facturaBuiltPDF = {
        ...buildFactura({ ...flat, ...Object.fromEntries(Object.entries(manualFields).filter(([, v]) => v !== "")), modo: modoAlquiler ? "alquiler" : "venta" }),
        nombre_cliente:       data.nombre_cliente       ?? null,
        direccion_suministro: data.direccion_suministro ?? null,
        suministro_lat:       data.suministro_lat       ?? null,
        suministro_lon:       data.suministro_lon       ?? null,
      };
      if (TARIFAS_MULTI_FACTURA.includes(data.tarifa_acceso)) {
        const mes = parseInt(data.periodo_fin?.split("/")?.[1]);
        if (mes >= 1 && mes <= 12) {
          const periodosDoMes1 = PERIODOS_POR_MES_3TD[mes] ?? [];
          const mesesPrinc1 = sugerirMeses3TD(mes);
          setMesesSugeridos1(mesesPrinc1);
          const periodosCobertos1 = mesesPrinc1
            .filter(({ cobertura }) => cobertura === mesesPrinc1[0]?.cobertura)
            .flatMap(({ mes: m }) => PERIODOS_POR_MES_3TD[m] ?? []);
          const periodosJaCobertos2 = [...new Set([...periodosDoMes1, ...periodosCobertos1])];
          setMesesSugeridos2(sugerirMeses3TD(mes, periodosJaCobertos2));
        }
        setStatus("analyzed");
        setLoading(false);
      } else {
        setLoadingMsg("Preparando tu plan...");
        // Passa session_id directamente — setExtractSessionId acima é async e
        // o estado React pode ainda não ter sido atualizado quando handleEnviar
        // ler extractSessionId no closure.
        handleEnviar({ facturaBuilt: facturaBuiltPDF, sessionIdOverride: data.session_id ?? null });
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const buildFactura1 = () => {
    if (!factura1Data) return {};
    return buildFactura(factura1Data);
  };

  const handleFile1Change = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    // Validação PDF
    const esPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (!esPdf) {
      setError1("Archivo no válido. Asegúrate de que sea una factura en formato PDF.");
      return;
    }
    setFile1(f); setLoading1(true); setError1(""); setErrorMes1(false);
    try {
      const fd = new FormData();
      fd.append("file", f, f.name);
      const res = await fetch(`${API_BASE}/facturas/extraer`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("Tu factura requiere revisión manual. Un asesor se pondrá en contacto contigo en breve.");
      const data = await res.json();

      const flat1 = flattenFacturaResponse(data);
      const mes1 = parseInt(facturaData?.periodo_fin?.split("/")?.[1]);
      const mes2 = parseInt(flat1.periodo_fin?.split("/")?.[1]);
      // Mês deve estar nos sugeridos (e diferente do da 1ª)
      const mesesSugeridosMes2 = mesesSugeridos1.map(({ mes }) => mes);
      const mesNoCoincide = mes1 === mes2 || (mesesSugeridosMes2.length > 0 && !mesesSugeridosMes2.includes(mes2));
      if (mesNoCoincide) {
        setErrorMes1(true);
        setFile1(null); setLoading1(false); return;
      }

      // Recalcular sugestões para 3ª fatura excluindo períodos cobertos pela 2ª fatura
      const periodos1 = PERIODOS_POR_MES_3TD[mes1] ?? [];
      const periodos2 = PERIODOS_POR_MES_3TD[mes2] ?? [];
      const periodosCobertos2 = [...new Set([...periodos1, ...periodos2])];
      setMesesSugeridos2(sugerirMeses3TD(mes1, periodosCobertos2));
      if (data.session_id) setExtract1SessionId(data.session_id);
      setFactura1Data(flat1);
    } catch {
      setError1("Error al extraer la segunda factura");
    } finally {
      setLoading1(false);
    }
  };

  const handleFile2Change = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const esPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (!esPdf) {
      setError2("Archivo no válido. Asegúrate de que sea una factura en formato PDF.");
      return;
    }
    setFile2(f); setLoading2(true); setError2(""); setErrorMes2(false);
    try {
      const fd = new FormData();
      fd.append("file", f, f.name);
      const res = await fetch(`${API_BASE}/facturas/extraer`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("Tu factura requiere revisión manual. Un asesor se pondrá en contacto contigo en breve.");
      const data = await res.json();

      const flat2 = flattenFacturaResponse(data);
      const mes1 = parseInt(facturaData?.periodo_fin?.split("/")?.[1]);
      const mes3 = parseInt(flat2.periodo_fin?.split("/")?.[1]);
      const mesesSugeridosMes3 = mesesSugeridos2.map(({ mes }) => mes);
      const mesNoCoincide = mes1 === mes3 || (mesesSugeridosMes3.length > 0 && !mesesSugeridosMes3.includes(mes3));
      if (mesNoCoincide) {
        setErrorMes2(true);
        setFile2(null); setLoading2(false); return;
      }

      if (data.session_id) setExtract2SessionId(data.session_id);
      setFactura2Data(flat2);
    } catch {
      setError2("Error al extraer la tercera factura");
    } finally {
      setLoading2(false);
    }
  };

  const buildFactura2 = () => {
    if (!factura2Data) return {};
    return buildFactura(factura2Data);
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
      const mergedManual = { ...manualFields, periodo_inicio: data.periodo_inicio || manualFields.periodo_inicio, periodo_fin: data.periodo_fin || manualFields.periodo_fin };
      setManualFields(mergedManual);
      const facturaBuiltCUPS = buildFactura({ cups, ...data, ...mergedManual, modo: modoAlquiler ? "alquiler" : "venta" });
      setLoadingMsg("Preparando tu plan...");
      handleEnviar({ facturaBuilt: facturaBuiltCUPS });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
    // eslint-disable-next-line no-useless-return
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
    lat:        userCoords?.lat ?? null,
    lon:        userCoords?.lon ?? null,
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
      bono_social:      d.bono_social      ?? null,
      cuotaAlquilerMes: d.cuotaAlquilerMes ?? null,
      importeDeposito:  d.cuotaAlquilerMes != null ? String(d.cuotaAlquilerMes * 2) : null,
      consumo_periodo1_kwh:        d.consumo_periodo1_kwh        ?? null,
      precio_periodo1_eur_kwh:     d.precio_periodo1_eur_kwh     ?? null,
      importe_periodo1_eur:        d.importe_periodo1_eur        ?? null,
      consumo_periodo2_kwh:        d.consumo_periodo2_kwh        ?? null,
      precio_periodo2_eur_kwh:     d.precio_periodo2_eur_kwh     ?? null,
      importe_periodo2_eur:        d.importe_periodo2_eur        ?? null,
      subtotal_sin_ie:             d.subtotal_sin_ie             ?? null,
      cuantia_peajes_cargos:       d.cuantia_peajes_cargos       ?? null,
      cnae:                        d.cnae                        ?? null,
      boe_peajes_fecha:            d.boe_peajes_fecha            ?? null,
      boe_cargos_fecha:            d.boe_cargos_fecha            ?? null,
      fecha_final_contrato:        d.fecha_final_contrato        ?? null,
      potencia_maxima_p1_kw:       d.potencia_maxima_p1_kw       ?? null,
      potencia_maxima_p2_kw:       d.potencia_maxima_p2_kw       ?? null,
      consumo_medio_cp_kwh:        d.consumo_medio_cp_kwh        ?? null,
      mix_naturgy_renovable_pct:           d.mix_naturgy_renovable_pct           ?? null,
      mix_naturgy_cogeneracion_pct:        d.mix_naturgy_cogeneracion_pct        ?? null,
      mix_naturgy_cc_gas_natural_pct:      d.mix_naturgy_cc_gas_natural_pct      ?? null,
      mix_naturgy_carbon_pct:              d.mix_naturgy_carbon_pct              ?? null,
      mix_naturgy_fuel_gas_pct:            d.mix_naturgy_fuel_gas_pct            ?? null,
      mix_naturgy_nuclear_pct:             d.mix_naturgy_nuclear_pct             ?? null,
      mix_naturgy_otras_no_renovables_pct: d.mix_naturgy_otras_no_renovables_pct ?? null,
      mix_nacional_renovable_pct:           d.mix_nacional_renovable_pct           ?? null,
      mix_nacional_cogeneracion_pct:        d.mix_nacional_cogeneracion_pct        ?? null,
      mix_nacional_cc_gas_natural_pct:      d.mix_nacional_cc_gas_natural_pct      ?? null,
      mix_nacional_carbon_pct:              d.mix_nacional_carbon_pct              ?? null,
      mix_nacional_fuel_gas_pct:            d.mix_nacional_fuel_gas_pct            ?? null,
      mix_nacional_nuclear_pct:             d.mix_nacional_nuclear_pct             ?? null,
      mix_nacional_otras_no_renovables_pct: d.mix_nacional_otras_no_renovables_pct ?? null,
      emisiones_co2_eq_g_kwh:       d.emisiones_co2_eq_g_kwh       ?? null,
      media_nacional_co2_g_kwh:     d.media_nacional_co2_g_kwh     ?? null,
      residuos_radiactivos_ug_kwh:  d.residuos_radiactivos_ug_kwh  ?? null,
      media_nacional_residuos_ug_kwh: d.media_nacional_residuos_ug_kwh ?? null,
      segmento_cargos:              d.segmento_cargos              ?? null,
      distribucion_energia_pct:     d.distribucion_energia_pct     ?? null,
      distribucion_impuestos_pct:   d.distribucion_impuestos_pct   ?? null,
      distribucion_alquiler_pct:    d.distribucion_alquiler_pct    ?? null,
      distribucion_peajes_pct:      d.distribucion_peajes_pct      ?? null,
      distribucion_cargos_pct:      d.distribucion_cargos_pct      ?? null,
      cargos_recore_pct:            d.cargos_recore_pct            ?? null,
      cargos_deficit_pct:           d.cargos_deficit_pct           ?? null,
      cargos_tnp_pct:               d.cargos_tnp_pct               ?? null,
      cargos_otros_pct:             d.cargos_otros_pct             ?? null,
    },
  });

  const buildFacturaPDF = () => {
    if (!facturaData) return {};
    const merged = { ...facturaData, ...Object.fromEntries(
      Object.entries(manualFields).filter(([, v]) => v !== "")
    ), modo: modoAlquiler ? "alquiler" : "venta" };
    return {
      ...buildFactura(merged),
      nombre_cliente:       nombreCliente,
      direccion_suministro: direccionSuministro,
      suministro_lat:       suministroLat,
      suministro_lon:       suministroLon,
    };
  };

  const buildFacturaCUPS = () =>
    buildFactura({ cups, ...cupsData, ...manualFields, modo: modoAlquiler ? "alquiler" : "venta" });

  const handleEnviarAsesor = async () => {
    if (sending) return;
    setSending(true); setError(""); setStatus("loading_plan");    try {
      const fd = new FormData();
      fd.append("data", JSON.stringify({
        cliente,
        Fsmstate, FsmPrevious: fsmPrevious,
        ce: { nombre: ceNombre, direccion: ceDireccion, status: ceStatus, etiqueta: ceEtiqueta, id_generacion: resolverIdGeneracion(idGeneracion, ceNombre), paneles_disponibles: cePanelesDisponibles ?? null, paneles_a_la_venta: cePanelesALaVenta ?? null, paneles_totales: cePanelesTotales ?? null },
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

  const handleEnviar = async ({ facturaBuilt, sessionIdOverride } = {}) => {
    if (sending) return;
    // Race React: extractSessionId pode ainda ser null se handleEnviar for chamado
    // imediatamente após setExtractSessionId. Usar override (passado pelo caller que
    // acabou de receber session_id de /facturas/extraer) tem prioridade.
    const effectiveExtractSessionId = sessionIdOverride ?? extractSessionId;

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
        const facturaAsesor = facturaBuilt ?? (mode === "pdf" ? buildFacturaPDF() : buildFacturaCUPS());
        const cePayload = { nombre: ceNombre, direccion: ceDireccion, status: ceStatus, etiqueta: ceEtiqueta, id_generacion: resolverIdGeneracion(idGeneracion, ceNombre), paneles_disponibles: cePanelesDisponibles ?? null, paneles_a_la_venta: cePanelesALaVenta ?? null, paneles_totales: cePanelesTotales ?? null };

        // Enviar ao Zoho Flow via /enviar (igual ao fluxo normal)
        const fd = new FormData();
        fd.append("data", JSON.stringify({ cliente: buildClientePayload(), factura: facturaAsesor, Fsmstate, FsmPrevious: fsmPrevious, ce: cePayload, session_id: effectiveExtractSessionId, continuar_session_id: continuarSessionId }));
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
        const dataEnviar       = await resEnviar.json().catch(() => ({}));
        const dealIdRecebido   = dataEnviar?.dealId      ?? null;
        const mpklogIdRecebido = dataEnviar?.mpklogId    ?? null;
        const sessionIdRecebido = dataEnviar?.session_id ?? null;
        if (dealIdRecebido)   setDealId(dealIdRecebido);
        if (mpklogIdRecebido) setMpklogId(mpklogIdRecebido);
        console.log("[handleEnviar/asesor] IDs recebidos:", { dealId: dealIdRecebido, mpklogId: mpklogIdRecebido, session_id: sessionIdRecebido });

        // Guardar dados flat para restaurar após redirect do Cotizador (modo asesor)
        const facturaFlatAsesor = mode === "pdf"
          ? { ...facturaData, ...Object.fromEntries(Object.entries(manualFields).filter(([, v]) => v !== "")), cuotaAlquilerMes: cuotaAlquilerMes ?? null, importeDeposito: importeDeposito ?? null }
          : { cups, ...cupsData, ...manualFields, cuotaAlquilerMes: cuotaAlquilerMes ?? null, importeDeposito: importeDeposito ?? null };
        localStorage.setItem("cs_cliente",    JSON.stringify({ ...buildClientePayload(dealIdRecebido, mpklogIdRecebido) }));
        localStorage.setItem("cs_factura",    JSON.stringify(facturaFlatAsesor));
        localStorage.setItem("cs_ce",         JSON.stringify(cePayload));
        localStorage.setItem("cs_dealId",     dealIdRecebido    ?? "");
        localStorage.setItem("cs_mpklogId",   mpklogIdRecebido  ?? "");
        localStorage.setItem("cs_fsmstate",   Fsmstate          ?? "");
        localStorage.setItem("cs_mode",       mode              ?? "");
        localStorage.setItem("cs_session_id", sessionIdRecebido ?? "");

        const idGenAsesor = resolverIdGeneracion(idGeneracion, ceNombre);
        const redirectUrlAsesor = `${PLAN_REDIRECT_URL}?coming-from-extractor=true&id_generacion=${encodeURIComponent(idGenAsesor ?? "")}&session_id=${encodeURIComponent(sessionIdRecebido ?? "")}`;
        window.location.href = redirectUrlAsesor;
      } catch (err) {
        console.error("[asesor] Erro no envío:", err);
        setError(err.message);
      } finally {
        setSending(false);
      }
      return; // não continuar para o fluxo normal
    }

    setSending(true); setError(""); setStatus("loading_plan");
    const factura = facturaBuilt ?? (mode === "pdf" ? buildFacturaPDF() : buildFacturaCUPS());
    const cePayload = { nombre: ceNombre, direccion: ceDireccion, status: ceStatus, etiqueta: ceEtiqueta, id_generacion: resolverIdGeneracion(idGeneracion, ceNombre), paneles_disponibles: cePanelesDisponibles ?? null, paneles_a_la_venta: cePanelesALaVenta ?? null, paneles_totales: cePanelesTotales ?? null };
    try {
      console.log("[handleEnviar] cliente.lat:", userCoords?.lat, "cliente.lon:", userCoords?.lon);
      const fd = new FormData();
      const dataPayload = {
        cliente: buildClientePayload(), factura, Fsmstate, FsmPrevious: fsmPrevious, ce: cePayload,
        session_id: effectiveExtractSessionId,
        continuar_session_id: continuarSessionId,
        ...(factura1Data && { factura_1: buildFactura1(), session_id_1: extract1SessionId }),
        ...(factura2Data && { factura_2: buildFactura2(), session_id_2: extract2SessionId }),
      };
      console.log("[handleEnviar] session_id no payload:", effectiveExtractSessionId, "(override:", sessionIdOverride, ", state:", extractSessionId, ")");
      fd.append("data", JSON.stringify(dataPayload));
      if (mode === "pdf" && file) fd.append("file", file, file.name);
      const resEnviar  = await fetch(`${API_BASE}/enviar`, { method: "POST", body: fd });
      const dataEnviar = await resEnviar.json().catch(() => ({}));
      if (!resEnviar.ok) {
        const detail = typeof dataEnviar.detail === "string" ? dataEnviar.detail : JSON.stringify(dataEnviar.detail) || `HTTP ${resEnviar.status}`;
        throw new Error(detail);
      }
      const dealIdRecebido   = dataEnviar?.dealId    ?? null;
      const mpklogIdRecebido = dataEnviar?.mpklogId  ?? null;
      const sessionIdRecebido = dataEnviar?.session_id ?? null;
      if (dealIdRecebido)   setDealId(dealIdRecebido);
      if (mpklogIdRecebido) setMpklogId(mpklogIdRecebido);
      console.log("[handleEnviar] IDs recebidos:", { dealId: dealIdRecebido, mpklogId: mpklogIdRecebido, session_id: sessionIdRecebido });

      // Guardar dados para restaurar após redirect do Cotizador
      // cs_factura em formato flat (não estruturado) — buildFactura() espera pot_p1_kw, pe_p1, etc.
      const facturaFlat = mode === "pdf"
        ? { ...facturaData, ...Object.fromEntries(Object.entries(manualFields).filter(([, v]) => v !== "")), cuotaAlquilerMes: cuotaAlquilerMes ?? null, importeDeposito: importeDeposito ?? null }
        : { cups, ...cupsData, ...manualFields, cuotaAlquilerMes: cuotaAlquilerMes ?? null, importeDeposito: importeDeposito ?? null };
      localStorage.setItem("cs_cliente",    JSON.stringify({ ...buildClientePayload(dealIdRecebido, mpklogIdRecebido) }));
      localStorage.setItem("cs_factura",    JSON.stringify(facturaFlat));
      localStorage.setItem("cs_ce",         JSON.stringify({ nombre: ceNombre, direccion: ceDireccion, status: ceStatus, etiqueta: ceEtiqueta, id_generacion: resolverIdGeneracion(idGeneracion, ceNombre), paneles_disponibles: cePanelesDisponibles ?? null, paneles_a_la_venta: cePanelesALaVenta ?? null, paneles_totales: cePanelesTotales ?? null }));
      localStorage.setItem("cs_dealId",     dealIdRecebido    ?? "");
      localStorage.setItem("cs_mpklogId",   mpklogIdRecebido  ?? "");
      localStorage.setItem("cs_fsmstate",   Fsmstate          ?? "");
      localStorage.setItem("cs_mode",       mode              ?? "");
      localStorage.setItem("cs_session_id", sessionIdRecebido ?? "");

      // Abrir Cotizador em nova aba com URL simplificada
      const idGenResolvido = resolverIdGeneracion(idGeneracion, ceNombre);
      const redirectUrl = `${PLAN_REDIRECT_URL}?coming-from-extractor=true&id_generacion=${encodeURIComponent(idGenResolvido ?? "")}&session_id=${encodeURIComponent(sessionIdRecebido ?? "")}`;
      console.log("[handleEnviar] redirect URL:", redirectUrl);
      setLoading(false);
      window.open(redirectUrl, "_blank");
      setPlanAbierto(true);

      // O plano é calculado e mostrado no Cotizador (nova aba) — não chamar QUOTING_URL aqui
      setStatus("loading_plan");
    } catch (err) {
      setLoading(false);
      setError(err.message);
      setStatus("idle");
    } finally {
      setSending(false);
    }
  };

  const handleOptimizar = async () => {
    setModalOptimizar("loading");
    const factura = mode === "pdf" ? buildFacturaPDF() : buildFacturaCUPS();
    const payload = {
      cliente, factura, Fsmstate, FsmPrevious: fsmPrevious,
      ce: { nombre: ceNombre, direccion: ceDireccion, status: ceStatus, etiqueta: ceEtiqueta, id_generacion: resolverIdGeneracion(idGeneracion, ceNombre), paneles_disponibles: cePanelesDisponibles ?? null, paneles_a_la_venta: cePanelesALaVenta ?? null, paneles_totales: cePanelesTotales ?? null },
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

  const handleEntrarListaEspera = async () => {
    setEnviandoContrato(true);
    const sd        = sesionData ?? null;
    const sdCliente = sd?.cliente ?? {};
    const sdFactura = sd?.factura ?? null;
    const sdCe      = sd?.ce      ?? {};
    const urlRef    = urlParamsRef.current;
    const urlFact   = urlRef.factura   ?? {};
    const urlCli    = urlRef.cliente   ?? {};
    const facturaLS = urlRef.facturaLS ?? null;
    const modeEff   = mode ?? sd?.mode ?? urlRef.modeLS ?? null;
    const rawData   = facturaData ?? cupsData ?? (urlFact.cups || urlFact.comercializadora ? urlFact : null) ?? {};
    const ensureStructured = (obj) => {
      if (!obj || Object.keys(obj).length === 0) return {};
      if (obj.potencias_kw !== undefined) return obj;
      return buildFactura(obj);
    };
    let factura;
    if (modeEff === "pdf") {
      factura = facturaData
        ? ensureStructured({ ...facturaData, ...Object.fromEntries(Object.entries(manualFields).filter(([, v]) => v !== "")), cuotaAlquilerMes: cuotaAlquilerMes ?? null, importeDeposito: importeDeposito ?? null })
        : ensureStructured(sdFactura ?? facturaLS);
    } else if (modeEff === "cups") {
      factura = cupsData
        ? ensureStructured({ cups, ...cupsData, ...manualFields, cuotaAlquilerMes: cuotaAlquilerMes ?? null, importeDeposito: importeDeposito ?? null })
        : ensureStructured(sdFactura ?? facturaLS);
    } else {
      factura = ensureStructured(sdFactura ?? facturaLS ?? rawData);
    }
    let dealIdFinal   = dealId   ?? sd?.dealId   ?? urlRef.dealId   ?? null;
    let mpklogIdFinal = mpklogId ?? sd?.mpklogId ?? urlRef.mpklogId ?? null;
    const cleanUrl = (val) => (!val || val === "—") ? "" : val;

    // motivoDeEspera — clasifica el motivo por el cual el cliente entra en lista de espera.
    //   "Sin plazas" → Paneles_disponibles (CRM) < panelesSel
    //   "Quoting"    → dentro de zona pero la CE no está Available
    //   null         → resto (p.ej. fuera de zona — el Flow ya lo trata por Fsmstate)
    const ceStatusEff = ceStatus || sdCe.status || urlRef.ce?.status || "";
    const fsmEff      = Fsmstate || sd?.Fsmstate || urlRef.fsmstate || "";
    const panelesDispEff = cePanelesDisponibles ?? sdCe.paneles_disponibles ?? null;
    let motivoDeEspera = null;
    if (panelesDispEff != null && panelesSel != null && panelesDispEff < panelesSel) {
      motivoDeEspera = "Sin plazas";
    } else if (fsmEff === "01_DENTRO_ZONA" && ceStatusEff !== "Available") {
      motivoDeEspera = "Quoting";
    }
    setMotivoListaEspera(motivoDeEspera);
    console.log("[handleEntrarListaEspera] motivoDeEspera calculado:", {
      motivoDeEspera,
      panelesDisp_state: cePanelesDisponibles,
      panelesDisp_sesion: sdCe.paneles_disponibles,
      panelesDispEff,
      panelesSel,
      ceStatusEff,
      fsmEff,
      reglaAplicada:
        motivoDeEspera === "Sin plazas" ? "panelesDispEff < panelesSel" :
        motivoDeEspera === "Quoting"    ? "01_DENTRO_ZONA y ceStatus != Available" :
        "ninguna (null)",
    });

    const payload = {
      cliente: {
        nombre:         cliente.nombre    || sdCliente.nombre    || cleanUrl(urlCli.nombre)    || "",
        apellidos:      cliente.apellidos || sdCliente.apellidos || cleanUrl(urlCli.apellidos) || "",
        correo:         cliente.correo    || sdCliente.correo    || cleanUrl(urlCli.correo)    || "",
        telefono:       cliente.telefono  || sdCliente.telefono  || cleanUrl(urlCli.telefono)  || "",
        direccion:      cliente.direccion || sdCliente.direccion || cleanUrl(urlCli.direccion) || "",
        dealId:         dealIdFinal    ?? null,
        mpklogId:       mpklogIdFinal  ?? null,
        databaseId:     "00001",
        lat:            userCoords?.lat ?? null,
        lon:            userCoords?.lon ?? null,
        dni:            "",
        iban:           "",
        tipoVenta:      modoAlquiler ? "Alquiler" : "Venta",
        planContratado: true,
        listaDeEspera:  true,
      },
      factura: {
        ...factura,
        precios_energia: {
          pe_p1: parseFloat(manualFields.pe_p1 || rawData.pe_p1 || facturaLS?.precios_energia?.pe_p1) || null,
          pe_p2: parseFloat(manualFields.pe_p2 || rawData.pe_p2 || facturaLS?.precios_energia?.pe_p2) || null,
          pe_p3: parseFloat(manualFields.pe_p3 || rawData.pe_p3 || facturaLS?.precios_energia?.pe_p3) || null,
          pe_p4: parseFloat(manualFields.pe_p4 || rawData.pe_p4 || facturaLS?.precios_energia?.pe_p4) || null,
          pe_p5: parseFloat(manualFields.pe_p5 || rawData.pe_p5 || facturaLS?.precios_energia?.pe_p5) || null,
          pe_p6: parseFloat(manualFields.pe_p6 || rawData.pe_p6 || facturaLS?.precios_energia?.pe_p6) || null,
        },
        importe_factura: parseFloat(manualFields.importe_factura || rawData.importe_factura || facturaLS?.importe_factura) || null,
      },
      Fsmstate:    "08_PROPUESTA_ALQ",
      FsmPrevious: Fsmstate || sd?.Fsmstate || urlRef.fsmstate || null,
      motivoDeEspera,
      plan_url:    window.location.href,
      session_id:  extractSessionId ?? localStorage.getItem("cs_session_id") ?? null,
      ...(sd?.facturaPreview && { facturaPreview: sd.facturaPreview }),
      plan: {
        ahorro25Anos:            planData?.ahorro25Anos,
        pagoUnico:               planData?.pagoUnico,
        pagoFinanciado:          planData?.pagoFinanciado,
        ahorroMensual:           planData?.ahorroMensual,
        ahorroAnual:             planData?.ahorroAnual,
        ahorroAnualPercent:      planData?.ahorroAnualPercent,
        produccionAnual:         planData?.produccionAnual,
        potenciaTotal:           planData?.potenciaTotal,
        coeficienteDistribucion: planData?.coeficienteDistribucion,
        plazoRecuperacion:       planData?.plazoRecuperacion,
        panelesSel:              planData?.panelesSel,
        cuotaAlquilerMes:        planData?.cuotaAlquilerMes,
        importeDeposito:         importeDeposito ?? null,
      },
      ce: {
        nombre:        ceNombre    || sdCe.nombre    || urlRef.ce?.nombre    || "",
        direccion:     ceDireccion || sdCe.direccion || urlRef.ce?.direccion || "",
        status:        ceStatus    || sdCe.status    || urlRef.ce?.status    || "",
        etiqueta:      ceEtiqueta  || sdCe.etiqueta  || urlRef.ce?.etiqueta  || "",
        id_generacion: resolverIdGeneracion(idGeneracion || sdCe.id_generacion || urlRef.idGen, ceNombre || sdCe.nombre || urlRef.ce?.nombre),
        paneles_disponibles: cePanelesDisponibles ?? sdCe.paneles_disponibles ?? null,
        paneles_a_la_venta:  cePanelesALaVenta  ?? sdCe.paneles_a_la_venta  ?? null,
        paneles_totales:     cePanelesTotales   ?? sdCe.paneles_totales     ?? null,
      },
      ...((sesionData?.factura_1 || factura1Data) && { factura_1: sesionData?.factura_1 ?? buildFactura1() }),
      ...((sesionData?.factura_2 || factura2Data) && { factura_2: sesionData?.factura_2 ?? buildFactura2() }),
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
      setAccionRealizada("lista_espera");
      setStatus("lista_espera");
    } catch (err) {
      setError(err.message);
      setStatus("lista_espera");
    } finally {
      setEnviandoContrato(false);
    }
  };

  // ── Verificação de código (chamado pela modal de código) ─────────────────
  // Recebe o input do utilizador, valida via backend e resolve a Promise pendente.
  const confirmarCodigoYContratar = async () => {
    const code = (codigoVerificacion || "").trim();
    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      setCodigoError("Introduce un código de 6 dígitos.");
      return;
    }
    const sid = codigoSessionIdRef.current;
    if (!sid) {
      setCodigoError("Sesión inválida. Cancela y vuelve a intentarlo.");
      return;
    }
    setVerificandoCodigo(true);
    setCodigoError("");
    try {
      console.log("[confirmarCodigo] POST /codigo/verificar { session_id, code:" + code + " }");
      const res = await fetch(`${API_BASE}/codigo/verificar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sid, code }),
      });
      const data = await res.json().catch(() => ({}));
      console.log("[confirmarCodigo] /codigo/verificar respondeu:", data);
      if (res.ok && data.ok === true) {
        // Resolver Promise pendente em handleContratar → continua para o POST 08
        if (codigoResolveRef.current) {
          codigoResolveRef.current(true);
          codigoResolveRef.current = null;
        }
        return;
      }
      // Erro de validação
      const reason = data.reason || "codigo_incorrecto";
      const msg = reason === "formato_invalido"
        ? "El código debe tener 6 dígitos numéricos."
        : reason === "sin_codigo"
          ? "No se encontró código activo. Reenvía un nuevo código."
          : "Código incorrecto. Verifica el código recibido por email.";
      setCodigoError(msg);
    } catch (e) {
      console.warn("[confirmarCodigo] erro de red:", e);
      setCodigoError("Error de red al verificar el código. Inténtalo de nuevo.");
    } finally {
      setVerificandoCodigo(false);
    }
  };

  // Reenviar código — chama /codigo/generar de novo (backend gera novo código,
  // sobrescreve sessão + MPK_Log, workflow Zoho dispara novo email).
  const handleReenviarCodigo = async () => {
    const sid    = codigoSessionIdRef.current;
    const mpkId  = codigoMpklogIdRef.current;
    if (!sid || !mpkId) {
      setCodigoError("No se puede reenviar — sesión inválida.");
      return;
    }
    setEnviandoCodigo(true);
    setCodigoError("");
    try {
      console.log("[reenviarCodigo] POST /codigo/generar (re-emisión)");
      const res = await fetch(`${API_BASE}/codigo/generar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sid, mpklogId: mpkId }),
      });
      const data = await res.json().catch(() => ({}));
      console.log("[reenviarCodigo] /codigo/generar respondeu:", data);
      if (res.ok && data.ok === true) {
        setCodigoVerificacion("");
        setCodigoError("Hemos reenviado un nuevo código. Revisa tu email.");
      } else {
        setCodigoError("No se pudo reenviar el código. Inténtalo en unos segundos.");
      }
    } catch (e) {
      console.warn("[reenviarCodigo] erro de red:", e);
      setCodigoError("Error de red al reenviar el código.");
    } finally {
      setEnviandoCodigo(false);
    }
  };

  // Cancelar verificação — fecha modal código e resolve Promise como falso
  const cancelarCodigo = () => {
    console.log("[cancelarCodigo] utilizador cancelou verificação");
    if (codigoResolveRef.current) {
      codigoResolveRef.current(false);
      codigoResolveRef.current = null;
    }
    setModalCodigo(false);
    setCodigoVerificacion("");
    setCodigoError("");
  };

  const handleContratar = async () => {
    if (!dniContrato.trim()) {
      setDniError("El DNI es obligatorio"); return;
    }
    if (!validarDNI(dniContrato.trim())) {
      setDniError("El DNI o NIE no es válido"); return;
    }
    if (!ibanContrato.trim()) {
      setIbanError("El IBAN es obligatorio"); return;
    }
    if (!validarIBAN(ibanContrato.trim())) {
      setIbanError("El IBAN no es válido"); return;
    }
    setDniError("");
    setEnviandoContrato(true);
    console.log("[handleContratar] DEBUG:", {mode,
  modeLS: urlParamsRef.current.modeLS,
  modeEff: mode ?? urlParamsRef.current.modeLS ?? null,
  facturaDataExists: !!facturaData,
  facturaDataKeys: facturaData ? Object.keys(facturaData).slice(0, 10) : null,
  facturaLSExists: !!urlParamsRef.current.facturaLS,
  facturaLSKeys: urlParamsRef.current.facturaLS ? Object.keys(urlParamsRef.current.facturaLS).slice(0, 10) : null,
});

    // sesionData recuperado pelo GET /sesion na PlanScreen (fonte primária em modo demo)
    const sd        = sesionData ?? null;
    const sdCliente = sd?.cliente ?? {};
    const sdFactura = sd?.factura ?? null;
    const sdCe      = sd?.ce      ?? {};

    // Ref com dados da URL como fallback secundário
    const urlRef    = urlParamsRef.current;
    const urlFact   = urlRef.factura   ?? {};
    const urlCli    = urlRef.cliente   ?? {};
    const facturaLS = urlRef.facturaLS ?? null;
    const modeEff   = mode ?? sd?.mode ?? urlRef.modeLS ?? null;

    // rawData para overrides de pe_p* e importe (fluxo normal com step 2)
    const rawData = facturaData ?? cupsData
      ?? (urlFact.cups || urlFact.comercializadora ? urlFact : null)
      ?? {};

    // Helper: normaliza para formato estruturado independentemente do formato de entrada.
    // Se já tem chaves estruturadas (potencias_kw), devolve tal qual.
    // Se tem chaves flat (pot_p1_kw), converte via buildFactura.
    const ensureStructured = (obj) => {
      if (!obj || Object.keys(obj).length === 0) return {};
      if (obj.potencias_kw !== undefined) return obj;
      return buildFactura(obj);
    };

    let factura;
    if (modeEff === "pdf") {
      factura = facturaData
        ? ensureStructured({ ...facturaData, ...Object.fromEntries(Object.entries(manualFields).filter(([, v]) => v !== "")), cuotaAlquilerMes: cuotaAlquilerMes ?? null, importeDeposito: importeDeposito ?? null })
        : ensureStructured(sdFactura ?? facturaLS);
    } else if (modeEff === "cups") {
      factura = cupsData
        ? ensureStructured({ cups, ...cupsData, ...manualFields, cuotaAlquilerMes: cuotaAlquilerMes ?? null, importeDeposito: importeDeposito ?? null })
        : ensureStructured(sdFactura ?? facturaLS);
    } else {
      factura = ensureStructured(sdFactura ?? facturaLS ?? rawData);
    }

    // Se dealId ainda não foi obtido, chamar /enviar primeiro
    // para registar no Zoho e obter dealId + mpklogId
    let dealIdFinal   = dealId   ?? sd?.dealId   ?? urlRef.dealId   ?? null;
    let mpklogIdFinal = mpklogId ?? sd?.mpklogId ?? urlRef.mpklogId ?? null;

    if (!dealIdFinal) {
      try {
        const cePayloadPre = {
          nombre:        ceNombre    || urlRef.ce?.nombre    || "",
          direccion:     ceDireccion || urlRef.ce?.direccion || "",
          status:        ceStatus    || urlRef.ce?.status    || "",
          etiqueta:      ceEtiqueta  || urlRef.ce?.etiqueta  || "",
          id_generacion: resolverIdGeneracion(idGeneracion || urlRef.idGen, ceNombre || urlRef.ce?.nombre),
          paneles_disponibles: cePanelesDisponibles ?? null,
          paneles_a_la_venta:  cePanelesALaVenta  ?? null,
          paneles_totales:     cePanelesTotales   ?? null,
        };
        const clientePre = {
          nombre:    cliente.nombre    || urlCli.nombre    || "",
          apellidos: cliente.apellidos || urlCli.apellidos || "",
          correo:    cliente.correo    || urlCli.correo    || "",
          telefono:  cliente.telefono  || urlCli.telefono  || "",
          direccion: cliente.direccion || urlCli.direccion || "",
          dealId: null, mpklogId: null, databaseId: "", dni: "",
          tipoVenta: modoAlquiler ? "Alquiler" : "Venta",
        };
        const fdPre = new FormData();
        fdPre.append("data", JSON.stringify({
          cliente: clientePre,
          factura,
          Fsmstate: Fsmstate || urlRef.fsmstate || "",
          FsmPrevious: fsmPrevious || urlRef.fsmPrevious || null,
          ce: cePayloadPre,
        }));
        if (mode === "pdf" && file) fdPre.append("file", file, file.name);

        const resEnviar  = await fetch(`${API_BASE}/enviar`, { method: "POST", body: fdPre });
        const dataEnviar = await resEnviar.json().catch(() => ({}));
        dealIdFinal   = dataEnviar?.dealId   ?? null;
        mpklogIdFinal = dataEnviar?.mpklogId ?? null;
        if (dealIdFinal)   setDealId(dealIdFinal);
        if (mpklogIdFinal) setMpklogId(mpklogIdFinal);
      } catch (e) {
        console.warn("[handleContratar] Erro ao obter dealId:", e);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Verificação por código (entre o pre-call e o POST 08_PROPUESTA_ALQ)
    // ─────────────────────────────────────────────────────────────────────────
    const sidParaCodigo = extractSessionId
      ?? localStorage.getItem("cs_session_id")
      ?? sd?.session_id
      ?? urlRef.sessionId
      ?? null;
    console.log("[handleContratar] verificação código: session_id=", sidParaCodigo, " mpklogId=", mpklogIdFinal);
    if (!sidParaCodigo) {
      console.warn("[handleContratar] sem session_id — não consigo gerar código de verificação");
      setDniError("Sesión inválida. Recarga la página y vuelve a intentarlo.");
      setEnviandoContrato(false);
      return;
    }
    if (!mpklogIdFinal) {
      console.warn("[handleContratar] sem mpklogId — não consigo gerar código de verificação");
      setDniError("Aún preparando tu sesión. Espera unos segundos e inténtalo de nuevo.");
      setEnviandoContrato(false);
      return;
    }

    // Guardar refs para reenviar / verificar mais tarde
    codigoMpklogIdRef.current  = mpklogIdFinal;
    codigoSessionIdRef.current = sidParaCodigo;

    try {
      console.log("[handleContratar] POST /codigo/generar { session_id, mpklogId }");
      const resGen = await fetch(`${API_BASE}/codigo/generar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sidParaCodigo, mpklogId: mpklogIdFinal }),
      });
      const dataGen = await resGen.json().catch(() => ({}));
      console.log("[handleContratar] /codigo/generar respondeu:", dataGen);
      if (!resGen.ok || dataGen.ok !== true) {
        const motivo = dataGen.reason === "mpklog_pending"
          ? "Aún preparando tu sesión. Espera unos segundos y reintenta."
          : "No se pudo generar el código de verificación. Inténtalo de nuevo.";
        setDniError(motivo);
        setEnviandoContrato(false);
        return;
      }
    } catch (e) {
      console.warn("[handleContratar] Erro ao gerar código:", e);
      setDniError("Error de red al solicitar el código. Inténtalo de nuevo.");
      setEnviandoContrato(false);
      return;
    }

    // Abrir modal de código — esconder modal DNI/IBAN
    setCodigoVerificacion("");
    setCodigoError("");
    setModalContratar(false);
    setModalCodigo(true);
    console.log("[handleContratar] modal código aberto — a aguardar confirmação");

    // Aguarda confirmação do código (Promise resolve em confirmarCodigoYContratar
    // ou rejeita em cancelar)
    const verificado = await new Promise((resolve) => {
      codigoResolveRef.current = resolve;
    });
    console.log("[handleContratar] resultado da verificação:", verificado);
    if (!verificado) {
      // Utilizador cancelou ou erro — limpar estado
      setModalCodigo(false);
      setEnviandoContrato(false);
      return;
    }

    // Verificação OK — fechar modal código e prosseguir
    setModalCodigo(false);

    const cleanUrl = (val) => (!val || val === "—") ? "" : val;

    // motivoDeEspera — habitualmente null en este flujo (el cliente sólo llega aquí si
    // puedeContratar=true en PlanScreen, es decir CE Available y hay plazas). Recalculamos
    // por defensa para que el backend reciba el motivo si alguna condición cambió en
    // medio (race con refresh de sesión, etc.). Usa o util partilhado com PlanScreen 09.
    const ceStatusEffH = ceStatus || sdCe.status || urlRef.ce?.status || "";
    const fsmEffH      = Fsmstate || sd?.Fsmstate || urlRef.fsmstate || "";
    const panelesDispEffH = cePanelesDisponibles ?? sdCe.paneles_disponibles ?? null;
    const motivoDeEspera = calcularMotivoDeEspera({
      ceStatus: ceStatusEffH,
      fsmstate: fsmEffH,
      panelesDisponibles: panelesDispEffH,
      panelesSel,
    });
    console.log("[handleContratar] motivoDeEspera calculado:", motivoDeEspera, {
      panelesDisp_state: cePanelesDisponibles,
      panelesDisp_sesion: sdCe.paneles_disponibles,
      panelesDispEffH, panelesSel, ceStatusEffH, fsmEffH,
    });

    const payload = {
      cliente: {
        nombre:         cliente.nombre    || sdCliente.nombre    || cleanUrl(urlCli.nombre)    || "",
        apellidos:      cliente.apellidos || sdCliente.apellidos || cleanUrl(urlCli.apellidos) || "",
        correo:         cliente.correo    || sdCliente.correo    || cleanUrl(urlCli.correo)    || "",
        telefono:       cliente.telefono  || sdCliente.telefono  || cleanUrl(urlCli.telefono)  || "",
        direccion:      cliente.direccion || sdCliente.direccion || cleanUrl(urlCli.direccion) || "",
        dealId:         dealIdFinal    ?? null,
        mpklogId:       mpklogIdFinal  ?? null,
        databaseId:     "00001",
        lat:            userCoords?.lat ?? null,
        lon:            userCoords?.lon ?? null,
        dni:            dniContrato.trim().toUpperCase(),
        iban:           ibanContrato.trim().toUpperCase(),
        tipoVenta:      modoAlquiler ? "Alquiler" : "Venta",
        planContratado: true,
        listaDeEspera:  false,
      },
      factura: {
        ...factura,
        precios_energia: {
          pe_p1: parseFloat(manualFields.pe_p1 || rawData.pe_p1 || facturaLS?.precios_energia?.pe_p1) || null,
          pe_p2: parseFloat(manualFields.pe_p2 || rawData.pe_p2 || facturaLS?.precios_energia?.pe_p2) || null,
          pe_p3: parseFloat(manualFields.pe_p3 || rawData.pe_p3 || facturaLS?.precios_energia?.pe_p3) || null,
          pe_p4: parseFloat(manualFields.pe_p4 || rawData.pe_p4 || facturaLS?.precios_energia?.pe_p4) || null,
          pe_p5: parseFloat(manualFields.pe_p5 || rawData.pe_p5 || facturaLS?.precios_energia?.pe_p5) || null,
          pe_p6: parseFloat(manualFields.pe_p6 || rawData.pe_p6 || facturaLS?.precios_energia?.pe_p6) || null,
        },
        importe_factura: parseFloat(
          manualFields.importe_factura || rawData.importe_factura || facturaLS?.importe_factura
        ) || null,
      },
      Fsmstate:    "08_PROPUESTA_ALQ",
      FsmPrevious: Fsmstate || sd?.Fsmstate || urlRef.fsmstate || null,
      motivoDeEspera,
      plan_url:    window.location.href,
      session_id:  extractSessionId ?? localStorage.getItem("cs_session_id") ?? null,
      ...(sd?.facturaPreview && { facturaPreview: sd.facturaPreview }),
      plan: {
        ahorro25Anos:            planData?.ahorro25Anos,
        pagoUnico:               planData?.pagoUnico,
        pagoFinanciado:          planData?.pagoFinanciado,
        ahorroMensual:           planData?.ahorroMensual,
        ahorroAnual:             planData?.ahorroAnual,
        produccionAnual:         planData?.produccionAnual,
        potenciaTotal:           planData?.potenciaTotal,
        coeficienteDistribucion: planData?.coeficienteDistribucion,
        plazoRecuperacion:       planData?.plazoRecuperacion,
        panelesSel:              planData?.panelesSel,
        cuotaAlquilerMes:        planData?.cuotaAlquilerMes,
        importeDeposito:         importeDeposito ?? null,
        ahorroAnualPercent:      planData?.ahorroAnualPercent,
      },
      ce: {
        nombre:        ceNombre    || sdCe.nombre    || urlRef.ce?.nombre    || "",
        direccion:     ceDireccion || sdCe.direccion || urlRef.ce?.direccion || "",
        status:        ceStatus    || sdCe.status    || urlRef.ce?.status    || "",
        etiqueta:      ceEtiqueta  || sdCe.etiqueta  || urlRef.ce?.etiqueta  || "",
        id_generacion: resolverIdGeneracion(
          idGeneracion || sdCe.id_generacion || urlRef.idGen,
          ceNombre     || sdCe.nombre        || urlRef.ce?.nombre
        ),
        paneles_disponibles: cePanelesDisponibles ?? sdCe.paneles_disponibles ?? null,
        paneles_a_la_venta:  cePanelesALaVenta  ?? sdCe.paneles_a_la_venta  ?? null,
        paneles_totales:     cePanelesTotales   ?? sdCe.paneles_totales     ?? null,
      },
      ...((sesionData?.factura_1 || factura1Data) && {
        factura_1: sesionData?.factura_1 ?? buildFactura1(),
      }),
      ...((sesionData?.factura_2 || factura2Data) && {
        factura_2: sesionData?.factura_2 ?? buildFactura2(),
      }),
    };

    try {
      const fd = new FormData();
      fd.append("data", JSON.stringify(payload));
      if (mode === "pdf" && file) fd.append("file", file, file.name);

      const res = await fetch(`${API_BASE}/enviar`, { method: "POST", body: fd });
      if (!res.ok) {
        const detail = await res.json()
          .then((d) => typeof d.detail === "string"
            ? d.detail : JSON.stringify(d.detail))
          .catch(() => `HTTP ${res.status}`);
        throw new Error(detail);
      }
      // IMPORTANTE: setLoading(true) ANTES de fechar o modal — assim quando o modal
      // fechar, o loading já está activo e sobrepõe o PlanScreen. Caso contrário
      // o PlanScreen apareceria brevemente entre o modal fechar e o loading iniciar.
      setLoadingMsg("Preparando tu contrato...");
      setLoading(true);
      setModalContratar(false);
      setDniContrato("");
      setAccionRealizada("contratado");
      // NÃO mudar status para "asesor_solicitado" aqui — só no fim do polling se
      // este falhar. Caso contrário a tela "¡Contrato generado!" aparece
      // momentaneamente antes do replace para o contrato.

      // Polling para abrir contrato na mesma aba quando backend receber contractUrl do Zoho Sign
      const MAX_INTENTOS = 240; // 8 minutos (240 × 2s)
      let contratoEncontrado = false;
      for (let i = 0; i < MAX_INTENTOS; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const contratoRes = await fetch(`${API_BASE}/contrato/${dealIdFinal}`);
          if (contratoRes.ok) {
            const contratoData = await contratoRes.json();
            if (contratoData.found === true) {
              // Guarda paymentUrl em localStorage para a página /contrato-firmado usar
              if (contratoData.paymentUrl) {
                localStorage.setItem("cs_paymentUrl", contratoData.paymentUrl);
              }
              // Abre apenas o contrato — a hoja abre automaticamente
              // pelo redirect do Sign após o contrato ser firmado.
              // Navega na MESMA aba (replace = sem entrada no histórico,
              // utilizador não pode "voltar atrás" ao extractor depois de iniciar
              // o contrato).
              contratoEncontrado = true;
              window.location.replace(contratoData.contractUrl);
              break;
            }
          }
        } catch { /* ignorar erros de rede no polling */ }
      }
      // Só mostrar a tela "¡Contrato generado!" se o polling falhou (não fizemos
      // replace) — significa que o backend demorou mais de 8 minutos e o
      // utilizador vai receber o link por email.
      // IMPORTANTE: se contratoEncontrado === true, NÃO chamar setLoading(false)
      // porque o window.location.replace é assíncrono — entre o JS terminar e o
      // browser navegar, qualquer re-render mostraria o PlanScreen brevemente.
      // Mantemos loading=true até a navegação completar (browser unmount a SPA).
      if (!contratoEncontrado) {
        setStatus("asesor_solicitado");
        setLoading(false);
      }
    } catch (err) {
      setDniError(err.message);
      setLoading(false);
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
    setIbanContrato(""); setIbanError("");
    setAceptaPrivacidad(false);
  };

  // Constante que controla a visibilidade dos dados extraídos da fatura (tabela completa)
  const MOSTRAR_DADOS_FACTURA = false;

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

        {/* Header — escondido durante loading do contrato */}
        {!(loading && loadingMsg === "Preparando tu contrato...") && (
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
        )}

        {/* Indicador modo asesor */}
        {modoAsesor && !(loading && loadingMsg === "Preparando tu contrato...") && (
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

        {/* ── LOADING CONTRATO — header próprio com logo grande + fones ── */}
        {loading && loadingMsg === "Preparando tu contrato..." && (
          <div style={{
            position:"fixed", inset:0,
            display:"flex", justifyContent:"center", alignItems:"flex-start",
            padding:"40px 24px", background:"#EEECE8", overflowY:"auto",
          }}>
          <div style={{ width:"100%", maxWidth:620 }}>
            {/* Header próprio */}
            <div style={{
              display:"flex", alignItems:"center", justifyContent:"space-between",
              padding:"0 0 20px 0", borderBottom:"1px solid #e8e8e4", marginBottom:32,
            }}>
              <img src="/logo.png" alt="Comunidad Solar" style={{ height:56, display:"block" }} />
              <a
                href="https://comunidadsolar.es/contacto/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display:"flex", alignItems:"center", justifyContent:"center",
                  width:48, height:48, borderRadius:"50%",
                  background:"#fff", border:"1px solid #e8e8e4",
                  textDecoration:"none", flexShrink:0,
                  transition:"border-color 0.2s, transform 0.2s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#000"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#e8e8e4"; }}
                aria-label="Contacto"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
                  <path d="M21 19a2 2 0 0 1-2 2h-1v-7h3v5z"/>
                  <path d="M3 19a2 2 0 0 0 2 2h1v-7H3v5z"/>
                </svg>
              </a>
            </div>

            {/* Card */}
            <div className="cs-card fade-in" style={{ padding:"32px 36px" }}>
              <h2 style={{ fontSize:26, fontWeight:800, color:"#111", marginBottom:8, letterSpacing:"-0.01em" }}>
                Estamos preparando tu contrato.
              </h2>
              <p style={{ fontSize:15, color:"#444", marginBottom:24 }}>
                Esto solo tomará unos segundos.
              </p>
              <div style={{
                width:"100%", height:8, borderRadius:999,
                background:"#E8E6E2", overflow:"hidden", position:"relative",
              }}>
                <div style={{
                  position:"absolute", top:0, left:0, height:"100%", width:"40%",
                  borderRadius:999, background:"#FFAD2A",
                  animation:"cs-progress-slide 1.6s ease-in-out infinite",
                }} />
              </div>
            </div>
          </div>
          </div>
        )}

        {/* ── LOADING genérico ── */}
        {loading && loadingMsg !== "Preparando tu contrato..." && (
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
            cePanelesDisponibles={cePanelesDisponibles}
            modoAlquiler={modoAlquiler}
            cuotaAlquilerMes={cuotaAlquilerMes}
            planData={planData}
            panelesSel={panelesSel}
            panelesPropuesta={panelesPropuesta}
            tabActiva={tabActiva}
            sesionData={sesionData}
            accionRealizada={accionRealizada}
            onContratar={() => setModalContratar(true)}
            onListaEspera={handleEntrarListaEspera}
            onVolver={handleReset}
            onOptimizar={handleOptimizar}
            onSetPanelesPropuesta={setPanelesPropuesta}
            onSetTabActiva={setTabActiva}
            onSesionError={() => setSesionError(true)}
            facturaPreviewData={facturaPreviewData}
            onSesionLoaded={(data) => {
              setSesionData(data);
              if (data?.facturaPreview) setFacturaPreviewData(data.facturaPreview);
              // Hidratar planData / panelesSel / cuotaAlquilerMes / modoAlquiler a partir do
              // `plan` da sessão DB. Cobre cenário "outro navegador / 10 dias depois" onde a
              // URL chega só com session_id e o state local ainda não tem o plan.
              if (data?.plan && (!planData || Object.values(planData).every(v => v == null))) {
                console.log("[onSesionLoaded] hidratando planData a partir de data.plan");
                setPlanData(data.plan);
                if (data.plan.panelesSel != null) {
                  setPanelesSel(Number(data.plan.panelesSel));
                  setPanelesPropuesta(Number(data.plan.panelesSel));
                }
                if (data.plan.cuotaAlquilerMes != null) setCuotaAlquilerMes(Number(data.plan.cuotaAlquilerMes));
              }
              // Hidratar modoAlquiler:
              //   1ª prioridade: data.modo
              //   2ª prioridade: data.cliente.tipoVenta (sempre presente após /enviar)
              if (data?.modo) {
                setModoAlquiler(data.modo === "alquiler");
              } else if (data?.cliente?.tipoVenta) {
                const isAlquiler = String(data.cliente.tipoVenta).toLowerCase() === "alquiler";
                console.log("[onSesionLoaded] modoAlquiler derivado de cliente.tipoVenta:", data.cliente.tipoVenta, "→", isAlquiler);
                setModoAlquiler(isAlquiler);
              }
              if (data?.ce) {
                if (data.ce.nombre)        setCeNombre(data.ce.nombre);
                if (data.ce.status)        setCeStatus(data.ce.status);
                if (data.ce.etiqueta)      setCeEtiqueta(data.ce.etiqueta);
                if (data.ce.direccion)     setCeDireccion(data.ce.direccion);
                if (data.ce.id_generacion) setIdGeneracion(String(data.ce.id_generacion));
                if (data.ce.paneles_disponibles != null) {
                  setCePanelesDisponibles(prev => prev != null ? prev : Number(data.ce.paneles_disponibles));
                }
                if (data.ce.paneles_a_la_venta != null) {
                  setCePanelesALaVenta(prev => prev != null ? prev : Number(data.ce.paneles_a_la_venta));
                }
                if (data.ce.paneles_totales != null) {
                  setCePanelesTotales(prev => prev != null ? prev : Number(data.ce.paneles_totales));
                }
              }
              // El polling/sesión es la fuente de verdad (callback del Zoho Flow). Si el state local
              // tiene IDs distintos (cs_dealId del localStorage de una sesión anterior, o fallback por
              // email del backend), sobrescribimos y avisamos en consola.
              if (data?.dealId) {
                setDealId(prev => {
                  if (prev && prev !== data.dealId) {
                    console.warn("[PlanScreen/sesion] dealId sobrescrito:", { antes: prev, depois: data.dealId });
                  }
                  return data.dealId;
                });
                urlParamsRef.current.dealId = data.dealId;
              }
              const mpklogFromVerif = data?.verification?.mpklog_id ?? null;
              const mpklogResolvedPS = data?.mpklogId ?? data?.cliente?.mpklogId ?? mpklogFromVerif ?? null;
              if (mpklogResolvedPS) {
                setMpklogId(prev => {
                  if (prev && prev !== mpklogResolvedPS) {
                    console.warn("[PlanScreen/sesion] mpklogId sobrescrito:", { antes: prev, depois: mpklogResolvedPS });
                  }
                  return mpklogResolvedPS;
                });
                urlParamsRef.current.mpklogId = mpklogResolvedPS;
              }
              if (data?.dealId)            { urlParamsRef.current.dealId   = data.dealId;            }
              if (data?.cliente?.dealId)   { urlParamsRef.current.dealId   = data.cliente.dealId;    }
              if (data?.cliente?.mpklogId) { urlParamsRef.current.mpklogId = data.cliente.mpklogId;  }
              if (data?.cliente) {
                setCliente(prev => ({
                  nombre:    prev.nombre    || data.cliente.nombre    || "",
                  apellidos: prev.apellidos || data.cliente.apellidos || "",
                  correo:    prev.correo    || data.cliente.correo    || "",
                  telefono:  prev.telefono  || data.cliente.telefono  || "",
                  direccion: prev.direccion || data.cliente.direccion || "",
                }));
                const { planContratado, listaDeEspera } = data.cliente;
                if (listaDeEspera)       setAccionRealizada("lista_espera");
                else if (planContratado) setAccionRealizada("contratado");
                if (planContratado || listaDeEspera) cotizacionEnviadaRef.current = true;
              }

              // Si la sesión ya tiene Fsmstate 09 o 08, no reenviar
              if (data?.Fsmstate && ["09_COTIZACION_ALQ", "08_PROPUESTA_ALQ"].includes(data.Fsmstate)) {
                cotizacionEnviadaRef.current = true;
              }

              // Notificar Zoho que el usuario llegó a la pantalla del plan (só uma vez)
              if (cotizacionEnviadaRef.current) return;
              cotizacionEnviadaRef.current = true;
              const sessionIdCotiz = extractSessionId ?? localStorage.getItem("cs_session_id") ?? null;

              // Calcular motivoDeEspera ANTES de construir o payload — mesma regra que handleContratar
              // (para o backend/Zoho poder preparar lista de espera mesmo antes do utilizador clicar)
              const _ceStatusCotiz   = data?.ce?.status    ?? ceStatus    ?? "";
              const _fsmCotiz        = data?.Fsmstate      ?? Fsmstate    ?? "";
              const _panelesDispCotiz = data?.ce?.paneles_disponibles ?? cePanelesDisponibles ?? null;
              const _motivoEsperaCotiz = calcularMotivoDeEspera({
                ceStatus: _ceStatusCotiz,
                fsmstate: _fsmCotiz,
                panelesDisponibles: _panelesDispCotiz,
                panelesSel: planData?.panelesSel ?? panelesSel ?? null,
              });
              const _listaDeEsperaCotiz = _motivoEsperaCotiz !== null;
              console.log("[09_COTIZACION_ALQ] motivoDeEspera:", _motivoEsperaCotiz, "listaDeEspera:", _listaDeEsperaCotiz, {
                ceStatus: _ceStatusCotiz, fsm: _fsmCotiz,
                panelesDisp: _panelesDispCotiz, panelesSel: planData?.panelesSel ?? panelesSel ?? null,
              });

              const sendCotiz = () => {
                const cotizPayload = {
                  plan_url: window.location.href,
                  cliente: {
                    ...(data?.cliente ?? {}),
                    dealId:         data?.dealId   ?? dealId   ?? null,
                    mpklogId:       data?.mpklogId ?? mpklogId ?? null,
                    databaseId:     "00001",
                    dni:            "",
                    iban:           "",
                    tipoVenta:      modoAlquiler ? "Alquiler" : "Venta",
                    planContratado: false,
                    listaDeEspera:  _listaDeEsperaCotiz,
                  },
                  motivoDeEspera: _motivoEsperaCotiz,
                  Fsmstate:    "09_COTIZACION_ALQ",
                  FsmPrevious: data?.Fsmstate ?? Fsmstate ?? null,
                  session_id:  sessionIdCotiz,
                  ...(data?.facturaPreview && { facturaPreview: data.facturaPreview }),
                  plan: {
                    ahorro25Anos:            planData?.ahorro25Anos,
                    pagoUnico:               planData?.pagoUnico,
                    pagoFinanciado:          planData?.pagoFinanciado,
                    ahorroMensual:           planData?.ahorroMensual,
                    ahorroAnual:             planData?.ahorroAnual,
                    ahorroAnualPercent:      planData?.ahorroAnualPercent,
                    produccionAnual:         planData?.produccionAnual,
                    potenciaTotal:           planData?.potenciaTotal,
                    coeficienteDistribucion: planData?.coeficienteDistribucion,
                    plazoRecuperacion:       planData?.plazoRecuperacion,
                    panelesSel:              planData?.panelesSel,
                    cuotaAlquilerMes:        planData?.cuotaAlquilerMes,
                    importeDeposito:         importeDeposito ?? null,
                  },
                  ce: {
                    nombre:        data?.ce?.nombre        ?? ceNombre    ?? "",
                    direccion:     data?.ce?.direccion     ?? ceDireccion ?? "",
                    status:        data?.ce?.status        ?? ceStatus    ?? "",
                    etiqueta:      data?.ce?.etiqueta      ?? ceEtiqueta  ?? "",
                    id_generacion: data?.ce?.id_generacion ?? idGeneracion ?? null,
                    paneles_disponibles: data?.ce?.paneles_disponibles ?? cePanelesDisponibles ?? null,
                    paneles_a_la_venta:  data?.ce?.paneles_a_la_venta  ?? cePanelesALaVenta  ?? null,
                    paneles_totales:     data?.ce?.paneles_totales     ?? cePanelesTotales   ?? null,
                  },
                };
                const fdCotiz = new FormData();
                fdCotiz.append("data", JSON.stringify(cotizPayload));
                fetch(`${API_BASE}/enviar`, { method: "POST", body: fdCotiz }).catch(() => {});
              };
              sendCotiz();
            }}
          />
        )}

        {/* ── FUERA DE ZONA — Propuesta Autoconsumo Remoto ── */}
        {!loading && status === "fuera_zona" && (
          <div className="cs-card fade-in">
            <button
              className="cs-btn-ghost"
              style={{ marginTop:0, marginBottom:20, width:"auto", padding:"8px 14px", fontSize:13 }}
              onClick={() => { setStatus("idle"); setStep(1); }}
            >
              ← Volver
            </button>

            {/* Logo Comunidad Solar */}
            <div style={{ marginBottom:24 }}>
              <img src="/logo.png" alt="Comunidad Solar" style={{ height:48, display:"block" }} />
            </div>

            {/* Alerta — fuera de zona */}
            <div style={{
              display:"flex",
              alignItems:"flex-start",
              gap:12,
              background:"#FEF2F2",
              border:"1.5px solid #8D0303",
              borderRadius:12,
              padding:"16px 18px",
              marginBottom:24,
            }}>
              <img src="/rechazado.png" alt="" style={{ width:28, height:28, flexShrink:0 }} />
              <p style={{ fontSize:14, color:"#8D0303", fontWeight:600, lineHeight:1.5, margin:0 }}>
                Lo sentimos, todavía no tenemos una Comunidad Energética activa a menos de 5 km de tu dirección.
              </p>
            </div>

            {/* Texto Autoconsumo Remoto */}
            <p style={{ fontSize:15, color:"#333", lineHeight:1.6, marginBottom:16 }}>
              Mientras llega una Comunidad Energética a tu zona, puedes empezar ya a ahorrar uniéndote a nuestro servicio de <strong>Autoconsumo Remoto</strong>.
            </p>
            <p style={{ fontSize:15, color:"#333", lineHeight:1.6, marginBottom:16 }}>
              Recibirás energía renovable generada en nuestros parques, sin obras ni instalaciones en tu vivienda.
            </p>
            <p style={{ fontSize:15, color:"#333", lineHeight:1.6, marginBottom:24 }}>
              ¿Quieres que te preparemos una propuesta personalizada con el ahorro que podrías conseguir?
            </p>

            <a
              href="https://presupuesto-ar.comunidadsolar.es/calcular-ahorro/aproximado?config=2d042eb19f83e7a3b2de85e8e26ac2f17&ce-name=torrontera+i+-+lazarillo"
              style={{
                display:"block",
                width:"100%",
                background:"#FFAD2A",
                color:"#000",
                border:"2px solid transparent",
                borderRadius:10,
                padding:"14px 0",
                fontSize:15,
                fontWeight:700,
                fontFamily:"inherit",
                textAlign:"center",
                textDecoration:"none",
                cursor:"pointer",
                transition:"background 0.2s, border-color 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background="#fff"; e.currentTarget.style.borderColor="#000"; }}
              onMouseLeave={e => { e.currentTarget.style.background="#FFAD2A"; e.currentTarget.style.borderColor="transparent"; }}
              onMouseDown={e => { e.currentTarget.style.borderColor="#000"; e.currentTarget.style.background="#FFAD2A"; }}
              onMouseUp={e => { e.currentTarget.style.borderColor="#000"; }}
            >
              Quiero mi propuesta de Autoconsumo Remoto
            </a>
          </div>
        )}

        {/* ── CARGANDO PLAN ── */}
        {!loading && status === "loading_plan" && (
          <div className="cs-card fade-in" style={{ textAlign:"center", padding:"48px 40px" }}>
            {planAbierto ? (
              <>
                <div style={{ fontSize:48, marginBottom:24 }}>☀️</div>
                <h2 style={{ fontSize:18, fontWeight:700, color:"#111", marginBottom:12 }}>
                  Tu plan se ha abierto en otra pestaña
                </h2>
                <p style={{ fontSize:13, color:"#777" }}>
                  Puedes cerrar esta ventana con seguridad.
                </p>
              </>
            ) : (
              <>
                <h2 style={{ fontSize:30, fontWeight:800, color:"#111", marginBottom:10, letterSpacing:"-0.01em", lineHeight:1.15 }}>
                  Estamos preparando tu plan personalizado…
                </h2>
                <p style={{ fontSize:15, color:"#555", marginBottom:28 }}>
                  Esto puede tardar unos segundos.
                </p>

                {/* Barra de progreso animada */}
                <div style={{
                  width:"100%", height:8, borderRadius:999,
                  background:"#E8E6E2", overflow:"hidden", position:"relative",
                  marginBottom:32,
                }}>
                  <div style={{
                    position:"absolute", top:0, left:0, height:"100%", width:"40%",
                    borderRadius:999, background:"#FFAD2A",
                    animation:"cs-progress-slide 1.6s ease-in-out infinite",
                  }} />
                </div>

                {/* Vídeo placeholder */}
                <div style={{
                  width:"100%", aspectRatio:"16 / 9",
                  borderRadius:16, overflow:"hidden",
                  background:`
                    repeating-conic-gradient(#F0EFEB 0% 25%, #F8F7F4 0% 50%)
                    50% / 32px 32px
                  `,
                }}>
                  {/* TODO: substituir pelo <video src="..." autoPlay loop muted playsInline style={{ width:"100%", height:"100%", objectFit:"cover" }} /> quando o ficheiro estiver disponível */}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── LISTA DE ESPERA ── */}
        {!loading && status === "lista_espera" && (
          <div className="cs-card fade-in">
            {/* Logo */}
            <div style={{ display:"flex", justifyContent:"center", marginBottom:28 }}>
              <img src="/logo.png" alt="Comunidad Solar" style={{ height:48, display:"block" }} />
            </div>

            <h2 style={{ fontSize:22, fontWeight:800, color:"#111", marginBottom:10, letterSpacing:"-0.01em" }}>
              Te hemos incluido en la lista de espera
            </h2>
            <p style={{ fontSize:15, color:"#333", lineHeight:1.55, marginBottom:28 }}>
              {motivoListaEspera === "Sin plazas"
                ? "Actualmente no hay disponibilidad de plazas en esta Comunidad Energética. En cuanto tengamos un hueco libre, te informaremos vía email."
                : "La contratación no está disponible actualmente. Te informaremos vía email en cuanto se abra el proceso de contratación."}
            </p>

            <button
              style={{
                background:"#FFAD2A", color:"#000",
                border:"2px solid transparent", borderRadius:999,
                padding:"14px 28px", fontSize:15, fontWeight:700,
                fontFamily:"inherit", cursor:"pointer",
                display:"inline-flex", alignItems:"center", gap:10,
                transition:"background 0.2s, border-color 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background="#fff"; e.currentTarget.style.borderColor="#000"; }}
              onMouseLeave={e => { e.currentTarget.style.background="#FFAD2A"; e.currentTarget.style.borderColor="transparent"; }}
              onClick={() => { setStatus("idle"); setStep(1); }}
            >
              <img src="/leftArrow.png" alt="" style={{ height:18, display:"block" }} />
              Ir a la página de inicio
            </button>
          </div>
        )}

        {/* ── ASESOR SOLICITADO ── */}
        {!loading && status === "asesor_solicitado" && (
          <div className="cs-card fade-in" style={{ textAlign:"center" }}>
            <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
            <h2 style={{ fontSize:20, fontWeight:700, color:"#111", marginBottom:8 }}>
              {accionRealizada === "contratado" ? "¡Contrato generado con éxito!" : "¡Solicitud recibida!"}
            </h2>
            <p style={{ fontSize:14, color:"#555", marginBottom:28, lineHeight:1.7 }}>
              {accionRealizada === "contratado"
                ? "Tu contrato ha sido generado con éxito y también fue enviado a tu email. Puedes cerrar esta pantalla."
                : "El contrato ha sido enviado a tu email. Tienes 30 minutos para firmarlo."}
            </p>
            <button className="cs-btn-ghost" onClick={handleReset}>← Volver al inicio</button>
          </div>
        )}

        {/* ── STEP 1 — Datos del cliente ── */}
        {!loading && status !== "sent" && status !== "fuera_zona" && status !== "asesor_solicitado" && status !== "lista_espera" && step === 1 && (
          <div style={{ position: 'relative', width: '100%', maxWidth: 620 }}>
            {(import.meta.env.DEV || window.location.hostname.split(".")[0] === "develop") && (
              <div style={{ position: 'absolute', left: -140, top: 0 }}>
                <select
                  onChange={e => handleDevCESelect(e.target.value)}
                  defaultValue=""
                  style={{ fontSize: 11, color: '#999', border: '1px dashed #ccc', borderRadius: 4, padding: '4px 8px', background: 'rgba(255,255,255,0.85)', cursor: 'pointer', maxWidth: 130 }}
                >
                  <option value="" disabled>🛠 CE</option>
                  {Object.keys(CE_ID_MAP).map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            )}
          <div className="cs-card fade-in">
            {/* Logo */}
            <div style={{ display:"flex", justifyContent:"flex-start", marginBottom:24 }}>
              <img src="/logo.png" alt="Comunidad Solar" style={{ height: 48, display: "block" }} />
            </div>

            <div className="cs-step-indicator">
              <div className="cs-step-dot active">1</div>
              <span className="cs-step-label active">Datos de contacto</span>
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
              Datos de contacto
            </h1>
            <p style={{ fontSize:14, color:"#777", marginBottom:28 }}>
              Rellena tus datos para que podamos presentarte tu plan personalizado.
            </p>

            <div className="cs-row">
              <div className="cs-field-group">
                <label className="cs-label" style={{ fontWeight:700 }}>Nombre</label>
                <input className={`cs-input${clienteErrors.nombre ? " error" : ""}`}
                  name="nombre" placeholder="ej. María"
                  value={cliente.nombre} onChange={handleCliente} />
                {clienteErrors.nombre && <span className="cs-field-error">{clienteErrors.nombre}</span>}
              </div>
              <div className="cs-field-group">
                <label className="cs-label" style={{ fontWeight:700 }}>Apellidos</label>
                <input className={`cs-input${clienteErrors.apellidos ? " error" : ""}`}
                  name="apellidos" placeholder="ej. López Hernández"
                  value={cliente.apellidos} onChange={handleCliente} />
                {clienteErrors.apellidos && <span className="cs-field-error">{clienteErrors.apellidos}</span>}
              </div>
            </div>

            <div className="cs-field-group" style={{ marginBottom:16 }}>
              <label className="cs-label" style={{ fontWeight:700 }}>Correo electrónico</label>
              <input className={`cs-input${clienteErrors.correo ? " error" : ""}`}
                name="correo" type="email" placeholder="ej. marialopezhernandez23@gmail.com"
                value={cliente.correo} onChange={handleCliente} />
              {clienteErrors.correo && <span className="cs-field-error">{clienteErrors.correo}</span>}
            </div>

            <div className="cs-field-group" style={{ marginBottom:16 }}>
              <label className="cs-label" style={{ fontWeight:700 }}>Teléfono</label>
              <input className={`cs-input${clienteErrors.telefono ? " error" : ""}`}
                name="telefono" type="tel" placeholder="ej. 602 039 789"
                value={cliente.telefono} onChange={handleCliente} />
              {clienteErrors.telefono && <span className="cs-field-error">{clienteErrors.telefono}</span>}
            </div>

            <div className="cs-field-group" style={{ marginBottom:16 }} ref={dropdownRef}>
              <label className="cs-label" style={{ fontWeight:700 }}>
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
                  placeholder="ej. Calle Juan Pacheco 4, 16640, Alameda de Cervera"
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

            {/* Checkbox Política de Privacidad */}
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
              <input
                type="checkbox"
                id="privacidad"
                checked={aceptaPrivacidad}
                onChange={e => setAceptaPrivacidad(e.target.checked)}
                style={{ width:16, height:16, cursor:"pointer", accentColor:"#111", flexShrink:0 }}
              />
              <label htmlFor="privacidad" style={{ fontSize:14, color:"#333", cursor:"pointer" }}>
                Acepto la{" "}
                <a
                  href="https://comunidadsolar.es/politica-privacidad/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color:"#333", textDecoration:"underline", fontWeight:500 }}
                >
                  Política de Privacidad
                </a>
              </label>
            </div>

            <button
              className="cs-btn-primary"
              onClick={handleContinuar}
              disabled={!aceptaPrivacidad}
              style={{ opacity: aceptaPrivacidad ? 1 : 0.45, cursor: aceptaPrivacidad ? "pointer" : "not-allowed" }}
            >
              Continuar →
            </button>
          </div>
          </div>
        )}

        {/* ── STEP 2 — Factura ── */}
        {!loading && status !== "sent" && status !== "asesor_solicitado" && status !== "lista_espera" && status !== "loading_plan" && step === 2 && (
          <>
            {/* Option selector */}
            {mode === null && (
              <div className="cs-card fade-in">

                {/* Botón Volver — topo */}
                {!modoAsesor && (
                  <button
                    className="cs-btn-ghost"
                    style={{ marginTop:0, marginBottom:20, width:"auto", padding:"8px 14px", fontSize:13 }}
                    onClick={() => setStep(1)}
                  >
                    ← Volver
                  </button>
                )}

                {/* Logo */}
                <div style={{ display:"flex", justifyContent:"flex-start", marginBottom:24 }}>
                  <img src="/logo.png" alt="Comunidad Solar" style={{ height: 48, display:"block" }} />
                </div>

                {/* Step indicator */}
                <div className="cs-step-indicator">
                  <div className="cs-step-dot done" style={{ background:"none", border:"none", padding:0 }}>
                    <img src="/Check datos personales.png" alt="" style={{ width:28, height:28, display:"block" }} />
                  </div>
                  <span className="cs-step-label active">Datos de contacto</span>
                  <div className="cs-step-line" />
                  <div className="cs-step-dot active">2</div>
                  <span className="cs-step-label active" style={{ fontWeight:700 }}>Factura</span>
                </div>

                {/* Banner zona — rediseñado */}
                {Fsmstate === "01_DENTRO_ZONA" && (
                  <div style={{
                    display:"flex", alignItems:"center", gap:10,
                    background:"#F4FDF0", border:"1.5px solid #345B22",
                    borderRadius:10, padding:"12px 16px",
                    fontSize:14, color:"#345B22", marginBottom:20,
                  }}>
                    <img src="/Vector.png" alt="" style={{ width:22, height:22, flexShrink:0 }} />
                    <span>Estás dentro de zona de la CE {ceNombre}{ceDistancia ? ` (${ceDistancia}m)` : ""}.</span>
                  </div>
                )}
                {Fsmstate === "02_FUERA_ZONA" && (
                  <div style={{
                    display:"flex", alignItems:"center", gap:10,
                    background:"#fffbeb", border:"1.5px solid #f59e0b",
                    borderRadius:10, padding:"12px 16px",
                    fontSize:14, color:"#92400e", marginBottom:20,
                  }}>
                    <span style={{ fontSize:18, lineHeight:1 }}>⚠️</span>
                    <span>Estás fuera de zona{ceNombre ? ` — CE más cercana: ${ceNombre}${ceDistancia ? ` (${ceDistancia}m)` : ""}` : ""}.</span>
                  </div>
                )}

                {leadWarn && (
                  <div style={{ fontSize:11, color:"#aaa", textAlign:"center", marginBottom:8 }}>
                    ⚠️ VITE_LEAD_URL no configurada — datos no enviados al backend
                  </div>
                )}

                {zonaWarn && (
                  <div className="cs-alert-warn" style={{ marginBottom:20 }}>
                    <span>⚠️</span><div>{zonaWarn}</div>
                  </div>
                )}

                <h1 style={{ fontSize:26, fontWeight:800, color:"#111", marginBottom:24 }}>
                  Analicemos tu consumo
                </h1>

                <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:28 }}>
                  <button className="cs-option-btn" onClick={() => setMode("pdf")}>
                    <span className="cs-option-icon" style={{ fontSize:"inherit" }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="8" y1="13" x2="16" y2="13"/>
                        <line x1="8" y1="17" x2="16" y2="17"/>
                        <line x1="8" y1="9" x2="10" y2="9"/>
                      </svg>
                    </span>
                    <div>
                      <div className="cs-option-title">Subir factura en PDF</div>
                      <div className="cs-option-desc">Extraemos automáticamente todos los datos.</div>
                    </div>
                  </button>
                  {CUPS_ENABLED && (
                    <button className="cs-option-btn" onClick={() => setMode("cups")}>
                      <span className="cs-option-icon">🔍</span>
                      <div>
                        <div className="cs-option-title">No tengo factura — Introducir CUPS</div>
                        <div className="cs-option-desc">Consulta los datos de tu suministro con el código CUPS.</div>
                      </div>
                    </button>
                  )}
                </div>

                {/* Bloque "Si no tienes la factura a mano..." */}
                <div style={{ marginBottom: ASESOR_ENABLED ? 0 : 4 }}>
                  <h2 style={{ fontSize:22, fontWeight:800, color:"#111", marginBottom:8 }}>
                    Si no tienes la factura a mano...
                  </h2>
                  <p style={{ fontSize:16, color:"#777", lineHeight:1.6 }}>
                    No te preocupes, en breve recibirás un mail con el enlace para que puedas volver a este punto del proceso.
                  </p>
                </div>

                {ASESOR_ENABLED && (
                  <>
                    <div className="cs-divider" style={{ marginTop:20 }}>
                      <div className="cs-divider-line" />
                      <span>o</span>
                      <div className="cs-divider-line" />
                    </div>
                    <button className="cs-btn-phone" onClick={handleEnviarAsesor} disabled={sending}>
                      📞 {sending ? "Enviando..." : "Hablar con un asesor"}
                    </button>
                    <p style={{ fontSize:12, color:"#aaa", textAlign:"center", marginTop:8 }}>
                      Te llamaremos para ayudarte personalmente
                    </p>
                  </>
                )}

                {error && (
                  <div className="cs-alert-err" style={{ marginTop:12 }}>
                    <span>⚠️</span><div>{error}</div>
                  </div>
                )}
              </div>
            )}

            {/* ── OPTION A — PDF upload ── */}
            {mode === "pdf" && status === "idle" && (
              <div className="cs-card fade-in">
                <button className="cs-btn-ghost" style={{ marginTop:0, marginBottom:20, width:"auto", padding:"8px 14px", fontSize:13 }}
                  onClick={() => { setMode(null); setFile(null); setError(""); }}>
                  ← Volver
                </button>

                {/* Logo */}
                <div style={{ display:"flex", justifyContent:"flex-start", marginBottom:24 }}>
                  <img src="/logo.png" alt="Comunidad Solar" style={{ height: 48, display:"block" }} />
                </div>

                {/* Step indicator */}
                <div className="cs-step-indicator">
                  <div className="cs-step-dot done" style={{ background:"none", border:"none", padding:0 }}>
                    <img src="/Check datos personales.png" alt="" style={{ width:28, height:28, display:"block" }} />
                  </div>
                  <span className="cs-step-label active">Datos de contacto</span>
                  <div className="cs-step-line" />
                  <div className="cs-step-dot active">2</div>
                  <span className="cs-step-label active" style={{ fontWeight:700 }}>Factura</span>
                </div>

                {error && (
                  <div style={{
                    display:"flex",
                    alignItems:"flex-start",
                    gap:12,
                    background:"#FEF2F2",
                    border:"1.5px solid #8D0303",
                    borderRadius:12,
                    padding:"16px 18px",
                    marginBottom:20,
                  }}>
                    <img src="/rechazado.png" alt="" style={{ width:28, height:28, flexShrink:0 }} />
                    <p style={{ fontSize:14, color:"#8D0303", fontWeight:600, lineHeight:1.5, margin:0 }}>
                      {error}
                    </p>
                  </div>
                )}

                <h2 style={{ fontSize:26, fontWeight:800, color:"#111", marginBottom:20 }}>
                  Sube tu factura
                </h2>

                <div
                  className={`cs-dropzone${isDragging ? " dragging" : ""}${file ? " has-file" : ""}`}
                  onClick={() => fileRef.current.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  style={{ padding:"60px 20px", marginBottom:20 }}
                >
                  <div style={{ marginBottom:16, display:"flex", justifyContent:"center" }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="8" y1="13" x2="16" y2="13"/>
                      <line x1="8" y1="17" x2="16" y2="17"/>
                      <line x1="8" y1="9" x2="10" y2="9"/>
                    </svg>
                  </div>
                  <p style={{ fontSize:15, fontWeight:700, color:"#111", marginBottom:4 }}>
                    {file ? "Factura cargada correctamente" : "Arrastra o haz click aquí para subir tu factura."}
                  </p>
                  {file
                    ? <p style={{ fontSize:13, fontWeight:600, color:"#2d7a2d", marginTop:8 }}>📎 {file.name}</p>
                    : <p style={{ fontSize:15, fontWeight:700, color:"#111" }}>Solo se admite archivos PDF.</p>
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
              <div className="cs-card fade-in">
                <button className="cs-btn-ghost" style={{ marginTop:0, marginBottom:20, width:"auto", padding:"8px 14px", fontSize:13 }}
                  onClick={() => { setStatus("idle"); setFacturaData(null); setFile(null); setFactura1Data(null); setFile1(null); setError1(""); setFactura2Data(null); setFile2(null); setError2(""); }}>
                  ← Volver
                </button>

                {/* Logo */}
                <div style={{ display:"flex", justifyContent:"flex-start", marginBottom:24 }}>
                  <img src="/logo.png" alt="Comunidad Solar" style={{ height: 48, display:"block" }} />
                </div>

                {/* Step indicator */}
                <div className="cs-step-indicator">
                  <div className="cs-step-dot done" style={{ background:"none", border:"none", padding:0 }}>
                    <img src="/Check datos personales.png" alt="" style={{ width:28, height:28, display:"block" }} />
                  </div>
                  <span className="cs-step-label active">Datos de contacto</span>
                  <div className="cs-step-line" />
                  <div className="cs-step-dot active">2</div>
                  <span className="cs-step-label active" style={{ fontWeight:700 }}>Factura</span>
                </div>

                <h2 style={{ fontSize:26, fontWeight:800, color:"#111", marginBottom:20 }}>
                  Factura analizada
                </h2>

                {error && (
                  <div className="cs-alert-err" style={{ marginBottom:16 }}>
                    <span>⚠️</span><div>{error}</div>
                  </div>
                )}

                {/* Tus datos */}
                <p style={{ fontSize:13, fontWeight:800, color:"#111", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:10 }}>
                  Tus datos
                </p>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:24 }}>
                  <div style={{ background:"#F5F4EF", borderRadius:10, padding:"12px 16px" }}>
                    <p style={{ fontSize:12, color:"#777", marginBottom:4 }}>Nombre</p>
                    <p style={{ fontSize:14, color:"#111", fontWeight:700 }}>{cliente.nombre}</p>
                  </div>
                  <div style={{ background:"#F5F4EF", borderRadius:10, padding:"12px 16px" }}>
                    <p style={{ fontSize:12, color:"#777", marginBottom:4 }}>Número de teléfono</p>
                    <p style={{ fontSize:14, color:"#111", fontWeight:700 }}>{cliente.telefono}</p>
                  </div>
                  <div style={{ background:"#F5F4EF", borderRadius:10, padding:"12px 16px", gridColumn:"1 / -1" }}>
                    <p style={{ fontSize:12, color:"#777", marginBottom:4 }}>Correo electrónico</p>
                    <p style={{ fontSize:14, color:"#111", fontWeight:700 }}>{cliente.correo}</p>
                  </div>
                  <div style={{ background:"#F5F4EF", borderRadius:10, padding:"12px 16px", gridColumn:"1 / -1" }}>
                    <p style={{ fontSize:12, color:"#777", marginBottom:4 }}>Dirección</p>
                    <p style={{ fontSize:14, color:"#111", fontWeight:700 }}>{cliente.direccion}</p>
                  </div>
                </div>

                {/* Dados completos da fatura — apenas quando MOSTRAR_DADOS_FACTURA === true */}
                {MOSTRAR_DADOS_FACTURA && (
                  <>
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
                  </>
                )}

                {/* Bloco faturas adicionais — só para tarifas multi-fatura */}
                {TARIFAS_MULTI_FACTURA.includes(facturaData?.tarifa_acceso) && (
                  <div style={{ marginBottom:24 }}>
                    {/* Header tarifa */}
                    <h3 style={{ fontSize:22, fontWeight:800, color:"#111", marginBottom:8, letterSpacing:"-0.01em" }}>
                      TARIFA {facturaData.tarifa_acceso}
                    </h3>
                    <p style={{ fontSize:15, color:"#444", lineHeight:1.55, marginBottom:24 }}>
                      Para un análisis completo necesitamos dos facturas adicionales de meses diferentes.
                    </p>

                    {/* ── Segunda factura ── */}
                    <div style={{ marginBottom:10 }}>
                      <p style={{ fontSize:13, fontWeight:800, color:"#111",
                        letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:4 }}>
                        Segunda factura
                      </p>
                      {mesesSugeridos1.length > 0 && (() => {
                        const cobMax1 = mesesSugeridos1[0]?.cobertura ?? 0;
                        const princ1  = mesesSugeridos1
                          .filter(({ cobertura }) => cobertura === cobMax1)
                          .map(({ mes }) => NOMBRES_MESES[mes]);
                        return (
                          <p style={{ fontSize:14, color:"#444", lineHeight:1.5 }}>
                            Preferiblemente de{" "}
                            <strong style={{ color:"#121212" }}>{`{${princ1.join(", ")}}`}</strong>.
                          </p>
                        );
                      })()}
                    </div>

                    {!factura1Data ? (
                      <div style={{ marginBottom:24 }}>
                        {errorMes1 && (
                          <div style={{
                            display:"flex", alignItems:"flex-start", gap:12,
                            background:"#FEF2F2", border:"1.5px solid #8D0303",
                            borderRadius:12, padding:"14px 16px", marginBottom:10,
                          }}>
                            <img src="/rechazado.png" alt="" style={{ width:24, height:24, flexShrink:0 }} />
                            <p style={{ fontSize:14, color:"#8D0303", fontWeight:600, lineHeight:1.5, margin:0 }}>
                              El mes no coincide. Sube una factura de los meses indicados.
                            </p>
                          </div>
                        )}
                        {error1 && (
                          <div style={{
                            display:"flex", alignItems:"flex-start", gap:12,
                            background:"#FEF2F2", border:"1.5px solid #8D0303",
                            borderRadius:12, padding:"14px 16px", marginBottom:10,
                          }}>
                            <img src="/rechazado.png" alt="" style={{ width:24, height:24, flexShrink:0 }} />
                            <p style={{ fontSize:14, color:"#8D0303", fontWeight:600, lineHeight:1.5, margin:0 }}>
                              {error1}
                            </p>
                          </div>
                        )}
                        <div
                          className="cs-dropzone"
                          onClick={() => fileRef1.current?.click()}
                          onDragOver={(e) => { e.preventDefault(); }}
                          onDragLeave={(e) => { e.preventDefault(); }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const f = e.dataTransfer.files?.[0];
                            if (f) handleFile1Change({ target: { files: [f] } });
                          }}
                          style={{ padding:"36px 20px" }}
                        >
                          <input
                            ref={fileRef1}
                            type="file"
                            accept=".pdf"
                            style={{ display:"none" }}
                            onChange={handleFile1Change}
                          />
                          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:16 }}>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                              <polyline points="14 2 14 8 20 8"/>
                              <line x1="8" y1="13" x2="16" y2="13"/>
                              <line x1="8" y1="17" x2="16" y2="17"/>
                              <line x1="8" y1="9" x2="10" y2="9"/>
                            </svg>
                            <div style={{ textAlign:"left" }}>
                              <p style={{ fontSize:15, fontWeight:700, color:"#111", marginBottom:2 }}>
                                {loading1 ? "Analizando..." : "Arrastra o haz click aquí para subir tu factura."}
                              </p>
                              <p style={{ fontSize:14, color:"#555" }}>Solo se admite archivos PDF.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginBottom:24 }}>
                        <div style={{
                          display:"flex", alignItems:"center", gap:14,
                          padding:"16px 18px", background:"#E8F5E0",
                          borderRadius:12, border:"1px solid #BBF0A0",
                        }}>
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="8" y1="13" x2="16" y2="13"/>
                            <line x1="8" y1="17" x2="16" y2="17"/>
                            <line x1="8" y1="9" x2="10" y2="9"/>
                          </svg>
                          <div style={{ flex:1 }}>
                            <p style={{ fontSize:15, color:"#121212", fontWeight:700, marginBottom:2 }}>
                              Factura subida correctamente.
                            </p>
                            <p style={{ fontSize:13, color:"#555", lineHeight:1.4 }}>
                              Todos los datos han sido extraídos automáticamente.
                            </p>
                          </div>
                          <div style={{
                            flexShrink:0, width:28, height:28, borderRadius:"50%",
                            background:"#2D8C3C", display:"flex", alignItems:"center", justifyContent:"center",
                          }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          </div>
                        </div>
                        <button
                          style={{
                            marginTop:8,
                            background:"none", border:"none",
                            padding:"4px 0", fontSize:12, color:"#555",
                            cursor:"pointer", fontFamily:"inherit", fontWeight:600,
                            textDecoration:"underline",
                          }}
                          onClick={() => { setFactura1Data(null); setFile1(null); setError1(""); }}
                        >
                          Subir otra factura
                        </button>
                      </div>
                    )}

                    {/* ── Tercera factura ── */}
                    <div style={{ marginBottom:10 }}>
                      <p style={{ fontSize:13, fontWeight:800, color:"#111",
                        letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:4 }}>
                        Tercera factura
                      </p>
                      {mesesSugeridos2.length > 0 && (() => {
                        const cobMax2 = mesesSugeridos2[0]?.cobertura ?? 0;
                        const princ2  = mesesSugeridos2
                          .filter(({ cobertura }) => cobertura === cobMax2)
                          .map(({ mes }) => NOMBRES_MESES[mes]);
                        return (
                          <p style={{ fontSize:14, color:"#444", lineHeight:1.5 }}>
                            Preferiblemente de{" "}
                            <strong style={{ color:"#121212" }}>{`{${princ2.join(", ")}}`}</strong>.
                          </p>
                        );
                      })()}
                    </div>

                    {!factura2Data ? (
                      <div>
                        {errorMes2 && (
                          <div style={{
                            display:"flex", alignItems:"flex-start", gap:12,
                            background:"#FEF2F2", border:"1.5px solid #8D0303",
                            borderRadius:12, padding:"14px 16px", marginBottom:10,
                          }}>
                            <img src="/rechazado.png" alt="" style={{ width:24, height:24, flexShrink:0 }} />
                            <p style={{ fontSize:14, color:"#8D0303", fontWeight:600, lineHeight:1.5, margin:0 }}>
                              El mes no coincide. Sube una factura de los meses indicados.
                            </p>
                          </div>
                        )}
                        {error2 && (
                          <div style={{
                            display:"flex", alignItems:"flex-start", gap:12,
                            background:"#FEF2F2", border:"1.5px solid #8D0303",
                            borderRadius:12, padding:"14px 16px", marginBottom:10,
                          }}>
                            <img src="/rechazado.png" alt="" style={{ width:24, height:24, flexShrink:0 }} />
                            <p style={{ fontSize:14, color:"#8D0303", fontWeight:600, lineHeight:1.5, margin:0 }}>
                              {error2}
                            </p>
                          </div>
                        )}
                        <div
                          className="cs-dropzone"
                          onClick={() => fileRef2.current?.click()}
                          onDragOver={(e) => { e.preventDefault(); }}
                          onDragLeave={(e) => { e.preventDefault(); }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const f = e.dataTransfer.files?.[0];
                            if (f) handleFile2Change({ target: { files: [f] } });
                          }}
                          style={{ padding:"36px 20px" }}
                        >
                          <input
                            ref={fileRef2}
                            type="file"
                            accept=".pdf"
                            style={{ display:"none" }}
                            onChange={handleFile2Change}
                          />
                          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:16 }}>
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                              <polyline points="14 2 14 8 20 8"/>
                              <line x1="8" y1="13" x2="16" y2="13"/>
                              <line x1="8" y1="17" x2="16" y2="17"/>
                              <line x1="8" y1="9" x2="10" y2="9"/>
                            </svg>
                            <div style={{ textAlign:"left" }}>
                              <p style={{ fontSize:15, fontWeight:700, color:"#111", marginBottom:2 }}>
                                {loading2 ? "Analizando..." : "Arrastra o haz click aquí para subir tu factura."}
                              </p>
                              <p style={{ fontSize:14, color:"#555" }}>Solo se admite archivos PDF.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{
                          display:"flex", alignItems:"center", gap:14,
                          padding:"16px 18px", background:"#E8F5E0",
                          borderRadius:12, border:"1px solid #BBF0A0",
                        }}>
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="8" y1="13" x2="16" y2="13"/>
                            <line x1="8" y1="17" x2="16" y2="17"/>
                            <line x1="8" y1="9" x2="10" y2="9"/>
                          </svg>
                          <div style={{ flex:1 }}>
                            <p style={{ fontSize:15, color:"#121212", fontWeight:700, marginBottom:2 }}>
                              Factura subida correctamente.
                            </p>
                            <p style={{ fontSize:13, color:"#555", lineHeight:1.4 }}>
                              Todos los datos han sido extraídos automáticamente.
                            </p>
                          </div>
                          <div style={{
                            flexShrink:0, width:28, height:28, borderRadius:"50%",
                            background:"#2D8C3C", display:"flex", alignItems:"center", justifyContent:"center",
                          }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          </div>
                        </div>
                        <button
                          style={{
                            marginTop:8,
                            background:"none", border:"none",
                            padding:"4px 0", fontSize:12, color:"#555",
                            cursor:"pointer", fontFamily:"inherit", fontWeight:600,
                            textDecoration:"underline",
                          }}
                          onClick={() => { setFactura2Data(null); setFile2(null); setError2(""); }}
                        >
                          Subir otra factura
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {TARIFAS_MULTI_FACTURA.includes(facturaData?.tarifa_acceso) && (
                  <button
                    className="cs-btn-primary"
                    style={{ marginTop:8 }}
                    disabled={sending}
                    onClick={() => {
                      if (factura1Data && factura2Data) {
                        handleEnviar();
                      } else {
                        setModalConfirmarEnvio(true);
                      }
                    }}
                  >
                    {sending
                      ? "Enviando..."
                      : (factura1Data && factura2Data ? "Ver mi plan personalizado →" : "Enviar datos →")}
                  </button>
                )}

                {advertenciaAno && (
                  <div style={{
                    display:"flex", alignItems:"flex-start", gap:10,
                    background:"#FFF7ED", border:"1px solid #FDBA74",
                    borderRadius:10, padding:"14px 16px", marginBottom:12,
                  }}>
                    <span style={{ fontSize:18, lineHeight:1 }}>⚠️</span>
                    <p style={{ fontSize:13, color:"#9A3412", lineHeight:1.5, margin:0 }}>
                      Tu factura es del año 2024 y los datos pueden no estar actualizados.
                      Por favor, envía una factura más reciente.
                    </p>
                  </div>
                )}

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
                        placeholder={k === "bono_social" ? "0 si no aplica" : "Introduce el valor"}
                        value={manualFields[k]} onChange={handleManual} />
                    </div>
                  ))}
                </div>

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

      {/* ── MODAL CONFIRMAR ENVIO SEM TODAS AS FATURAS ── */}
      {modalConfirmarEnvio && (
        <div style={{
          position:"fixed", inset:0, background:"rgba(0,0,0,0.55)",
          zIndex:1000, display:"flex", alignItems:"center",
          justifyContent:"center", padding:16,
        }}>
          <div style={{
            background:"#fff", borderRadius:20, padding:"36px 32px",
            maxWidth:520, width:"100%",
            boxShadow:"0 8px 40px rgba(0,0,0,0.18)",
          }}>
            <h3 style={{ fontSize:24, fontWeight:800, color:"#111", marginBottom:14, letterSpacing:"-0.01em" }}>
              ¿Continuar sin todas las facturas?
            </h3>
            <p style={{ fontSize:15, color:"#333", marginBottom:28, lineHeight:1.55 }}>
              Cuantas más facturas adjuntes con más precisión reflejará tu consumo real. Recomendamos adjuntar el máximo de facturas posible para obtener un resultado más preciso.
            </p>
            <div style={{ display:"flex", gap:12 }}>
              <button
                style={{
                  flex:1, marginTop:0,
                  background:"#FFAD2A", color:"#000",
                  border:"2px solid transparent", borderRadius:10,
                  padding:"14px 0", fontSize:15, fontWeight:700,
                  fontFamily:"inherit", cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                  transition:"background 0.2s, border-color 0.2s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background="#fff"; e.currentTarget.style.borderColor="#000"; }}
                onMouseLeave={e => { e.currentTarget.style.background="#FFAD2A"; e.currentTarget.style.borderColor="transparent"; }}
                onClick={() => setModalConfirmarEnvio(false)}
              >
                <img src="/leftArrow.png" alt="" style={{ height:22, display:"block" }} />
                Volver
              </button>
              <button
                style={{
                  flex:1, marginTop:0,
                  background:"#fff", color:"#111",
                  border:"1.5px solid #e0e0da", borderRadius:10,
                  padding:"14px 12px", fontSize:14, fontWeight:600,
                  fontFamily:"inherit", cursor: sending ? "not-allowed" : "pointer",
                  opacity: sending ? 0.5 : 1,
                  whiteSpace:"nowrap",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                  transition:"background 0.2s, border-color 0.2s",
                }}
                onMouseEnter={e => { if (!sending) { e.currentTarget.style.borderColor="#000"; } }}
                onMouseLeave={e => { if (!sending) { e.currentTarget.style.borderColor="#e0e0da"; } }}
                onClick={() => { setModalConfirmarEnvio(false); handleEnviar(); }}
                disabled={sending}
              >
                {sending ? (
                  "Enviando..."
                ) : (
                  <>
                    Ver mi plan personalizado
                    <img src="/rightArrow.png" alt="" style={{ height:22, display:"block" }} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
              Introduce tu DNI o NIE para completar la contratación.
            </p>

            <div className="cs-field-group" style={{ marginBottom:16 }}>
              <label className="cs-label">DNI / NIE</label>
              <input
                className={`cs-input${dniError ? " error" : ""}`}
                placeholder="12345678A o X1234567A"
                value={dniContrato}
                onChange={(e) => { setDniContrato(e.target.value); setDniError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleContratar()}
                autoFocus
              />
              {dniError && <span className="cs-field-error">{dniError}</span>}
            </div>

            <div className="cs-field-group" style={{ marginBottom:16 }}>
              <label className="cs-label">IBAN</label>
              <input
                className={`cs-input${ibanError ? " error" : ""}`}
                placeholder="ES00 0000 0000 0000 0000 0000"
                value={ibanContrato}
                onChange={(e) => { setIbanContrato(e.target.value); setIbanError(""); }}
              />
              {ibanError && <span className="cs-field-error">{ibanError}</span>}
            </div>

            <div style={{ display:"flex", gap:12 }}>
              <button
                className="cs-btn-ghost"
                style={{ flex:1, marginTop:0 }}
                onClick={() => { setModalContratar(false); setDniContrato(""); setDniError(""); setIbanContrato(""); setIbanError(""); }}
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
                {enviandoContrato ? "Enviando..." : (ceStatus !== "Available" ? "Entrar en lista de espera →" : "Contratar ahora →")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CÓDIGO DE VERIFICACIÓN ── */}
      {modalCodigo && (
        <div style={{
          position:"fixed", inset:0, background:"rgba(0,0,0,0.55)",
          zIndex:1100, display:"flex", alignItems:"center",
          justifyContent:"center", padding:16,
        }}>
          <div style={{
            background:"#fff", borderRadius:16, padding:"32px 28px",
            maxWidth:400, width:"100%",
            boxShadow:"0 8px 40px rgba(0,0,0,0.18)",
          }}>
            <h3 style={{ fontSize:18, fontWeight:700, color:"#111", marginBottom:8 }}>
              Verifica tu correo electrónico
            </h3>
            <p style={{ fontSize:13, color:"#777", marginBottom:24, lineHeight:1.5 }}>
              Hemos enviado un código de 6 dígitos a tu email. Introdúcelo abajo para confirmar la contratación.
            </p>

            <div className="cs-field-group" style={{ marginBottom:16 }}>
              <label className="cs-label">Código de verificación</label>
              <input
                className={`cs-input${codigoError && !codigoError.startsWith("Hemos reenviado") ? " error" : ""}`}
                placeholder="000000"
                maxLength={6}
                inputMode="numeric"
                pattern="[0-9]*"
                value={codigoVerificacion}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setCodigoVerificacion(digits);
                  setCodigoError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && confirmarCodigoYContratar()}
                autoFocus
                style={{ fontSize:18, letterSpacing:4, textAlign:"center" }}
              />
              {codigoError && (
                <span
                  className="cs-field-error"
                  style={{
                    color: codigoError.startsWith("Hemos reenviado") ? "#1FA84E" : undefined,
                  }}
                >
                  {codigoError}
                </span>
              )}
            </div>

            <div style={{ marginBottom:20, textAlign:"center" }}>
              <button
                type="button"
                onClick={handleReenviarCodigo}
                disabled={enviandoCodigo || verificandoCodigo}
                style={{
                  background:"none", border:"none",
                  color:"#5A8DEE", fontSize:13, cursor:"pointer",
                  textDecoration:"underline",
                  padding:0,
                }}
              >
                {enviandoCodigo ? "Reenviando..." : "Reenviar código"}
              </button>
            </div>

            <div style={{ display:"flex", gap:12 }}>
              <button
                className="cs-btn-ghost"
                style={{ flex:1, marginTop:0 }}
                onClick={cancelarCodigo}
                disabled={verificandoCodigo}
              >
                ← Cancelar
              </button>
              <button
                className="cs-btn-primary"
                style={{ flex:1, marginTop:0 }}
                onClick={confirmarCodigoYContratar}
                disabled={verificandoCodigo || codigoVerificacion.length !== 6}
              >
                {verificandoCodigo ? "Verificando..." : "Confirmar →"}
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
                    <img src="/logo_1.png" alt="Comunidad Solar" style={{ height:32 }} />
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
