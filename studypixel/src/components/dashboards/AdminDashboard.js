/**
 * @fileoverview AdminDashboard component - System administrator control panel
 * 
 * What: Comprehensive dashboard for system administrators to manage users, monitor
 * platform analytics, and oversee the entire StudyPixel-GPT ecosystem.
 * 
 * Why: Administrators need centralized access to:
 * - User management (view all users, students, teachers)
 * - Platform-wide analytics (sessions, active PixelBots, completion rates)
 * - System health monitoring and user performance oversight
 * 
 * How:
 * - Displays tabbed interface (User Management / Platform Analytics)
 * - User Management tab: Shows user statistics, student list with performance data
 * - Analytics tab: Displays platform usage metrics and growth indicators
 * - Uses mock data for demonstration (mockUsers, mockStudents, mockPixelBots)
 * 
 * Component Props:
 * @param {Object} user - Current authenticated admin user object
 * @param {Function} onLogout - Callback to trigger logout and return to login screen
 * 
 * State Management:
 * - activeTab: Currently selected tab ("users" or "analytics")
 * - students: Array of student data (initialized from mockStudents)
 * 
 * CSS Dependencies:
 * - .dashboard, .dashboard-header, .dashboard-tabs, .dashboard-content
 * - .admin-panel, .user-stats, .stat-card, .user-list, .data-table
 * - .analytics-panel, .analytics-grid, .analytics-card
 * - .brand, .header-actions, .logout-btn, .tab-btn
 * 
 * Integration: Rendered by main App component when admin user is logged in
 */

'use client'
import { useState, useEffect, useCallback } from "react";
import { getStudents, getTeachers, createUser, updateUser, resetPassword, deleteUser } from '@/lib/dataService';

/**
 * AdminDashboard Component
 * 
 * Provides system administration interface with user management and analytics.
 * Displays comprehensive platform statistics and user oversight capabilities.
 */
