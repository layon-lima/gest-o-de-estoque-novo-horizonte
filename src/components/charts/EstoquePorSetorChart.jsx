import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const COLORS = [
  '#2E7D32', '#4CAF50', '#78C349', '#FFB81C',
  '#795548', '#a16207', '#65a30d', '#92400e',
];

export default function EstoquePorSetorChart({ produtos, setores }) {
  const data = setores
    .map((s) => ({
      name: s.nome,
      value: produtos
        .filter((p) => p.setor_id === s.id)
        .reduce((sum, p) => sum + (p.quantidade || 0), 0),
    }))
    .filter((d) => d.value > 0);

  if (!data.length)
    return (
      <p className="text-sm text-muted-foreground text-center py-12">
        Sem dados para exibir
      </p>
    );

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={85}
          innerRadius={45}
          paddingAngle={2}
          label={({ name, value }) => `${name}: ${value}`}
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [`${value} itens`, 'Quantidade']}
          contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}