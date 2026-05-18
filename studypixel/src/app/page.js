'use client'

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import LoginScreen from '@/components/auth/LoginScreen';
import AdminDashboard from '@/components/dashboards/AdminDashboard';
import TeacherDashboard from '@/components/dashboards/TeacherDashboard';
import StudentDashboard from '@/components/dashboards/StudentDashboard';
import PixelBotWorkspace from '@/components/pixelbot/PixelBotWorkspace';

export default function App() {
  // WHAT: Centralizes all authentication logic and state by using the useAuth hook.
  // WHY:  This makes the hook the single source of truth. The component will now react automatically
  //       to changes in authentication state (login, logout, loading).
  const { user, login, logout, isLoading, error } = useAuth();

  // WHAT: Manages the view state *after* a user is logged in.
  // WHY:  This state is now only responsible for toggling between the dashboard and the workspace,
  //       simplifying its purpose.
  const [currentView, setCurrentView] = useState("dashboard");

  const [selectedPixelBot, setSelectedPixelBot] = useState(null);

  /**
   * WHAT: Transitions the view from a dashboard to the main learning workspace.
   */
  const handleOpenPixelBot = (pixelbot) => {
    setSelectedPixelBot(pixelbot);
    setCurrentView("workspace");
  };

  const handleBackToDashboard = () => {
    setSelectedPixelBot(null);
    setCurrentView("dashboard");
  };

  // WHAT: Displays a loading indicator while the useAuth hook is verifying the user's
  //       authentication status with Firebase on initial app load.
  // WHY:  This prevents a "flash" of the login screen for an already logged-in user and
  //       provides correct feedback that the app is starting up.
  if (isLoading) {
    return <div>Loading...</div>;
  }

  // WHAT: If the authentication check is complete and there is no user, render the LoginScreen.
  // WHY:  This is the entry point for any unauthenticated user.
  // HOW:  We pass the `login` function from the `useAuth` hook as the `onLogin` prop, and also
  //       pass the `error` state to display any login-related error messages.
  if (!user) {
    return <LoginScreen onLogin={login} error={error} />;
  }

  // If the view is "workspace" and a bot has been selected, show the workspace.
  if (currentView === "workspace" && selectedPixelBot) {
    return (
      <PixelBotWorkspace
        pixelBot={selectedPixelBot}
        user={user} // Pass the user object from the hook
        onBack={handleBackToDashboard}
      />
    );
  }

  // If the view is "dashboard", determine which specific dashboard to show based on the user's role.
  if (user.role === "admin") {
    return <AdminDashboard user={user} onLogout={logout} />;
  }
  if (user.role === "teacher") {
    return <TeacherDashboard user={user} onLogout={logout} onOpenPixelBot={handleOpenPixelBot} />;
  }
  if (user.role === "student") {
    return (
      <StudentDashboard
        user={user}
        onLogout={logout}
        onOpenPixelBot={handleOpenPixelBot}
      />
    );
  }

  // Fallback for an authenticated user with an unknown or missing role.
  return (
    <div>
      <h1>Error</h1>
      <p>Invalid user role or profile configuration.</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}