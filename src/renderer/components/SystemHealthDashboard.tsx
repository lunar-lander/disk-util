import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { CpuData, MemoryData, NetworkData } from '../../shared/types';
import styles from '../styles/SystemHealthDashboard.module.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface HistoricalData {
  timestamps: string[];
  cpuUsage: number[];
  memoryUsage: number[];
  networkRx: number[];
  networkTx: number[];
}

export const SystemHealthDashboard: React.FC = () => {
  const [cpuData, setCpuData] = useState<CpuData | null>(null);
  const [memoryData, setMemoryData] = useState<MemoryData | null>(null);
  const [networkData, setNetworkData] = useState<NetworkData[]>([]);
  const [historicalData, setHistoricalData] = useState<HistoricalData>({
    timestamps: [],
    cpuUsage: [],
    memoryUsage: [],
    networkRx: [],
    networkTx: []
  });
  const [loading, setLoading] = useState(true);

  const MAX_DATA_POINTS = 50;

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000); // Update every 2 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [cpu, memory, network] = await Promise.all([
        window.electronAPI.getCPUData(),
        window.electronAPI.getMemoryData(),
        window.electronAPI.getNetworkData()
      ]);

      setCpuData(cpu);
      setMemoryData(memory);
      setNetworkData(network);

      // Update historical data
      const now = new Date().toLocaleTimeString();
      const totalNetworkRx = network.reduce((sum, n) => sum + n.receiveSpeed, 0);
      const totalNetworkTx = network.reduce((sum, n) => sum + n.sendSpeed, 0);

      setHistoricalData(prev => {
        const newData = {
          timestamps: [...prev.timestamps, now].slice(-MAX_DATA_POINTS),
          cpuUsage: [...prev.cpuUsage, cpu.usage].slice(-MAX_DATA_POINTS),
          memoryUsage: [...prev.memoryUsage, memory.usagePercentage].slice(-MAX_DATA_POINTS),
          networkRx: [...prev.networkRx, totalNetworkRx / 1024 / 1024].slice(-MAX_DATA_POINTS), // MB/s
          networkTx: [...prev.networkTx, totalNetworkTx / 1024 / 1024].slice(-MAX_DATA_POINTS)
        };
        return newData;
      });

      setLoading(false);
    } catch (error) {
      console.error('Error fetching system health data:', error);
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

  const getUsageColor = (usage: number): string => {
    if (usage >= 90) return '#ef4444';
    if (usage >= 75) return '#f59e0b';
    if (usage >= 50) return '#3b82f6';
    return '#10b981';
  };

  // Chart configurations
  const cpuChartData = {
    labels: historicalData.timestamps,
    datasets: [
      {
        label: 'CPU Usage (%)',
        data: historicalData.cpuUsage,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  };

  const memoryChartData = {
    labels: historicalData.timestamps,
    datasets: [
      {
        label: 'Memory Usage (%)',
        data: historicalData.memoryUsage,
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  };

  const networkChartData = {
    labels: historicalData.timestamps,
    datasets: [
      {
        label: 'Download (MB/s)',
        data: historicalData.networkRx,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4
      },
      {
        label: 'Upload (MB/s)',
        data: historicalData.networkTx,
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100
      },
      x: {
        display: false
      }
    }
  };

  const networkChartOptions = {
    ...chartOptions,
    scales: {
      y: {
        beginAtZero: true
      },
      x: {
        display: false
      }
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading system health data...</div>;
  }

  return (
    <div className={styles.dashboard}>
      <h2 className={styles.title}>System Health Monitor</h2>

      <div className={styles.grid}>
        {/* CPU Section */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>CPU</h3>
            <div className={styles.badge} style={{ backgroundColor: getUsageColor(cpuData?.usage || 0) }}>
              {cpuData?.usage.toFixed(1)}%
            </div>
          </div>

          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Cores:</span>
              <span className={styles.statValue}>{cpuData?.cores.length || 0}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Processes:</span>
              <span className={styles.statValue}>{cpuData?.processes || 0}</span>
            </div>
            {cpuData?.temperature && (
              <div className={styles.stat}>
                <span className={styles.statLabel}>Temp:</span>
                <span className={styles.statValue}>{cpuData.temperature.toFixed(1)}°C</span>
              </div>
            )}
            {cpuData?.loadAverage && cpuData.loadAverage.length > 0 && (
              <div className={styles.stat}>
                <span className={styles.statLabel}>Load Avg:</span>
                <span className={styles.statValue}>
                  {cpuData.loadAverage.map(l => l.toFixed(2)).join(', ')}
                </span>
              </div>
            )}
          </div>

          {/* Per-core usage */}
          {cpuData && cpuData.cores.length > 0 && (
            <div className={styles.cores}>
              <div className={styles.coresLabel}>Core Usage:</div>
              <div className={styles.coreGrid}>
                {cpuData.cores.slice(0, 16).map((core) => (
                  <div key={core.core} className={styles.core}>
                    <div
                      className={styles.coreBar}
                      style={{
                        width: `${core.usage}%`,
                        backgroundColor: getUsageColor(core.usage)
                      }}
                    />
                    <span className={styles.coreLabel}>C{core.core}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={styles.chartContainer}>
            <Line data={cpuChartData} options={chartOptions} />
          </div>
        </div>

        {/* Memory Section */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>Memory</h3>
            <div className={styles.badge} style={{ backgroundColor: getUsageColor(memoryData?.usagePercentage || 0) }}>
              {memoryData?.usagePercentage.toFixed(1)}%
            </div>
          </div>

          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Total:</span>
              <span className={styles.statValue}>{formatBytes(memoryData?.total || 0)}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Used:</span>
              <span className={styles.statValue}>{formatBytes(memoryData?.used || 0)}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Free:</span>
              <span className={styles.statValue}>{formatBytes(memoryData?.free || 0)}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Available:</span>
              <span className={styles.statValue}>{formatBytes(memoryData?.available || 0)}</span>
            </div>
          </div>

          {/* Memory breakdown */}
          <div className={styles.memoryBar}>
            <div
              className={styles.memorySegment}
              style={{
                width: `${(memoryData?.used || 0) / (memoryData?.total || 1) * 100}%`,
                backgroundColor: getUsageColor(memoryData?.usagePercentage || 0)
              }}
              title="Used"
            />
          </div>

          {memoryData && memoryData.swapTotal > 0 && (
            <div className={styles.stats}>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Swap Total:</span>
                <span className={styles.statValue}>{formatBytes(memoryData.swapTotal)}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Swap Used:</span>
                <span className={styles.statValue}>{formatBytes(memoryData.swapUsed)}</span>
              </div>
            </div>
          )}

          <div className={styles.chartContainer}>
            <Line data={memoryChartData} options={chartOptions} />
          </div>
        </div>

        {/* Network Section */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>Network</h3>
            <div className={styles.badge}>
              {networkData.length} Interface{networkData.length !== 1 ? 's' : ''}
            </div>
          </div>

          <div className={styles.networkList}>
            {networkData.slice(0, 5).map((net) => (
              <div key={net.interface} className={styles.networkItem}>
                <div className={styles.networkName}>{net.interface}</div>
                <div className={styles.networkStats}>
                  <div className={styles.networkStat}>
                    <span className={styles.networkIcon}>↓</span>
                    <span className={styles.networkValue}>{formatBytesPerSec(net.receiveSpeed)}</span>
                  </div>
                  <div className={styles.networkStat}>
                    <span className={styles.networkIcon}>↑</span>
                    <span className={styles.networkValue}>{formatBytesPerSec(net.sendSpeed)}</span>
                  </div>
                </div>
                <div className={styles.networkTotals}>
                  <span>RX: {formatBytes(net.bytesReceived)}</span>
                  <span>TX: {formatBytes(net.bytesSent)}</span>
                </div>
                {(net.errors > 0 || net.dropped > 0) && (
                  <div className={styles.networkErrors}>
                    Errors: {net.errors} | Dropped: {net.dropped}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className={styles.chartContainer}>
            <Line data={networkChartData} options={networkChartOptions} />
          </div>
        </div>
      </div>
    </div>
  );
};
