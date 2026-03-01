import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getUser, heartbeat as heartbeatApi } from '../lib/api';

const UserContext = createContext(null);

const STORAGE_KEY = 'connect-talent:userId';
const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage
  useEffect(() => {
    const storedId = localStorage.getItem(STORAGE_KEY);
    if (storedId) {
      getUser(storedId)
        .then((u) => setUser(u))
        .catch(() => {
          // Session expired or deleted
          localStorage.removeItem(STORAGE_KEY);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Periodic heartbeat to keep session alive
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      heartbeatApi(user.id).catch(() => {
        // Session expired
        setUser(null);
        localStorage.removeItem(STORAGE_KEY);
      });
    }, HEARTBEAT_INTERVAL);
    return () => clearInterval(interval);
  }, [user]);

  const login = useCallback((userData) => {
    setUser(userData);
    localStorage.setItem(STORAGE_KEY, userData.id);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!user) return;
    try {
      const updated = await getUser(user.id);
      setUser(updated);
    } catch {
      logout();
    }
  }, [user, logout]);

  return (
    <UserContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
