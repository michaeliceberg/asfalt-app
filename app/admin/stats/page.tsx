// app/admin/stats/page.tsx
'use client';

import { useEffect, useState } from 'react';

interface User {
  id: number;
  username: string;
  group_name: string;
  last_login_at: number | null;
  login_count: number;
}

interface UserLog {
  id: number;
  user_id: number;
  login_time: number;
  ip_address: string | null;
  user_agent: string | null;
  session_duration: number | null;
}

interface Stats {
  users: User[];
  totalLogins: number;
  activeToday: number;
}

export default function AdminStats() {
  const [stats, setStats] = useState<Stats>({ users: [], totalLogins: 0, activeToday: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedUserLogs, setSelectedUserLogs] = useState<UserLog[] | null>(null);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load stats:', err);
        setLoading(false);
      });
  }, []);

  const viewUserLogs = async (userId: number) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/logs`);
      const logs: UserLog[] = await response.json();
      setSelectedUserLogs(logs);
    } catch (err) {
      console.error('Failed to load user logs:', err);
    }
  };

  const closeLogs = () => {
    setSelectedUserLogs(null);
  };

  if (loading) return <div className="loading"><div className="spinner"></div><p>Загрузка...</p></div>;

  return (
    <div className="admin-stats">
      <h1>📊 Статистика пользователей</h1>
      
      <div className="stats-cards">
        <div className="stat-card">
          <h3>Всего пользователей</h3>
          <p>{stats.users.length}</p>
        </div>
        <div className="stat-card">
          <h3>Всего входов</h3>
          <p>{stats.totalLogins}</p>
        </div>
        <div className="stat-card">
          <h3>Активны сегодня</h3>
          <p>{stats.activeToday}</p>
        </div>
      </div>
      
      <div className="table-container">
        <table className="stats-table">
          <thead>
            <tr>
              <th>Пользователь</th>
              <th>Группа</th>
              <th>Последний вход</th>
              <th>Всего входов</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {stats.users.map((user) => (
              <tr key={user.id}>
                <td>{user.username}</td>
                <td>{user.group_name}</td>
                <td>{user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'никогда'}</td>
                <td>{user.login_count}</td>
                <td>
                  <button 
                    className="view-logs-btn"
                    onClick={() => viewUserLogs(user.id)}
                  >
                    📋 Логи
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Модальное окно с логами */}
      {selectedUserLogs && (
        <div className="modal-overlay" onClick={closeLogs}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📋 История входов</h3>
              <button className="modal-close" onClick={closeLogs}>✕</button>
            </div>
            <div className="modal-body">
              {selectedUserLogs.length === 0 ? (
                <p>Нет записей о входах</p>
              ) : (
                <table className="logs-table">
                  <thead>
                    <tr>
                      <th>Время входа</th>
                      <th>IP адрес</th>
                      <th>User Agent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedUserLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{new Date(log.login_time).toLocaleString()}</td>
                        <td>{log.ip_address || '—'}</td>
                        <td className="user-agent-cell">{log.user_agent?.substring(0, 50)}...</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}