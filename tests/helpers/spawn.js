import { spawn } from 'node:child_process';

/**
 * Spawns a CLI tool under the running Node binary and captures output.
 * Rejects if the process cannot be spawned; resolves once it closes.
 *
 * @param {string[]} args - Script path followed by its arguments
 * @param {object} [options] - Spawn options
 * @param {Record<string, string>} [options.env] - Additional environment variables
 * @param {number} [options.timeout] - Process timeout in ms (default: 10000)
 * @returns {Promise<{ stdout: string, stderr: string, code: number | null }>} Captured output and exit code
 */
export const spawnTool = (args, options = {}) => {
  const { env = {}, timeout = 10000 } = options;
  const { promise, resolve, reject } = Promise.withResolvers();

  const proc = spawn(process.execPath, args, {
    env: { ...process.env, ...env },
    timeout,
  });

  const chunks = { stdout: [], stderr: [] };
  proc.stdout.on('data', (data) => chunks.stdout.push(data.toString()));
  proc.stderr.on('data', (data) => chunks.stderr.push(data.toString()));

  proc.on('error', reject);
  proc.on('close', (code) => {
    resolve({
      stdout: chunks.stdout.join(''),
      stderr: chunks.stderr.join(''),
      code,
    });
  });

  return promise;
};
