import React, { useState, useEffect, useContext } from 'react';
import api from '../utils/api';
import { Download, Search, Filter, Calendar, Plus, Edit, Trash2 } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

const Records = () => {
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === 'Admin';

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All Status');
  const [dateRange, setDateRange] = useState('All Time');

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [selectedRecordId, setSelectedRecordId] = useState('');
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({
    userId: '',
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    status: 'Present'
  });

  useEffect(() => {
    fetchRecords();
    if (isAdmin) fetchUsers();
  }, [status, dateRange, isAdmin]);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

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

  const openAddModal = () => {
    setModalMode('add');
    setFormData({ userId: '', date: new Date().toISOString().split('T')[0], time: '09:00', status: 'Present' });
    setShowModal(true);
  };

  const openEditModal = (record) => {
    setModalMode('edit');
    setSelectedRecordId(record.id);
    setFormData({
      userId: record.userId,
      date: new Date(record.date).toISOString().split('T')[0],
      time: record.time.includes(':') && record.time.split(':').length === 3 ? record.time.substr(0, 5) : record.time,
      status: record.status
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modalMode === 'add') {
        const payload = {
            userId: formData.userId,
            date: formData.date,
            time: formData.time + (formData.time.split(':').length === 2 ? ':00' : ''),
            status: formData.status
        };
        await api.post('/attendance/manual', payload);
        alert('Attendance added successfully');
      } else {
        const payload = {
            status: formData.status,
            time: formData.time + (formData.time.split(':').length === 2 ? ':00' : '')
        };
        await api.put(`/attendance/${selectedRecordId}`, payload);
        alert('Attendance updated successfully');
      }
      setShowModal(false);
      fetchRecords();
    } catch (err) {
      console.error('Update Error:', err.response?.data || err.message);
      alert(err.response?.data?.message || err.message || 'Failed to save attendance');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this attendance record?')) return;
    try {
      await api.delete(`/attendance/${id}`);
      fetchRecords();
    } catch (err) {
      console.error('Delete Error:', err.response?.data || err.message);
      alert(err.response?.data?.message || err.message || 'Failed to delete attendance record');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Attendance Records</h1>
          <p style={{ color: 'var(--text-muted)' }}>View and filter all attendance entries</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {isAdmin && (
            <button className="btn btn-primary" onClick={openAddModal}>
              <Plus size={18} /> Add Attendance
            </button>
          )}
          <button className="btn btn-success" style={{ backgroundColor: 'var(--success)', color: 'white' }} onClick={exportCSV}>
            <Download size={18} /> Export CSV
          </button>
        </div>
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
                {isAdmin && <th>Actions</th>}
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
                    <td>
                      {record.method === 'AI' ? (
                        <span className="badge badge-success">AI Match</span>
                      ) : (
                        <span className="badge badge-warning">Manual</span>
                      )}
                    </td>
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
                    {isAdmin && (
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }} onClick={() => openEditModal(record)} title="Edit">
                            <Edit size={18} />
                          </button>
                          <button style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }} onClick={() => handleDelete(record.id)} title="Delete">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', backgroundColor: 'white', padding: '2rem', borderRadius: '1rem' }}>
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>
              {modalMode === 'add' ? 'Add Manual Attendance' : 'Edit Attendance'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label className="input-label">User</label>
                <select 
                  className="input-field" 
                  value={formData.userId}
                  onChange={(e) => setFormData({...formData, userId: e.target.value})}
                  required
                  disabled={modalMode === 'edit'}
                >
                  <option value="">Select User</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                  ))}
                </select>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="input-group">
                  <label className="input-label">Date</label>
                  <input 
                    type="date" 
                    className="input-field"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    required
                    disabled={modalMode === 'edit'}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Time</label>
                  <input 
                    type="time" 
                    className="input-field"
                    value={formData.time}
                    onChange={(e) => setFormData({...formData, time: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Status</label>
                <select 
                  className="input-field"
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  required
                >
                  <option value="Present">Present</option>
                  <option value="Late">Late</option>
                  <option value="Absent">Absent</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  {modalMode === 'add' ? 'Save Attendance' : 'Update Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Records;
