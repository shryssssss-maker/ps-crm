"use client"

import { useEffect, useRef } from "react"
import { gsap } from "gsap"
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import L from "leaflet"

type Task = {
  id: string
  lat: number
  lng: number
  status: "center" | "orange" | "progress" | "complete" | "rejected"
}

const tasks: Task[] = [
  { id: "CMP-8821", lat: 26.9124, lng: 75.7873, status: "center" },
  { id: "CMP-8823", lat: 26.9145, lng: 75.7891, status: "orange" },
  { id: "CMP-8824", lat: 26.9104, lng: 75.7851, status: "progress" },
  { id: "CMP-8825", lat: 26.9091, lng: 75.7902, status: "complete" },
  { id: "CMP-8826", lat: 26.9118, lng: 75.7832, status: "rejected" },
]

function getColor(status: string) {

  switch (status) {
    case "center":
      return "#d32f2f"
    case "orange":
      return "#f57c00"
    case "progress":
      return "#fbc02d"
    case "complete":
      return "#2e7d32"
    case "rejected":
      return "#c62828"
    default:
      return "#999"
  }

}

function createIcon(color: string) {

  return new L.DivIcon({
    className: "",
    html: `
      <div style="
        width:18px;
        height:18px;
        border-radius:50%;
        background:${color};
        border:3px solid white;
        box-shadow:0 0 6px rgba(0,0,0,0.25);
      "></div>
    `,
  })

}

export default function TaskMapWidget() {

  const mapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {

    if (!mapRef.current) return

    gsap.fromTo(
      mapRef.current,
      {
        opacity: 0,
        scale: 0.96
      },
      {
        opacity: 1,
        scale: 1,
        duration: 0.5,
        ease: "power2.out"
      }
    )

  }, [])

  return (

    <div
      ref={mapRef}
      className="bg-white border rounded-xl p-4 shadow-sm relative"
    >

      <h2 className="text-lg font-semibold mb-3">
        Nearby Tasks
      </h2>

      <div className="relative h-[260px] rounded-lg overflow-hidden">

        <MapContainer
          center={[26.9124, 75.7873]}
          zoom={14}
          scrollWheelZoom={false}
          className="h-full w-full"
        >

          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap"
          />

          {tasks.map((task) => (

            <Marker
              key={task.id}
              position={[task.lat, task.lng]}
              icon={createIcon(getColor(task.status))}
            >

              <Popup>

                <div className="text-sm">

                  <div className="font-semibold">
                    #{task.id}
                  </div>

                  <div className="mt-2 flex gap-2">

                    <button className="px-2 py-1 text-xs border rounded hover:bg-gray-100">
                      Navigate
                    </button>

                    <button className="px-2 py-1 text-xs border rounded hover:bg-gray-100">
                      View Task
                    </button>

                  </div>

                </div>

              </Popup>

            </Marker>

          ))}

        </MapContainer>

        {/* Floating Controls */}

        <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2 pointer-events-auto">

          <button className="bg-white shadow px-3 py-1 text-sm rounded-md border hover:bg-gray-50">
            Navigate
          </button>

          <button className="bg-white shadow px-3 py-1 text-sm rounded-md border hover:bg-gray-50">
            View Task
          </button>

        </div>

        {/* Legend */}

        <div className="absolute bottom-3 right-3 z-[1000] bg-white border rounded-lg shadow-sm p-3 text-xs pointer-events-auto">

          <div className="font-semibold mb-2">
            Legend
          </div>

          <div className="flex items-center gap-2 mb-1">
            <span className="w-3 h-3 rounded-full bg-red-600"></span>
            Me
          </div>

          <div className="flex items-center gap-2 mb-1">
            <span className="w-3 h-3 rounded-full bg-orange-500"></span>
            Recent
          </div>

          <div className="flex items-center gap-2 mb-1">
            <span className="w-3 h-3 rounded-full bg-yellow-400"></span>
            In Progress
          </div>

          <div className="flex items-center gap-2 mb-1">
            <span className="w-3 h-3 rounded-full bg-green-600"></span>
            Completed
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-400"></span>
            Rejected
          </div>

        </div>

      </div>

    </div>
  )
}