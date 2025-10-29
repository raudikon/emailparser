import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';

import { supabase } from './lib/supabase.js';
import { getDailyPosts, getEmails, getUserOrganization, createOrganization, checkEmailAvailability } from './api.js';

function EmailTable({ emails }) {
  if (!emails.length) {
    return <p className="muted">No emails ingested yet.</p>;
  }

  return (
    <div className="table-wrapper">
      <table className="table">
        <thead>
          <tr>
            <th>Subject</th>
            <th>Sender</th>
            <th>Recipient</th>
            <th>Received</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {emails.map((email) => (
            <tr key={email.id}>
              <td>{email.subject ?? '—'}</td>
              <td>{email.sender}</td>
              <td>{email.recipient}</td>
              <td>{format(new Date(email.received_at), 'PPpp')}</td>
              <td>
                {email.parsed_content?.processed ? (
                  <span className="badge success">Parsed</span>
                ) : (
                  <span className="badge">Pending</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DailyPosts({ posts }) {
  if (!posts.length) {
    return <p className="muted">No AI-generated posts yet. Check back after today&apos;s cron run.</p>;
  }

  return (
    <div className="posts-grid">
      {posts.map((post) => (
        <article className="post" key={post.id}>
          <header>
            <span className="badge highlight">{format(new Date(post.created_at), 'PP')}</span>
          </header>

          {/* Display the actual image if available */}
          {post.source_image_url && (
            <div className="post-image-wrapper">
              <img
                src={post.source_image_url}
                alt="Post image"
                className="post-image"
                loading="lazy"
              />
            </div>
          )}

          <p className="post-text">{post.caption_text}</p>

          <footer className="post-footer">
            <button
              className="copy-btn"
              onClick={() => {
                navigator.clipboard.writeText(post.caption_text);
                alert('Caption copied to clipboard!');
              }}
              title="Copy caption"
            >
              📋 Copy Caption
            </button>
          </footer>
        </article>
      ))}
    </div>
  );
}


function LoginCard({ onSuccess }) {
  const [mode, setMode] = useState('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const toggleMode = () => {
    setMode((prev) => (prev === 'signIn' ? 'signUp' : 'signIn'));
    setMessage('');
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (mode === 'signIn') {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (signInError) {
          throw signInError;
        }
        if (data.session) {
          onSuccess(data.session);
        }
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password
        });
        if (signUpError) {
          throw signUpError;
        }
        setMessage('Check your email to confirm this account, then sign in.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card login-card">
      <h1>Email → Instagram Dashboard</h1>
      <p className="muted">
        Sign in to review ingested emails and daily AI captions.
      </p>
      <form className="form" onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@school.org"
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          required
        />

        <button type="submit" className="primary" disabled={loading}>
          {loading ? 'Working…' : mode === 'signIn' ? 'Sign In' : 'Create account'}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      <button type="button" className="link" onClick={toggleMode}>
        {mode === 'signIn'
          ? 'Need an account? Create one'
          : 'Already registered? Sign in'}
      </button>
    </section>
  );
}

function OnboardingCard({ accessToken, onSuccess }) {
  const [name, setName] = useState('');
  const [emailPrefix, setEmailPrefix] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [isAvailable, setIsAvailable] = useState(null);

  // Get Mailgun domain from environment or use default
  const mailgunDomain = import.meta.env.VITE_MAILGUN_DOMAIN || 'sandbox.mailgun.org';
  const fullEmail = emailPrefix ? `${emailPrefix}@${mailgunDomain}` : '';

  // Check email availability as user types
  useEffect(() => {
    if (!emailPrefix || emailPrefix.length < 3) {
      setIsAvailable(null);
      return;
    }

    const checkAvailability = async () => {
      setCheckingAvailability(true);
      try {
        const available = await checkEmailAvailability(accessToken, fullEmail);
        setIsAvailable(available);
      } catch (err) {
        console.error('Failed to check availability:', err);
        setIsAvailable(null);
      } finally {
        setCheckingAvailability(false);
      }
    };

    const timeoutId = setTimeout(checkAvailability, 500);
    return () => clearTimeout(timeoutId);
  }, [emailPrefix, fullEmail, accessToken]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!name || !emailPrefix) {
        throw new Error('Please fill in all fields');
      }

      if (isAvailable === false) {
        throw new Error('This email is already taken. Please choose another.');
      }

      const organization = await createOrganization(accessToken, {
        name: name.trim(),
        recipientEmail: fullEmail.trim()
      });

      // Show success and authorization instructions
      alert(`✅ Organization created successfully!\n\n⚠️ IMPORTANT: To receive daily digest emails, you need to authorize your email address in Mailgun.\n\nMailgun will send you a verification email. Please check your inbox and click the verification link.\n\nWithout verification, you won't receive daily post notifications.`);

      onSuccess(organization);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card login-card">
      <h1>🎉 Welcome to Daily Storybuilder!</h1>
      <p className="muted">
        Create your organization to start receiving and processing emails.
      </p>

      <form className="form" onSubmit={handleSubmit}>
        <label htmlFor="org-name">Organization Name</label>
        <input
          id="org-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="NYC Schools"
          required
        />

        <label htmlFor="email-prefix">Choose Your Forwarding Email</label>
        <div style={{ position: 'relative' }}>
          <input
            id="email-prefix"
            type="text"
            value={emailPrefix}
            onChange={(event) => {
              const value = event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
              setEmailPrefix(value);
            }}
            placeholder="nycschools"
            required
            pattern="[a-z0-9-]{3,}"
            title="Lowercase letters, numbers, and hyphens only (min 3 characters)"
          />
          {checkingAvailability && (
            <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
              ⏳
            </span>
          )}
          {!checkingAvailability && isAvailable === true && (
            <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'green' }}>
              ✓
            </span>
          )}
          {!checkingAvailability && isAvailable === false && (
            <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'red' }}>
              ✗
            </span>
          )}
        </div>
        {fullEmail && (
          <p className="muted" style={{ marginTop: '-10px', fontSize: '14px' }}>
            Your forwarding email will be: <strong>{fullEmail}</strong>
          </p>
        )}
        {isAvailable === false && (
          <p className="error" style={{ marginTop: '-10px', fontSize: '14px' }}>
            This email is already taken. Please choose another.
          </p>
        )}

        <button
          type="submit"
          className="primary"
          disabled={loading || !isAvailable || checkingAvailability}
        >
          {loading ? 'Creating…' : 'Create Organization'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      <div style={{ marginTop: '20px', padding: '15px', background: '#f0f7ff', borderRadius: '8px' }}>
        <p style={{ margin: 0, fontSize: '14px', color: '#555' }}>
          💡 <strong>Tip:</strong> Forward emails with images to your organization email, and we'll automatically generate Instagram posts from them!
        </p>
      </div>
    </section>
  );
}

function Dashboard({ user, organization, emails, posts, loading, onRefresh, onSignOut }) {
  const displayName = useMemo(() => user?.email ?? 'User', [user]);

  return (
    <div className="dashboard">
      <header className="top-bar">
        <div>
          <h1>Daily Storybuilder</h1>
          <p className="muted">Automated social content from your forwarded emails.</p>
          {organization && (
            <div style={{ marginTop: '10px', padding: '10px', background: '#f0f7ff', borderRadius: '6px', border: '1px solid #c7e0f4' }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>
                <strong>📧 Organization:</strong> {organization.name}
              </p>
              <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#555' }}>
                <strong>Forward emails to:</strong>{' '}
                <code style={{ background: '#e8f4fd', padding: '2px 6px', borderRadius: '4px', fontSize: '13px' }}>
                  {organization.recipient_email}
                </code>
              </p>
            </div>
          )}
        </div>
        <div className="top-bar-actions">
          <span className="muted">{displayName}</span>
          <button onClick={onRefresh} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button onClick={onSignOut} className="secondary">
            Sign out
          </button>
        </div>
      </header>

      <main className="grid">
        <section className="card">
          <div className="card-header">
            <h2>Forwarded Emails</h2>
            <span className="muted">{emails.length} total</span>
          </div>
          <EmailTable emails={emails} />
        </section>

        <section className="card">
          <div className="card-header">
            <h2>AI Instagram Posts</h2>
            <span className="muted">{posts.length} generated</span>
          </div>
          <DailyPosts posts={posts} />
        </section>
      </main>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [checkingOrganization, setCheckingOrganization] = useState(false);
  const [emails, setEmails] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const accessToken = session?.access_token ?? null;

  const checkOrganization = async (token = accessToken) => {
    if (!token) return;
    setCheckingOrganization(true);

    try {
      const org = await getUserOrganization(token);
      setOrganization(org);
    } catch (err) {
      // User doesn't have an organization yet - that's okay
      console.log('No organization found for user');
      setOrganization(null);
    } finally {
      setCheckingOrganization(false);
    }
  };

  const loadData = async (token = accessToken) => {
    if (!token) return;
    setLoading(true);
    setError('');

    try {
      const [emailsData, postsData] = await Promise.all([
        getEmails(token),
        getDailyPosts(token)
      ]);
      setEmails(emailsData);
      setPosts(postsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.access_token) {
        checkOrganization(data.session.access_token);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.access_token) {
        checkOrganization(newSession.access_token);
      } else {
        setEmails([]);
        setPosts([]);
        setOrganization(null);
      }
    });

    return () => {
      listener?.subscription?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (accessToken && organization) {
      loadData(accessToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, organization]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setOrganization(null);
    setEmails([]);
    setPosts([]);
  };

  // Show login if not authenticated
  if (!session) {
    return (
      <div className="app centered">
        <LoginCard
          onSuccess={(newSession) => {
            setSession(newSession);
            setUser(newSession.user);
          }}
        />
      </div>
    );
  }

  // Show loading while checking for organization
  if (checkingOrganization) {
    return (
      <div className="app centered">
        <div className="card login-card">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Show onboarding if authenticated but no organization
  if (!organization) {
    return (
      <div className="app centered">
        <OnboardingCard
          accessToken={accessToken}
          onSuccess={(newOrganization) => {
            setOrganization(newOrganization);
          }}
        />
      </div>
    );
  }

  // Show dashboard if authenticated and has organization
  return (
    <div className="app">
      {error && <p className="error banner">{error}</p>}
      <Dashboard
        user={user}
        organization={organization}
        emails={emails}
        posts={posts}
        loading={loading}
        onRefresh={() => loadData()}
        onSignOut={handleSignOut}
      />
    </div>
  );
}
