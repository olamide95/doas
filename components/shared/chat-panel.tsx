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

interface ChatPanelProps {
  department: string
}

export default function ChatPanel({ department }: ChatPanelProps) {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState("")
  const [activeChat, setActiveChat] = useState("director")
  const messagesEndRef = useRef(null)

  useEffect(() => {
    const chatRef = collection(db, `chats/${department}-${activeChat}/messages`)
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
  }, [department, activeChat])

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    try {
      const chatRef = collection(db, `chats/${department}-${activeChat}/messages`)
      await addDoc(chatRef, {
        text: newMessage,
        sender: department.toLowerCase().replace(/\s+/g, "-"),
        senderName: department,
        timestamp: serverTimestamp(),
      })

      setNewMessage("")
    } catch (error) {
      console.error("Error sending message:", error)
    }
  }

  const chatOptions = [
    { id: "director", name: "Director" },
    { id: "csu", name: "CSU Department", hidden: department === "CSU" },
    { id: "finance", name: "Finance & Admin", hidden: department === "Finance and Admin" },
    { id: "planning", name: "Planning & Development", hidden: department === "Planning and Development" },
    { id: "monitoring", name: "Monitoring & Enforcement", hidden: department === "Monitoring and Enforcement" },
  ].filter((option) => !option.hidden)

  return (
    <Card className="h-[calc(100vh-12rem)]">
      <CardHeader>
        <CardTitle>Departmental Chat</CardTitle>
        <CardDescription>Communicate with different departments in real-time</CardDescription>
      </CardHeader>
      <CardContent className="p-0 flex h-[calc(100%-8rem)]">
        <div className="w-1/4 border-r">
          <Tabs
            defaultValue="director"
            value={activeChat}
            onValueChange={setActiveChat}
            orientation="vertical"
            className="h-full"
          >
            <TabsList className="w-full flex flex-col h-full justify-start items-stretch rounded-none">
              {chatOptions.map((chat) => (
                <TabsTrigger
                  key={chat.id}
                  value={chat.id}
                  className="justify-start py-3 px-4 data-[state=active]:bg-muted"
                >
                  {chat.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="w-3/4 flex flex-col">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No messages yet. Start a conversation!</div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === department.toLowerCase().replace(/\s+/g, "-") ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`flex ${message.sender === department.toLowerCase().replace(/\s+/g, "-") ? "flex-row-reverse" : "flex-row"} items-start gap-2 max-w-[80%]`}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={`/placeholder.svg?height=32&width=32`} />
                        <AvatarFallback>{message.sender[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div
                          className={`rounded-lg px-3 py-2 ${
                            message.sender === department.toLowerCase().replace(/\s+/g, "-")
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
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
                ))
              )}
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
