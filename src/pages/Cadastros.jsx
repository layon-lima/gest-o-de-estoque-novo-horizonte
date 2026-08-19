import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SetorManager from '@/components/cadastros/SetorManager';
import MaquinaManager from '@/components/cadastros/MaquinaManager';
import GavetaManager from '@/components/cadastros/GavetaManager';
import ProdutosManager from '@/components/cadastros/ProdutosManager';

export default function Cadastros() {
  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <header>
        <h1 className="text-2xl font-bold">Cadastros</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie produtos, setores, máquinas e gavetas</p>
      </header>
      <Tabs defaultValue="produtos">
        <TabsList>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="setores">Setores</TabsTrigger>
          <TabsTrigger value="maquinas">Máquinas</TabsTrigger>
          <TabsTrigger value="gavetas">Gavetas</TabsTrigger>
        </TabsList>
        <TabsContent value="produtos">
          <ProdutosManager />
        </TabsContent>
        <TabsContent value="setores">
          <SetorManager />
        </TabsContent>
        <TabsContent value="maquinas">
          <MaquinaManager />
        </TabsContent>
        <TabsContent value="gavetas">
          <GavetaManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}