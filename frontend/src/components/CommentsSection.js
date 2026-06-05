// PATH: quiz-platform/frontend/src/components/CommentsSection.js
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Avatar({ user, size = 32 }) {
  const s = {
    width: size, height: size, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', flexShrink: 0,
  };
  if (user?.avatar_url) {
    return (
      <div style={s}>
        <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
  }
  if (user?.avatar_preset) {
    return <div style={{ ...s, background: 'var(--surface2)', fontSize: size * 0.45 }}>{user.avatar_preset}</div>;
  }
  return (
    <div style={{ ...s, background: 'var(--accent)', fontSize: size * 0.4, fontWeight: 700, color: '#fff' }}>
      {(user?.username || '?')[0].toUpperCase()}
    </div>
  );
}

function CommentItem({ comment, quizId, currentUser, depth = 0, onDelete }) {
  const [liked,       setLiked]       = useState(false);
  const [likes,       setLikes]       = useState(comment.likes_count || 0);
  const [replies,     setReplies]     = useState([]);
  const [replyCount,  setReplyCount]  = useState(0);
  const [showReply,   setShowReply]   = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [replyText,   setReplyText]   = useState('');
  const [posting,     setPosting]     = useState(false);

  // Load reply count on mount (only for root comments)
  useEffect(() => {
    if (depth > 0) return;
    api.get(`/quizzes/${quizId}/comments?parent_id=${comment.id}`)
      .then(r => { setReplies(r.data || []); setReplyCount(r.data?.length || 0); })
      .catch(() => {});
  }, [quizId, comment.id, depth]);

  const handleLike = async () => {
    if (!currentUser) return;
    try {
      const { data } = await api.post(`/comments/${comment.id}/like`);
      setLiked(data.liked);
      setLikes(prev => data.liked ? prev + 1 : Math.max(0, prev - 1));
    } catch {}
  };

  const handleReport = async () => {
    if (!currentUser || !window.confirm('Report this comment as inappropriate?')) return;
    try {
      await api.post(`/comments/${comment.id}/report`);
      alert('Comment reported. Thank you!');
    } catch {}
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await api.delete(`/comments/${comment.id}`);
      if (onDelete) onDelete(comment.id);
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to delete.');
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || posting) return;
    setPosting(true);
    try {
      const { data } = await api.post(`/quizzes/${quizId}/comments`, {
        body: replyText.trim(),
        parent_id: comment.id,
      });
      setReplies(prev => [data, ...prev]);
      setReplyCount(c => c + 1);
      setReplyText('');
      setShowReply(false);
      setShowReplies(true);
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to reply.');
    } finally {
      setPosting(false);
    }
  };

  const handleReplyDelete = useCallback((id) => {
    setReplies(prev => prev.filter(r => r.id !== id));
    setReplyCount(c => Math.max(0, c - 1));
  }, []);

  if (comment.is_removed) {
    return (
      <div style={{ padding: '8px 0', fontSize: '.82rem', color: 'var(--text3)', fontStyle: 'italic' }}>
        [deleted]
      </div>
    );
  }

  const isOwner = currentUser?.username === comment.username || currentUser?.id === comment.user_id;

  return (
    <div style={{
      marginLeft: depth > 0 ? 16 : 0,
      borderLeft: depth > 0 ? '2px solid var(--border)' : undefined,
      paddingLeft: depth > 0 ? 12 : 0,
      marginBottom: 12,
    }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
        {comment.is_pinned && (
          <div style={{ fontSize: '.7rem', color: 'var(--accent)', fontWeight: 600, marginBottom: 4 }}>
            📌 Pinned
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Avatar user={{ avatar_url: comment.avatar_url, username: comment.username }} size={28} />
            <span style={{ fontWeight: 600, fontSize: '.85rem' }}>{comment.username}</span>
            <span style={{ fontSize: '.72rem', color: 'var(--text3)' }}>{timeAgo(comment.created_at)}</span>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {isOwner && (
              <button
                onClick={handleDelete}
                style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '.75rem', padding: '2px 6px' }}
                title="Delete"
              >✕</button>
            )}
            {currentUser && !isOwner && (
              <button
                onClick={handleReport}
                style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '.72rem', padding: '2px 6px' }}
                title="Report"
              >🚩</button>
            )}
          </div>
        </div>

        <p style={{ fontSize: '.88rem', color: 'var(--text)', lineHeight: 1.5, margin: 0, wordBreak: 'break-word' }}>
          {comment.body}
        </p>

        <div style={{ display: 'flex', gap: 12, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleLike}
            style={{
              background: 'none', border: 'none', cursor: currentUser ? 'pointer' : 'default',
              fontSize: '.78rem', color: liked ? '#6366f1' : 'var(--text3)',
              display: 'flex', alignItems: 'center', gap: 4, padding: 0,
            }}
          >
            {liked ? '❤️' : '🤍'} {likes}
          </button>

          {depth === 0 && currentUser && (
            <button
              onClick={() => setShowReply(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '.78rem', color: 'var(--text3)', padding: 0 }}
            >
              💬 Reply
            </button>
          )}

          {replyCount > 0 && depth === 0 && (
            <button
              onClick={() => setShowReplies(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '.78rem', color: 'var(--accent)', padding: 0 }}
            >
              {showReplies ? '▲' : '▼'} {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
            </button>
          )}
        </div>
      </div>

      {/* Reply input */}
      {showReply && (
        <div style={{ marginTop: 8, paddingLeft: 12 }}>
          <textarea
            className="form-input"
            rows={2}
            placeholder={`Reply to ${comment.username}…`}
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            maxLength={500}
            style={{ resize: 'vertical', fontSize: '.85rem', marginBottom: 6 }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleReply}
              disabled={!replyText.trim() || posting}
            >
              {posting ? 'Posting…' : 'Reply'}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setShowReply(false); setReplyText(''); }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Nested replies */}
      {showReplies && replies.map(r => (
        <CommentItem
          key={r.id}
          comment={r}
          quizId={quizId}
          currentUser={currentUser}
          depth={depth + 1}
          onDelete={handleReplyDelete}
        />
      ))}
    </div>
  );
}

export default function CommentsSection({ quizId }) {
  const { user }   = useAuth();
  const [comments, setComments] = useState([]);
  const [body,     setBody]     = useState('');
  const [sort,     setSort]     = useState('newest');
  const [loading,  setLoading]  = useState(false);
  const [posting,  setPosting]  = useState(false);
  const [error,    setError]    = useState(null);

  const loadComments = useCallback(() => {
    if (!quizId) return;
    setLoading(true);
    setError(null);
    // Only fetch root comments (no parent_id)
    api.get(`/quizzes/${quizId}/comments?sort=${sort}`)
      .then(r => setComments(Array.isArray(r.data) ? r.data : []))
      .catch(e => setError(e.response?.data?.error || 'Failed to load comments.'))
      .finally(() => setLoading(false));
  }, [quizId, sort]);

  useEffect(() => { loadComments(); }, [loadComments]);

  const handlePost = async () => {
    if (!body.trim() || posting) return;
    setPosting(true);
    try {
      const { data } = await api.post(`/quizzes/${quizId}/comments`, { body: body.trim() });
      setComments(prev => [data, ...prev]);
      setBody('');
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to post comment.');
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = useCallback((id) => {
    setComments(prev => prev.filter(c => c.id !== id));
  }, []);

  const pinned   = comments.filter(c => c.is_pinned && !c.is_removed);
  const unpinned = comments.filter(c => !c.is_pinned && !c.is_removed);

  return (
    <div style={{ marginTop: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="section-title" style={{ margin: 0 }}>
          💬 Comments ({comments.filter(c => !c.is_removed).length})
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['newest', 'top'].map(s => (
            <button
              key={s}
              onClick={() => setSort(s)}
              style={{
                padding: '4px 12px', borderRadius: 50, border: '1px solid var(--border)',
                fontSize: '.75rem', cursor: 'pointer',
                background: sort === s ? 'var(--accent)' : 'transparent',
                color: sort === s ? '#fff' : 'var(--text2)',
              }}
            >
              {s === 'newest' ? 'New' : 'Top'}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: '.85rem', marginBottom: 12 }}>
          ⚠️ {error} —{' '}
          <button onClick={loadComments} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: '.85rem' }}>
            Retry
          </button>
        </div>
      )}

      {/* Post comment */}
      {user ? (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Avatar user={user} size={32} />
            <div style={{ flex: 1 }}>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Share your thoughts about this quiz…"
                value={body}
                onChange={e => setBody(e.target.value)}
                maxLength={500}
                style={{ resize: 'vertical', minHeight: 72, marginBottom: 6 }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '.72rem', color: 'var(--text3)' }}>{body.length}/500</span>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handlePost}
                  disabled={!body.trim() || posting}
                >
                  {posting ? 'Posting…' : 'Post Comment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
          padding: '12px 16px', marginBottom: 20, fontSize: '.85rem', color: 'var(--text3)', textAlign: 'center',
        }}>
          Sign in to join the discussion
        </div>
      )}

      {/* Comments list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: 64, borderRadius: 10 }} />
          ))}
        </div>
      ) : comments.filter(c => !c.is_removed).length === 0 && !error ? (
        <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '24px 0', fontSize: '.88rem' }}>
          No comments yet. Be the first!
        </div>
      ) : (
        <div>
          {pinned.map(c => (
            <CommentItem key={c.id} comment={c} quizId={quizId} currentUser={user} depth={0} onDelete={handleDelete} />
          ))}
          {unpinned.map(c => (
            <CommentItem key={c.id} comment={c} quizId={quizId} currentUser={user} depth={0} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}