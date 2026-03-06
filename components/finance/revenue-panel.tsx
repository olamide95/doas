"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Download, Filter, DollarSign, TrendingUp, Calendar } from "lucide-react"

export default function RevenuePanel() {
  const [activeTab, setActiveTab] = useState("overview")
  const [selectedYear, setSelectedYear] = useState("2023")

  const monthlyRevenue = [
    { month: "Jan", revenue: 1200000 },
    { month: "Feb", revenue: 1500000 },
    { month: "Mar", revenue: 1800000 },
    { month: "Apr", revenue: 1600000 },
    { month: "May", revenue: 2100000 },
    { month: "Jun", revenue: 2400000 },
    { month: "Jul", revenue: 2200000 },
    { month: "Aug", revenue: 2500000 },
    { month: "Sep", revenue: 2700000 },
    { month: "Oct", revenue: 2900000 },
    { month: "Nov", revenue: 3100000 },
    { month: "Dec", revenue: 3300000 },
  ]

  const revenueByType = [
    { name: "New Applications", value: 15000000 },
    { name: "Renewals", value: 8000000 },
    { name: "Penalties", value: 3000000 },
    { name: "Other Fees", value: 2000000 },
  ]

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"]

  const payments = [
    {
      id: 1,
      reference: "PAY-2023-001",
      applicant: "ABC Advertising",
      amount: 250000,
      type: "New Application",
      date: "2023-10-15",
      status: "completed",
    },
    {
      id: 2,
      reference: "PAY-2023-002",
      applicant: "XYZ Corp",
      amount: 180000,
      type: "Renewal",
      date: "2023-10-18",
      status: "completed",
    },
    {
      id: 3,
      reference: "PAY-2023-003",
      applicant: "123 Enterprises",
      amount: 320000,
      type: "New Application",
      date: "2023-10-20",
      status: "pending",
    },
    {
      id: 4,
      reference: "PAY-2023-004",
      applicant: "Metro Signs",
      amount: 75000,
      type: "Penalty",
      date: "2023-10-22",
      status: "completed",
    },
    {
      id: 5,
      reference: "PAY-2023-005",
      applicant: "City Displays",
      amount: 210000,
      type: "Renewal",
      date: "2023-10-25",
      status: "failed",
    },
  ]

  const getStatusBadge = (status) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">
            Completed
          </Badge>
        )
      case "pending":
        return <Badge variant="secondary">Pending</Badge>
      case "failed":
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <Card className="h-[calc(100vh-12rem)]">
      <CardHeader>
        <CardTitle>Revenue Management</CardTitle>
        <CardDescription>Track and analyze revenue from applications and renewals</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="h-full">
          <div className="border-b px-4 py-2 flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2021">2021</SelectItem>
                  <SelectItem value="2022">2022</SelectItem>
                  <SelectItem value="2023">2023</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          <TabsContent value="overview" className="m-0 p-4 h-[calc(100vh-20rem)] overflow-auto">
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₦28,000,000</div>
                  <p className="text-xs text-muted-foreground">+12% from last year</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Monthly Growth</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">8.5%</div>
                  <p className="text-xs text-muted-foreground">+2.1% from last month</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₦1,250,000</div>
                  <p className="text-xs text-muted-foreground">3 payments pending</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Revenue</CardTitle>
                  <CardDescription>Revenue trend for {selectedYear}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      revenue: {
                        label: "Revenue",
                        color: "hsl(var(--chart-1))",
                      },
                    }}
                    className="h-[300px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyRevenue} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis tickFormatter={(value) => `₦${(value / 1000000).toFixed(1)}M`} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <Bar dataKey="revenue" name="Revenue (₦)" fill="var(--color-revenue)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Type</CardTitle>
                  <CardDescription>Breakdown of revenue sources</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={revenueByType}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {revenueByType.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `₦${(value / 1000000).toFixed(1)}M`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="payments" className="m-0 h-[calc(100vh-20rem)]">
            <ScrollArea className="h-full">
              <div className="p-4">
                <div className="flex justify-between mb-4">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Filter className="h-4 w-4 mr-2" />
                      Filter
                    </Button>
                    <Select defaultValue="all">
                      <SelectTrigger className="w-[180px] h-9">
                        <SelectValue placeholder="Payment Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="new">New Application</SelectItem>
                        <SelectItem value="renewal">Renewal</SelectItem>
                        <SelectItem value="penalty">Penalty</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="sm">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Record Payment
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Applicant</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">{payment.reference}</TableCell>
                        <TableCell>{payment.applicant}</TableCell>
                        <TableCell>₦{payment.amount.toLocaleString()}</TableCell>
                        <TableCell>{payment.type}</TableCell>
                        <TableCell>{payment.date}</TableCell>
                        <TableCell>{getStatusBadge(payment.status)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="reports" className="m-0 p-4">
            <div className="text-center py-8 text-muted-foreground">
              Revenue reports and analytics will be implemented here
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
