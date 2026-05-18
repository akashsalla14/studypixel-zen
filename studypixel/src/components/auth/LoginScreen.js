/**
 * @fileoverview LoginScreen component - Authentication entry point
 * 
 * What: Role-based login interface for StudyPixel-GPT platform
 * 
 * Why: Provides secure authentication for three user roles (Student, Teacher, Admin)
 * with role-specific UI and credential validation. Uses mock authentication for demo
 * purposes, designed to be easily replaced with real auth service.
 * 
 * How: 
 * - Displays role selector toggle (Student/Teacher/Admin)
 * - Email/password input fields with validation
 * - Validates credentials against mock user database
 * - Calls onLogin callback with authenticated user object
 * - Shows demo credentials for easy testing
 * 
 * Component Props:
 * @param {Function} onLogin - Callback function called with user object on successful login
 * 
 * State Management:
 * - email: Current email input value
 * - password: Current password input value
 * - role: Selected user role (student/teacher/admin)
 * - error: Error message for failed login attempts
 * 
 * CSS Dependencies:
 * - .login-container, .login-card - Layout containers
 * - .brand, .brand__dot, .brand__title - Branding elements
 * - .role-toggle, .role-btn - Role selection UI
 * - .form-group, .login-btn - Form elements
 * - .error-message, .demo-credentials - Feedback UI
 * 
 * Integration: Used in main App component for authentication flow
 */

'use client'
import { useState } from 'react';
import { sendPasswordResetLink } from '@/lib/dataService';

/**
 * LoginScreen Component
 * 
 * Renders authentication interface with role-based login.
 * Validates against mockUsers data and calls onLogin on success.
 */
function LoginScreen({ onLogin, error, isLoading }) {
  // Local state for form inputs
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [resetMessage, setResetMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  /**
   * Handle login form submission
   * 
   * Calls the onLogin prop (from useAuth hook) with the form credentials.
   * 
   * @param {Event} e - Form submit event
   */
  const handleLogin = async (e) => {
    e.preventDefault();
    // The onLogin prop is expected to be the `login` function from the `useAuth` hook,
    // which handles the async logic, state updates, and error handling.
    await onLogin(email, password, role);
  };
  const handleForgotPassword = async () => {
    if (!email) {
      setResetMessage("Please enter your email address first.");
      return;
    }
    try {
      setResetMessage("Sending reset link...");
      const result = await sendPasswordResetLink(email);
      setResetMessage(result.message || "Reset link sent.");
    } catch (err) {
      setResetMessage("Failed to send reset link. Please check the email.");
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="brand">
            <span className="brand__dot"></span>
            <h1 className="brand__title">StudyPixel</h1>
          </div>
          <p className="login-subtitle">Adaptive Learning Operating System</p>
        </div>
        
        <form className="login-form" onSubmit={handleLogin}>
          {/* Role selection toggle - three buttons for role switching */}
          <div className="role-toggle">
            <button
              type="button"
              className={role === "student" ? "role-btn active" : "role-btn"}
              onClick={() => setRole("student")}
            >
              Student
            </button>
            <button
              type="button"
              className={role === "teacher" ? "role-btn active" : "role-btn"}
              onClick={() => setRole("teacher")}
            >
              Teacher
            </button>
            <button
              type="button"
              className={role === "admin" ? "role-btn active" : "role-btn"}
              onClick={() => setRole("admin")}
            >
              Admin
            </button>
          </div>
          
          {/* Email input field */}
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>
          
          {/* Password input field */}
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                style={{ width: '100%', paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: 'var(--apple-text-muted)'
                }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          
          {/* Error message display (shown only when error exists) */}
          {error && <div className="error-message">{error}</div>}
          {resetMessage && <div className="success-message" style={{textAlign: 'center', fontSize: '13px', marginTop: '8px'}}>{resetMessage}</div>}
          
          {/* Submit button */}
          <button type="submit" className="login-btn" disabled={isLoading}>
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
          
          <button 
            type="button" 
            className="role-btn" 
            style={{ marginTop: '10px', fontSize: '12px', background: 'transparent', border: 'none', color: 'var(--apple-text-muted)', textDecoration: 'underline' }}
            onClick={handleForgotPassword}
          >
            Forgot Password?
          </button>

          {/* Demo credentials helper - shows test accounts (dev only) */}
          {process.env.NODE_ENV === 'development' ? (
            <div className="demo-credentials">
              <p><strong>Demo Credentials:</strong></p>
              <p>Teacher: testTeacherThree@gmail.com / testtest123</p>
              <p>Student: ravi@gmail.com / ravione</p>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}

export default LoginScreen;