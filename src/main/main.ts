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
    ipcMain.handle('get-disk-usage', async () => {
      return await this.systemMonitor.getDiskUsage();
    });

    ipcMain.handle('get-iops-data', async () => {
      return await this.systemMonitor.getIOPSData();
    });

    ipcMain.handle('get-system-stats', async () => {
      const [diskUsage, iopsData] = await Promise.all([
        this.systemMonitor.getDiskUsage(),
        this.systemMonitor.getIOPSData(),
      ]);
      return { diskUsage, iopsData };
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