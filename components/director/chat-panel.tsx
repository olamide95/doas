"use client"

import { useState, useEffect, useRef } from "react"
import { collection, query, orderBy, addDoc, serverTimestamp, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Send } from "lucide-react"

export default function ChatPanel() {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState("")
  const [activeChat, setActiveChat] = useState("csu")
  const messagesEndRef = useRef(null)

  useEffect(() => {
    const chatRef = collection(db, `chats/${activeChat}/messages`)
    const q = query(chatRef, orderBy("timestamp", "asc"))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date(),
      }))
      setMessages(messages)

      // Scroll to bottom after messages update
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      }, 100)
    })

    return () => unsubscribe()
  }, [activeChat])

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    try {
      const chatRef = collection(db, `chats/${activeChat}/messages`)
      await addDoc(chatRef, {
        text: newMessage,
        sender: "director",
        senderName: "Director",
        timestamp: serverTimestamp(),
      })

      setNewMessage("")
    } catch (error) {
      console.error("Error sending message:", error)
    }
  }

  const departments = [
    { id: "csu", name: "CSU Department" },
    { id: "finance", name: "Finance & Admin" },
    { id: "planning", name: "Planning & Development" },
    { id: "monitoring", name: "Monitoring & Enforcement" },
  ]

  return (
    <Card className="h-[calc(100vh-12rem)]">
      <CardHeader>
        <CardTitle>Departmental Chat</CardTitle>
        <CardDescription>Communicate with different departments in real-time</CardDescription>
      </CardHeader>
      <CardContent className="p-0 flex h-[calc(100%-8rem)]">
        <div className="w-1/4 border-r">
          <Tabs
            defaultValue="csu"
            value={activeChat}
            onValueChange={setActiveChat}
            orientation="vertical"
            className="h-full"
          >
            <TabsList className="w-full flex flex-col h-full justify-start items-stretch rounded-none">
              {departments.map((dept) => (
                <TabsTrigger
                  key={dept.id}
                  value={dept.id}
                  className="justify-start py-3 px-4 data-[state=active]:bg-muted"
                >
                  {dept.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="w-3/4 flex flex-col">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === "director" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`flex ${message.sender === "director" ? "flex-row-reverse" : "flex-row"} items-start gap-2 max-w-[80%]`}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={`/placeholder.svg?height=32&width=32`} />
                      <AvatarFallback>
                        {message.sender === "director" ? "D" : message.sender[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div
                        className={`rounded-lg px-3 py-2 ${
                          message.sender === "director" ? "bg-primary text-primary-foreground" : "bg-muted"
                        }`}
                      >
                        <p>{message.text}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {message.senderName} •{" "}
                        {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <CardFooter className="border-t p-3">
            <form onSubmit={handleSendMessage} className="flex w-full gap-2">
              <Input
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardFooter>
        </div>
      </CardContent>
    </Card>
  )
}
