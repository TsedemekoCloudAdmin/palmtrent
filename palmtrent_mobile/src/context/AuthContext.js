// src/contexts/AuthContext.js
import React, { createContext, useState } from 'react';

// Create Auth Context
const AuthContext = createContext();

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const authContext = {
    // Sign in function
    signIn: async (userData) => {
      setIsLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setUser(userData);
      setIsLoading(false);
    },
    
    // Sign out function
    signOut: async () => {
      setIsLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      setUser(null);
      setIsLoading(false);
    },
    
    // Sign up function
    signUp: async (userData) => {
      setIsLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setUser(userData);
      setIsLoading(false);
    },
    
    // Update user profile
    updateUser: (updatedData) => {
      setUser(prev => ({ ...prev, ...updatedData }));
    },
    
    // Auth state
    isLoading,
    user,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={authContext}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;