# Frontend Authentication Integration Guide

## Overview
This document explains how the frontend authentication has been integrated with the backend API.

## Authentication Flow

### 1. User Signup Flow
1. User enters fullName, email, phone, and password on LoginPage
2. Frontend sends POST request to `/api/auth/signup`
3. Backend validates and creates user, sends OTP to phone
4. Frontend shows OTP verification screen
5. User enters OTP
6. Frontend sends POST request to `/api/auth/verify-otp`
7. Backend verifies OTP, marks user as onboarded, returns accessToken and refreshToken
8. Frontend stores tokens and redirects to `/apply-loan`

### 2. User Login Flow
1. User enters phone and password on LoginPage
2. Frontend sends POST request to `/api/auth/login`
3. Backend validates credentials, sends OTP to phone
4. Frontend shows OTP verification screen
5. User enters OTP
6. Frontend sends POST request to `/api/auth/verify-login-otp`
7. Backend verifies OTP, returns accessToken and refreshToken
8. Frontend stores tokens and redirects to `/apply-loan`

### 3. Admin Login Flow
1. Admin selects "ADMIN" toggle on LoginPage
2. Frontend directly redirects to `/admin` (no authentication required for demo)
3. Admin can access admin dashboard

## Frontend Structure

### Services
- **authService.ts**: Handles all authentication API calls
  - `signup()`: Create new user account
  - `verifySignupOtp()`: Verify OTP after signup
  - `login()`: Login with credentials
  - `verifyLoginOtp()`: Verify OTP after login
  - Token management methods

- **apiClient.ts**: Utility for making authenticated API requests
  - Automatically adds Bearer token to all requests
  - Handles 401 unauthorized responses
  - Provides fetch-like API: `get()`, `post()`, `put()`, `patch()`, `delete()`

### Contexts
- **AuthContext.tsx**: Global authentication state
  - `useAuth()` hook to access auth state in components
  - Provides `isAuthenticated`, `user`, `userType`, and `logout()` function

### Components
- **LoginPage.tsx**: Main authentication page
  - Handles signup and login flows
  - Shows OTP verification when needed
  - Stores tokens after successful authentication

- **ProtectedRoute.tsx**: Component to protect routes
  - Redirects unauthenticated users to login
  - Can enforce role-based access (user vs admin)

## Configuration

### Environment Variables
Create a `.env` file in the frontend directory:

```
VITE_API_URL=http://localhost:8000/api
```

For production, update to your production API URL.

## Token Management

### Storage
- Access token stored in `localStorage` as `accessToken`
- Refresh token stored in `localStorage` as `refreshToken`
- User data stored in `localStorage` as `userData` (JSON string)

### Usage in Components
```typescript
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const { isAuthenticated, user, userType, logout } = useAuth();
  
  if (!isAuthenticated) {
    return <div>Please login</div>;
  }
  
  return <div>Welcome {user?.fullName}</div>;
}
```

### Making Authenticated Requests
```typescript
import { apiClient } from '../services/apiClient';

// GET request
const response = await apiClient.get('/api/user/profile');

// POST request
const response = await apiClient.post('/api/user/loans', { amount: 5000 });
```

## Error Handling

All API responses are validated. Errors include:
- Network errors
- Server errors (500)
- Validation errors (400)
- Unauthorized (401) - triggers logout
- Not found (404)

Errors are displayed in the LoginPage UI and reported to the user.

## Security Notes

1. **Token Storage**: Tokens are stored in localStorage, which is vulnerable to XSS attacks.
   - **Consider** using HttpOnly cookies for production
   - Ensure CSP headers are properly configured

2. **CORS**: Make sure backend enables CORS for frontend origin
   - Development: `http://localhost:5173`
   - Production: Your frontend domain

3. **HTTPS**: Always use HTTPS in production

4. **Token Expiration**: Implement token refresh mechanism
   - Currently, if token expires, user is redirected to login
   - Consider adding a refresh token endpoint for seamless UX

## Backend Routes Required

The following backend endpoints are required and must be configured:

```
POST   /api/auth/signup            - Create user account
POST   /api/auth/verify-otp        - Verify OTP for signup
POST   /api/auth/login             - Login with credentials
POST   /api/auth/verify-login-otp  - Verify OTP for login
```

See [authController.js](../../backend/src/controllers/authController.js) for implementation details.

## Testing

### Manual Testing Steps
1. Start backend: `npm run dev` (from backend directory)
2. Start frontend: `npm run dev` (from frontend directory)
3. Navigate to `http://localhost:5173`
4. Test signup flow with valid phone number
5. Test login flow with registered phone number
6. Test OTP verification
7. Verify tokens are stored and user is logged in

### API Testing
Use Postman or curl to test endpoints:

```bash
# Signup
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "John Doe",
    "email": "john@example.com",
    "phone": "+919876543210",
    "password": "password123"
  }'

# Verify OTP (replace with actual OTP)
curl -X POST http://localhost:8000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919876543210",
    "otp": "123456"
  }'
```

## Route Protection

Protected routes should be wrapped with `ProtectedRoute`:

```typescript
// In routes.tsx
import { ProtectedRoute } from './components/ProtectedRoute';

{
  path: "/apply-loan",
  Component: () => (
    <ProtectedRoute requiredRole="user">
      <ApplyLoanPage />
    </ProtectedRoute>
  ),
}
```

## Troubleshooting

### Issue: "API_BASE_URL is undefined"
- Check that `.env` file exists with `VITE_API_URL` variable
- Restart frontend dev server after creating `.env`

### Issue: CORS errors
- Check backend `cors` configuration includes your frontend origin
- Verify backend is running on correct port (8000)

### Issue: Tokens not being stored
- Check browser DevTools > Application > Local Storage
- Verify API response includes `accessToken` and `refreshToken`
- Check for network errors in console

### Issue: Unauthorized redirects to login
- Token may have expired
- Check token value in localStorage
- Verify backend is validating tokens correctly

## Future Improvements

1. **Token Refresh**: Implement automatic token refresh before expiration
2. **Session Persistence**: Keep user logged in across browser sessions
3. **Multi-device Login**: Handle multiple concurrent sessions
4. **OAuth Integration**: Add social login support
5. **2FA**: Enhance security with two-factor authentication
6. **Rate Limiting**: Implement rate limiting for auth endpoints
7. **Audit Logging**: Log all authentication events on backend
