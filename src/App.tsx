import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { Badge } from '@cloudflare/kumo/components/badge';
import { Banner } from '@cloudflare/kumo/components/banner';
import { Button } from '@cloudflare/kumo/components/button';
import { CloudflareLogo } from '@cloudflare/kumo/components/cloudflare-logo';

import { Input } from '@cloudflare/kumo/components/input';

import { Meter } from '@cloudflare/kumo/components/meter';

import { Table } from '@cloudflare/kumo/components/table';
import {
  SunIcon,
  MoonIcon,
  LightningIcon,

  GlobeIcon,
  DatabaseIcon,
  PlusIcon,
  CopyIcon,
  TrashIcon,

  ChartLineUpIcon,

  CheckCircleIcon,
  CubeIcon,
  InfoIcon,
  HardDrivesIcon,
} from '@phosphor-icons/react';

import { PageHeader } from './components/kumo/page-header/page-header';

const DeleteResource = lazy(() =>
  import('./components/kumo/delete-resource/delete-resource').then((module) => ({
    default: module.DeleteResource,
  })),
);
const AnalyticsTab = lazy(() =>
  import('./components/dashboard-tabs').then((module) => ({ default: module.AnalyticsTab })),
);
const SecurityTab = lazy(() =>
  import('./components/dashboard-tabs').then((module) => ({ default: module.SecurityTab })),
);
const SettingsTab = lazy(() =>
  import('./components/dashboard-tabs').then((module) => ({ default: module.SettingsTab })),
);

interface WorkerResource {
  id: string;
  name: string;
  route: string;
  status: 'active' | 'deploying' | 'error';
  requests: string;
  lastDeployed: string;
}

const sanitizeWorkerName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

function TabLoadingStatus() {
  return (
    <div className="rounded-xl border border-kumo-line bg-kumo-base p-6 text-sm text-kumo-subtle" role="status">
      Loading dashboard section…
    </div>
  );
}

