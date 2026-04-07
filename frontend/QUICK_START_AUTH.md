# Frontend Auth Integration - Quick Start Guide

## What Was Done
The frontend has been fully integrated with the backend authentication API. The LoginPage now makes real API calls instead of just storing data locally.

## Project Structure

```
frontend/
├── src/app/
│   ├── services/
│   │   ├── authService.ts        (NEW) - Auth API calls
│   │   └── apiClient.ts          (NEW) - Authenticated HTTP client
│   ├── contexts/
│   │   └── AuthContext.tsx       (NEW) - Global auth state
│   ├── components/
│   │   ├── LoginPage.tsx         (UPDATED) - Now calls real APIs
│   │   ├── ProtectedRoute.tsx    (NEW) - Route protection
│   │   └── ...
│   └── App.tsx                   (UPDATED) - Added AuthProvider
├── .env                          (NEW) - Environment config
├── .env.example                  (NEW) - Example env
└── AUTH_INTEGRATION.md           (NEW) - Full documentation
```

## How to Test

### 1. Setup Backend
```bash
cd backend
npm install
npm run dev
# Backend should run on http://localhost:8000
```

### 2. Setup Frontend
```bash
cd frontend
npm install
npm run dev
# Frontend should run on http://localhost:5173
```

### 3. Test Signup
1. Go to http://localhost:5173
2. Click "Create Account"
3. Fill in: Full Name, Mobile, Email, Password
4. Click "Proceed to OTP Verification"
5. You should see an OTP input (check backend console or logs for OTP value)
6. Enter OTP and click "SUBMIT"
7. If successful, you'll be redirected to /apply-loan

### 4. Test Login
1. Go to http://localhost:5173
2. Keep "USER" selected (it's the default)
3. Fill in: Mobile (registered), Password
4. Click "Login with credentials"
5. You should see an OTP input
6. Enter OTP and click "SUBMIT"
7. If successful, you'll be redirected to /apply-loan

### 5. Test Admin Login
1. Go to http://localhost:5173
2. Toggle to "ADMIN"
3. Directly redirects to /admin (no OTP required)

## Key Features

 **Real API Integration** - All auth calls go to backend
 **Token Management** - Access tokens stored securely
 **Error Handling** - User-friendly error messages
 **Loading States** - UI shows loading during API calls
 **OTP Verification** - Two-step authentication
 **Auth Context** - Global state across components
 **Protected Routes** - Easy route protection (coming soon)

## Common Issues & Solutions

### CORS Error
**Problem**: `Access to XMLHttpRequest blocked by CORS policy`
**Solution**: 
- Ensure backend has CORS enabled
- Check `process.env.CORS_ORIGIN` is set in backend
- For development, backend should allow `http://localhost:5173`

### API Not Found (404)
**Problem**: `POST /api/auth/signup 404 Not Found`
**Solution**:
- Verify backend is running on port 8000
- Check `.env` file has correct `VITE_API_URL`
- Restart frontend dev server after Creating .env

### OTP Not Showing
**Problem**: OTP verification screen doesn't appear after credentials
**Solution**:
- Check browser console for errors
- Verify backend OTP service is working
- Check network tab in DevTools for API response

### Tokens Not Stored
**Problem**: After login, localStorage doesn't have `accessToken`
**Solution**:
- Check network response includes `accessToken` and `refreshToken`
- Verify backend is returning correct response format
- Check browser DevTools > Application > LocalStorage

## File Changes Summary

### New Files Created
- `frontend/src/app/services/authService.ts`
- `frontend/src/app/services/apiClient.ts`
- `frontend/src/app/contexts/AuthContext.tsx`
- `frontend/src/app/components/ProtectedRoute.tsx`
- `frontend/.env`
- `frontend/.env.example`
- `frontend/AUTH_INTEGRATION.md`

### Files Updated
- `frontend/src/app/components/LoginPage.tsx` - Full rewrite with API integration
- `frontend/src/app/App.tsx` - Added AuthProvider
- `backend/src/routes/auth.js` - Fixed imports and added missing routes

## API Endpoints Used

```
POST /api/auth/signup              - Create account (sends OTP)
POST /api/auth/verify-otp          - Verify OTP from signup
POST /api/auth/login               - Login with credentials (sends OTP)
POST /api/auth/verify-login-otp    - Verify OTP from login
```

## Response Format

### Signup/Login Success
```json
{
  "accessToken": "jwt_token_here",
  "refreshToken": "refresh_token_here",
  "user": {
    "fullName": "John Doe",
    "email": "john@example.com",
    "phone": "+919876543210"
  }
}
```

### Errors
```json
{
  "message": "Error message here"
}
```

## Security Notes

1. **Tokens in localStorage**: Vulnerable to XSS, consider HttpOnly cookies for production
2. **HTTPS**: Always use HTTPS in production
3. **Environment Variables**: Never commit `.env` with secrets
4. **CORS**: Restrict CORS origin to your frontend domain in production
5. **Token Expiration**: Implement refresh token flow for better security

## Next Steps

1. **Test end-to-end** with actual phone number and OTP
2. **Implement Protected Routes** - Update routes.tsx to wrap protected pages
3. **Add Logout** - Add logout button to user pages
4. **Token Refresh** - Implement automatic token refresh before expiration
5. **404 Handling** - Implement proper 404 page redirects

## Debugging

### Enable Verbose Logging
Add to authService.ts:
```typescript
console.log('API Request:', API_BASE_URL + url, method, data);
```

### Check Network Requests
1. Open DevTools (F12)
2. Go to Network tab
3. Try signup/login
4. Click on request to see response

### Check LocalStorage
1. Open DevTools (F12)
2. Go to Application tab
3. Click LocalStorage > http://localhost:5173
4. Look for `accessToken`, `refreshToken`, `userData`, `userType`

## Questions?

Refer to `AUTH_INTEGRATION.md` for detailed documentation.
