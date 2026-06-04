import FacturaUpload from './components/FacturaUpload'
import ContratoFirmado from './components/ContratoFirmado'
import MaintenanceScreen from './components/MaintenanceScreen'
import { MAINTENANCE_MODE } from './constants/appConstants'

export default function App() {
  // Modo manutenção — bloqueia toda a app (ativar em appConstants.js)
  if (MAINTENANCE_MODE) {
    return <MaintenanceScreen />
  }
  if (window.location.pathname.startsWith("/contrato-firmado")) {
    return <ContratoFirmado />
  }
  return <FacturaUpload />
}
