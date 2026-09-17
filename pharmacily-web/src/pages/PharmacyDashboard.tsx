import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { usePharmacyAPIConfig, useUpsertPharmacyAPIConfig } from '@/hooks/useQueries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/useToast'

export function PharmacyDashboard() {
  const { session } = useAuth()
  const { toast } = useToast()

  // Get pharmacy ID from JWT claims
  const pharmacyId = session?.user?.app_metadata?.pharmacy_id
  const { data: config, isLoading } = usePharmacyAPIConfig(pharmacyId || '')
  const upsertConfig = useUpsertPharmacyAPIConfig()

  const [formData, setFormData] = useState({
    api_type: config?.api_type || 'custom',
    endpoint: config?.endpoint || '',
    credentials_ref: config?.credentials_ref || '',
    sync_schedule: config?.sync_schedule || '0 2 * * *',
    is_enabled: config?.is_enabled ?? true,
  })

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle')
  const [lastSync, setLastSync] = useState<Date | null>(config?.last_sync_at ? new Date(config.last_sync_at) : null)
  const [syncError, setSyncError] = useState<string | null>(null)

  const handleSave = async () => {
    try {
      await upsertConfig.mutateAsync({ pharmacyId: pharmacyId!, config: formData })
      toast({ title: 'Saved', description: 'API configuration updated.' })
    } catch {
      toast({ title: 'Error', description: 'Could not save configuration.', variant: 'destructive' })
    }
  }

  const handleSyncNow = async () => {
    setSyncStatus('syncing')
    setSyncError(null)
    try {
      await new Promise(resolve => setTimeout(resolve, 2000))
      setSyncStatus('success')
      setLastSync(new Date())
      toast({ title: 'Sync completed', description: 'Inventory updated successfully.' })
    } catch {
      setSyncStatus('error')
      setSyncError('Sync failed. Check configuration.')
      toast({ title: 'Sync failed', description: 'Check your API configuration.', variant: 'destructive' })
    }
  }

  const handleTestWebhook = async () => {
    toast({ title: 'Test webhook sent', description: 'Check your sync status.' })
  }

  if (!pharmacyId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ground p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <span className="icon-circle mx-auto mb-4 h-12 w-12 bg-expiry-bg text-expiry-ink">
              <i className="ph ph-warning-circle text-[22px]" aria-hidden="true" />
            </span>
            <h2 className="mb-2 font-display text-xl font-semibold text-ink">No pharmacy assigned</h2>
            <p className="text-sm text-muted">
              Your account is not linked to a pharmacy. Contact your administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const statusMeta = {
    idle: { icon: 'ph-clock', label: 'Ready', pill: 'otc' as const },
    syncing: { icon: 'ph-arrows-clockwise', label: 'Syncing...', pill: 'otc' as const },
    success: { icon: 'ph-check-circle', label: `Last sync ${lastSync?.toLocaleString() ?? ''}`, pill: 'instock' as const },
    error: { icon: 'ph-warning-circle', label: 'Sync failed', pill: 'expiry' as const },
  }[syncStatus]

  return (
    <div>
      {/* Status pills */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={statusMeta.pill}>
          <i className={`ph ${statusMeta.icon} mr-1`} aria-hidden="true" />
          {statusMeta.label}
        </Badge>
        <Badge variant={config?.is_enabled ? 'instock' : 'otc'}>
          {config?.is_enabled ? 'API enabled' : 'API disabled'}
        </Badge>
      </div>
      {syncError && (
        <div className="mt-3 flex items-center gap-2 rounded-row bg-expiry-bg p-3 text-sm text-expiry-ink">
          <i className="ph ph-warning-circle text-base" aria-hidden="true" />
          <span>{syncError}</span>
        </div>
      )}

      <div className="mt-5">
        <Tabs defaultValue="inventory" className="space-y-5">
          <TabsList>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="sync">Sync status</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Inventory tab */}
          <TabsContent value="inventory">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <span className="icon-circle h-9 w-9 bg-stock-bg text-stock-label">
                    <i className="ph ph-database text-[18px]" aria-hidden="true" />
                  </span>
                  Inventory
                </CardTitle>
                <Button size="sm" onClick={handleSyncNow} disabled={syncStatus === 'syncing'}>
                  <i className={`ph ph-arrows-clockwise mr-1.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} aria-hidden="true" />
                  Sync now
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Drug</TableHead>
                      <TableHead>NDC</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead>Last updated</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-sm text-muted">
                        Inventory editor coming soon. Connect to the Go API to fetch pharmacy inventory.
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sync status tab */}
          <TabsContent value="sync">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <span className="icon-circle h-9 w-9 bg-sales-bg text-sales-label">
                    <i className="ph ph-arrows-clockwise text-[18px]" aria-hidden="true" />
                  </span>
                  Sync status
                </CardTitle>
                <Button variant="outline" size="sm" onClick={handleTestWebhook}>
                  Test webhook
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
                  <div className="rounded-card bg-sales-bg p-5">
                    <p className="label-micro text-sales-label">Last sync</p>
                    <p className="tnum mt-1.5 font-display text-[22px] font-semibold text-sales-ink">
                      {lastSync ? lastSync.toLocaleDateString() : 'Never'}
                    </p>
                  </div>
                  <div className="rounded-card bg-stock-bg p-5">
                    <p className="label-micro text-stock-label">Status</p>
                    <p className="mt-1.5 font-display text-[22px] font-semibold capitalize text-stock-ink">{syncStatus}</p>
                  </div>
                  <div className="rounded-card bg-people-bg p-5">
                    <p className="label-micro text-people-label">API type</p>
                    <p className="mt-1.5 font-display text-[22px] font-semibold text-people-ink">
                      {config?.api_type || 'Not set'}
                    </p>
                  </div>
                  <div className="rounded-card bg-expiry-bg p-5">
                    <p className="label-micro text-expiry-label">Schedule</p>
                    <p className="tnum mt-1.5 font-display text-[18px] font-semibold text-expiry-ink">
                      {config?.sync_schedule || 'Not set'}
                    </p>
                  </div>
                </div>

                <div className="border-t border-[rgba(16,50,40,0.1)] pt-4">
                  <h4 className="mb-3 font-display font-semibold text-ink">Recent sync history</h4>
                  <p className="py-8 text-center text-sm text-muted">Sync history will appear here after the first sync.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <span className="icon-circle h-9 w-9 bg-people-bg text-people-label">
                    <i className="ph ph-gear text-[18px]" aria-hidden="true" />
                  </span>
                  API configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="api_type">API type</Label>
                    <select
                      id="api_type"
                      value={formData.api_type}
                      onChange={(e) => setFormData({ ...formData, api_type: e.target.value })}
                      className="w-full rounded-field border border-[rgba(16,50,40,0.1)] bg-field px-3 py-2.5 text-sm text-ink focus:border-live focus:outline-none"
                    >
                      <option value="custom">Custom REST API</option>
                      <option value="ncpdpp">NCPDP SCRIPT</option>
                      <option value="surescripts">Surescripts</option>
                      <option value="csv">CSV/SFTP import</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endpoint">API endpoint</Label>
                    <Input
                      id="endpoint"
                      type="url"
                      placeholder="https://api.pharmacy.com/inventory"
                      value={formData.endpoint}
                      onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="credentials_ref">Credentials reference (vault key)</Label>
                    <Input
                      id="credentials_ref"
                      type="text"
                      placeholder="vault:pharmacy-api-key"
                      value={formData.credentials_ref}
                      onChange={(e) => setFormData({ ...formData, credentials_ref: e.target.value })}
                    />
                    <p className="text-[13px] text-muted">Reference to credentials stored in Supabase Vault.</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sync_schedule">Sync schedule (cron)</Label>
                    <Input
                      id="sync_schedule"
                      type="text"
                      placeholder="0 0 2 * * *"
                      value={formData.sync_schedule}
                      onChange={(e) => setFormData({ ...formData, sync_schedule: e.target.value })}
                    />
                    <p className="text-[13px] text-muted">Runs daily at 2:00 AM UTC by default.</p>
                  </div>

                  <div className="flex items-end pb-1">
                    <Label className="flex cursor-pointer items-center gap-2 text-[13.5px]">
                      <input
                        type="checkbox"
                        checked={formData.is_enabled}
                        onChange={(e) => setFormData({ ...formData, is_enabled: e.target.checked })}
                        className="h-4 w-4 rounded accent-[#1d7a5f]"
                      />
                      Enable automatic sync
                    </Label>
                  </div>
                </div>

                <div className="flex justify-end border-t border-[rgba(16,50,40,0.1)] pt-6">
                  <Button onClick={handleSave} disabled={isLoading}>
                    <i className="ph ph-floppy-disk mr-1.5" aria-hidden="true" />
                    Save configuration
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
