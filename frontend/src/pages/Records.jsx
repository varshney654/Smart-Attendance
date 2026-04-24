import React, { useState, useEffect, useContext, useRef } from 'react';
import api from '../utils/api';
import { Download, Search, Filter, Calendar, Plus, Edit, Trash2, MapPin, ChevronDown, Loader2 } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

const Records = () => {
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === 'Admin';

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef(null);
  
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

  // Click outside listener for search combobox
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchInputRef.current && !searchInputRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    setError(null);
    try {
      const res = await api.get('/attendance', {
        params: { status, dateRange }
      });
      if (Array.isArray(res.data)) {
        setRecords(res.data);
      } else {
        console.error('API did not return an array:', res.data);
        setRecords([]);
      }
    } catch (err) {
      console.error('Error fetching records:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load records from server.');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  // Safety fallback for records
  const safeRecords = Array.isArray(records) ? records : [];

  // Derive unique user names safely for combobox suggestions
  const uniqueNames = Array.from(new Set(
    safeRecords
      .map(r => r?.userName)
      .filter(name => typeof name === 'string' && name.trim() !== '')
  ));
  const searchSuggestions = uniqueNames.filter(name => 
    name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Apply client-side text filtering safely
  const filteredRecords = safeRecords.filter(record => {
    const name = record?.userName || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const exportCSV = () => {
    const headers = ['Date', 'Time', 'User', 'Status', 'Method', 'Confidence', 'Location'];
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + filteredRecords.map(e => `${new Date(e.date).toLocaleDateString()},${e.time},${e.userName},${e.status},${e.method},${e.confidence || 'N/A'},${e.latitude ? e.latitude.toFixed(4) + ' / ' + e.longitude.toFixed(4) : 'Unknown'}`).join("\n");
      
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
      case 'Present': return <span className="badge badge-success" style={{ fontWeight: 600, padding: '0.4rem 0.8rem' }}>Present</span>;
      case 'Late': return <span className="badge badge-warning" style={{ fontWeight: 600, padding: '0.4rem 0.8rem' }}>Late</span>;
      case 'Absent': return <span className="badge badge-danger" style={{ fontWeight: 600, padding: '0.4rem 0.8rem' }}>Absent</span>;
      default: return <span className="badge" style={{ fontWeight: 600, padding: '0.4rem 0.8rem' }}>{status}</span>;
    }
  };

  const handleSuggestionClick = (name) => {
    setSearchQuery(name);
    setShowSuggestions(false);
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
      alert(err.response?.data?.message || err.message || 'Failed to save attendance');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this attendance record?')) return;
    try {
      await api.delete(`/attendance/${id}`);
      fetchRecords();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to delete record');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Attendance Records</h1>
          <p style={{ color: 'var(--text-muted)' }}>Comprehensive overview of all attendance checkpoints</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {isAdmin && (
            <button className="btn btn-primary" onClick={openAddModal} style={{ boxShadow: 'var(--shadow-md)' }}>
              <Plus size={18} /> Add Attendance
            </button>
          )}
          <button className="btn btn-secondary" onClick={exportCSV} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.39)' }}>
            <Download size={18} /> Export CSV
          </button>
        </div>
      </div>

      <div className="card glass animate-fade-in" style={{ padding: '0', overflow: 'hidden', borderRadius: '1rem' }}>
        
        {/* Advanced Filters Top Bar */}
        <div style={{ padding: '1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* Smart Autocomplete Search */}
          <div className="input-group" style={{ marginBottom: 0, position: 'relative' }} ref={searchInputRef}>
            <label className="input-label" style={{ fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Search size={16} style={{ color: 'var(--primary)' }} /> Search User Identity
            </label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Start typing a name..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              style={{ paddingLeft: '1.2rem', paddingRight: '2rem', height: '48px', fontSize: '1rem' }}
            />
            {showSuggestions && searchQuery && searchSuggestions.length > 0 && (
              <div 
                className="animate-fade-in"
                style={{ position: 'absolute', top: 'calc(100% + 0.5rem)', left: 0, right: 0, backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: 'var(--shadow-lg)', zIndex: 50, border: '1px solid var(--border)', overflow: 'hidden', maxHeight: '250px', overflowY: 'auto' }}
              >
                {searchSuggestions.slice(0, 8).map((suggestion, idx) => (
                  <div 
                     key={idx}
                     style={{ padding: '0.85rem 1.25rem', cursor: 'pointer', borderBottom: '1px solid var(--border)', transition: 'background-color 0.2s ease', color: 'var(--text-main)' }}
                     onClick={() => handleSuggestionClick(suggestion)}
                     onMouseEnter={(e) => e.target.style.backgroundColor = '#f1f5f9'}
                     onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            )}
            {showSuggestions && searchQuery && searchSuggestions.length === 0 && (
              <div style={{ position: 'absolute', top: 'calc(100% + 0.5rem)', left: 0, right: 0, backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: 'var(--shadow-md)', zIndex: 50, border: '1px solid var(--border)', padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No active suggestions found for "{searchQuery}". Table will filter by exact text.
              </div>
            )}
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" style={{ fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Filter size={16} style={{ color: 'var(--primary)' }} /> Status Override
            </label>
            <div style={{ position: 'relative' }}>
              <select className="input-field" value={status} onChange={(e) => setStatus(e.target.value)} style={{ height: '48px', appearance: 'none', paddingRight: '2.5rem' }}>
                <option value="All Status">Display All Classes</option>
                <option value="Present">Present Only</option>
                <option value="Late">Late Only</option>
                <option value="Absent">Absent Only</option>
              </select>
              <ChevronDown size={18} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            </div>
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" style={{ fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={16} style={{ color: 'var(--primary)' }} /> Temporal Range
            </label>
            <div style={{ position: 'relative' }}>
              <select className="input-field" value={dateRange} onChange={(e) => setDateRange(e.target.value)} style={{ height: '48px', appearance: 'none', paddingRight: '2.5rem' }}>
                <option value="All Time">Lifetime Overview</option>
                <option value="7 Days">Trailing 7 Days</option>
                <option value="30 Days">Trailing 30 Days</option>
                <option value="Custom">Custom Interval</option>
              </select>
              <ChevronDown size={18} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            </div>
            {dateRange === 'Custom' && (
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: 'var(--warning)', fontStyle: 'italic' }}>* Custom range API binding pending backend support.</p>
            )}
          </div>
        </div>

        <div style={{ padding: '1rem 1.5rem', backgroundColor: 'white', color: 'var(--text-muted)', fontSize: '0.875rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <span>Currently displaying <strong>{filteredRecords.length}</strong> dynamic entries.</span>
        </div>

        {/* Modern Table Layout */}
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', minWidth: '950px' }}>
            <thead style={{ backgroundColor: '#f8fafc' }}>
              <tr>
                <th style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.05em' }}>Date & Time</th>
                <th style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.05em' }}>User Profile</th>
                <th style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.05em' }}>Live Status</th>
                <th style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.05em' }}>Method</th>
                <th style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.05em' }}>Confidence Level</th>
                <th style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.05em' }}>GPS Origin</th>
                {isAdmin && <th style={{ padding: '1.25rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '4rem 2rem' }}><Loader2 className="pulse-animation" size={32} style={{ color: 'var(--primary)', margin: '0 auto' }} /></td></tr>
              ) : error ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', color: 'var(--danger)' }}>
                      <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Error Loading Records</p>
                      <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{error}</p>
                      <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={fetchRecords}>Retry Request</button>
                    </div>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', color: 'var(--text-muted)' }}>
                      <Search size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                      <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 500 }}>No attendance records found matching current spatial parameters.</p>
                      <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={() => { setSearchQuery(''); setStatus('All Status'); setDateRange('All Time'); }}>Clear All Filters</button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map(record => (
                  <tr key={record?.id || Math.random()} style={{ transition: 'background-color 0.2s ease', borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                          {record?.date ? new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown Date'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          <Calendar size={12} /> {record?.time || '--:--'}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '1rem' }}>{record?.userName || 'Unknown User'}</div>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      {getStatusBadge(record?.status || 'Unknown')}
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      {record?.method === 'AI' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}>Facial Match</span>
                        </div>
                      ) : (
                        <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}>Manual Entry</span>
                      )}
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem', width: '200px' }}>
                      {record?.confidence ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ flex: 1, height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ 
                              width: `${Math.min(100, Math.max(0, record.confidence))}%`, 
                              height: '100%', 
                              backgroundColor: record.confidence >= 80 ? 'var(--success)' : record.confidence >= 55 ? 'var(--warning)' : 'var(--danger)',
                              transition: 'width 1s ease-out'
                            }} />
                          </div>
                          <span style={{ fontSize: '0.9rem', fontWeight: 600, minWidth: '40px', color: 'var(--text-main)' }}>{record.confidence}%</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>Unverified</span>
                      )}
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      {record?.latitude && record?.longitude ? (
                         <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.85rem', backgroundColor: '#f1f5f9', padding: '0.4rem 0.6rem', borderRadius: '0.5rem', display: 'inline-flex' }}>
                           <MapPin size={14} color="var(--primary)" />
                           {record.latitude.toFixed(4)}, {record.longitude.toFixed(4)}
                         </div>
                      ) : (
                         <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Data Obfuscated</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                          <button style={{ background: 'rgba(99,102,241,0.1)', padding: '0.5rem', borderRadius: '0.5rem', border: 'none', color: 'var(--primary)', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => openEditModal(record)} title="Edit Configuration" disabled={!record?.id}>
                            <Edit size={16} />
                          </button>
                          <button style={{ background: 'rgba(239,68,68,0.1)', padding: '0.5rem', borderRadius: '0.5rem', border: 'none', color: 'var(--danger)', cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => handleDelete(record.id)} title="Purge Record" disabled={!record?.id}>
                            <Trash2 size={16} />
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
          backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '550px', backgroundColor: 'white', padding: '2.5rem', borderRadius: '1.25rem', boxShadow: 'var(--shadow-xl)' }}>
            <h2 style={{ marginBottom: '0.5rem', fontSize: '1.5rem', fontWeight: 600 }}>
              {modalMode === 'add' ? 'Inject Manual Override' : 'Modify Existing Record'}
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>You are about to securely modify database metrics regarding an internal attendance checkpoint.</p>
            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label className="input-label" style={{ fontWeight: 600, color: 'var(--text-main)' }}>Target System User</label>
                <select 
                  className="input-field" 
                  value={formData.userId}
                  onChange={(e) => setFormData({...formData, userId: e.target.value})}
                  required
                  disabled={modalMode === 'edit'}
                  style={{ backgroundColor: modalMode === 'edit' ? '#f1f5f9' : 'white', fontSize: '1rem', padding: '0.85rem 1rem' }}
                >
                  <option value="">Select Target Mapping</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} (ID: {u.id.substring(0, 8)}...)</option>
                  ))}
                </select>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div className="input-group">
                  <label className="input-label" style={{ fontWeight: 600, color: 'var(--text-main)' }}>Timestamp (Date)</label>
                  <input 
                    type="date" 
                    className="input-field"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    required
                    disabled={modalMode === 'edit'}
                    style={{ backgroundColor: modalMode === 'edit' ? '#f1f5f9' : 'white', fontSize: '1rem', padding: '0.85rem 1rem' }}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label" style={{ fontWeight: 600, color: 'var(--text-main)' }}>Timestamp (Time)</label>
                  <input 
                    type="time" 
                    className="input-field"
                    value={formData.time}
                    onChange={(e) => setFormData({...formData, time: e.target.value})}
                    required
                    style={{ fontSize: '1rem', padding: '0.85rem 1rem' }}
                  />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label" style={{ fontWeight: 600, color: 'var(--text-main)' }}>Classified Status</label>
                <select 
                  className="input-field"
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  required
                  style={{ fontSize: '1rem', padding: '0.85rem 1rem' }}
                >
                  <option value="Present">Present</option>
                  <option value="Late">Late</option>
                  <option value="Absent">Absent</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1, padding: '1rem', fontSize: '1rem', fontWeight: 600, border: '1px solid var(--border)' }} onClick={() => setShowModal(false)}>
                  Abort
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '1rem', fontSize: '1rem', fontWeight: 600, boxShadow: 'var(--shadow-md)' }}>
                  {modalMode === 'add' ? 'Commit to Ledger' : 'Confirm Overwrite'}
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
