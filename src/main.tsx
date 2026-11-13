import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { runDataPurgeIfNecessary } from './lib/purgeDummyData';
import { syncService } from './services/syncService';

// Tarik state otoritatif terbaru dari server terlebih dahulu sebelum inisialisasi cache lokal
async function mountApp() {
  try {
    await Promise.race([
      syncService.bootstrap(),
      new Promise<void>((resolve) => setTimeout(resolve, 8000)),
    ]);
  } catch (err) {
    console.warn('[Sync] Initial bootstrap deferred:', err);
  }

  // Jalankan inisialisasi bersih hanya bila perangkat & server memang belum memiliki data tersinkron
  runDataPurgeIfNecessary();

  createRoot(document.getElementById('root')!).render(<App />);
}

void mountApp();
