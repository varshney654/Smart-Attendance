import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { Pencil, Trash2, UserPlus, Search } from 'lucide-react';

const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Student');
  const [department, setDepartment] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(search.toLowerCase()) || 
    user.email.toLowerCase().includes(search.toLowerCase()) ||
    (user.department && user.department.toLowerCase().includes(search.toLowerCase()))
  );

  const openAddModal = () => {
    setCurrentUser(null);
    setName('');
    setEmail('');
    setPassword('');
    setRole('Student');
    setDepartment('');
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setCurrentUser(user);
    setName(user.name);
    setEmail(user.email);
    setPassword(''); // leave blank info to indicate keep same
    setRole(user.role);
    setDepartment(user.department || '');
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this user?')) {
      try {
        await api.delete(`/users/${id}`);
        fetchUsers();
      } catch (err) {
        alert('Failed to delete user');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (currentUser) {
        // Update
        const payload = { name, email, role, department };
        if (password) payload.password = password;
        await api.put(`/users/${currentUser.id}`, payload);
      } else {
        // Create (usually uses register, but we have a POST /users if we hooked it up to create directly)
        await api.post('/auth/register', { name, email, password, role, department });
      }
      setShowModal(false);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Action failed');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Manage Users</h1>
          <p style={{ color: 'var(--text-muted)' }}>Add, edit, or remove users from the system</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <UserPlus size={18} />
          Add User
        </button>
      </div>

      <div className="card glass animate-fade-in" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: '50%', left: '1rem', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                <Search size={18} />
              </div>
              <input 
                type="text" 
                className="input-field" 
                style={{ width: '100%', paddingLeft: '2.5rem' }}
                placeholder="Search users by name, email, or department..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead style={{ backgroundColor: '#f8fafc' }}>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Department</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>Loading users...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>No users found</td></tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 600 }}>
                          {user.name.charAt(0)}
                        </div>
                        <span style={{ fontWeight: 500 }}>{user.name}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{user.email}</td>
                    <td>
                      <span className={`badge ${user.role === 'Admin' ? 'badge-danger' : user.role === 'Employee' ? 'badge-primary' : 'badge-success'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{user.department || '-'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button style={{ color: 'var(--primary)', padding: '0.5rem' }} onClick={() => openEditModal(user)} aria-label="Edit user">
                          <Pencil size={18} />
                        </button>
                        <button style={{ color: 'var(--danger)', padding: '0.5rem' }} onClick={() => handleDelete(user.id)} aria-label="Delete user">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '500px', backgroundColor: 'var(--surface)' }}>
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>{currentUser ? 'Edit User' : 'Add New User'}</h2>
            
            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label className="input-label">Name</label>
                <input type="text" className="input-field" value={name} onChange={e=>setName(e.target.value)} required />
              </div>
              <div className="input-group">
                <label className="input-label">Email</label>
                <input type="email" className="input-field" value={email} onChange={e=>setEmail(e.target.value)} required />
              </div>
              <div className="input-group">
                <label className="input-label">Password {currentUser && <span style={{color:'var(--text-muted)', fontWeight:'normal'}}>(Leave blank to keep current)</span>}</label>
                <input type="password" className="input-field" value={password} onChange={e=>setPassword(e.target.value)} required={!currentUser} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Role</label>
                  <select className="input-field" value={role} onChange={e=>setRole(e.target.value)} required>
                    <option value="Student">Student</option>
                    <option value="Employee">Employee</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Department</label>
                  <input type="text" className="input-field" value={department} onChange={e=>setDepartment(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{currentUser ? 'Save Changes' : 'Create User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageUsers;
