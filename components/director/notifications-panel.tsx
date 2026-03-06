"use client"

import { useState, useEffect } from "react"
import { collection, getDocs, updateDoc, doc, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Bell, CheckCircle, FileText, MessageSquare, User } from "lucide-react"

interface Notification {
  id: string
  title: string
  message: string
  type: string
  read: boolean
  timestamp: Date
  link?: string
}

interface NotificationsPanelProps {
  notifications: Notification[]
}

export default function NotificationsPanel({ notifications }: NotificationsPanelProps) {
  const [localNotifications, setLocalNotifications] = useState<Notification[]>([])

  useEffect(() => {
    if (notifications && notifications.length > 0) {
      setLocalNotifications(notifications)
    } else {
      // Fetch notifications if not provided
      const fetchNotifications = async () => {
        const notificationsQuery = query(collection(db, "notifications"), orderBy("timestamp", "desc"))
        const snapshot = await getDocs(notificationsQuery)
        const notificationsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date(),
        })) as Notification[]

        setLocalNotifications(notificationsData)
      }

      fetchNotifications()
    }
  }, [notifications])

  const markAsRead = async (notificationId: string) => {
    try {
      const notificationRef = doc(db, "notifications", notificationId)
      await updateDoc(notificationRef, {
        read: true,
      })

      // Update local state
      setLocalNotifications(
        localNotifications.map((notification) =>
          notification.id === notificationId ? { ...notification, read: true } : notification,
        ),
      )
    } catch (error) {
      console.error("Error marking notification as read:", error)
    }
  }

  const markAllAsRead = async () => {
    try {
      // Get all unread notifications
      const unreadNotifications = localNotifications.filter((notification) => !notification.read)

      // Update each notification in Firestore
      await Promise.all(
        unreadNotifications.map((notification) => {
          const notificationRef = doc(db, "notifications", notification.id)
          return updateDoc(notificationRef, { read: true })
        }),
      )

      // Update local state
      setLocalNotifications(localNotifications.map((notification) => ({ ...notification, read: true })))
    } catch (error) {
      console.error("Error marking all notifications as read:", error)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "submission":
        return <FileText className="h-5 w-5" />
      case "message":
        return <MessageSquare className="h-5 w-5" />
      case "approval":
        return <CheckCircle className="h-5 w-5" />
      case "user":
        return <User className="h-5 w-5" />
      default:
        return <Bell className="h-5 w-5" />
    }
  }

  return (
    <Card className="h-[calc(100vh-12rem)]">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Stay updated with the latest activities</CardDescription>
        </div>
        <Button variant="outline" onClick={markAllAsRead}>
          Mark all as read
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-20rem)]">
          <div className="px-4 py-2">
            {localNotifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No notifications found</div>
            ) : (
              <div className="space-y-4">
                {localNotifications.map((notification) => (
                  <Card key={notification.id} className={`${notification.read ? "bg-background" : "bg-muted/30"}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full ${
                            notification.read ? "bg-muted" : "bg-primary/10"
                          }`}
                        >
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{notification.title}</h4>
                            <div className="flex items-center gap-2">
                              {!notification.read && (
                                <Badge variant="default" className="px-1.5 py-0.5">
                                  New
                                </Badge>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => markAsRead(notification.id)}
                                className="h-8 px-2"
                              >
                                {notification.read ? "Read" : "Mark as read"}
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {notification.timestamp.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
