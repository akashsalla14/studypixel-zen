/**
 * @fileoverview StudentDashboard component - Student learning workspace
 * 
 * What: Personal dashboard for students to access assigned PixelBots, view personal
 * learning materials, and track their performance analytics.
 * 
 * Why: Students need a personalized hub to:
 * - See all PixelBots assigned by their teachers
 * - Access personal/self-created PixelBots
 * - Monitor their own learning progress and mastery trends
 * - Track study streaks and achievement metrics
 * 
 * How:
 * - Three-tab interface: Assigned PixelBots, Personal PixelBots, My Performance
 * - Assigned tab: Shows teacher-assigned PixelBots with current mastery and next revision
 * - Personal tab: Student's own PixelBots (empty state with create option)
 * - Analytics tab: Performance metrics with mastery progression chart
 * - Uses RechartsPanel to visualize mastery over time
 * 
 * Component Props:
 * @param {Object} user - Current authenticated student user object
 * @param {Function} onLogout - Callback to trigger logout
 * @param {Function} onOpenPixelBot - Callback to open PixelBot workspace with selected bot
 * 
 * State Management:
 * - activeTab: Current tab selection (assigned/personal/analytics)
 * - personalMastery: Array of mastery values over time for chart visualization
 * 
 * CSS Dependencies:
 * - .dashboard, .dashboard-header, .dashboard-tabs, .dashboard-content
 * - .pixelbot-library, .pixelbot-grid, .pixelbot-card, .student-card
 * - .my-mastery, .mastery-bar, .mastery-fill, .mastery-value
 * - .analytics-panel, .analytics-grid, .analytics-card, .chart-section
 * - .empty-state, .create-btn
 * 
 * Integration: Rendered by main App when student user is logged in
 * Depends on: RechartsPanel component for mastery visualization
 */

'use client'
import { useState, useEffect } from 'react';
import { getPixelBots } from '@/lib/dataService';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import RechartsPanel from '@/components/common/RechartsPanel';
import { usePixelBotBuilder } from './usePixelBotBuilder';
import { calculateRetention, needsReview } from '@/lib/bktEngine';

const studentBuilderQuestions = [
  "What subject or skill do you want to learn?",
  "What is your current comfort level with this topic? (Beginner / Intermediate / Advanced)",
  "How do you like to learn? (e.g., with examples, by doing, with visuals)",
  "How challenging should the practice problems be? (Easy / Medium / Hard)",
  "How often do you want to be tested with quizzes? (Rarely / Sometimes / Often)"
];
/**
 * StudentDashboard Component
 * 
 * Student-facing interface for accessing PixelBots and monitoring learning progress.
 * Provides personalized learning workspace with performance analytics.
 */
