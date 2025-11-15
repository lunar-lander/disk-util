import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import {
  DiskUsage,
  IOPSData,
  SmartData,
  SmartAttribute,
  CpuData,
  CpuCoreData,
  MemoryData,
  NetworkData,
  ProcessIOData,
  SensorData,
  FileSystemAnalysis,
  FileInfo,
  FolderInfo,
  FileTypeBreakdown,
  BenchmarkResult
} from '../shared/types';

const execAsync = promisify(exec);

export class SystemMonitor {
  private previousStats: Map<string, { reads: number; writes: number; timestamp: number }> = new Map();
  private previousNetworkStats: Map<string, { rx: number; tx: number; timestamp: number }> = new Map();
  private previousCpuStats: { idle: number; total: number; timestamp: number } | null = null;
  private previousProcessIO: Map<number, { readBytes: number; writeBytes: number; timestamp: number }> = new Map();

  // ============================================================================
  // DISK USAGE (Enhanced)
  // ============================================================================

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

  // ============================================================================
  // IOPS DATA
  // ============================================================================

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

  // ============================================================================
  // S.M.A.R.T. HEALTH MONITORING
  // ============================================================================

  async getSMARTData(): Promise<SmartData[]> {
    try {
      if (process.platform === 'win32') {
        return await this.getWindowsSMART();
      } else {
        return await this.getUnixSMART();
      }
    } catch (error) {
      console.error('Error getting S.M.A.R.T. data:', error);
      return [];
    }
  }

  private async getUnixSMART(): Promise<SmartData[]> {
    try {
      // Get list of disk devices
      const { stdout: lsblkOut } = await execAsync('lsblk -d -n -o NAME,TYPE | grep disk');
      const devices = lsblkOut.trim().split('\n').map(line => '/dev/' + line.split(/\s+/)[0]);

      const smartData: SmartData[] = [];

      for (const device of devices) {
        try {
          // Check if smartctl is available
          const { stdout } = await execAsync(`sudo smartctl -A ${device} -j 2>/dev/null || echo "{}"`);
          const data = JSON.parse(stdout || '{}');

          if (!data.ata_smart_attributes) {
            continue;
          }

          const attributes: SmartAttribute[] = data.ata_smart_attributes.table.map((attr: any) => ({
            id: attr.id,
            name: attr.name,
            value: attr.value,
            worst: attr.worst,
            threshold: attr.thresh,
            raw: attr.raw.string,
            status: attr.value > attr.thresh ? 'OK' : 'CRITICAL'
          }));

          // Extract key metrics
          const tempAttr = attributes.find(a => a.name.includes('Temperature'));
          const powerOnAttr = attributes.find(a => a.name.includes('Power_On_Hours'));
          const reallocAttr = attributes.find(a => a.name.includes('Reallocated_Sector'));
          const pendingAttr = attributes.find(a => a.name.includes('Current_Pending_Sector'));

          smartData.push({
            device: device.replace('/dev/', ''),
            temperature: tempAttr ? parseInt(tempAttr.raw) : undefined,
            powerOnHours: powerOnAttr ? parseInt(powerOnAttr.raw) : undefined,
            reallocatedSectors: reallocAttr ? parseInt(reallocAttr.raw) : undefined,
            pendingSectors: pendingAttr ? parseInt(pendingAttr.raw) : undefined,
            healthStatus: data.smart_status?.passed ? 'PASSED' : 'FAILED',
            attributes,
            timestamp: Date.now()
          });
        } catch (err) {
          // Device doesn't support SMART or permission denied
          continue;
        }
      }

      return smartData;
    } catch (error) {
      console.error('Error reading SMART data:', error);
      return [];
    }
  }