export function App() {
  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) {
        const nextTheme = e.matches ? 'dark' : 'light';
        setTheme(nextTheme);
        document.documentElement.setAttribute('data-mode', nextTheme);
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.setAttribute('data-mode', nextTheme);
  };

  // Active tab state
  const [activeTab, setActiveTab] = useState('workers');

  // Sample Workers resources state
  const [workers, setWorkers] = useState<WorkerResource[]>([
    {
      id: 'w-1',
      name: 'api-gateway',
      route: 'api.example.com/*',
      status: 'active',
      requests: '1.2M / day',
      lastDeployed: '10 mins ago',
    },
    {
      id: 'w-2',
      name: 'auth-service',
      route: 'auth.example.com/*',
      status: 'active',
      requests: '450K / day',
      lastDeployed: '1 hour ago',
    },
    {
      id: 'w-3',
      name: 'ai-agent-worker',
      route: 'ai.example.com/v1/*',
      status: 'active',
      requests: '89K / day',
      lastDeployed: '2 hours ago',
    },
    {
      id: 'w-4',
      name: 'image-optimizer',
      route: 'assets.example.com/images/*',
      status: 'deploying',
      requests: '3.4M / day',
      lastDeployed: 'Just now',
    },
  ]);

  // New worker form state
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerRoute, setNewWorkerRoute] = useState('');
  const [workerNameError, setWorkerNameError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const workerNameInputRef = useRef<HTMLInputElement>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<WorkerResource | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);


  const getWorkerNameError = (name: string) => {
    const sanitizedName = sanitizeWorkerName(name);

    if (!name.trim()) return 'Enter a worker name.';
    if (!sanitizedName) return 'Worker names must include at least one letter or number.';
    if (sanitizedName.length > 63) return 'Worker names must be 63 characters or fewer.';
    if (workers.some((worker) => worker.name === sanitizedName)) {
      return `A worker named ${sanitizedName} already exists.`;
    }

    return '';
  };

  const handleAddWorker = (e: FormEvent) => {
    e.preventDefault();
    const nameError = getWorkerNameError(newWorkerName);
    if (nameError) {
      setWorkerNameError(nameError);
      setAnnouncement(`Worker was not added. ${nameError}`);
      workerNameInputRef.current?.focus();
      return;
    }

    const sanitizedName = sanitizeWorkerName(newWorkerName);
    const newWorker: WorkerResource = {
      id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: sanitizedName,
      route: newWorkerRoute.trim() || `${sanitizedName}.example.com/*`,
      status: 'active',
      requests: '0 / day',
      lastDeployed: 'Just now',
    };

    setWorkers((prev) => [newWorker, ...prev]);
    setNewWorkerName('');
    setNewWorkerRoute('');
    setWorkerNameError('');
    setAnnouncement(`Worker ${sanitizedName} was added successfully.`);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setIsDeleting(true);
    try {
      await new Promise((res) => setTimeout(res, 800));
      setWorkers((prev) => prev.filter((worker) => worker.id !== target.id));
      setAnnouncement(`Worker ${target.name} was deleted successfully.`);
      setDeleteTarget(null);
    } catch (error) {
      console.error('Failed to delete worker:', error);
      setAnnouncement(`Worker ${target.name} could not be deleted. Please try again.`);
      throw error;
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyWorkerUrl = async (worker: WorkerResource) => {
    const workerUrl = `https://${worker.route.replace(/\/\*$/, '')}`;
    try {
      await navigator.clipboard.writeText(workerUrl);
      setAnnouncement(`${worker.name} URL copied to clipboard.`);
    } catch (error) {
      console.error('Failed to copy worker URL:', error);
      setAnnouncement(`${worker.name} URL could not be copied. Please copy it manually: ${workerUrl}`);
    }
  };

  const handleQuickDeploy = () => {
    setActiveTab('workers');
    window.requestAnimationFrame(() => workerNameInputRef.current?.focus());
  };

  return (
    <div className="min-h-screen bg-kumo-canvas text-kumo-default flex flex-col font-sans transition-colors duration-200">
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {/* Global Top Navbar */}
      <header className="border-b border-kumo-line bg-kumo-base px-6 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center p-1.5 rounded-md bg-kumo-tint">
            <CloudflareLogo className="h-6 w-auto" />
          </div>
          <span className="font-semibold text-lg text-kumo-strong tracking-tight">
            Vite + Kumo UI
          </span>
          <Badge variant="neutral" className="ml-2">
            v1.0.0
          </Badge>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-kumo-subtle bg-kumo-recessed px-3 py-1.5 rounded-lg border border-kumo-hairline">
            <CheckCircleIcon size={16} className="text-kumo-success" />
            <span>Edge Global Network: <strong className="text-kumo-default">320 PoPs Active</strong></span>
          </div>

          <Button
            variant="ghost"
            shape="square"
            onClick={toggleTheme}
            aria-label="Toggle Theme"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <MoonIcon size={20} /> : <SunIcon size={20} className="text-kumo-warning" />}
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6">
        {/* Page Header Component Block */}
        <div className="bg-kumo-base rounded-xl border border-kumo-line p-6 shadow-sm">
          <PageHeader
            breadcrumbs={
              <nav aria-label="Breadcrumb" className="text-sm py-2 text-kumo-subtle">
                <ol className="flex items-center gap-2">
                  <li>Cloudflare</li>
                  <li aria-hidden="true">/</li>
                  <li>Deployments</li>
                  <li aria-hidden="true">/</li>
                  <li aria-current="page" className="text-kumo-default font-medium">vite-plus-kumo-ui</li>
                </ol>
              </nav>
            }
            title="Cloudflare Edge Infrastructure"
            description="Manage stateful Workers, KV storage, edge security, and performance metrics styled with Cloudflare's Kumo UI design system."
            tabs={[
              { value: 'workers', label: 'Workers & Pages' },
              { value: 'analytics', label: 'Analytics & Traffic' },
              { value: 'security', label: 'Security & WAF' },
              { value: 'settings', label: 'Environment Settings' },
            ]}
            defaultTab={activeTab}
            onValueChange={setActiveTab}
          >
            <Button variant="primary" onClick={handleQuickDeploy}>
              <PlusIcon size={16} className="mr-1.5" /> Quick Deploy
            </Button>
          </PageHeader>
        </div>

        {/* Banner Announcement */}
        <Banner icon={<InfoIcon size={20} />} variant="default">
          Kumo UI color tokens adapt automatically via CSS <code>light-dark()</code> functions! Toggle light/dark mode in the top right header to preview theme adaptation.
        </Banner>

        {/* Tab 1: Workers & Pages */}
        {activeTab === 'workers' && (
          <div className="flex flex-col gap-6">
            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-kumo-base p-5 rounded-xl border border-kumo-line flex flex-col gap-2">
                <div className="flex items-center justify-between text-kumo-subtle text-sm">
                  <span>Active Workers</span>
                  <LightningIcon size={18} className="text-kumo-brand" />
                </div>
                <div className="text-3xl font-bold text-kumo-strong">
                  {workers.filter((worker) => worker.status === 'active').length}
                </div>
                <div className="text-xs text-kumo-success flex items-center gap-1">
                  <ChartLineUpIcon size={14} /> +2 added this week
                </div>
              </div>

              <div className="bg-kumo-base p-5 rounded-xl border border-kumo-line flex flex-col gap-2">
                <div className="flex items-center justify-between text-kumo-subtle text-sm">
                  <span>Monthly Requests</span>
                  <GlobeIcon size={18} className="text-kumo-info" />
                </div>
                <div className="text-3xl font-bold text-kumo-strong">5.1M</div>
                <div className="text-xs text-kumo-subtle">99.998% Uptime</div>
              </div>

              <div className="bg-kumo-base p-5 rounded-xl border border-kumo-line flex flex-col gap-2">
                <div className="flex items-center justify-between text-kumo-subtle text-sm">
                  <span>CPU Subrequests</span>
                  <HardDrivesIcon size={18} className="text-kumo-warning" />
                </div>
                <div className="text-3xl font-bold text-kumo-strong">12ms</div>
                <Meter value={35} max={100} label="CPU Load" aria-label="CPU Usage" className="mt-1" />
              </div>

              <div className="bg-kumo-base p-5 rounded-xl border border-kumo-line flex flex-col gap-2">
                <div className="flex items-center justify-between text-kumo-subtle text-sm">
                  <span>D1 / KV Operations</span>
                  <DatabaseIcon size={18} className="text-kumo-success" />
                </div>
                <div className="text-3xl font-bold text-kumo-strong">142K</div>
                <div className="text-xs text-kumo-subtle">Global Replication Active</div>
              </div>
            </div>

            {/* Create Worker Card */}
            <div className="bg-kumo-base p-6 rounded-xl border border-kumo-line shadow-xs flex flex-col gap-4">
              <h2 className="text-lg font-semibold text-kumo-strong flex items-center gap-2">
                <CubeIcon size={20} className="text-kumo-brand" />
                Deploy New Edge Worker
              </h2>
              <form onSubmit={handleAddWorker} className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                  <Input
                    ref={workerNameInputRef}
                    label="Worker Name"
                    placeholder="e.g. edge-cache-purger"
                    value={newWorkerName}
                    onChange={(e) => {
                      setNewWorkerName(e.target.value);
                      if (workerNameError) setWorkerNameError(getWorkerNameError(e.target.value));
                    }}
                    onBlur={() => setWorkerNameError(getWorkerNameError(newWorkerName))}
                    aria-invalid={workerNameError ? true : undefined}
                    aria-describedby={workerNameError ? 'worker-name-help worker-name-error' : 'worker-name-help'}
                    autoComplete="off"
                  />
                  <p id="worker-name-help" className="mt-1.5 text-xs text-kumo-subtle">
                    Letters, numbers, and hyphens only. Other characters become hyphens.
                  </p>
                  {workerNameError && (
                    <p id="worker-name-error" className="mt-1 text-sm text-kumo-danger" role="alert">
                      {workerNameError}
                    </p>
                  )}
                </div>
                <div className="flex-1 w-full">
                  <Input
                    label="Route Pattern"
                    placeholder="e.g. cache.example.com/*"
                    value={newWorkerRoute}
                    onChange={(e) => setNewWorkerRoute(e.target.value)}
                  />
                </div>
                <Button type="submit" variant="primary" className="whitespace-nowrap">
                  <PlusIcon size={16} className="mr-1" /> Add Worker
                </Button>
              </form>
            </div>

            {/* Workers Table */}
            <div className="bg-kumo-base rounded-xl border border-kumo-line overflow-hidden shadow-xs">
              <div className="p-4 border-b border-kumo-line flex items-center justify-between bg-kumo-tint">
                <h3 className="font-semibold text-kumo-strong">Deployed Edge Services ({workers.length})</h3>
                <Badge variant="neutral">{workers.filter((w) => w.status === 'active').length} Running</Badge>
              </div>

              <div className="overflow-x-auto" role="region" aria-label="Deployed edge services table" tabIndex={0}>
              <Table className="min-w-4xl">
                <Table.Header>
                  <Table.Row className="border-b border-kumo-line text-left text-xs uppercase tracking-wider text-kumo-subtle bg-kumo-recessed">
                    <Table.Head className="p-4">Worker Name</Table.Head>
                    <Table.Head className="p-4">Route</Table.Head>
                    <Table.Head className="p-4">Status</Table.Head>
                    <Table.Head className="p-4">Requests</Table.Head>
                    <Table.Head className="p-4">Last Deployed</Table.Head>
                    <Table.Head className="p-4 text-right">Actions</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {workers.map((worker) => (
                    <Table.Row key={worker.id} className="border-b border-kumo-hairline hover:bg-kumo-tint transition-colors">
                      <Table.Cell className="p-4 font-medium text-kumo-strong flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          worker.status === 'active'
                            ? 'bg-kumo-success'
                            : worker.status === 'deploying'
                            ? 'bg-kumo-warning'
                            : 'bg-kumo-danger'
                        }`}></span>
                        {worker.name}
                      </Table.Cell>
                      <Table.Cell className="p-4 font-mono text-sm text-kumo-subtle">{worker.route}</Table.Cell>
                      <Table.Cell className="p-4">
                        {worker.status === 'active' ? (
                          <Badge variant="success">Active</Badge>
                        ) : worker.status === 'deploying' ? (
                          <Badge variant="warning">Deploying</Badge>
                        ) : (
                          <Badge variant="error">Error</Badge>
                        )}
                      </Table.Cell>
                      <Table.Cell className="p-4 text-sm text-kumo-default">{worker.requests}</Table.Cell>
                      <Table.Cell className="p-4 text-sm text-kumo-subtle">{worker.lastDeployed}</Table.Cell>
                      <Table.Cell className="p-4 text-right flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          shape="square"
                          size="sm"
                          onClick={() => handleCopyWorkerUrl(worker)}
                          aria-label={`Copy ${worker.name} URL to clipboard`}
                          title="Copy worker URL"
                        >
                          <CopyIcon size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          shape="square"
                          size="sm"
                          onClick={() => setDeleteTarget(worker)}
                          className="text-kumo-danger hover:bg-kumo-danger-tint"
                          aria-label={`Delete ${worker.name}`}
                        >
                          <TrashIcon size={16} />
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <Suspense fallback={<TabLoadingStatus />}>
            <AnalyticsTab />
          </Suspense>
        )}

        {activeTab === 'security' && (
          <Suspense fallback={<TabLoadingStatus />}>
            <SecurityTab />
          </Suspense>
        )}

        {activeTab === 'settings' && (
          <Suspense fallback={<TabLoadingStatus />}>
            <SettingsTab />
          </Suspense>
        )}
      </main>

      {/* Delete Resource Scaffolded Dialog Block */}
      {deleteTarget && (
        <Suspense fallback={<div className="sr-only" role="status">Loading delete confirmation.</div>}>
          <DeleteResource
            open={!!deleteTarget}
            onOpenChange={(open) => {
              if (!open && !isDeleting) setDeleteTarget(null);
            }}
            resourceType="Worker"
            resourceName={deleteTarget.name}
            onDelete={handleDeleteConfirm}
            isDeleting={isDeleting}
          />
        </Suspense>
      )}

      {/* Footer */}
      <footer className="border-t border-kumo-line bg-kumo-base py-6 text-center text-xs text-kumo-subtle mt-auto">
        <p>Built with Vite + React + Kumo UI (@cloudflare/kumo) + Tailwind CSS v4</p>
      </footer>
    </div>
  );
}

export default App;
