const API_BASE_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:8000/api';

interface SignupPayload {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

interface OtpVerificationPayload {
  phone?: string;
  email?: string;
  otp: string;
}

interface EmailOtpVerificationPayload {
  phone: string;
  email: string;
  otp: string;
}

interface LoginPayload {
  phone?: string;
  email?: string;
  password: string;
}

interface GenericAuthResponse {
  message?: string;
  accessToken?: string;
  refreshToken?: string;
  user?: {
    fullName: string;
    email: string;
    phone: string;
    role?: string;
  };
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    fullName: string;
    email: string;
    phone: string;
  };
}

export const authService = {
  // Signup endpoint - sends OTP to phone
  signup: async (data: SignupPayload): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Signup failed');
    }

    return response.json();
  },

  // Verify OTP for signup
  verifySignupOtp: async (data: OtpVerificationPayload): Promise<AuthResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'OTP verification failed');
    }

    return response.json();
  },

  // Login endpoint - sends OTP to phone
  login: async (data: LoginPayload): Promise<GenericAuthResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    return response.json();
  },

  // Verify OTP for login (email OTP for users)
  verifyLoginOtp: async (data: OtpVerificationPayload): Promise<AuthResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/verify-login-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'OTP verification failed');
    }

    return response.json();
  },

  // NEW: Verify email OTP during signup and create user
  verifyEmailOtp: async (data: EmailOtpVerificationPayload): Promise<AuthResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/verify-email-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Email OTP verification failed');
    }

    return response.json();
  },

  // NEW: Resend email OTP during signup (Gmail verification only - no phone verification required)
  resendEmailOtp: async (data: { phone: string; email: string }): Promise<GenericAuthResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/resend-email-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to resend email OTP');
    }

    return response.json();
  },

  // Token management
  setTokens: (accessToken: string, refreshToken: string) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  },

  // Refresh access token
  refreshAccessToken: async (): Promise<{ accessToken: string }> => {
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        const error = await response.json();
        // If refresh token is expired, clear tokens and redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userData');
        localStorage.removeItem('userType');
        throw new Error(error.message || 'Token refresh failed');
      }

      const data = await response.json();
      localStorage.setItem('accessToken', data.accessToken);
      return { accessToken: data.accessToken };
    } catch (error) {
      // Clear tokens on refresh failure
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userData');
      localStorage.removeItem('userType');
      throw error;
    }
  },

  getAccessToken: (): string | null => {
    return localStorage.getItem('accessToken');
  },

  getRefreshToken: (): string | null => {
    return localStorage.getItem('refreshToken');
  },

  clearTokens: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userType');
    localStorage.removeItem('userData');
  },

  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('accessToken');
  },
};
