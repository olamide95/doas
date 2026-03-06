"use client"

import { useState, useEffect } from "react"
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
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
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, Trash2 } from "lucide-react"

interface TasksPanelProps {
  department: string
}

export default function TasksPanel({ department }: TasksPanelProps) {
  const [tasks, setTasks] = useState([])
  const [newTaskTitle, setNewTaskTitle] = useState("")
  const [newTaskDescription, setNewTaskDescription] = useState("")
  const [newTaskAssignee, setNewTaskAssignee] = useState("")
  const [newTaskPriority, setNewTaskPriority] = useState("medium")
  const [newTaskDueDate, setNewTaskDueDate] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("all")
  const [staff, setStaff] = useState([])

  useEffect(() => {
    const fetchTasks = async () => {
      let tasksQuery

      if (activeTab === "assigned") {
        tasksQuery = query(
          collection(db, "tasks"),
          where("assignedTo", "!=", ""),
          where("department", "==", department),
          orderBy("assignedTo"),
          orderBy("createdAt", "desc"),
        )
      } else if (activeTab === "completed") {
        tasksQuery = query(
          collection(db, "tasks"),
          where("completed", "==", true),
          where("department", "==", department),
          orderBy("createdAt", "desc"),
        )
      } else if (activeTab === "pending") {
        tasksQuery = query(
          collection(db, "tasks"),
          where("completed", "==", false),
          where("department", "==", department),
          orderBy("createdAt", "desc"),
        )
      } else {
        tasksQuery = query(collection(db, "tasks"), where("department", "==", department), orderBy("createdAt", "desc"))
      }

      const snapshot = await getDocs(tasksQuery)
      const tasksData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        dueDate: doc.data().dueDate ? new Date(doc.data().dueDate) : null,
      }))

      setTasks(tasksData)
    }

    const fetchStaff = async () => {
      const staffQuery = query(collection(db, "staff"))
      const snapshot = await getDocs(staffQuery)
      const staffData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))

      setStaff(staffData)
    }

    fetchTasks()
    fetchStaff()
  }, [activeTab, department])

  const handleAddTask = async (e) => {
    e.preventDefault()

    if (!newTaskTitle.trim()) return

    try {
      await addDoc(collection(db, "tasks"), {
        title: newTaskTitle,
        description: newTaskDescription,
        assignedTo: newTaskAssignee,
        assignedBy: department,
        department: department,
        priority: newTaskPriority,
        dueDate: newTaskDueDate,
        completed: false,
        createdAt: serverTimestamp(),
      })

      // Reset form
      setNewTaskTitle("")
      setNewTaskDescription("")
      setNewTaskAssignee("")
      setNewTaskPriority("medium")
      setNewTaskDueDate("")
      setIsDialogOpen(false)

      // Refresh tasks
      const tasksQuery = query(
        collection(db, "tasks"),
        where("department", "==", department),
        orderBy("createdAt", "desc"),
      )
      const snapshot = await getDocs(tasksQuery)
      const tasksData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        dueDate: doc.data().dueDate ? new Date(doc.data().dueDate) : null,
      }))

      setTasks(tasksData)
    } catch (error) {
      console.error("Error adding task:", error)
    }
  }

  const handleToggleComplete = async (taskId, currentStatus) => {
    try {
      const taskRef = doc(db, "tasks", taskId)
      await updateDoc(taskRef, {
        completed: !currentStatus,
      })

      // Update local state
      setTasks(tasks.map((task) => (task.id === taskId ? { ...task, completed: !currentStatus } : task)))
    } catch (error) {
      console.error("Error updating task:", error)
    }
  }

  const handleDeleteTask = async (taskId) => {
    try {
      await deleteDoc(doc(db, "tasks", taskId))

      // Update local state
      setTasks(tasks.filter((task) => task.id !== taskId))
    } catch (error) {
      console.error("Error deleting task:", error)
    }
  }

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive">High</Badge>
      case "medium":
        return <Badge variant="default">Medium</Badge>
      case "low":
        return <Badge variant="secondary">Low</Badge>
      default:
        return <Badge variant="outline">Normal</Badge>
    }
  }

  return (
    <Card className="h-[calc(100vh-12rem)]">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Tasks Management</CardTitle>
          <CardDescription>Manage and track tasks for {department}</CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
              <DialogDescription>Add a new task and assign it to a staff member</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddTask}>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Input
                    placeholder="Task title"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Textarea
                    placeholder="Task description"
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Select value={newTaskAssignee} onValueChange={setNewTaskAssignee}>
                    <SelectTrigger>
                      <SelectValue placeholder="Assign to" />
                    </SelectTrigger>
                    <SelectContent>
                      {staff
                        .filter((person) => person.department === department)
                        .map((person) => (
                          <SelectItem key={person.id} value={person.id}>
                            {person.name} ({person.designation})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
                      <SelectTrigger>
                        <SelectValue placeholder="Priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Input type="date" value={newTaskDueDate} onChange={(e) => setNewTaskDueDate(e.target.value)} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Create Task</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="h-full">
          <div className="border-b px-4">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="all">All Tasks</TabsTrigger>
              <TabsTrigger value="assigned">Assigned</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="h-[calc(100vh-20rem)]">
            <TabsContent value="all" className="m-0 p-4">
              <TaskList
                tasks={tasks}
                onToggleComplete={handleToggleComplete}
                onDeleteTask={handleDeleteTask}
                getPriorityBadge={getPriorityBadge}
                staff={staff}
              />
            </TabsContent>
            <TabsContent value="assigned" className="m-0 p-4">
              <TaskList
                tasks={tasks}
                onToggleComplete={handleToggleComplete}
                onDeleteTask={handleDeleteTask}
                getPriorityBadge={getPriorityBadge}
                staff={staff}
              />
            </TabsContent>
            <TabsContent value="pending" className="m-0 p-4">
              <TaskList
                tasks={tasks}
                onToggleComplete={handleToggleComplete}
                onDeleteTask={handleDeleteTask}
                getPriorityBadge={getPriorityBadge}
                staff={staff}
              />
            </TabsContent>
            <TabsContent value="completed" className="m-0 p-4">
              <TaskList
                tasks={tasks}
                onToggleComplete={handleToggleComplete}
                onDeleteTask={handleDeleteTask}
                getPriorityBadge={getPriorityBadge}
                staff={staff}
              />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function TaskList({ tasks, onToggleComplete, onDeleteTask, getPriorityBadge, staff }) {
  const getAssigneeName = (assigneeId) => {
    const assignee = staff.find((person) => person.id === assigneeId)
    return assignee ? assignee.name : "Unassigned"
  }

  return (
    <div className="space-y-4">
      {tasks.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No tasks found</div>
      ) : (
        tasks.map((task) => (
          <Card key={task.id} className={`${task.completed ? "bg-muted/50" : ""}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={task.completed}
                    onCheckedChange={() => onToggleComplete(task.id, task.completed)}
                    className="mt-1"
                  />
                  <div>
                    <h3 className={`font-medium ${task.completed ? "line-through text-muted-foreground" : ""}`}>
                      {task.title}
                    </h3>
                    {task.description && <p className="text-sm text-muted-foreground mt-1">{task.description}</p>}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {getPriorityBadge(task.priority)}
                      {task.assignedTo && (
                        <Badge variant="outline">Assigned to: {getAssigneeName(task.assignedTo)}</Badge>
                      )}
                      {task.dueDate && <Badge variant="outline">Due: {task.dueDate.toLocaleDateString()}</Badge>}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => onDeleteTask(task.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
