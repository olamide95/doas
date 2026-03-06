"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Bell, Check, FileText, MessageSquare, User } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export function NotificationsPanel({ department = "Director" }) {
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: "New Submission",
      message: "A new third-party submission has been received and requires your review.",
      timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
      read: false,
      type: "submission",
    },
    {
      id: 2,
      title: "Task Assigned",
      message: "You have been assigned a new task: Review practitioner documents.",
      timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
      read: false,
      type: "task",
    },
    {
      id: 3,
      title: "Message from Finance",
      message: "The Finance department has requested clarification on submission #1234.",
      timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
      read: true,
      type: "message",
    },
    {
      id: 4,
      title: "System Update",
      message: "The system will undergo maintenance tonight from 10 PM to 2 AM.",
      timestamp: new Date(Date.now() - 1 * 86400000).toISOString(),
      read: true,
      type: "system",
    },
  ])
  const { toast } = useToast()

  const markAsRead = (notificationId) => {
    const updatedNotifications = notifications.map((notification) =>
      notification.id === notificationId ? { ...notification, read: true } : notification,
    )
    setNotifications(updatedNotifications)
    toast({
      title: "Notification Marked as Read",
      description: "The notification has been marked as read.",
    })
  }

  const markAllAsRead = () => {
    const updatedNotifications = notifications.map((notification) => ({ ...notification, read: true }))
    setNotifications(updatedNotifications)
    toast({
      title: "All Notifications Marked as Read",
      description: "All notifications have been marked as read.",
    })
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInSeconds = Math.floor((now - date) / 1000)

    if (diffInSeconds < 60) {
      return "Just now"
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60)
      return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600)
      return `${hours} hour${hours > 1 ? "s" : ""} ago`
    } else {
      const days = Math.floor(diffInSeconds / 86400)
      return `${days} day${days > 1 ? "s" : ""} ago`
    }
  }

  const getNotificationIcon = (type) => {
    switch (type) {
      case "submission":
        return <FileText className="h-5 w-5" />
      case "task":
        return <Check className="h-5 w-5" />
      case "message":
        return <MessageSquare className="h-5 w-5" />
      case "system":
        return <Bell className="h-5 w-5" />
      default:
        return <User className="h-5 w-5" />
    }
  }

  const unreadCount = notifications.filter((notification) => !notification.read).length

  return (
    <Card className="h-[calc(100vh-12rem)]">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            You have {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
          </CardDescription>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            Mark All as Read
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-20rem)]">
          <div className="space-y-4">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`flex items-start space-x-4 rounded-lg border p-4 ${
                  notification.read ? "bg-background" : "bg-muted/30"
                }`}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    notification.read ? "bg-muted" : "bg-primary/10"
                  }`}
                >
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">{notification.title}</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{formatTime(notification.timestamp)}</span>
                      {!notification.read && <Badge variant="default">New</Badge>}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{notification.message}</p>
                  {!notification.read && (
                    <Button variant="ghost" size="sm" className="mt-2" onClick={() => markAsRead(notification.id)}>
                      Mark as Read
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
