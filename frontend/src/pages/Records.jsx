import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Download, Search, Filter, Calendar } from 'lucide-react';

const Records = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All Status');
  const [dateRange, setDateRange] = useState('All Time');

  useEffect(() => {
    fetchRecords();
  }, [status, dateRange]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await api.get('/attendance', {
        params: { status, dateRange }
      });
      setRecords(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = records.filter(record => 
    record.userName.toLowerCase().includes(search.toLowerCase())
  );

  const exportCSV = () => {
    const headers = ['Date', 'Time', 'User', 'Status', 'Method', 'Confidence'];
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + filteredRecords.map(e => `${new Date(e.date).toLocaleDateString()},${e.time},${e.userName},${e.status},${e.method},${e.confidence || 'N/A'}`).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "attendance_records.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Present': return <span className="badge badge-success">Present</span>;
      case 'Late': return <span className="badge badge-warning">Late</span>;
      case 'Absent': return <span className="badge badge-danger">Absent</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Attendance Records</h1>
          <p style={{ color: 'var(--text-muted)' }}>View and filter all attendance entries</p>
        </div>
        <button className="btn btn-success" style={{ backgroundColor: 'var(--success)', color: 'white' }} onClick={exportCSV}>
          <Download size={18} />
          Export CSV
        </button>
      </div>

      <div className="card glass animate-fade-in" style={{ padding: '0', overflow: 'hidden' }}>
        {/* Filters Top Bar */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>
          
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Search size={16} /> Search User
            </label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Search by name..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Filter size={16} /> Status
            </label>
            <select className="input-field" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="All Status">All Status</option>
              <option value="Present">Present</option>
              <option value="Late">Late</option>
              <option value="Absent">Absent</option>
            </select>
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={16} /> Date Range
            </label>
            <select className="input-field" value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
              <option value="All Time">All Time</option>
              <option value="7 Days">Last 7 Days</option>
              <option value="30 Days">Last 30 Days</option>
            </select>
          </div>
        </div>

        <div style={{ padding: '1rem 1.5rem', backgroundColor: '#f8fafc', color: 'var(--text-muted)', fontSize: '0.875rem', borderBottom: '1px solid var(--border)' }}>
          Showing {filteredRecords.length} records
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>User</th>
                <th>Status</th>
                <th>Method</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>Loading records...</td></tr>
              ) : filteredRecords.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No records found</td></tr>
              ) : (
                filteredRecords.map(record => (
                  <tr key={record.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Calendar size={16} color="var(--text-muted)" />
                        {new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </td>
                    <td>{record.time}</td>
                    <td style={{ fontWeight: 500 }}>{record.userName}</td>
                    <td>{getStatusBadge(record.status)}</td>
                    <td>{record.method}</td>
                    <td>
                      {record.confidence ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: '60px', height: '6px', backgroundColor: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ 
                              width: `${record.confidence}%`, 
                              height: '100%', 
                              backgroundColor: record.confidence > 90 ? 'var(--primary)' : 'var(--warning)'
                            }}></div>
                          </div>
                          <span style={{ fontSize: '0.75rem' }}>{record.confidence}%</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>N/A</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Records;
