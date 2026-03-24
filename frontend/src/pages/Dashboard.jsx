import React, { useState, useEffect, useContext } from 'react';
import api from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import { Users, UserCheck, UserX, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#10b981', '#f59e0b', '#ef4444']; // Present, Late, Absent

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const res = await api.get('/analytics/dashboard');
      setData(res.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!data) return <div>Failed to load data</div>;

  const pieData = [
    { name: 'Present', value: data.statusDistribution.present },
    { name: 'Late', value: data.statusDistribution.late },
    { name: 'Absent', value: data.statusDistribution.absent },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
        {user?.profileImage ? (
          <img src={user.profileImage} alt={user.name} style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '3px solid white', boxShadow: 'var(--shadow-md)' }} />
        ) : (
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold', border: '3px solid white', boxShadow: 'var(--shadow-md)' }}>
            {user?.name?.charAt(0) || 'U'}
          </div>
        )}
        <div>
          <h1 style={{ fontSize: '1.875rem', marginBottom: '0.25rem' }}>Welcome back, {user?.name}</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Real-time attendance monitoring and analytics</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card glass animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Total Users</p>
              <h2 style={{ fontSize: '2rem', margin: 0 }}>{data.totalUsers}</h2>
            </div>
            <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '0.75rem', borderRadius: '0.5rem' }}>
              <Users size={24} />
            </div>
          </div>
        </div>

        <div className="card glass animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Present Today</p>
              <h2 style={{ fontSize: '2rem', margin: 0 }}>{data.presentToday}</h2>
              <p style={{ color: 'var(--warning)', fontSize: '0.75rem', marginTop: '0.25rem' }}>+{data.lateToday} late arrivals</p>
            </div>
            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '0.75rem', borderRadius: '0.5rem' }}>
              <UserCheck size={24} />
            </div>
          </div>
        </div>

        <div className="card glass animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Absent Today</p>
              <h2 style={{ fontSize: '2rem', margin: 0 }}>{data.absentToday}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                {data.totalUsers > 0 ? ((data.absentToday / data.totalUsers) * 100).toFixed(0) : 0}% of total
              </p>
            </div>
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '0.75rem', borderRadius: '0.5rem' }}>
              <UserX size={24} />
            </div>
          </div>
        </div>

        <div className="card glass animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Attendance Rate</p>
              <h2 style={{ fontSize: '2rem', margin: 0 }}>{data.attendanceRate.toFixed(1)}%</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>Last 30 days</p>
            </div>
            <div style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', padding: '0.75rem', borderRadius: '0.5rem' }}>
              <TrendingUp size={24} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        <div className="card glass animate-fade-in" style={{ animationDelay: '0.5s', padding: '1.5rem', height: '400px' }}>
          <h3 style={{ fontSize: '1.125rem', marginBottom: '1.5rem' }}>7-Day Attendance Trend</h3>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={data.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <RechartsTooltip 
                contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: 'var(--shadow-lg)' }}
              />
              <Line type="monotone" dataKey="presentCount" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4, fill: 'var(--primary)' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card glass animate-fade-in" style={{ animationDelay: '0.6s', padding: '1.5rem', height: '400px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.125rem', marginBottom: '1.5rem' }}>Today's Status Distribution</h3>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: 'var(--shadow-lg)' }}
                  formatter={(value, name) => [`${value} Users`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '1rem' }}>
            {pieData.map((entry, index) => (
              <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: COLORS[index] }}></div>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{entry.name}: {entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
