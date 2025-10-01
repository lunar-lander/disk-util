import { contextBridge, ipcRenderer } from 'electron';
import { SystemStats, DiskUsage, IOPSData } from '../shared/types';

export interface ElectronAPI {
  getDiskUsage: () => Promise<DiskUsage[]>;
  getIOPSData: () => Promise<IOPSData[]>;
  getSystemStats: () => Promise<SystemStats>;
}

const electronAPI: ElectronAPI = {
  getDiskUsage: () => ipcRenderer.invoke('get-disk-usage'),
  getIOPSData: () => ipcRenderer.invoke('get-iops-data'),
  getSystemStats: () => ipcRenderer.invoke('get-system-stats'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);