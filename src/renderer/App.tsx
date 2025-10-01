import React, { useState, useEffect } from 'react';
import { DiskUsageTable } from './components/DiskUsageTable';
import { IOPSGraph } from './components/IOPSGraph';
import { useTheme } from './hooks/useTheme';
import styles from './styles/App.module.css';

export const App: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Simulate refresh delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      setLastUpdated(new Date());
      setIsOnline(true);
    } catch (error) {
      console.error('Refresh failed:', error);
      setIsOnline(false);
    } finally {
      setRefreshing(false);
    }
  };

  const handleGlobalRefresh = () => {
    handleRefresh();
  };

  useEffect(() => {
    // Initial load
    handleRefresh();
    
    // Set up periodic refresh every 30 seconds
    const interval = setInterval(() => {
      setLastUpdated(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const formatLastUpdated = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: true,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Disk Usage Monitor</h1>
          <p className={styles.subtitle}>Real-time disk usage and IOPS monitoring</p>
        </div>
        
        <div className={styles.headerControls}>
          <div className={styles.statusIndicator}>
            <div className={`${styles.statusDot} ${!isOnline ? styles.error : ''}`} />
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </div>
          
          <button
            className={styles.refreshButton}
            onClick={handleGlobalRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <>
                <span>🔄</span>
                Refreshing...
              </>
            ) : (
              <>
                <span>🔄</span>
                Refresh All
              </>
            )}
          </button>
          
          <button 
            className={styles.themeToggle}
            onClick={toggleTheme}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          >
            <span>{theme === 'light' ? '🌙' : '☀️'}</span>
            {theme === 'light' ? 'Dark' : 'Light'}
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.grid}>
          <div className={styles.fullWidth}>
            <DiskUsageTable 
              onRefresh={handleRefresh}
              refreshing={refreshing}
            />
          </div>
          
          <div className={styles.fullWidth}>
            <IOPSGraph 
              onRefresh={handleRefresh}
              refreshing={refreshing}
            />
          </div>
        </div>
        
        {lastUpdated && (
          <div className={styles.lastUpdated}>
            Last updated: {formatLastUpdated(lastUpdated)}
          </div>
        )}
      </main>
    </div>
  );
};