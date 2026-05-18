/**
 * @fileoverview TeacherDashboard component - The Command Center for Teachers.
 * 
 * WHAT IS THIS?
 * This is the main screen that teachers see after logging in. It acts as their "Command Center"
 * or "Supervisor Workspace."
 * 
 * WHY DO WE NEED IT?
 * Teachers need a central place to:
 * 1. See all their AI Tutors (PixelBots) and how well they are teaching.
 * 2. Watch over their students' progress in real-time (like a digital classroom).
 * 3. Create new AI Tutors using a simple chat interface (no coding required).
 * 4. Manage their classes and assign students to specific groups.
 * 
 * HOW DOES IT WORK?
 * The dashboard is split into four main tabs (like folders in a filing cabinet):
 * 1. PixelBot Library: Shows all the AI tutors the teacher has created.
 * 2. Student Monitoring: Shows a list of students and their "Mastery" (how much they have learned).
 * 3. Create PixelBot: A chat window where the teacher talks to an AI to build a new tutor.
 * 4. Class Management: Tools to organize students into classes (e.g., "Year 1 - Class A").
 * 
 * Component Props:
 * @param {Object} user - Current authenticated teacher user object
 * @param {Function} onLogout - Callback to trigger logout
 * @param {Function} onOpenPixelBot - Callback to open PixelBot workspace with selected bot
 * 
 * CSS Dependencies:
 * - .dashboard, .dashboard-header, .dashboard-tabs, .dashboard-content
 * - .pixelbot-library, .pixelbot-grid, .pixelbot-card, .pixelbot-action-btn
 * - .monitoring-panel, .student-monitor-card, .action-buttons
 * - .create-panel, .builder-chat-container, .builder-chat-messages, .builder-chat-bubble
 * 
 * Integration: Rendered by main App when teacher user is logged in
 */

'use client'
import { useState, useEffect } from 'react';
import { getPixelBots, getStudents, getClasses, createClass, assignPixelBotToClass, updateClassRoster, sendNotification } from '@/lib/dataService';
import { usePixelBotBuilder } from '@/components/dashboards/usePixelBotBuilder';

const teacherBuilderQuestions = [
  "What subject or skill do you want to teach?",
  "What is the target difficulty level? (Beginner / Intermediate / Advanced)",
  "What learning style preference should the PixelBot have? (Visual, Auditory, Kinesthetic, or Mixed)",
  "How strict should the evaluation be? (Lenient / Moderate / Strict)",
  "How often should MCQ + Reasoning challenges appear? (Rarely / Sometimes / Often)"
];

/**
 * TeacherDashboard Component
 * 
 * Teacher workspace with PixelBot management, student monitoring, and AI-powered
 * PixelBot creation through conversational interface.
 */
