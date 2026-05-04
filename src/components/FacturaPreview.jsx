import { useMemo, useState } from 'react';
import { FACTURA_PREVIEW_MOCK_FALLBACK } from '../constants/appConstants';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';

// ── Iconos solares sobre el gráfico de área ───────────────────────────────────
const SOLAR_ICONS = [
  { hour: 4,  label: '☽' },
  { hour: 8,  label: '↑☀' },
  { hour: 12, label: '☀' },
  { hour: 16, label: '↓☀' },
  { hour: 20, label: '☽' },
];

// ─── Mock data (used when no data prop is passed) ─────────────────────────────
const MOCK_DATA = {
  periodo: "Mes Medio",
  dias: 30,
  produto: "CE",
  grafico_horario: [
    { hora: 0,  generada: 0.0, consumida: 1.0, autoconsumo: 0.0 },
    { hora: 1,  generada: 0.0, consumida: 0.8, autoconsumo: 0.0 },
    { hora: 2,  generada: 0.0, consumida: 0.8, autoconsumo: 0.0 },
    { hora: 3,  generada: 0.0, consumida: 0.8, autoconsumo: 0.0 },
    { hora: 4,  generada: 0.0, consumida: 1.0, autoconsumo: 0.0 },
    { hora: 5,  generada: 0.0, consumida: 1.4, autoconsumo: 0.0 },
    { hora: 6,  generada: 0.1, consumida: 2.0, autoconsumo: 0.1 },
    { hora: 7,  generada: 0.6, consumida: 2.5, autoconsumo: 0.6 },
    { hora: 8,  generada: 1.4, consumida: 2.3, autoconsumo: 1.4 },
    { hora: 9,  generada: 2.4, consumida: 2.0, autoconsumo: 2.0 },
    { hora: 10, generada: 3.3, consumida: 1.8, autoconsumo: 1.8 },
    { hora: 11, generada: 4.0, consumida: 1.7, autoconsumo: 1.7 },
    { hora: 12, generada: 4.5, consumida: 1.9, autoconsumo: 1.9 },
    { hora: 13, generada: 4.6, consumida: 2.1, autoconsumo: 2.1 },
    { hora: 14, generada: 4.3, consumida: 2.0, autoconsumo: 2.0 },
    { hora: 15, generada: 3.5, consumida: 2.0, autoconsumo: 2.0 },
    { hora: 16, generada: 2.4, consumida: 2.2, autoconsumo: 2.2 },
    { hora: 17, generada: 1.3, consumida: 2.6, autoconsumo: 1.3 },
    { hora: 18, generada: 0.4, consumida: 3.0, autoconsumo: 0.4 },
    { hora: 19, generada: 0.0, consumida: 3.2, autoconsumo: 0.0 },
    { hora: 20, generada: 0.0, consumida: 2.8, autoconsumo: 0.0 },
    { hora: 21, generada: 0.0, consumida: 2.2, autoconsumo: 0.0 },
    { hora: 22, generada: 0.0, consumida: 1.5, autoconsumo: 0.0 },
    { hora: 23, generada: 0.0, consumida: 1.0, autoconsumo: 0.0 },
  ],
  grafico_barras: {
    autoconsumo_remoto_kwh: 517.41,
    energia_mercado_kwh:    398.90,
    autoconsumo_kwh:        311.34,
    excedentes_kwh:          42.10,
  },
  resumen: {
    autoconsumo_remoto:   0.00,
    energia_mercado:     33.30,
    excedente_remoto:   -34.61,
    potencia:            -1.31,
    otros_peajes:         7.87,
    cuotas_reguladas:    52.42,
    cuota_mantenimiento: 10.00,
    ivas:                14.48,
  },
  potencia_facturada: [
    { periodo: "P1", kw: 3.464, dias: 30, precio_kwdia: 0.073782, total: 7.67 },
    { periodo: "P2", kw: 3.464, dias: 30, precio_kwdia: 0.001911, total: 0.20 },
    { periodo: "P3", kw: 0,     dias: 30, precio_kwdia: 0.000000, total: 0.00 },
    { periodo: "P4", kw: 0,     dias: 30, precio_kwdia: 0.000000, total: 0.00 },
    { periodo: "P5", kw: 0,     dias: 30, precio_kwdia: 0.000000, total: 0.00 },
    { periodo: "P6", kw: 0,     dias: 30, precio_kwdia: 0.000000, total: 0.00 },
  ],
  energia_facturada: [
    { concepto: "Energía de Autoconsumo",      kwh: 311.34, precio_kwh: 0.00000, total:  0.00 },
    { concepto: "Energía del mercado",          kwh: 398.90, precio_kwh: 0.08348, total: 33.30 },
    { concepto: "Energía Resto de conceptos",  kwh: 710.24, precio_kwh: 0.06844, total: 48.61 },
  ],
  excedentes: [
    { concepto: "Excedente",                  kwh: 517.41, precio_kwh: 0.06690, total: -34.61 },
    { concepto: "Transferencia al Monedero Virtual", kwh: null,   precio_kwh: null,    total: null   },
  ],
  otros_conceptos: [
    { concepto: "Impuesto eléctrico",           porcentaje: 5.11, dias: null, precio_dia: null,     total:  2.82 },
    { concepto: "Financiación del bono social", porcentaje: null, dias: 30,   precio_dia: 0.006282, total:  0.19 },
    { concepto: "Alquiler de equipo de medida", porcentaje: null, dias: 30,   precio_dia: 0.026630, total:  0.80 },
    { concepto: "Cuota mantenimiento", porcentaje: null, dias: 30,   precio_dia: 0.333333, total: 10.00 },
  ],
  impuestos: {
    base_imponible:   68.97,
    iva_porcentaje:   21,
    iva_total:        14.48,
    total_factura:    83.45,
  },
};

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtEur = (v) => v == null ? '—' : `${Number(v).toFixed(2)} €`;
const fmtKwh = (v) => v == null ? '—' : Number(v).toFixed(2);
const fmtP6  = (v) => v == null ? '—' : Number(v).toFixed(6);