  private async getWindowsSMART(): Promise<SmartData[]> {
    try {
      // Use WMI to get disk health info
      const script = `
        Get-WmiObject -Namespace root\\wmi -Class MSStorageDriver_FailurePredictStatus |
        Select-Object InstanceName, PredictFailure, Reason | ConvertTo-Json
      `;

      const { stdout } = await execAsync(`powershell -Command "${script}"`);
      const data = JSON.parse(stdout || '[]');
      const devices = Array.isArray(data) ? data : [data];

      return devices.map(dev => ({
        device: dev.InstanceName?.split('\\')[0] || 'Unknown',
        healthStatus: dev.PredictFailure ? 'FAILED' : 'PASSED',
        attributes: [],
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error getting Windows SMART data:', error);
      return [];
    }
  }

  // ============================================================================
  // CPU MONITORING
  // ============================================================================

  async getCPUData(): Promise<CpuData> {
    try {
      if (process.platform === 'win32') {
        return await this.getWindowsCPU();
      } else {
        return await this.getUnixCPU();
      }
    } catch (error) {
      console.error('Error getting CPU data:', error);
      return this.getEmptyCPUData();
    }
  }

  private async getUnixCPU(): Promise<CpuData> {
    try {
      // Read /proc/stat for overall CPU and per-core stats
      const { stdout: statOut } = await execAsync('cat /proc/stat');
      const lines = statOut.split('\n');

      const currentTime = Date.now();
      const cores: CpuCoreData[] = [];
      let totalUsage = 0;

      // Parse overall CPU (first line)
      const cpuLine = lines[0].split(/\s+/).slice(1).map(Number);
      const idle = cpuLine[3];
      const total = cpuLine.reduce((a, b) => a + b, 0);

      if (this.previousCpuStats) {
        const idleDelta = idle - this.previousCpuStats.idle;
        const totalDelta = total - this.previousCpuStats.total;
        totalUsage = totalDelta > 0 ? ((totalDelta - idleDelta) / totalDelta) * 100 : 0;
      }

      this.previousCpuStats = { idle, total, timestamp: currentTime };

      // Parse per-core stats
      const coreLines = lines.filter(l => l.startsWith('cpu') && l !== lines[0]);
      coreLines.forEach((line, index) => {
        const values = line.split(/\s+/).slice(1).map(Number);
        const coreIdle = values[3];
        const coreTotal = values.reduce((a, b) => a + b, 0);
        const usage = coreTotal > 0 ? ((coreTotal - coreIdle) / coreTotal) * 100 : 0;

        cores.push({
          core: index,
          usage: Math.min(100, Math.max(0, usage))
        });
      });

      // Get load average
      const { stdout: loadOut } = await execAsync('cat /proc/loadavg');
      const loadAverage = loadOut.trim().split(/\s+/).slice(0, 3).map(Number);

      // Get process count
      const { stdout: psOut } = await execAsync('ps aux | wc -l');
      const processes = parseInt(psOut.trim()) - 1; // Subtract header line

      // Try to get temperature (if available)
      let temperature: number | undefined;
      try {
        const { stdout: tempOut } = await execAsync('cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null');
        temperature = parseInt(tempOut.trim()) / 1000; // Convert to Celsius
      } catch {
        // Temperature not available
      }

      return {
        usage: Math.min(100, Math.max(0, totalUsage)),
        cores,
        temperature,
        processes,
        loadAverage,
        timestamp: currentTime
      };
    } catch (error) {
      console.error('Error reading Unix CPU data:', error);
      return this.getEmptyCPUData();
    }
  }

  private async getWindowsCPU(): Promise<CpuData> {
    try {
      const script = `
        $cpu = Get-WmiObject Win32_Processor
        $perfCpu = Get-Counter "\\Processor(_Total)\\% Processor Time"
        @{
          Usage = $perfCpu.CounterSamples[0].CookedValue
          Name = $cpu.Name
          NumberOfCores = $cpu.NumberOfCores
          MaxClockSpeed = $cpu.MaxClockSpeed
        } | ConvertTo-Json
      `;

      const { stdout } = await execAsync(`powershell -Command "${script}"`);
      const data = JSON.parse(stdout);

      return {
        usage: Math.min(100, Math.max(0, data.Usage || 0)),
        cores: Array.from({ length: data.NumberOfCores || 1 }, (_, i) => ({
          core: i,
          usage: 0 // Would need per-core monitoring on Windows
        })),
        frequency: data.MaxClockSpeed,
        processes: 0,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error getting Windows CPU data:', error);
      return this.getEmptyCPUData();
    }
  }

  private getEmptyCPUData(): CpuData {
    return {
      usage: 0,
      cores: [],
      processes: 0,
      timestamp: Date.now()
    };
  }

  // ============================================================================
  // MEMORY MONITORING
  // ============================================================================

  async getMemoryData(): Promise<MemoryData> {
    try {
      if (process.platform === 'win32') {
        return await this.getWindowsMemory();
      } else {
        return await this.getUnixMemory();
      }
    } catch (error) {
      console.error('Error getting memory data:', error);
      return this.getEmptyMemoryData();
    }
  }

  private async getUnixMemory(): Promise<MemoryData> {
    try {
      const { stdout } = await execAsync('cat /proc/meminfo');
      const lines = stdout.split('\n');
      const memInfo: { [key: string]: number } = {};

      lines.forEach(line => {
        const match = line.match(/^(\w+):\s+(\d+)/);
        if (match) {
          memInfo[match[1]] = parseInt(match[2]) * 1024; // Convert KB to bytes
        }
      });

      const total = memInfo.MemTotal || 0;
      const free = memInfo.MemFree || 0;
      const available = memInfo.MemAvailable || free;
      const buffers = memInfo.Buffers || 0;
      const cached = memInfo.Cached || 0;
      const used = total - available;
      const usagePercentage = total > 0 ? (used / total) * 100 : 0;

      const swapTotal = memInfo.SwapTotal || 0;
      const swapFree = memInfo.SwapFree || 0;
      const swapUsed = swapTotal - swapFree;

      return {
        total,
        used,
        free,
        available,
        usagePercentage,
        swapTotal,
        swapUsed,
        swapFree,
        cached,
        buffers,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error reading Unix memory data:', error);
      return this.getEmptyMemoryData();
    }
  }

  private async getWindowsMemory(): Promise<MemoryData> {
    try {
      const script = `
        $os = Get-WmiObject Win32_OperatingSystem
        @{
          TotalVisibleMemorySize = $os.TotalVisibleMemorySize
          FreePhysicalMemory = $os.FreePhysicalMemory
          TotalVirtualMemorySize = $os.TotalVirtualMemorySize
          FreeVirtualMemory = $os.FreeVirtualMemory
        } | ConvertTo-Json
      `;

      const { stdout } = await execAsync(`powershell -Command "${script}"`);
      const data = JSON.parse(stdout);

      const total = (data.TotalVisibleMemorySize || 0) * 1024; // Convert KB to bytes
      const free = (data.FreePhysicalMemory || 0) * 1024;
      const used = total - free;
      const usagePercentage = total > 0 ? (used / total) * 100 : 0;

      return {
        total,
        used,
        free,
        available: free,
        usagePercentage,
        swapTotal: 0,
        swapUsed: 0,
        swapFree: 0,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error getting Windows memory data:', error);
      return this.getEmptyMemoryData();
    }
  }

  private getEmptyMemoryData(): MemoryData {
    return {
      total: 0,
      used: 0,
      free: 0,
      available: 0,
      usagePercentage: 0,
      swapTotal: 0,
      swapUsed: 0,
      swapFree: 0,
      timestamp: Date.now()
    };
  }

  // ============================================================================
  // NETWORK MONITORING
  // ============================================================================

  async getNetworkData(): Promise<NetworkData[]> {
    try {
      if (process.platform === 'win32') {
        return await this.getWindowsNetwork();
      } else {
        return await this.getUnixNetwork();
      }
    } catch (error) {
      console.error('Error getting network data:', error);
      return [];
    }
  }

  private async getUnixNetwork(): Promise<NetworkData[]> {
    try {
      const { stdout } = await execAsync('cat /proc/net/dev');
      const lines = stdout.split('\n').slice(2); // Skip header lines
      const currentTime = Date.now();
      const networkData: NetworkData[] = [];

      for (const line of lines) {
        if (!line.trim()) continue;

        const parts = line.trim().split(/\s+/);
        if (parts.length < 10) continue;

        const interfaceName = parts[0].replace(':', '');

        // Skip loopback
        if (interfaceName === 'lo') continue;

        const bytesReceived = parseInt(parts[1]) || 0;
        const packetsReceived = parseInt(parts[2]) || 0;
        const errorsRx = parseInt(parts[3]) || 0;
        const droppedRx = parseInt(parts[4]) || 0;
        const bytesSent = parseInt(parts[9]) || 0;
        const packetsSent = parseInt(parts[10]) || 0;
        const errorsTx = parseInt(parts[11]) || 0;
        const droppedTx = parseInt(parts[12]) || 0;

        const previousData = this.previousNetworkStats.get(interfaceName);
        let receiveSpeed = 0;
        let sendSpeed = 0;

        if (previousData) {
          const timeDiff = (currentTime - previousData.timestamp) / 1000; // seconds
          receiveSpeed = Math.max(0, (bytesReceived - previousData.rx) / timeDiff);
          sendSpeed = Math.max(0, (bytesSent - previousData.tx) / timeDiff);
        }

        this.previousNetworkStats.set(interfaceName, {
          rx: bytesReceived,
          tx: bytesSent,
          timestamp: currentTime
        });

        networkData.push({
          interface: interfaceName,
          bytesReceived,
          bytesSent,
          packetsReceived,
          packetsSent,
          receiveSpeed,
          sendSpeed,
          errors: errorsRx + errorsTx,
          dropped: droppedRx + droppedTx,
          timestamp: currentTime
        });
      }

      return networkData;
    } catch (error) {
      console.error('Error reading Unix network data:', error);
      return [];
    }
  }

  private async getWindowsNetwork(): Promise<NetworkData[]> {
    try {
      const script = `
        Get-Counter "\\Network Interface(*)\\Bytes Received/sec",
                    "\\Network Interface(*)\\Bytes Sent/sec" |
        ForEach-Object {
          $_.CounterSamples | ForEach-Object {
            "$($_.InstanceName),$($_.Path),$($_.CookedValue)"
          }
        }
      `;

      const { stdout } = await execAsync(`powershell -Command "${script}"`);
      const lines = stdout.trim().split('\n');
      const netMap: { [key: string]: { rx?: number; tx?: number } } = {};
      const currentTime = Date.now();

      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 3) {
          const interfaceName = parts[0];
          const path = parts[1];
          const value = parseFloat(parts[2]) || 0;

          if (!netMap[interfaceName]) {
            netMap[interfaceName] = {};
          }

          if (path.includes('Received')) {
            netMap[interfaceName].rx = value;
          } else if (path.includes('Sent')) {
            netMap[interfaceName].tx = value;
          }
        }
      }

      return Object.entries(netMap)
        .filter(([_, data]) => data.rx !== undefined && data.tx !== undefined)
        .map(([interfaceName, data]) => ({
          interface: interfaceName,
          bytesReceived: 0,
          bytesSent: 0,
          packetsReceived: 0,
          packetsSent: 0,
          receiveSpeed: data.rx || 0,
          sendSpeed: data.tx || 0,
          errors: 0,
          dropped: 0,
          timestamp: currentTime
        }));
    } catch (error) {
      console.error('Error getting Windows network data:', error);
      return [];
    }
  }

  // ============================================================================
  // PROCESS I/O MONITORING
  // ============================================================================

  async getProcessIOData(limit: number = 10): Promise<ProcessIOData[]> {
    try {
      if (process.platform === 'win32') {
        return await this.getWindowsProcessIO(limit);
      } else {
        return await this.getUnixProcessIO(limit);
      }
    } catch (error) {
      console.error('Error getting process I/O data:', error);
      return [];
    }
  }

  private async getUnixProcessIO(limit: number): Promise<ProcessIOData[]> {
    try {
      // Get top processes by I/O
      const { stdout } = await execAsync(
        `ps aux --sort=-rss | head -n ${limit + 1} | tail -n ${limit}`
      );
      const lines = stdout.trim().split('\n');
      const currentTime = Date.now();
      const processData: ProcessIOData[] = [];

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 11) continue;

        const user = parts[0];
        const pid = parseInt(parts[1]);
        const cpuUsage = parseFloat(parts[2]);
        const memoryUsage = parseFloat(parts[3]);
        const name = parts.slice(10).join(' ');

        // Try to read I/O stats from /proc
        let readBytes = 0;
        let writeBytes = 0;
        let readSpeed = 0;
        let writeSpeed = 0;

        try {
          const ioPath = `/proc/${pid}/io`;
          if (fs.existsSync(ioPath)) {
            const ioData = fs.readFileSync(ioPath, 'utf-8');
            const readMatch = ioData.match(/read_bytes:\s*(\d+)/);
            const writeMatch = ioData.match(/write_bytes:\s*(\d+)/);

            if (readMatch) readBytes = parseInt(readMatch[1]);
            if (writeMatch) writeBytes = parseInt(writeMatch[1]);

            const previousData = this.previousProcessIO.get(pid);
            if (previousData) {
              const timeDiff = (currentTime - previousData.timestamp) / 1000;
              readSpeed = Math.max(0, (readBytes - previousData.readBytes) / timeDiff);
              writeSpeed = Math.max(0, (writeBytes - previousData.writeBytes) / timeDiff);
            }

            this.previousProcessIO.set(pid, {
              readBytes,
              writeBytes,
              timestamp: currentTime
            });
          }
        } catch {
          // Process may have ended or no permission
        }

        processData.push({
          pid,
          name,
          user,
          readBytes,
          writeBytes,
          readSpeed,
          writeSpeed,
          cpuUsage,
          memoryUsage,
          timestamp: currentTime
        });
      }

      // Sort by I/O speed
      return processData.sort((a, b) =>
        (b.readSpeed + b.writeSpeed) - (a.readSpeed + a.writeSpeed)
      );
    } catch (error) {
      console.error('Error reading Unix process I/O:', error);
      return [];
    }
  }

  private async getWindowsProcessIO(limit: number): Promise<ProcessIOData[]> {
    try {
      const script = `
        Get-Process | Sort-Object WorkingSet -Descending | Select-Object -First ${limit} |
        Select-Object Id, ProcessName, CPU, WorkingSet | ConvertTo-Json
      `;

      const { stdout } = await execAsync(`powershell -Command "${script}"`);
      const processes = JSON.parse(stdout || '[]');
      const processList = Array.isArray(processes) ? processes : [processes];

      return processList.map(proc => ({
        pid: proc.Id || 0,
        name: proc.ProcessName || 'Unknown',
        user: 'Unknown',
        readBytes: 0,
        writeBytes: 0,
        readSpeed: 0,
        writeSpeed: 0,
        cpuUsage: proc.CPU || 0,
        memoryUsage: proc.WorkingSet || 0,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error getting Windows process I/O:', error);
      return [];
    }
  }

  // ============================================================================
  // HARDWARE SENSORS
  // ============================================================================

  async getSensorData(): Promise<SensorData[]> {
    try {
      if (process.platform === 'win32') {
        return await this.getWindowsSensors();
      } else {
        return await this.getUnixSensors();
      }
    } catch (error) {
      console.error('Error getting sensor data:', error);
      return [];
    }
  }

  private async getUnixSensors(): Promise<SensorData[]> {
    try {
      // Try to use 'sensors' command (from lm-sensors package)
      const { stdout } = await execAsync('sensors -A 2>/dev/null || echo ""');
      if (!stdout.trim()) return [];

      const lines = stdout.split('\n');
      const sensors: SensorData[] = [];
      const currentTime = Date.now();

      for (const line of lines) {
        // Parse temperature lines (e.g., "Core 0:       +45.0°C")
        const tempMatch = line.match(/^([^:]+):\s+\+?([\d.]+)°C/);
        if (tempMatch) {
          sensors.push({
            name: tempMatch[1].trim(),
            type: 'temperature',
            value: parseFloat(tempMatch[2]),
            unit: '°C',
            timestamp: currentTime
          });
        }

        // Parse fan lines (e.g., "fan1:        1500 RPM")
        const fanMatch = line.match(/^([^:]+):\s+([\d.]+)\s*RPM/);
        if (fanMatch) {
          sensors.push({
            name: fanMatch[1].trim(),
            type: 'fan',
            value: parseFloat(fanMatch[2]),
            unit: 'RPM',
            timestamp: currentTime
          });
        }
      }

      return sensors;
    } catch (error) {
      // lm-sensors not available
      return [];
    }
  }

  private async getWindowsSensors(): Promise<SensorData[]> {
    // Windows sensor monitoring requires additional tools or WMI namespaces
    // This is a placeholder - would need OpenHardwareMonitor or similar
    return [];
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

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

  formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}
