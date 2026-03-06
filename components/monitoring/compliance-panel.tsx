"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Search, Calendar, Filter, Plus } from "lucide-react"

export default function CompliancePanel() {
  const [activeTab, setActiveTab] = useState("issues")
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedIssue, setSelectedIssue] = useState(null)

  const complianceIssues = [
    {
      id: 1,
      site: "Billboard A",
      owner: "ABC Advertising",
      issue: "Expired permit",
      severity: "high",
      status: "open",
      reportedDate: "2023-10-15",
      dueDate: "2023-11-15",
    },
    {
      id: 2,
      site: "Street Sign B",
      owner: "XYZ Corp",
      issue: "Non-compliant dimensions",
      severity: "medium",
      status: "in-progress",
      reportedDate: "2023-10-20",
      dueDate: "2023-11-20",
    },
    {
      id: 3,
      site: "Roof Sign C",
      owner: "123 Enterprises",
      issue: "Structural safety concern",
      severity: "high",
      status: "open",
      reportedDate: "2023-10-25",
      dueDate: "2023-11-10",
    },
    {
      id: 4,
      site: "Billboard D",
      owner: "Metro Signs",
      issue: "Unauthorized modification",
      severity: "medium",
      status: "resolved",
      reportedDate: "2023-09-15",
      dueDate: "2023-10-15",
    },
    {
      id: 5,
      site: "Canopy Sign E",
      owner: "City Displays",
      issue: "Illumination violation",
      severity: "low",
      status: "in-progress",
      reportedDate: "2023-10-10",
      dueDate: "2023-11-30",
    },
  ]

  const filteredIssues = complianceIssues.filter(
    (issue) =>
      issue.site.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.owner.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.issue.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.status.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case "high":
        return <Badge variant="destructive">High</Badge>
      case "medium":
        return <Badge variant="default">Medium</Badge>
      case "low":
        return <Badge variant="secondary">Low</Badge>
      default:
        return <Badge variant="outline">{severity}</Badge>
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case "open":
        return <Badge variant="destructive">Open</Badge>
      case "in-progress":
        return <Badge variant="default">In Progress</Badge>
      case "resolved":
        return (
          <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">
            Resolved
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const handleViewIssue = (issue) => {
    setSelectedIssue(issue)
    setIsDialogOpen(true)
  }

  return (
    <Card className="h-[calc(100vh-12rem)]">
      <CardHeader>
        <CardTitle>Compliance Management</CardTitle>
        <CardDescription>Track and resolve compliance issues</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="issues" value={activeTab} onValueChange={setActiveTab} className="h-full">
          <div className="border-b px-4 py-2 flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="issues">Issues</TabsTrigger>
              <TabsTrigger value="inspections">Inspections</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search issues..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <TabsContent value="issues" className="m-0 h-[calc(100vh-20rem)]">
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
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    New Issue
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Site</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Issue</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredIssues.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                          No compliance issues found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredIssues.map((issue) => (
                        <TableRow key={issue.id}>
                          <TableCell className="font-medium">{issue.site}</TableCell>
                          <TableCell>{issue.owner}</TableCell>
                          <TableCell>{issue.issue}</TableCell>
                          <TableCell>{getSeverityBadge(issue.severity)}</TableCell>
                          <TableCell>{getStatusBadge(issue.status)}</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                              {issue.dueDate}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => handleViewIssue(issue)}>
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="inspections" className="m-0 p-4">
            <div className="text-center py-8 text-muted-foreground">
              Inspections schedule and management will be implemented here
            </div>
          </TabsContent>

          <TabsContent value="reports" className="m-0 p-4">
            <div className="text-center py-8 text-muted-foreground">
              Compliance reports and analytics will be implemented here
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Compliance Issue Details</DialogTitle>
            <DialogDescription>View and update the status of this compliance issue</DialogDescription>
          </DialogHeader>

          {selectedIssue && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-sm">Site</Label>
                  <p className="font-medium">{selectedIssue.site}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Owner</Label>
                  <p className="font-medium">{selectedIssue.owner}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground text-sm">Issue</Label>
                  <p className="font-medium">{selectedIssue.issue}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Severity</Label>
                  <div className="mt-1">{getSeverityBadge(selectedIssue.severity)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedIssue.status)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Reported Date</Label>
                  <p className="font-medium">{selectedIssue.reportedDate}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Due Date</Label>
                  <p className="font-medium">{selectedIssue.dueDate}</p>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="update-status">Update Status</Label>
                  <Select defaultValue={selectedIssue.status}>
                    <SelectTrigger id="update-status" className="mt-1">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="comment">Add Comment</Label>
                  <Textarea
                    id="comment"
                    placeholder="Enter your comment or resolution details"
                    className="mt-1"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button>Update Issue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
