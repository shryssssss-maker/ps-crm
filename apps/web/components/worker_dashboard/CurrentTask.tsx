"use client"

import { useEffect, useRef, useState } from "react"
import { gsap } from "gsap"
// import { supabase } from "@/src/lib/supabase"

type Task = {
  id: string
  category: string
  location: string
  priority: string
  status: string
}

const mockTasks: Task[] = [
  { id: "CMP-8825", category: "Water Leakage", location: "Sector 8", priority: "L3", status: "submitted" },
  { id: "CMP-8826", category: "Water Leakage", location: "Sector 8", priority: "L2", status: "assigned" },
  { id: "CMP-8827", category: "Water Leakage", location: "Sector 9", priority: "L4", status: "in_progress" },
  { id: "CMP-8828", category: "Water Leakage", location: "Sector 10", priority: "L1", status: "resolved" },
  { id: "CMP-8829", category: "Water Leakage", location: "Sector 12", priority: "L2", status: "rejected" },
]

function statusColor(status: string) {

  switch (status) {
    case "assigned":
      return "bg-blue-100 text-blue-700"
    case "in_progress":
      return "bg-orange-100 text-orange-700"
    case "resolved":
      return "bg-green-100 text-green-700"
    case "rejected":
      return "bg-red-100 text-red-700"
    default:
      return "bg-gray-100 text-gray-700"
  }

}

export default function AssignedTasksTable() {

  const tableRef = useRef<HTMLDivElement>(null)

  const [tasks, setTasks] = useState<Task[]>(mockTasks)

  // ------------------------------
  // SUPABASE LOAD TASKS (COMMENTED FOR DEV)
  // ------------------------------

  /*
  async function loadTasks() {

    const { data: userData } = await supabase.auth.getUser()
    const workerId = userData?.user?.id
    if (!workerId) return

    const { data } = await supabase
      .from("complaints")
      .select(`
        id,
        address_text,
        status,
        effective_severity,
        categories(name)
      `)
      .eq("assigned_worker_id", workerId)
      .order("created_at", { ascending: false })
      .limit(5)

    if (!data) return

    const mapped = data.map((c: any) => ({
      id: c.id,
      category: c.categories?.name ?? "General",
      location: c.address_text ?? "Unknown",
      priority: c.effective_severity,
      status: c.status
    }))

    setTasks(mapped)
  }
  */

  // ------------------------------
  // SAFE ACCEPT TASK (WITH WORKER CHECK)
  // ------------------------------

  async function acceptTask(taskId: string) {

    // DEV MODE: simulate acceptance
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: "assigned" } : t
      )
    )

    // ------------------------------
    // PRODUCTION LOGIC (COMMENTED)
    // ------------------------------

    /*
    const { data: userData } = await supabase.auth.getUser()
    const workerId = userData?.user?.id
    if (!workerId) return

    // Check worker availability
    const { data: worker } = await supabase
      .from("worker_profiles")
      .select("availability")
      .eq("id", workerId)
      .single()

    if (worker?.availability !== "free") {
      alert("You already have an active task.")
      return
    }

    // SAFE ASSIGNMENT (best done via RPC)
    await supabase.rpc("assign_complaint_to_worker", {
      complaint_id: taskId,
      worker_id: workerId
    })

    loadTasks()
    */

  }

  useEffect(() => {

    // loadTasks()   // enable in production

  }, [])

  useEffect(() => {

    if (!tableRef.current) return

    gsap.fromTo(
      tableRef.current.querySelectorAll("tbody tr"),
      {
        opacity: 0,
        y: 15
      },
      {
        opacity: 1,
        y: 0,
        duration: 0.4,
        stagger: 0.08,
        ease: "power2.out"
      }
    )

  }, [tasks])

  return (
    <div
      ref={tableRef}
      className="bg-white border rounded-xl p-5 shadow-sm"
    >

      <h2 className="text-lg font-semibold mb-4">
        Assigned Tasks Preview
      </h2>

      <div className="overflow-x-auto">

        <table className="w-full text-sm">

          <thead className="text-gray-500 border-b">

            <tr>
              <th className="text-left py-2">Complaint ID</th>
              <th className="text-left py-2">Category</th>
              <th className="text-left py-2">Location</th>
              <th className="text-left py-2">Priority</th>
              <th className="text-left py-2">Status</th>
              <th className="text-left py-2">Action</th>
            </tr>

          </thead>

          <tbody>

            {tasks.map((task) => (

              <tr key={task.id} className="border-b last:border-none">

                <td className="py-3">{task.id}</td>

                <td>{task.category}</td>

                <td>{task.location}</td>

                <td className="font-medium">{task.priority}</td>

                <td>

                  <span
                    className={`px-2 py-1 rounded-full text-xs ${statusColor(task.status)}`}
                  >
                    {task.status}
                  </span>

                </td>

                <td className="space-x-2">

                  {task.status === "submitted" && (
                    <button
                      onClick={() => acceptTask(task.id)}
                      className="px-3 py-1 text-sm rounded-md border hover:bg-gray-100"
                    >
                      Accept
                    </button>
                  )}

                  <button
                    className="px-3 py-1 text-sm rounded-md border hover:bg-gray-100"
                  >
                    View
                  </button>

                  {task.status === "submitted" && (
                    <button
                      className="px-3 py-1 text-sm rounded-md border hover:bg-gray-100"
                    >
                      Reject
                    </button>
                  )}

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>
  )
}
// remove mockTasks
// uncomment loadTasks()
// uncomment supabase import
// uncomment RPC assignment