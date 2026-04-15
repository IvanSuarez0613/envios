import React from "react";
import { FiMenu } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/authContext";
import "../styles/sidebar.css";

const Sidebar = ({ colapsado, setColapsado }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const irAConfiguracion = () => navigate("/configuracion");
  const irADashboard = () => navigate("/admin");
  const irAReportes = () => navigate("/admin-panel");
  const irARuta = () => navigate("/ruta");
 const irAConsultarTiendas = () => navigate("/admin/tiendas");


  const isAdmin = user?.role === "admin";

  return (
    <div
      className="sidebar-container"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: "100vh",
        width: colapsado ? "60px" : "220px",
        backgroundColor: "#0f172a",
        color: "#e2e8f0",
        transition: "width 0.3s ease",
        zIndex: 1001,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: colapsado ? "center" : "flex-start",
        paddingTop: "1rem",
      }}
    >
      {/* LOGO */}
      <div
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "center",
          marginBottom: "1rem",
        }}
      >
        <img
          src="/img/Entregas2.png"
          alt="Logo"
          style={{
            width: colapsado ? "40px" : "80px",
            borderRadius: "50%",
            transition: "width 0.3s ease",
          }}
        />
      </div>

      {/* Botón hamburguesa (siempre visible en móviles) */}
      <div
        onClick={() => setColapsado(!colapsado)}
        style={{
          padding: "0.5rem",
          marginLeft: colapsado ? 0 : "1rem",
          cursor: "pointer",
          color: "#fff",
          alignSelf: colapsado ? "center" : "flex-start",
        }}
        className="menu-toggle"
      >
        <FiMenu size={24} />
      </div>

      {/* Menú */}
      <div
        style={{
          marginTop: "1rem",
          paddingLeft: colapsado ? 0 : "1rem",
          width: "100%",
        }}
      >
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            width: "100%",
          }}
        >
          {isAdmin && (
            <>
              <li style={menuItemStyle} onClick={irADashboard}>
                <span role="img" aria-label="dashboard">📊</span>
                {!colapsado && <span style={textStyle}>Tablero Principal</span>}
              </li>
              <li style={menuItemStyle} onClick={irAReportes}>
                <span role="img" aria-label="reportes">📈</span>
                {!colapsado && <span style={textStyle}>Reportes</span>}
              </li>
              <li style={menuItemStyle} onClick={irAConfiguracion}>
                <span role="img" aria-label="config">⚙️</span>
                {!colapsado && <span style={textStyle}>Configuración</span>}
              </li>
              <li style={menuItemStyle} onClick={() => navigate("/admin/rutas-comodin")}>
                <span role="img" aria-label="asignar">🧩</span>
                {!colapsado && <span style={textStyle}>Asignar Ruta</span>}
              </li>
              <li style={menuItemStyle} onClick={irAConsultarTiendas}>
              <span role="img" aria-label="tiendas">🏪</span>
              {!colapsado && <span style={textStyle}>Consultar tiendas</span>}
             </li>

            </>
          )}
          
          <li onClick={handleLogout} style={{ ...menuItemStyle, color: "#ff8a80" }}>
            <span role="img" aria-label="salir">🚪</span>
            {!colapsado && <span style={textStyle}>Salir</span>}
          </li>
        </ul>
      </div>
    </div>
  );
};

const menuItemStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  marginBottom: "0.5rem",
  cursor: "pointer",
  padding: "0.6rem 1rem",
  transition: "all 0.2s ease",
  borderRadius: "8px",
  width: "100%",
  whiteSpace: "nowrap",
};

const textStyle = {
  fontSize: "1rem",
};

export default Sidebar;
