import React, { useState, useEffect } from 'react';
import { Alert, SystemStats } from '../../shared/types';
import styles from '../styles/AlertManager.module.css';

export const AlertManager: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');

  useEffect(() => {
    checkAlerts();
    const interval = setInterval(checkAlerts, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const checkAlerts = async () => {
    try {
      const stats = await window.electronAPI.getSystemStats();
      const newAlerts = generateAlerts(stats);
      setAlerts(prev => [...newAlerts, ...prev].slice(0, 50)); // Keep last 50 alerts
    } catch (error) {
      console.error('Error checking alerts:', error);
    }
  };

  const isSystemDevice = (disk: { device: string; fileSystem: string }): boolean => {
    // Skip loop devices and system filesystems
    const excludedFileSystems = ['tmpfs', 'devtmpfs', 'squashfs', 'overlay', 'aufs', 'proc', 'sysfs', 'devfs', 'debugfs'];
    return disk.device.startsWith('/dev/loop') || excludedFileSystems.includes(disk.fileSystem);
  };

  const generateAlerts = (stats: SystemStats): Alert[] => {
    const alerts: Alert[] = [];
    const now = Date.now();

    // Disk space alerts (skip system/temporary devices)
    stats.diskUsage.forEach(disk => {
      // Skip system devices
      if (isSystemDevice(disk)) {
        return;
      }

      if (disk.usagePercentage >= 95) {
        alerts.push({
          id: `disk-critical-${disk.device}-${now}`,
          type: 'disk-space',
          severity: 'critical',
          title: 'Critical Disk Space',
          message: `${disk.device} is ${disk.usagePercentage}% full (${formatBytes(disk.freeSpace)} free)`,
          device: disk.device,
          value: disk.usagePercentage,
          threshold: 95,
          timestamp: now,
          acknowledged: false,
          conditions: [{ metric: 'disk-usage', operator: '>=', value: 95 }]
        });
      } else if (disk.usagePercentage >= 85) {
        alerts.push({
          id: `disk-warning-${disk.device}-${now}`,
          type: 'disk-space',
          severity: 'warning',
          title: 'Low Disk Space',
          message: `${disk.device} is ${disk.usagePercentage}% full`,
          device: disk.device,
          value: disk.usagePercentage,
          threshold: 85,
          timestamp: now,
          acknowledged: false,
          conditions: [{ metric: 'disk-usage', operator: '>=', value: 85 }]
        });
      }
    });

    // S.M.A.R.T. alerts (disk-focused monitoring)
    if (stats.smartData) {
      stats.smartData.forEach(smart => {
        if (smart.healthStatus === 'FAILED') {
          alerts.push({
            id: `smart-failed-${smart.device}-${now}`,
            type: 'smart',
            severity: 'critical',
            title: 'Drive Health Failure',
            message: `Drive ${smart.device} has FAILED S.M.A.R.T. check! Backup data immediately!`,
            device: smart.device,
            timestamp: now,
            acknowledged: false,
            conditions: [{ metric: 'smart-status', operator: '==', value: 0 }]
          });
        }

        if (smart.temperature && smart.temperature > 55) {
          alerts.push({
            id: `smart-temp-${smart.device}-${now}`,
            type: 'temperature',
            severity: smart.temperature > 60 ? 'critical' : 'warning',
            title: 'High Drive Temperature',
            message: `Drive ${smart.device} temperature is ${smart.temperature}°C`,
            device: smart.device,
            value: smart.temperature,
            threshold: 55,
            timestamp: now,
            acknowledged: false,
            conditions: [{ metric: 'drive-temp', operator: '>', value: 55 }]
          });
        }

        if ((smart.reallocatedSectors || 0) > 0) {
          alerts.push({
            id: `smart-realloc-${smart.device}-${now}`,
            type: 'smart',
            severity: 'warning',
            title: 'Reallocated Sectors Detected',
            message: `Drive ${smart.device} has ${smart.reallocatedSectors} reallocated sectors`,
            device: smart.device,
            value: smart.reallocatedSectors,
            timestamp: now,
            acknowledged: false,
            conditions: [{ metric: 'reallocated-sectors', operator: '>', value: 0 }]
          });
        }
      });
    }

    return alerts;
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return '#ef4444';
      case 'warning':
        return '#f59e0b';
      case 'info':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  };

  const getSeverityIcon = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return '🔴';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '•';
    }
  };

  const acknowledgeAlert = (id: string) => {
    setAlerts(prev => prev.map(alert =>
      alert.id === id ? { ...alert, acknowledged: true } : alert
    ));
  };

  const clearAll = () => {
    setAlerts([]);
  };

  const clearAcknowledged = () => {
    setAlerts(prev => prev.filter(alert => !alert.acknowledged));
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true;
    return alert.severity === filter;
  });

  const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.acknowledged).length;
  const warningCount = alerts.filter(a => a.severity === 'warning' && !a.acknowledged).length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Alert Manager</h2>
        <div className={styles.counts}>
          <div className={styles.count} style={{ color: '#ef4444' }}>
            {criticalCount} Critical
          </div>
          <div className={styles.count} style={{ color: '#f59e0b' }}>
            {warningCount} Warning
          </div>
        </div>
        <div className={styles.actions}>
          <button onClick={clearAcknowledged} className={styles.actionButton}>
            Clear Acknowledged
          </button>
          <button onClick={clearAll} className={styles.actionButton}>
            Clear All
          </button>
        </div>
      </div>

      <div className={styles.filters}>
        <button
          className={`${styles.filterButton} ${filter === 'all' ? styles.active : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({alerts.length})
        </button>
        <button
          className={`${styles.filterButton} ${filter === 'critical' ? styles.active : ''}`}
          onClick={() => setFilter('critical')}
        >
          Critical ({alerts.filter(a => a.severity === 'critical').length})
        </button>
        <button
          className={`${styles.filterButton} ${filter === 'warning' ? styles.active : ''}`}
          onClick={() => setFilter('warning')}
        >
          Warning ({alerts.filter(a => a.severity === 'warning').length})
        </button>
        <button
          className={`${styles.filterButton} ${filter === 'info' ? styles.active : ''}`}
          onClick={() => setFilter('info')}
        >
          Info ({alerts.filter(a => a.severity === 'info').length})
        </button>
      </div>

      <div className={styles.alertsList}>
        {filteredAlerts.length === 0 ? (
          <div className={styles.noAlerts}>
            <div className={styles.noAlertsIcon}>✓</div>
            <div className={styles.noAlertsText}>No alerts</div>
            <div className={styles.noAlertsSubtext}>Your system is healthy!</div>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`${styles.alert} ${alert.acknowledged ? styles.acknowledged : ''}`}
              style={{ borderLeftColor: getSeverityColor(alert.severity) }}
            >
              <div className={styles.alertIcon}>{getSeverityIcon(alert.severity)}</div>
              <div className={styles.alertContent}>
                <div className={styles.alertHeader}>
                  <span className={styles.alertTitle}>{alert.title}</span>
                  <span className={styles.alertTime}>{formatTimestamp(alert.timestamp)}</span>
                </div>
                <div className={styles.alertMessage}>{alert.message}</div>
                {alert.device && (
                  <div className={styles.alertDevice}>Device: {alert.device}</div>
                )}
              </div>
              {!alert.acknowledged && (
                <button
                  className={styles.acknowledgeButton}
                  onClick={() => acknowledgeAlert(alert.id)}
                >
                  Acknowledge
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