function TeacherDashboard({ user, onLogout, onOpenPixelBot }) {
  const [activeTab, setActiveTab] = useState("library");
  const [pixelbots, setPixelbots] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // State for class management
  const [newClassYear, setNewClassYear] = useState('first');
  const [newClassSubject, setNewClassSubject] = useState('');
  const [newClassName, setNewClassName] = useState('');
  const [classFormMessage, setClassFormMessage] = useState('');
  const [isSubmittingClass, setIsSubmittingClass] = useState(false);

  // State for student management modal
  const [managingClass, setManagingClass] = useState(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());

  const [analyticsClass, setAnalyticsClass] = useState(null);
  // State for messaging modal
  const [messagingTarget, setMessagingTarget] = useState(null); // { type: 'student'/'class', id, name }
  const [messageContent, setMessageContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messagingMessage, setMessagingMessage] = useState('');

  // State for PixelBot assignment
  const [assignmentState, setAssignmentState] = useState({});
  const [isAssigning, setIsAssigning] = useState(null); // Tracks which bot is being assigned

  // State for student filtering
  const [studentYearFilter, setStudentYearFilter] = useState('all');

  const refetchPixelBots = async () => {
    try {
      const teacherPixelBots = await getPixelBots({ teacherId: user.uid });
      setPixelbots(teacherPixelBots);
    } catch (err) {
      setError('Failed to refresh PixelBots.');
      console.error(err);
    }
  };

  const refetchClasses = async () => {
    try {
      const classData = await getClasses(user.uid);
      setClasses(classData);
    } catch (err) {
      setError('Failed to refresh classes.');
      console.error(err);
    }
  };

  // WHAT: The "Initial Setup" action.
  // WHY:  When the teacher logs in, we immediately need to grab their data from the database.
  // HOW:  It asks the database for 3 things at once: PixelBots, Students, and Classes.
  useEffect(() => {
    const fetchTeacherData = async () => {
      setIsLoading(true);
      setError('');
      try {
        const [bots, studentData, classData] = await Promise.all([
          getPixelBots({ teacherId: user.uid }),
          getStudents(user.uid),
          getClasses(user.uid)
        ]);
        setPixelbots(bots);
        setStudents(studentData);
        setClasses(classData);
      } catch (err) {
        setError('Failed to fetch teacher data.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTeacherData();
  }, [user.uid]);

  // WHAT: The "Cleanup" action.
  // WHY:  When the teacher switches tabs (e.g., from Library to Monitoring), we want to close any open pop-ups.
  // HOW:  It listens for changes to `activeTab`. When the tab changes, it resets the state variables that control modal visibility to `null`.
  useEffect(() => {
    setManagingClass(null);
    setMessagingTarget(null);
    setAnalyticsClass(null);
  }, [activeTab]);

  const onBuilderSuccess = () => {
    alert("PixelBot generation complete!");
    setActiveTab('library');
    refetchPixelBots(); // Refetch bots to show the new one
  };

  const { builderState, setInput, handleSubmit, handleGenerate } = usePixelBotBuilder(user, teacherBuilderQuestions, onBuilderSuccess);

  // WHAT: Handles the "Create Class" button click.
  // WHY:  Takes the information typed by the teacher and saves a new Class group to the database.
  // HOW:  It checks if the name is empty, then sends the data to the backend system.
  const handleCreateClass = async (e) => {
    e.preventDefault();
    if (!newClassName.trim()) {
      setError("Class Name cannot be empty.");
      return;
    }
    setIsSubmittingClass(true);
    setClassFormMessage('');
    try {
      await createClass({ teacherId: user.uid, year: newClassYear, className: newClassName, subject: newClassSubject });
      setNewClassName(''); // Reset form
      setNewClassSubject('');
      setClassFormMessage('Class created successfully!');
      await refetchClasses(); // Refresh class list
    } catch (err) {
      setClassFormMessage('Error: Failed to create class.');
      console.error(err);
    } finally {
      setIsSubmittingClass(false);
    }
  };

  // WHAT: Handles the "Assign" button click on a PixelBot card.
  // WHY:  To link a specific AI Tutor to a specific Class of students.
  // HOW:  It reads the selected class ID and tells the database to make the connection.
  const handleAssignBot = async (pixelbotId) => {
    const classId = assignmentState[pixelbotId];
    if (!classId) {
      setError("Please select a class to assign.");
      return;
    }
    setIsAssigning(pixelbotId);
    setError('');
    try {
      await assignPixelBotToClass(pixelbotId, classId);
      await refetchPixelBots(); // Refresh to show the new assignment
    } catch (err) {
      setError("Failed to assign PixelBot.");
      console.error(err);
    } finally {
      setIsAssigning(null);
    }
  };

  // WHAT: Opens the "Send Message" pop-up.
  const openMessageModal = (target) => {
    setMessagingTarget(target);
    setMessageContent('');
    setMessagingMessage('');
  };

  // WHAT: Sends the typed message to the student or class.
  // WHY:  To allow teachers to communicate directly with their students.
  // HOW:  It creates a "Notification" in the database that the student will see later.
  const handleSendMessage = async () => {
    if (!messagingTarget || !messageContent.trim()) {
      setMessagingMessage('Error: Message content cannot be empty.');
      return;
    }
    setIsSending(true);
    setMessagingMessage('');
    try {
      await sendNotification({
        teacherId: user.uid,
        teacherName: user.name,
        type: 'message',
        content: messageContent,
        recipientType: messagingTarget.type,
        recipientId: messagingTarget.id,
      });
      setMessagingMessage('Message sent successfully!');
      setTimeout(() => setMessagingTarget(null), 1500);
    } catch (err) {
      setMessagingMessage('Error: Failed to send message.');
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  // WHAT: Happens when the teacher clicks "Force Revision".
  // WHY:  To nudge a struggling student to review material immediately.
  // HOW:  It sends a specific "revision_request" notification to that student.
  const handleForceRevision = async (student) => {
    // This provides instant feedback to the teacher, can be enhanced with a loading state
    alert(`Sending revision request to ${student.name}...`);
    await sendNotification({
        teacherId: user.uid,
        teacherName: user.name,
        type: 'revision_request',
        content: `Your teacher, ${user.name}, has requested you to start a revision session. Please review the material to improve your mastery.`,
        recipientType: 'student',
        recipientId: student.id,
    });
  };

  // WHAT: Opens the "Manage Students" pop-up for a specific class.
  // WHY:  So the teacher can add or remove students from that class roster.
  const openStudentManager = (cls) => {
    setManagingClass(cls);
    setSelectedStudentIds(new Set(cls.studentIds));
    setClassFormMessage(''); // Clear any previous messages
  };

  // WHAT: Toggles a student's selection in the roster list.
  // HOW:  If they are checked, uncheck them. If unchecked, check them.
  const handleStudentSelection = (studentId) => {
    const newSelection = new Set(selectedStudentIds);
    if (newSelection.has(studentId)) {
      newSelection.delete(studentId);
    } else {
      newSelection.add(studentId);
    }
    setSelectedStudentIds(newSelection);
  };

  // WHAT: Saves the updated list of students for a class.
  // WHY:  To finalize the changes made in the "Manage Students" pop-up.
  // HOW:  It sends the new list of Student IDs to the database.
  const handleUpdateRoster = async () => {
    if (!managingClass) return;
    setIsSubmittingClass(true); // Reuse submitting state for loading indicator
    setClassFormMessage('');
    try {
      await updateClassRoster(managingClass.id, Array.from(selectedStudentIds));
      setClassFormMessage('Class roster updated successfully!');
      await refetchClasses();
      setTimeout(() => {
        setManagingClass(null);
      }, 1500); // Close modal after a short delay to show success message
    } catch (err) {
      setClassFormMessage('Error: Failed to update roster.');
      console.error(err);
    } finally {
      setIsSubmittingClass(false);
    }
  };

  // WHAT: Formats the chat responses into a PixelBot data object.
  // WHY:  The database needs the data in a specific structure (name, topic, instructions).
  // HOW:  It takes the answers from the chat (responses array) and maps them to the correct fields.
  const getTeacherPixelBotData = (responses, currentUser) => {
    return {
        name: responses[0] || 'New PixelBot',
        topic: responses[0] || 'Custom',
        instructions: `
          - Subject: ${responses[0]}
          - Difficulty: ${responses[1]}
          - Learning Style: ${responses[2]}
          - Evaluation: ${responses[3]}
          - Challenges: ${responses[4]}
        `,
        config: {
          strictness: responses[3],
          challengeFrequency: responses[4]
        },
        teacherId: currentUser.uid,
      };
  };

  const openAnalytics = (cls) => {
    setAnalyticsClass(cls);
  };

  // Helper for status display
  const getMasteryStatus = (mastery) => {
    if (!mastery && mastery !== 0) return 'Beginner';
    if (mastery >= 0.8) return 'Advanced';
    if (mastery >= 0.4) return 'Intermediate';
    return 'Beginner';
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Advanced': return '#10b981';
      case 'Intermediate': return '#f59e0b';
      default: return '#ef4444';
    }
  };

  const filteredStudents = students.filter(student => 
    studentYearFilter === 'all' || student.year === studentYearFilter
  );
  
  return (
    <div className="dashboard">
      {/* Dashboard header with branding and user info */}
      <header className="dashboard-header">
        <div className="brand">
          <span className="brand__dot"></span>
          <div>
            <h1 className="brand__title">Teacher Dashboard</h1>
            <p className="brand__subtitle">Supervisor Workspace</p>
          </div>
        </div>
        <div className="header-actions">
          <span className="user-name">{user.name}</span>
          <button onClick={onLogout} className="logout-btn">Logout</button>
        </div>
      </header>
      
      {/* Tab navigation buttons */}
      <div className="dashboard-tabs">
        <button 
          className={activeTab === "library" ? "tab-btn active" : "tab-btn"}
          onClick={() => setActiveTab("library")}
        >
          PixelBot Library
        </button>
        <button 
          className={activeTab === "monitoring" ? "tab-btn active" : "tab-btn"}
          onClick={() => setActiveTab("monitoring")}
        >
          Student Monitoring
        </button>
        <button 
          className={activeTab === "create" ? "tab-btn active" : "tab-btn"}
          onClick={() => setActiveTab("create")}
        >
          Create PixelBot
        </button>
        <button 
          className={activeTab === "classes" ? "tab-btn active" : "tab-btn"}
          onClick={() => setActiveTab("classes")}
        >
          Class Management
        </button>
      </div>
      
      {/* Main dashboard content area */}
      <div className="dashboard-content">
        {/* PixelBot Library Tab - Grid of all available PixelBots */}
        {activeTab === "library" && (
          <div className="pixelbot-library">
            <h2>PixelBot Library</h2>
            {isLoading && <p>Loading PixelBots...</p>}
            {error && <div className="error-message">{error}</div>}
            <div className="pixelbot-grid">
              {!isLoading && pixelbots.length === 0 && <p>You haven&apos;t created any PixelBots yet. Go to the &quot;Create PixelBot&quot; tab to make your first one!</p>}
              {pixelbots.map(bot => (
                <div key={bot.id} className="pixelbot-card">
                  <div className="pixelbot-header">
                    <h3>{bot.name}</h3>
                    <span className="topic-badge">{bot.topic}</span>
                  </div>
                  <div className="pixelbot-info">
                    <p>Assigned to: <strong>{classes.find(c => c.id === bot.classId)?.className ? `${classes.find(c => c.id === bot.classId).year} Year - Class ${classes.find(c => c.id === bot.classId).className}` : 'None'}</strong></p>
                    {/* Mastery indicator with color-coded progress bar */}
                    <div className="mastery-indicator">
                      <label>Avg Mastery:</label>
                      <div className="mastery-bar">
                        <div 
                          className="mastery-fill" 
                          style={{ 
                            width: `${bot.mastery * 100}%`,
                            backgroundColor: bot.mastery > 0.7 ? '#10b981' : bot.mastery > 0.5 ? '#f59e0b' : '#ef4444'
                          }}
                        ></div>
                      </div>
                      <span className="mastery-value">{(bot.mastery * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="pixelbot-actions">
                    <div className="pixelbot-assignment">
                      <select
                        value={assignmentState[bot.id] || ''}
                        onChange={(e) => setAssignmentState(prev => ({ ...prev, [bot.id]: e.target.value }))}
                        disabled={isAssigning === bot.id}
                      >
                        <option value="" disabled>Assign to class...</option>
                        {classes.map(cls => (
                          <option key={cls.id} value={cls.id}>
                            {cls.year} Year - Class {cls.className} ({cls.subject})
                          </option>
                        ))}
                      </select>
                      <button
                        className="action-btn"
                        onClick={() => handleAssignBot(bot.id)}
                        disabled={!assignmentState[bot.id] || isAssigning === bot.id}
                      >
                        {isAssigning === bot.id ? 'Assigning...' : 'Assign'}
                      </button>
                    </div>
                    <button className="pixelbot-action-btn" onClick={() => onOpenPixelBot(bot)}>Open Workspace</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Student Monitoring Tab - Student performance cards */}
        {activeTab === "monitoring" && (
          <div className="monitoring-panel">
            <div className="card">
              <h2>Student Monitoring</h2>
              <div className="form-group" style={{ maxWidth: '300px', marginBottom: '1rem' }}>
                <label htmlFor="student-year-filter">Filter by Year</label>
                <select id="student-year-filter" value={studentYearFilter} onChange={(e) => setStudentYearFilter(e.target.value)}>
                  <option value="all">All Years</option>
                  <option value="first">First Year</option>
                  <option value="second">Second Year</option>
                  <option value="third">Third Year</option>
                  <option value="fourth">Fourth Year</option>
                </select>
              </div>

              {isLoading && <p>Loading students...</p>}
              {!isLoading && filteredStudents.length === 0 && <p>No students found for the selected year.</p>}

              <div className="monitoring-grid">
                {filteredStudents.map(student => (
                  <div key={student.id} className="student-monitor-card">
                    <h3>{student.name}</h3>
                    <p>Email: {student.email}</p>
                    <div className="monitor-stats">
                      <div className="monitor-stat">
                        <label>Avg Mastery:</label>
                        <span className="stat-value">{(student.avgMastery || 0 * 100).toFixed(0)}%</span>
                      </div>
                      <div className="monitor-stat">
                        <label>Drift:</label>
                        <span className="stat-value drift">8%</span>
                      </div>
                    </div>
                    {/* Action buttons for teacher intervention */}
                    <div className="action-buttons">
                      <button className="action-btn" onClick={() => openMessageModal({ type: 'student', id: student.id, name: student.name })}>Message Student</button>
                      <button className="action-btn" onClick={() => handleForceRevision(student)}>Force Revision</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Create PixelBot Tab - Conversational AI builder */}
        {activeTab === "create" && (
          <div className="create-panel">
            <div className="card">
              <div className="builder-header">
                <h2>Create New PixelBot</h2>
                <button 
                  className="builder-generate-btn" 
                  onClick={() => handleGenerate(getTeacherPixelBotData)}
                  disabled={!builderState.isComplete || builderState.isGenerating}
                >
                  {builderState.isGenerating ? "Generating..." : builderState.isComplete ? "✨ Generate PixelBot" : "🔒 Complete Conversation First"}
                </button>
              </div>
              
              {/* Chat-style builder interface */}
              <div className="builder-chat-container">
                <div className="builder-chat-messages">
                  {builderState.messages.map((msg, idx) => (
                    <div key={idx} className={`builder-chat-bubble ${msg.role}`}>
                      <p>{msg.text}</p>
                    </div>
                  ))}
                </div>
                
                {/* Input area for user responses */}
                <div className="builder-input-container">
                  <input
                    type="text"
                    value={builderState.input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    placeholder="Type your response..."
                    disabled={builderState.isComplete}
                  />
                  <button 
                    className="builder-submit-btn"
                    onClick={handleSubmit}
                    disabled={!builderState.input.trim() || builderState.isComplete}
                  >
                    {builderState.isComplete ? "Conversation Complete" : "Send Response"}
                  </button>
                </div>
              </div>
              {error && <div className="error-message" style={{marginTop: '1rem'}}>{error}</div>}
            </div>
          </div>
        )}

        {/* Class Management Tab */}
        {activeTab === "classes" && (
          <div className="admin-panel">
            <div className="card">
              <h2>Create New Class</h2>
              <form className="create-user-form" onSubmit={handleCreateClass}>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="new-class-year">Year</label>
                    <select id="new-class-year" value={newClassYear} onChange={(e) => setNewClassYear(e.target.value)}>
                      <option value="first">First Year</option>
                      <option value="second">Second Year</option>
                      <option value="third">Third Year</option>
                      <option value="fourth">Fourth Year</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="new-class-subject">Subject</label>
                    <input id="new-class-subject" type="text" value={newClassSubject} onChange={(e) => setNewClassSubject(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="new-class-name">Class Name (e.g., A, B, C)</label>
                    <input id="new-class-name" type="text" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} required maxLength="5" />
                  </div>
                </div>
                {classFormMessage && <p style={{ color: classFormMessage.startsWith('Error') ? '#ef4444' : '#10b981', marginTop: '1rem' }}>{classFormMessage}</p>}
                <button type="submit" className="login-btn" disabled={isSubmittingClass}>
                  {isSubmittingClass ? 'Creating...' : 'Create Class'}
                </button>
              </form>
            </div>

            <div className="card" style={{ marginTop: '2rem' }}>
              <h2>My Classes</h2>
              <div className="pixelbot-grid">
                {classes.map(cls => (
                  <div key={cls.id} className="pixelbot-card">
                    <h3>{cls.year.charAt(0).toUpperCase() + cls.year.slice(1)} Year - Class {cls.className} ({cls.subject})</h3>
                    <p>Students: <strong>{cls.studentIds.length}</strong></p>
                    <div className="action-buttons">
                        <button className="action-btn" onClick={() => openStudentManager(cls)}>Manage Students</button>
                        <button className="action-btn" onClick={() => openMessageModal({ type: 'class', id: cls.id, name: `Class ${cls.className}` })}>Message Class</button>
                        <button className="action-btn" onClick={() => openAnalytics(cls)}>Class Analytics</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {managingClass && (
            <div className="modal-overlay">
                <div className="modal-content card">
                    <h2>Manage Roster for: {managingClass.year} Year - Class {managingClass.className}</h2>
                    <div className="student-selection-list">
                        {students.length > 0 ? students.map(student => (
                            <div key={student.id} className="student-selection-item">
                                <input
                                    type="checkbox"
                                    id={`student-${student.id}`}
                                    checked={selectedStudentIds.has(student.id)}
                                    onChange={() => handleStudentSelection(student.id)}
                                />
                                <label htmlFor={`student-${student.id}`}>{student.name} ({student.email})</label>
                            </div>
                        )) : <p>No students are assigned to you. Please have an admin assign students first.</p>}
                    </div>
                    <div className="modal-actions">
                        <button onClick={handleUpdateRoster} className="login-btn" disabled={isSubmittingClass}>
                            {isSubmittingClass ? 'Saving...' : 'Save Roster'}
                        </button>
                        <button type="button" className="logout-btn" onClick={() => setManagingClass(null)}>Cancel</button>
                    </div>
                    {classFormMessage && <p style={{ color: classFormMessage.startsWith('Error') ? '#ef4444' : '#10b981', marginTop: '1rem' }}>{classFormMessage}</p>}
                </div>
            </div>
        )}

        {messagingTarget && (
            <div className="modal-overlay">
                <div className="modal-content card">
                    <h2>Send Message to: {messagingTarget.name}</h2>
                    <div className="form-group">
                        <label htmlFor="message-content">Message</label>
                        <textarea
                            id="message-content"
                            value={messageContent}
                            onChange={(e) => setMessageContent(e.target.value)}
                            rows="5"
                            placeholder="Type your message here..."
                        ></textarea>
                    </div>
                    <div className="modal-actions">
                        <button onClick={handleSendMessage} className="login-btn" disabled={isSending}>{isSending ? 'Sending...' : 'Send Message'}</button>
                        <button type="button" className="logout-btn" onClick={() => setMessagingTarget(null)}>Cancel</button>
                    </div>
                    {messagingMessage && <p style={{ color: messagingMessage.startsWith('Error') ? '#ef4444' : '#10b981', marginTop: '1rem' }}>{messagingMessage}</p>}
                </div>
            </div>
        )}

        {analyticsClass && (
            <div className="modal-overlay">
                <div className="modal-content card">
                    <h2>Class Analytics: {analyticsClass.year} Year - Class {analyticsClass.className}</h2>
                    <div className="student-selection-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {students.filter(s => analyticsClass.studentIds.includes(s.id)).length > 0 ? 
                         students.filter(s => analyticsClass.studentIds.includes(s.id)).map(student => (
                            <div key={student.id} className="student-selection-item" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid var(--border)'}}>
                                <span>{student.name}</span>
                                <span style={{
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.8rem',
                                    fontWeight: '600',
                                    backgroundColor: `${getStatusColor(getMasteryStatus(student.avgMastery))}20`,
                                    color: getStatusColor(getMasteryStatus(student.avgMastery)),
                                    border: `1px solid ${getStatusColor(getMasteryStatus(student.avgMastery))}`
                                }}>
                                    {getMasteryStatus(student.avgMastery)}
                                </span>
                            </div>
                        )) : <p>No students in this class.</p>}
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="logout-btn" onClick={() => setAnalyticsClass(null)}>Close</button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}

export default TeacherDashboard;