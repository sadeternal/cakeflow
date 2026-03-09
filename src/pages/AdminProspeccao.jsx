import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { appClient } from '@/api/appClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {
  MessageCircle, Check, Undo2, Search, RefreshCw, Send, Instagram, Phone,
  MapPin, Users, CheckCircle2, Clock, PhoneOff, Upload, Download, AlertCircle,
  Plus, Loader2, Trash2
} from 'lucide-react';

const STORAGE_MSG_KEY = 'cakeflow_prospeccao_mensagem';

const DEFAULT_MESSAGE = `Olá {nome}! 👋

Somos do *CakeFlow*, o sistema de gestão feito especialmente para confeitarias como a sua.

Com o CakeFlow você consegue:
🎂 Gerenciar pedidos de forma simples
💰 Controlar o financeiro da sua confeitaria
📦 Organizar seu catálogo de produtos
📊 Acompanhar relatórios e crescimento

Estamos ajudando diversas confeitarias a economizarem tempo e venderem mais. Quer conhecer gratuitamente?

👉 Acesse: https://cakeflow.com.br`;

// ─── Storage ──────────────────────────────────────────────────────────────────
function getSavedMessage() { return localStorage.getItem(STORAGE_MSG_KEY) || DEFAULT_MESSAGE; }
function saveMessage(msg) { localStorage.setItem(STORAGE_MSG_KEY, msg); }

// ─── CSV parser ───────────────────────────────────────────────────────────────
const COLUMN_ALIASES = {
  nome:      ['nome', 'name', 'confeitaria', 'empresa', 'estabelecimento'],
  cidade:    ['cidade', 'city', 'localidade', 'local'],
  telefone:  ['telefone', 'phone', 'tel', 'celular', 'whatsapp', 'fone'],
  instagram: ['instagram', 'ig', 'insta', 'perfil'],
};

function detectSeparator(line) {
  const semicolons = (line.match(/;/g) || []).length;
  const commas = (line.match(/,/g) || []).length;
  return semicolons >= commas ? ';' : ',';
}

function unquote(val) {
  if (!val) return '';
  const v = val.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1).trim();
  }
  return v;
}

function mapHeader(header) {
  const h = header.toLowerCase().trim();
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.some(a => h.includes(a))) return field;
  }
  return null;
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('O arquivo está vazio ou tem apenas o cabeçalho.');
  const sep = detectSeparator(lines[0]);
  const headers = lines[0].split(sep).map(h => unquote(h));
  const fieldMap = headers.map(mapHeader);
  if (!fieldMap.includes('nome')) throw new Error('Coluna "nome" não encontrada. Verifique o cabeçalho do CSV.');
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(sep).map(unquote);
    const row = { nome: '', cidade: '', telefone: '', instagram: '' };
    fieldMap.forEach((field, idx) => { if (field) row[field] = cells[idx] || ''; });
    if (row.nome) rows.push(row);
  }
  if (rows.length === 0) throw new Error('Nenhuma linha válida encontrada no arquivo.');
  return rows;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildWhatsAppUrl(phone, name, message) {
  const cleaned = phone?.replace(/\D/g, '');
  if (!cleaned) return null;
  const text = message.replace('{nome}', name);
  return `https://wa.me/55${cleaned}?text=${encodeURIComponent(text)}`;
}