function AdminDashboard({ user, onLogout }) {
  // WHAT: State to hold the list of all student users.
  // WHY:  This data is fetched from the backend and used to populate the user management table.
  const [students, setStudents] = useState([]);
  // WHAT: State to hold the list of all teacher users.
  // WHY:  Needed for the user creation form, so a new student can be assigned to a teacher.
  const [teachers, setTeachers] = useState([]);
  // WHAT: State for storing and displaying error messages to the admin.
  // WHY:  Provides clear feedback if an operation (like creating a user) fails.
  const [error, setError] = useState('');
  // WHAT: State for displaying success messages.
  // WHY:  Confirms to the admin that an action was completed successfully.
  const [success, setSuccess] = useState('');
  // WHAT: A flag to indicate when data is being fetched from the backend.
  // WHY:  Used to show a "Loading..." message in the UI, improving user experience by providing feedback during network requests.
  const [isLoading, setIsLoading] = useState(true);

  // Form state for creating a new user
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('student');
  const [assignedTeacher, setAssignedTeacher] = useState('');
  const [newUserYear, setNewUserYear] = useState('first'); // New state for student's year
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State for the edit modal
  const [editingUser, setEditingUser] = useState(null);
  const [editedName, setEditedName] = useState('');
  const [editedEmail, setEditedEmail] = useState('');
  const [editedRole, setEditedRole] = useState('student');
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [deletingUser, setDeletingUser] = useState(null); // State for delete confirmation
  const [isUpdating, setIsUpdating] = useState(false);

  // WHAT: A memoized function to fetch all necessary user data from the backend.
  // WHY:  `useCallback` ensures this function reference doesn't change on every render, which is important for dependency arrays in `useEffect`. It centralizes the data-fetching logic.
  // HOW:  It uses `Promise.all` to fetch students and teachers concurrently for better performance. It sets loading states and handles potential errors.
  const refetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch students and teachers in parallel for efficiency
      const [studentData, teacherData] = await Promise.all([
        getStudents(),
        getTeachers(),
      ]);
      setStudents(studentData);
      setTeachers(teacherData);
    } catch (err) {
      setError('Failed to fetch user data.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []); // This function is now stable and does not depend on component state.

  // WHAT: A React Effect that runs once when the component first mounts.
  // WHY:  This is the standard way to trigger an initial data fetch for a component.
  // HOW:  It calls the `refetchData` function. The dependency array `[refetchData]` ensures it only runs when the `refetchData` function itself changes (which it won't, thanks to `useCallback`).
  useEffect(() => {
    refetchData();
  }, [refetchData]);

  // WHAT: An effect to automatically select the first teacher in the dropdown once the teacher list is loaded.
  // WHY:  This provides a sensible default for the form, improving usability by preventing the admin from having to make an extra click if there's only one teacher.
  // HOW:  It runs whenever the `teachers` state changes. If the list is not empty and no teacher is currently selected, it sets the `assignedTeacher` state to the ID of the first teacher.
  useEffect(() => {
    if (teachers.length > 0 && !assignedTeacher) {
      setAssignedTeacher(teachers[0].id);
    }
  }, [teachers, assignedTeacher]);

  // WHAT: An effect to populate the edit form when a user is selected for editing.
  // WHY:  This ensures the modal is pre-filled with the user's current data.
  // HOW:  It runs whenever `editingUser` changes. If a user is selected, it updates the local state for the modal's input fields.
  useEffect(() => {
    if (editingUser) {
        setEditedName(editingUser.name);
        setEditedEmail(editingUser.email);
        setEditedRole(editingUser.role);
        setResetPasswordInput(''); // Clear password field on open
        setError('');
        setSuccess('');
    }
  }, [editingUser]);

  // WHAT: An event handler that triggers when the "Create User" form is submitted.
  // WHY:  This function orchestrates the process of validating form data and calling the secure backend function to create a new user.
  // HOW:  It prevents the default form submission, performs validation, and then calls the `createUser` function from the `dataService`. After a successful creation, it clears the form and refetches the user list to update the UI.
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    const userData = {
      name: newUserName,
      email: newUserEmail,
      password: newUserPassword,
      role: newUserRole,
      // WHAT: Initialize teacherId and year to null.
      // WHY:  This ensures the object sent to the Cloud Function has a consistent shape,
      //       preventing potential "property of undefined" errors on the backend.
      teacherId: null,
      year: null,
    };

    if (newUserRole === 'student') {
      if (!assignedTeacher) {
        setError('A teacher must be assigned to a new student.');
        setIsSubmitting(false);
        return;
      }
      userData.teacherId = assignedTeacher;
      userData.year = newUserYear; // Add year to the payload for students
    }

    try {
      const result = await createUser(userData);
      setSuccess(result.message);
      // Reset form and refetch data
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      refetchData(); // Use the stable refetch function
    } catch (err) {
      setError(err.details || 'Failed to create user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // WHAT: An event handler to save changes to an existing user.
  // WHY:  This function calls the secure backend to update user details in both Auth and Firestore.
  // HOW:  It is triggered by the "Save Changes" button in the edit modal. It calls the `updateUser` service function and handles success or error states.
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    setError('');
    setSuccess('');
    try {
        const result = await updateUser({
            uid: editingUser.id,
            name: editedName,
            email: editedEmail,
            role: editedRole,
        });
        setSuccess(result.message);
        setEditingUser(null); // Close modal on success
        refetchData(); // Refresh user list
    } catch (err) {
        setError(err.details || 'Failed to update user.');
    } finally {
        setIsUpdating(false);
    }
  };

  // WHAT: An event handler to reset a user's password.
  // WHY:  Provides a way for an admin to help a user who is locked out.
  // HOW:  It calls the `resetPassword` service function, passing the user's ID and the new temporary password.
  const handleResetPassword = async () => {
    if (!resetPasswordInput || resetPasswordInput.length < 6) {
        setError('New password must be at least 6 characters long.');
        return;
    }
    setIsUpdating(true);
    setError('');
    setSuccess('');
    try {
        const result = await resetPassword(editingUser.id, resetPasswordInput);
        setSuccess(result.message);
        setResetPasswordInput(''); // Clear field after reset
    } catch (err) {
        setError(err.details || 'Failed to reset password.');
    } finally {
        setIsUpdating(false);
    }
  };

  // WHAT: An event handler to confirm and delete a user.
  // WHY:  Provides a secure way for an admin to permanently remove a user from the system.
  // HOW:  It calls the `deleteUser` service function and handles success or error states, then refreshes the data.
  const handleConfirmDelete = async () => {
    if (!deletingUser) return;

    setIsUpdating(true); // Reuse loading state for modal actions
    setError('');
    setSuccess('');

    try {
      const result = await deleteUser(deletingUser.id);
      setSuccess(result.message);
      refetchData(); // Refresh user list
    } catch (err) {
      setError(err.details || 'Failed to delete user.');
    } finally {
      // Close modal regardless of success or failure, but after showing message
      setTimeout(() => {
        setDeletingUser(null);
        setIsUpdating(false);
      }, 2000); // Give user time to read success/error message
    }
  };

  // Combine students and teachers into a single list for the "All Users" table
  const allUsers = [...students, ...teachers];

  return (
    <div className="dashboard">
      {/* Dashboard header with branding and user info */}
      <header className="dashboard-header">
        <div className="brand">
          <span className="brand__dot"></span>
          <div>
            <h1 className="brand__title">Admin Dashboard</h1>
            <p className="brand__subtitle">System Management & Analytics</p>
          </div>
        </div>
        <div className="header-actions">
          <span className="user-name">{user.name}</span>
          <button onClick={onLogout} className="logout-btn">Logout</button>
        </div>
      </header>
      
      {/* Tab navigation buttons */}
      
      {/* Main dashboard content area */}
      <div className="dashboard-content">
        {/* User Management Tab - Shows user statistics and student list */}
          <div className="admin-panel">
            <div className="card">
              <h2>User Management</h2>
              
              {/* High-level user statistics cards */}
              <div className="user-stats">
                <div className="stat-card">
                  <h3>Total Users</h3>
                  <p className="stat-number">{students.length + teachers.length}</p>
                </div>
                <div className="stat-card">
                  <h3>Students</h3>
                  <p className="stat-number">{students.length}</p>
                </div>
                <div className="stat-card">
                  <h3>Teachers</h3>
                  <p className="stat-number">{teachers.length}</p>
                </div>
              </div>
              
              {/* Student list table with performance metrics */}
              <div className="user-list" style={{ marginTop: '2rem' }}>
                <h3>All Users</h3>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr><td colSpan="5">Loading...</td></tr>
                    ) : (
                      allUsers.map(u => (
                        <tr key={u.id}>
                          <td>{u.name}</td>
                          <td>{u.email}</td>
                          <td>
                            <span className={`role-badge ${u.role}`}>
                              {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                            </span>
                          </td>
                          <td>
                            <button className="action-btn" onClick={() => setEditingUser(u)}>Edit</button>
                            <button className="action-btn delete" onClick={() => setDeletingUser(u)}>Delete</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Create New User Form */}
            <div className="card" style={{ marginTop: '2rem' }}>
              <h2>Create New User</h2>
              <form className="create-user-form" onSubmit={handleCreateUser}>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="new-name">Full Name</label>
                    <input id="new-name" type="text" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} required autoComplete="off" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="new-email">Email</label>
                    <input id="new-email" type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} required autoComplete="off" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="new-password">Password</label>
                    <input id="new-password" type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} required autoComplete="new-password" />
                  </div>
                  <div className="form-group">
                    <label htmlFor="new-role">Role</label>
                    <select id="new-role" value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)}>
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  {newUserRole === 'student' && (
                    <>
                      <div className="form-group">
                        <label htmlFor="assign-teacher">Assign to Teacher</label>
                        <select id="assign-teacher" value={assignedTeacher} onChange={(e) => setAssignedTeacher(e.target.value)} required>
                          {teachers.length === 0 && !isLoading && (<option value="" disabled>No teachers found. Create one first.</option>)}
                          {teachers.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label htmlFor="new-year">Year</label>
                        <select id="new-year" value={newUserYear} onChange={(e) => setNewUserYear(e.target.value)}>
                          <option value="first">First Year</option>
                          <option value="second">Second Year</option>
                          <option value="third">Third Year</option>
                          <option value="fourth">Fourth Year</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>
                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}
                <button type="submit" className="login-btn" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create User'}
                </button>
              </form>
            </div>
          </div>
          {editingUser && (
            <div className="modal-overlay">
                <div className="modal-content card">
                    <h2>Edit User: {editingUser.name}</h2>
                    
                    <form onSubmit={handleUpdateUser}>
                        <div className="form-group">
                            <label htmlFor="edit-name">Full Name</label>
                            <input id="edit-name" type="text" value={editedName} onChange={(e) => setEditedName(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="edit-email">Email</label>
                            <input id="edit-email" type="email" value={editedEmail} onChange={(e) => setEditedEmail(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="edit-role">Role</label>
                            <select id="edit-role" value={editedRole} onChange={(e) => setEditedRole(e.target.value)}>
                                <option value="student">Student</option>
                                <option value="teacher">Teacher</option>
                            </select>
                        </div>
                        <div className="modal-actions">
                            <button type="submit" className="login-btn" disabled={isUpdating}>
                                {isUpdating ? 'Saving...' : 'Save Changes'}
                            </button>
                            <button type="button" className="logout-btn" onClick={() => setEditingUser(null)}>Cancel</button>
                        </div>
                    </form>

                    <div className="password-reset-section" style={{ marginTop: '2rem', borderTop: '1px solid #334155', paddingTop: '1.5rem' }}>
                        <h3>Reset Password</h3>
                        <div className="form-group">
                            <label htmlFor="reset-password">New Temporary Password</label>
                            <input id="reset-password" type="password" value={resetPasswordInput} onChange={(e) => setResetPasswordInput(e.target.value)} placeholder="Enter new password..." />
                        </div>
                        <button onClick={handleResetPassword} className="action-btn" disabled={isUpdating || !resetPasswordInput}>
                            {isUpdating ? 'Resetting...' : 'Reset Password'}
                        </button>
                    </div>

                    {error && <div className="error-message" style={{ marginTop: '1rem' }}>{error}</div>}
                    {success && <div className="success-message" style={{ marginTop: '1rem' }}>{success}</div>}
                </div>
            </div>
          )}
          {/* Delete Confirmation Modal */}
          {deletingUser && (
            <div className="modal-overlay">
                <div className="modal-content card">
                    <h2>Confirm Deletion</h2>
                    <p>Are you sure you want to permanently delete the user <strong>{deletingUser.name}</strong> ({deletingUser.email})?</p>
                    <p style={{ color: 'var(--error)', marginTop: '0.5rem' }}>This action cannot be undone.</p>
                    
                    {error && <div className="error-message" style={{ marginTop: '1rem' }}>{error}</div>}
                    {success && <div className="success-message" style={{ marginTop: '1rem' }}>{success}</div>}

                    <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                        <button onClick={handleConfirmDelete} className="action-btn delete" disabled={isUpdating}>
                            {isUpdating ? 'Deleting...' : 'Confirm Delete'}
                        </button>
                        <button type="button" className="action-btn" onClick={() => setDeletingUser(null)} disabled={isUpdating}>Cancel</button>
                    </div>
                </div>
            </div>
          )}
      </div>
    </div>
  );
}

export default AdminDashboard;