// ─── Table cell helpers ───────────────────────────────────────────────────────
const TH = ({ children, style }) => (
  <th style={{ fontSize: 11, fontWeight: 700, color: '#7CB342', textAlign: 'right', padding: '3px 6px', ...style }}>
    {children}
  </th>
);
const TD = ({ children, style }) => (
  <td style={{ fontSize: 12, textAlign: 'right', padding: '2px 6px', ...style }}>
    {children}
  </td>
);
const SectionRow = ({ label }) => (
  <tr>
    <td colSpan={5} style={{
      paddingTop: 14, paddingBottom: 3, fontSize: 12, fontWeight: 700,
      borderBottom: '2.5px solid #7CB342', color: '#111',
    }}>
      {label}
    </td>
  </tr>
);

// ─── Bar chart data builder ───────────────────────────────────────────────────
const buildBarData = (gb, produto) => [
  ...(produto === 'AR' ? [{ name: 'Autoconsumo remoto', value: gb.autoconsumo_remoto_kwh, fill: '#A5D6A7' }] : []),
  { name: 'Energía del mercado', value: gb.energia_mercado_kwh, fill: '#F5A623' },
  { name: 'Autoconsumo',         value: gb.autoconsumo_kwh,      fill: '#79AEC4' },
  { name: 'Excedentes',          value: gb.excedentes_kwh,       fill: '#9fd1f9' },
];

// ─── Main component ───────────────────────────────────────────────────────────
const isValid = (v) => !!(v && v.resumen && v.impuestos && v.grafico_barras && v.grafico_horario && v.potencia_facturada && v.energia_facturada && v.excedentes && v.otros_conceptos);

// ── Flag de visibilidade do botão de edição — desativar em produção ───────────
const SHOW_EDIT_BUTTON = import.meta.env.DEV;

