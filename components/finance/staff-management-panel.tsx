"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, UserPlus, Mail, Building, Briefcase } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase"

export function FinanceStaffManagementPanel() {
  const [activeTab, setActiveTab] = useState("staff")
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [staffName, setStaffName] = useState("")
  const [staffEmail, setStaffEmail] = useState("")
  const [staffPhone, setStaffPhone] = useState("")
  const [staffDepartment, setStaffDepartment] = useState("")
  const [staffDesignation, setStaffDesignation] = useState("")
  const [staffPassword, setStaffPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [staffList, setStaffList] = useState([])
  const { toast } = useToast()

  const departments = ["CSU", "Finance and Admin", "Planning and Development", "Monitoring and Enforcement"]

  const designations = ["Director", "Manager", "Supervisor", "Officer", "Assistant"]

  // Map department names to role values for the profiles table
  const departmentToRole = {
    CSU: "csu",
    "Finance and Admin": "finance",
    "Planning and Development": "planning",
    "Monitoring and Enforcement": "monitoring",
    "Director's Office": "director",
  }

  useEffect(() => {
    fetchStaff()
  }, [])

  const fetchStaff = async () => {
    try {
      const { data, error } = await supabase.from("profiles").select("*")

      if (error) throw error

      if (data) {
        // Transform the data to match our component's expected format
        const formattedStaff = data.map((staff) => ({
          id: staff.id,
          name: staff.full_name,
          email: staff.email || "", // Email might be in auth.users instead
          phone: staff.phone || "",
          department: staff.department,
          designation: staff.designation || "",
          status: staff.active ? "active" : "inactive",
        }))
        setStaffList(formattedStaff)
      }
    } catch (error) {
      console.error("Error fetching staff:", error)
      toast({
        title: "Error",
        description: "Failed to fetch staff members.",
        variant: "destructive",
      })
    }
  }

  const filteredStaff = staffList.filter(
    (staff) =>
      staff.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      staff.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      staff.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      staff.designation?.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleCreateStaff = async (e) => {
    e.preventDefault()

    if (!staffName || !staffEmail || !staffPhone || !staffDepartment || !staffDesignation || !staffPassword) {
      toast({
        title: "Missing Information",
        description: "Please fill all fields.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      // 1. Create user account with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: staffEmail,
        password: staffPassword,
        options: {
          data: {
            full_name: staffName,
            department: staffDepartment,
            designation: staffDesignation,
            role: departmentToRole[staffDepartment] || "user",
          },
        },
      })

      if (authError) throw authError

      // 2. Update the profile with additional information
      // Note: The trigger we set up earlier will create a basic profile,
      // but we need to update it with additional information
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: staffName,
          phone: staffPhone,
          department: staffDepartment,
          designation: staffDesignation,
          role: departmentToRole[staffDepartment] || "user",
          updated_at: new Date().toISOString(),
        })
        .eq("id", authData.user.id)

      if (profileError) throw profileError

      toast({
        title: "Staff Created",
        description: "Staff member created successfully!",
      })

      // Reset form
      setStaffName("")
      setStaffEmail("")
      setStaffPhone("")
      setStaffDepartment("")
      setStaffDesignation("")
      setStaffPassword("")
      setIsDialogOpen(false)

      // Refresh the staff list
      fetchStaff()
    } catch (error) {
      console.error("Error creating staff member:", error)
      toast({
        title: "Error",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleStatus = async (id, currentStatus) => {
    try {
      const newStatus = currentStatus === "active" ? false : true

      const { error } = await supabase.from("profiles").update({ active: newStatus }).eq("id", id)

      if (error) throw error

      // Update local state
      setStaffList(
        staffList.map((staff) => (staff.id === id ? { ...staff, status: newStatus ? "active" : "inactive" } : staff)),
      )

      toast({
        title: "Status Updated",
        description: `Staff status changed to ${newStatus ? "active" : "inactive"}.`,
      })
    } catch (error) {
      console.error("Error updating staff status:", error)
      toast({
        title: "Error",
        description: "Failed to update staff status.",
        variant: "destructive",
      })
    }
  }

  return (
    <Card className="h-[calc(100vh-12rem)]">
      <CardHeader>
        <CardTitle>Staff Management</CardTitle>
        <CardDescription>Manage staff members and their access</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="staff" value={activeTab} onValueChange={setActiveTab} className="h-full">
          <div className="border-b px-4 py-2 flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="staff">Staff</TabsTrigger>
              <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
              <TabsTrigger value="departments">Departments</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search staff..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Staff
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Staff Member</DialogTitle>
                    <DialogDescription>Create a new staff account with department access</DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleCreateStaff} className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        value={staffName}
                        onChange={(e) => setStaffName(e.target.value)}
                        placeholder="Enter full name"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={staffEmail}
                          onChange={(e) => setStaffEmail(e.target.value)}
                          placeholder="Enter email address"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input
                          id="phone"
                          value={staffPhone}
                          onChange={(e) => setStaffPhone(e.target.value)}
                          placeholder="Enter phone number"
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="department">Department</Label>
                        <Select value={staffDepartment} onValueChange={setStaffDepartment} required>
                          <SelectTrigger id="department">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments.map((dept) => (
                              <SelectItem key={dept} value={dept}>
                                {dept}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="designation">Designation</Label>
                        <Select value={staffDesignation} onValueChange={setStaffDesignation} required>
                          <SelectTrigger id="designation">
                            <SelectValue placeholder="Select designation" />
                          </SelectTrigger>
                          <SelectContent>
                            {designations.map((desig) => (
                              <SelectItem key={desig} value={desig}>
                                {desig}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={staffPassword}
                        onChange={(e) => setStaffPassword(e.target.value)}
                        placeholder="Enter password"
                        required
                      />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Creating..." : "Create Staff"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <TabsContent value="staff" className="m-0 h-[calc(100vh-20rem)]">
            <ScrollArea className="h-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStaff.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                        No staff members found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStaff.map((staff) => (
                      <TableRow key={staff.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={staff.avatar_url || `/placeholder.svg?height=32&width=32`} />
                              <AvatarFallback>{staff.name?.charAt(0) || "U"}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{staff.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <Mail className="h-4 w-4 mr-1 text-muted-foreground" />
                            {staff.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <Building className="h-4 w-4 mr-1 text-muted-foreground" />
                            {staff.department}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <Briefcase className="h-4 w-4 mr-1 text-muted-foreground" />
                            {staff.designation}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={staff.status === "active" ? "outline" : "secondary"}
                            className={
                              staff.status === "active" ? "bg-green-100 text-green-800 hover:bg-green-100" : ""
                            }
                          >
                            {staff.status === "active" ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(staff.id, staff.status)}>
                            {staff.status === "active" ? "Deactivate" : "Activate"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="roles" className="m-0 p-4">
            <div className="text-center py-8 text-muted-foreground">
              Roles and permissions management will be implemented here
            </div>
          </TabsContent>
          <TabsContent value="departments" className="m-0 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {departments.map((dept) => (
                <Card key={dept}>
                  <CardHeader>
                    <CardTitle>{dept}</CardTitle>
                    <CardDescription>
                      {filteredStaff.filter((s) => s.department === dept).length} staff members
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {filteredStaff
                        .filter((s) => s.department === dept)
                        .slice(0, 3)
                        .map((staff) => (
                          <div key={staff.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={staff.avatar_url || `/placeholder.svg?height=32&width=32`} />
                                <AvatarFallback>{staff.name?.charAt(0) || "U"}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium">{staff.name}</p>
                                <p className="text-xs text-muted-foreground">{staff.designation}</p>
                              </div>
                            </div>
                            <Badge
                              variant={staff.status === "active" ? "outline" : "secondary"}
                              className={
                                staff.status === "active" ? "bg-green-100 text-green-800 hover:bg-green-100" : ""
                              }
                            >
                              {staff.status === "active" ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        ))}
                      {filteredStaff.filter((s) => s.department === dept).length > 3 && (
                        <Button variant="ghost" size="sm" className="w-full">
                          View All Staff
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
