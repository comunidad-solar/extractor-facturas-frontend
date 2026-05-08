import { fmtES } from "../utils/facturaUtils";

export default function OptimizerModal({
  modalOptimizar,
  panelesPropuesta,
  modoAlquiler,
  cuotaAlquilerMes,
  onVolver,
  onAceptar,
}) {
  if (modalOptimizar === null) return null;

  return (
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
            <table className="cs-table" style={{ marginBottom:20, fontSize:16 }}>
              <tbody>
                <tr><td>Número de paneles</td><td>{panelesPropuesta}</td></tr>
                <tr><td>Potencia total</td><td>{parseInt(fmtES(modalOptimizar?.potenciaTotal ?? 0))} kWh</td></tr>
                <tr><td>Producción de energía anual estimada*</td><td>{fmtES(modalOptimizar?.produccionAnual ?? 0)} kWh</td></tr>
                <tr><td>Ahorro anual medio estimado*</td><td>{fmtES(modalOptimizar?.ahorroAnual ?? 0)} €</td></tr>
                {modoAlquiler ? (
                  <tr><td>Precio mensual</td><td>{fmtES(cuotaAlquilerMes ?? modalOptimizar?.cuotaAlquilerMes ?? 0)} €</td></tr>
                ) : (
                  <>
                    <tr><td>Ahorro total estimado durante 25 años*</td><td>{fmtES(modalOptimizar?.ahorro25Anos ?? 0)} €</td></tr>
                    <tr><td>Coeficiente de distribución</td><td>{fmtES(modalOptimizar?.coeficienteDistribucion ?? 0, 0)} %</td></tr>
                    <tr><td>Pago al contado</td><td>{fmtES(modalOptimizar?.pagoUnico ?? 0)} €</td></tr>
                    <tr><td>Plazo estimado de recuperación*</td><td>{fmtES(modalOptimizar?.plazoRecuperacion ?? 0, 1)} años</td></tr>
                  </>
                )}
              </tbody>
            </table>
            <div style={{ display:"flex", gap:12 }}>
              <button className="cs-btn-ghost" style={{ flex:1, marginTop:0 }} onClick={onVolver}>
                ← Volver
              </button>
              <button className="cs-btn-primary" style={{ flex:1, marginTop:0 }} onClick={onAceptar}>
                Aceptar propuesta
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
