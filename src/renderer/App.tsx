import React, { useState, useEffect } from 'react';
import { DiskUsageTable } from './components/DiskUsageTable';
import { IOPSGraph } from './components/IOPSGraph';
import { SMARTMonitor } from './components/SMARTMonitor';
import { ProcessIOMonitor } from './components/ProcessIOMonitor';
import { AlertManager } from './components/AlertManager';
import { useTheme } from './hooks/useTheme';
import styles from './styles/App.module.css';

type Tab = 'overview' | 'smart' | 'processes' | 'alerts';

export const App: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
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

  useEffect(() => {
    handleRefresh();
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

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Disk Overview', icon: '💾' },
    { id: 'smart', label: 'Drive Health', icon: '🔧' },
    { id: 'processes', label: 'Processes', icon: '⚙️' },
    { id: 'alerts', label: 'Alerts', icon: '🔔' }
  ];

  return (
    <div className={styles.app} data-theme={theme}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>📊</span>
            <div>
              <h1 className={styles.title}>Advanced System Monitor</h1>
              <p className={styles.subtitle}>Real-time monitoring & analytics</p>
            </div>
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.statusIndicator}>
            <div className={`${styles.statusDot} ${!isOnline ? styles.error : ''}`} />
            <span className={styles.statusText}>{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {lastUpdated && (
            <div className={styles.lastUpdated}>
              Updated: {formatLastUpdated(lastUpdated)}
            </div>
          )}

          <button
            className={styles.refreshButton}
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh all data"
          >
            <span className={refreshing ? styles.spinning : ''}>🔄</span>
            {refreshing ? 'Refreshing...' : 'Refresh'}
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

      <nav className={styles.nav}>
        <div className={styles.tabs}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.activeTab : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className={styles.tabIcon}>{tab.icon}</span>
              <span className={styles.tabLabel}>{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <main className={styles.main}>
        {activeTab === 'overview' && (
          <div className={styles.overviewGrid}>
            <div className={styles.fullWidth}>
              <IOPSGraph
                onRefresh={handleRefresh}
                refreshing={refreshing}
              />
            </div>
            <div className={styles.fullWidth}>
              <DiskUsageTable
                onRefresh={handleRefresh}
                refreshing={refreshing}
              />
            </div>
          </div>
        )}

        {activeTab === 'smart' && <SMARTMonitor />}
        {activeTab === 'processes' && <ProcessIOMonitor />}
        {activeTab === 'alerts' && <AlertManager />}
      </main>

      <footer className={styles.footer}>
        <span>Advanced System Monitor v2.0</span>
        <span>•</span>
        <span>Monitoring {tabs.find(t => t.id === activeTab)?.label}</span>
      </footer>
    </div>
  );
};
