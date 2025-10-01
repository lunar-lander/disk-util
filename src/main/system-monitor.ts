import { exec } from 'child_process';
import { promisify } from 'util';
import { DiskUsage, IOPSData } from '../shared/types';

const execAsync = promisify(exec);

export class SystemMonitor {
  private previousStats: Map<string, { reads: number; writes: number; timestamp: number }> = new Map();

  async getDiskUsage(): Promise<DiskUsage[]> {
    try {
      if (process.platform === 'win32') {
        return await this.getWindowsDiskUsage();
      } else {
        return await this.getUnixDiskUsage();
      }
    } catch (error) {
      console.error('Error getting disk usage:', error);
      return [];
    }
  }

  async getIOPSData(): Promise<IOPSData[]> {
    try {
      if (process.platform === 'win32') {
        return await this.getWindowsIOPS();
      } else {
        return await this.getUnixIOPS();
      }
    } catch (error) {
      console.error('Error getting IOPS data:', error);
      return [];
    }
  }

  private async getUnixDiskUsage(): Promise<DiskUsage[]> {
    const { stdout } = await execAsync('df -h --output=source,target,size,used,avail,pcent,fstype');
    const lines = stdout.trim().split('\n').slice(1); // Skip header

    return lines
      .filter(line => line.trim().length > 0)
      .map(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 7) {
          return {
            device: parts[0],
            mountPoint: parts[1],
            totalSpace: this.parseSize(parts[2]),
            usedSpace: this.parseSize(parts[3]),
            freeSpace: this.parseSize(parts[4]),
            usagePercentage: parseInt(parts[5].replace('%', '')),
            fileSystem: parts[6] || 'unknown'
          };
        }
        return null;
      })
      .filter(Boolean) as DiskUsage[];
  }

  private async getWindowsDiskUsage(): Promise<DiskUsage[]> {
    const { stdout } = await execAsync('wmic logicaldisk get size,freespace,caption,filesystem,volumename /format:csv');
    const lines = stdout.trim().split('\n').slice(1); // Skip header

    return lines
      .filter(line => line.includes(','))
      .map(line => {
        const parts = line.split(',').filter(p => p.trim());
        if (parts.length >= 5) {
          const totalSpace = parseInt(parts[2]) || 0;
          const freeSpace = parseInt(parts[1]) || 0;
          const usedSpace = totalSpace - freeSpace;
          const usagePercentage = totalSpace > 0 ? Math.round((usedSpace / totalSpace) * 100) : 0;

          return {
            device: parts[0],
            mountPoint: parts[0],
            totalSpace,
            usedSpace,
            freeSpace,
            usagePercentage,
            fileSystem: parts[3] || 'unknown'
          };
        }
        return null;
      })
      .filter(Boolean) as DiskUsage[];
  }

  private async getUnixIOPS(): Promise<IOPSData[]> {
    try {
      const { stdout } = await execAsync('cat /proc/diskstats');
      const lines = stdout.trim().split('\n');
      const currentTime = Date.now();
      const iopsData: IOPSData[] = [];

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 14) {
          const deviceName = parts[2];
          
          // Skip partitions and focus on main devices
          if (deviceName.match(/^[a-z]+\d+$/) || deviceName.startsWith('loop') || deviceName.startsWith('ram')) {
            continue;
          }

          const currentReads = parseInt(parts[3]) || 0;
          const currentWrites = parseInt(parts[7]) || 0;

          const previousData = this.previousStats.get(deviceName);
          
          if (previousData) {
            const timeDiff = (currentTime - previousData.timestamp) / 1000; // seconds
            const readIOPS = Math.max(0, Math.round((currentReads - previousData.reads) / timeDiff));
            const writeIOPS = Math.max(0, Math.round((currentWrites - previousData.writes) / timeDiff));

            iopsData.push({
              device: deviceName,
              readIOPS,
              writeIOPS,
              totalIOPS: readIOPS + writeIOPS,
              timestamp: currentTime
            });
          }

          this.previousStats.set(deviceName, {
            reads: currentReads,
            writes: currentWrites,
            timestamp: currentTime
          });
        }
      }

      return iopsData;
    } catch (error) {
      console.error('Error reading /proc/diskstats:', error);
      return [];
    }
  }

  private async getWindowsIOPS(): Promise<IOPSData[]> {
    try {
      // Use PowerShell to get disk performance counters
      const script = `
        Get-Counter "\\PhysicalDisk(*)\\Disk Reads/sec", "\\PhysicalDisk(*)\\Disk Writes/sec" | 
        ForEach-Object { 
          $_.CounterSamples | ForEach-Object { 
            "$($_.InstanceName),$($_.Path),$($_.CookedValue)" 
          } 
        }
      `;
      
      const { stdout } = await execAsync(`powershell -Command "${script}"`);
      const lines = stdout.trim().split('\n');
      const iopsMap: { [key: string]: { reads?: number; writes?: number } } = {};
      const currentTime = Date.now();

      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 3) {
          const deviceName = parts[0];
          const path = parts[1];
          const value = parseFloat(parts[2]) || 0;

          if (!iopsMap[deviceName]) {
            iopsMap[deviceName] = {};
          }

          if (path.includes('Reads/sec')) {
            iopsMap[deviceName].reads = Math.round(value);
          } else if (path.includes('Writes/sec')) {
            iopsMap[deviceName].writes = Math.round(value);
          }
        }
      }

      return Object.entries(iopsMap)
        .filter(([_, data]) => data.reads !== undefined && data.writes !== undefined)
        .map(([device, data]) => ({
          device,
          readIOPS: data.reads || 0,
          writeIOPS: data.writes || 0,
          totalIOPS: (data.reads || 0) + (data.writes || 0),
          timestamp: currentTime
        }));
    } catch (error) {
      console.error('Error getting Windows IOPS:', error);
      return [];
    }
  }

  private parseSize(sizeStr: string): number {
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*([KMGT]?)B?$/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    const multipliers: { [key: string]: number } = {
      '': 1,
      'K': 1024,
      'M': 1024 * 1024,
      'G': 1024 * 1024 * 1024,
      'T': 1024 * 1024 * 1024 * 1024
    };

    return Math.round(value * (multipliers[unit] || 1));
  }
}