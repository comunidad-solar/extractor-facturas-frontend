import { fmtES } from "../utils/facturaUtils";
import { CE_STATUS_LABELS } from "../constants/appConstants";

export default function PlanScreen({
  cliente,
  ceNombre,
  ceStatus,
  modoAlquiler,
  cuotaAlquilerMes,
  planData,
  panelesSel,
  panelesPropuesta,
  tabActiva,
  onContratar,
  onVolver,
  onOptimizar,
  onSetPanelesPropuesta,
  onSetTabActiva,
}) {
  return (
    <>
    <div className="cs-results-card fade-in" style={{ maxWidth:1000, padding:"0 0 48px", backgroundColor:"#EEECE8" }}>

      {/* ── HERO ── */}
      <div style={{ padding:"44px 48px 32px" }}>
        <div className="cs-plan-hero">
          {modoAlquiler ? (
            /* HERO ALQUILER */
            <div style={{ flex:1, minWidth:220, display:"flex", flexDirection:"column" }}>
              <p style={{ fontSize:20, fontWeight:500, marginBottom:6, color:"#121212" }}>
                Hola <strong>{cliente.nombre}</strong>, estás a un paso de
              </p>
              <p className="cs-plan-hero-title" style={{ fontSize:46, fontWeight:800, lineHeight:1.1, marginBottom:20, color:"#EF931D" }}>
                ahorrar un 30% en tu<br />factura de la luz
              </p>
              <p style={{ fontSize:16, fontWeight:400, marginBottom:2, color:"#121212" }}>
                Este es tu fantástico plan en la Comunidad Energética de
              </p>
              <p style={{ fontSize:16, fontWeight:700, color:"#121212", marginBottom:28 }}>
                {ceNombre || "—"}.
              </p>
              <div style={{ background:"#fff", borderRadius:16, padding:"22px 26px", display:"inline-block", maxWidth:300, boxShadow:"0 6px 28px rgba(0,0,0,0.11)" }}>
                <p style={{ fontSize:13, color:"#888", marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ color:"#EF931D" }}>⊙</span>
                  <span>Cuota mensual</span>
                  <strong style={{ color:"#EF931D" }}>{panelesSel} paneles</strong>
                </p>
                <p style={{ fontSize:54, fontWeight:800, lineHeight:1, color:"#121212" }}>
                  {fmtES(cuotaAlquilerMes ?? planData?.cuotaAlquilerMes ?? 0)}€
                </p>
                <p style={{ fontSize:12, color:"#aaa", marginTop:4, marginBottom:18 }}>IVA incluido</p>
                <button
                  style={{ width:"100%", background:"#EF931D", color:"#fff", border:"none", borderRadius:28, padding:"13px", fontSize:15, fontWeight:700, fontFamily:"inherit", cursor:"pointer", letterSpacing:"0.04em" }}
                  onClick={onContratar}>
                  Contratar
                </button>
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

          {/* Columna derecha: imagen */}
          <div className="cs-plan-hero-img" style={{ flex:"0 0 auto", display:"flex", alignItems:"flex-start" }}>
            <img
              src="/Intersect.png"
              alt="Instalación solar"
              style={{ width:300, height:340, objectFit:"cover", borderRadius:20, display:"block" }}
            />
          </div>
        </div>

        {/* ¿Tienes dudas? — dentro del hero, fondo beige, alineado a la derecha */}
        <div style={{ display:"flex", justifyContent:"flex-end", alignItems:"center", gap:18, marginTop:28, paddingTop:20, borderTop:"1px solid rgba(0,0,0,0.10)" }}>
          <span style={{ fontSize:13, color:"#777", fontWeight:500 }}>¿Tienes dudas?</span>
          <button className="cs-btn-asesor" onClick={() => {}}>
            Contacta con tu asesor
          </button>
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
                  style={{ marginTop:12, background:"#EF931D", color:"#fff", border:"none", borderRadius:28, padding:"12px 32px", fontSize:14, fontWeight:700, fontFamily:"inherit", cursor:"pointer", letterSpacing:"0.04em" }}
                  onClick={onContratar}>
                  Contratar
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
              <img src="/Intersect.png" alt="Comunidad Energética" style={{ width:"100%", height:160, objectFit:"cover", display:"block" }} />
              <span style={{ position:"absolute", top:10, left:10, background:"#EF931D", color:"#fff", fontSize:11, fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", padding:"5px 12px", borderRadius:20 }}>
                {CE_STATUS_LABELS[ceStatus] || ceStatus || "—"}
              </span>
            </div>
            <div style={{ padding:"16px 18px" }}>
              <p style={{ fontSize:11, color:"#aaa", marginBottom:2 }}>Origen</p>
              <p style={{ fontSize:12, color:"#777", marginBottom:4 }}>Comunidad Energética</p>
              <p style={{ fontSize:15, fontWeight:700, color:"#121212", marginBottom:14 }}>{ceNombre || "—"}</p>
              <button style={{ width:"100%", background:"#EF931D", color:"#fff", border:"none", borderRadius:24, padding:"10px", fontSize:13, fontWeight:700, fontFamily:"inherit", cursor:"pointer", letterSpacing:"0.04em" }}>
                Ver Más
              </button>
            </div>
          </div>

          {/* Conector → */}
          <div className="cs-plan-connector">
            <span style={{ fontSize:26, color:"#EF931D", fontWeight:700, lineHeight:1 }}>→</span>
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
            <div style={{ border:"2px solid #EF931D", borderRadius:14, padding:"20px 18px", display:"flex", flexDirection:"column", gap:14, background:"#fff", alignItems:"center" }}>
              <p style={{ fontSize:11, fontWeight:800, color:"#EF931D", textTransform:"uppercase", letterSpacing:"0.10em", textAlign:"center" }}>AHORRO</p>
              <div style={{ textAlign:"center" }}>
                <p style={{ fontSize:28, fontWeight:800, color:"#EF931D", lineHeight:1 }}>{fmtES(planData?.ahorroMensual ?? 38.35)}€</p>
                <p style={{ fontSize:11, color:"#555", marginTop:5 }}>Al mes</p>
              </div>
              <div style={{ textAlign:"center" }}>
                <p style={{ fontSize:28, fontWeight:800, color:"#EF931D", lineHeight:1 }}>{fmtES(planData?.ahorroAnual ?? 460.20)}€</p>
                <p style={{ fontSize:11, color:"#555", marginTop:5 }}>Al año</p>
              </div>
              {!modoAlquiler && (
                <div style={{ textAlign:"center" }}>
                  <p style={{ fontSize:28, fontWeight:800, color:"#EF931D", lineHeight:1 }}>{fmtES(planData?.ahorro25Anos ?? 1575.35)}€</p>
                  <p style={{ fontSize:11, color:"#555", marginTop:5 }}>En 25 años (estimado)</p>
                </div>
              )}
            </div>
            {/* Fianza — solo alquiler */}
            {modoAlquiler && (
              <div style={{ border:"2px solid #EF931D", borderRadius:14, padding:"18px 18px", display:"flex", flexDirection:"column", gap:4, background:"#fff", alignItems:"center" }}>
                <p style={{ fontSize:28, fontWeight:800, color:"#EF931D", lineHeight:1 }}>{fmtES((cuotaAlquilerMes ?? planData?.cuotaAlquilerMes ?? 0) * 2)}€</p>
                <p style={{ fontSize:11, color:"#555", marginTop:5 }}>Fianza</p>
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
                <tr><td>Numero de paneles</td><td>{panelesSel}</td></tr>
                <tr><td>Potencia total</td><td>{parseInt(fmtES(planData?.potenciaTotal ?? 3))} kWh</td></tr>
                <tr><td>Producción de energía anual estimada*</td><td>{fmtES(planData?.produccionAnual ?? 4101.25)} kWh</td></tr>
                <tr><td>Ahorro anual medio estimado*</td><td>{fmtES(planData?.ahorroAnual ?? 522.48)} €</td></tr>
                {modoAlquiler ? (
                  <tr><td>Precio mensual</td><td>{fmtES(cuotaAlquilerMes ?? planData?.cuotaAlquilerMes ?? 0)} €</td></tr>
                ) : (
                  <>
                    <tr><td>Ahorro total estimado durante 25 años*</td><td>{fmtES(planData?.ahorro25Anos ?? 15707.25)} €</td></tr>
                    <tr><td>Coeficiente de distribución sobre total de la instalación</td><td>{fmtES(planData?.coeficienteDistribucion ?? 5, 0)} %</td></tr>
                    <tr><td>Pago al contado</td><td>{fmtES(planData?.pagoUnico ?? 3480.75)} €</td></tr>
                    <tr><td>Plazo estimado de recuperación del coste inicial*</td><td>{fmtES(planData?.plazoRecuperacion ?? 6.7, 1)} años</td></tr>
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Optimizador */}
          <div style={{ background:"#F3D5A9", borderRadius:14, padding:"24px 20px", textAlign:"center", minWidth:170, maxWidth:190, display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
            <p style={{ fontSize:13, fontWeight:800, color:"#121212", textTransform:"uppercase", letterSpacing:"0.06em" }}>Optimiza tu plan</p>
            <p style={{ fontSize:12, color:"#555", lineHeight:1.5 }}>Añade o quita paneles solares</p>
            <div style={{ display:"flex", alignItems:"center", background:"#fff", borderRadius:10, border:"1.5px solid #121212", overflow:"hidden" }}>
              <button
                onClick={() => onSetPanelesPropuesta(p => Math.max(1, p - 1))}
                style={{ background:"none", border:"none", padding:"8px 14px", fontSize:18, fontWeight:700, cursor:"pointer", color:"#EF931D", fontFamily:"inherit" }}>
                −
              </button>
              <span style={{ fontSize:20, fontWeight:700, color:"#121212", minWidth:32, textAlign:"center" }}>
                {panelesPropuesta}
              </span>
              <button
                onClick={() => onSetPanelesPropuesta(p => p + 1)}
                style={{ background:"none", border:"none", padding:"8px 14px", fontSize:18, fontWeight:700, cursor:"pointer", color:"#EF931D", fontFamily:"inherit" }}>
                +
              </button>
            </div>
            <p style={{ fontSize:11, color:"#555", lineHeight:1.55 }}>
              Te recomendamos 3 paneles solares, pero puedes solicitar una cantidad diferente optimizando tu plan de participación con un asesor energético.
            </p>
            <button
              onClick={onOptimizar}
              style={{ background:"#fff", color:"#EF931D", border:"2px solid #EF931D", borderRadius:24, padding:"10px 24px", fontSize:13, fontWeight:700, fontFamily:"inherit", cursor:"pointer", letterSpacing:"0.04em", width:"100%" }}>
              Optimizar
            </button>
          </div>
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
                <p style={{ fontWeight:700, color:"#EF931D", marginBottom:14 }}>Abierta la fase de Contratación:</p>
                <p style={{ marginBottom:10 }}>Al pulsar "Contratar", comenzaremos a generar tres documentos:</p>
                <ul style={{ paddingLeft:20, marginBottom:10 }}>
                  <li>La orden de compra de tus paneles.</li>
                  <li>La participación en la asociación Light for Humanity.</li>
                  <li>Tu alta en la comercializadora de Comunidad Solar, para recibir electricidad a coste cero.</li>
                </ul>
                <p style={{ marginBottom:10 }}>Es muy importante que tengas a mano una factura actual de la luz.</p>
                <p style={{ marginBottom:10 }}>Tus paneles quedarán reservados durante 48 horas; si no firmas la documentación en ese plazo, la reserva quedará sin efecto y volverás a lista de espera. Tras la firma de la documentación, dispondrás de 5 días para realizar el primer pago.</p>
                <p>Si estás interesado en financiación, podrás solicitarla después de firmar el contrato. En caso de que la entidad bancaria no apruebe la financiación, el contrato no entrará en vigor.</p>
              </div>
            )}

            {tabActiva === "plan" && (
              <div>
                <p style={{ marginBottom:10 }}>A continuación detallamos tu plan recomendado de participación de autoconsumo en la Comunidad Energética <strong>{ceNombre || "—"}</strong>. Este plan está basado en el consumo eléctrico que nos has facilitado y que te permitirá ahorrar hasta un 70% en tu factura de la luz.</p>
                <p style={{ marginBottom:10 }}>El plan incluye la compra de <strong>{panelesSel} paneles solares</strong> que generarán un total aproximado de <strong>{fmtES(planData?.produccionAnual)} kWh</strong> de electricidad en un periodo de <strong>{fmtES(planData?.plazoRecuperacion, 0)} años</strong> con un coste inicial de <strong>{fmtES(planData?.pagoUnico)}€</strong>. (El precio podría ser mayor en función del coste final de la instalación para verter a la red eléctrica, de lo que se informaría claramente por anticipado antes de cualquier contratación)</p>
                <p style={{ marginBottom:10 }}>Al unirte a la Comunidad Energética de <strong>{ceNombre || "—"}</strong>, podrás disfrutar de la electricidad a <strong>0€ por kWh</strong> en tu factura de la luz.</p>
                <p style={{ marginBottom:8 }}>Basándonos en los precios de energía de los últimos años, obtendrás los siguientes beneficios:</p>
                <ul style={{ paddingLeft:20, marginBottom:10 }}>
                  <li>Ahorro promedio de <strong>{fmtES(planData?.ahorroAnual)}€</strong> al año.</li>
                  <li>Recuperación de la inversión inicial en solo <strong>{fmtES(planData?.plazoRecuperacion, 1)} años</strong>.</li>
                  <li>Ahorro total estimado de <strong>{fmtES(planData?.ahorro25Anos)}€</strong> en 25 años (considerando una subida del precio de la energía del 0% anual).</li>
                </ul>
                <p>Los <strong>{panelesSel} paneles</strong> contienen una potencia nominal total de <strong>{fmtES(planData?.potenciaTotal)} kW</strong>. Lo que quiere decir que el coeficiente de reparto que te pertenece es del <strong>{fmtES(planData?.coeficienteDistribucion, 0)}%</strong> de toda la Comunidad Energética.</p>
              </div>
            )}

            {tabActiva === "condiciones" && (
              <div>
                <p style={{ marginBottom:10 }}>Al adquirir tu participación en la comunidad energética <strong>{ceNombre || "—"}</strong>, verás reflejada la electricidad generada por tus paneles en tu hogar a través de tu comercializadora. Durante los próximos 25 años, verás reflejada en tu factura de la luz la energía producida por tus paneles solares, con un coste de <strong>0€/kWh</strong>.</p>
                <p style={{ marginBottom:10 }}>Para el mantenimiento y seguro de tus paneles solares, pagarás una cuota mensual de <strong>0€ + IVA</strong> por cada panel solar. Estos paneles están diseñados para tener una vida útil de 25 años, y esta cuota es necesaria para asegurar su buen funcionamiento.</p>
                <p style={{ marginBottom:10 }}>Una vez firmada la documentación, el pago se realizará en 3 fases: 50% del total se abonará tras la firma de los documentos, un 25% al finalizar la instalación y el 25% restante al comenzar la producción de la planta.</p>
                <p style={{ marginBottom:10 }}>Podrás cambiarte a otra comercializadora en cualquier momento, ya que no hay permanencia con la comercializadora de Comunidad Solar. La distribuidora de electricidad ya conoce el porcentaje de producción solar que te corresponde, y la nueva comercializadora deberá descontarte esa producción en tu factura de la luz. Debes tener en cuenta que aunque te cambies de comercializadora, tendrás que seguir abonando la cuota de mantenimiento de tus paneles.</p>
                <p style={{ marginBottom:10 }}>Toda la electricidad que no consumas será vendida a la red pública a precio de mercado, y ese valor se descontará de tu factura. Para cualquier energía adicional que necesites, pagarás el precio de coste junto con los cargos regulados, sin ningún margen adicional.</p>
                <p style={{ marginBottom:10 }}>Comunidad Solar no busca obtener beneficios a través de la comercializadora; este es simplemente el mecanismo necesario para llevar la energía a tu hogar.</p>
                <p>Este es un resumen de las condiciones. Te recomendamos leer toda la documentación para conocer todos los términos y detalles antes de proceder con la contratación.</p>
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
            <button style={{ background:"#EF931D", color:"#000000", border:"none", borderRadius:28, padding:"14px 40px", fontSize:14, fontWeight:800, fontFamily:"inherit", cursor:"pointer", letterSpacing:"0.06em" }}>
              Descargar
            </button>
          </div>
          <div style={{ flex:"0 0 auto" }}>
            <img src="/App.png" alt="App Comunidad Solar" style={{ height:280, display:"block", objectFit:"contain" }} />
          </div>
        </div>

        {/* ── VOLVER ── */}
        <button className="cs-btn-ghost" style={{ marginTop:24 }} onClick={onVolver}>← Volver al inicio</button>

        {/* ── FOOTNOTE ── */}
        <p style={{ fontSize:11, color:"#aaa", marginTop:16, lineHeight:1.6 }}>
          * La electricidad a 0€ es la producida por tus paneles solares, seguirás pagando la energía que no produzcas.
        </p>
      </div>
    </div>
    </>
  );
}
