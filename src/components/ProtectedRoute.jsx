import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/authContext";

const ProtectedRoute = ({ role }) => {
  const { user, cargando } = useAuth();

  if (cargando) return <div>Cargando...</div>; // 👈 esperar autenticación

  if (!user) return <Navigate to="/" />;

  const userRole = user.role || "admin"; // 👈 simular admin en desarrollo

  if (role && userRole !== role) return <Navigate to="/no-permiso" />;

  return <Outlet />;
};

export default ProtectedRoute;
