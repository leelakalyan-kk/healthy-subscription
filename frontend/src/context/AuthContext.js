import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('active_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const loginUser = (userData, token) => {
    setCurrentUser(userData);
    localStorage.setItem('active_user', JSON.stringify(userData));
    if (token) localStorage.setItem('token', token);
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('active_user');
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser, loginUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
