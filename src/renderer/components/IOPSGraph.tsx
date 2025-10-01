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
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [historicalData, setHistoricalData] = useState<Map<string, DataPoint[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchIOPSData = async () => {
    try {
      setError(null);
      const data = await window.electronAPI.getIOPSData();
      setIOPSData(data);

      // Update historical data
      const currentTime = Date.now();
      setHistoricalData(prev => {
        const newData = new Map(prev);

        data.forEach(deviceData => {
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

      // Set default selected device if none selected
      if (!selectedDevice && data.length > 0) {
        setSelectedDevice(data[0].device);
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
    // Update selected device if it's no longer available
    if (selectedDevice && !iopsData.find(d => d.device === selectedDevice) && iopsData.length > 0) {
      setSelectedDevice(iopsData[0].device);
    }
  }, [iopsData, selectedDevice]);

  const handleRefresh = () => {
    fetchIOPSData();
    onRefresh?.();
  };

  const getCurrentStats = () => {
    const currentData = iopsData.find(d => d.device === selectedDevice);
    return currentData || { readIOPS: 0, writeIOPS: 0, totalIOPS: 0 };
  };

  const getChartData = () => {
    const deviceHistory = historicalData.get(selectedDevice) || [];

    if (deviceHistory.length === 0) {
      return {
        labels: [],
        datasets: []
      };
    }

    const labels = deviceHistory.map((_, index) =>
      `${Math.max(0, (deviceHistory.length - index - 1) * 5)}s ago`
    ).reverse();

    return {
      labels,
      datasets: [
        {
          label: 'Read IOPS',
          data: deviceHistory.map(d => d.readIOPS),
          borderColor: 'rgb(0, 122, 204)',
          backgroundColor: 'rgba(0, 122, 204, 0.1)',
          tension: 0.1,
          fill: false,
        },
        {
          label: 'Write IOPS',
          data: deviceHistory.map(d => d.writeIOPS),
          borderColor: 'rgb(40, 167, 69)',
          backgroundColor: 'rgba(40, 167, 69, 0.1)',
          tension: 0.1,
          fill: false,
        },
        {
          label: 'Total IOPS',
          data: deviceHistory.map(d => d.totalIOPS),
          borderColor: 'rgb(255, 193, 7)',
          backgroundColor: 'rgba(255, 193, 7, 0.1)',
          tension: 0.1,
          fill: false,
        },
      ],
    };
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
        text: `IOPS for ${selectedDevice}`,
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
          <select
            className={styles.deviceSelect}
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
          >
            {iopsData.map(device => (
              <option key={device.device} value={device.device}>
                {device.device}
              </option>
            ))}
          </select>
          <button
            className={styles.refreshButton}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {selectedDevice && historicalData.has(selectedDevice) ? (
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
