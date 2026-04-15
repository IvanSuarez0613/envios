import React from "react";

const Header = ({ titulo, usuario, colapsado }) => {
  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: colapsado ? "60px" : "220px",
        right: 0,
        height: "60px",
        backgroundColor: "#fff",
        borderBottom: "1px solid #e2e8f0",
        display: "flex",
        alignItems: "center",
        padding: "0 1.5rem",
        justifyContent: "space-between",
        zIndex: 1000,
        transition: "left 0.3s ease"
      }}
    >
      <h2 style={{ margin: 0 }}>{titulo}</h2>
      <span style={{ fontSize: "0.9rem", color: "#64748b" }}>
        👤 {usuario || "Usuario"}
      </span>
    </header>
  );
};

export default Header;