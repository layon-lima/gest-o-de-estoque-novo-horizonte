import { Filter } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function FilterBar({ filtros, setFiltros, setores, maquinas, gavetas }) {
  const update = (key, value) =>
    setFiltros({ ...filtros, [key]: value === 'all' ? '' : value });

  return (
    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground shrink-0">
        <Filter className="w-4 h-4" />
        <span className="hidden sm:inline">Filtros:</span>
      </div>

      <Select
        value={filtros.setor_id || 'all'}
        onValueChange={(v) => update('setor_id', v)}
      >
        <SelectTrigger className="w-full sm:w-[160px] flex-1 sm:flex-none min-w-[140px]">
          <SelectValue placeholder="Setor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os setores</SelectItem>
          {setores.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filtros.estoque || 'all'}
        onValueChange={(v) => update('estoque', v)}
      >
        <SelectTrigger className="w-full sm:w-[140px] flex-1 sm:flex-none min-w-[140px]">
          <SelectValue placeholder="Estoque" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todo estoque</SelectItem>
          <SelectItem value="ALTO">Alto</SelectItem>
          <SelectItem value="BAIXO">Baixo</SelectItem>
          <SelectItem value="ZERADO">Zerado</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filtros.maquina_id || 'all'}
        onValueChange={(v) => update('maquina_id', v)}
      >
        <SelectTrigger className="w-full sm:w-[160px] flex-1 sm:flex-none min-w-[140px]">
          <SelectValue placeholder="Máquina" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as máquinas</SelectItem>
          {maquinas.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.codigo} — {m.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filtros.gaveta_id || 'all'}
        onValueChange={(v) => update('gaveta_id', v)}
      >
        <SelectTrigger className="w-full sm:w-[150px] flex-1 sm:flex-none min-w-[140px]">
          <SelectValue placeholder="Gaveta" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as gavetas</SelectItem>
          {gavetas.map((g) => (
            <SelectItem key={g.id} value={g.id}>
              {g.codigo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}