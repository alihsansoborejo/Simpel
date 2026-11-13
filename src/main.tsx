import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { runDataPurgeIfNecessary } from './lib/purgeDummyData';
import { syncService } from './services/syncService';

// Bersihkan sisa cache dummy lokal bila browser baru pertama kali dibuka, sisakan 1 Administrator
runDataPurgeIfNecessary();

// Tarik state otoritatif terbaru dari server sebelum merender UI agar perangkat baru langsung sinkron
async function mountApp() {
  try {
    await Promise.race([
      syncService.bootstrap(),
      new Promise<void>((resolve) => setTimeout(resolve, 3000)),
    ]);
  } catch (err) {
    console.warn('[Sync] Initial bootstrap deferred:', err);
  }

  createRoot(document.getElementById('root')!).render(<App />);
}

void mountApp();
