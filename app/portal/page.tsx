"use client"

import * as React from "react"
import { Bell, CalendarDays, FileBadge2, FilePlus2, FileText, LayoutDashboard, Megaphone, Signpost, UserRound } from "lucide-react"
import { practitionerAudience } from "@/lib/workflow"
import { DashboardShell, type ShellNavItem } from "@/components/dashboard/shell"
import { NotificationsPanel } from "@/components/dashboard/notifications-panel"
import { PageHeading } from "@/components/dashboard/kit"
import { usePortal } from "@/components/auth/portal-context"
import type { Announcement } from "@/components/shared/announcements-panel"
import { ApplicationWizard } from "@/components/portal/application-wizard"
import { ApplicationsPanel } from "@/components/portal/applications-panel"
import { PortalAnnouncements, PortalDocuments, PortalMeetings, PortalOverview, PortalProfile, PortalSites } from "@/components/portal/portal-panels"
import { needsPractitioner, useOpenAnnouncements, usePortalApplications } from "@/components/portal/use-portal-data"

type AnnouncementRow = Announcement & { id: string }

export default function PractitionerPortal() {
  const { portal, profile } = usePortal()
  const [tab, setTab] = React.useState("overview")
  const [applyFor, setApplyFor] = React.useState<AnnouncementRow | null>(null)
  const [focus, setFocus] = React.useState<string | null>(null)

  const apps = usePortalApplications()
  const announcements = useOpenAnnouncements()
  const actionCount = apps.rows.filter(needsPractitioner).length

  const audience = portal ? practitionerAudience(portal.uid) : "none"

  const nav: ShellNavItem[] = [
    { value: "overview", label: "Dashboard", icon: LayoutDashboard },
    { value: "announcements", label: "New sites", icon: Megaphone, badge: announcements.rows.length },
    { value: "apply", label: "New application", icon: FilePlus2 },
    { value: "applications", label: "My applications", icon: FileText, badge: actionCount },
    { value: "documents", label: "Letters & certificates", icon: FileBadge2 },
    { value: "sites", label: "My sites", icon: Signpost },
    { value: "meetings", label: "Meetings", icon: CalendarDays },
    { value: "profile", label: "My file", icon: UserRound },
    { value: "notifications", label: "Notifications", icon: Bell },
  ]

  const startApplication = (a: AnnouncementRow | null) => {
    setApplyFor(a)
    setTab("apply")
  }

  const openApplication = (submissionId: string) => {
    setFocus(submissionId)
    setTab("applications")
  }

  return (
    <DashboardShell
      variant="portal"
      audience={audience}
      unitName={profile?.companyName ?? "Practitioner"}
      unitCaption="Practitioner portal"
      accountName={profile?.companyName}
      nav={nav}
      active={tab}
      onNavigate={(v) => {
        if (v === "apply") setApplyFor(null)
        if (v !== "applications") setFocus(null)
        setTab(v)
      }}
    >
      {tab === "overview" ? <PortalOverview onApply={startApplication} onOpenApplication={openApplication} onNavigate={setTab} /> : null}

      {tab === "announcements" ? (
        <div className="space-y-5">
          <PageHeading title="New sites" description="Sites DOAS has opened for application. Apply and the site details are filled in for you." />
          <PortalAnnouncements onApply={startApplication} />
        </div>
      ) : null}

      {tab === "apply" ? (
        <div className="space-y-5">
          <PageHeading
            title="New application"
            description="Your company details come from your DOAS file. Upload the photo montage, pay the application fee through Remita and submit."
          />
          <ApplicationWizard
            key={applyFor?.id ?? "own-site"}
            announcement={applyFor}
            onCancel={() => setTab("overview")}
            onDone={(submissionId) => {
              setApplyFor(null)
              openApplication(submissionId)
            }}
          />
        </div>
      ) : null}

      {tab === "applications" ? (
        <div className="space-y-5">
          <PageHeading title="My applications" description="Follow each application through the Directorate and act when it's your turn." />
          <ApplicationsPanel onNew={() => startApplication(null)} focus={focus} />
        </div>
      ) : null}

      {tab === "documents" ? (
        <div className="space-y-5">
          <PageHeading title="Letters & certificates" description="Documents request letters, e-receipts, setting-out certificates and approval letters." />
          <PortalDocuments />
        </div>
      ) : null}

      {tab === "sites" ? (
        <div className="space-y-5">
          <PageHeading title="My sites" description="Structures on your DOAS practitioner file." />
          <PortalSites />
        </div>
      ) : null}

      {tab === "meetings" ? (
        <div className="space-y-5">
          <PageHeading title="Meetings" description="Request a meeting with the Director. Customer Service screens every request first." />
          <PortalMeetings />
        </div>
      ) : null}

      {tab === "profile" || tab === "settings" ? <PortalProfile /> : null}
      {tab === "notifications" ? <NotificationsPanel audience={audience} /> : null}
    </DashboardShell>
  )
}
