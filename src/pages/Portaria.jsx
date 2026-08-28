import { useState } from 'react';
import { UserPlus, Truck, Car, ArrowLeft } from 'lucide-react';
import PortariaMotoristaForm from '@/components/portaria/PortariaMotoristaForm';
import PortariaTransportadoraForm from '@/components/portaria/PortariaTransportadoraForm';
import PortariaVeiculoForm from '@/components/portaria/PortariaVeiculoForm';

const OPCOES = [
  {
    key: 'motorista',
    title: 'Motorista',
    desc: 'Pessoa · is_motorista',
    icon: UserPlus,
  },
  {
    key: 'transportadora',
    title: 'Transportadora',
    desc: 'Entidade Transportadora',
    icon: Truck,
  },
  {
    key: 'veiculo',
    title: 'Veículo / Placa',
    desc: 'Entidade Veículo',
    icon: Car,
  },
];

export default function Portaria() {
  const [sel, setSel] = useState(null);

  const renderForm = () => {
    if (sel === 'motorista') return <PortariaMotoristaForm />;
    if (sel === 'transportadora') return <PortariaTransportadoraForm />;
    if (sel === 'veiculo') return <PortariaVeiculoForm />;
    return null;
  };

  const selOpt = OPCOES.find((o) => o.key === sel);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto pb-24 md:pb-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Portaria</h1>
        <p className="text-sm text-muted-foreground">
          Cadastro rápido de motoristas, placas e transportadoras. Os dados são gravados no cadastro base e valem para todo o sistema.
        </p>
      </div>

      {!sel ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {OPCOES.map((o) => (
            <button
              key={o.key}
              onClick={() => setSel(o.key)}
              className="glass-tinted rounded-xl p-6 flex flex-col items-center text-center gap-3 hover:shadow-md hover:border-primary/40 transition-all"
            >
              <div className="p-3 rounded-xl bg-primary/15 text-primary">
                <o.icon className="w-7 h-7" />
              </div>
              <div>
                <h2 className="font-semibold">{o.title}</h2>
                <p className="text-xs text-muted-foreground">{o.desc}</p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="max-w-md mx-auto w-full">
          <button
            onClick={() => setSel(null)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar à seleção
          </button>
          <div className="glass-tinted rounded-xl p-4">
            <div className="flex items-center gap-3 pb-3 mb-3 border-b">
              <div className="p-2 rounded-lg bg-primary/15 text-primary">
                {selOpt && <selOpt.icon className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="font-semibold text-sm leading-tight">{selOpt?.title}</h2>
                <p className="text-xs text-muted-foreground">{selOpt?.desc}</p>
              </div>
            </div>
            {renderForm()}
          </div>
        </div>
      )}
    </div>
  );
}