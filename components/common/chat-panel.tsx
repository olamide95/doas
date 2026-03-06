"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send } from "lucide-react"

export function ChatPanel({ department = "Director" }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "System",
      content: `Welcome to the ${department} chat. How can we help you today?`,
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      isCurrentUser: false,
    },
    {
      id: 2,
      sender: "Jane Smith",
      content: "I need help with processing a submission that has been pending for over a week.",
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      isCurrentUser: false,
    },
    {
      id: 3,
      sender: "You",
      content: "Could you provide the submission ID so I can look into it?",
      timestamp: new Date(Date.now() - 1700000).toISOString(),
      isCurrentUser: true,
    },
    {
      id: 4,
      sender: "Jane Smith",
      content: "Sure, it's SUB-2023-0042.",
      timestamp: new Date(Date.now() - 1600000).toISOString(),
      isCurrentUser: false,
    },
  ])
  const [newMessage, setNewMessage] = useState("")
  const scrollAreaRef = useRef(null)

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages])

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    const newMsg = {
      id: messages.length + 1,
      sender: "You",
      content: newMessage,
      timestamp: new Date().toISOString(),
      isCurrentUser: true,
    }

    setMessages([...messages, newMsg])
    setNewMessage("")

    // Simulate response after a delay
    setTimeout(() => {
      const responseMsg = {
        id: messages.length + 2,
        sender: "Jane Smith",
        content: "I'll check that submission and get back to you shortly.",
        timestamp: new Date().toISOString(),
        isCurrentUser: false,
      }
      setMessages((prevMessages) => [...prevMessages, responseMsg])
    }, 2000)
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  return (
    <Card className="h-[calc(100vh-12rem)]">
      <CardHeader>
        <CardTitle>Chat</CardTitle>
        <CardDescription>Communicate with other departments and staff</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-20rem)]" ref={scrollAreaRef}>
          <div className="space-y-4 p-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.isCurrentUser ? "justify-end" : "justify-start"}`}>
                <div
                  className={`flex max-w-[80%] items-start gap-2 ${
                    message.isCurrentUser ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={`/placeholder.svg?height=32&width=32&text=${message.sender.charAt(0)}`}
                      alt={message.sender}
                    />
                    <AvatarFallback>{message.sender.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div
                    className={`rounded-lg p-3 ${
                      message.isCurrentUser ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium">{message.sender}</span>
                      <span className="text-xs opacity-70">{formatTime(message.timestamp)}</span>
                    </div>
                    <p className="text-sm">{message.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter>
        <form onSubmit={handleSendMessage} className="flex w-full items-center space-x-2">
          <Input
            placeholder="Type your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="icon">
            <Send className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  )
}
