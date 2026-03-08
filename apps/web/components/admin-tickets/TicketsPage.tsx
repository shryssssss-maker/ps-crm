"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Pagination from "@/components/admin-tickets/Pagination"
import TicketFilters from "@/components/admin-tickets/TicketFilters"
import TicketSearch from "@/components/admin-tickets/TicketSearch"
import TicketsHeader from "@/components/admin-tickets/TicketsHeader"
import TicketsTable from "@/components/admin-tickets/TicketsTable"
import { PAGE_SIZE, initialFilters, type TicketFiltersState, type TicketRecord } from "@/components/admin-tickets/types"
import { supabase } from "@/src/lib/supabase"
import type { Enums } from "@/src/types/database.types"

type CategoryRelation = {
  name: string | null
}

type ProfileRelation = {
  full_name: string | null
  department: string | null
}

type TicketRow = {
  id: string
  ticket_id: string
  title: string
  address_text: string | null
  ward_name: string | null
  city: string
  status: Enums<"complaint_status">
  severity: Enums<"severity_level">
  created_at: string
  assigned_department: string | null
  categories: CategoryRelation | CategoryRelation[] | null
  authority: ProfileRelation | ProfileRelation[] | null
  worker: ProfileRelation | ProfileRelation[] | null
}

type Option = {
  label: string
  value: string
}

function firstRelation<T>(value: T | T[] | null): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function normalizeTicket(row: TicketRow): TicketRecord {
  const category = firstRelation(row.categories)
  const authorityProfile = firstRelation(row.authority)
  const workerProfile = firstRelation(row.worker)

  const location = [row.ward_name, row.address_text, row.city].filter(Boolean).join(", ") || "Location unavailable"

  const authority =
    row.assigned_department ??
    authorityProfile?.department ??
    authorityProfile?.full_name ??
    "Unassigned"

  return {
    id: row.id,
    ticketId: row.ticket_id,
    title: row.title,
    category: category?.name ?? "Uncategorized",
    location,
    status: row.status,
    severity: row.severity,
    createdAt: row.created_at,
    authority,
    worker: workerProfile?.full_name ?? "Unassigned",
  }
}

const categoryExamples = [
  "Road Damage",
  "Garbage Collection",
  "Water Leakage",
  "Streetlight Failure",
  "Public Safety",
]

const authorityExamples = [
  "Municipal Corporation",
  "Electricity Board",
  "Water Supply Department",
  "Road Maintenance Authority",
  "Police Department",
]

