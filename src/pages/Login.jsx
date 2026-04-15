// src/pages/Login.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../auth/authContext";
import { useNavigate } from "react-router-dom";
import { users } from "../auth/users"; // 👈 IMPORTANTE
import "../styles/Login.css";

const Login = () => {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await login(usuario, clave); // ✅ ahora sí espera
  
    if (success) {
      const userData = users.find(u => u.username === usuario && u.password === clave);
      if (userData?.username === "comodin") navigate("/ruta-comodin");
      else if (userData?.role === "admin") navigate("/admin");
      else if (userData?.role === "user") navigate("/ruta");
      else navigate("/no-permiso");
          
    } else {
      setError("Credenciales incorrectas");
    }
  };
  

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-image" />
        <form onSubmit={handleSubmit} className="login-form">
          <h2>Bienvenido</h2>
          <p className="sub">Accede a tu ruta diaria</p>

          <input
            type="text"
            placeholder="Usuario"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            required
          />
          {error && <p className="error">{error}</p>}
          <button type="submit">Entrar</button>
        </form>
      </div>
    </div>
  );
};

export default Login;
