import { useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PlanScreen from "../components/PlanScreen";
import OptimizerModal from "../components/OptimizerModal";
import { API_BASE } from "../constants/appConstants";
import { resolverIdGeneracion, validarDNI, validarIBAN } from "../utils/facturaUtils";
import "../components/FacturaUpload.css";

function readInitialState(params) {
  const s = (key, fallback = "") => params.get(key) ?? fallback;
  const n = (key) => parseFloat(params.get(key)) || null;

  const csCliente  = localStorage.getItem("cs_cliente");
  const csFactura  = localStorage.getItem("cs_factura");
  const csCe       = localStorage.getItem("cs_ce");
  const csDealId   = localStorage.getItem("cs_dealId");
  const csMpklogId = localStorage.getItem("cs_mpklogId");
  const csFsmstate = localStorage.getItem("cs_fsmstate");
  const csMode     = localStorage.getItem("cs_mode");

  const cliente   = csCliente ? JSON.parse(csCliente) : null;
  const facturaLS = csFactura ? JSON.parse(csFactura) : null;
  const ce        = csCe      ? JSON.parse(csCe)      : null;

  ["cs_cliente","cs_factura","cs_ce","cs_dealId","cs_mpklogId","cs_fsmstate","cs_mode"]
    .forEach(k => localStorage.removeItem(k));

  return {
    cliente: cliente ?? {
      nombre:    s("cliente.nombre")    || s("nombre"),
      apellidos: s("cliente.apellidos") || s("apellidos"),
      correo:    s("cliente.correo")    || s("correo"),
      telefono:  s("cliente.telefono")  || s("telefono"),
      direccion: s("cliente.direccion") || s("direccion"),
    },
    facturaLS,
    mode:         csMode || s("mode"),
    ceNombre:     ce?.nombre    || s("ceNombre"),
    ceStatus:     ce?.status    || s("ceStatus"),
    ceEtiqueta:   ce?.etiqueta  || s("ceEtiqueta"),
    ceDireccion:  ce?.direccion || s("ceDireccion"),
    idGeneracion: ce?.id_generacion ? String(ce.id_generacion) : s("id_generacion"),
    dealId:       cliente?.dealId   || csDealId   || s("dealId")   || null,
    mpklogId:     cliente?.mpklogId || csMpklogId || s("mpklogId") || null,
    Fsmstate:     csFsmstate || s("Fsmstate") || s("fsmstate") || "",
    fsmPrevious:  s("FsmPrevious") || s("fsmPrevious") || null,
    modoAlquiler: s("modo") === "alquiler",
    cuotaAlquilerMes: n("cuotaAlquilerMes") ?? (facturaLS?.cuotaAlquilerMes ?? null),
    panelesSel:   parseInt(params.get("panelesSel")) || 3,
    planData: {
      ahorro25Anos:            n("ahorro25Anos"),
      pagoUnico:               n("pagoUnico"),
      pagoFinanciado:          n("pagoFinanciado"),
      ahorroMensual:           n("ahorroMensual"),
      ahorroAnual:             n("ahorroAnual"),
      produccionAnual:         n("produccionAnual"),
      potenciaTotal:           n("potenciaTotal"),
      coeficienteDistribucion: n("coeficienteDistribucion"),
      plazoRecuperacion:       params.get("plazoRecuperacion") || null,
      panelesSel:              parseInt(params.get("panelesSel")) || null,
      cuotaAlquilerMes:        n("cuotaAlquilerMes"),
      ahorroAnualPercent:      n("ahorroAnualPercent"),
    },
  };
}

export default function PlanPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const init = readInitialState(searchParams);

  const [cliente]          = useState(init.cliente);
  const [ceNombre]         = useState(init.ceNombre);
  const [ceStatus]         = useState(init.ceStatus);
  const [modoAlquiler]     = useState(init.modoAlquiler);
  const [cuotaAlquilerMes] = useState(init.cuotaAlquilerMes);
  const [planData]         = useState(init.planData);
  const [panelesSel]       = useState(init.panelesSel);

  const [panelesPropuesta, setPanelesPropuesta] = useState(init.panelesSel ?? 3);
  const [tabActiva, setTabActiva]               = useState("como");
  const [modalOptimizar, setModalOptimizar]     = useState(null);
  const [pageStatus, setPageStatus]             = useState("plan"); // "plan" | "asesor_solicitado"

  // Contratar modal
  const [modalContratar, setModalContratar]       = useState(false);
  const [dniContrato, setDniContrato]             = useState("");
  const [dniError, setDniError]                   = useState("");
  const [ibanContrato, setIbanContrato]           = useState("");
  const [ibanError, setIbanError]                 = useState("");
  const [enviandoContrato, setEnviandoContrato]   = useState(false);
  const [contratoError, setContratoError]         = useState("");

  const planRef = useRef({
    facturaLS:       init.facturaLS,
    dealId:          init.dealId,
    mpklogId:        init.mpklogId,
    Fsmstate:        init.Fsmstate,
    fsmPrevious:     init.fsmPrevious,
    idGeneracion:    init.idGeneracion,
    ceNombre:        init.ceNombre,
    ceDireccion:     init.ceDireccion,
    ceStatus:        init.ceStatus,
    ceEtiqueta:      init.ceEtiqueta,
    modoAlquiler:    init.modoAlquiler,
    cuotaAlquilerMes: init.cuotaAlquilerMes,
  });

  const handleContratar = async () => {
    const errDni = validarDNI(dniContrato);
    if (errDni) { setDniError(errDni); return; }
    const errIban = validarIBAN(ibanContrato);
    if (errIban) { setIbanError(errIban); return; }

    setEnviandoContrato(true);
    setContratoError("");

    const ref = planRef.current;
    let dealIdFinal   = ref.dealId;
    let mpklogIdFinal = ref.mpklogId;

    try {
      if (!dealIdFinal) {
        const fdPre = new FormData();
        fdPre.append("data", JSON.stringify({
          cliente: { ...cliente },
          factura: ref.facturaLS ?? {},
          Fsmstate: ref.Fsmstate,
          FsmPrevious: ref.fsmPrevious,
          ce: {
            nombre: ref.ceNombre,
            direccion: ref.ceDireccion,
            status: ref.ceStatus,
            etiqueta: ref.ceEtiqueta,
            id_generacion: resolverIdGeneracion(ref.idGeneracion, ref.ceNombre),
          },
        }));
        const resPre  = await fetch(`${API_BASE}/enviar`, { method: "POST", body: fdPre });
        const dataPre = await resPre.json().catch(() => ({}));
        dealIdFinal   = dataPre?.dealId   ?? null;
        mpklogIdFinal = dataPre?.mpklogId ?? null;
      }

      const fd = new FormData();
      fd.append("data", JSON.stringify({
        cliente: { ...cliente },
        factura: {
          ...(ref.facturaLS ?? {}),
          cuotaAlquilerMes: ref.cuotaAlquilerMes ?? null,
          tipoVenta: ref.modoAlquiler ? "Alquiler" : "Venta",
          dniTitular: dniContrato,
          ibanTitular: ibanContrato,
        },
        Fsmstate: "08_PROPUESTA_ALQ",
        FsmPrevious: ref.Fsmstate,
        ce: {
          nombre: ref.ceNombre,
          direccion: ref.ceDireccion,
          status: ref.ceStatus,
          etiqueta: ref.ceEtiqueta,
          id_generacion: resolverIdGeneracion(ref.idGeneracion, ref.ceNombre),
        },
        dealId:   dealIdFinal,
        mpklogId: mpklogIdFinal,
        planContratado: true,
      }));

      const res = await fetch(`${API_BASE}/enviar`, { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail ?? `HTTP ${res.status}`);
      }

      setModalContratar(false);
      setPageStatus("asesor_solicitado");
    } catch (err) {
      setContratoError(err.message);
    } finally {
      setEnviandoContrato(false);
    }
  };

  const closeContratarModal = () => {
    setModalContratar(false);
    setDniContrato(""); setDniError("");
    setIbanContrato(""); setIbanError("");
    setContratoError("");
  };

  if (pageStatus === "asesor_solicitado") {
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
        <div style={{ textAlign:"center", maxWidth:480 }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🖊️</div>
          <h2 style={{ fontSize:22, fontWeight:800, color:"#121212", marginBottom:12 }}>
            ¡Tu solicitud está en marcha!
          </h2>
          <p style={{ fontSize:14, color:"#555" }}>
            Un asesor de Comunidad Solar se pondrá en contacto contigo para completar el proceso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
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
        sesionData={null}
        onContratar={() => setModalContratar(true)}
        onVolver={() => navigate("/")}
        onOptimizar={(payload) => setModalOptimizar(payload)}
        onSetPanelesPropuesta={setPanelesPropuesta}
        onSetTabActiva={setTabActiva}
        onSesionError={() => {}}
        onSesionLoaded={() => {}}
      />

      <OptimizerModal
        modalOptimizar={modalOptimizar}
        panelesPropuesta={panelesPropuesta}
        modoAlquiler={modoAlquiler}
        onClose={() => setModalOptimizar(null)}
        onConfirm={(p) => { setPanelesPropuesta(p); setModalOptimizar(null); }}
      />

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
            {contratoError && (
              <p style={{ fontSize:12, color:"#e53e3e", marginBottom:12 }}>{contratoError}</p>
            )}
            <div style={{ display:"flex", gap:12 }}>
              <button
                className="cs-btn-ghost"
                style={{ flex:1, marginTop:0 }}
                onClick={closeContratarModal}
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
    </>
  );
}
