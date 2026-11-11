import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { runDataPurgeIfNecessary } from './lib/purgeDummyData';

// Bersihkan seluruh data dummy jika masih tersimpan di local storage, sisakan 1 Administrator
runDataPurgeIfNecessary();

createRoot(document.getElementById('root')!).render(<App />);

