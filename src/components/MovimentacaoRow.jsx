import { useRef } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { ArrowDownCircle, ArrowUpCircle, Undo2, Trash2 } from 'lucide-react';
import {
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getNome } from '@/lib/estoqueFilters';
import { formatQtd } from '@/lib/format';
import ValidadeBadge from '@/components/ValidadeBadge';

const THRESHOLD = -90;

export default function MovimentacaoRow({
  mov,
  isSelected,
  onSelect,
  onSwipeDelete,
  produtos,
  setores,
  maquinas,
  gavetas,
}) {
  const x = useMotionValue(0);
  const bgOpacity = useTransform(x, [THRESHOLD, 0], [1, 0]);
  const iconOpacity = useTransform(x, [THRESHOLD, -20], [1, 0]);
  const draggedRef = useRef(false);

  function handleClick() {
    if (draggedRef.current) return;
    onSelect();
  }

  return (
    <motion.tr
      drag="x"
      style={{ x }}
      dragConstraints={{ left: THRESHOLD, right: 0 }}
      dragElastic={0.06}
      dragSnapToOrigin
      onDragStart={() => { draggedRef.current = true; }}
      onDragEnd={(e, info) => {
        if (info.offset.x < THRESHOLD) {
          onSwipeDelete(mov);
        }
        setTimeout(() => { draggedRef.current = false; }, 60);
      }}
      onClick={handleClick}
      className={`cursor-pointer transition-colors relative ${isSelected ? 'bg-accent' : 'hover:bg-muted/50'}`}
    >
      <td className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
        <motion.div
          style={{ opacity: iconOpacity }}
          className="flex items-center gap-1 text-destructive font-medium text-sm"
        >
          <Trash2 className="w-4 h-4" /> Excluir
        </motion.div>
      </td>
      <motion.td
        style={{ opacity: bgOpacity }}
        className="absolute inset-0 bg-red-50 dark:bg-red-950/40 pointer-events-none"
      />
      <TableCell className="text-sm whitespace-nowrap relative z-10">
        {mov.data ? new Date(mov.data).toLocaleString('pt-BR') : '—'}
      </TableCell>
      <TableCell className="font-medium text-sm relative z-10">{mov.nome_produto || '—'}</TableCell>
      <TableCell className="text-right font-semibold tabular-nums relative z-10">
        {formatQtd(mov.quantidade || 0)}{' '}
        <span className="text-xs text-muted-foreground font-normal">{produtos.find((p) => p.id === mov.produto_id)?.unidade || ''}</span>
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground relative z-10">{mov.codigo}</TableCell>
      <TableCell className="text-xs relative z-10">
        {mov.numero_nf ? (
          <span className="font-mono" title={mov.chave_acesso ? `Chave: ${mov.chave_acesso}` : undefined}>NF {mov.numero_nf}</span>
        ) : null}
        {mov.fornecedor ? <span className="block text-muted-foreground truncate max-w-[140px]">{mov.fornecedor}</span> : null}
        {!mov.numero_nf && !mov.fornecedor ? '—' : null}
      </TableCell>
      <TableCell className="relative z-10">
        <div className="flex flex-col gap-1">
          {mov.tipo === 'entrada' ? (
            <Badge className="bg-green-100 text-green-700 border-green-200 gap-1 w-fit">
              <ArrowDownCircle className="w-3 h-3" /> Entrada
            </Badge>
          ) : mov.tipo === 'saida' ? (
            <Badge className="bg-red-100 text-red-700 border-red-200 gap-1 w-fit">
              <ArrowUpCircle className="w-3 h-3" /> Saída
            </Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1 w-fit">
              <Undo2 className="w-3 h-3" /> Estorno
            </Badge>
          )}
          {mov.estornada === true && (
            <span className="text-[10px] text-amber-600 font-medium">estornada</span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-sm relative z-10">{getNome(mov.setor_id, setores)}</TableCell>
      <TableCell className="relative z-10"><ValidadeBadge dataValidade={mov.data_validade} /></TableCell>
      <TableCell className="text-center relative z-10">
        {isSelected && (
          <Undo2 className="w-4 h-4 text-destructive mx-auto" />
        )}
      </TableCell>
    </motion.tr>
  );
}