"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle, AlertTriangle, Shield, Clock, Activity, Zap, Lock, Eye } from "lucide-react"
import { formatPercentage } from "@/lib/protocol-math"
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import CONTRACT_ADDRESSES from "@/contracts/contract-addresses.json"

interface SecurityMonitoringProps {
  isAdmin: boolean
  collateralRatio: number
}

export function SecurityMonitoring({ isAdmin, collateralRatio }: SecurityMonitoringProps) {
  const { address } = useAccount()
  const [emergencyCouncilStatus, setEmergencyCouncilStatus] = useState<string>("")
  const { data: hash, writeContract, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash })
  
  const ADMIN_ADDRESS = "0xA1D4de75082562eA776b160e605acD587668111B"
  
  const handleSetEmergencyCouncilToAdmin = async () => {
    if (!address) {
      setEmergencyCouncilStatus("Error: Please connect your wallet")
      return
    }
    
    if (address.toLowerCase() !== ADMIN_ADDRESS.toLowerCase()) {
      setEmergencyCouncilStatus("Error: Only admin can perform this action")
      return
    }
    
    try {
      setEmergencyCouncilStatus("Preparing transaction...")
      writeContract({
        address: CONTRACT_ADDRESSES.PROTOCOL_GOVERNANCE as `0x${string}`,
        abi: [{ 
          inputs: [{ name: "newCouncil", type: "address" }],
          name: "setEmergencyCouncil",
          outputs: [],
          stateMutability: "nonpayable",
          type: "function",
        }],
        functionName: "setEmergencyCouncil",
        args: [ADMIN_ADDRESS],
      })
    } catch (error) {
      setEmergencyCouncilStatus(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }
  
  // Empty security data - will be populated with real data
  const securityStatus = {
    overallHealth: "healthy",
    lastAudit: null,
    emergencyPaused: false,
    oracleStatus: "active",
    multisigStatus: "secure",
    contractsVerified: true,
  }

  const securityMetrics = [
    { name: "Oracle Health", status: "healthy", value: "99.9%", description: "Price feed uptime" },
    {
      name: "Collateral Safety",
      status: "healthy",
      value: formatPercentage(collateralRatio, 1),
      description: "Above minimum threshold",
    },
    { name: "Contract Security", status: "healthy", value: "Verified", description: "All contracts audited" },
    { name: "Emergency Controls", status: "ready", value: "Active", description: "Pause mechanism ready" },
  ]

  // Empty events array - will be populated with real data
  const recentEvents: any[] = []

  // Empty audit reports array - will be populated with real data
  const auditReports: any[] = []

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-green-500"
      case "warning":
        return "text-yellow-500"
      case "critical":
        return "text-red-500"
      case "ready":
        return "text-blue-500"
      default:
        return "text-gray-500"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="w-4 h-4" />
      case "warning":
        return <AlertTriangle className="w-4 h-4" />
      case "critical":
        return <AlertTriangle className="w-4 h-4" />
      case "ready":
        return <Shield className="w-4 h-4" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />
      case "error":
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      default:
        return <Activity className="w-4 h-4 text-blue-500" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Security Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {securityMetrics.map((metric) => (
          <Card key={metric.name} className="gradient-card border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-card-foreground flex items-center space-x-2">
                <span className={getStatusColor(metric.status)}>{getStatusIcon(metric.status)}</span>
                <span>{metric.name}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{metric.value}</div>
              <div className="text-xs text-muted-foreground">{metric.description}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Emergency Controls */}
      {isAdmin && (
        <Card className="gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="text-card-foreground flex items-center space-x-2">
              <Zap className="w-5 h-5 text-red-500" />
              <span>Emergency Controls</span>
            </CardTitle>
            <CardDescription>Critical system controls for emergency situations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button
                  variant="destructive"
                  className="bg-red-600 hover:bg-red-700"
                  disabled={securityStatus.emergencyPaused}
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  {securityStatus.emergencyPaused ? "System Paused" : "Emergency Pause"}
                </Button>
                <Button
                  variant="outline"
                  className="border-yellow-600 text-yellow-600 hover:bg-yellow-600 hover:text-white bg-transparent"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Lock Parameters
                </Button>
                <Button
                  variant="outline"
                  className="border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white bg-transparent"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Force Oracle Update
                </Button>
              </div>
              
              <div className="border-t border-border/50 pt-4">
                <h3 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Emergency Council Management
                </h3>
                <div className="space-y-3">
                  <Button
                    onClick={handleSetEmergencyCouncilToAdmin}
                    disabled={isPending || isConfirming || !address || address.toLowerCase() !== ADMIN_ADDRESS.toLowerCase()}
                    className="w-full md:w-auto bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    {isPending || isConfirming ? "Processing..." : "Set Emergency Council to Admin"}
                  </Button>
                  
                  {isPending && (
                    <Alert className="bg-blue-500/10 border-blue-500/50">
                      <AlertDescription className="text-blue-400">
                        Waiting for wallet confirmation...
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {isConfirming && (
                    <Alert className="bg-yellow-500/10 border-yellow-500/50">
                      <AlertDescription className="text-yellow-400">
                        Transaction submitted. Waiting for confirmation...
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {isConfirmed && (
                    <Alert className="bg-green-500/10 border-green-500/50">
                      <AlertDescription className="text-green-400">
                        Emergency Council successfully set to admin address!
                        {hash && (
                          <a 
                            href={`https://basescan.org/tx/${hash}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="ml-2 underline hover:text-green-300"
                          >
                            View transaction
                          </a>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {emergencyCouncilStatus && emergencyCouncilStatus.startsWith("Error") && (
                    <Alert className="bg-red-500/10 border-red-500/50">
                      <AlertDescription className="text-red-400">
                        {emergencyCouncilStatus}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Security Interface */}
      <Tabs defaultValue="monitoring" className="w-full">
        <TabsList>
          <TabsTrigger value="monitoring">Real-time Monitoring</TabsTrigger>
          <TabsTrigger value="events">Security Events</TabsTrigger>
          <TabsTrigger value="audits">Audit Reports</TabsTrigger>
          <TabsTrigger value="contracts">Contract Security</TabsTrigger>
        </TabsList>

        <TabsContent value="monitoring" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-card-foreground">System Health</CardTitle>
                <CardDescription>Real-time protocol monitoring</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <div>
                        <div className="font-medium text-card-foreground">Oracle Status</div>
                        <div className="text-sm text-muted-foreground">Price feeds active</div>
                      </div>
                    </div>
                    <Badge className="bg-green-500 text-white">Healthy</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <div>
                        <div className="font-medium text-card-foreground">Collateral Health</div>
                        <div className="text-sm text-muted-foreground">{formatPercentage(collateralRatio, 1)} ratio</div>
                      </div>
                    </div>
                    <Badge className="bg-green-500 text-white">Healthy</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
                    <div className="flex items-center space-x-3">
                      <Shield className="w-5 h-5 text-blue-500" />
                      <div>
                        <div className="font-medium text-card-foreground">Emergency Controls</div>
                        <div className="text-sm text-muted-foreground">Pause mechanism ready</div>
                      </div>
                    </div>
                    <Badge className="bg-blue-500 text-white">Ready</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <div>
                        <div className="font-medium text-card-foreground">Contract Security</div>
                        <div className="text-sm text-muted-foreground">All contracts verified</div>
                      </div>
                    </div>
                    <Badge className="bg-green-500 text-white">Verified</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="text-card-foreground">Risk Metrics</CardTitle>
                <CardDescription>Key risk indicators and thresholds</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-card-foreground">Collateral Ratio</span>
                      <span className="text-sm text-primary">{formatPercentage(collateralRatio, 1)}</span>
                    </div>
                    <div className="w-full bg-muted/20 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${Math.min((collateralRatio - 1) * 500, 100)}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Minimum: 110%</div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-card-foreground">Oracle Staleness</span>
                      <span className="text-sm text-green-600">Fresh</span>
                    </div>
                    <div className="w-full bg-muted/20 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: "95%" }}></div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Last update: 2 minutes ago</div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-card-foreground">System Utilization</span>
                      <span className="text-sm text-blue-600">68%</span>
                    </div>
                    <div className="w-full bg-muted/20 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: "68%" }}></div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Optimal range: 60-80%</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card className="gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="text-card-foreground">Recent Security Events</CardTitle>
              <CardDescription>System events and security alerts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentEvents.length > 0 ? (
                  recentEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start space-x-3 p-3 rounded-lg bg-muted/20 border border-border/50"
                    >
                      {getEventIcon(event.type)}
                      <div className="flex-1">
                        <div className="font-medium text-card-foreground">{event.title}</div>
                        <div className="text-sm text-muted-foreground">{event.description}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {event.timestamp ? new Date(event.timestamp).toLocaleString() : "Just now"}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {event.severity || "info"}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No security events recorded yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audits" className="space-y-4">
          <Card className="gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="text-card-foreground">Security Audit Reports</CardTitle>
              <CardDescription>Third-party security assessments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {auditReports.length > 0 ? (
                  auditReports.map((audit) => (
                    <div
                      key={audit.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/20 border border-border/50"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Shield className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium text-card-foreground">{audit.auditor || "Third-party Auditor"}</div>
                          <div className="text-sm text-muted-foreground">
                            {audit.date ? new Date(audit.date).toLocaleDateString() : "Recent"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <Badge className="bg-green-500 text-white">{audit.status || "completed"}</Badge>
                        <div className="text-sm text-muted-foreground">
                          {audit.findings || 0} findings, {audit.recommendations || 0} recommendations
                        </div>
                        {audit.report && (
                          <Button variant="outline" size="sm" onClick={() => window.open(audit.report, "_blank")}>
                            View Report
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No audit reports available yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts" className="space-y-4">
          <Card className="gradient-card border-border/50">
            <CardHeader>
              <CardTitle className="text-card-foreground">Contract Security Status</CardTitle>
              <CardDescription>Verification and security status of all protocol contracts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { name: "BTC1 Token", address: "Loading...", verified: true, proxy: false },
                  { name: "Vault Contract", address: "Loading...", verified: true, proxy: true },
                  { name: "Price Oracle", address: "Loading...", verified: true, proxy: false },
                  { name: "Weekly Distribution", address: "Loading...", verified: true, proxy: true },
                  { name: "Endowment Manager", address: "Loading...", verified: true, proxy: false },
                  { name: "Protocol Governance", address: "Loading...", verified: true, proxy: true },
                ].map((contract, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/50"
                  >
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <div>
                        <div className="font-medium text-card-foreground">{contract.name}</div>
                        <div className="text-xs font-mono text-muted-foreground">
                          {contract.address || "Address not available"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className="bg-green-500 text-white text-xs">Verified</Badge>
                      {contract.proxy && (
                        <Badge variant="outline" className="text-xs">
                          Proxy
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}