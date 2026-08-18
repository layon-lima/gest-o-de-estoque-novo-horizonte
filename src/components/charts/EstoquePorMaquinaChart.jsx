import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

export default function EstoquePorMaquinaChart({ produtos, maquinas }) {
  const data = maquinas
    .map((m) => ({
      name: m.nome?.length > 14 ? m.nome.substring(0, 14) + '…' : m.nome,
      quantidade: produtos
        .filter((p) => p.maquina_id === m.id)
        .reduce((sum, p) => sum + (p.quantidade || 0), 0),
    }))
    .filter((d) => d.quantidade > 0);

  if (!data.length)
    return (
      <p className="text-sm text-muted-foreground text-center py-12">
        Sem dados para exibir
      </p>
    );

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11 }}
          interval={0}
          angle={-15}
          textAnchor="end"
          height={50}
        />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value) => [`${value} itens`, 'Quantidade']}
          contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
        />
        <Bar
          dataKey="quantidade"
          fill="hsl(var(--primary))"
          radius={[6, 6, 0, 0]}
          maxBarSize={50}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}