import React, { useState, useEffect } from "react";
import Header from "../components/Header";
import MapaRecorrido from "../components/MapaRecorrido";
import { collection, getDocs, query, where, getDoc, doc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { useOutletContext } from "react-router-dom";
import useRecorridosActivos from "../hooks/useRecorridosActivos";
import useNotificacionRecorridos from "../hooks/useNotificacionRecorridos";
import { ToastContainer, toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import MapaRepartidor from "../components/MapaRepartidor";


const usuarios = [
  "camilo", "carlos", "san juan", "miramar", "comodin",
];

const AdminDashboard = () => {
  const { colapsado } = useOutletContext();
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState("");
  const [fechaSeleccionada, setFechaSeleccionada] = useState(() => new Date().toISOString().slice(0, 10));
  const [recorridos, setRecorridos] = useState([]);
  const [expandidoIndex, setExpandidoIndex] = useState(null);
  const [precioKilo, setPrecioKilo] = useState(18);
  const recorridosActivos = useRecorridosActivos();
  const [recorridoIdSeleccionado, setRecorridoIdSeleccionado] = useState(null);

  const cargarRecorridos = async (usuario, fecha = fechaSeleccionada) => {
    setUsuarioSeleccionado(usuario);
    setFechaSeleccionada(fecha);
    try {
      const q = query(collection(db, "recorridos"), where("usuario", "==", usuario));
      const snapshot = await getDocs(q);
      const filtrados = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id }))
        .filter(r => new Date(r.horaInicio).toISOString().slice(0, 10) === fecha);
      setRecorridos(filtrados);
    } catch (error) {
      console.error("❌ Error al leer recorridos:", error);
      setRecorridos([]);
    }
  };

  useEffect(() => {
    const obtenerPrecio = async () => {
      try {
        const docSnap = await getDoc(doc(db, "configuracion", "precioTortilla"));
        if (docSnap.exists()) {
          setPrecioKilo(docSnap.data().valor);
        }
      } catch (error) {
        console.error("❌ Error al obtener precio de tortilla:", error);
      }
    };
    obtenerPrecio();
  }, []);

  useNotificacionRecorridos((recorrido, id) => {
    toast.info(`🚚 ${recorrido.usuario} comenzó un nuevo recorrido`, {
      position: "bottom-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      theme: "colored"
    });
    if (usuarioSeleccionado === recorrido.usuario) cargarRecorridos(recorrido.usuario);
  });

  const fechaMinima = (() => {
    const hoy = new Date();
    hoy.setDate(hoy.getDate() - 7);
    return hoy.toISOString().slice(0, 10);
  })();

  return (
    <div>
       {/* HEADER */}
  <Header titulo="Centro de Operaciones" usuario="admin" colapsado={colapsado} />

  <ToastContainer />

  {/* CONTENIDO (IMPORTANTE: paddingTop) */}
  <div style={{ paddingLeft: "1.5rem", paddingRight: "1.5rem" }}>
    {recorridosActivos.length > 0 && (
      <div style={{
        margin: "1.5rem 0",
        padding: "1.2rem",
        backgroundColor: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
      }}>
        <div style={{
          marginBottom: "0.5rem",
          fontWeight: "600",
          color: "#0f172a"
        }}>
          Actividad en tiempo real
        </div>

        <ul style={{ paddingLeft: "1rem" }}>
          {recorridosActivos.map((r, i) => (
            <li key={i} style={{ marginBottom: "0.4rem", color: "#334155" }}>
              <span style={{ color: "#22c55e", marginRight: "6px" }}>●</span>
              <strong>{r.usuario}</strong> – {new Date(r.horaInicio).toLocaleTimeString()}

              <button
                onClick={() => setRecorridoIdSeleccionado(r.id)}
                style={{
                  marginLeft: "1rem",
                  padding: "0.3rem 0.7rem",
                  borderRadius: "6px",
                  border: "1px solid #cbd5f5",
                  background: "#f1f5f9",
                  cursor: "pointer"
                }}
              >
                Ver ruta
              </button>
            </li>
          ))}
        </ul>
      </div>
    )}

      {recorridoIdSeleccionado && (
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>🗺️ Mapa del recorrido seleccionado</h3>
            <button
              onClick={() => setRecorridoIdSeleccionado(null)}
              style={{ background: "#eee", border: "none", padding: "0.4rem 0.8rem", borderRadius: "5px", cursor: "pointer" }}
            >❌ Cerrar</button>
          </div>
          <MapaRepartidor recorridoId={recorridoIdSeleccionado} />
        </div>
      )}

      <label style={{ display: "block", marginTop: "1rem", color: "#334155" }}>
        Operador:
        <select
        value={usuarioSeleccionado}
        onChange={(e) => cargarRecorridos(e.target.value)}
        style={{
          marginLeft: "1rem",
          padding: "0.4rem 0.6rem",
          borderRadius: "6px",
          border: "1px solid #cbd5f5",
          background: "#fff"
        }}
      >
        <option value="">--Seleccionar--</option>
        {usuarios.map((u, i) => (
          <option key={i} value={u}>{u}</option>
        ))}
      </select>
      </label>

      {usuarioSeleccionado && (
        <div style={{ marginTop: "1rem" }}>
          <label>
            Selecciona la fecha:
            <input
              type="date"
              value={fechaSeleccionada}
              max={new Date().toISOString().slice(0, 10)}
              min={fechaMinima}
              onChange={(e) => cargarRecorridos(usuarioSeleccionado, e.target.value)}
              style={{ marginLeft: "1rem" }}
            />
          </label>
        </div>
      )}

      {usuarioSeleccionado && recorridos.length === 0 && (
        <p style={{ marginTop: "1rem" }}>Este usuario no tiene recorridos registrados aún.</p>
      )}

      {recorridos.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h3 style={{ marginTop: "2rem", color: "#0f172a" }}>
            Rutas del operador
          </h3>
          {recorridos.map((r, i) => (
            <div
              key={i}
              onClick={() => setExpandidoIndex(i)}
              style={{
                cursor: "pointer",
                marginBottom: "1rem",
                padding: "1rem",
                borderRadius: "12px",
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                boxShadow: expandidoIndex === i 
                ? "0 6px 16px rgba(0,0,0,0.08)" 
                : "0 1px 3px rgba(0,0,0,0.04)",
                transition: "all 0.3s ease",
              }}
            >
              <h4 style={{ margin: 0 }}>📌 Recorrido #{i + 1}</h4>
              <p style={{ margin: 0, fontSize: "0.9rem", color: "#555" }}>
                🗓 {new Date(r.horaInicio).toLocaleDateString()} • ⏱ {r.duracionTotalMin} min • 🚚 {r.puntos.length} entregas
              </p>
            </div>
          ))}

          {typeof expandidoIndex === "number" && recorridos[expandidoIndex] && (
            <div style={{
              marginTop: "1.5rem",
              padding: "2rem",
              border: "1px solid #ccc",
              borderRadius: "10px",
              backgroundColor: "#fff",
              boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
            }}>
              <button onClick={() => setExpandidoIndex(null)} style={{
                float: "right", background: "#eee", border: "none", padding: "0.3rem 0.6rem", borderRadius: "5px"
              }}>❌ Cerrar</button>

              <h3 style={{ color: "#0f172a" }}>
                Detalle de la ruta
              </h3>
              <p><strong>Inicio:</strong> {new Date(recorridos[expandidoIndex].horaInicio).toLocaleString()}</p>
              <p><strong>Fin:</strong> {new Date(recorridos[expandidoIndex].horaFin).toLocaleString()}</p>
              <p><strong>Duración total:</strong> {recorridos[expandidoIndex].duracionTotalMin} minutos</p>

              <div style={{ marginTop: "1rem" }}>
                <h4>🚚 Entregas realizadas:</h4>
                <div style={{ overflowX: "auto" }}>
                  <table style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    marginTop: "1rem",
                    fontSize: "0.9rem"
                  }}>
                    <thead>
                      <tr style={{ backgroundColor: "#f8fafc", textAlign: "left" }}>
                        <th style={{ padding: "0.5rem", border: "1px solid #ddd" }}>Hora</th>
                        <th style={{ padding: "0.5rem", border: "1px solid #ddd" }}>Entregado</th>
                        <th style={{ padding: "0.5rem", border: "1px solid #ddd" }}>Recibido</th>
                        <th style={{ padding: "0.5rem", border: "1px solid #ddd" }}>Total $</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recorridos[expandidoIndex].puntos.map((p, j) => {
                        const netoKg = Math.max((p.entregados || 0) - (p.frias || 0), 0);
                        const monto = netoKg * precioKilo;
                        return (
                          <tr key={j} style={{ backgroundColor: j % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                            <td style={{ padding: "0.5rem", border: "1px solid #ddd" }}>
                              🕒 {new Date(p.hora).toLocaleTimeString()}
                            </td>
                            <td style={{ padding: "0.5rem", border: "1px solid #ddd" }}>{p.entregados}</td>
                            <td style={{ padding: "0.5rem", border: "1px solid #ddd" }}>{p.frias}</td>
                            <td style={{ padding: "0.5rem", border: "1px solid #ddd" }}>${monto.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: "1rem", textAlign: "right", fontWeight: "bold", color: "#16a34a", fontSize: "1rem" }}>
                  💰 Total recaudado: $
                  {recorridos[expandidoIndex].puntos.reduce(
                    (sum, p) => sum + Math.max((p.entregados || 0) - (p.frias || 0), 0) * precioKilo,
                    0
                  ).toFixed(2)}
                </div>
              </div>

              <div style={{ height: "500px", marginTop: "2rem", width: "100%" }}>
                <MapaRecorrido recorridoId={recorridos[expandidoIndex].id} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
    </div>
  );
};

export default AdminDashboard;
