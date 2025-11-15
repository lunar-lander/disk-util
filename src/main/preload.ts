import { contextBridge, ipcRenderer } from 'electron';
import {
  SystemStats,
  DiskUsage,
  IOPSData,
  SmartData,
  CpuData,
  MemoryData,
  NetworkData,
  ProcessIOData,
  SensorData
} from '../shared/types';

export interface ElectronAPI {
  // Original methods
  getDiskUsage: () => Promise<DiskUsage[]>;
  getIOPSData: () => Promise<IOPSData[]>;
  getSystemStats: () => Promise<SystemStats>;

  // Extended monitoring methods
  getSMARTData: () => Promise<SmartData[]>;
  getCPUData: () => Promise<CpuData>;
  getMemoryData: () => Promise<MemoryData>;
  getNetworkData: () => Promise<NetworkData[]>;
  getProcessIO: (limit?: number) => Promise<ProcessIOData[]>;
  getSensorData: () => Promise<SensorData[]>;

  // Utility methods
  formatBytes: (bytes: number, decimals?: number) => Promise<string>;
}

const electronAPI: ElectronAPI = {
  getDiskUsage: () => ipcRenderer.invoke('get-disk-usage'),
  getIOPSData: () => ipcRenderer.invoke('get-iops-data'),
  getSystemStats: () => ipcRenderer.invoke('get-system-stats'),
  getSMARTData: () => ipcRenderer.invoke('get-smart-data'),
  getCPUData: () => ipcRenderer.invoke('get-cpu-data'),
  getMemoryData: () => ipcRenderer.invoke('get-memory-data'),
  getNetworkData: () => ipcRenderer.invoke('get-network-data'),
  getProcessIO: (limit?: number) => ipcRenderer.invoke('get-process-io', limit),
  getSensorData: () => ipcRenderer.invoke('get-sensor-data'),
  formatBytes: (bytes: number, decimals?: number) => ipcRenderer.invoke('format-bytes', bytes, decimals),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
