"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MapPin, Search, Layers, Filter } from "lucide-react"

export default function SiteMapPanel() {
  const [sites, setSites] = useState([
    { id: 1, name: "Billboard A", coordinates: "9.0765, 7.3986", type: "Billboard", status: "Active" },
    { id: 2, name: "Street Sign B", coordinates: "6.5244, 3.3792", type: "Street Sign", status: "Pending" },
    { id: 3, name: "Roof Sign C", coordinates: "7.3775, 3.9470", type: "Roof Sign", status: "Active" },
    { id: 4, name: "Billboard D", coordinates: "9.0820, 7.4910", type: "Billboard", status: "Expired" },
    { id: 5, name: "Canopy Sign E", coordinates: "6.4281, 3.4219", type: "Canopy Sign", status: "Active" },
  ])
  const [searchTerm, setSearchTerm] = useState("")
  const [filteredSites, setFilteredSites] = useState([])
  const [activeTab, setActiveTab] = useState("map")

  useEffect(() => {
    // Filter sites based on search term
    const filtered = sites.filter(
      (site) =>
        site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        site.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        site.status.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    setFilteredSites(filtered)
  }, [searchTerm, sites])

  const getStatusBadge = (status) => {
    switch (status.toLowerCase()) {
      case "active":
        return <Badge variant="default">Active</Badge>
      case "pending":
        return <Badge variant="secondary">Pending</Badge>
      case "expired":
        return <Badge variant="destructive">Expired</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <Card className="h-[calc(100vh-12rem)]">
      <CardHeader>
        <CardTitle>Site Map</CardTitle>
        <CardDescription>View and manage all signage locations</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="map" value={activeTab} onValueChange={setActiveTab} className="h-full">
          <div className="border-b px-4 py-2 flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="map">Map View</TabsTrigger>
              <TabsTrigger value="list">List View</TabsTrigger>
            </TabsList>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search sites..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <TabsContent value="map" className="m-0 p-4 h-[calc(100vh-20rem)]">
            <div className="relative h-full w-full rounded-lg border overflow-hidden">
              <div className="absolute inset-0 bg-muted flex items-center justify-center">
                <p className="text-muted-foreground">Map view will be implemented with Google Maps API</p>
              </div>
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                <Button size="sm" variant="secondary">
                  <Layers className="h-4 w-4 mr-2" />
                  Layers
                </Button>
                <Button size="sm" variant="secondary">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
              </div>
              <div className="absolute bottom-4 left-4 bg-background p-2 rounded-lg shadow-md">
                <p className="text-xs text-muted-foreground">{filteredSites.length} sites displayed</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="list" className="m-0 h-[calc(100vh-20rem)]">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                {filteredSites.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No sites found matching your search</div>
                ) : (
                  filteredSites.map((site) => (
                    <Card key={site.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-medium">{site.name}</h3>
                            <div className="flex items-center text-sm text-muted-foreground mt-1">
                              <MapPin className="h-4 w-4 mr-1" />
                              {site.coordinates}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline">{site.type}</Badge>
                              {getStatusBadge(site.status)}
                            </div>
                          </div>
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
