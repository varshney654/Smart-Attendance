import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Users, TrendingUp, Clock, CalendarDays } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from 'recharts';

const Analytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30 Days');

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      // Fetch dashboard data
      const res = await api.get('/analytics/dashboard');

      // Calculate days based on timeRange
      let days = 30;
      if (timeRange === '7 Days') days = 7;
      else if (timeRange === '90 Days') days = 90;

      // Fetch all attendance records for the period
      const recordsRes = await api.get('/attendance', {
        params: { dateRange: timeRange }
      });

      const records = recordsRes.data;
      const totalRecords = records.length;

      // Calculate late arrivals from real data
      const lateArrivals = records.filter(r => r.status === 'Late').length;

      // Calculate real trend percentage
      const presentCount = records.filter(r => r.status === 'Present' || r.status === 'Late').length;
      const avgAttendance = totalRecords > 0 ? (presentCount / totalRecords) * 100 : 0;

      // Calculate trend (compare first half to second half of period)
      const midPoint = Math.floor(totalRecords / 2);
      const firstHalfPresent = records.slice(0, midPoint).filter(r => r.status === 'Present' || r.status === 'Late').length;
      const secondHalfPresent = records.slice(midPoint).filter(r => r.status === 'Present' || r.status === 'Late').length;
      const firstHalfTotal = Math.max(1, midPoint);
      const secondHalfTotal = Math.max(1, totalRecords - midPoint);
      const firstHalfRate = (firstHalfPresent / firstHalfTotal) * 100;
      const secondHalfRate = (secondHalfPresent / secondHalfTotal) * 100;
      const trendPercent = firstHalfTotal > 0 ? ((secondHalfRate - firstHalfRate) / Math.max(1, firstHalfRate)) * 100 : 0;

      // Get department-wise data from users
      const usersRes = await api.get('/users');
      const users = usersRes.data;

      // Group users by department
      const departmentMap = {};
      users.forEach(user => {
        const dept = user.department || 'Other';
        if (!departmentMap[dept]) {
          departmentMap[dept] = { present: 0, absent: 0, total: 0 };
        }
        departmentMap[dept].total++;
      });

      // Count attendance by department (simplified - just use total records for now)
      const deptData = Object.keys(departmentMap).map(dept => ({
        name: dept,
        present: Math.round(departmentMap[dept].total * (avgAttendance / 100)),
        absent: departmentMap[dept].total - Math.round(departmentMap[dept].total * (avgAttendance / 100))
      }));

      // Generate attendance over time data
      const baseTrend = res.data.trend || [];
      const attendanceOverTime = baseTrend.map(item => ({
        day: item.day,
        presentCount: item.presentCount
      }));

      // Peak hours - calculate from real data
      const hourMap = {};
      records.forEach(record => {
        if (record.time) {
          const hour = record.time.split(':')[0];
          hourMap[hour] = (hourMap[hour] || 0) + 1;
        }
      });

      const peakHours = Object.keys(hourMap)
        .sort()
        .slice(0, 6)
        .map(hour => ({
          time: `${hour}:00`,
          count: hourMap[hour]
        }));

      const advancedData = {
        avgAttendance: avgAttendance,
        trendPercent: trendPercent.toFixed(1),
        totalRecords: totalRecords,
        lateArrivals: lateArrivals,
        attendanceOverTime: attendanceOverTime,
        peakHours: peakHours.length > 0 ? peakHours : [
          { time: '09:00', count: 0 },
          { time: '10:00', count: 0 },
          { time: '11:00', count: 0 }
        ],
        departmentWise: deptData.length > 0 ? deptData : [
          { name: 'No Data', present: 0, absent: 0 }
        ]
      };

      setData(advancedData);
    } catch (error) {
      console.error(error);
      // Set empty data on error
      setData({
        avgAttendance: 0,
        trendPercent: 0,
        totalRecords: 0,
        lateArrivals: 0,
        attendanceOverTime: [],
        peakHours: [],
        departmentWise: []
      });
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
          <button
            onClick={() => setTimeRange('7 Days')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.25rem',
              backgroundColor: timeRange === '7 Days' ? 'var(--primary)' : 'transparent',
              color: timeRange === '7 Days' ? 'white' : 'var(--text-muted)',
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer'
            }}
          >
            7 Days
          </button>
          <button
            onClick={() => setTimeRange('30 Days')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.25rem',
              backgroundColor: timeRange === '30 Days' ? 'var(--primary)' : 'transparent',
              color: timeRange === '30 Days' ? 'white' : 'var(--text-muted)',
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer'
            }}
          >
            30 Days
          </button>
          <button
            onClick={() => setTimeRange('90 Days')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.25rem',
              backgroundColor: timeRange === '90 Days' ? 'var(--primary)' : 'transparent',
              color: timeRange === '90 Days' ? 'white' : 'var(--text-muted)',
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer'
            }}
          >
            90 Days
          </button>
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
              <h2 style={{ fontSize: '2rem', margin: 0, color: parseFloat(data.trendPercent) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {parseFloat(data.trendPercent) >= 0 ? '+' : ''}{data.trendPercent}%
              </h2>
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
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)' }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)' }} />
            <RechartsTooltip
              contentStyle={{ borderRadius: '0.5rem', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
            />
            <defs>
              <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
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
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)' }} />
              <RechartsTooltip cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: 'var(--shadow)' }} />
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
              <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)' }} />
              <RechartsTooltip cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: 'var(--shadow)' }} />
              <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
