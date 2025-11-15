import React, { useState, useEffect } from 'react';
import { ProcessIOData } from '../../shared/types';
import styles from '../styles/ProcessIOMonitor.module.css';

export const ProcessIOMonitor: React.FC = () => {
  const [processes, setProcesses] = useState<ProcessIOData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'io' | 'cpu' | 'memory'>('io');
  const [limit, setLimit] = useState(15);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000); // Update every 3 seconds
    return () => clearInterval(interval);
  }, [limit]);

  const fetchData = async () => {
    try {
      const data = await window.electronAPI.getProcessIO(limit);
      setProcesses(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching process I/O data:', error);
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatBytesPerSec = (bytesPerSec: number): string => {
    return formatBytes(bytesPerSec) + '/s';
  };

  const getSortedProcesses = (): ProcessIOData[] => {
    const sorted = [...processes];
    switch (sortBy) {
      case 'io':
        return sorted.sort((a, b) => (b.readSpeed + b.writeSpeed) - (a.readSpeed + a.writeSpeed));
      case 'cpu':
        return sorted.sort((a, b) => b.cpuUsage - a.cpuUsage);
      case 'memory':
        return sorted.sort((a, b) => b.memoryUsage - a.memoryUsage);
      default:
        return sorted;
    }
  };

  const getTotalIO = (): { read: number; write: number } => {
    return processes.reduce(
      (acc, p) => ({
        read: acc.read + p.readSpeed,
        write: acc.write + p.writeSpeed
      }),
      { read: 0, write: 0 }
    );
  };

  const getProcessColor = (ioSpeed: number): string => {
    const totalSpeed = ioSpeed;
    if (totalSpeed > 10 * 1024 * 1024) return '#ef4444'; // > 10 MB/s
    if (totalSpeed > 1 * 1024 * 1024) return '#f59e0b'; // > 1 MB/s
    if (totalSpeed > 100 * 1024) return '#3b82f6'; // > 100 KB/s
    return '#10b981';
  };

  if (loading) {
    return <div className={styles.loading}>Loading process I/O data...</div>;
  }

  const sortedProcesses = getSortedProcesses();
  const totalIO = getTotalIO();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Process I/O Monitor</h2>
        <div className={styles.controls}>
          <div className={styles.sortButtons}>
            <button
              className={`${styles.sortButton} ${sortBy === 'io' ? styles.active : ''}`}
              onClick={() => setSortBy('io')}
            >
              Sort by I/O
            </button>
            <button
              className={`${styles.sortButton} ${sortBy === 'cpu' ? styles.active : ''}`}
              onClick={() => setSortBy('cpu')}
            >
              Sort by CPU
            </button>
            <button
              className={`${styles.sortButton} ${sortBy === 'memory' ? styles.active : ''}`}
              onClick={() => setSortBy('memory')}
            >
              Sort by Memory
            </button>
          </div>

          <div className={styles.limitSelector}>
            <label>Show:</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className={styles.select}
            >
              <option value={10}>Top 10</option>
              <option value={15}>Top 15</option>
              <option value={25}>Top 25</option>
              <option value={50}>Top 50</option>
            </select>
          </div>
        </div>
      </div>

      <div className={styles.summary}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Total Read:</span>
          <span className={styles.summaryValue}>{formatBytesPerSec(totalIO.read)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Total Write:</span>
          <span className={styles.summaryValue}>{formatBytesPerSec(totalIO.write)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Combined:</span>
          <span className={styles.summaryValue}>{formatBytesPerSec(totalIO.read + totalIO.write)}</span>
        </div>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>PID</th>
              <th>Process Name</th>
              <th>User</th>
              <th>Read Speed</th>
              <th>Write Speed</th>
              <th>Total I/O</th>
              <th>CPU %</th>
              <th>Memory %</th>
            </tr>
          </thead>
          <tbody>
            {sortedProcesses.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.noData}>
                  No process I/O data available
                </td>
              </tr>
            ) : (
              sortedProcesses.map((proc) => {
                const totalIOSpeed = proc.readSpeed + proc.writeSpeed;
                const ioColor = getProcessColor(totalIOSpeed);

                return (
                  <tr key={proc.pid} className={styles.row}>
                    <td>{proc.pid}</td>
                    <td className={styles.processName} title={proc.name}>
                      {proc.name.length > 40 ? proc.name.substring(0, 40) + '...' : proc.name}
                    </td>
                    <td>{proc.user}</td>
                    <td className={styles.ioValue}>
                      {proc.readSpeed > 0 ? (
                        <>
                          <span className={styles.ioIcon} style={{ color: '#10b981' }}>↓</span>
                          {formatBytesPerSec(proc.readSpeed)}
                        </>
                      ) : (
                        <span className={styles.inactive}>-</span>
                      )}
                    </td>
                    <td className={styles.ioValue}>
                      {proc.writeSpeed > 0 ? (
                        <>
                          <span className={styles.ioIcon} style={{ color: '#ef4444' }}>↑</span>
                          {formatBytesPerSec(proc.writeSpeed)}
                        </>
                      ) : (
                        <span className={styles.inactive}>-</span>
                      )}
                    </td>
                    <td>
                      <div className={styles.totalIO}>
                        <div
                          className={styles.ioBar}
                          style={{
                            width: totalIOSpeed > 0 ? '100%' : '0%',
                            backgroundColor: ioColor,
                            opacity: Math.min(1, totalIOSpeed / (10 * 1024 * 1024))
                          }}
                        />
                        <span className={styles.ioText}>{formatBytesPerSec(totalIOSpeed)}</span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.percentBar}>
                        <div
                          className={styles.percentFill}
                          style={{
                            width: `${Math.min(100, proc.cpuUsage)}%`,
                            backgroundColor: '#3b82f6'
                          }}
                        />
                        <span className={styles.percentText}>{proc.cpuUsage.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td>
                      <div className={styles.percentBar}>
                        <div
                          className={styles.percentFill}
                          style={{
                            width: `${Math.min(100, proc.memoryUsage)}%`,
                            backgroundColor: '#8b5cf6'
                          }}
                        />
                        <span className={styles.percentText}>{proc.memoryUsage.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.footer}>
        <p className={styles.note}>
          <strong>Note:</strong> Process I/O tracking requires appropriate permissions. On Linux, reading from <code>/proc/[pid]/io</code> may require elevated privileges.
        </p>
      </div>
    </div>
  );
};
