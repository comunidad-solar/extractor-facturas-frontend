import FacturaUpload from './components/FacturaUpload'
import ContratoFirmado from './components/ContratoFirmado'

export default function App() {
  if (window.location.pathname === "/contrato-firmado") {
    return <ContratoFirmado />
  }
  return <FacturaUpload />
}