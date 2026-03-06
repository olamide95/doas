"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/components/ui/use-toast"

export function TasksPanel({ department = "Director" }) {
  const [tasks, setTasks] = useState([
    {
      id: 1,
      title: "Review pending submissions",
      description: "Review and process the backlog of submissions from last week",
      status: "in-progress",
      priority: "high",
      dueDate: "2023-06-15",
      assignedTo: "John Doe",
      completed: false,
    },
    {
      id: 2,
      title: "Update practitioner database",
      description: "Add new practitioners and update existing records",
      status: "todo",
      priority: "medium",
      dueDate: "2023-06-20",
      assignedTo: "Jane Smith",
      completed: false,
    },
    {
      id: 3,
      title: "Prepare monthly report",
      description: "Compile statistics and prepare the monthly report for the Director",
      status: "todo",
      priority: "high",
      dueDate: "2023-06-30",
      assignedTo: "You",
      completed: false,
    },
  ])
  const [isAddTaskDialogOpen, setIsAddTaskDialogOpen] = useState(false)
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium",
    dueDate: "",
    assignedTo: "",
  })
  const { toast } = useToast()

  const handleAddTask = () => {
    if (!newTask.title || !newTask.dueDate || !newTask.assignedTo) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return
    }

    const task = {
      id: tasks.length + 1,
      ...newTask,
      status: "todo",
      completed: false,
    }

    setTasks([...tasks, task])
    setNewTask({
      title: "",
      description: "",
      priority: "medium",
      dueDate: "",
      assignedTo: "",
    })
    setIsAddTaskDialogOpen(false)

    toast({
      title: "Task Added",
      description: "The new task has been added successfully.",
    })
  }

  const handleToggleTaskCompletion = (taskId) => {
    const updatedTasks = tasks.map((task) =>
      task.id === taskId
        ? { ...task, completed: !task.completed, status: !task.completed ? "completed" : "in-progress" }
        : task,
    )
    setTasks(updatedTasks)

    const task = tasks.find((t) => t.id === taskId)
    toast({
      title: task.completed ? "Task Marked as Incomplete" : "Task Completed",
      description: `"${task.title}" has been ${task.completed ? "marked as incomplete" : "marked as complete"}.`,
    })
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
        return <Badge variant="outline">{priority}</Badge>
    }
  }

  return (
    <Card className="h-[calc(100vh-12rem)]">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Tasks</CardTitle>
          <CardDescription>Manage your tasks and assignments</CardDescription>
        </div>
        <Dialog open={isAddTaskDialogOpen} onOpenChange={setIsAddTaskDialogOpen}>
          <DialogTrigger asChild>
            <Button>Add Task</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Task</DialogTitle>
              <DialogDescription>Create a new task or assignment.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="title" className="text-right">
                  Title
                </Label>
                <Input
                  id="title"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="priority" className="text-right">
                  Priority
                </Label>
                <Select value={newTask.priority} onValueChange={(value) => setNewTask({ ...newTask, priority: value })}>
                  <SelectTrigger id="priority" className="col-span-3">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="dueDate" className="text-right">
                  Due Date
                </Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="assignedTo" className="text-right">
                  Assigned To
                </Label>
                <Input
                  id="assignedTo"
                  value={newTask.assignedTo}
                  onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddTaskDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddTask}>Add Task</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-20rem)]">
          <div className="space-y-4">
            {tasks.map((task) => (
              <div key={task.id} className={`rounded-lg border p-4 ${task.completed ? "bg-muted/50" : ""}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      checked={task.completed}
                      onCheckedChange={() => handleToggleTaskCompletion(task.id)}
                      className="mt-1"
                    />
                    <div>
                      <h3
                        className={`text-sm font-medium ${task.completed ? "line-through text-muted-foreground" : ""}`}
                      >
                        {task.title}
                      </h3>
                      <p className={`text-sm text-muted-foreground ${task.completed ? "line-through" : ""}`}>
                        {task.description}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span>Due: {task.dueDate}</span>
                        <span>•</span>
                        <span>Assigned to: {task.assignedTo}</span>
                      </div>
                    </div>
                  </div>
                  <div>{getPriorityBadge(task.priority)}</div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
