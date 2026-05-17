// Renders a chart from the spec returned by the chat's `chart` tool call.
// Supports the three chart types the tool schema exposes: bar, line, pie.

import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

const COLORS = ['#E40000', '#374151', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];

export default function ChartFromSpec({ spec }) {
  if (!spec || !Array.isArray(spec.data) || !spec.data.length) return null;
  const { type, title, data, x_key = 'name', y_keys = ['value'] } = spec;

  const inner = (() => {
    if (type === 'pie') {
      return (
        <PieChart>
          <Pie data={data} dataKey={y_keys[0]} nameKey={x_key} innerRadius={40} outerRadius={80}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      );
    }
    if (type === 'line') {
      return (
        <LineChart data={data} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="#F3F4F6" vertical={false} />
          <XAxis dataKey={x_key} tick={{ fontSize: 11, fill: '#6B7280' }} />
          <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} allowDecimals={false} />
          <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {y_keys.map((k, i) => (
            <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={2.5} dot={{ r: 3 }} />
          ))}
        </LineChart>
      );
    }
    // default: bar
    return (
      <BarChart data={data} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="#F3F4F6" vertical={false} />
        <XAxis dataKey={x_key} tick={{ fontSize: 11, fill: '#6B7280' }} interval={0} angle={-25} textAnchor="end" height={60} />
        <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} allowDecimals={false} />
        <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {y_keys.map((k, i) => (
          <Bar key={k} dataKey={k} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    );
  })();

  return (
    <div className="my-3" data-testid="chart-from-spec">
      {title && <div className="text-xs font-semibold text-gray-700 mb-1">{title}</div>}
      <div className="rounded-md border border-gray-200 bg-white p-2">
        <ResponsiveContainer width="100%" height={240}>
          {inner}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
