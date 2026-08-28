import { UserPlus, Truck, Car } from 'lucide-react';
import PortariaMotoristaForm from '@/components/portaria/PortariaMotoristaForm';
import PortariaTransportadoraForm from '@/components/portaria/PortariaTransportadoraForm';
import PortariaVeiculoForm from '@/components/portaria/PortariaVeiculoForm';

function Card({ icon: Icon, title, desc, children }) {
  return (
    <div className="glass-tinted rounded-xl p-4 flex flex-col">
      <div className="flex items-center gap-3 pb-3 mb-3 border-b">
        <div className="p-2 rounded-lg bg-primary/15 text-primary">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-semibold text-sm leading-tight">{title}</h2>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function Portaria() {
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto pb-24 md:pb-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Portaria</h1>
        <p className="text-sm text-muted-foreground">
          Cadastro rápido de motoristas, placas e transportadoras. Os dados são gravados no cadastro base e valem para todo o sistema.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card icon={UserPlus} title="Motorista" desc="Pessoa · is_motorista">
          <PortariaMotoristaForm />
        </Card>
        <Card icon={Truck} title="Transportadora" desc="Entidade Transportadora">
          <PortariaTransportadoraForm />
        </Card>
        <Card icon={Car} title="Veículo / Placa" desc="Entidade Veículo">
          <PortariaVeiculoForm />
        </Card>
      </div>
    </div>
  );
}