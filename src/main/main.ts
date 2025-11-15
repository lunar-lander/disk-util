import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { SystemMonitor } from './system-monitor';

class App {
  private mainWindow: BrowserWindow | null = null;
  private systemMonitor: SystemMonitor;

  constructor() {
    this.systemMonitor = new SystemMonitor();
  }

  private createWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.loadURL('http://localhost:5173');
      this.mainWindow.webContents.openDevTools();
    } else {
      this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }
  }

  private setupIpcHandlers(): void {
    // Original handlers
    ipcMain.handle('get-disk-usage', async () => {
      return await this.systemMonitor.getDiskUsage();
    });

    ipcMain.handle('get-iops-data', async () => {
      return await this.systemMonitor.getIOPSData();
    });

    // Extended system stats with all data
    ipcMain.handle('get-system-stats', async () => {
      const [diskUsage, iopsData, smartData, cpuData, memoryData, networkData, processIO, sensors] = await Promise.all([
        this.systemMonitor.getDiskUsage(),
        this.systemMonitor.getIOPSData(),
        this.systemMonitor.getSMARTData(),
        this.systemMonitor.getCPUData(),
        this.systemMonitor.getMemoryData(),
        this.systemMonitor.getNetworkData(),
        this.systemMonitor.getProcessIOData(15),
        this.systemMonitor.getSensorData(),
      ]);

      return {
        diskUsage,
        iopsData,
        smartData,
        cpuData,
        memoryData,
        networkData,
        processIO,
        sensors,
        timestamp: Date.now()
      };
    });

    // Individual data handlers for granular control
    ipcMain.handle('get-smart-data', async () => {
      return await this.systemMonitor.getSMARTData();
    });

    ipcMain.handle('get-cpu-data', async () => {
      return await this.systemMonitor.getCPUData();
    });

    ipcMain.handle('get-memory-data', async () => {
      return await this.systemMonitor.getMemoryData();
    });

    ipcMain.handle('get-network-data', async () => {
      return await this.systemMonitor.getNetworkData();
    });

    ipcMain.handle('get-process-io', async (_event, limit: number = 15) => {
      return await this.systemMonitor.getProcessIOData(limit);
    });

    ipcMain.handle('get-sensor-data', async () => {
      return await this.systemMonitor.getSensorData();
    });

    // Utility handlers
    ipcMain.handle('format-bytes', (_event, bytes: number, decimals?: number) => {
      return this.systemMonitor.formatBytes(bytes, decimals);
    });
  }

  public init(): void {
    app.whenReady().then(() => {
      this.createWindow();
      this.setupIpcHandlers();

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createWindow();
        }
      });
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });
  }
}

const application = new App();
application.init();