import React, { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import Header from "../components/Header";

const Configuracion = () => {
  const [precio, setPrecio] = useState("");

  useEffect(() => {
    const fetchPrecio = async () => {
      const docRef = doc(db, "configuracion", "precioTortilla");
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        setPrecio(snap.data().valor.toString());
      } else {
        setPrecio("18");
      }
    };

    fetchPrecio();
  }, []);

  const guardarPrecio = async () => {
    try {
      await setDoc(doc(db, "configuracion", "precioTortilla"), {
        valor: parseFloat(precio),
      });
      alert("Precio actualizado correctamente");
    } catch (error) {
      console.error(error);
      alert("Error al guardar");
    }
  };

  return (
    <>
      <Header titulo="Centro de Configuración" usuario="admin" />

     <div
        style={{
          padding: "1.5rem",
          paddingTop: "0.1rem" 
        }}
      >
        {/* SUBTÍTULO */}
        <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>
          Administra parámetros operativos del sistema.
        </p>

        {/* GRID */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {/* 💰 PRECIO */}
          <div style={cardStyle}>
            <div style={labelStyle}>Precio por unidad</div>

            <div style={valueStyle}>
              ${precio || 0} MXN
            </div>

            <input
              type="number"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              step="0.01"
              style={inputStyle}
            />

            <button onClick={guardarPrecio} style={btnPrimary}>
              Guardar cambio
            </button>
          </div>

          {/* ⚙️ OPERACIÓN (visual, no funcional aún) */}
          <div style={cardStyle}>
            <div style={labelStyle}>Modo de operación</div>

            <select style={inputStyle}>
              <option>Entrega estándar</option>
              <option>Entrega rápida</option>
            </select>

            <span style={helperStyle}>
              Define cómo se gestionan las rutas.
            </span>
          </div>

          {/* ⏱ TIEMPOS */}
          <div style={cardStyle}>
            <div style={labelStyle}>Duración máxima por ruta</div>

            <input
              type="number"
              placeholder="Minutos"
              style={inputStyle}
            />

            <span style={helperStyle}>
              Controla tiempos operativos.
            </span>
          </div>

          {/* 💱 MONEDA */}
          <div style={cardStyle}>
            <div style={labelStyle}>Moneda</div>

            <select style={inputStyle}>
              <option>MXN</option>
              <option>USD</option>
            </select>

            <span style={helperStyle}>
              Configuración para reportes.
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export default Configuracion;

/* ===== ESTILOS ===== */

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  padding: "1.2rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.6rem",
};

const labelStyle = {
  fontSize: "0.85rem",
  color: "#64748b",
};

const valueStyle = {
  fontSize: "1.6rem",
  fontWeight: "600",
  color: "#0f172a",
};

const inputStyle = {
  padding: "0.7rem",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
};

const btnPrimary = {
  background: "#3b82f6",
  color: "#fff",
  border: "none",
  padding: "0.7rem",
  borderRadius: "8px",
  cursor: "pointer",
};

const helperStyle = {
  fontSize: "0.75rem",
  color: "#94a3b8",
};