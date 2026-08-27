import { Filter } from 'lucide-react';
import SearchSelect from '@/components/SearchSelect';

export default function FilterBar({ filtros, setFiltros, setores, maquinas, gavetas, depositos }) {
  const update = (key, value) =>
    setFiltros({ ...filtros, [key]: value === 'all' ? '' : value });

  return (
    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground shrink-0">
        <Filter className="w-4 h-4" />
        <span className="hidden sm:inline">Filtros:</span>
      </div>

      <SearchSelect
        value={filtros.setor_id || 'all'}
        onChange={(v) => update('setor_id', v)}
        allLabel="Todos os setores"
        placeholder="Setor"
        className="w-full sm:w-[160px] flex-1 sm:flex-none min-w-[140px]"
        options={setores.map((s) => ({ value: s.id, label: s.nome }))}
      />

      <SearchSelect
        value={filtros.estoque || 'all'}
        onChange={(v) => update('estoque', v)}
        allLabel="Todo estoque"
        placeholder="Estoque"
        className="w-full sm:w-[140px] flex-1 sm:flex-none min-w-[140px]"
        options={[{ value: 'ALTO', label: 'Alto' }, { value: 'BAIXO', label: 'Baixo' }, { value: 'ZERADO', label: 'Zerado' }]}
      />

      {depositos && (
        <SearchSelect
          value={filtros.deposito_id || 'all'}
          onChange={(v) => update('deposito_id', v)}
          allLabel="Todos os depósitos"
          placeholder="Depósito"
          className="w-full sm:w-[170px] flex-1 sm:flex-none min-w-[140px]"
          options={depositos.map((d) => ({ value: d.id, label: `${d.numero}${d.nome ? ' — ' + d.nome : ''}` }))}
        />
      )}

      <SearchSelect
        value={filtros.maquina_id || 'all'}
        onChange={(v) => update('maquina_id', v)}
        allLabel="Todas as máquinas"
        placeholder="Máquina"
        className="w-full sm:w-[160px] flex-1 sm:flex-none min-w-[140px]"
        options={maquinas.map((m) => ({ value: m.id, label: `${m.codigo} — ${m.nome}` }))}
      />

      <SearchSelect
        value={filtros.gaveta_id || 'all'}
        onChange={(v) => update('gaveta_id', v)}
        allLabel="Todas as gavetas"
        placeholder="Gaveta"
        className="w-full sm:w-[150px] flex-1 sm:flex-none min-w-[140px]"
        options={gavetas.map((g) => ({ value: g.id, label: g.codigo }))}
      />
    </div>
  );
}