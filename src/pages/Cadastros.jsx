import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { base44 } from '@/api/base44Client';
import SetorManager from '@/components/cadastros/SetorManager';
import MaquinaManager from '@/components/cadastros/MaquinaManager';
import GavetaManager from '@/components/cadastros/GavetaManager';

export default function Cadastros() {
  const [maquinas, setMaquinas] = useState([]);

  useEffect(() => {
    base44.entities.Maquina.list().then(setMaquinas);
  }, []);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <header>
        <h1 className="text-2xl font-bold">Cadastros</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie setores, máquinas e gavetas</p>
      </header>
      <Tabs defaultValue="setores">
        <TabsList>
          <TabsTrigger value="setores">Setores</TabsTrigger>
          <TabsTrigger value="maquinas">Máquinas</TabsTrigger>
          <TabsTrigger value="gavetas">Gavetas</TabsTrigger>
        </TabsList>
        <TabsContent value="setores">
          <SetorManager />
        </TabsContent>
        <TabsContent value="maquinas">
          <MaquinaManager />
        </TabsContent>
        <TabsContent value="gavetas">
          <GavetaManager maquinas={maquinas} />
        </TabsContent>
      </Tabs>
    </div>
  );
}