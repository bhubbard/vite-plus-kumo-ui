import { useState } from 'react';

import { Collapsible } from '@cloudflare/kumo/components/collapsible';
import { Link } from '@cloudflare/kumo/components/link';
import { Meter } from '@cloudflare/kumo/components/meter';
import { SensitiveInput } from '@cloudflare/kumo/components/sensitive-input';
import { Switch } from '@cloudflare/kumo/components/switch';
import {
  ArrowSquareOutIcon,
  ChartLineUpIcon,
  GearIcon,
  GlobeIcon,
  ShieldCheckIcon,
} from '@phosphor-icons/react';

export function AnalyticsTab() {
  return (
    <div className="bg-kumo-base p-6 rounded-xl border border-kumo-line flex flex-col gap-6 shadow-xs">
      <h2 className="text-xl font-bold text-kumo-strong flex items-center gap-2">
        <ChartLineUpIcon size={24} className="text-kumo-brand" />
        Real-time Global Analytics
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-kumo-recessed p-4 rounded-lg border border-kumo-hairline flex flex-col gap-1">
          <span className="text-xs text-kumo-subtle uppercase tracking-wider font-semibold">Edge Throughput</span>
          <span className="text-2xl font-bold text-kumo-strong">1.42 GB/s</span>
          <span className="text-xs text-kumo-success">Peak capacity: 100 GB/s</span>
        </div>
        <div className="bg-kumo-recessed p-4 rounded-lg border border-kumo-hairline flex flex-col gap-1">
          <span className="text-xs text-kumo-subtle uppercase tracking-wider font-semibold">Cache Hit Ratio</span>
          <span className="text-2xl font-bold text-kumo-strong">94.8%</span>
          <Meter value={94.8} max={100} label="Cache Hit Ratio" className="mt-1" />
        </div>
        <div className="bg-kumo-recessed p-4 rounded-lg border border-kumo-hairline flex flex-col gap-1">
          <span className="text-xs text-kumo-subtle uppercase tracking-wider font-semibold">Global Latency P95</span>
          <span className="text-2xl font-bold text-kumo-strong">8.4 ms</span>
          <span className="text-xs text-kumo-info">Sub-10ms target achieved</span>
        </div>
      </div>

      <div className="p-8 bg-kumo-elevated rounded-xl border border-kumo-line flex flex-col items-center justify-center gap-3 text-center">
        <GlobeIcon size={48} className="text-kumo-brand opacity-80" />
        <h3 className="text-lg font-semibold text-kumo-strong">Interactive Traffic Map & Analytics</h3>
        <p className="text-sm text-kumo-subtle max-w-md">
          Kumo UI offers visualization components like <code>TimeseriesChart</code>, <code>BubbleMap</code>, and <code>SankeyChart</code> powered by Apache ECharts.
        </p>
        <Link
          href="https://dash.cloudflare.com/?to=/:account/analytics"
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center font-medium text-kumo-brand hover:underline"
        >
          <ArrowSquareOutIcon size={16} className="mr-1.5" /> View Cloudflare Analytics Dashboard
          <span className="sr-only"> (opens in a new tab)</span>
        </Link>
      </div>
    </div>
  );
}

export function SecurityTab() {
  return (
    <div className="flex flex-col gap-6">
      <div className="bg-kumo-base p-6 rounded-xl border border-kumo-line shadow-xs flex flex-col gap-4">
        <h2 className="text-xl font-bold text-kumo-strong flex items-center gap-2">
          <ShieldCheckIcon size={24} className="text-kumo-success" />
          Security Rules & API Secrets
        </h2>
        <p className="text-sm text-kumo-subtle">
          Configure sensitive credentials and WAF rules for your Vite edge deployment.
        </p>

        <div className="flex flex-col gap-4 max-w-xl mt-2">
          <SensitiveInput label="Production API Key (SensitiveInput Component)" defaultValue="<your-production-api-key>" />
          <SensitiveInput label="Database Connection String" defaultValue="postgres://username:password@d1.cloudflare.com/prod" />
        </div>
      </div>

      <Collapsible.Root className="bg-kumo-base rounded-xl border border-kumo-line p-4">
        <Collapsible.DefaultTrigger>Advanced Security Policy Settings</Collapsible.DefaultTrigger>
        <Collapsible.DefaultPanel>
          <div className="flex flex-col gap-3 py-2 text-sm text-kumo-subtle">
            <p>• Bot Management: Automated challenge enabled for suspicious user-agents.</p>
            <p>• DDoS Mitigation: Unlimited L3/L4/L7 protection active.</p>
            <p>• Rate Limiting: 1,000 requests per minute per IP address.</p>
          </div>
        </Collapsible.DefaultPanel>
      </Collapsible.Root>
    </div>
  );
}

export function SettingsTab() {
  const [autoScale, setAutoScale] = useState(true);
  const [smartRouting, setSmartRouting] = useState(true);
  const [rateLimiting, setRateLimiting] = useState(false);

  return (
    <div className="bg-kumo-base p-6 rounded-xl border border-kumo-line shadow-xs flex flex-col gap-6">
      <h2 className="text-xl font-bold text-kumo-strong flex items-center gap-2">
        <GearIcon size={24} className="text-kumo-brand" />
        Environment & Runtime Configuration
      </h2>

      <div className="flex flex-col gap-4 divide-y divide-kumo-hairline">
        <SettingSwitch
          title="Automatic Edge Scaling"
          description="Dynamically scale worker isolates across global regions."
          checked={autoScale}
          onCheckedChange={setAutoScale}
          label="Toggle Auto Scaling"
        />
        <SettingSwitch
          title="Smart Traffic Routing"
          description="Route requests through the lowest latency network routes."
          checked={smartRouting}
          onCheckedChange={setSmartRouting}
          label="Toggle Smart Routing"
        />
        <SettingSwitch
          title="Strict Rate Limiting"
          description="Block IP addresses exceeding 100 req/sec threshold."
          checked={rateLimiting}
          onCheckedChange={setRateLimiting}
          label="Toggle Rate Limiting"
        />
      </div>
    </div>
  );
}

interface SettingSwitchProps {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}

function SettingSwitch({ title, description, checked, onCheckedChange, label }: SettingSwitchProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex flex-col">
        <span className="font-semibold text-kumo-strong">{title}</span>
        <span className="text-sm text-kumo-subtle">{description}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  );
}