function downloadModelo() {
  const content = 'nome;cidade;telefone;instagram\nConfeitaria Exemplo;São Paulo - SP;11999990000;@exemplo.confeitaria\n';
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'modelo_prospeccao.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────
const EMPTY_FORM = { nome: '', cidade: '', telefone: '', instagram: '' };
const QK = ['prospeccao_contatos'];

export default function AdminProspeccao() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: QK });

  const [message, setMessage] = useState(getSavedMessage);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('todos');
  const [showResetDialog, setShowResetDialog] = useState(false);

  // CSV import
  const fileInputRef = useRef(null);
  const [importPreview, setImportPreview] = useState(null);
  const [showImportDialog, setShowImportDialog] = useState(false);

  // New contact form
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY_FORM);
  const [newFormError, setNewFormError] = useState('');

  // ── Data ──

  const { data: contatos = [], isLoading } = useQuery({
    queryKey: QK,
    queryFn: () => appClient.entities.ProspeccaoContato.filter({}),
  });

  // ── Mutations ──

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => appClient.entities.ProspeccaoContato.update(id, data),
    onSuccess: invalidate,
  });

  const createMut = useMutation({
    mutationFn: (data) => appClient.entities.ProspeccaoContato.create(data),
    onSuccess: invalidate,
  });

  const deleteMut = useMutation({
    mutationFn: (id) => appClient.entities.ProspeccaoContato.delete(id),
    onSuccess: invalidate,
  });

  // ── Handlers ──

  const handleMessageChange = (val) => { setMessage(val); saveMessage(val); };
  const handleRestoreMessage = () => { setMessage(DEFAULT_MESSAGE); saveMessage(DEFAULT_MESSAGE); };

  const markSent = (contato) =>
    updateMut.mutate({ id: contato.id, data: { enviado: true, enviado_em: new Date().toISOString() } });

  const unmarkSent = (contato) =>
    updateMut.mutate({ id: contato.id, data: { enviado: false, enviado_em: null } });

  const handleSendAndMark = (contato) => {
    const url = buildWhatsAppUrl(contato.telefone, contato.nome, message);
    if (url) { window.open(url, '_blank'); markSent(contato); }
  };

  const handleEnviarProxima = () => {
    const proxima = contatos.find(c => c.telefone && !c.enviado);
    if (proxima) handleSendAndMark(proxima);
  };

  const handleReset = async () => {
    const sent = contatos.filter(c => c.enviado);
    await Promise.all(sent.map(c => appClient.entities.ProspeccaoContato.update(c.id, { enviado: false, enviado_em: null })));
    invalidate();
    setShowResetDialog(false);
  };

  // New contact
  const handleAddNew = () => {
    if (!newForm.nome.trim()) { setNewFormError('O nome é obrigatório.'); return; }
    createMut.mutate(
      { nome: newForm.nome.trim(), cidade: newForm.cidade.trim(), telefone: newForm.telefone.trim(), instagram: newForm.instagram.trim() },
      { onSuccess: () => { setNewForm(EMPTY_FORM); setNewFormError(''); setShowNewDialog(false); } }
    );
  };

  // CSV import
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { setImportPreview({ rows: parseCSV(ev.target.result), error: null }); }
      catch (err) { setImportPreview({ rows: [], error: err.message }); }
      setShowImportDialog(true);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleConfirmImport = async (mode) => {
    if (!importPreview?.rows?.length) return;
    if (mode === 'replace') {
      await Promise.all(contatos.map(c => appClient.entities.ProspeccaoContato.delete(c.id)));
    }
    await Promise.all(
      importPreview.rows.map(r => appClient.entities.ProspeccaoContato.create({
        nome: r.nome, cidade: r.cidade || '', telefone: r.telefone || '', instagram: r.instagram || '',
      }))
    );
    invalidate();
    setShowImportDialog(false);
    setImportPreview(null);
  };

  // ── Derived ──

  const filtered = useMemo(() => {
    let list = contatos;
    if (filter === 'pendentes') list = list.filter(c => c.telefone && !c.enviado);
    else if (filter === 'enviados') list = list.filter(c => c.enviado);
    else if (filter === 'sem_telefone') list = list.filter(c => !c.telefone);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.nome.toLowerCase().includes(q) ||
        (c.cidade || '').toLowerCase().includes(q) ||
        (c.instagram || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [filter, search, contatos]);

  const stats = useMemo(() => ({
    total: contatos.length,
    enviados: contatos.filter(c => c.enviado).length,
    pendentes: contatos.filter(c => c.telefone && !c.enviado).length,
    semTelefone: contatos.filter(c => !c.telefone).length,
  }), [contatos]);

  const progressPercent = stats.total > 0 ? Math.round((stats.enviados / stats.total) * 100) : 0;

  const FILTERS = [
    { key: 'todos', label: 'Todos', count: stats.total },
    { key: 'pendentes', label: 'Pendentes', count: stats.pendentes },
    { key: 'enviados', label: 'Enviados', count: stats.enviados },
    { key: 'sem_telefone', label: 'Sem telefone', count: stats.semTelefone },
  ];

  // ── Render ──

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prospecção WhatsApp</h1>
          <p className="text-sm text-gray-500 mt-1">Envie mensagens personalizadas para potenciais clientes via WhatsApp</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={downloadModelo} className="gap-2">
            <Download className="h-4 w-4" />Baixar modelo CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
            <Upload className="h-4 w-4" />Importar CSV
          </Button>
          <Button size="sm" onClick={() => { setNewForm(EMPTY_FORM); setNewFormError(''); setShowNewDialog(true); }}
            className="bg-rose-500 hover:bg-rose-600 text-white gap-2">
            <Plus className="h-4 w-4" />Nova confeitaria
          </Button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: <Users className="h-5 w-5 text-rose-600" />, bg: 'bg-rose-100', val: stats.total, label: 'Total' },
          { icon: <CheckCircle2 className="h-5 w-5 text-green-600" />, bg: 'bg-green-100', val: stats.enviados, label: 'Enviados' },
          { icon: <Clock className="h-5 w-5 text-amber-600" />, bg: 'bg-amber-100', val: stats.pendentes, label: 'Pendentes' },
          { icon: <PhoneOff className="h-5 w-5 text-gray-500" />, bg: 'bg-gray-100', val: stats.semTelefone, label: 'Sem telefone' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 ${s.bg} rounded-lg`}>{s.icon}</div>
              <div><p className="text-2xl font-bold text-gray-900">{s.val}</p><p className="text-xs text-gray-500">{s.label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progresso de envios</span>
            <span className="text-sm font-semibold text-rose-600">{progressPercent}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div className="bg-rose-500 h-3 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="text-xs text-gray-500 mt-1">{stats.enviados} de {stats.total} contatos abordados</p>
        </CardContent>
      </Card>

      {/* Message editor */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Mensagem Padrão</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={message} onChange={e => handleMessageChange(e.target.value)} rows={8} className="resize-none font-mono text-sm" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">{message.length} caracteres · Use <code className="bg-gray-100 px-1 rounded">{'{nome}'}</code> para personalizar</span>
            <Button variant="ghost" size="sm" onClick={handleRestoreMessage} className="text-xs gap-1">
              <RefreshCw className="h-3 w-3" />Restaurar padrão
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, cidade ou instagram..." className="pl-9" />
        </div>
        <Button onClick={handleEnviarProxima} className="bg-green-600 hover:bg-green-700 text-white gap-2 shrink-0" disabled={stats.pendentes === 0}>
          <Send className="h-4 w-4" />Enviar próxima pendente
        </Button>
        <Button variant="outline" onClick={() => setShowResetDialog(true)} className="gap-2 shrink-0 text-red-600 border-red-200 hover:bg-red-50" disabled={stats.enviados === 0}>
          <RefreshCw className="h-4 w-4" />Resetar todos
        </Button>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === f.key ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {f.label}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${filter === f.key ? 'bg-rose-400 text-white' : 'bg-gray-200 text-gray-500'}`}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" />Carregando contatos…
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Confeitaria</TableHead>
                      <TableHead>Cidade</TableHead>
                      <TableHead>Instagram</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-gray-400">
                          {contatos.length === 0 ? 'Nenhum contato cadastrado. Adicione manualmente ou importe um CSV.' : 'Nenhum contato encontrado.'}
                        </TableCell>
                      </TableRow>
                    ) : filtered.map(contato => {
                      const isSent = contato.enviado;
                      const hasPhone = !!contato.telefone;
                      const waUrl = hasPhone ? buildWhatsAppUrl(contato.telefone, contato.nome, message) : null;
                      return (
                        <TableRow key={contato.id} className={isSent ? 'bg-green-50' : ''}>
                          <TableCell className="font-medium">{contato.nome}</TableCell>
                          <TableCell>
                            {contato.cidade
                              ? <span className="flex items-center gap-1 text-gray-600"><MapPin className="h-3 w-3" />{contato.cidade}</span>
                              : <span className="text-gray-400">—</span>}
                          </TableCell>
                          <TableCell>
                            {contato.instagram
                              ? <a href={`https://instagram.com/${contato.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-rose-600 hover:text-rose-700 text-sm">
                                  <Instagram className="h-3 w-3" />{contato.instagram}
                                </a>
                              : <span className="text-gray-400">—</span>}
                          </TableCell>
                          <TableCell>
                            {hasPhone
                              ? <span className="flex items-center gap-1 text-gray-700 text-sm"><Phone className="h-3 w-3" />{contato.telefone}</span>
                              : <span className="text-gray-400 text-sm flex items-center gap-1"><PhoneOff className="h-3 w-3" />Sem telefone</span>}
                          </TableCell>
                          <TableCell>
                            {isSent
                              ? <Badge className="bg-green-100 text-green-700 border-green-200"><Check className="h-3 w-3 mr-1" />Enviado</Badge>
                              : hasPhone
                                ? <Badge variant="outline" className="text-amber-600 border-amber-200"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>
                                : <Badge variant="outline" className="text-gray-400 border-gray-200">Sem telefone</Badge>}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 justify-end">
                              {hasPhone && !isSent && (
                                <Button size="sm" onClick={() => handleSendAndMark(contato)} className="bg-green-600 hover:bg-green-700 text-white gap-1 h-8">
                                  <MessageCircle className="h-3 w-3" />Enviar
                                </Button>
                              )}
                              {hasPhone && isSent && (
                                <Button size="sm" variant="outline" onClick={() => window.open(waUrl, '_blank')} className="gap-1 h-8 text-green-600 border-green-200 hover:bg-green-50">
                                  <MessageCircle className="h-3 w-3" />Reenviar
                                </Button>
                              )}
                              {isSent
                                ? <Button size="sm" variant="ghost" onClick={() => unmarkSent(contato)} className="gap-1 h-8 text-gray-500" title="Desfazer"><Undo2 className="h-3 w-3" /></Button>
                                : hasPhone
                                  ? <Button size="sm" variant="ghost" onClick={() => markSent(contato)} className="gap-1 h-8 text-gray-500" title="Marcar como enviado"><Check className="h-3 w-3" /></Button>
                                  : null}
                              <Button size="sm" variant="ghost" onClick={() => deleteMut.mutate(contato.id)} className="h-8 text-red-400 hover:text-red-600 hover:bg-red-50" title="Apagar contato">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile */}
              <div className="md:hidden divide-y">
                {filtered.length === 0
                  ? <div className="text-center py-10 text-gray-400">
                      {contatos.length === 0 ? 'Nenhum contato cadastrado.' : 'Nenhum contato encontrado.'}
                    </div>
                  : filtered.map(contato => {
                    const isSent = contato.enviado;
                    const hasPhone = !!contato.telefone;
                    const waUrl = hasPhone ? buildWhatsAppUrl(contato.telefone, contato.nome, message) : null;
                    return (
                      <div key={contato.id} className={`p-4 space-y-3 ${isSent ? 'bg-green-50' : ''}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-gray-900">{contato.nome}</p>
                            {contato.cidade && <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" />{contato.cidade}</p>}
                          </div>
                          {isSent
                            ? <Badge className="bg-green-100 text-green-700 border-green-200 shrink-0"><Check className="h-3 w-3 mr-1" />Enviado</Badge>
                            : hasPhone
                              ? <Badge variant="outline" className="text-amber-600 border-amber-200 shrink-0">Pendente</Badge>
                              : <Badge variant="outline" className="text-gray-400 border-gray-200 shrink-0">Sem tel.</Badge>}
                        </div>
                        <div className="flex items-center gap-4 text-sm flex-wrap">
                          {contato.instagram && (
                            <a href={`https://instagram.com/${contato.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-rose-600">
                              <Instagram className="h-3 w-3" />{contato.instagram}
                            </a>
                          )}
                          {hasPhone && <span className="flex items-center gap-1 text-gray-600"><Phone className="h-3 w-3" />{contato.telefone}</span>}
                        </div>
                        <div className="flex gap-2">
                          {hasPhone && !isSent && (
                            <Button size="sm" onClick={() => handleSendAndMark(contato)} className="bg-green-600 hover:bg-green-700 text-white gap-1 flex-1">
                              <MessageCircle className="h-3 w-3" />Enviar WhatsApp
                            </Button>
                          )}
                          {hasPhone && isSent && (
                            <Button size="sm" variant="outline" onClick={() => window.open(waUrl, '_blank')} className="gap-1 flex-1 text-green-600 border-green-200">
                              <MessageCircle className="h-3 w-3" />Reenviar
                            </Button>
                          )}
                          {isSent
                            ? <Button size="sm" variant="outline" onClick={() => unmarkSent(contato)} className="gap-1"><Undo2 className="h-3 w-3" />Desfazer</Button>
                            : hasPhone
                              ? <Button size="sm" variant="outline" onClick={() => markSent(contato)} className="gap-1"><Check className="h-3 w-3" />Marcar</Button>
                              : null}
                          <Button size="sm" variant="outline" onClick={() => deleteMut.mutate(contato.id)} className="text-red-400 hover:text-red-600 border-red-200 hover:bg-red-50">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── New Contact Dialog ── */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova confeitaria</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-nome">Nome <span className="text-red-500">*</span></Label>
              <Input id="new-nome" placeholder="Ex: Confeitaria Doce Mel" value={newForm.nome}
                onChange={e => { setNewForm(p => ({ ...p, nome: e.target.value })); setNewFormError(''); }} />
              {newFormError && <p className="text-xs text-red-500">{newFormError}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-cidade">Cidade</Label>
              <Input id="new-cidade" placeholder="Ex: São Paulo - SP" value={newForm.cidade}
                onChange={e => setNewForm(p => ({ ...p, cidade: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-telefone">Telefone / WhatsApp</Label>
              <Input id="new-telefone" placeholder="Ex: 11999990000" value={newForm.telefone}
                onChange={e => setNewForm(p => ({ ...p, telefone: e.target.value }))} />
              <p className="text-xs text-gray-400">Somente números, com DDD</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-instagram">Instagram</Label>
              <Input id="new-instagram" placeholder="Ex: @docemel.confeitaria" value={newForm.instagram}
                onChange={e => setNewForm(p => ({ ...p, instagram: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddNew} disabled={createMut.isPending} className="bg-rose-500 hover:bg-rose-600 text-white gap-2">
              {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Import Dialog ── */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Importar contatos</DialogTitle></DialogHeader>
          {importPreview?.error ? (
            <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg text-red-700">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Erro ao ler o arquivo</p>
                <p className="text-sm mt-1">{importPreview.error}</p>
                <p className="text-xs text-red-500 mt-2">Baixe o modelo CSV para ver o formato correto.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{importPreview?.rows?.length ?? 0} contatos</span> encontrados no arquivo. Como deseja importá-los?
              </p>
              <div className="border rounded-lg overflow-hidden max-h-52 overflow-y-auto text-xs">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="py-2">Nome</TableHead>
                      <TableHead className="py-2">Cidade</TableHead>
                      <TableHead className="py-2">Telefone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(importPreview?.rows ?? []).slice(0, 10).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="py-1.5">{r.nome}</TableCell>
                        <TableCell className="py-1.5 text-gray-500">{r.cidade || '—'}</TableCell>
                        <TableCell className="py-1.5 text-gray-500">{r.telefone || '—'}</TableCell>
                      </TableRow>
                    ))}
                    {(importPreview?.rows?.length ?? 0) > 10 && (
                      <TableRow>
                        <TableCell colSpan={3} className="py-1.5 text-center text-gray-400">+{importPreview.rows.length - 10} mais…</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {importPreview?.error ? (
              <>
                <Button variant="outline" onClick={() => setShowImportDialog(false)}>Fechar</Button>
                <Button onClick={downloadModelo} className="gap-1"><Download className="h-4 w-4" />Baixar modelo</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowImportDialog(false)} className="sm:mr-auto">Cancelar</Button>
                <Button variant="outline" onClick={() => handleConfirmImport('append')}>Adicionar aos existentes</Button>
                <Button onClick={() => handleConfirmImport('replace')} className="bg-rose-500 hover:bg-rose-600 text-white">Substituir lista</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reset Dialog ── */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resetar todos os envios?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá marcar todos os {stats.enviados} contatos enviados como pendentes novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} className="bg-red-600 hover:bg-red-700">Sim, resetar tudo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
