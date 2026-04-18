import { Routes, Route } from 'react-router-dom'
import FacturaUpload from './components/FacturaUpload'
import PlanPage from './pages/PlanPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<FacturaUpload />} />
      <Route path="/plan" element={<PlanPage />} />
    </Routes>
  )
}
