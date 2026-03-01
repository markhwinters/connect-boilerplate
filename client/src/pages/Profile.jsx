import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User as UserIcon, Briefcase, Edit3, Trash2, Save, LogOut, Shield, Ghost, Sparkles } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { updateUser, deleteUser } from '../lib/api';
import GlassCard from '../components/GlassCard';
import KeywordBadge from '../components/KeywordBadge';
import CountdownBadge from '../components/CountdownBadge';

export default function Profile() {
  const { user, logout, refreshUser } = useUser();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    displayName: user?.displayName || '',
    jobTitle: user?.jobTitle || '',
  });
  const [keywords, setKeywords] = useState(user?.keywords || []);
  const [keywordInput, setKeywordInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const addKeyword = () => {
    const kw = keywordInput.trim().toLowerCase();
    if (kw && !keywords.includes(kw) && keywords.length < 10) {
      setKeywords([...keywords, kw]);
      setKeywordInput('');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUser(user.id, {
        displayName: form.displayName,
        jobTitle: form.jobTitle,
        keywords,
      });
      await refreshUser();
      setEditing(false);
    } catch (err) {
      console.error('Update failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteUser(user.id);
      logout();
      navigate('/');
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Profile header card */}
      <GlassCard className="text-center relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-accent-violet/5 to-transparent pointer-events-none" />

        <div className="relative z-10">
          <div className="w-20 h-20 mx-auto rounded-full gradient-bg flex items-center justify-center text-white text-3xl font-bold mb-4 shadow-lg shadow-accent-violet/20">
            {user?.displayName?.[0]?.toUpperCase() || '?'}
          </div>

          {editing ? (
            <input
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              className="text-xl font-bold text-white text-center bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-full max-w-xs mx-auto focus:outline-none focus:border-accent-violet/50 transition-all"
            />
          ) : (
            <h2 className="text-2xl font-bold text-white">{user?.displayName}</h2>
          )}

          <div className="flex items-center justify-center gap-2 mt-2 text-zinc-400 text-sm">
            <Briefcase className="w-4 h-4" />
            {editing ? (
              <input
                value={form.jobTitle}
                onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                placeholder="Your job title"
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-white text-sm focus:outline-none focus:border-accent-violet/50 transition-all"
              />
            ) : (
              <span>{user?.jobTitle || 'No title set'}</span>
            )}
          </div>

          <div className="flex items-center justify-center gap-1 mt-2 text-accent-fuchsia text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{user?.role === 'hr' ? 'Hiring' : 'Candidate'}</span>
          </div>

          <div className="mt-4">
            <CountdownBadge expiresAt={user?.expiresAt} />
          </div>
        </div>
      </GlassCard>

      {/* Keywords */}
      <GlassCard>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-accent-violet" />
            Skills & Keywords
          </h3>
          <span className="text-xs text-zinc-500">{keywords.length}/10</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {keywords.map((kw) => (
            <KeywordBadge
              key={kw}
              keyword={kw}
              onRemove={editing ? (k) => setKeywords(keywords.filter((x) => x !== k)) : undefined}
            />
          ))}
          {keywords.length === 0 && (
            <p className="text-zinc-600 text-sm">No keywords yet. Add some to get discovered!</p>
          )}
        </div>

        {editing && (
          <div className="flex gap-2 mt-3">
            <input
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
              placeholder="Add keyword..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-accent-violet/50 transition-all"
            />
            <button
              onClick={addKeyword}
              className="px-3 rounded-xl gradient-bg text-white text-sm hover:opacity-90 transition-opacity"
            >
              Add
            </button>
          </div>
        )}
      </GlassCard>

      {/* Actions */}
      <div className="space-y-3">
        {editing ? (
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 gradient-bg text-white font-medium py-3 rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setForm({ displayName: user?.displayName || '', jobTitle: user?.jobTitle || '' });
                setKeywords(user?.keywords || []);
              }}
              className="px-5 rounded-xl glass glass-hover text-zinc-400 hover:text-white transition-all"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            id="edit-profile-btn"
            onClick={() => setEditing(true)}
            className="w-full glass glass-hover text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Edit3 className="w-4 h-4" />
            Edit Profile
          </button>
        )}

        <button
          onClick={() => { logout(); navigate('/'); }}
          className="w-full glass glass-hover text-zinc-400 hover:text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Leave Session
        </button>

        {/* Self-destruct */}
        {!showDeleteConfirm ? (
          <button
            id="self-destruct-btn"
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full bg-danger/10 border border-danger/20 text-danger font-medium py-3 rounded-xl hover:bg-danger/20 transition-all flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Self-Destruct
          </button>
        ) : (
          <GlassCard className="border-danger/30 text-center">
            <Ghost className="w-8 h-8 text-danger mx-auto mb-2" />
            <p className="text-sm text-zinc-300 mb-4">
              This will permanently delete your session and all matches. Are you sure?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 glass glass-hover text-zinc-400 py-2.5 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 bg-danger text-white font-medium py-2.5 rounded-xl hover:bg-danger/90 transition-all"
              >
                Confirm Delete
              </button>
            </div>
          </GlassCard>
        )}
      </div>
    </div>
  );
}
