import { useEffect, useState } from "react";

// Tempo total do timer em segundos (sem mostrar número, só animação)
const TIMER_DURATION_SECONDS = 20;

export default function ContratoFirmado() {
  const [paymentUrl, setPaymentUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("cs_paymentUrl");
    if (stored) {
      setPaymentUrl(stored);
    } else {
      setErrorMsg(
        "No se encontró la URL de pago. Por favor, vuelve a iniciar el proceso de contratación."
      );
      return;
    }

    const timeoutId = setTimeout(() => {
      localStorage.removeItem("cs_paymentUrl");
      window.location.href = stored;
    }, TIMER_DURATION_SECONDS * 1000);

    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#F5F4EF",
        padding: 20,
        fontFamily: '"Montserrat", system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: 560, width: "100%" }}>
        {/* Header — Contrato firmado */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "#1FA84E",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 14,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12.5L10 17.5L19 7.5"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              margin: 0,
              marginBottom: 8,
              color: "#121212",
            }}
          >
            ¡Contrato firmado correctamente!
          </h1>
          <p style={{ fontSize: 14, color: "#555", margin: 0 }}>
            En breve recibirás una copia en tu correo electrónico.
          </p>
        </div>

        {/* Card — Último paso */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: 12,
            padding: 28,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              margin: 0,
              marginBottom: 10,
              color: "#121212",
            }}
          >
            Último paso, realizar el pago de depósito de garantía
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "#555",
              margin: 0,
              marginBottom: 24,
              lineHeight: 1.55,
            }}
          >
            Para finalizar el proceso y activar todas las ventajas de tu cuenta,
            procede al pago del depósito de seguridad.
          </p>

          {/* Timer circular (sem número) */}
          {errorMsg ? (
            <p style={{ color: "#C0392B", fontSize: 13, margin: 0 }}>{errorMsg}</p>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: 48,
                  height: 48,
                }}
              >
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 48 48"
                  style={{ transform: "rotate(-90deg)" }}
                >
                  {/* Track */}
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    fill="none"
                    stroke="#EEE6D7"
                    strokeWidth="4"
                  />
                  {/* Progress */}
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    fill="none"
                    stroke="#EF931D"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 20}
                    strokeDashoffset={2 * Math.PI * 20}
                    style={{
                      animation: `cs-timer-progress ${TIMER_DURATION_SECONDS}s linear forwards`,
                    }}
                  />
                </svg>
              </div>
              <span style={{ fontSize: 14, color: "#555" }}>
                Te redirigimos al pago en unos segundos...
              </span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes cs-timer-progress {
          from { stroke-dashoffset: ${2 * Math.PI * 20}; }
          to   { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
}
