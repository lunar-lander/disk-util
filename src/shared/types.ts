// ============================================================================
// DISK & STORAGE TYPES
// ============================================================================

export interface DiskUsage {
  device: string;
  mountPoint: string;
  totalSpace: number;
  usedSpace: number;
  freeSpace: number;
  usagePercentage: number;
  fileSystem: string;
}

export interface IOPSData {
  device: string;
  readIOPS: number;
  writeIOPS: number;
  totalIOPS: number;
  timestamp: number;
}

// S.M.A.R.T. Health Monitoring
export interface SmartData {
  device: string;
  temperature?: number; // Celsius
  powerOnHours?: number;
  powerCycleCount?: number;
  reallocatedSectors?: number;
  pendingSectors?: number;
  uncorrectableErrors?: number;
  wearLevelingCount?: number; // For SSDs
  healthStatus: 'PASSED' | 'FAILED' | 'UNKNOWN';
  attributes: SmartAttribute[];
  timestamp: number;
}

export interface SmartAttribute {
  id: number;
  name: string;
  value: number;
  worst: number;
  threshold: number;
  raw: string;
  status: 'OK' | 'WARNING' | 'CRITICAL';
}

// ============================================================================
// SYSTEM RESOURCES
// ============================================================================

export interface CpuData {
  usage: number; // Overall CPU usage percentage
  cores: CpuCoreData[];
  temperature?: number;
  frequency?: number; // MHz
  processes: number;
  loadAverage?: number[];
  timestamp: number;
}

export interface CpuCoreData {
  core: number;
  usage: number;
  frequency?: number;
}

export interface MemoryData {
  total: number; // bytes
  used: number;
  free: number;
  available: number;
  usagePercentage: number;
  swapTotal: number;
  swapUsed: number;
  swapFree: number;
  cached?: number;
  buffers?: number;
  timestamp: number;
}

export interface NetworkData {
  interface: string;
  bytesReceived: number;
  bytesSent: number;
  packetsReceived: number;
  packetsSent: number;
  receiveSpeed: number; // bytes/sec
  sendSpeed: number; // bytes/sec
  errors: number;
  dropped: number;
  timestamp: number;
}

// ============================================================================
// PROCESS MONITORING
// ============================================================================

export interface ProcessIOData {
  pid: number;
  name: string;
  user: string;
  readBytes: number;
  writeBytes: number;
  readSpeed: number; // bytes/sec
  writeSpeed: number; // bytes/sec
  cpuUsage: number;
  memoryUsage: number;
  timestamp: number;
}

// ============================================================================
// HARDWARE SENSORS
// ============================================================================

export interface SensorData {
  name: string;
  type: 'temperature' | 'fan' | 'voltage' | 'power';
  value: number;
  unit: string;
  min?: number;
  max?: number;
  critical?: number;
  timestamp: number;
}

// ============================================================================
// FILE SYSTEM ANALYSIS
// ============================================================================

export interface FileSystemAnalysis {
  device: string;
  mountPoint: string;
  largestFiles: FileInfo[];
  largestFolders: FolderInfo[];
  fileTypeBreakdown: FileTypeBreakdown[];
  totalFiles: number;
  totalFolders: number;
  timestamp: number;
}

export interface FileInfo {
  path: string;
  size: number;
  modified: number;
  type: string;
}

export interface FolderInfo {
  path: string;
  size: number;
  fileCount: number;
  subfolderCount: number;
}

export interface FileTypeBreakdown {
  extension: string;
  count: number;
  totalSize: number;
  percentage: number;
}

// ============================================================================
// HISTORICAL & ANALYTICS
// ============================================================================

export interface HistoricalDataPoint {
  timestamp: number;
  metric: string;
  value: number;
  device?: string;
  metadata?: Record<string, any>;
}

export interface TrendAnalysis {
  metric: string;
  device?: string;
  current: number;
  average: number;
  min: number;
  max: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  changeRate: number; // per day
  prediction?: Prediction;
  anomalies: AnomalyData[];
}

export interface Prediction {
  timeToFull?: number; // days until disk is full
  predictedValue: number;
  confidence: number; // 0-1
  timeHorizon: number; // days into future
}

export interface AnomalyData {
  timestamp: number;
  value: number;
  expectedValue: number;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

// ============================================================================
// BENCHMARKING
// ============================================================================

export interface BenchmarkResult {
  device: string;
  testType: 'sequential-read' | 'sequential-write' | 'random-read' | 'random-write';
  speed: number; // MB/s
  iops: number;
  latency: number; // ms
  duration: number; // seconds
  timestamp: number;
}

// ============================================================================
// ALERTS & NOTIFICATIONS
// ============================================================================

export interface Alert {
  id: string;
  type: 'disk-space' | 'iops' | 'temperature' | 'smart' | 'process' | 'custom';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  device?: string;
  value?: number;
  threshold?: number;
  timestamp: number;
  acknowledged: boolean;
  conditions: AlertCondition[];
}

export interface AlertCondition {
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  value: number;
  duration?: number; // seconds - how long condition must be true
}

export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: AlertCondition[];
  severity: 'info' | 'warning' | 'critical';
  actions: AlertAction[];
}

export interface AlertAction {
  type: 'notification' | 'email' | 'webhook' | 'script';
  config: Record<string, any>;
}

// ============================================================================
// DASHBOARD & UI
// ============================================================================

export interface DashboardWidget {
  id: string;
  type: 'disk-usage' | 'iops' | 'cpu' | 'memory' | 'network' | 'smart' | 'processes' | 'sensors' | 'alerts' | 'chart' | 'gauge';
  title: string;
  position: { x: number; y: number; w: number; h: number };
  config: Record<string, any>;
}

export interface DashboardLayout {
  id: string;
  name: string;
  widgets: DashboardWidget[];
  isDefault: boolean;
}

export interface ChartConfig {
  type: 'line' | 'area' | 'bar' | 'stacked' | 'heatmap' | 'sparkline' | 'gauge';
  metrics: string[];
  timeRange: number; // seconds
  refreshInterval: number; // seconds
  options?: Record<string, any>;
}

// ============================================================================
// EXPORT & REPORTS
// ============================================================================

export interface ExportOptions {
  format: 'pdf' | 'csv' | 'json' | 'png';
  includeCharts: boolean;
  timeRange?: { start: number; end: number };
  metrics?: string[];
}

export interface Report {
  id: string;
  name: string;
  schedule?: 'daily' | 'weekly' | 'monthly';
  format: 'pdf' | 'csv';
  sections: ReportSection[];
  recipients?: string[];
}

export interface ReportSection {
  type: 'summary' | 'chart' | 'table' | 'text';
  title: string;
  config: Record<string, any>;
}

// ============================================================================
// CUSTOM METRICS
// ============================================================================

export interface CustomMetric {
  id: string;
  name: string;
  expression: string; // JavaScript expression
  unit: string;
  description?: string;
}

// ============================================================================
// SYSTEM STATS (Extended)
// ============================================================================

export interface SystemStats {
  diskUsage: DiskUsage[];
  iopsData: IOPSData[];
  smartData?: SmartData[];
  cpuData?: CpuData;
  memoryData?: MemoryData;
  networkData?: NetworkData[];
  processIO?: ProcessIOData[];
  sensors?: SensorData[];
  timestamp: number;
}

// ============================================================================
// GENERAL
// ============================================================================

export type Theme = 'light' | 'dark';

export interface AppSettings {
  theme: Theme;
  refreshInterval: number;
  enableAlerts: boolean;
  enableHistoricalData: boolean;
  dataRetentionDays: number;
  currentLayout?: string;
}