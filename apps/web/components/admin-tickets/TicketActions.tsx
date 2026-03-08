import { AlertTriangle, Eye, UserPlus } from "lucide-react"

type TicketActionsProps = {
  ticketId: string
}

export default function TicketActions({ ticketId }: TicketActionsProps) {
  const baseClass =
    "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#d6cec3] bg-[#faf8f4] text-[#5c544c] transition hover:bg-white"

  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label={`View ${ticketId}`} className={baseClass}>
        <Eye size={16} />
      </button>
      <button type="button" aria-label={`Assign ${ticketId}`} className={baseClass}>
        <UserPlus size={16} />
      </button>
      <button type="button" aria-label={`Escalate ${ticketId}`} className={baseClass}>
        <AlertTriangle size={16} />
      </button>
    </div>
  )
}
