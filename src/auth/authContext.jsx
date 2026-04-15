import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInAnonymously, signOut } from "firebase/auth";
import { auth } from "../firebaseConfig";
import { users } from "./users";

// Export nombrado para uso directo si se requiere
export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (usuarioFirebase) => {
      if (usuarioFirebase) {
        // Usuario anónimo por defecto (fallback)
        setUser({ ...usuarioFirebase, role: "admin", uid: usuarioFirebase.uid });
      } else {
        await signInAnonymously(auth);
      }
      setCargando(false);
    });

    return () => unsubscribe();
  }, []);

  const login = (usuario, clave) => {
    const userData = users.find(
      (u) => u.username === usuario && u.password === clave
    );

    if (userData) {
      // Garantiza que tenga un UID definido
      const finalUser = {
        ...userData,
        uid: userData.uid || userData.username, // si no hay uid, usa username como fallback
      };

      setUser(finalUser);
      return true;
    }
    return false;
  };

  const logout = async () => {
    try {
      await signOut(auth);   // Cierra sesión Firebase
      setUser(null);
    } catch (err) {
      console.error("❌ Error al cerrar sesión:", err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, cargando, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook personalizado para acceder al contexto
export const useAuth = () => useContext(AuthContext);
