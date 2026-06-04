// MaintenanceScreen.jsx
// Pantalla de mantenimiento — se muestra cuando MAINTENANCE_MODE = true en appConstants.js.
// Bloquea toda la aplicación al abrir.

export default function MaintenanceScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#EEECE8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "'Montserrat', 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: "48px 40px",
          maxWidth: 520,
          width: "100%",
          textAlign: "center",
          boxShadow: "0 6px 28px rgba(0,0,0,0.08)",
        }}
      >
        <img src="/logo.png" alt="Comunidad Solar" style={{ height: 48, marginBottom: 28 }} />
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔧</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111", marginBottom: 12 }}>
          En mantenimiento
        </h1>
        <p style={{ fontSize: 15, color: "#555", lineHeight: 1.6, margin: 0 }}>
          Estamos trabajando para que el servicio vuelva a estar disponible lo antes posible.
          Gracias por tu paciencia.
        </p>
      </div>
    </div>
  );
}
