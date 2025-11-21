import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../services/apiService'; // Import the service directly

// Create Auth Context
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load user on app start
  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      setIsLoading(true);
      const response = await apiService.getCurrentUser();
      if (response.success) {
        setUser(response.data.user);
      }
    } catch (error) {
      console.error('Error loading user:', error);
      await logout();
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (credentials) => {
    setIsLoading(true);
    try {
      const response = await apiService.login(credentials);
      if (response.success) {
        await apiService.setToken(response.data.token);
        setUser(response.data.user);
        return response.data.user;
      }
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (userData) => {
    setIsLoading(true);
    try {
      const response = await apiService.register(userData);
      if (response.success) {
        await apiService.setToken(response.data.token);
        setUser(response.data.user);
        return response.data.user;
      }
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const sendOTP = async (phone) => {
    setIsLoading(true);
    try {
      const response = await apiService.sendVerificationCode(phone);
      if (response.success) {
        return response;
      }
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOTP = async (phone, code) => {
    setIsLoading(true);
    try {
      const response = await apiService.verifyCode(phone, code);
      if (response.success) {
        return response;
      }
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const forgotPassword = async (email) => {
    setIsLoading(true);
    try {
      const response = await apiService.forgotPassword(email);
      if (response.success) {
        return response;
      }
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await apiService.removeToken();
    setUser(null);
  };

  const updateUser = (updatedData) => {
    setUser(prev => ({ ...prev, ...updatedData }));
  };

  const authContextValue = {
    user,
    isLoading,
    isAuthenticated: !!user,
    signIn,
    signUp,
    sendOTP,
    verifyOTP,
    forgotPassword,
    logout,
    updateUser,
    loadUser
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;