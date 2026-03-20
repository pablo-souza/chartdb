import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/dialog/dialog';
import { Button } from '@/components/button/button';
import { Input } from '@/components/input/input';
import { Label } from '@/components/label/label';
import { useDialog } from '@/hooks/use-dialog';
import { useTranslation } from 'react-i18next';

export const GitSettingsDialog = ({ dialog }) => {
    const { t } = useTranslation();
    const { closeGitSettingsDialog } = useDialog();
    const [settings, setSettings] = useState({
        repoUrl: '',
        username: '',
        token: '',
        fileName: 'chartdb-model.json'
    });

    useEffect(() => {
        const saved = localStorage.getItem('git_settings');
        if (saved) setSettings(JSON.parse(saved));
    }, [dialog.open]);

    const handleSave = () => {
        localStorage.setItem('git_settings', JSON.stringify(settings));
        closeGitSettingsDialog();
    };

    return (
        <Dialog {...dialog} onOpenChange={closeGitSettingsDialog}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Configurações Git</DialogTitle>
                    <DialogDescription>
                        Configure as credenciais do seu repositório para salvar modelos diretamente no Git.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="repo">URL do Repositório</Label>
                        <Input 
                            id="repo" 
                            placeholder="https://github.com/user/repo.git" 
                            value={settings.repoUrl}
                            onChange={(e) => setSettings({...settings, repoUrl: e.target.value})}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="user">Usuário</Label>
                        <Input 
                            id="user" 
                            value={settings.username}
                            onChange={(e) => setSettings({...settings, username: e.target.value})}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="token">Token (PAT)</Label>
                        <Input 
                            id="token" 
                            type="password" 
                            value={settings.token}
                            onChange={(e) => setSettings({...settings, token: e.target.value})}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="filename">Nome do Arquivo</Label>
                        <Input 
                            id="filename" 
                            value={settings.fileName}
                            onChange={(e) => setSettings({...settings, fileName: e.target.value})}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSave}>Salvar Configurações</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
