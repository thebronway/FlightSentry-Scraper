'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiKeysCard } from '@/components/ApiKeysCard';
import { AuthGateScreen } from '@/components/AuthGateScreen';
import { EngineStatusCard } from '@/components/EngineStatusCard';
import { Footer } from '@/components/Footer';
import { GuardrailsSettingsCard } from '@/components/GuardrailsSettingsCard';
import { LiveTestScrapeCard } from '@/components/LiveTestScrapeCard';
import { Navbar } from '@/components/Navbar';
import { ScrapeLogsCard } from '@/components/ScrapeLogsCard';
import type {
  ApiKeyRecord,
  PublicScraperSettings,
  ScrapeLogEntry,
  UsageQuotaStats,
} from '@/types';

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [hasAdminPassword, setHasAdminPassword] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [settings, setSettings] = useState<PublicScraperSettings | null>(null);
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [logs, setLogs] = useState<ScrapeLogEntry[]>([]);
  const [usage, setUsage] = useState<UsageQuotaStats>({
    hourlyUsed: 0,
    hourlyLimit: 20,
    dailyUsed: 0,
    dailyLimit: 150,
  });

  const refreshDashboardData = useCallback(async () => {
    const [settingsRes, keysRes, logsRes] = await Promise.all([
      fetch('/api/admin/settings'),
      fetch('/api/admin/keys'),
      fetch('/api/admin/logs?limit=50'),
    ]);

    if (
      settingsRes.status === 401 ||
      keysRes.status === 401 ||
      logsRes.status === 401
    ) {
      setAuthenticated(false);
      return;
    }

    if (settingsRes.ok) {
      const settingsData = await settingsRes.json();
      setSettings(settingsData.settings);
    }
    if (keysRes.ok) {
      const keysData = await keysRes.json();
      setKeys(keysData.keys);
    }
    if (logsRes.ok) {
      const logsData = await logsRes.json();
      setLogs(logsData.logs);
      if (logsData.usage) {
        setUsage((prev) => ({
          ...prev,
          hourlyUsed: logsData.usage.hourlyUsed,
          dailyUsed: logsData.usage.dailyUsed,
        }));
      }
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function checkAuth() {
      try {
        const res = await fetch('/api/admin/auth');
        const data = await res.json();
        if (!active) return;

        setHasAdminPassword(Boolean(data.hasAdminPassword));
        setAuthenticated(Boolean(data.authenticated));
        if (data.settings) {
          setSettings(data.settings);
        }
        if (data.authenticated) {
          await refreshDashboardData();
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    checkAuth();
    return () => {
      active = false;
    };
  }, [refreshDashboardData]);

  useEffect(() => {
    if (!authenticated) return;
    const timer = setInterval(() => {
      refreshDashboardData();
    }, 15000);
    return () => clearInterval(timer);
  }, [authenticated, refreshDashboardData]);

  async function handleSignOut() {
    await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    setAuthenticated(false);
  }

  async function handleAuthenticated(nextSettings: PublicScraperSettings) {
    setHasAdminPassword(true);
    setAuthenticated(true);
    setSettings(nextSettings);
    await refreshDashboardData();
  }

  return (
    <div className="min-h-screen flex flex-col bg-gunmetal-canvas text-slate-100">
      <Navbar
        authenticated={authenticated}
        circuitBreakerActive={Boolean(settings?.circuitBreakerActive)}
        onSignOut={handleSignOut}
      />

      {loading ? (
        <main className="flex-1 flex items-center justify-center text-sm text-gunmetal-muted">
          Initializing FlightSentry Scraper Console...
        </main>
      ) : !authenticated || !settings ? (
        <AuthGateScreen
          hasAdminPassword={hasAdminPassword}
          onAuthenticated={handleAuthenticated}
        />
      ) : (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <EngineStatusCard
            settings={settings}
            usage={{
              ...usage,
              hourlyLimit: settings.maxRequestsPerHour,
              dailyLimit: settings.maxRequestsPerDay,
            }}
            onSettingsUpdated={setSettings}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ApiKeysCard keys={keys} onRefresh={refreshDashboardData} />
            <GuardrailsSettingsCard
              settings={settings}
              onSettingsUpdated={setSettings}
            />
          </div>

          <LiveTestScrapeCard onScrapeCompleted={refreshDashboardData} />

          <ScrapeLogsCard logs={logs} onRefresh={refreshDashboardData} />
        </main>
      )}

      <Footer />
    </div>
  );
}