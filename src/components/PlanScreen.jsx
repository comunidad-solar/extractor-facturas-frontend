import { useState, useEffect } from "react";
import { fmtES } from "../utils/facturaUtils";
import { API_BASE, CE_STATUS_LABELS, CE_FOTO_ENABLED } from "../constants/appConstants";
import FacturaPreview from "./FacturaPreview";

export default function PlanScreen({
  cliente,
  ceNombre,
  ceStatus,
  cePanelesDisponibles,
  modoAlquiler,
  cuotaAlquilerMes,
  planData,
  panelesSel,
  panelesPropuesta,
  tabActiva,
  sesionData: sesionDataProp,
  accionRealizada,
  onContratar,
  onListaEspera,
  onVolver,
  onOptimizar,
  onSetPanelesPropuesta,
  onSetTabActiva,
  onSesionError,
  onSesionLoaded,
  facturaPreviewData = null,
}) {
  // eslint-disable-next-line no-unused-vars
  const [sesionData, setSesionData] = useState(sesionDataProp ?? null);
  const [sesionFailed, setSesionFailed] = useState(false);
  const [ceFotoUrl, setCeFotoUrl] = useState(null);

  const yaContratado = accionRealizada === "contratado";
  const yaEnEspera   = accionRealizada === "lista_espera";

  // Sin plazas — cuando Paneles_disponibles del CRM es menor que panelesSel del cliente.
  // Si paneles_disponibles es null/undefined no bloqueamos (no podemos afirmar que no haya plazas).
  const sinPlazas = cePanelesDisponibles != null && panelesSel != null && cePanelesDisponibles < panelesSel;
  // El botón "Contratar" sólo abre el modal cuando la CE está Available Y hay plazas.
  // En caso contrario va a la lista de espera (sin mensaje extra — comportamiento silencioso).
  const puedeContratar = ceStatus === "Available" && !sinPlazas;

  console.log("[PlanScreen] cálculo paneles:", {
    cePanelesDisponibles,
    panelesSel,
    ceStatus,
    sinPlazas,
    puedeContratar,
    rama: puedeContratar ? "→ Contratar (modal)" : "→ Lista de espera",
  });



  useEffect(() => {
    if (!CE_FOTO_ENABLED || !ceNombre) return;
    fetch(`${API_BASE}/ce/foto?name=${encodeURIComponent(ceNombre)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.foto_url) setCeFotoUrl(data.foto_url); })
      .catch(() => {});
  }, [ceNombre]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get("session_id")
      ?? localStorage.getItem("cs_session_id");
    console.log("[PlanScreen] session_id:", sessionId, "(url:", new URLSearchParams(window.location.search).get("session_id"), "/ ls:", localStorage.getItem("cs_session_id"), ")");
    if (!sessionId) return;
    fetch(`${API_BASE}/sesion/${sessionId}`)
      .then(res => {
        if (res.status === 404 || res.status === 410) throw new Error("expirada");
        if (!res.ok) throw new Error("error");
        return res.json();
      })
      .then(data => {
        setSesionData(data);
        if (onSesionLoaded) onSesionLoaded(data);
      })
      .catch(() => {
        setSesionFailed(false);
        if (onSesionError) onSesionError();
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (sesionFailed) {
    return (
      <div className="cs-results-card fade-in" style={{ textAlign:"center", padding:"80px 40px" }}>
        <p style={{ fontSize:18, fontWeight:600, color:"#121212", marginBottom:12 }}>
          Lo sentimos, ha ocurrido un error.
        </p>
        <p style={{ fontSize:14, color:"#777" }}>
          Por favor, vuelve a realizar el proceso.
        </p>
      </div>
    );
  }

  return (
    <>
    <div className="cs-results-card fade-in" style={{ maxWidth:1000, padding:"0 0 48px", backgroundColor:"#EEECE8" }}>

      {/* ── HERO ── */}
      <div style={{ padding:"44px 48px 32px" }}>
        <div className="cs-plan-hero">
          {modoAlquiler ? (
            /* HERO ALQUILER */
            <div style={{ flex:1, minWidth:220, display:"flex", flexDirection:"column", fontFamily:"'Montserrat', sans-serif" }}>
              <p style={{ fontSize:22, fontWeight:500, marginBottom:8, color:"#121212", fontFamily:"'Montserrat', sans-serif" }}>
                <strong style={{ fontWeight:800 }}>Hola {cliente.nombre}</strong>, estás a un paso de
              </p>
              <p className="cs-plan-hero-title" style={{ fontSize:48, fontWeight:700, lineHeight:1.05, marginBottom:0, color:"#121212", fontFamily:"'Montserrat', sans-serif" }}>
                <span style={{ color:"#EF931D" }}>ahorrar un {planData?.ahorroAnualPercent ?? 30}%</span>
                <br />
                
              </p>
               <p style={{ fontSize:42, fontWeight:700, marginBottom:8, color:"#121212", fontFamily:"'Montserrat', sans-serif" }}>en tu factura de la luz</p>
              <p style={{ fontSize:16, fontWeight:400, color:"#121212", marginTop:20, marginBottom:28, fontFamily:"'Montserrat', sans-serif" }}>
                Este es tu fantástico plan en la Comunidad Energética de <strong style={{ fontWeight:700 }}>{ceNombre || "—"}</strong>.
              </p>
              <div style={{ background:"#fff", borderRadius:16, padding:"22px 26px", display:"inline-block", maxWidth:400, boxShadow:"0 6px 28px rgba(0,0,0,0.11)" }}>
                <p style={{ fontSize:21, color:"#121212", marginBottom:2, display:"flex", alignItems:"center", gap:6 }}>
                  <img src="/moneda.svg" alt="" style={{ width:32, height:32 }} />
                  <span>Cuota mensual</span>
                </p>
                <p style={{ fontSize:23, fontWeight:700, color:"#EF931D", marginBottom:8, paddingLeft:40 }}>
                  {panelesSel} paneles
                </p>
                <p style={{ fontSize:60, fontWeight:800, lineHeight:1, color:"#121212", display:"flex", alignItems:"baseline", gap:8, paddingLeft:40  }}>
                  {fmtES(cuotaAlquilerMes ?? planData?.cuotaAlquilerMes ?? 0)}€
                  <span style={{ fontSize:13, fontWeight:400, color:"#888" }}>(IVA incluido)</span>
                </p>
                <div style={{ marginTop:20 }}>
                  <button
                    disabled={puedeContratar ? yaContratado : yaEnEspera}
                    style={{ width:"100%", background:(puedeContratar ? yaContratado : yaEnEspera) ? "#ccc" : "#FFAD2A", color:"#000", border:"2px solid transparent", borderRadius:28, padding:"13px", fontSize:15, fontWeight:700, fontFamily:"inherit", cursor:(puedeContratar ? yaContratado : yaEnEspera) ? "not-allowed" : "pointer", letterSpacing:"0.04em", opacity:(puedeContratar ? yaContratado : yaEnEspera) ? 0.7 : 1, transition:"background 0.2s,border-color 0.2s" }}
                    onMouseEnter={e => { if(!(puedeContratar ? yaContratado : yaEnEspera)) { e.currentTarget.style.background="#fff"; e.currentTarget.style.borderColor="#000"; } }}
                    onMouseLeave={e => { if(!(puedeContratar ? yaContratado : yaEnEspera)) { e.currentTarget.style.background="#FFAD2A"; } }}
                    onMouseDown={e => { if(!(puedeContratar ? yaContratado : yaEnEspera)) { e.currentTarget.style.borderColor="#000"; e.currentTarget.style.background="#FFAD2A"; } }}
                    onMouseUp={e => { e.currentTarget.style.borderColor="transparent"; }}
                    onClick={puedeContratar ? onContratar : onListaEspera}>
                    {puedeContratar
                      ? (yaContratado ? "Plan contratado" : "Contratar")
                      : (yaEnEspera ? "Ya estás en lista de espera" : "Unirse a la lista de espera")}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* HERO VENTA */
            <div style={{ flex:1, minWidth:220, display:"flex", flexDirection:"column" }}>
              <p style={{ fontSize:20, fontWeight:500, marginBottom:6, color:"#121212" }}>
                Hola <strong>{cliente.nombre}</strong>, estás a un paso de tener
              </p>
              <p className="cs-plan-hero-title" style={{ fontSize:46, fontWeight:800, lineHeight:1.1, marginBottom:20, color:"#EF931D" }}>
                tu propia energía a 0€
              </p>
              <p style={{ fontSize:16, fontWeight:400, marginBottom:2, color:"#121212" }}>
                Este es tu fantástico plan en la Comunidad Energética de
              </p>
              <p style={{ fontSize:16, fontWeight:700, color:"#121212", marginBottom:28 }}>
                {ceNombre || "—"}.
              </p>
              <div style={{ background:"#fff", borderRadius:16, padding:"22px 26px", display:"inline-block", maxWidth:340, boxShadow:"0 6px 28px rgba(0,0,0,0.11)" }}>
                <p style={{ fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8, color:"#aaa" }}>
                  Ahorro previsto en 25 años
                </p>
                <p style={{ fontSize:54, fontWeight:800, lineHeight:1, color:"#121212" }}>
                  {fmtES(planData?.ahorro25Anos ?? 1575.35)}€<span style={{ fontSize:22, fontWeight:400 }}>*</span>
                </p>
              </div>
            </div>
          )}

          {/* Columna derecha: imagen + ¿Tienes dudas? */}
          <div className="cs-plan-hero-img" style={{ flex:"0 0 auto", display:"flex", flexDirection:"column", alignItems:"flex-end", gap:40, marginBottom: 40 }}>
            <img
              src={ceFotoUrl || "/Intersect.png"}
              alt="Instalación solar"
              style={{ width:460, height:500, objectFit:"cover", borderRadius:20, display:"block" }}
            />
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <span style={{ fontSize:13, color:"#777", fontWeight:500 }}>¿Tienes dudas?</span>
              <button className="cs-btn-asesor" onClick={() => {}}>
                Contacta con tu asesor
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="cs-plan-inner">

        {/* ── IMPORTE A PAGAR (solo venta) ── */}
        {!modoAlquiler && (
          <>
            <p className="cs-section-label" style={{ marginTop:0 }}>Importe a pagar</p>
            <div className="cs-plan-pagos">
              <div style={{ background:"#fff", borderRadius:14, padding:"28px 24px", display:"flex", flexDirection:"column", alignItems:"center", gap:6, boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
                <p style={{ fontSize:11, fontWeight:700, color:"#777", textTransform:"uppercase", letterSpacing:"0.08em" }}>Pago único</p>
                <p style={{ fontSize:40, fontWeight:800, color:"#121212", lineHeight:1.1 }}>
                  {fmtES(planData?.pagoUnico ?? 3480.75)}€
                </p>
                <p style={{ fontSize:11, color:"#aaa" }}>IVA 21% incluido</p>
                <button
                  disabled={puedeContratar ? yaContratado : yaEnEspera}
                  style={{ marginTop:12, background:(puedeContratar ? yaContratado : yaEnEspera) ? "#ccc" : "#FFAD2A", color:"#000", border:"2px solid transparent", borderRadius:28, padding:"12px 32px", fontSize:14, fontWeight:700, fontFamily:"inherit", cursor:(puedeContratar ? yaContratado : yaEnEspera) ? "not-allowed" : "pointer", letterSpacing:"0.04em", opacity:(puedeContratar ? yaContratado : yaEnEspera) ? 0.7 : 1, transition:"background 0.2s,border-color 0.2s" }}
                  onMouseEnter={e => { if(!(puedeContratar ? yaContratado : yaEnEspera)) { e.currentTarget.style.background="#fff"; e.currentTarget.style.borderColor="#000"; } }}
                  onMouseLeave={e => { if(!(puedeContratar ? yaContratado : yaEnEspera)) { e.currentTarget.style.background="#FFAD2A"; } }}
                  onMouseDown={e => { if(!(puedeContratar ? yaContratado : yaEnEspera)) { e.currentTarget.style.borderColor="#000"; e.currentTarget.style.background="#FFAD2A"; } }}
                  onMouseUp={e => { e.currentTarget.style.borderColor="transparent"; }}
                  onClick={puedeContratar ? onContratar : onListaEspera}>
                  {puedeContratar
                    ? (yaContratado ? "Plan contratado" : "Contratar")
                    : (yaEnEspera ? "Ya estás en lista de espera" : "Unirse a la lista de espera")}
                </button>
              </div>
              <div style={{ background:"#fff", borderRadius:14, padding:"28px 24px", display:"flex", flexDirection:"column", alignItems:"center", gap:6, boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
                <p style={{ fontSize:11, fontWeight:700, color:"#777", textTransform:"uppercase", letterSpacing:"0.08em" }}>Financiado</p>
                <p style={{ fontSize:12, color:"#888", marginBottom:2 }}>Hasta 120 cuotas mensuales</p>
                <p style={{ fontSize:40, fontWeight:800, color:"#121212", lineHeight:1.1 }}>
                  {fmtES(planData?.pagoFinanciado ?? 41.33)}€
                </p>
                <p style={{ fontSize:11, color:"#aaa" }}>IVA 21% incluido</p>
              </div>
            </div>
          </>
        )}

        {/* ── ORIGEN / DESTINO + AHORRO ── */}
        <div className="cs-plan-origen">

          {/* Tarjeta Origen — CE */}
          <div style={{ flex:1, background:"#fff", borderRadius:14, overflow:"hidden", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
            <div style={{ position:"relative" }}>
              <img src={ceFotoUrl || "/Intersect.png"} alt="Comunidad Energética" style={{ width:"100%", height:160, objectFit:"cover", display:"block" }} />
              <span style={{ position:"absolute", top:10, left:10, background:"#EF931D", color:"#fff", fontSize:11, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", padding:"5px 12px", borderRadius:20 }}>
                {CE_STATUS_LABELS[ceStatus] || ceStatus || "—"}
              </span>
            </div>
            <div style={{ padding:"16px 18px" }}>
              <p style={{ fontSize:11, color:"#aaa", marginBottom:2 }}>Origen</p>
              <p style={{ fontSize:12, color:"#777", marginBottom:4 }}>Comunidad Energética</p>
              <p style={{ fontSize:15, fontWeight:700, color:"#121212", marginBottom:14 }}>{ceNombre || "—"}</p>
              <a
                href="https://comunidadsolar.es/comunidades-energeticas/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display:"block", width:"100%", background:"#FFAD2A", color:"#000", border:"2px solid transparent", borderRadius:24, padding:"10px", fontSize:13, fontWeight:700, fontFamily:"inherit", cursor:"pointer", letterSpacing:"0.04em", textDecoration:"none", textAlign:"center", boxSizing:"border-box", transition:"background 0.2s,border-color 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.background="#fff"; e.currentTarget.style.borderColor="#000"; }}
                onMouseLeave={e => { e.currentTarget.style.background="#FFAD2A"; e.currentTarget.style.borderColor="transparent"; }}
                onMouseDown={e => { e.currentTarget.style.borderColor="#000"; e.currentTarget.style.background="#FFAD2A"; }}
                onMouseUp={e => { e.currentTarget.style.borderColor="#000"; }}>
                Ver Más
              </a>
            </div>
          </div>

          {/* Conector → */}
          <div className="cs-plan-connector">
            <img src="/Arrow.svg" alt="→" style={{ width:52, height:52 }} />
          </div>

          {/* Tarjeta Destino — domicilio */}
          <div style={{ flex:1, background:"#fff", borderRadius:14, overflow:"hidden", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
            <img src="/domicilio.png" alt="Domicilio" style={{ width:"100%", height:160, objectFit:"cover", display:"block" }} />
            <div style={{ padding:"16px 18px" }}>
              <p style={{ fontSize:11, color:"#aaa", marginBottom:6 }}>Destino</p>
              <p style={{ fontSize:16, fontWeight:600, color:"#121212", lineHeight:1.35 }}>{cliente.direccion || "—"}</p>
            </div>
          </div>

          {/* Card de ahorro */}
          <div className="cs-plan-ahorro" style={{ flexShrink:0, marginLeft:16, display:"flex", flexDirection:"column", gap:8, minWidth:160 }}>
            <div style={{ border:"2px solid transparent", borderRadius:14, padding:"20px 18px", display:"flex", flexDirection:"column", gap:0, background:"linear-gradient(white, white) padding-box, linear-gradient(to bottom, #EF931D, #2EC4C4) border-box", alignItems:"center" }}>
              <p style={{ fontSize:21, fontWeight:800, color:"#EF931D", textTransform:"uppercase", letterSpacing:"0.10em", textAlign:"center", marginBottom:12 }}>AHORRO</p>
              <div style={{ width:"100%", borderTop:"2px solid #EF931D", marginBottom:12 }} />
              <div style={{ textAlign:"center", marginBottom:12 }}>
                <p style={{ fontSize:28, fontWeight:800, color:"#121212", lineHeight:1 }}>{fmtES(planData?.ahorroMensual ?? 38.35)}€</p>
                <p style={{ fontSize:11, fontWeight:600, color:"#000000", marginTop:5 }}>Al mes</p>
              </div>
              <div style={{ width:"100%", borderTop:"2px solid #EF931D", marginBottom:12 }} />
              <div style={{ textAlign:"center" }}>
                <p style={{ fontSize:28, fontWeight:800, color:"#121212", lineHeight:1 }}>{fmtES(planData?.ahorroAnual ?? 460.20)}€</p>
                <p style={{ fontSize:11, fontWeight:600, color:"#000000", marginTop:5 }}>Al año</p>
              </div>
              {!modoAlquiler && (
                <>
                  <div style={{ width:"100%", borderTop:"2px solid #EF931D", marginTop:12, marginBottom:12 }} />
                  <div style={{ textAlign:"center" }}>
                    <p style={{ fontSize:28, fontWeight:800, color:"#121212", lineHeight:1 }}>{fmtES(planData?.ahorro25Anos ?? 1575.35)}€</p>
                    <p style={{ fontSize:11, color:"#000000", marginTop:5 }}>En 25 años (estimado)</p>
                  </div>
                </>
              )}
            </div>
            {/* Fianza — solo alquiler */}
            {modoAlquiler && (
              <div style={{ border:"2px solid transparent", borderRadius:14, padding:"18px 18px", display:"flex", flexDirection:"column", gap:4, background:"linear-gradient(white, white) padding-box, linear-gradient(to bottom, #EF931D, #2EC4C4) border-box", alignItems:"center" }}>
                <p style={{ fontSize:28, fontWeight:800, color:"#121212", lineHeight:1 }}>{fmtES((cuotaAlquilerMes ?? planData?.cuotaAlquilerMes ?? 0) * 2)}€</p>
                <p style={{ fontSize:11, fontWeight:600, color:"#000000", marginTop:5 }}>Fianza</p>
              </div>
            )}
          </div>
        </div>

        {/* ── TU PLAN + OPTIMIZADOR ── */}
        <div className="cs-plan-tabla">
          <div>
            <p style={{ fontSize:22, fontWeight:800, color:"#121212", marginBottom:16 }}>Tu plan</p>
            <table className="cs-table">
              <tbody>
                <tr><td>Número de paneles</td><td>{panelesSel}</td></tr>
                <tr><td>Potencia total</td><td>{fmtES(planData?.potenciaTotal ?? 3)} kW</td></tr>
                <tr><td>Producción de energía anual estimada*</td><td>{fmtES(planData?.produccionAnual ?? 4101.25)} kWh</td></tr>
                <tr><td>Ahorro anual medio estimado**</td><td>{fmtES(planData?.ahorroAnual ?? 522.48)} €</td></tr>
                {modoAlquiler ? (
                  <tr><td>Precio mensual</td><td>{fmtES(cuotaAlquilerMes ?? planData?.cuotaAlquilerMes ?? 0)} €</td></tr>
                ) : (
                  <>
                    <tr><td>Ahorro total estimado durante 25 años*</td><td>{fmtES(planData?.ahorro25Anos ?? 15707.25)} €</td></tr>
                    <tr><td>Coeficiente de distribución sobre total de la instalación</td><td>{fmtES((planData?.coeficienteDistribucion ?? 0.05) * 100)} %</td></tr>
                    <tr><td>Pago al contado</td><td>{fmtES(planData?.pagoUnico ?? 3480.75)} €</td></tr>
                    <tr><td>Plazo estimado de recuperación del coste inicial*</td><td>{fmtES(planData?.plazoRecuperacion ?? 6.7, 1)} años</td></tr>
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Optimizador */}
          <div style={{ background:"#F3D5A9", borderRadius:14, padding:"24px 20px", textAlign:"center", minWidth:170, maxWidth:190, display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
            <p style={{ fontSize:18, fontWeight:800, color:"#121212", lineHeight:1.2 }}>Optimiza<br />tu plan</p>
            <div style={{ width:"100%", borderTop:"2px solid rgba(255, 255, 255)" }} />
            <p style={{ fontSize:12, fontWeight:600, color:"#121212", lineHeight:1.5 }}>Añade o quita<br />paneles solares</p>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <button
                disabled
                style={{ background:"#fff", border:"1.5px solid #ccc", borderRadius:8, width:36, height:36, fontSize:18, fontWeight:700, cursor:"not-allowed", color:"#ccc", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", opacity:0.5 }}>
                −
              </button>
              <div style={{ background:"#fff", border:"1.5px solid #121212", borderRadius:8, width:40, height:36, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <span style={{ fontSize:20, fontWeight:700, color:"#121212" }}>{panelesPropuesta}</span>
              </div>
              <button
                disabled
                style={{ background:"#fff", border:"1.5px solid #ccc", borderRadius:8, width:36, height:36, fontSize:18, fontWeight:700, cursor:"not-allowed", color:"#ccc", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", opacity:0.5 }}>
                +
              </button>
            </div>
            <p style={{ fontSize:11, color:"#000000", lineHeight:1.55 }}>
              Te recomendamos {panelesPropuesta === 1 ? "1 panel solar" : `${panelesPropuesta} paneles solares`}, pero puedes solicitar una cantidad diferente optimizando tu plan.
            </p>
            <button
              disabled
              style={{ background:"#FFAD2A", color:"#121212", border:"none", borderRadius:24, padding:"12px 24px", fontSize:14, fontWeight:700, fontFamily:"inherit", cursor:"not-allowed", width:"100%", opacity:0.5 }}>
              Optimizar
            </button>
            
          </div>
          <p style={{ fontSize:11, color:"#121212", lineHeight:1.6, marginTop:-20, marginBottom:20 }}>
          *Producción anual estimada: Estimación de la energía generada por tus paneles solares, calculada por un software especializado (PVSOL).<br />
          **Ahorro anual medio estimado: Ahorro obtenido en base a la producción estimada y considerando los precios OMIE de los últimos años.
        </p>
        </div>
        

        {/* ── FACTURA PLAN ── */}
        <div style={{ marginBottom:56 }}>
          <FacturaPreview data={facturaPreviewData ?? undefined} />
        </div>

        {/* ── TABS: CÓMO FUNCIONA / TU PLAN / CONDICIONES ── */}
        <div style={{ borderRadius:14, overflow:"hidden", marginBottom:56, boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr" }}>
            {[
              { id:"como",        label:"Cómo funciona" },
              { id:"plan",        label:"Tu plan" },
              { id:"condiciones", label:"Condiciones" },
            ].map(({ id, label }) => (
              <button
                key={id}
                className="cs-tab-btn"
                onClick={() => onSetTabActiva(id)}
                style={{
                  background: tabActiva === id ? "#fff" : "#F2C080",
                  border: "none",
                  borderBottom: tabActiva === id ? "3px solid #EF931D" : "2px solid #F3D5A9",
                  padding: "16px 8px",
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  color: tabActiva === id ? "#121212" : "#555",
                  transition: "background 0.15s, color 0.15s",
                }}>
                {label}
              </button>
            ))}
          </div>

          <div style={{ background:"#fff", padding:"28px 32px", fontSize:14, color:"#333", lineHeight:1.75 }}>

            {tabActiva === "como" && (
              <div>
                <p style={{ marginBottom:10 }}>Al pulsar <strong>"Contratar"</strong>, comenzaremos a generar tres documentos:</p>
                <ul style={{ paddingLeft:20, marginBottom:10, lineHeight:1.7 }}>
                  <li>Tu contrato de alquiler de paneles asociado a la comunidad energética.</li>
                  <li>Tu alta en la comercializadora de Comunidad Solar, para recibir electricidad a coste acordado.</li>
                  <li>Firma de documento de Autorización de Gestor de Autoconsumo.</li>
                </ul>
                <p style={{ marginBottom:10 }}>Para hacer efectiva la reserva, deberás realizar en ese momento el pago de un depósito de garantía <strong>equivalente a 2 meses de tu cuota mensual.</strong></p>
                <p style={{ marginBottom:10 }}>Tu plaza quedará bloqueada durante X <strong>días</strong>. Si no firmas la documentación en ese plazo, la reserva quedará sin efecto.</p>
                <p style={{ marginBottom:10 }}>Una vez firmada la documentación, tendrás 48 horas para realizar el pago del depósito de garantía.</p>
                <p>Una vez la planta esté en funcionamiento, comenzarás a abonar tu cuota mensual y se aplicará un <strong>compromiso de permanencia de 1 año.</strong></p>
              </div>
            )}

            {tabActiva === "plan" && (
              <div>
                <p style={{ marginBottom:10 }}>A continuación, te mostramos tu plan recomendado de participación en la Comunidad Energética <strong>{ceNombre || "—"}</strong>. Este plan está basado en el consumo eléctrico que nos has facilitado y está diseñado para que puedas ahorrar <strong>un {planData?.ahorroAnualPercent ?? 30}% en tu factura de la luz.</strong></p>
                <p style={{ marginBottom:10 }}>Tu participación incluye la asignación de <strong>{panelesSel === 1 ? "1 panel solar" : `${panelesSel} paneles solares`},</strong> con una potencia nominal total de <strong>{fmtES(planData?.potenciaTotal)} kW,</strong> que generarán aproximadamente <strong>{fmtES(planData?.produccionAnual)} kWh</strong> de electricidad durante un periodo estimado de <strong>25 años.</strong></p>
                <p style={{ marginBottom:10 }}>Al formar parte de la Comunidad Energética, pagarás 0€ por la energía autoconsumida, sin peajes ni márgenes comerciales.</p>
                <p style={{ marginBottom:8 }}>Basándonos en la evolución de los precios de la energía (considerando un incremento del {planData?.ahorroAnualPercent ?? 0}% anual) se estiman los siguientes beneficios:</p>
                <ul style={{ paddingLeft:20, marginBottom:10, lineHeight:1.7 }}>
                  <li>Ahorro medio mensual de <strong>{fmtES(planData?.ahorroMensual)}€</strong></li>
                  <li>Ahorro estimado anual <strong>{fmtES(planData?.ahorroAnual)}€</strong></li>
                </ul>
              </div>
            )}

            {tabActiva === "condiciones" && (
              <div>
                <p style={{ marginBottom:10 }}>Al formar parte de la Comunidad Energética <strong>{ceNombre || "—"}</strong>, verás reflejada en tu factura de la luz la energía generada por la planta, que se asignará a tu suministro a través de tu comercializadora.</p>
                <p style={{ marginBottom:10 }}>Desde el momento en que la planta entre en funcionamiento, comenzarás a beneficiarte de un menor coste energético, reduciendo el importe de tu factura eléctrica.</p>
                <p style={{ marginBottom:10 }}>Podrás cambiar de comercializadora en cualquier momento, ya que no existe permanencia con la comercializadora de Comunidad Solar. La distribuidora seguirá asignando tu porcentaje de energía, y la nueva comercializadora deberá reflejarlo en tu factura.</p>
                <p style={{ marginBottom:10 }}>Toda la energía que no consumas será vendida a la red pública a precio de mercado, y ese valor se descontará de tu factura. Para cualquier energía adicional que necesites, pagarás el precio de coste junto con los cargos regulados, sin ningún margen adicional.</p>
                <p style={{ marginBottom:10 }}>Comunidad Solar no busca obtener beneficios a través de la comercializadora; este es simplemente el mecanismo necesario para llevar la energía a tu hogar.</p>
                <p>Este es un resumen de las condiciones. Te recomendamos leer toda la documentación para conocer todos los términos y detalles.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── MÉTRICAS DE AHORRO (solo venta) ── */}
        {!modoAlquiler && (
          <div style={{ background:"#fff", borderRadius:12, padding:"24px 32px", marginBottom:56, display:"flex", justifyContent:"space-around", alignItems:"center", textAlign:"center", gap:8, boxShadow:"0 2px 12px rgba(0,0,0,0.05)" }}>
            <div>
              <p style={{ fontSize:28, fontWeight:800, color:"#EF931D", lineHeight:1 }}>{fmtES(planData?.ahorroMensual ?? 38.35)}€</p>
              <p style={{ fontSize:12, color:"#555", marginTop:6 }}>Al mes</p>
            </div>
            <div style={{ width:1, background:"#e0e0da", alignSelf:"stretch" }} />
            <div>
              <p style={{ fontSize:28, fontWeight:800, color:"#EF931D", lineHeight:1 }}>{fmtES(planData?.ahorroAnual ?? 460.20)}€</p>
              <p style={{ fontSize:12, color:"#555", marginTop:6 }}>Al año</p>
            </div>
            <div style={{ width:1, background:"#e0e0da", alignSelf:"stretch" }} />
            <div>
              <p style={{ fontSize:28, fontWeight:800, color:"#EF931D", lineHeight:1 }}>{fmtES(planData?.ahorro25Anos ?? 1575.35)}€</p>
              <p style={{ fontSize:12, color:"#555", marginTop:6 }}>En 25 años (estimado)</p>
            </div>
          </div>
        )}

        {/* ── PROCESO ── */}
        <div style={{ marginBottom:56 }}>
          <img
            src="/Processo.svg"
            alt="Proceso de contratación"
            style={{ width:"100%", display:"block" }}
          />
        </div>

        {/* ── REGALO APP ── */}
        <div className="cs-plan-regalo">
          <div style={{ flex:1, minWidth:240 }}>
            <p style={{ fontSize:30, fontWeight:800, color:"#000000", lineHeight:1.2, marginBottom:16 }}>
              Tenemos un regalo para ti
            </p>
            <p style={{ fontSize:16, fontWeight:700, color:"#000000", lineHeight:1.5, marginBottom:16 }}>
              Descárgate gratis nuestro asistente energético
            </p>
            <p style={{ fontSize:13, color:"rgba(0, 0, 0, 0.72)", lineHeight:1.75, marginBottom:32 }}>
              Nuestra app te permitirá <strong style={{ color:"#000000" }}>optimizar el uso de energía</strong> en tu hogar, proporcionándote toda la información necesaria para ahorrar y mejorar tu eficiencia energética.
            </p>
            <a
              href="https://comunidadsolar.es/app-asistente-energetico/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display:"inline-block", background:"#FFAD2A", color:"#000", border:"2px solid transparent", borderRadius:28, padding:"14px 40px", fontSize:14, fontWeight:800, fontFamily:"inherit", cursor:"pointer", letterSpacing:"0.06em", textDecoration:"none", transition:"background 0.2s,border-color 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.background="#fff"; e.currentTarget.style.borderColor="#000"; }}
              onMouseLeave={e => { e.currentTarget.style.background="#FFAD2A"; e.currentTarget.style.borderColor="transparent"; }}
              onMouseDown={e => { e.currentTarget.style.borderColor="#000"; e.currentTarget.style.background="#FFAD2A"; }}
              onMouseUp={e => { e.currentTarget.style.borderColor="#000"; }}>
              Descargar
            </a>
          </div>
          <div style={{ flex:"0 0 auto" }}>
            <img src="/App.png" alt="App Comunidad Solar" style={{ height:280, display:"block", objectFit:"contain" }} />
          </div>
        </div>

        {/* ── FOOTNOTE ── */}
        <p style={{ fontSize:11, color:"#111", marginTop:16, lineHeight:1.6 }}>
          * La electricidad a 0€ es la producida por tus paneles solares, seguirás pagando la energía que no produzcas.
        </p>

        {/* ── VOLVER ── */}
        <button className="cs-btn-ghost" style={{ marginTop:16 }} onClick={onVolver}>← Volver al inicio</button>
      </div>
    </div>
    </>
  );
}