function StudentDashboard({ user, onLogout, onOpenPixelBot }) {
  const [activeTab, setActiveTab] = useState("assigned");
  const [assignedBots, setAssignedBots] = useState([]);
  const [personalBots, setPersonalBots] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showBuilder, setShowBuilder] = useState(false);
  
  // Real mastery series fetched from Firestore adaptive profiles
  const [personalMastery, setPersonalMastery] = useState([0.25]);
  // Daily streak counter
  const [streakDays, setStreakDays] = useState(0);
  // Topics that need review (from BKT retention engine)
  const [reviewDueTopics, setReviewDueTopics] = useState([]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const getMasteryStatus = (mastery) => {
    if (!mastery && mastery !== 0) return 'Beginner';
    if (mastery >= 0.8) return 'Advanced';
    if (mastery >= 0.4) return 'Intermediate';
    return 'Beginner';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Advanced':     return '#10b981';
      case 'Intermediate': return '#f59e0b';
      default:             return '#ef4444';
    }
  };

  // Calculate how many consecutive days the user has logged in.
  const computeStreak = (lastLoginDate) => {
    if (!lastLoginDate) return 0;
    const last = new Date(lastLoginDate);
    const now  = new Date();
    const diffMs   = now - last;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    // Still within the same day or yesterday → streak is alive
    if (diffDays <= 1) {
      return (user.streakCount || 1);
    }
    return 0; // streak broken
  };

  // ── Data fetching ──────────────────────────────────────────────────────

  const refetchPersonalBots = async () => {
    try {
      const personal = await getPixelBots({ creatorId: user.uid });
      setPersonalBots(personal);
    } catch (err) {
      setError('Failed to refresh personal PixelBots.');
      console.error(err);
    }
  };

  useEffect(() => {
    const fetchStudentData = async () => {
      setIsLoading(true);
      try {
        const [assigned, personal] = await Promise.all([
          getPixelBots({ teacherId: user.teacherId }),
          getPixelBots({ creatorId: user.uid }),
        ]);

        // ── Real mastery data ───────────────────────────────────────────
        // Read bktMastery from each bot's adaptiveProfile and populate the
        // mastery chart series + inject real mastery onto each bot object.
        const allBots = [...assigned, ...personal];
        const masterySeries = [];
        const botsWithMastery = await Promise.all(
          allBots.map(async (bot) => {
            try {
              const profileRef = doc(
                db,
                'users', user.uid,
                'pixelbots', bot.id,
                'adaptiveProfile', 'current'
              );
              const snap = await getDoc(profileRef);
              const profile = snap.exists() ? snap.data() : {};
              const mastery = profile.bktMastery ?? null;
              if (mastery !== null) masterySeries.push(mastery);
              return { ...bot, mastery };
            } catch (e) {
              return bot;
            }
          })
        );

        // Split back into assigned / personal
        const assignedWithMastery = botsWithMastery.slice(0, assigned.length);
        const personalWithMastery = botsWithMastery.slice(assigned.length);

        setAssignedBots(assignedWithMastery);
        setPersonalBots(personalWithMastery);
        if (masterySeries.length > 0) setPersonalMastery(masterySeries);

        // ── Review-due topics ───────────────────────────────────────────
        // Scan all pixelbot adaptive profiles for topics that need review.
        const due = [];
        for (const bot of allBots) {
          try {
            const topicsRef = collection(
              db,
              'users', user.uid,
              'pixelbots', bot.id,
              'adaptiveProfile'
            );
            const topicSnaps = await getDocs(topicsRef);
            topicSnaps.forEach((snap) => {
              const p = snap.data();
              if (!p.bktMastery) return;
              const days = p.bktLastUpdated
                ? Math.floor((Date.now() - new Date(p.bktLastUpdated)) / 86400000)
                : 0;
              const retention = calculateRetention(days, 0.5) * 100;
              if (needsReview(p.bktMastery, days)) {
                due.push({
                  name: bot.topic || bot.name,
                  botId: bot.id,
                  masteryScore: p.bktMastery,
                  daysSinceReview: days,
                  retentionPct: Math.round(retention),
                });
              }
            });
          } catch (e) { /* non-fatal */ }
        }
        setReviewDueTopics(due);

        // ── Streak ─────────────────────────────────────────────────────
        setStreakDays(computeStreak(user.lastLoginDate));

      } catch (err) {
        setError('Failed to fetch PixelBots.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStudentData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.uid, user.teacherId]);

  const onBuilderSuccess = () => {
    setShowBuilder(false);
    refetchPersonalBots();
  };

  const { builderState, setInput, handleSubmit, handleGenerate, reset: resetBuilder } = usePixelBotBuilder(user, studentBuilderQuestions, onBuilderSuccess);

  const getStudentPixelBotData = (responses, currentUser) => {
    return {
      name: responses[0] || 'Personal Bot',
      topic: responses[0] || 'Custom',
      instructions: `Personal bot created by ${currentUser.name}. Topic: ${responses[0]}, Comfort: ${responses[1]}, Style: ${responses[2]}`,
      creatorId: currentUser.uid,
      teacherId: null,
    };
  };

  return (
    <div className="dashboard">
      {/* Dashboard header with branding, user info, and streak badge */}
      <header className="dashboard-header">
        <div className="brand">
          <span className="brand__dot"></span>
          <div>
            <h1 className="brand__title">Student Dashboard</h1>
            <p className="brand__subtitle">Learning Workspace</p>
          </div>
        </div>
        <div className="header-actions">
          {streakDays > 0 && (
            <span
              title={`${streakDays}-day study streak`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.3rem 0.75rem',
                borderRadius: '9999px',
                backgroundColor: 'rgba(245,158,11,0.15)',
                border: '1px solid #f59e0b',
                color: '#f59e0b',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              🔥 {streakDays} day{streakDays !== 1 ? 's' : ''}
            </span>
          )}
          <span className="user-name">{user.name}</span>
          <button onClick={onLogout} className="logout-btn">Logout</button>
        </div>
      </header>
      
      {/* Tab navigation buttons */}
      <div className="dashboard-tabs">
        <button 
          className={activeTab === "assigned" ? "tab-btn active" : "tab-btn"}
          onClick={() => setActiveTab("assigned")}
        >
          Assigned PixelBots
        </button>
        <button 
          className={activeTab === "personal" ? "tab-btn active" : "tab-btn"}
          onClick={() => setActiveTab("personal")}
        >
          Personal PixelBots
        </button>
        <button 
          className={activeTab === "analytics" ? "tab-btn active" : "tab-btn"}
          onClick={() => setActiveTab("analytics")}
        >
          My Performance
        </button>
        <button
          className={activeTab === "review" ? "tab-btn active" : "tab-btn"}
          onClick={() => setActiveTab("review")}
          style={reviewDueTopics.length > 0 ? { position: 'relative' } : {}}
        >
          Review Due
          {reviewDueTopics.length > 0 && (
            <span style={{
              position: 'absolute',
              top: '-6px',
              right: '-6px',
              background: '#ef4444',
              color: '#fff',
              borderRadius: '9999px',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '1px 6px',
              lineHeight: 1.4,
            }}>
              {reviewDueTopics.length}
            </span>
          )}
        </button>
      </div>
      
      {/* Main dashboard content area */}
      <div className="dashboard-content">
        {/* Assigned PixelBots Tab - Teacher-assigned learning materials */}
        {activeTab === "assigned" && (
          <div className="pixelbot-library">
            <h2>Assigned PixelBots</h2>
            {isLoading && <p>Loading...</p>}
            {error && <div className="error-message">{error}</div>}
            <div className="pixelbot-grid">
              {!isLoading && assignedBots.length === 0 && <p>Your teacher has not assigned any PixelBots to you yet.</p>}
              {assignedBots.map(bot => (
                <div key={bot.id} className="pixelbot-card student-card">
                  <div className="pixelbot-header">
                    <h3>{bot.name}</h3>
                    <span className="topic-badge">{bot.topic}</span>
                  </div>
                  <div className="pixelbot-info">
                    {/* Personal mastery indicator with color-coded progress */}
                    <div className="my-mastery">
                      <label>Learning Status:</label>
                      <div style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: `${getStatusColor(getMasteryStatus(bot.mastery))}20`, // 20% opacity
                        border: `1px solid ${getStatusColor(getMasteryStatus(bot.mastery))}`,
                        borderRadius: '0.5rem',
                        color: getStatusColor(getMasteryStatus(bot.mastery)),
                        fontWeight: '600',
                        textAlign: 'center',
                        marginTop: '0.25rem'
                      }}>
                        {getMasteryStatus(bot.mastery)}
                      </div>
                    </div>
                    {/* Next revision reminder */}
                    <p className="next-session">Next revision: <strong>Tomorrow</strong></p>
                  </div>
                  <button 
                    className="pixelbot-action-btn"
                    onClick={() => onOpenPixelBot(bot)}
                  >
                    Start Learning
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Personal PixelBots Tab - Student's own created PixelBots */}
        {activeTab === "personal" && (
          <div className="pixelbot-library">
            <h2>Personal PixelBots</h2>
            {showBuilder ? (
              <div className="card">
                <div className="builder-header">
                  <h2>Create Your PixelBot</h2>
                  <button 
                    className="builder-generate-btn" 
                    onClick={() => handleGenerate(getStudentPixelBotData)}
                    disabled={!builderState.isComplete || builderState.isGenerating}
                  >
                    {builderState.isGenerating ? "Generating..." : builderState.isComplete ? "✨ Generate PixelBot" : "🔒 Complete Conversation"}
                  </button>
                </div>
                <div className="builder-chat-container">
                  <div className="builder-chat-messages">
                    {builderState.messages.map((msg, idx) => (
                      <div key={idx} className={`builder-chat-bubble ${msg.role}`}><p>{msg.text}</p></div>
                    ))}
                  </div>
                  <div className="builder-input-container">
                    <input
                      type="text"
                      value={builderState.input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                      placeholder="Type your response..."
                      disabled={builderState.isComplete || builderState.isGenerating}
                    />
                    <button className="builder-submit-btn" onClick={handleSubmit} disabled={!builderState.input.trim() || builderState.isComplete}>Send</button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="pixelbot-grid">
                  {isLoading && <p>Loading...</p>}
                  {personalBots.map(bot => (
                     <div key={bot.id} className="pixelbot-card student-card" onClick={() => onOpenPixelBot(bot)}>
                       <h3>{bot.name}</h3>
                       <span className="topic-badge">{bot.topic}</span>
                       <p>You created this bot.</p>
                       <button className="pixelbot-action-btn">Start Learning</button>
                     </div>
                  ))}
                </div>
                {personalBots.length === 0 && !isLoading && (
                  <div className="empty-state"><p>You haven&apos;t created any personal PixelBots yet.</p></div>
                )}
                <button className="create-btn" onClick={() => {
                  resetBuilder();
                  setShowBuilder(true);
                }}>
                  + Create New Personal Bot
                </button>
              </>
            )}
          </div>
        )}
        
        {/* My Performance Tab - Personal analytics and progress tracking */}
        {activeTab === "analytics" && (
          <div className="analytics-panel">
            <div className="card">
              <h2>My Performance Analytics</h2>
              
              {/* Key performance metrics grid */}
              <div className="analytics-grid">
                <div className="analytics-card">
                  <h3>Overall Mastery</h3>
                  <p className="analytics-number">
                    {personalMastery.length > 0
                      ? `${Math.round(personalMastery[personalMastery.length - 1] * 100)}%`
                      : '—'}
                  </p>
                  <p className="analytics-change">
                    {personalMastery.length > 1
                      ? `↑ ${Math.round((personalMastery[personalMastery.length - 1] - personalMastery[0]) * 100)}% overall`
                      : 'Keep learning!'}
                  </p>
                </div>
                <div className="analytics-card">
                  <h3>Active PixelBots</h3>
                  <p className="analytics-number">{assignedBots.length + personalBots.length}</p>
                  <p className="analytics-change">→ In progress</p>
                </div>
                <div className="analytics-card">
                  <h3>Study Streak</h3>
                  <p className="analytics-number">{streakDays > 0 ? `${streakDays} day${streakDays !== 1 ? 's' : ''}` : '—'}</p>
                  <p className="analytics-change">{streakDays > 0 ? '🔥 Keep going!' : 'Log in daily to build a streak!'}</p>
                </div>
              </div>
              
              {/* Mastery progression chart */}
              <div className="chart-section">
                <RechartsPanel 
                  masterySeries={personalMastery} 
                  title="My Mastery Progression" 
                />
              </div>
            </div>
          </div>
        )}

        {/* Review Due Tab - BKT-powered spaced repetition queue */}
        {activeTab === "review" && (
          <div className="pixelbot-library">
            <h2>📅 Review Due</h2>
            <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
              Topics where your retention has dropped below the threshold. Review them now to reinforce your memory.
            </p>
            {isLoading && <p>Loading...</p>}
            {!isLoading && reviewDueTopics.length === 0 && (
              <div className="empty-state">
                <p>✅ Nothing due for review right now. Keep up the great work!</p>
              </div>
            )}
            <div className="pixelbot-grid">
              {reviewDueTopics.map((topic, i) => {
                const retColor = topic.retentionPct >= 70 ? '#10b981' : topic.retentionPct >= 40 ? '#f59e0b' : '#ef4444';
                const bot = [...assignedBots, ...personalBots].find((b) => b.id === topic.botId);
                return (
                  <div key={i} className="pixelbot-card student-card">
                    <div className="pixelbot-header">
                      <h3>{topic.name}</h3>
                      <span className="topic-badge">
                        {topic.daysSinceReview === 0 ? 'Today' : `${topic.daysSinceReview}d ago`}
                      </span>
                    </div>
                    <div style={{ margin: '0.75rem 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Retention</span>
                        <span style={{ color: retColor, fontSize: '0.8rem', fontWeight: 600 }}>{topic.retentionPct}%</span>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                        <div style={{ width: `${topic.retentionPct}%`, height: '100%', backgroundColor: retColor, borderRadius: '4px' }} />
                      </div>
                      <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.4rem' }}>
                        Mastery: {Math.round(topic.masteryScore * 100)}%
                      </p>
                    </div>
                    {bot && (
                      <button
                        className="pixelbot-action-btn"
                        onClick={() => onOpenPixelBot(bot)}
                      >
                        Start Review
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StudentDashboard;