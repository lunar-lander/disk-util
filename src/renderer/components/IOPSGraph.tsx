import React, { useState, useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { IOPSData } from '../../shared/types';
import styles from '../styles/IOPSGraph.module.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface IOPSGraphProps {
  onRefresh?: () => void;
  refreshing?: boolean;
}

interface DataPoint {
  timestamp: number;
  readIOPS: number;
  writeIOPS: number;
  totalIOPS: number;
}

export const IOPSGraph: React.FC<IOPSGraphProps> = ({ onRefresh, refreshing = false }) => {
  const [iopsData, setIOPSData] = useState<IOPSData[]>([]);
  const [historicalData, setHistoricalData] = useState<Map<string, DataPoint[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllDevices, setShowAllDevices] = useState(true);
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchIOPSData = async () => {
    try {
      setError(null);
      const data = await window.electronAPI.getIOPSData();

      // Filter out loop and system devices
      const filteredData = data.filter(device => !device.device.startsWith('loop'));

      setIOPSData(filteredData);

      // Update historical data
      const currentTime = Date.now();
      setHistoricalData(prev => {
        const newData = new Map(prev);

        filteredData.forEach(deviceData => {
          const deviceHistory = newData.get(deviceData.device) || [];
          deviceHistory.push({
            timestamp: currentTime,
            readIOPS: deviceData.readIOPS,
            writeIOPS: deviceData.writeIOPS,
            totalIOPS: deviceData.totalIOPS
          });

          // Keep only last 50 data points (about 5 minutes at 5-second intervals)
          if (deviceHistory.length > 50) {
            deviceHistory.shift();
          }

          newData.set(deviceData.device, deviceHistory);
        });

        return newData;
      });

      // Initialize selected devices if none selected
      if (selectedDevices.size === 0 && filteredData.length > 0) {
        setSelectedDevices(new Set(filteredData.map(d => d.device)));
      }
    } catch (err) {
      setError('Failed to fetch IOPS data');
      console.error('Error fetching IOPS:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIOPSData();

    // Set up periodic refresh
    intervalRef.current = setInterval(fetchIOPSData, 5000); // Update every 5 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Update selected devices if any are no longer available
    const availableDevices = new Set(iopsData.map(d => d.device));
    const validSelectedDevices = new Set([...selectedDevices].filter(device => availableDevices.has(device)));
    
    if (validSelectedDevices.size !== selectedDevices.size) {
      setSelectedDevices(validSelectedDevices.size > 0 ? validSelectedDevices : availableDevices);
    }
  }, [iopsData, selectedDevices]);

  const handleRefresh = () => {
    fetchIOPSData();
    onRefresh?.();
  };

  const getCurrentStats = () => {
    const selectedData = iopsData.filter(d => selectedDevices.has(d.device));
    if (selectedData.length === 0) return { readIOPS: 0, writeIOPS: 0, totalIOPS: 0 };
    
    return selectedData.reduce((acc, device) => ({
      readIOPS: acc.readIOPS + device.readIOPS,
      writeIOPS: acc.writeIOPS + device.writeIOPS,
      totalIOPS: acc.totalIOPS + device.totalIOPS
    }), { readIOPS: 0, writeIOPS: 0, totalIOPS: 0 });
  };

  const getChartData = () => {
    if (selectedDevices.size === 0 || historicalData.size === 0) {
      return { labels: [], datasets: [] };
    }

    // Get the longest history to determine labels
    const maxHistoryLength = Math.max(
      ...[...selectedDevices].map(device => historicalData.get(device)?.length || 0)
    );

    if (maxHistoryLength === 0) {
      return { labels: [], datasets: [] };
    }

    const labels = Array.from({ length: maxHistoryLength }, (_, index) => 
      `${Math.max(0, (maxHistoryLength - index - 1) * 5)}s ago`
    ).reverse();

    const datasets = [];
    const colors = [
      { border: 'rgb(0, 122, 204)', bg: 'rgba(0, 122, 204, 0.1)' },      // Blue
      { border: 'rgb(40, 167, 69)', bg: 'rgba(40, 167, 69, 0.1)' },       // Green
      { border: 'rgb(255, 193, 7)', bg: 'rgba(255, 193, 7, 0.1)' },       // Yellow
      { border: 'rgb(220, 53, 69)', bg: 'rgba(220, 53, 69, 0.1)' },       // Red
      { border: 'rgb(108, 117, 125)', bg: 'rgba(108, 117, 125, 0.1)' },   // Gray
      { border: 'rgb(255, 105, 180)', bg: 'rgba(255, 105, 180, 0.1)' },   // Pink
      { border: 'rgb(75, 0, 130)', bg: 'rgba(75, 0, 130, 0.1)' },         // Indigo
      { border: 'rgb(255, 165, 0)', bg: 'rgba(255, 165, 0, 0.1)' },       // Orange
    ];

    let colorIndex = 0;
    for (const device of selectedDevices) {
      const deviceHistory = historicalData.get(device) || [];
      if (deviceHistory.length === 0) continue;

      const color = colors[colorIndex % colors.length];
      
      // Pad data to match label length if needed
      const paddedData = Array.from({ length: maxHistoryLength }, (_, index) => {
        const dataIndex = deviceHistory.length - maxHistoryLength + index;
        return dataIndex >= 0 ? deviceHistory[dataIndex].totalIOPS : 0;
      });

      datasets.push({
        label: `${device} Total IOPS`,
        data: paddedData,
        borderColor: color.border,
        backgroundColor: color.bg,
        tension: 0.1,
        fill: false,
        pointRadius: 2,
        pointHoverRadius: 4,
      });

      colorIndex++;
    }

    return { labels, datasets };
  };

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: selectedDevices.size === 1 
          ? `IOPS for ${[...selectedDevices][0]}` 
          : `IOPS for ${selectedDevices.size} devices`,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Operations per Second',
        },
      },
      x: {
        title: {
          display: true,
          text: 'Time',
        },
      },
    },
    interaction: {
      intersect: false,
    },
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>IOPS Monitor</h2>
        </div>
        <div className={styles.loading}>Loading IOPS data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.title}>IOPS Monitor</h2>
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

  const currentStats = getCurrentStats();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>IOPS Monitor</h2>
        <div className={styles.controls}>
          <div className={styles.deviceToggles}>
            {iopsData.map(device => (
              <label key={device.device} className={styles.deviceToggle}>
                <input
                  type="checkbox"
                  checked={selectedDevices.has(device.device)}
                  onChange={(e) => {
                    const newSelected = new Set(selectedDevices);
                    if (e.target.checked) {
                      newSelected.add(device.device);
                    } else {
                      newSelected.delete(device.device);
                    }
                    setSelectedDevices(newSelected);
                  }}
                />
                <span className={styles.deviceName}>{device.device}</span>
              </label>
            ))}
          </div>
          <button
            className={styles.refreshButton}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {selectedDevices.size > 0 && [...selectedDevices].some(device => historicalData.has(device)) ? (
        <>
          <div className={styles.chartContainer}>
            <Line data={getChartData()} options={chartOptions} />
          </div>

          <div className={styles.stats}>
            <div className={`${styles.statItem} ${styles.readStat}`}>
              <p className={styles.statValue}>{currentStats.readIOPS}</p>
              <p className={styles.statLabel}>Read IOPS</p>
            </div>
            <div className={`${styles.statItem} ${styles.writeStat}`}>
              <p className={styles.statValue}>{currentStats.writeIOPS}</p>
              <p className={styles.statLabel}>Write IOPS</p>
            </div>
            <div className={`${styles.statItem} ${styles.totalStat}`}>
              <p className={styles.statValue}>{currentStats.totalIOPS}</p>
              <p className={styles.statLabel}>Total IOPS</p>
            </div>
          </div>
        </>
      ) : (
        <div className={styles.noData}>
          {iopsData.length === 0
            ? 'No IOPS data available'
            : 'Collecting data... Please wait a moment for the graph to appear.'
          }
        </div>
      )}
    </div>
  );
};
