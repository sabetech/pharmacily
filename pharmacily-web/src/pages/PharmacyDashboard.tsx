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
import { Settings, Database, RefreshCw, AlertCircle, CheckCircle, Clock, Save } from 'lucide-react'
import { useToast } from '@/hooks/useToast'

export function PharmacyDashboard() {
  const { user, session } = useAuth()
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
      toast({ title: 'Saved', description: 'API configuration updated' })
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save configuration', variant: 'destructive' })
    }
  }

  const handleSyncNow = async () => {
    setSyncStatus('syncing')
    setSyncError(null)
    try {
      // In a real app, this would call the Go API sync endpoint
      // For now, simulate
      await new Promise(resolve => setTimeout(resolve, 2000))
      setSyncStatus('success')
      setLastSync(new Date())
      toast({ title: 'Sync completed', description: 'Inventory updated successfully' })
    } catch (error) {
      setSyncStatus('error')
      setSyncError('Sync failed. Check configuration.')
      toast({ title: 'Sync failed', description: 'Check your API configuration', variant: 'destructive' })
    }
  }

  const handleTestWebhook = async () => {
    toast({ title: 'Test webhook sent', description: 'Check your sync status' })
  }

  if (!pharmacyId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No pharmacy assigned</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Your account is not linked to a pharmacy. Contact your administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
              ←
            </Button>
            <div>
              <h1 className="font-bold text-xl">Pharmacy Dashboard</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">Pharmacy ID: {pharmacyId}</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => useAuth().signOut()}>
            Sign Out
          </Button>
        </div>
      </header>

      {/* Status Bar */}
      <div className="bg-primary/5 dark:bg-primary/10 border-b px-4 py-3">
        <div className="container mx-auto flex flex-wrap items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            {syncStatus === 'syncing' && <RefreshCw className="h-4 w-4 animate-spin text-primary" />}
            {syncStatus === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
            {syncStatus === 'error' && <AlertCircle className="h-4 w-4 text-red-600" />}
            {syncStatus === 'idle' && <Clock className="h-4 w-4 text-gray-400" />}
            <span>
              {syncStatus === 'syncing' ? 'Syncing...' :
               syncStatus === 'success' ? `Last sync: ${lastSync?.toLocaleString()}` :
               syncStatus === 'error' ? 'Sync failed' : 'Ready'}
            </span>
          </div>
          {syncError && (
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span>{syncError}</span>
            </div>
          )}
          <div className="flex-1" />
          <Badge variant={config?.is_enabled ? 'success' : 'secondary'}>
            {config?.is_enabled ? 'API Enabled' : 'API Disabled'}
          </Badge>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="inventory" className="space-y-6">
          <TabsList>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="sync">Sync Status</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Inventory Tab */}
          <TabsContent value="inventory">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Inventory Management
                </CardTitle>
                <Button onClick={handleSyncNow} disabled={syncStatus === 'syncing'}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Now
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Drug</TableHead>
                        <TableHead>NDC</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead>Last Updated</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* In a real app, this would fetch from the API */}
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                          Inventory editor coming soon. Connect to Go API to fetch pharmacy inventory.
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sync Status Tab */}
          <TabsContent value="sync">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Sync Status & History
                </CardTitle>
                <Button variant="outline" onClick={handleTestWebhook}>
                  Test Webhook
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Last Sync</p>
                    <p className="text-2xl font-bold">{lastSync ? lastSync.toLocaleString() : 'Never'}</p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
                    <p className="text-2xl font-bold capitalize">{syncStatus}</p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">API Type</p>
                    <p className="text-2xl font-bold">{config?.api_type || 'Not configured'}</p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Schedule</p>
                    <p className="text-2xl font-bold text-xs">{config?.sync_schedule || 'Not set'}</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Recent Sync History</h4>
                  <div className="space-y-2">
                    <p className="text-gray-500 text-center py-8">Sync history will appear here after first sync</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  API Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="api_type">API Type</Label>
                    <select
                      id="api_type"
                      value={formData.api_type}
                      onChange={(e) => setFormData({ ...formData, api_type: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800"
                    >
                      <option value="custom">Custom REST API</option>
                      <option value="ncpdpp">NCPDP SCRIPT</option>
                      <option value="surescripts">Surescripts</option>
                      <option value="csv">CSV/SFTP Import</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endpoint">API Endpoint</Label>
                    <Input
                      id="endpoint"
                      type="url"
                      placeholder="https://api.pharmacy.com/inventory"
                      value={formData.endpoint}
                      onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="credentials_ref">Credentials Reference (Vault Key)</Label>
                    <Input
                      id="credentials_ref"
                      type="text"
                      placeholder="vault:pharmacy-api-key"
                      value={formData.credentials_ref}
                      onChange={(e) => setFormData({ ...formData, credentials_ref: e.target.value })}
                    />
                    <p className="text-sm text-gray-500">Reference to credentials stored in Supabase Vault</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sync_schedule">Sync Schedule (Cron)</Label>
                    <Input
                      id="sync_schedule"
                      type="text"
                      placeholder="0 2 * * *"
                      value={formData.sync_schedule}
                      onChange={(e) => setFormData({ ...formData, sync_schedule: e.target.value })}
                    />
                    <p className="text-sm text-gray-500">Runs daily at 2:00 AM UTC by default</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.is_enabled}
                        onChange={(e) => setFormData({ ...formData, is_enabled: e.target.checked })}
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      Enable automatic sync
                    </Label>
                  </div>
                </div>

                <div className="border-t pt-6 flex justify-end">
                  <Button onClick={handleSave} disabled={isLoading}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Configuration
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}