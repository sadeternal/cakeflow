import React, { useState } from 'react';
import { appClient } from '@/api/appClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Pencil,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';


import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function GerenciarItem({ 
  user, 
  type, 
  title, 
  icon: Icon, 
  entityName,
  defaultFormData,
  renderFormFields,
  renderItemDetails
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [formData, setFormData] = useState(defaultFormData);
  const queryClient = useQueryClient();

  const getEntity = () => {
    switch (entityName) {
      case 'Massa': return appClient.entities.Massa;
      case 'Recheio': return appClient.entities.Recheio;
      case 'Tamanho': return appClient.entities.Tamanho;
      case 'Cobertura': return appClient.entities.Cobertura;
      case 'Extra': return appClient.entities.Extra;
      case 'Doce': return appClient.entities.Doce;
      case 'Salgado': return appClient.entities.Salgado;
      default: return null;
    }
  };

  const { data: items = [], isLoading } = useQuery({
    queryKey: [type, user?.confeitaria_id],
    queryFn: () => getEntity().filter({ confeitaria_id: user.confeitaria_id }),
    enabled: !!user?.confeitaria_id,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (editingItem) {
        return getEntity().update(editingItem.id, data);
      }
      return getEntity().create({
        ...data,
        confeitaria_id: user.confeitaria_id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries([type]);
      closeForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => getEntity().delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries([type]);
      setItemToDelete(null);
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, ativo }) => getEntity().update(id, { ativo }),
    onSuccess: () => queryClient.invalidateQueries([type]),
  });

  const openForm = (item = null) => {
    setEditingItem(item);
    if (item) {
      setFormData({ ...item });
    } else {
      setFormData(defaultFormData);
    }
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingItem(null);
    setFormData(defaultFormData);
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg shadow-gray-100/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-rose-500" />
            {title}
          </CardTitle>
          <Button onClick={() => openForm()} className="bg-rose-500 hover:bg-rose-600">
            <Plus className="w-4 h-4 mr-2" />
            Novo
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Carregando...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-8">
              <Icon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 mb-4">Nenhum item cadastrado</p>
              <Button onClick={() => openForm()} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-4 rounded-xl ${
                    item.ativo !== false ? 'bg-gray-50' : 'bg-gray-100 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="p-2 rounded-lg bg-rose-100">
                      <Icon className="w-4 h-4 text-rose-600" />
                    </div>
                    <div className="flex-1">
                      {renderItemDetails ? renderItemDetails(item) : (
                        <>
                          <p className="font-medium text-gray-900">{item.nome}</p>
                          {item.valor_adicional > 0 && (
                            <p className="text-sm text-rose-600">
                              + R$ {item.valor_adicional?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={item.ativo !== false}
                      onCheckedChange={(checked) => toggleActive.mutate({ id: item.id, ativo: checked })}
                    />
                    <Button size="icon" variant="ghost" onClick={() => openForm(item)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => setItemToDelete(item)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={closeForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Editar' : 'Novo'} {title.slice(0, -1)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {renderFormFields(formData, setFormData)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate(formData)}
              disabled={!formData.nome || saveMutation.isPending}
              className="bg-rose-500 hover:bg-rose-600"
            >
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{itemToDelete?.nome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (!itemToDelete?.id) return;
                deleteMutation.mutate(itemToDelete.id);
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
