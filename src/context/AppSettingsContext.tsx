import React, { createContext, useContext, useState, useEffect } from 'react';
import { SystemSettings } from '../types/database.types';
import { academicService } from '../services/academicService';
import { DEMO_SYSTEM_SETTINGS } from '../lib/demoData';
import { useRealtimeSync } from '../hooks/useRealtimeSync';

interface AppSettingsContextType {
  settings: SystemSettings | null;
  logoUrl: string;
  faviconUrl: string;
  updateSettings: (newSettings: Partial<SystemSettings>) => Promise<SystemSettings>;
  setLogoAndFavicon: (logoUrl: string, faviconUrl?: string) => Promise<void>;
  refreshSettings: () => Promise<void>;
  resetToDefaultBrand: () => Promise<void>;
}

const DEFAULT_LOGO = '/logo-mi-alihsan.svg';
const DEFAULT_FAVICON = '/favicon.svg';

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

export const AppSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  const applyFaviconToDocument = (url: string) => {
    try {
      let link = document.querySelector<HTMLLinkElement>("link[id='app-favicon']");
      if (!link) {
        link = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
      }
      if (!link) {
        link = document.createElement('link');
        link.id = 'app-favicon';
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = url || DEFAULT_FAVICON;

      // Also update apple-touch-icon
      let appleLink = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
      if (appleLink) {
        appleLink.href = url || DEFAULT_FAVICON;
      }
    } catch (e) {
      console.warn('Error updating dynamic favicon:', e);
    }
  };

  const loadSettings = async () => {
    try {
      const data = await academicService.getSettings();
      setSettings(data);
      const fav = data.favicon_url || DEFAULT_FAVICON;
      applyFaviconToDocument(fav);
    } catch (e) {
      console.warn('Fallback loading system settings:', e);
      setSettings(DEMO_SYSTEM_SETTINGS);
      applyFaviconToDocument(DEFAULT_FAVICON);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  useRealtimeSync(['simpel_settings'], () => {
    void loadSettings();
  });

  const updateSettings = async (partial: Partial<SystemSettings>): Promise<SystemSettings> => {
    const current = settings || DEMO_SYSTEM_SETTINGS;
    const merged: SystemSettings = {
      ...current,
      ...partial,
      updated_at: new Date().toISOString(),
    };

    const saved = await academicService.updateSettings(merged);
    setSettings(saved);

    if (saved.favicon_url) {
      applyFaviconToDocument(saved.favicon_url);
    }

    return saved;
  };

  const setLogoAndFavicon = async (newLogoUrl: string, newFaviconUrl?: string) => {
    const targetFavicon = newFaviconUrl || newLogoUrl || DEFAULT_FAVICON;
    await updateSettings({
      logo_url: newLogoUrl,
      favicon_url: targetFavicon,
    });
  };

  const resetToDefaultBrand = async () => {
    await setLogoAndFavicon(DEFAULT_LOGO, DEFAULT_FAVICON);
  };

  const logoUrl = settings?.logo_url || DEFAULT_LOGO;
  const faviconUrl = settings?.favicon_url || DEFAULT_FAVICON;

  return (
    <AppSettingsContext.Provider
      value={{
        settings,
        logoUrl,
        faviconUrl,
        updateSettings,
        setLogoAndFavicon,
        refreshSettings: loadSettings,
        resetToDefaultBrand,
      }}
    >
      {children}
    </AppSettingsContext.Provider>
  );
};

export const useAppSettings = (): AppSettingsContextType => {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error('useAppSettings must be used within an AppSettingsProvider');
  }
  return context;
};
