import React, { useEffect, useState } from "react";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../firebaseConfig";
import MapaRecorrido from "../components/MapaRecorrido";
import Header from "../components/Header";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const AdminPanel = () => {
  const [recorridos, setRecorridos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recorridoIdSeleccionado, setRecorridoIdSeleccionado] = useState(null);
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");

  const cargarRecorridos = async () => {
    try {
      const q = query(collection(db, "recorridos"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          usuario: d.usuario || "N/D",
          puntos: Array.isArray(d.puntos) ? d.puntos : [],
          horaInicio: d.horaInicio,
          horaFin: d.horaFin || null,
          duracionTotalMin: d.duracionTotalMin || 0,
          ...d
        };
      });
      setRecorridos(data);
    } catch (err) {
      console.error("Error al cargar recorridos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarRecorridos();
  }, []);

  const precioUnitario = 18;

  const aplicarFiltros = (data) => {
    return data.filter(r => {
      const fechaRecorrido = new Date(r.horaInicio);
      const desde = filtroDesde ? new Date(filtroDesde) : null;
      const hasta = filtroHasta ? new Date(filtroHasta) : null;
      return (
        (!filtroUsuario || r.usuario === filtroUsuario) &&
        (!desde || fechaRecorrido >= desde) &&
        (!hasta || fechaRecorrido <= hasta)
      );
    });
  };

  const generarEstadisticas = (datos) => {
    const totalEntregas = datos.reduce((acc, r) => acc + r.puntos.reduce((s, p) => s + (p.entregados || 0), 0), 0);
    const totalFrias = datos.reduce((acc, r) => acc + r.puntos.reduce((s, p) => s + (p.frias || 0), 0), 0);
    const totalRecaudo = datos.reduce((acc, r) => {
      return acc + r.puntos.reduce((sum, p) => {
        const neto = Math.max((p.entregados || 0) - (p.frias || 0), 0);
        return sum + (neto * precioUnitario);
      }, 0);
    }, 0);
    const ticketPromedio = datos.length ? (totalRecaudo / datos.length).toFixed(2) : 0;
    const duracionPromedio = datos.length ? (datos.reduce((s, r) => s + r.duracionTotalMin, 0) / datos.length).toFixed(1) : 0;

    return { totalEntregas, totalFrias, totalRecaudo, ticketPromedio, duracionPromedio };
  };

  const exportarPDF = () => {
    const datosFiltrados = aplicarFiltros(recorridos);
    const resumen = generarEstadisticas(datosFiltrados);
    const doc = new jsPDF();

    doc.setFontSize(14);
    doc.text("Reporte de Recorridos", 14, 20);

    autoTable(doc, {
      startY: 30,
      head: [["Total entregas", "Total frías", "Total $", "Ticket promedio", "Duración promedio (min)"]],
      body: [[
        resumen.totalEntregas + " kg",
        resumen.totalFrias + " kg",
        `$${resumen.totalRecaudo.toFixed(2)}`,
        `$${resumen.ticketPromedio}`,
        resumen.duracionPromedio
      ]],
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [["Usuario", "Fecha", "Duración", "Entregas", "Frías", "Total $"]],
      body: datosFiltrados.map(r => {
        const totalEntregados = r.puntos.reduce((s, p) => s + (p.entregados || 0), 0);
        const totalFrias = r.puntos.reduce((s, p) => s + (p.frias || 0), 0);
        const totalMonto = r.puntos.reduce((s, p) => {
          const neto = Math.max((p.entregados || 0) - (p.frias || 0), 0);
          return s + (neto * precioUnitario);
        }, 0);
        const fecha = r.horaInicio ? new Date(r.horaInicio).toLocaleString() : "-";

        return [
          r.usuario,
          fecha,
          r.duracionTotalMin + " min",
          totalEntregados + " kg",
          totalFrias + " kg",
          `$${totalMonto.toFixed(2)}`
        ];
      })
    });

    doc.save("Reporte_Recorridos.pdf");
  };

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    const datosFiltrados = aplicarFiltros(recorridos);
    const resumen = generarEstadisticas(datosFiltrados);
    const wsData = [
      ["Resumen de estadísticas"],
      ["Total entregas", "Total frías", "Total $", "Ticket promedio", "Duración promedio (min)"],
      [resumen.totalEntregas, resumen.totalFrias, `$${resumen.totalRecaudo.toFixed(2)}`, `$${resumen.ticketPromedio}`, resumen.duracionPromedio],
      [],
      ["Usuario", "Fecha", "Duración", "Entregas", "Frías", "Total"]
    ];

    datosFiltrados.forEach(r => {
      const puntos = r.puntos || [];
      const puntosConMonto = puntos.map(p => {
        const entregados = p.entregados || 0;
        const frias = p.frias || 0;
        const neto = Math.max(entregados - frias, 0);
        return neto * precioUnitario;
      });
      const totalEntregados = puntos.reduce((s, p) => s + (p.entregados || 0), 0);
      const totalFrias = puntos.reduce((s, p) => s + (p.frias || 0), 0);
      const totalDinero = puntosConMonto.reduce((s, m) => s + m, 0);
      const fecha = r.horaInicio ? new Date(r.horaInicio).toLocaleString() : "-";

      wsData.push([
        r.usuario,
        fecha,
        r.duracionTotalMin + " min",
        totalEntregados + " kg",
        totalFrias + " kg",
        `$${totalDinero.toFixed(2)}`
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Recorridos");
    XLSX.writeFile(wb, "Reporte_Recorridos.xlsx");
  };

  const datosFiltrados = aplicarFiltros(recorridos);
  const resumen = generarEstadisticas(datosFiltrados);

  const inputStyle = {
  padding: "0.7rem 0.9rem",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "#fff",
};

const btnPrimary = {
  background: "#3b82f6",
  color: "#fff",
  border: "none",
  padding: "0.75rem 1rem",
  borderRadius: "8px",
  cursor: "pointer",
};

const btnDark = {
  background: "#0f172a",
  color: "#fff",
  border: "none",
  padding: "0.75rem 1rem",
  borderRadius: "8px",
  cursor: "pointer",
};

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  padding: "1rem",
};

const labelStyle = {
  fontSize: "0.8rem",
  color: "#64748b",
};

const valueStyle = {
  fontSize: "1.4rem",
  fontWeight: "600",
  color: "#0f172a",
};

const tableContainer = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  padding: "1rem",
  marginTop: "1rem",
  overflowX: "auto",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
};

const th = {
  padding: "0.6rem",
  borderBottom: "1px solid #e2e8f0",
};

const td = {
  padding: "0.6rem",
  borderBottom: "1px solid #e2e8f0",
};

  return (
  <>
    <Header titulo="Centro de Análisis" usuario="admin" />

    <div style={{ width: "100%", padding: "1.5rem" }}>

      {/* SUBTÍTULO */}
      <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>
        Consulta recorridos, filtra periodos y exporta información operativa.
      </p>

      {/* FILTROS */}
      <div
        style={{
          marginBottom: "1.5rem",
          display: "flex",
          gap: "1rem",
          flexWrap: "wrap",
          alignItems: "center",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "1rem",
        }}
      >
        <input
          type="text"
          placeholder="Filtrar por usuario"
          value={filtroUsuario}
          onChange={(e) => setFiltroUsuario(e.target.value)}
          style={inputStyle}
        />

        <input
          type="date"
          value={filtroDesde}
          onChange={(e) => setFiltroDesde(e.target.value)}
          style={inputStyle}
        />

        <input
          type="date"
          value={filtroHasta}
          onChange={(e) => setFiltroHasta(e.target.value)}
          style={inputStyle}
        />

        <button onClick={exportarExcel} style={btnPrimary}>
          Exportar Excel
        </button>

        <button onClick={exportarPDF} style={btnDark}>
          Exportar PDF
        </button>
      </div>

      {/* RESUMEN */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={cardStyle}>
          <div style={labelStyle}>Total entregado</div>
          <div style={valueStyle}>{resumen.totalEntregas} kg</div>
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>No entregado</div>
          <div style={valueStyle}>{resumen.totalFrias} kg</div>
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>Ingreso generado</div>
          <div style={valueStyle}>
            ${(resumen.totalRecaudo || 0).toFixed(2)}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>Ticket promedio</div>
          <div style={valueStyle}>${resumen.ticketPromedio}</div>
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>Duración promedio</div>
          <div style={valueStyle}>{resumen.duracionPromedio} min</div>
        </div>
      </div>

      {/* MAPA */}
      {recorridoIdSeleccionado && (
        <div style={{ marginBottom: "2rem", width: "100%" }}>
          <h3 style={{ color: "#0f172a", marginTop: 0 }}>
            Mapa del recorrido
          </h3>
          <MapaRecorrido recorridoId={recorridoIdSeleccionado} />
        </div>
      )}

      {/* TABLA */}
      <h3 style={{ color: "#0f172a", marginTop: "1rem" }}>
        Recorridos registrados
      </h3>

      {loading ? (
        <p>Cargando...</p>
      ) : datosFiltrados.length === 0 ? (
        <p>No hay recorridos registrados.</p>
      ) : (
        <div style={tableContainer}>
          <table style={tableStyle}>
            <thead>
              <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                <th style={th}>Usuario</th>
                <th style={th}>Fecha</th>
                <th style={th}>Duración</th>
                <th style={th}>Entregado</th>
                <th style={th}>No entregado</th>
                <th style={th}>Total</th>
                <th style={th}>Detalle</th>
              </tr>
            </thead>

            <tbody>
              {datosFiltrados.map((r, index) => {
                const puntosConMonto = r.puntos?.map(p => {
                  const entregados = p.entregados || 0;
                  const frias = p.frias || 0;
                  const neto = Math.max(entregados - frias, 0);
                  const monto = neto * precioUnitario;
                  return { ...p, monto };
                }) || [];

                const totalEntregados = puntosConMonto.reduce((sum, p) => sum + (p.entregados || 0), 0);
                const totalFrias = puntosConMonto.reduce((sum, p) => sum + (p.frias || 0), 0);
                const totalDinero = puntosConMonto.reduce((sum, p) => sum + p.monto, 0);
                const fecha = r.horaInicio ? new Date(r.horaInicio).toLocaleString() : "-";

                return (
                  <tr key={r.id} style={{ backgroundColor: index % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                    <td style={td}>{r.usuario}</td>
                    <td style={td}>{fecha}</td>
                    <td style={td}>{r.duracionTotalMin} min</td>
                    <td style={td}>{totalEntregados} kg</td>
                    <td style={td}>{totalFrias} kg</td>
                    <td style={td}>${totalDinero.toFixed(2)}</td>

                    <td style={td}>
                      <details>
                        <summary style={{ cursor: "pointer", color: "#3b82f6" }}>
                          Ver detalle
                        </summary>

                        <ul style={{ marginTop: "0.5rem", paddingLeft: "1rem" }}>
                          {puntosConMonto.map((p, j) => (
                            <li key={j} style={{ marginBottom: "0.3rem" }}>
                              🕒 {new Date(p.hora).toLocaleTimeString()} |{" "}
                              {p.entregados}kg / {p.frias}kg | 💰 ${p.monto.toFixed(2)}
                            </li>
                          ))}
                        </ul>
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </>
);
};

export default AdminPanel;
