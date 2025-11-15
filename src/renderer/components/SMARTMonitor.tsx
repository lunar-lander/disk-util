import React, { useState, useEffect } from 'react';
import { SmartData, SmartAttribute } from '../../shared/types';
import styles from '../styles/SMARTMonitor.module.css';

export const SMARTMonitor: React.FC = () => {
  const [smartData, setSmartData] = useState<SmartData[]>([]);
  const [selectedDrive, setSelectedDrive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const data = await window.electronAPI.getSMARTData();
      setSmartData(data);

      if (data.length > 0 && !selectedDrive) {
        setSelectedDrive(data[0].device);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching S.M.A.R.T. data:', error);
      setLoading(false);
    }
  };

  const getHealthStatusColor = (status: string): string => {
    switch (status) {
      case 'PASSED':
        return '#10b981';
      case 'FAILED':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getAttributeStatusColor = (status: string): string => {
    switch (status) {
      case 'OK':
        return '#10b981';
      case 'WARNING':
        return '#f59e0b';
      case 'CRITICAL':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getCurrentDrive = (): SmartData | undefined => {
    return smartData.find(d => d.device === selectedDrive);
  };

  const formatPowerOnHours = (hours?: number): string => {
    if (!hours) return 'N/A';
    const days = Math.floor(hours / 24);
    const years = Math.floor(days / 365);
    if (years > 0) {
      return `${years} year${years > 1 ? 's' : ''}, ${days % 365} days`;
    }
    return `${days} day${days !== 1 ? 's' : ''}`;
  };

  if (loading) {
    return <div className={styles.loading}>Loading S.M.A.R.T. data...</div>;
  }

  if (smartData.length === 0) {
    return (
      <div className={styles.noData}>
        <h3>No S.M.A.R.T. Data Available</h3>
        <p>S.M.A.R.T. monitoring requires:</p>
        <ul>
          <li>smartmontools installed (smartctl command)</li>
          <li>Root/Administrator privileges</li>
          <li>Drives that support S.M.A.R.T.</li>
        </ul>
        <p className={styles.hint}>On Linux: sudo apt-get install smartmontools</p>
      </div>
    );
  }

  const currentDrive = getCurrentDrive();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>S.M.A.R.T. Drive Health Monitor</h2>
        <div className={styles.driveSelector}>
          <label>Select Drive:</label>
          <select
            value={selectedDrive || ''}
            onChange={(e) => setSelectedDrive(e.target.value)}
            className={styles.select}
          >
            {smartData.map((drive) => (
              <option key={drive.device} value={drive.device}>
                {drive.device}
              </option>
            ))}
          </select>
        </div>
      </div>

      {currentDrive && (
        <div className={styles.content}>
          {/* Health Summary */}
          <div className={styles.summaryCard}>
            <h3>Health Summary</h3>
            <div className={styles.summaryGrid}>
              <div className={styles.summaryItem}>
                <div className={styles.summaryLabel}>Overall Status</div>
                <div
                  className={styles.summaryValue}
                  style={{ color: getHealthStatusColor(currentDrive.healthStatus) }}
                >
                  {currentDrive.healthStatus}
                  {currentDrive.healthStatus === 'PASSED' && ' ✓'}
                  {currentDrive.healthStatus === 'FAILED' && ' ✗'}
                </div>
              </div>

              {currentDrive.temperature && (
                <div className={styles.summaryItem}>
                  <div className={styles.summaryLabel}>Temperature</div>
                  <div
                    className={styles.summaryValue}
                    style={{ color: currentDrive.temperature > 50 ? '#ef4444' : '#10b981' }}
                  >
                    {currentDrive.temperature}°C
                  </div>
                </div>
              )}

              {currentDrive.powerOnHours && (
                <div className={styles.summaryItem}>
                  <div className={styles.summaryLabel}>Power-On Time</div>
                  <div className={styles.summaryValue}>
                    {formatPowerOnHours(currentDrive.powerOnHours)}
                  </div>
                </div>
              )}

              {currentDrive.powerCycleCount && (
                <div className={styles.summaryItem}>
                  <div className={styles.summaryLabel}>Power Cycles</div>
                  <div className={styles.summaryValue}>
                    {currentDrive.powerCycleCount.toLocaleString()}
                  </div>
                </div>
              )}
            </div>

            {/* Critical Metrics */}
            <div className={styles.criticalMetrics}>
              <h4>Critical Metrics</h4>
              <div className={styles.metricsGrid}>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>Reallocated Sectors:</span>
                  <span
                    className={styles.metricValue}
                    style={{ color: (currentDrive.reallocatedSectors || 0) > 0 ? '#ef4444' : '#10b981' }}
                  >
                    {currentDrive.reallocatedSectors || 0}
                  </span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>Pending Sectors:</span>
                  <span
                    className={styles.metricValue}
                    style={{ color: (currentDrive.pendingSectors || 0) > 0 ? '#f59e0b' : '#10b981' }}
                  >
                    {currentDrive.pendingSectors || 0}
                  </span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>Uncorrectable Errors:</span>
                  <span
                    className={styles.metricValue}
                    style={{ color: (currentDrive.uncorrectableErrors || 0) > 0 ? '#ef4444' : '#10b981' }}
                  >
                    {currentDrive.uncorrectableErrors || 0}
                  </span>
                </div>
                {currentDrive.wearLevelingCount && (
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}>Wear Leveling (SSD):</span>
                    <span className={styles.metricValue}>
                      {currentDrive.wearLevelingCount}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Detailed Attributes */}
          {currentDrive.attributes.length > 0 && (
            <div className={styles.attributesCard}>
              <h3>S.M.A.R.T. Attributes</h3>
              <div className={styles.attributesTable}>
                <div className={styles.tableHeader}>
                  <div className={styles.tableCell}>ID</div>
                  <div className={styles.tableCell}>Attribute</div>
                  <div className={styles.tableCell}>Value</div>
                  <div className={styles.tableCell}>Worst</div>
                  <div className={styles.tableCell}>Threshold</div>
                  <div className={styles.tableCell}>Raw Value</div>
                  <div className={styles.tableCell}>Status</div>
                </div>

                {currentDrive.attributes
                  .sort((a, b) => a.id - b.id)
                  .map((attr) => (
                    <div key={attr.id} className={styles.tableRow}>
                      <div className={styles.tableCell}>{attr.id}</div>
                      <div className={styles.tableCell} title={attr.name}>
                        {attr.name}
                      </div>
                      <div className={styles.tableCell}>{attr.value}</div>
                      <div className={styles.tableCell}>{attr.worst}</div>
                      <div className={styles.tableCell}>{attr.threshold}</div>
                      <div className={styles.tableCell}>{attr.raw}</div>
                      <div
                        className={styles.tableCell}
                        style={{ color: getAttributeStatusColor(attr.status) }}
                      >
                        {attr.status}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Health Recommendations */}
          <div className={styles.recommendationsCard}>
            <h3>Recommendations</h3>
            <ul className={styles.recommendations}>
              {currentDrive.healthStatus === 'FAILED' && (
                <li className={styles.critical}>
                  ⚠️ CRITICAL: Drive health check has FAILED. Backup your data immediately and consider replacing this drive!
                </li>
              )}
              {(currentDrive.reallocatedSectors || 0) > 0 && (
                <li className={styles.warning}>
                  ⚠️ Reallocated sectors detected. Monitor this drive closely and backup important data.
                </li>
              )}
              {(currentDrive.pendingSectors || 0) > 0 && (
                <li className={styles.warning}>
                  ⚠️ Pending sectors detected. These may indicate developing bad sectors.
                </li>
              )}
              {currentDrive.temperature && currentDrive.temperature > 50 && (
                <li className={styles.warning}>
                  🌡️ Drive temperature is high ({currentDrive.temperature}°C). Ensure adequate cooling.
                </li>
              )}
              {currentDrive.healthStatus === 'PASSED' &&
               (currentDrive.reallocatedSectors || 0) === 0 &&
               (currentDrive.pendingSectors || 0) === 0 && (
                <li className={styles.ok}>
                  ✓ Drive health looks good! Continue regular monitoring and backups.
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
