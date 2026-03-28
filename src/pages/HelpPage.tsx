import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Mail, PlayCircle } from 'lucide-react';
import { useState } from 'react';

const faqCategories = [
  {
    category: 'Leads',
    items: [
      { q: 'Como adicionar um novo lead?', a: 'Vá até a página de Leads e clique no botão "Novo Lead". Preencha as informações e clique em Salvar.' },
      { q: 'Como importar leads via CSV?', a: 'Na página de Leads, clique em "Importar". O arquivo CSV deve conter as colunas: nome, telefone, email, origem.' },
      { q: 'Como filtrar leads por status?', a: 'Use o seletor de status no topo da tabela de leads para filtrar por qualquer etapa do funil.' },
    ],
  },
  {
    category: 'Tarefas',
    items: [
      { q: 'Como criar uma tarefa de follow-up?', a: 'Acesse a página Tarefas e clique em "Nova Tarefa". Vincule a tarefa a um lead ou cliente existente.' },
      { q: 'O que acontece com tarefas atrasadas?', a: 'Tarefas atrasadas ficam destacadas em vermelho e aparecerão no badge de notificações.' },
    ],
  },
  {
    category: 'Distribuição',
    items: [
      { q: 'Como distribuir leads automaticamente?', a: 'No painel de Distribuição, selecione o modo Round-Robin ou Por Capacidade para distribuição automática.' },
      { q: 'O que significa "vendedor sobrecarregado"?', a: 'Um vendedor é considerado sobrecarregado quando possui mais de 20 leads abertos simultaneamente.' },
    ],
  },
  {
    category: 'Relatórios',
    items: [
      { q: 'Como exportar relatórios?', a: 'Na página de Relatórios, clique no botão de exportar para baixar os dados em CSV ou PDF.' },
      { q: 'Posso filtrar relatórios por período?', a: 'Sim, use o seletor de intervalo de datas no topo da página de Relatórios.' },
    ],
  },
];

const tutorials = [
  { title: 'Guia Rápido: Primeiros Passos', description: 'Aprenda o básico do CRM em 5 minutos' },
  { title: 'Como Gerenciar o Pipeline', description: 'Domine o Kanban e mova leads pelo funil' },
  { title: 'Distribuição de Leads', description: 'Configure a distribuição automática da equipe' },
  { title: 'Relatórios e Métricas', description: 'Entenda os dados e melhore seus resultados' },
];

export default function HelpPage() {
  const [search, setSearch] = useState('');

  const filteredFaq = faqCategories.map(cat => ({
    ...cat,
    items: cat.items.filter(item =>
      item.q.toLowerCase().includes(search.toLowerCase()) ||
      item.a.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(cat => cat.items.length > 0);

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Central de Ajuda</h1>
        <p className="text-muted-foreground text-sm">Encontre respostas e aprenda a usar o CRM</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar na central de ajuda..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Perguntas Frequentes</h2>
        {filteredFaq.map((cat) => (
          <Card key={cat.category}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{cat.category}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Accordion type="multiple">
                {cat.items.map((item, i) => (
                  <AccordionItem key={i} value={`${cat.category}-${i}`}>
                    <AccordionTrigger className="text-sm text-foreground">{item.q}</AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">{item.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Tutoriais em Vídeo</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {tutorials.map((tut) => (
            <Card key={tut.title} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <PlayCircle className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground">{tut.title}</p>
                  <p className="text-xs text-muted-foreground">{tut.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">Não encontrou o que procurava?</p>
          <Button variant="outline" asChild>
            <a href="mailto:suporte@crmpro.com"><Mail className="h-4 w-4 mr-2" />Contatar Suporte</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