export default function TicketsPage() {
  const [search, setSearch] = useState("")
  const [filters, setFilters] = useState<TicketFiltersState>(initialFilters)
  const [tickets, setTickets] = useState<TicketRecord[]>([])
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [now, setNow] = useState(() => new Date())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryOptions, setCategoryOptions] = useState<Option[]>([
    { label: "All", value: "all" },
    ...categoryExamples.map((name) => ({ label: name, value: name })),
  ])
  const [authorityOptions, setAuthorityOptions] = useState<Option[]>([
    { label: "All", value: "all" },
    ...authorityExamples.map((name) => ({ label: name, value: name })),
  ])

  const loadFilterOptions = useCallback(async () => {
    const [{ data: categoriesData }, { data: departmentsData }] = await Promise.all([
      supabase.from("categories").select("name").eq("is_active", true).order("name", { ascending: true }),
      supabase.from("complaints").select("assigned_department").not("assigned_department", "is", null).limit(500),
    ])

    const categoryNames = new Set<string>(categoryExamples)
    const authorities = new Set<string>(authorityExamples)

    for (const item of categoriesData ?? []) {
      if (item.name) categoryNames.add(item.name)
    }

    for (const item of departmentsData ?? []) {
      if (item.assigned_department) authorities.add(item.assigned_department)
    }

    setCategoryOptions([
      { label: "All", value: "all" },
      ...Array.from(categoryNames).sort((a, b) => a.localeCompare(b)).map((name) => ({ label: name, value: name })),
    ])

    setAuthorityOptions([
      { label: "All", value: "all" },
      ...Array.from(authorities).sort((a, b) => a.localeCompare(b)).map((name) => ({ label: name, value: name })),
    ])
  }, [])

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    setError(null)

    const trimmedSearch = search.trim()
    const rangeFrom = (page - 1) * PAGE_SIZE
    const rangeTo = rangeFrom + PAGE_SIZE - 1

    let query = supabase
      .from("complaints")
      .select(
        "id, ticket_id, title, address_text, ward_name, city, status, severity, created_at, assigned_department, categories(name), authority:profiles!complaints_assigned_officer_id_fkey(full_name, department), worker:profiles!complaints_assigned_worker_id_fkey(full_name, department)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })

    if (filters.status === "pending") {
      query = query.in("status", ["submitted", "under_review", "assigned"])
    } else if (filters.status !== "all") {
      query = query.eq("status", filters.status)
    }

    if (filters.priority !== "all") {
      const severity =
        filters.priority === "low"
          ? "L1"
          : filters.priority === "medium"
            ? "L2"
            : filters.priority === "high"
              ? "L3"
              : "L4"
      query = query.eq("severity", severity)
    }

    if (filters.authority !== "all") {
      query = query.eq("assigned_department", filters.authority)
    }

    if (trimmedSearch) {
      const safe = trimmedSearch.replace(/,/g, " ")
      query = query.or(
        `ticket_id.ilike.%${safe}%,title.ilike.%${safe}%,address_text.ilike.%${safe}%,ward_name.ilike.%${safe}%,city.ilike.%${safe}%`,
      )
    }

    query = query.range(rangeFrom, rangeTo)

    const { data, error: ticketError, count } = await query

    if (ticketError) {
      setTickets([])
      setTotalCount(0)
      setError(ticketError.message || "Failed to fetch tickets")
      setLoading(false)
      return
    }

    let nextTickets = (data ?? []).map((row) => normalizeTicket(row as unknown as TicketRow))

    if (filters.category !== "all") {
      nextTickets = nextTickets.filter((ticket) => ticket.category === filters.category)
    }

    if (filters.authority !== "all") {
      nextTickets = nextTickets.filter((ticket) => ticket.authority === filters.authority)
    }

    if (trimmedSearch) {
      const token = trimmedSearch.toLowerCase()
      nextTickets = nextTickets.filter((ticket) => {
        const blob = `${ticket.ticketId} ${ticket.title} ${ticket.location} ${ticket.category}`.toLowerCase()
        return blob.includes(token)
      })
    }

    setTickets(nextTickets)
    setTotalCount(count ?? 0)
    setLoading(false)
  }, [filters, page, search])

  useEffect(() => {
    void loadFilterOptions()
  }, [loadFilterOptions])

  useEffect(() => {
    void fetchTickets()
  }, [fetchTickets])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const totalPages = useMemo(() => {
    if (totalCount <= 0) return 1
    return Math.ceil(totalCount / PAGE_SIZE)
  }, [totalCount])

  return (
    <section className="space-y-4 rounded-2xl border border-[#d8cfbe] bg-[#f4efe5] p-4 text-[#27221d] shadow-sm">
      <TicketsHeader now={now} />
      <TicketSearch
        value={search}
        onChange={(next) => {
          setSearch(next)
          setPage(1)
        }}
      />
      <TicketFilters
        filters={filters}
        categoryOptions={categoryOptions}
        authorityOptions={authorityOptions}
        onChange={(next) => {
          setFilters(next)
          setPage(1)
        }}
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <TicketsTable tickets={tickets} />

      <Pagination page={page} totalPages={totalPages} totalCount={totalCount} pageSize={PAGE_SIZE} onPageChange={setPage} />

      <div className="flex justify-end pt-2 text-sm text-[#4b433b]">
        <p>Platform Version 3.1 - National Deployment - Government of India</p>
      </div>

      {loading ? (
        <p className="text-sm text-[#5f554c]">Loading tickets...</p>
      ) : (
        <p className="text-sm text-[#5f554c]">Data synced from Supabase.</p>
      )}
    </section>
  )
}
