import { Server } from "net";

// Create a mock server to test against
export async function startMockServer(port: number): Promise<Server> {
  const server = new Server();

  try {
    await new Promise((resolve, reject) => {
      server
        .listen(port, () => resolve(undefined))
        .on("error", (err) => reject(err));
    });
  } catch (err) {
    throw new Error(`mock server error: port ${port} already in use`);
  }

  server.on("error", (err: any) => {
    if (err.code !== "EADDRINUSE") {
      console.log("Line 21 test/util.ts");
      throw err;
    }
  });

  return server;
}

// Stop the mock server
export async function stopMockServer(server: Server): Promise<void> {
  return await new Promise((resolve, reject) => {
    if (!server.listening) {
      return resolve(undefined);
    }

    server.close((err: any) => {
      if (err != null) {
        reject(
          new Error(
            "mock server error while stopping: " + (err.toString() as string)
          )
        );
      } else {
        resolve(undefined);
      }
    });
  });
}

// Measure the execution time of a function, e.g., start/shutdown
export async function measureExecutionTime(fn: () => any): Promise<number> {
  const start = process.hrtime.bigint();
  await fn();
  const end = process.hrtime.bigint();

  // execution time in milliseconds
  const executionTime = Number(end - start) / 1e6;
  return executionTime;
}

// Calculate the median execution time
function calculateMedian(values: number[]): number {
  values.sort((a, b) => a - b);
  const half = Math.floor(values.length / 2);
  if (values.length % 2 > 0) return values[half];
  return (values[half - 1] + values[half]) / 2.0;
}

// Log metrics for min, max, average, and median execution times
export function logMetrics(metricName: string, metricArray: number[]): void {
  if (metricArray.length === 0) {
    console.log(`  ${metricName}: no data`);
    return;
  }

  const min = Math.min(...metricArray);
  const max = Math.max(...metricArray);
  const average = metricArray.reduce((a, b) => a + b, 0) / metricArray.length;
  const median = calculateMedian(metricArray);

  console.log(`  ${metricName}`);
  console.log(`    min: ${Math.round(min)}ms`);
  console.log(`    max: ${Math.round(max)}ms`);
  console.log(`    average: ${Math.round(isNaN(average) ? 0 : average)}ms`);
  console.log(`    median: ${Math.round(median)}ms`);
}
