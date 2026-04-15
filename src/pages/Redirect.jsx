import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/authContext";

const Redirect = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" />;
  return user.role === "admin" ? <Navigate to="/admin" /> : <Navigate to="/ruta" />;
};

export default Redirect;
