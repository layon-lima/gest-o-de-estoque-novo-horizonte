import { Usb, Settings, Globe, Scale } from 'lucide-react';
import { Image } from '@/components/ui/image';

const PASSOS = [
  {
    num: 1,
    titulo: 'Conexão Física',
    icon: Usb,
    imagem: 'https://media.base44.com/images/public/6a84b445f638bd5605381437/5af4efab5_generated_image.png',
    descricao:
      'Conecte o adaptador USB-RS232 em uma porta USB livre do computador. Em seguida, conecte a ponta DB9 (9 pinos) do cabo serial na saída serial da balança Toledo Prix.',
    dicas: [
      'No Windows, abra o Gerenciador de Dispositivos → "Portas (COM e LPT)" para confirmar que o adaptador foi reconhecido (ex.: "USB Serial Port COM3").',
      'Anote o número da porta COM — você selecionará esta porta ao conectar no navegador.',
      'Se o adaptador não aparecer, instale o driver do fabricante (geralmente Prolific ou FTDI).',
    ],
  },
  {
    num: 2,
    titulo: 'Configurar a Balança Toledo',
    icon: Settings,
    imagem: 'https://media.base44.com/images/public/6a84b445f638bd5605381437/f8574ce1a_generated_image.png',
    descricao:
      'Na balança Toledo Prix, entre no modo de programação e ajuste os parâmetros de comunicação serial para o protocolo Cougar p03 contínuo.',
    dicas: [
      'Pressione a tecla MODO, digite a senha 2011 e pressione MODO novamente para entrar no modo de configuração.',
      'Navegue até o parâmetro C-13 (canal) com a tecla ENTRAR e altere para SERIAL A.',
      'Navegue até C-14 (protocolo) e altere para P03 (Cougar p03 contínuo).',
      'Navegue até C-15 (baud rate) e altere para 9600.',
      'Confirme que o número de bits = 8, stop = 1 e transmissão cks (checksum) = habilitado.',
      'Pressione ENTRAR até o final para salvar todas as configurações.',
    ],
  },
  {
    num: 3,
    titulo: 'Autorizar no Navegador',
    icon: Globe,
    imagem: 'https://media.base44.com/images/public/6a84b445f638bd5605381437/8871e0f9c_generated_image.png',
    descricao:
      'No Microsoft Edge (ou Google Chrome), clique no botão "Conectar Balança" no painel acima. O navegador abrirá um popup para você selecionar a porta serial do adaptador USB-RS232.',
    dicas: [
      'Selecione a porta correspondente ao seu adaptador (anotada no Passo 1) e clique em "Conectar".',
      'O navegador pedirá permissão apenas na primeira vez — nas próximas visitas, a porta será lembrada.',
      'A Web Serial API só funciona no Chrome e Edge. Outros navegadores não são compatíveis.',
      'A página precisa ser acessada via HTTPS (o app já está em HTTPS).',
    ],
  },
  {
    num: 4,
    titulo: 'Testar a Leitura',
    icon: Scale,
    imagem: 'https://media.base44.com/images/public/6a84b445f638bd5605381437/76a64e24b_generated_image.png',
    descricao:
      'Com a balança conectada, posicione um peso conhecido sobre a plataforma e clique em "Testar Leitura" no painel acima. O peso deve aparecer no display.',
    dicas: [
      'Se o peso não aparecer, verifique se a balança está ligada e com peso estável.',
      'Se aparecer "timeout", a balança pode estar em protocolo errado — refaça o Passo 2.',
      'Se aparecer "timeout", confirme que o protocolo está como P03 (Cougar p03 contínuo) e não PRT5.',
      'Após validar aqui, os botões "Ler Peso" nos tickets de pesagem funcionarão automaticamente.',
    ],
  },
];

export default function BalancaPassoAPasso() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Passo a Passo de Instalação</h2>
        <p className="text-sm text-muted-foreground">
          Siga os passos abaixo para integrar a balança Toledo Prix ao sistema.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PASSOS.map((passo) => {
          const Icon = passo.icon;
          return (
            <div key={passo.num} className="glass-tinted rounded-xl overflow-hidden flex flex-col">
              <Image
                src={passo.imagem}
                fittingType="fill"
                alt={passo.titulo}
                className="w-full aspect-[16/9] block"
              />
              <div className="p-4 space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
                    {passo.num}
                  </span>
                  <h3 className="font-semibold text-sm flex items-center gap-1.5">
                    <Icon className="w-4 h-4 text-primary" /> {passo.titulo}
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground">{passo.descricao}</p>
                <ul className="space-y-1 pt-1">
                  {passo.dicas.map((dica, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{dica}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}