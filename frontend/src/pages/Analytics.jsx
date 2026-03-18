import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Users, TrendingUp, Clock, CalendarDays } from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Legend, CartesianAxis
} from 'recharts';

const Analytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Default to 30 days view for advanced analytics
  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      // Re-using dashboard endpoint for simplicity, in a real app these would be separate metrics
      const res = await api.get('/analytics/dashboard');
      // Mocking some advanced data based on dashboard data for the requested charts
      const baseTrend = res.data.trend;
      
      const advancedData = {
        avgAttendance: res.data.attendanceRate,
        trendPercent: 12.5, // Mock positive trend
        totalRecords: 112, // Mock historical volume
        lateArrivals: res.data.lateToday + 12, // Mock sum
        attendanceOverTime: baseTrend, // Use 7 day for now
        peakHours: [
          { time: '08:00', count: 15 },
          { time: '09:00', count: 45 },
          { time: '10:00', count: 12 },
          { time: '11:00', count: 4 }
        ],
        departmentWise: [
          { name: 'Engineering', present: 45, absent: 5 },
          { name: 'Marketing', present: 20, absent: 2 },
          { name: 'Sales', present: 30, absent: 8 }
        ]
      };
      
      setData(advancedData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) return <div>Loading Analytics...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Advanced Analytics</h1>
          <p style={{ color: 'var(--text-muted)' }}>Detailed insights and attendance patterns</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--surface)', padding: '0.25rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
          <button style={{ padding: '0.5rem 1rem', borderRadius: '0.25rem', backgroundColor: 'transparent', color: 'var(--text-muted)' }}>7 Days</button>
          <button style={{ padding: '0.5rem 1rem', borderRadius: '0.25rem', backgroundColor: 'var(--primary)', color: 'white', fontWeight: 500, boxShadow: 'var(--shadow)' }}>30 Days</button>
          <button style={{ padding: '0.5rem 1rem', borderRadius: '0.25rem', backgroundColor: 'transparent', color: 'var(--text-muted)' }}>90 Days</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card glass animate-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Avg. Attendance</p>
              <h2 style={{ fontSize: '2rem', margin: 0 }}>{data.avgAttendance.toFixed(1)}%</h2>
            </div>
            <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '0.75rem', borderRadius: '0.5rem' }}>
              <Users size={24} />
            </div>
          </div>
        </div>
        
        <div className="card glass animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Trend</p>
              <h2 style={{ fontSize: '2rem', margin: 0, color: 'var(--success)' }}>+{data.trendPercent}%</h2>
            </div>
            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '0.75rem', borderRadius: '0.5rem' }}>
              <TrendingUp size={24} />
            </div>
          </div>
        </div>

        <div className="card glass animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Total Records</p>
              <h2 style={{ fontSize: '2rem', margin: 0 }}>{data.totalRecords}</h2>
            </div>
            <div style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', padding: '0.75rem', borderRadius: '0.5rem' }}>
              <CalendarDays size={24} />
            </div>
          </div>
        </div>

        <div className="card glass animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Late Arrivals</p>
              <h2 style={{ fontSize: '2rem', margin: 0, color: 'var(--warning)' }}>{data.lateArrivals}</h2>
            </div>
            <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', padding: '0.75rem', borderRadius: '0.5rem' }}>
              <Clock size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="card glass animate-fade-in" style={{ animationDelay: '0.4s', padding: '1.5rem', marginBottom: '2rem', height: '400px' }}>
        <h3 style={{ fontSize: '1.125rem', marginBottom: '1.5rem' }}>Attendance Rate Over Time</h3>
        <ResponsiveContainer width="100%" height="90%">
          <AreaChart data={data.attendanceOverTime}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)'}} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)'}} />
            <RechartsTooltip 
              contentStyle={{ borderRadius: '0.5rem', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
            />
            <defs>
              <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="presentCount" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorPresent)" activeDot={{ r: 8 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        <div className="card glass animate-fade-in" style={{ animationDelay: '0.5s', padding: '1.5rem', height: '350px' }}>
          <h3 style={{ fontSize: '1.125rem', marginBottom: '1.5rem' }}>Department-wise Attendance</h3>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={data.departmentWise}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)'}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)'}} />
              <RechartsTooltip cursor={{fill: 'rgba(99, 102, 241, 0.05)'}} contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: 'var(--shadow)' }} />
              <Legend wrapperStyle={{ paddingTop: '10px' }} />
              <Bar dataKey="present" fill="var(--success)" radius={[4, 4, 0, 0]} barSize={30} />
              <Bar dataKey="absent" fill="var(--danger)" radius={[4, 4, 0, 0]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card glass animate-fade-in" style={{ animationDelay: '0.6s', padding: '1.5rem', height: '350px' }}>
          <h3 style={{ fontSize: '1.125rem', marginBottom: '1.5rem' }}>Peak Attendance Hours</h3>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={data.peakHours}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)'}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)'}} />
              <RechartsTooltip cursor={{fill: 'rgba(99, 102, 241, 0.05)'}} contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: 'var(--shadow)' }} />
              <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
