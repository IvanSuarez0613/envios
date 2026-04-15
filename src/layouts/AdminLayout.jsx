import React, { useState } from "react";
import Sidebar from "../components/Sidebar";
import { Outlet } from "react-router-dom";

const AdminLayout = () => {
  const [colapsado, setColapsado] = useState(false);

  return (
    <div style={{ display: "flex" }}>
      <Sidebar colapsado={colapsado} setColapsado={setColapsado} />
      
      <div
        style={{
          flex: 1,
          marginLeft: colapsado ? "60px" : "220px",
          padding: "2rem",
          paddingTop: "80px", // espacio para el header fijo
          transition: "margin-left 0.3s ease",
          minHeight: "100vh",
          backgroundColor: "#f9f9f9",
        }}
      >
        <Outlet context={{ colapsado }} />
      </div>
    </div>
  );
};

export default AdminLayout;
