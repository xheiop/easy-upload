import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { getLatestRelease } from './tg-channel.js';

export default function getReleaseLog(core) {
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const changeLogPath = path.join(__dirname, '..', 'CHANGELOG.md');
    const changeLogData = fs.readFileSync(changeLogPath, 'UTF-8');
    const { body } = getLatestRelease(changeLogData);
    const { version } = JSON.parse(
      fs.readFileSync(`${__dirname}/../package.json`),
    );
    core.exportVariable('body', body.trim());
    core.exportVariable('version', version);
  } catch (error) {
    core.setFailed(error.message);
  }
}
