import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';
import { HistoricalDataPoint, TrendAnalysis, AnomalyData, Prediction } from '../shared/types';

export class HistoricalDataStore {
  private db: Database.Database;
  private retentionDays: number;

  constructor(retentionDays: number = 30) {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'historical-data.db');

    this.db = new Database(dbPath);
    this.retentionDays = retentionDays;
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        metric TEXT NOT NULL,
        value REAL NOT NULL,
        device TEXT,
        metadata TEXT,
        INDEX idx_metric_timestamp (metric, timestamp),
        INDEX idx_device (device)
      );

      CREATE TABLE IF NOT EXISTS anomalies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        metric TEXT NOT NULL,
        value REAL NOT NULL,
        expected_value REAL NOT NULL,
        severity TEXT NOT NULL,
        description TEXT,
        device TEXT
      );

      CREATE TABLE IF NOT EXISTS alerts_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        type TEXT NOT NULL,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        device TEXT,
        acknowledged INTEGER DEFAULT 0
      );
    `);

    // Clean old data
    this.cleanOldData();
  }

  // ============================================================================
  // DATA STORAGE
  // ============================================================================

  storeMetric(metric: string, value: number, device?: string, metadata?: Record<string, any>): void {
    const stmt = this.db.prepare(`
      INSERT INTO metrics (timestamp, metric, value, device, metadata)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      Date.now(),
      metric,
      value,
      device || null,
      metadata ? JSON.stringify(metadata) : null
    );
  }

  storeBulkMetrics(dataPoints: HistoricalDataPoint[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO metrics (timestamp, metric, value, device, metadata)
      VALUES (?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((points: HistoricalDataPoint[]) => {
      for (const point of points) {
        stmt.run(
          point.timestamp,
          point.metric,
          point.value,
          point.device || null,
          point.metadata ? JSON.stringify(point.metadata) : null
        );
      }
    });

    transaction(dataPoints);
  }

  storeAnomaly(anomaly: AnomalyData, metric: string, device?: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO anomalies (timestamp, metric, value, expected_value, severity, description, device)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      anomaly.timestamp,
      metric,
      anomaly.value,
      anomaly.expectedValue,
      anomaly.severity,
      anomaly.description,
      device || null
    );
  }

  // ============================================================================
  // DATA RETRIEVAL
  // ============================================================================

  getMetricHistory(
    metric: string,
    timeRange: number = 3600000, // Default: last hour
    device?: string
  ): HistoricalDataPoint[] {
    const since = Date.now() - timeRange;

    let query = `
      SELECT timestamp, metric, value, device, metadata
      FROM metrics
      WHERE metric = ? AND timestamp >= ?
    `;

    const params: any[] = [metric, since];

    if (device) {
      query += ' AND device = ?';
      params.push(device);
    }

    query += ' ORDER BY timestamp ASC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      timestamp: row.timestamp,
      metric: row.metric,
      value: row.value,
      device: row.device,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
  }

  getLatestMetric(metric: string, device?: string): HistoricalDataPoint | null {
    let query = `
      SELECT timestamp, metric, value, device, metadata
      FROM metrics
      WHERE metric = ?
    `;

    const params: any[] = [metric];

    if (device) {
      query += ' AND device = ?';
      params.push(device);
    }

    query += ' ORDER BY timestamp DESC LIMIT 1';

    const stmt = this.db.prepare(query);
    const row = stmt.get(...params) as any;

    if (!row) return null;

    return {
      timestamp: row.timestamp,
      metric: row.metric,
      value: row.value,
      device: row.device,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }

  // ============================================================================
  // TREND ANALYSIS & PREDICTIONS
  // ============================================================================

  analyzeTrend(metric: string, device?: string, timeRange: number = 86400000): TrendAnalysis {
    const history = this.getMetricHistory(metric, timeRange, device);

    if (history.length === 0) {
      return {
        metric,
        device,
        current: 0,
        average: 0,
        min: 0,
        max: 0,
        trend: 'stable',
        changeRate: 0,
        anomalies: []
      };
    }

    const values = history.map(h => h.value);
    const current = values[values.length - 1];
    const average = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Calculate linear regression for trend
    const { slope, prediction } = this.linearRegression(history);

    // Determine trend direction
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    const changeThreshold = average * 0.05; // 5% change threshold

    if (Math.abs(slope) > changeThreshold) {
      trend = slope > 0 ? 'increasing' : 'decreasing';
    }

    // Get anomalies for this metric
    const anomalies = this.getAnomaliesForMetric(metric, timeRange, device);

    return {
      metric,
      device,
      current,
      average,
      min,
      max,
      trend,
      changeRate: slope * 86400, // Per day
      prediction,
      anomalies
    };
  }

  private linearRegression(data: HistoricalDataPoint[]): { slope: number; intercept: number; prediction?: Prediction } {
    if (data.length < 2) {
      return { slope: 0, intercept: 0 };
    }

    const n = data.length;
    const startTime = data[0].timestamp;

    // Normalize timestamps to hours from start
    const points = data.map((d, i) => ({
      x: (d.timestamp - startTime) / 3600000, // Hours
      y: d.value
    }));

    const sumX = points.reduce((sum, p) => sum + p.x, 0);
    const sumY = points.reduce((sum, p) => sum + p.y, 0);
    const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
    const sumXX = points.reduce((sum, p) => sum + p.x * p.x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Make prediction for 7 days into future
    const currentHours = (data[data.length - 1].timestamp - startTime) / 3600000;
    const futureHours = currentHours + (7 * 24); // 7 days ahead
    const predictedValue = slope * futureHours + intercept;

    // Calculate R-squared for confidence
    const yMean = sumY / n;
    const ssTotal = points.reduce((sum, p) => sum + Math.pow(p.y - yMean, 2), 0);
    const ssResidual = points.reduce((sum, p) => {
      const predicted = slope * p.x + intercept;
      return sum + Math.pow(p.y - predicted, 2);
    }, 0);
    const rSquared = 1 - (ssResidual / ssTotal);

    // For disk usage predictions, calculate time to full
    let timeToFull: number | undefined;
    if (slope > 0 && predictedValue < 100) {
      const hoursToFull = (100 - (slope * currentHours + intercept)) / slope;
      timeToFull = hoursToFull / 24; // Convert to days
      if (timeToFull < 0 || timeToFull > 365) {
        timeToFull = undefined; // Unrealistic prediction
      }
    }

    return {
      slope,
      intercept,
      prediction: {
        predictedValue: Math.max(0, predictedValue),
        confidence: Math.max(0, Math.min(1, rSquared)),
        timeHorizon: 7,
        timeToFull
      }
    };
  }

  // ============================================================================
  // ANOMALY DETECTION
  // ============================================================================

  detectAnomalies(metric: string, device?: string, sensitivity: number = 2.5): AnomalyData[] {
    const history = this.getMetricHistory(metric, 86400000, device); // Last 24 hours

    if (history.length < 10) return []; // Need enough data

    const values = history.map(h => h.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length
    );

    const anomalies: AnomalyData[] = [];
    const threshold = stdDev * sensitivity;

    for (let i = 0; i < history.length; i++) {
      const deviation = Math.abs(history[i].value - mean);

      if (deviation > threshold) {
        const severity = deviation > threshold * 2 ? 'high' :
                        deviation > threshold * 1.5 ? 'medium' : 'low';

        const anomaly: AnomalyData = {
          timestamp: history[i].timestamp,
          value: history[i].value,
          expectedValue: mean,
          severity,
          description: `${metric} deviated by ${deviation.toFixed(2)} from expected ${mean.toFixed(2)}`
        };

        anomalies.push(anomaly);

        // Store anomaly
        this.storeAnomaly(anomaly, metric, device);
      }
    }

    return anomalies;
  }

  private getAnomaliesForMetric(metric: string, timeRange: number, device?: string): AnomalyData[] {
    const since = Date.now() - timeRange;

    let query = `
      SELECT timestamp, value, expected_value, severity, description
      FROM anomalies
      WHERE metric = ? AND timestamp >= ?
    `;

    const params: any[] = [metric, since];

    if (device) {
      query += ' AND device = ?';
      params.push(device);
    }

    query += ' ORDER BY timestamp DESC LIMIT 10';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      timestamp: row.timestamp,
      value: row.value,
      expectedValue: row.expected_value,
      severity: row.severity,
      description: row.description
    }));
  }

  // ============================================================================
  // MAINTENANCE
  // ============================================================================

  private cleanOldData(): void {
    const cutoffTime = Date.now() - (this.retentionDays * 24 * 60 * 60 * 1000);

    this.db.prepare('DELETE FROM metrics WHERE timestamp < ?').run(cutoffTime);
    this.db.prepare('DELETE FROM anomalies WHERE timestamp < ?').run(cutoffTime);
    this.db.prepare('DELETE FROM alerts_history WHERE timestamp < ?').run(cutoffTime);
  }

  vacuum(): void {
    this.db.exec('VACUUM');
  }

  close(): void {
    this.db.close();
  }

  getStats(): { totalRecords: number; dbSize: number; oldestRecord: number; newestRecord: number } {
    const totalRecords = this.db.prepare('SELECT COUNT(*) as count FROM metrics').get() as any;
    const oldest = this.db.prepare('SELECT MIN(timestamp) as ts FROM metrics').get() as any;
    const newest = this.db.prepare('SELECT MAX(timestamp) as ts FROM metrics').get() as any;

    return {
      totalRecords: totalRecords.count,
      dbSize: 0, // Would need to check file size
      oldestRecord: oldest.ts || 0,
      newestRecord: newest.ts || 0
    };
  }
}
