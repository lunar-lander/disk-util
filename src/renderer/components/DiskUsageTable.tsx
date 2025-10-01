import React, { useState, useEffect } from 'react';
import { DiskUsage } from '../../shared/types';
import styles from '../styles/DiskUsageTable.module.css';

interface DiskUsageTableProps {
  onRefresh?: () => void;
  refreshing?: boolean;
}

export const DiskUsageTable: React.FC<DiskUsageTableProps> = ({ onRefresh, refreshing = false }) => {
  const [diskData, setDiskData] = useState<DiskUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDiskUsage = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await window.electronAPI.getDiskUsage();
      setDiskData(data);
    } catch (err) {
      setError('Failed to fetch disk usage data');
      console.error('Error fetching disk usage:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiskUsage();
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getUsageBarClass = (percentage: number): string => {
    if (percentage < 70) return styles.progressLow;
    if (percentage < 85) return styles.progressMedium;
    return styles.progressHigh;
  };

  const handleRefresh = () => {
    fetchDiskUsage();
    onRefresh?.();
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>Disk Usage</h2>
        </div>
        <div className={styles.loading}>Loading disk usage data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>Disk Usage</h2>
        </div>
        <div className={styles.error}>
          {error}
          <br />
          <button className={styles.refreshButton} onClick={handleRefresh}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className={styles.title}>Disk Usage</h2>
          <button 
            className={styles.refreshButton}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>
      
      <table className={styles.table}>
        <thead className={styles.tableHeader}>
          <tr>
            <th>Device</th>
            <th>Mount Point</th>
            <th>File System</th>
            <th>Size</th>
            <th>Used</th>
            <th>Available</th>
            <th>Usage</th>
          </tr>
        </thead>
        <tbody className={styles.tableBody}>
          {diskData.map((disk, index) => (
            <tr key={`${disk.device}-${index}`}>
              <td className={styles.deviceCell}>{disk.device}</td>
              <td>{disk.mountPoint}</td>
              <td>{disk.fileSystem}</td>
              <td className={styles.sizeText}>{formatBytes(disk.totalSpace)}</td>
              <td className={styles.sizeText}>{formatBytes(disk.usedSpace)}</td>
              <td className={styles.sizeText}>{formatBytes(disk.freeSpace)}</td>
              <td>
                <div className={styles.usageBar}>
                  <div className={styles.progressContainer}>
                    <div 
                      className={`${styles.progressBar} ${getUsageBarClass(disk.usagePercentage)}`}
                      style={{ width: `${disk.usagePercentage}%` }}
                    />
                  </div>
                  <span className={styles.usageText}>{disk.usagePercentage}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {diskData.length === 0 && (
        <div className={styles.loading}>No disk usage data available</div>
      )}
    </div>
  );
};