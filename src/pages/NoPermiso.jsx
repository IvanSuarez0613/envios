import React from "react";
import { useNavigate } from "react-router-dom";
import "./NoPermiso.css"; // Asegúrate de crear este archivo también

const NoPermiso = () => {
  const navigate = useNavigate();

  return (
    <div className="no-permiso-container">
      <div className="no-permiso-card">
        <h1>⛔ Acceso Denegado</h1>
        <p>No tienes permiso para acceder a esta sección.</p>
        <button onClick={() => navigate("/")}>Volver al inicio</button>
      </div>
    </div>
  );
};

export default NoPermiso;
