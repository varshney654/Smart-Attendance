import React, { useState } from 'react';
import api from '../utils/api';
import { Download, FileText, Calendar } from 'lucide-react';

const Reports = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);

  const generateReport = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.get('/reports/summary', {
        params: { startDate, endDate }
      });
      setReportData(res.data);
    } catch (err) {
      alert('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    if (!reportData) return;
    const content = `Smart Attendance Summary Report\nDate Range: ${startDate || 'All Time'} to ${endDate || 'All Time'}\n\n` +
      `Total Records: ${reportData.totalRecords}\n` +
      `Present: ${reportData.present}\n` +
      `Late: ${reportData.late}\n` +
      `Absent: ${reportData.absent}\n` +
      `Average Attendance Rate: ${reportData.averageAttendanceRate.toFixed(1)}%\n`;

    const encodedUri = encodeURI("data:text/plain;charset=utf-8," + content);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "summary_report.txt");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', marginBottom: '0.5rem' }}>Reports Module</h1>
          <p style={{ color: 'var(--text-muted)' }}>Generate and export attendance summary reports</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '2rem' }}>
        <div className="card glass animate-fade-in" style={{ height: 'fit-content' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '0.5rem', borderRadius: '0.5rem' }}>
              <FileText size={20} />
            </div>
            <h3 style={{ fontSize: '1.125rem', margin: 0 }}>Generate Report</h3>
          </div>

          <form onSubmit={generateReport}>
            <div className="input-group">
              <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={16} /> Start Date
              </label>
              <input 
                type="date" 
                className="input-field" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="input-group" style={{ marginBottom: '1.5rem' }}>
              <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={16} /> End Date
              </label>
              <input 
                type="date" 
                className="input-field" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Generating...' : 'Generate Report'}
            </button>
          </form>
        </div>

        {reportData ? (
          <div className="card glass animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Report Summary</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  {startDate ? new Date(startDate).toLocaleDateString() : 'Beginning'} - {endDate ? new Date(endDate).toLocaleDateString() : 'Today'}
                </p>
              </div>
              <button className="btn btn-success" style={{ backgroundColor: 'var(--success)', color: 'white' }} onClick={exportReport}>
                <Download size={18} />
                Export
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
              <div style={{ padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Total Records</p>
                <h2 style={{ fontSize: '2rem', margin: 0 }}>{reportData.totalRecords}</h2>
              </div>
              <div style={{ padding: '1.5rem', backgroundColor: 'rgba(99, 102, 241, 0.05)', borderRadius: '0.5rem', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                <p style={{ color: 'var(--primary)', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 500 }}>Average Attendance Rate</p>
                <h2 style={{ fontSize: '2rem', margin: 0, color: 'var(--primary)' }}>{reportData.averageAttendanceRate.toFixed(1)}%</h2>
              </div>
              <div style={{ padding: '1.5rem', backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: '0.5rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <p style={{ color: 'var(--success)', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 500 }}>Present (incl. Late)</p>
                <h2 style={{ fontSize: '2rem', margin: 0, color: 'var(--success)' }}>{reportData.present + reportData.late}</h2>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{reportData.late} late arrivals</p>
              </div>
              <div style={{ padding: '1.5rem', backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: '0.5rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <p style={{ color: 'var(--danger)', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 500 }}>Absent</p>
                <h2 style={{ fontSize: '2rem', margin: 0, color: 'var(--danger)' }}>{reportData.absent}</h2>
              </div>
            </div>
          </div>
        ) : (
          <div className="card glass" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', borderStyle: 'dashed' }}>
            <FileText size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
            <p>Select dates and generate a report to view insights</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
