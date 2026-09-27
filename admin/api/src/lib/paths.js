import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const API_ROOT = path.join(__dirname, '..', '..');
export const PROJECT_ROOT = path.join(API_ROOT, '..', '..');
export const DATA_DIR = path.join(PROJECT_ROOT, 'data');
export const HISTORY_DIR = path.join(PROJECT_ROOT, 'server', 'var', 'vehicle_history');
