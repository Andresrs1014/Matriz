import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { QUADRANT_CONFIG } from "@/lib/constants"
import type { QuadrantSummary } from "@/types/matrix"

interface QuadrantBarChartProps {
  data: QuadrantSummary[]
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="glass-card px-3 py-2 text-xs">
      <p className="text-white font-semibold">{d.label}</p>
      <p className="text-slate-400">{d.count} proyecto{d.count !== 1 ? "s" : ""}</p>
    </div>
  )
}

export default function QuadrantBarChart({ data }: QuadrantBarChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    label: QUADRANT_CONFIG[d.quadrant]?.label ?? d.quadrant,
    color: QUADRANT_CONFIG[d.quadrant]?.color ?? "#94a3b8",
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} barCategoryGap="30%">
        <XAxis
          dataKey="label"
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          width={24}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(59,130,246,0.05)" }} />
        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.color} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
