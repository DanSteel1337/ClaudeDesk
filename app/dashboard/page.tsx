import { redirect } from "next/navigation"

export default function DashboardRootPage() {
  // This page should ideally redirect to the main dashboard section,
  // which is /dashboard/projects in our case.
  // The dashboard layout will provide the sidebar navigation.
  redirect("/dashboard/projects")

  // Or, if you want to keep a root dashboard page:
  // return (
  //   <div>
  //     <h1 className="text-3xl font-bold mb-4">Welcome to ClaudeDesk!</h1>
  //     <p className="text-lg text-muted-foreground">
  //       Select a project from the sidebar to get started, or create a new one.
  //     </p>
  //   </div>
  // )
}
