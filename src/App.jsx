import React from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";

import Login from "./pages/Login";
import Ruta from "./pages/Ruta";
import AdminDashboard from "./pages/AdminDashboard";
import Redirect from "./pages/Redirect";
import Configuracion from "./pages/ConfiguracionAdmin";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminLayout from "./layouts/AdminLayout";
import NoPermiso from "./pages/NoPermiso";
import AdminPanel from "./pages/AdminPanel";
import RutasComodin from "./pages/RutasComodin";
import RutaComodin from "./pages/RutaComodin";
import ConsultarTiendas from "./pages/ConsultarTiendas";

import "leaflet/dist/leaflet.css";

// Rutas protegidas para admin con layout
const ProtectedAdminLayout = () => (
  <ProtectedRoute role="admin">
    <AdminLayout />
  </ProtectedRoute>
);

// Rutas protegidas para usuario
const ProtectedUserLayout = () => (
  <ProtectedRoute role="user">
    <Outlet />
  </ProtectedRoute>
);

const App = () => (
  <Routes>
  <Route path="/" element={<Login />} />
  <Route path="/redirect" element={<Redirect />} />
  <Route path="/no-permiso" element={<NoPermiso />} />

  {/* Rutas protegidas para USER */}
  <Route element={<ProtectedRoute role="user" />}>
    <Route path="/ruta" element={<Ruta />} />
    <Route path="/ruta-comodin" element={<RutaComodin />} />
  </Route>

  {/* Rutas protegidas para ADMIN con layout */}
  <Route element={<ProtectedRoute role="admin" />}>
    <Route element={<AdminLayout />}>
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin-panel" element={<AdminPanel />} />
      <Route path="/configuracion" element={<Configuracion />} />
      <Route path="/admin/rutas-comodin" element={<RutasComodin />} />
      <Route path="/admin/tiendas" element={<ConsultarTiendas />} />
      </Route>
  </Route>

  <Route path="*" element={<Navigate to="/" />} />
</Routes>

);

export default App;
