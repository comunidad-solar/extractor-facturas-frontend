import FacturaUpload from './components/FacturaUpload'
import ContratoFirmado from './components/ContratoFirmado'

export default function App() {
  if (window.location.pathname.startsWith("/contrato-firmado")) {
    return <ContratoFirmado />
  }
  return <FacturaUpload />
}