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

export interface SystemStats {
  diskUsage: DiskUsage[];
  iopsData: IOPSData[];
}

export type Theme = 'light' | 'dark';