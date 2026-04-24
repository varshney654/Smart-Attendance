import React, { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import { Download, FileText, Calendar, Users, Filter, BarChart2, Table as TableIcon } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

const Reports = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportType, setReportType] = useState('Individual');
  const [selectedUserId, setSelectedUserId] = useState('');
  
  const [usersList, setUsersList] = useState([]);
  const [allAttendance, setAllAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const [usersRes, attendanceRes] = await Promise.all([
          api.get('/users'),
          api.get('/attendance') 
        ]);
        setUsersList(usersRes.data);
        setAllAttendance(attendanceRes.data);
      } catch (err) {
        console.error('Failed to fetch data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  // Strict Filtering Logic
  const filteredData = useMemo(() => {
    if (!allAttendance.length) return [];
    
    let data = [...allAttendance];

    // Filter by Date Range (Inclusive)
    if (startDate) {
      data = data.filter(record => new Date(record.date) >= new Date(startDate));
    }
    if (endDate) {
      // Need to include the entire end date day
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      data = data.filter(record => new Date(record.date) <= end);
    }

    // Filter by User / Report Type
    if (reportType === 'Individual') {
      if (!selectedUserId) return []; // Require user selection
      data = data.filter(record => record.userId === selectedUserId);
    }

    // Sort chronologically ascending for the chart
    data.sort((a, b) => new Date(a.date) - new Date(b.date));
    return data;
  }, [allAttendance, startDate, endDate, reportType, selectedUserId]);

  // Compute Summary Metrics
  const summary = useMemo(() => {
    const total = filteredData.length;
    if (total === 0) return { total: 0, present: 0, late: 0, absent: 0, rate: 0 };

    let p = 0, l = 0, a = 0;
    filteredData.forEach(r => {
      if (r.status === 'Present') p++;
      else if (r.status === 'Late') l++;
      else if (r.status === 'Absent') a++;
    });

    return {
      total,
      present: p,
      late: l,
      absent: a,
      rate: ((p + l) / total) * 100
    };
  }, [filteredData]);

  // Compute Chart Data (Grouped by Date)
  const chartData = useMemo(() => {
    const grouped = {};
    filteredData.forEach(r => {
      const dateStr = new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      if (!grouped[dateStr]) {
        grouped[dateStr] = { date: dateStr, Present: 0, Late: 0, Absent: 0 };
      }
      if (r.status === 'Present') grouped[dateStr].Present++;
      else if (r.status === 'Late') grouped[dateStr].Late++;
      else if (r.status === 'Absent') grouped[dateStr].Absent++;
    });
    return Object.values(grouped);
  }, [filteredData]);

  const exportReport = () => {
    if (filteredData.length === 0) return;
    
    const headers = ['Date', 'Time', 'User', 'Status', 'Method', 'Confidence'];
    const csvContent = "data:text/csv;charset=utf-8," 
      + `Report Type: ${reportType}\n`
      + `Date Range: ${startDate || 'All Time'} to ${endDate || 'All Time'}\n\n`
      + headers.join(",") + "\n"
      + filteredData.map(e => `${new Date(e.date).toLocaleDateString()},${e.time},${e.userName},${e.status},${e.method},${e.confidence || 'N/A'}`).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `attendance_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Present': return <span className="badge badge-success" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>Present</span>;
      case 'Late': return <span className="badge badge-warning" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>Late</span>;
      case 'Absent': return <span className="badge badge-danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>Absent</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Reports</h1>
          <p style={{ color: 'var(--text-muted)' }}>Precision analytics engine for attendance tracking</p>
        </div>
        {filteredData.length > 0 && (
          <button className="btn btn-secondary" onClick={exportReport} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#10b981', color: 'white', border: 'none', boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.39)' }}>
            <Download size={18} /> Export CSV
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) 3.5fr', gap: '2rem' }}>
        
        {/* Left Panel: Report Parameters */}
        <div className="card glass animate-fade-in" style={{ height: 'fit-content', padding: '1.75rem', borderRadius: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
            <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '0.5rem', borderRadius: '0.5rem' }}>
              <Filter size={20} />
            </div>
            <h3 style={{ fontSize: '1.125rem', margin: 0, fontWeight: 600 }}>Report Parameters</h3>
          </div>

          <form onSubmit={e => e.preventDefault()}>
            <div className="input-group" style={{ marginBottom: '1.5rem' }}>
              <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <FileText size={16} style={{ color: 'var(--primary)' }}/> Report Type
              </label>
              <select className="input-field" value={reportType} onChange={e => { setReportType(e.target.value); if (e.target.value !== 'Individual') setSelectedUserId(''); }} style={{ backgroundColor: '#f8fafc', border: '1px solid var(--border)' }}>
                <option value="Individual">Individual Report</option>
                <option value="Summary">Summary Report (Global)</option>
                <option value="Detailed">Detailed Daily Report</option>
              </select>
            </div>

            <div className="input-group" style={{ marginBottom: '1.5rem' }}>
              <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <Calendar size={16} style={{ color: 'var(--primary)' }} /> Date Range (Inclusive)
              </label>
              <div style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
                <div style={{ position: 'relative' }}>
                   <label style={{ position: 'absolute', top: '-8px', left: '10px', backgroundColor: 'white', padding: '0 4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Start Date</label>
                   <input 
                     type="date" 
                     className="input-field" 
                     value={startDate} 
                     onChange={(e) => setStartDate(e.target.value)}
                     style={{ backgroundColor: '#f8fafc', border: '1px solid var(--border)' }}
                   />
                </div>
                <div style={{ position: 'relative', marginTop: '0.5rem' }}>
                   <label style={{ position: 'absolute', top: '-8px', left: '10px', backgroundColor: 'white', padding: '0 4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>End Date</label>
                   <input 
                     type="date" 
                     className="input-field" 
                     value={endDate} 
                     onChange={(e) => setEndDate(e.target.value)}
                     style={{ backgroundColor: '#f8fafc', border: '1px solid var(--border)' }}
                   />
                </div>
              </div>
            </div>

            <div className="input-group" style={{ transition: 'opacity 0.3s ease', opacity: reportType === 'Individual' ? 1 : 0.5, marginBottom: '2rem' }}>
              <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <Users size={16} style={{ color: reportType === 'Individual' ? 'var(--primary)' : 'var(--text-muted)' }} /> Select Target User
              </label>
              <select 
                className="input-field" 
                value={selectedUserId} 
                onChange={e => setSelectedUserId(e.target.value)}
                disabled={reportType !== 'Individual'}
                style={{ backgroundColor: reportType === 'Individual' ? '#f8fafc' : '#f1f5f9', border: reportType === 'Individual' ? '2px solid var(--primary)' : '1px solid var(--border)' }}
              >
                <option value="">{reportType === 'Individual' ? '-- Select a User --' : 'N/A for Global'}</option>
                {usersList.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
              {reportType === 'Individual' && !selectedUserId && (
                 <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: 'var(--danger)' }}>* User selection is strictly required.</p>
              )}
            </div>
            
            <div style={{ padding: '1rem', backgroundColor: 'rgba(99, 102, 241, 0.05)', borderRadius: '0.5rem', border: '1px dashed rgba(99, 102, 241, 0.3)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
               <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>Active Filters:</h4>
               <span style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>• Type: {reportType}</span>
               <span style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>• User: {selectedUserId ? usersList.find(u => u.id === selectedUserId)?.name || 'Unknown' : 'All'}</span>
               <span style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>• Range: {startDate ? new Date(startDate).toLocaleDateString() : 'Min'} - {endDate ? new Date(endDate).toLocaleDateString() : 'Max'}</span>
            </div>
          </form>
        </div>

        {/* Right Panel: Results Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {loading ? (
             <div className="card glass" style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <BarChart2 size={48} className="pulse-animation" style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
                  <h3 style={{ margin: 0, color: 'var(--text-muted)' }}>Aggregating Ledger...</h3>
                </div>
             </div>
          ) : reportType === 'Individual' && !selectedUserId ? (
             <div className="card glass animate-fade-in" style={{ height: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', borderStyle: 'dashed', borderWidth: '2px', backgroundColor: '#f8fafc' }}>
              <div style={{ padding: '1rem', borderRadius: '50%', backgroundColor: 'white', marginBottom: '1rem', boxShadow: 'var(--shadow-sm)' }}>
                <Users size={48} style={{ color: 'var(--primary)', opacity: 0.5 }} />
              </div>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>Identity Required</h3>
              <p>Please strictly select a target user to generate their isolated report.</p>
            </div>
          ) : filteredData.length === 0 ? (
             <div className="card glass animate-fade-in" style={{ height: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', borderStyle: 'dashed', borderWidth: '2px', backgroundColor: '#f8fafc' }}>
              <div style={{ padding: '1rem', borderRadius: '50%', backgroundColor: 'white', marginBottom: '1rem', boxShadow: 'var(--shadow-sm)' }}>
                <BarChart2 size={48} style={{ color: 'var(--warning)', opacity: 0.5 }} />
              </div>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>No data points found</h3>
              <p>The selected temporal and identity constraints yielded 0 records.</p>
            </div>
          ) : (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem' }}>
                <div className="card glass" style={{ padding: '1.25rem', borderRadius: '1rem' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 600 }}>Total Records</p>
                  <h2 style={{ fontSize: '2rem', margin: 0, color: 'var(--text-main)' }}>{summary.total}</h2>
                </div>
                <div className="card glass" style={{ padding: '1.25rem', borderBottom: '4px solid var(--success)', borderRadius: '1rem' }}>
                  <p style={{ color: 'var(--success)', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 600 }}>Present</p>
                  <h2 style={{ fontSize: '2rem', margin: 0, color: 'var(--success)' }}>{summary.present}</h2>
                </div>
                <div className="card glass" style={{ padding: '1.25rem', borderBottom: '4px solid var(--warning)', borderRadius: '1rem' }}>
                  <p style={{ color: 'var(--warning)', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 600 }}>Late</p>
                  <h2 style={{ fontSize: '2rem', margin: 0, color: 'var(--warning)' }}>{summary.late}</h2>
                </div>
                <div className="card glass" style={{ padding: '1.25rem', borderBottom: '4px solid var(--danger)', borderRadius: '1rem' }}>
                  <p style={{ color: 'var(--danger)', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 600 }}>Absent</p>
                  <h2 style={{ fontSize: '2rem', margin: 0, color: 'var(--danger)' }}>{summary.absent}</h2>
                </div>
                <div className="card glass" style={{ padding: '1.25rem', background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.1))', border: '1px solid rgba(168,85,247,0.2)', borderRadius: '1rem' }}>
                  <p style={{ color: 'var(--primary)', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 600 }}>Attendance Rate</p>
                  <h2 style={{ fontSize: '2rem', margin: 0, color: 'var(--primary)' }}>{summary.rate.toFixed(1)}%</h2>
                </div>
              </div>

              {/* Analytics Graph */}
              <div className="card glass" style={{ padding: '1.75rem', borderRadius: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                  <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                    <BarChart2 size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 600 }}>Activity Graph</h3>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Distribution of statuses across the temporal constraint</p>
                  </div>
                </div>
                
                <div style={{ width: '100%', height: '320px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} tickMargin={12} axisLine={false} tickLine={false} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} axisLine={false} tickLine={false} allowDecimals={false} />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '0.75rem', border: 'none', boxShadow: 'var(--shadow-lg)' }}
                        itemStyle={{ fontWeight: 600 }}
                        cursor={{ stroke: 'var(--border)', strokeWidth: 2, strokeDasharray: '4 4' }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                      <Line type="monotone" dataKey="Present" stroke="var(--success)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} animationDuration={1000} />
                      <Line type="monotone" dataKey="Late" stroke="var(--warning)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} animationDuration={1000} />
                      <Line type="monotone" dataKey="Absent" stroke="var(--danger)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} animationDuration={1000} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Data Table */}
              <div className="card glass" style={{ padding: 0, borderRadius: '1rem', overflow: 'hidden' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'white' }}>
                  <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                    <TableIcon size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.125rem', margin: 0, fontWeight: 600 }}>Raw Data Log</h3>
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ width: '100%', minWidth: '800px' }}>
                    <thead style={{ backgroundColor: '#f8fafc' }}>
                      <tr>
                        <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                        <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time</th>
                        {reportType !== 'Individual' && <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>User</th>}
                        <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                        <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Method</th>
                        <th style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.slice(0, 50).map((record, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.2s' }}>
                          <td style={{ padding: '1.25rem 1.5rem', fontWeight: 500 }}>{new Date(record.date).toLocaleDateString()}</td>
                          <td style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)' }}>{record.time}</td>
                          {reportType !== 'Individual' && <td style={{ padding: '1.25rem 1.5rem', fontWeight: 600 }}>{record.userName}</td>}
                          <td style={{ padding: '1.25rem 1.5rem' }}>{getStatusBadge(record.status)}</td>
                          <td style={{ padding: '1.25rem 1.5rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: record.method === 'AI' ? 'var(--primary)' : 'var(--warning)', backgroundColor: record.method === 'AI' ? 'rgba(99,102,241,0.1)' : 'rgba(245,158,11,0.1)', padding: '0.3rem 0.6rem', borderRadius: '4px' }}>
                              {record.method}
                            </span>
                          </td>
                          <td style={{ padding: '1.25rem 1.5rem' }}>
                            {record.confidence ? `${record.confidence}%` : <span style={{ color: 'var(--text-muted)' }}>N/A</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredData.length > 50 && (
                     <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', borderTop: '1px solid var(--border)' }}>
                        Showing first 50 records. Export CSV to view all {filteredData.length} entries.
                     </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
