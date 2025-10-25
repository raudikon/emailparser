import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';

import { supabase } from './lib/supabase.js';
import { getDailyPosts, getEmails } from './api.js';

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
          <p className="post-text">{post.caption_text}</p>
          <footer>
            Suggested image:&nbsp;
            <strong>{post.image_url ?? 'None'}</strong>
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

function Dashboard({ user, emails, posts, loading, onRefresh, onSignOut }) {
  const displayName = useMemo(() => user?.email ?? 'User', [user]);

  return (
    <div className="dashboard">
      <header className="top-bar">
        <div>
          <h1>Daily Storybuilder</h1>
          <p className="muted">Automated social content from your forwarded emails.</p>
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
  const [emails, setEmails] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const accessToken = session?.access_token ?? null;

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
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.access_token) {
        loadData(newSession.access_token);
      } else {
        setEmails([]);
        setPosts([]);
      }
    });

    return () => {
      listener?.subscription?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (accessToken) {
      loadData(accessToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setEmails([]);
    setPosts([]);
  };

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

  return (
    <div className="app">
      {error && <p className="error banner">{error}</p>}
      <Dashboard
        user={user}
        emails={emails}
        posts={posts}
        loading={loading}
        onRefresh={() => loadData()}
        onSignOut={handleSignOut}
      />
    </div>
  );
}
