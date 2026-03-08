import PriorityBadge from "@/components/admin-tickets/PriorityBadge"
import StatusBadge from "@/components/admin-tickets/StatusBadge"
import TicketActions from "@/components/admin-tickets/TicketActions"
import { formatRelativeCreated } from "@/components/admin-tickets/formatters"
import type { TicketRecord } from "@/components/admin-tickets/types"

type TicketRowProps = {
  ticket: TicketRecord
}

export default function TicketRow({ ticket }: TicketRowProps) {
  return (
    <tr className="border-t border-[#ded6cb] align-top">
      <td className="px-3 py-4 text-sm font-medium text-[#332d28]">{ticket.ticketId}</td>
      <td className="px-3 py-4 text-sm font-semibold text-[#29231f]">{ticket.title}</td>
      <td className="px-3 py-4 text-sm text-[#332d28]">{ticket.category}</td>
      <td className="px-3 py-4 text-sm text-[#332d28]">{ticket.location}</td>
      <td className="px-3 py-4"><StatusBadge status={ticket.status} /></td>
      <td className="px-3 py-4"><PriorityBadge severity={ticket.severity} /></td>
      <td className="px-3 py-4 text-sm text-[#332d28]">{formatRelativeCreated(ticket.createdAt)}</td>
      <td className="px-3 py-4 text-sm text-[#332d28]">{ticket.authority}</td>
      <td className="px-3 py-4 text-sm text-[#332d28]">{ticket.worker}</td>
      <td className="px-3 py-4"><TicketActions ticketId={ticket.ticketId} /></td>
    </tr>
  )
}