export default function FacturaPreview({ data = null }) {
  const [editedData, setEditedData] = useState(null);
  const [editOpen, setEditOpen]     = useState(false);
  const [editJson, setEditJson]     = useState('');
  const [editError, setEditError]   = useState('');

  const resolved = editedData ?? (isValid(data) ? data : null) ?? (FACTURA_PREVIEW_MOCK_FALLBACK ? MOCK_DATA : null);

  const d   = resolved;
  const r   = d?.resumen;
  const imp = d?.impuestos;
  const barData = useMemo(() => d ? buildBarData(d.grafico_barras, d.produto) : [], [d]);

  if (!resolved) return null;

  const handleOpenEdit = () => {
    setEditJson(JSON.stringify(resolved, null, 2));
    setEditError('');
    setEditOpen(true);
  };

  const handleConfirmEdit = () => {
    try {
      const parsed = JSON.parse(editJson);
      if (!isValid(parsed)) { setEditError('JSON incompleto: falta alguna clave requerida (resumen, impuestos, grafico_barras…)'); return; }
      setEditedData(parsed);
      setEditOpen(false);
    } catch (e) {
      setEditError('JSON inválido: ' + e.message);
    }
  };

  const energyRows = [
    ...(d.produto === 'AR' ? [{ label: 'Autoconsumo remoto', val: r.autoconsumo_remoto, color: '#7CB342' }] : []),
    { label: 'Energía del mercado', val: r.energia_mercado,  color: '#F5A623' },
    { label: 'Autoconsumo',         val: 0,                   color: '#79AEC4' },
    { label: 'Excedente',           val: r.excedente_remoto, color: r.excedente_remoto < 0 ? '#9fd1f9' : '#111' },
  ];
  const otherRows = [
    { label: 'Potencia',            val: r.potencia },
    { label: 'Otros peajes',        val: r.otros_peajes },
    { label: 'Cuotas reguladas', sublabel: 'peajes + cargos', val: r.cuotas_reguladas },
    { label: 'Cuota mantenimiento', val: r.cuota_mantenimiento },
    { label: "IVA's",               val: r.ivas },
  ];
  // cada fila energyRows ≈ 21px → altura barra chart = nº filas × 21 + margens
  const barHeight = energyRows.length * 45 + 30;

  // stroke = cor da linha de contorno | legendColor = cor do quadrado na legenda | fill = preenchimento da área
  const AREA_CFG = [
    { key: 'generada',    name: 'Energía generada',  stroke: 'rgb(80, 151, 4)', legendColor: '#7CB342', fill: '#7CB342', fillOpacity: 0.35 },
    { key: 'consumida',   name: 'Energía consumida', stroke: '#c87b00',         legendColor: '#F5A623', fill: '#F5A623', fillOpacity: 0.35 },
    { key: 'autoconsumo', name: 'Autoconsumo',        stroke: '#057adb',         legendColor: '#49a1a9', fill: '#42A5F5', fillOpacity: 0.50 },
  ];
  const LEGEND_ORDER = ['autoconsumo', 'consumida', 'generada'];
  const areaChartLegend = () => (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: 12, marginTop: 4 }}>
      {LEGEND_ORDER.map(key => {
        const cfg = AREA_CFG.find(c => c.key === key);
        return (
          <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 12, height: 12, background: cfg.legendColor, opacity: 0.5, display: 'inline-block', borderRadius: 2 }} />
            {cfg.name}
          </span>
        );
      })}
    </div>
  );

  return (
    <div style={{ fontFamily: 'inherit', width: '100%', border: '1px solid #ddd', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ background: '#F5A623', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>Así quedaría tu factura</p>
        {SHOW_EDIT_BUTTON && (
          <button
            onClick={handleOpenEdit}
            title="Editar datos (solo desarrollo)"
            style={{ background: 'rgba(0,0,0,0.15)', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#fff', fontSize: 12, fontFamily: 'inherit', opacity: 0.7 }}
          >
            ✏ editar
          </button>
        )}
      </div>

      {/* ── Modal de edición ───────────────────────────────────────────────── */}
      {editOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '24px 24px 20px', width: '100%', maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Editar datos de la factura</p>
            <textarea
              value={editJson}
              onChange={e => { setEditJson(e.target.value); setEditError(''); }}
              spellCheck={false}
              style={{ flex: 1, minHeight: 380, fontFamily: 'monospace', fontSize: 12, border: '1px solid #ddd', borderRadius: 6, padding: 12, resize: 'vertical', outline: 'none' }}
            />
            {editError && <p style={{ fontSize: 11, color: '#C62828', marginTop: 8 }}>{editError}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditOpen(false)}
                style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmEdit}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#F5A623', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700 }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ── Detalles de la factura ─────────────────────────────────────────── */}
      <div style={{ padding: '20px 32px 0' }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', borderBottom: '2px solid #7CB342', paddingBottom: 4, marginBottom: 12 }}>
          FACTURA DEL {(d.periodo || '').toUpperCase()}
        </p>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', marginBottom: 14, color: '#333' }}>
          DETALLES DE LA FACTURA
        </p>

        {/* ── Area chart + overlay de ícones solares ──────────────────────── */}
        <div style={{ position: 'relative' }}>
          <ResponsiveContainer width="100%" height={220} style={{ outline: 'none' }}>
            <AreaChart data={d.grafico_horario} margin={{ top: 36, right: 16, left: 0, bottom: 0 }}>
              <XAxis dataKey="hora" tick={{ fontSize: 10 }} ticks={[0, 4, 8, 12, 16, 20]} tickFormatter={v => `${v}h`} />
              <YAxis tickFormatter={v => `${v} kWh`} tick={{ fontSize: 10 }} width={58} />
              <Tooltip formatter={(v, name) => [`${Number(v).toFixed(2)} kWh`, name]} labelFormatter={v => `${v}h`} contentStyle={{ fontSize: 11, padding: '4px 8px' }} itemStyle={{ margin: 0, padding: '1px 0' }} />
              <Legend content={areaChartLegend} />
              {AREA_CFG.map(cfg => (
                <Area key={cfg.key} type="monotone" dataKey={cfg.key} name={cfg.name}
                  stroke={cfg.stroke} fill={cfg.fill} fillOpacity={cfg.fillOpacity} />
              ))}
            </AreaChart>
          </ResponsiveContainer>

          {/* Ícones solares sobrepostos no topo da área de plotagem */}
          <div style={{ position: 'absolute', top: 10, left: 58, right: 16, pointerEvents: 'none' }}>
            {SOLAR_ICONS.map(({ hour, label }) => {
              const pct = (hour / 23) * 100;
              return (
                <div key={hour} style={{ position: 'absolute', left: `${pct}%`, transform: 'translateX(-50%)', fontSize: 20, color: '#555', lineHeight: 1 }}>
                  {label}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Caixa valores | Gráfico | Labels ────────────────────────────── */}
        <div style={{ display: 'flex', gap: 8, marginTop: 32, alignItems: 'flex-start' }}>

          {/* Col 1: caixa estreita — apenas valores */}
          <div style={{ border: '1.5px solid #bbb', borderRadius: 8, padding: '0 14px', fontSize: 13, flexShrink: 0 }}>
            {energyRows.map(({ label, val, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', height: 45 }}>
                <span style={{ fontWeight: 600, color: color || '#111' }}>{fmtEur(val)}</span>
              </div>
            ))}
            {/* Separador com altura = XAxis (30px) */}
            <div style={{ height: 30, display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '100%', borderTop: '1.5px solid #ccc' }} />
            </div>
            {otherRows.map(({ label, val }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', height: 30 }}>
                <span style={{ fontWeight: 600 }}>{fmtEur(val)}</span>
              </div>
            ))}
            <div style={{ borderTop: '2px solid #111', marginTop: 4, paddingTop: 6, paddingBottom: 10, textAlign: 'right', fontWeight: 800, fontSize: 13 }}>
              {fmtEur(imp.total_factura)}
            </div>
          </div>

          {/* Col 2: labels coloridas alinhadas com barras + descriptions otros */}
          <div style={{ flexShrink: 0, fontSize: 12, textAlign: 'center' }}>
            {/* Labels das barras — cor da barra correspondente */}
            {energyRows.map(({ label }, i) => (
              <div key={label} style={{ height: 45, display: 'flex', alignItems: 'center', justifyContent: 'center', color: barData[i]?.fill || '#111', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {label}
              </div>
            ))}
            {/* Gap = XAxis height */}
            <div style={{ height: 30 }} />
            {/* Descriptions otros */}
            {otherRows.map(({ label, sublabel }) => (
              <div key={label} style={{ height: 30, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 4 }}>
                <span style={{ color: '#444' }}>{label}</span>
                {sublabel && <span style={{ fontSize: 10, color: '#aaa' }}>({sublabel})</span>}
              </div>
            ))}
            <div style={{ height: 30, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', fontWeight: 700, fontSize: 13, marginTop: 7 }}>
              Total a pagar en tu Factura
            </div>
          </div>

          {/* Col 3: gráfico de barras sem YAxis labels */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height={barHeight} style={{ outline: 'none' }}>
              <BarChart layout="vertical" data={barData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} unit=" kWh" />
                <YAxis type="category" dataKey="name" hide />
                <Tooltip formatter={(v, name) => [`${Number(v).toFixed(2)} kWh`, name]} />
                <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                  {barData.map((row) => <Cell key={row.name} fill={row.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Tabla detallada ────────────────────────────────────────────────── */}
      <div style={{ padding: '0 32px 28px', borderTop: '1px solid #eee', overflowX: 'auto' }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 12, paddingTop: 16, borderBottom: '2px solid #7CB342', paddingBottom: 4 }}>
          MÁS INFORMACIÓN SOBRE TU FACTURA
        </p>

        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#555', padding: '3px 6px 3px 0' }}>Concepto</th>
              <TH>Cantidad</TH>
              <TH>Días</TH>
              <TH>Precio UD</TH>
              <TH>Total €</TH>
            </tr>
          </thead>
          <tbody>

            {/* ── POTENCIA FACTURADA ─────────────────────────────────────── */}
            <SectionRow label="Potencia Facturada" />
            <tr>
              <td />
              <TH>kW</TH>
              <td />
              <TH>€/kW·día</TH>
              <td />
            </tr>
            {d.potencia_facturada.filter(p => p.kw != null && p.kw !== 0).map(p => (
              <tr key={p.periodo}>
                <td style={{ padding: '2px 6px 2px 0', fontSize: 12 }}>{p.periodo} Potencia Facturada</td>
                <TD>{fmtKwh(p.kw)}</TD>
                <TD>{p.dias}</TD>
                <TD>{fmtP6(p.precio_kwdia)}</TD>
                <TD>{fmtEur(p.total)}</TD>
              </tr>
            ))}

            {/* ── ENERGÍA FACTURADA ──────────────────────────────────────── */}
            <tr><td colSpan={5} style={{ paddingTop: 8 }} /></tr>
            <SectionRow label="Energía facturada" />
            <tr>
              <td />
              <TH>kWh</TH>
              <td />
              <TH>€/kWh</TH>
              <td />
            </tr>
            {d.energia_facturada.map(e => (
              <tr key={e.concepto}>
                <td style={{ padding: '2px 6px 2px 0', fontSize: 12 }}>{e.concepto}</td>
                <TD>{fmtKwh(e.kwh)}</TD>
                <TD />
                <TD>{fmtP6(e.precio_kwh)}</TD>
                <TD>{fmtEur(e.total)}</TD>
              </tr>
            ))}

            {/* ── TERMINO DE EXCEDENTES ──────────────────────────────────── */}
            <tr><td colSpan={5} style={{ paddingTop: 8 }} /></tr>
            <SectionRow label="Termino de excedentes" />
            <tr>
              <td />
              <TH>kWh</TH>
              <td />
              <TH>€/kWh</TH>
              <td />
            </tr>
            {d.excedentes.map(e => (
              <tr key={e.concepto}>
                <td style={{ padding: '2px 6px 2px 0', fontSize: 12 }}>{e.concepto}</td>
                <TD>{e.kwh        != null ? fmtKwh(e.kwh)       : '—'}</TD>
                <TD />
                <TD>{e.precio_kwh != null ? fmtP6(e.precio_kwh) : '—'}</TD>
                <TD style={{ color: e.total != null && e.total < 0 ? '#7CB342' : '#111' }}>
                  {fmtEur(e.total)}
                </TD>
              </tr>
            ))}

            {/* ── OTROS CONCEPTOS ────────────────────────────────────────── */}
            <tr><td colSpan={5} style={{ paddingTop: 8 }} /></tr>
            <SectionRow label="Otros conceptos" />
            {d.otros_conceptos.map(o => (
              <tr key={o.concepto}>
                <td style={{ padding: '2px 6px 2px 0', fontSize: 12 }}>
                  {o.concepto}
                  {o.porcentaje != null && (
                    <span style={{ color: '#555', marginLeft: 6 }}>{o.porcentaje}%</span>
                  )}
                </td>
                <TD />
                <TD>{o.dias ?? '—'}</TD>
                <TD>{o.precio_dia != null ? fmtP6(o.precio_dia) : '—'}</TD>
                <TD>{fmtEur(o.total)}</TD>
              </tr>
            ))}

            {/* ── TOTALS ─────────────────────────────────────────────────── */}
            <tr><td colSpan={5} style={{ paddingTop: 12 }} /></tr>
            <tr>
              <td colSpan={4} style={{ textAlign: 'right', padding: '4px 6px', fontSize: 12 }}>Base imponible</td>
              <td style={{ background: '#90CAF9', textAlign: 'right', padding: '4px 8px', fontSize: 12, fontWeight: 600 }}>
                {fmtEur(imp.base_imponible)}
              </td>
            </tr>
            <tr>
              <td colSpan={4} style={{ textAlign: 'right', padding: '4px 6px', fontSize: 12 }}>
                {imp.iva_porcentaje}% &nbsp; IVA
              </td>
              <td style={{ background: '#90CAF9', textAlign: 'right', padding: '4px 8px', fontSize: 12, fontWeight: 600 }}>
                {fmtEur(imp.iva_total)}
              </td>
            </tr>
            <tr>
              <td colSpan={4} style={{ textAlign: 'right', padding: '6px 6px', fontSize: 13, fontWeight: 700 }}>
                TOTAL FACTURA
              </td>
              <td style={{ background: '#1565C0', color: '#fff', textAlign: 'right', padding: '6px 8px', fontSize: 13, fontWeight: 800, clipPath: 'inset(0 0 0 0 round 0 0 6px 6px)' }}>
                {fmtEur(imp.total_factura)}
              </td>
            </tr>

          </tbody>
        </table>
      </div>
    </div>
  );
}
