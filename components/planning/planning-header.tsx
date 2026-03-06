"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signOut } from "firebase/auth"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Bell, LogOut, Menu, Settings, User } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"

interface PlanningHeaderProps {
  unreadNotifications: number
  onToggleSubmissionType: () => void
  submissionType: string
}

export default function PlanningHeader({
  unreadNotifications,
  onToggleSubmissionType,
  submissionType,
}: PlanningHeaderProps) {
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)


  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2 md:gap-4">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[240px] sm:w-[300px]">
              <nav className="flex flex-col gap-4 mt-8">
                <Link
                  href="/dashboard/planning"
                  className="text-sm font-medium transition-colors hover:text-primary"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Dashboard
                </Link>
                <Link
                  href="/dashboard/planning/submissions"
                  className="text-sm font-medium transition-colors hover:text-primary"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Submissions
                </Link>
                <Link
                  href="/dashboard/planning/sitemap"
                  className="text-sm font-medium transition-colors hover:text-primary"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Site Map
                </Link>
                <Link
                  href="/dashboard/planning/reports"
                  className="text-sm font-medium transition-colors hover:text-primary"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Reports
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
          <Link href="/dashboard/planning" className="flex items-center gap-2">
            <span className="font-bold text-xl">DOAS</span>
            <Badge variant="outline">{submissionType}</Badge>
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-6">
          <Link href="/dashboard/planning" className="text-sm font-medium transition-colors hover:text-primary">
            Dashboard
          </Link>
          <Link
            href="/dashboard/planning/submissions"
            className="text-sm font-medium transition-colors hover:text-primary"
          >
            Submissions
          </Link>
          <Link href="/dashboard/planning/sitemap" className="text-sm font-medium transition-colors hover:text-primary">
            Site Map
          </Link>
          <Link href="/dashboard/planning/reports" className="text-sm font-medium transition-colors hover:text-primary">
            Reports
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => router.push("/dashboard/planning?tab=notifications")}
          >
            <Bell className="h-5 w-5" />
            {unreadNotifications > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
                {unreadNotifications}
              </span>
            )}
            <span className="sr-only">Notifications</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="/placeholder.svg?height=32&width=32" alt="Planning Staff" />
                  <AvatarFallback>PD</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/dashboard/planning/profile")}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/dashboard/planning/settings")}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleSubmissionType}>
                <Settings className="mr-2 h-4 w-4" />
                Switch to {submissionType === "First-Party" ? "Third-Party" : "First-Party"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem >
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
