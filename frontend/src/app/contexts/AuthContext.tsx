import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

interface User {
  fullName: string;
  email: string;
  phone: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  userType: 'user' | 'admin' | null;
  isLoading: boolean;
  login: (user: User | null, userType: 'user' | 'admin') => void;
  setUserType: (type: 'user' | 'admin' | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const ADMIN_COPILOT_CHAT_KEY = 'adminCopilotChatMessages';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userType, setUserType] = useState<'user' | 'admin' | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is authenticated on mount
    const token = authService.getAccessToken();
    const storedUserType = localStorage.getItem('userType') as 'user' | 'admin' | null;
    const storedUserData = localStorage.getItem('userData');

    if (token) {
      setIsAuthenticated(true);
      if (storedUserData) {
        try {
          setUser(JSON.parse(storedUserData));
        } catch (e) {
          console.error('Failed to parse user data', e);
        }
      }
    }

    if (storedUserType) {
      setUserType(storedUserType);
      if (storedUserType === 'admin') {
        setIsAuthenticated(true); // Admin uses simplified auth in this app
      }
    }

    setIsLoading(false);
  }, []);

  const login = (newUser: User | null, type: 'user' | 'admin') => {
    setIsAuthenticated(true);
    setUserType(type);
    setUser(newUser);
  };

  const logout = () => {
    console.log('🚪 Logging out...');
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(ADMIN_COPILOT_CHAT_KEY);
      }
    } catch (e) {
      console.warn('Failed to clear copilot chat session cache', e);
    }
    authService.clearTokens();
    setIsAuthenticated(false);
    setUser(null);
    setUserType(null);
    console.log('🧹 State cleared, redirecting to login...');
    window.location.assign('/login'); // Use assign for better compatibility
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, userType, isLoading, login, setUserType, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
