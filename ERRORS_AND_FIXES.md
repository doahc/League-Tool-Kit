# 🔧 Erros Comuns e Soluções

Guia completo de troubleshooting para o League Toolkit.

---

## 📋 Índice

1. [Erros de Conexão](#erros-de-conexão)
2. [Erros de Campeões](#erros-de-campeões)
3. [Erros de Build](#erros-de-build)
4. [Erros de Funcionalidades](#erros-de-funcionalidades)
5. [Erros Python](#erros-python)
6. [Performance](#performance)

---

## 🔌 Erros de Conexão

### ❌ "LCU not connected"

**Possíveis Causas:**
- League of Legends não está aberto
- Não fez login no cliente
- Cliente está inicializando
- Firewall bloqueando conexão

**Soluções:**
```
1. Abra o League of Legends
2. Faça login completamente
3. Aguarde chegar no menu principal
4. Clique em "Refresh" no LTK
5. Se não funcionar, reinicie o LoL
```

**Verificação Avançada:**
```bash
# Windows PowerShell
Get-Process LeagueClientUx

# Se não aparecer nada, o cliente não está rodando
```

---

### ❌ "Failed to find credentials"

**Causa:** O LTK não conseguiu encontrar o processo do League.

**Soluções:**
```
1. Execute o LTK como Administrador (Windows)
2. Adicione exceção no Antivírus/Firewall
3. Verifique se o caminho do LoL está correto
4. Reinstale o League of Legends
```

**Path Esperado (Windows):**
```
C:\Riot Games\League of Legends\
```

---

### ❌ "Connection timeout"

**Causa:** Requisição para LCU demorou muito.

**Soluções:**
```
1. Feche programas pesados
2. Verifique uso de CPU/RAM
3. Desative VPN temporariamente
4. Reinicie o PC se necessário
```

---

## 🎮 Erros de Campeões

### ❌ "Champion not found"

**Causa:** Nome do campeão está incorreto ou não existe.

**Soluções:**

✅ **Nomes Corretos:**
```
✓ "Lee Sin" (com espaço)
✓ "Wukong" ou "MonkeyKing"
✓ "Kai'Sa" (com apóstrofo)
✓ "Cho'Gath"
✓ "Rek'Sai"
✓ "Vel'Koz"
```

❌ **Nomes Incorretos:**
```
✗ "LeeSin" (sem espaço)
✗ "Kaisa" (sem apóstrofo)
✗ "Master Yi" → Use "MasterYi"
```

**Teste Rápido:**
```javascript
// No console do DevTools (F12)
// Liste todos os campeões disponíveis
console.log(Object.keys(featureService.championData.list));
```

---

### ❌ "You don't own this champion"

**Causa:** Você não possui o campeão selecionado.

**Soluções:**
```
1. Verifique se possui o campeão
2. Use "random" para pick aleatório
3. Escolha outro campeão da sua coleção
```

**Ver Campeões que Você Possui:**
```
1. Vá para Coleção > Campeões no LoL
2. Anote os nomes
3. Use esses nomes no LTK
```

---

### ❌ "Failed to lock champion"

**Causa:** Erro ao enviar comando de lock para o LCU.

**Soluções:**
```
1. Verifique se ainda está no seu turno
2. Desative e reative o Auto Pick
3. Tente manualmente primeiro
4. Verifique logs para mais detalhes
```

---

## 🏗️ Erros de Build

### ❌ "ENOENT: no such file or directory"

**Causa:** Arquivo ou pasta não encontrado durante build.

**Soluções:**
```bash
# 1. Limpe cache
npm cache clean --force

# 2. Delete node_modules
rm -rf node_modules

# 3. Reinstale
npm install

# 4. Tente o build novamente
npm run build
```

---

### ❌ "Cannot find module 'electron'"

**Causa:** Electron não foi instalado corretamente.

**Soluções:**
```bash
# Reinstale o Electron
npm uninstall electron
npm install electron --save-dev

# Verifique a versão
npm list electron
```

---

### ❌ "gyp ERR! stack Error: not found: python"

**Causa:** Python não está instalado (necessário para algumas dependências nativas).

**Soluções:**

**Windows:**
```bash
# Instale ferramentas de build
npm install --global windows-build-tools

# Ou instale Python 3.x manualmente
# https://www.python.org/downloads/
```

**MacOS:**
```bash
# Instale Xcode Command Line Tools
xcode-select --install
```

**Linux:**
```bash
# Ubuntu/Debian
sudo apt-get install python3 build-essential

# Fedora
sudo dnf install python3 gcc-c++ make
```

---

### ❌ "electron-builder install-app-deps failed"

**Causa:** Dependências nativas falharam ao compilar.

**Soluções:**
```bash
# Windows
npm install --global node-gyp
npm config set msvs_version 2019

# Reconstrua dependências
npm run postinstall

# Se persistir, use versão pré-compilada
npm install --arch=x64 --platform=win32
```

---

## ⚙️ Erros de Funcionalidades

### ❌ Auto Accept não funciona

**Diagnóstico:**
```
1. Verifique se está ATIVADO (botão verde)
2. Abra os Logs (aba Logs)
3. Procure por "[AutoAccept]"
4. Verifique se há erros
```

**Soluções:**
```
1. Desative e reative a função
2. Reinicie o LTK
3. Entre em outra fila (Normal/Ranked)
4. Verifique se o firewall não está bloqueando
```

---

### ❌ Auto Pick/Ban não funciona

**Checklist:**
- [ ] Campeão está **escrito corretamente**
- [ ] Você **possui** o campeão (Auto Pick)
- [ ] Está **no seu turno**
- [ ] A função está **ativada**
- [ ] Não há **erros nos logs**

**Debug Passo a Passo:**
```
1. Ative o Auto Pick/Ban
2. Entre em champ select
3. Abra Logs (F12 ou aba Logs)
4. Procure mensagens como:
   - "✓ Configured"
   - "🎯 MY TURN"
   - "✅ LOCKED" ou "✅ BANNED"
```

---

### ❌ Background não muda

**Skin IDs Válidos:**
```
❌ Errado: "Yasuo" (nome)
✅ Correto: 27001 (ID numérico)

Encontre IDs em:
https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/skins.json
```

**Teste Rápido:**
```javascript
// IDs que geralmente funcionam
27001  // Yasuo base
27002  // Yasuo High Noon
157001 // Yasuo PROJECT
```

**Limitações:**
```
⚠️ Alguns skins NÃO funcionam como background:
- Skins muito antigas
- Skins de eventos especiais
- Skins que não têm splash art apropriada
```

---

### ❌ Reveal Lobby não abre

**Causa:** Não está em champion select ou região incorreta.

**Soluções:**
```
1. Use APENAS em champion select
2. Aguarde todos os jogadores aceitarem
3. Verifique se a região está correta (BR1, NA1, EUW1)
4. Tente manualmente: https://porofessor.gg/
```

---

### ❌ Dodge não funciona

**Timing Importante:**
```
✅ Funciona: Durante champion select
❌ Não funciona: Antes de aceitar partida
❌ Não funciona: Depois da partida começar
```

**Alternativa:**
```
Se não funcionar:
1. Feche o League of Legends completamente
2. Ou deixe o tempo acabar (receberá penalidade)
```

---

## 🐍 Erros Python

### ❌ "Python was not found"

**Soluções:**
```bash
# 1. Instale Python
# Windows: https://www.python.org/downloads/
# Marque "Add Python to PATH" durante instalação

# 2. Verifique instalação
python --version

# 3. Se não funcionar, adicione ao PATH manualmente
```

---

### ❌ "ModuleNotFoundError: No module named 'psutil'"

**Causa:** Dependências Python não instaladas.

**Solução:**
```bash
cd python-scripts
pip install -r requirements.txt

# Ou manualmente
pip install psutil requests termcolor
```

---

### ❌ "PermissionError: [WinError 5]"

**Causa:** Permissões insuficientes no Windows.

**Soluções:**
```
1. Execute o prompt como Administrador
2. Instale dependências novamente
3. Ou use: pip install --user <pacote>
```

---

## 🚀 Performance

### ❌ LTK está lento

**Otimizações:**
```
1. Feche abas do navegador
2. Feche programas pesados
3. Limpe o cache:
   - Settings > Clear Cache
4. Reinicie o LTK
5. Reinicie o PC se necessário
```

---

### ❌ Alto uso de CPU/RAM

**Causas Comuns:**
```
- Muitos logs acumulados
- Cache muito grande
- Memory leak (bug)
```

**Soluções:**
```
1. Limpe os logs (Logs tab > Clear)
2. Limpe o cache (Settings > Clear Cache)
3. Reinicie o aplicativo
4. Reporte o bug se persistir
```

---

### ❌ "Electron Helper" usando muita CPU

**Normal:** Electron usa múltiplos processos.

**Anormal:** Se usar >50% constantemente.

**Soluções:**
```
1. Atualize para versão mais recente
2. Desative funcionalidades não usadas
3. Monitore Task Manager para identificar processo específico
```

---

## 🛠️ Ferramentas de Debug

### DevTools (F12)
```javascript
// Ver estado do LCU
console.log('LCU Connected:', services.lcu.isConnected);

// Ver estado das features
console.log('Features:', services.feature.getFeatureStates());

// Ver cache
console.log('Summoner Cache:', services.summoner.cache);

// Forçar reconexão
services.lcu.disconnect();
services.lcu.connect();
```

---

### Logs Detalhados
```
1. Abra: Settings > Open Logs Folder
2. Abra o arquivo mais recente (.log)
3. Procure por palavras-chave:
   - "ERROR"
   - "WARN"
   - "Failed"
   - Nome da funcionalidade (ex: "AutoPick")
```

---

### Network Inspector
```
1. Abra DevTools (F12)
2. Aba "Network"
3. Filtre por "127.0.0.1"
4. Veja requisições para LCU
5. Verifique status codes:
   - 200 = OK
   - 404 = Endpoint não encontrado
   - 500 = Erro no servidor
```

---

## 📞 Ainda Com Problemas?

### 1. Coleta de Informações
```
Antes de reportar, colete:
- Versão do LTK
- Versão do League of Legends
- Sistema Operacional
- Logs relevantes
- Screenshots do erro
```

### 2. Onde Reportar
```
GitHub Issues:
https://github.com/seu-usuario/league-toolkit/issues

Template:
- Descrição do problema
- Passos para reproduzir
- Comportamento esperado vs atual
- Logs e screenshots
```

### 3. Comunidade
```
Discord: [Seu Discord]
Reddit: [Seu Subreddit]
```

---

## ✅ Checklist Final

Antes de reportar bug, verifique:

- [ ] **README** lido completamente
- [ ] **QUICKSTART** seguido
- [ ] **Versão mais recente** instalada
- [ ] **Dependências** atualizadas (`npm install`)
- [ ] **League of Legends** aberto e logado
- [ ] **Logs** verificados
- [ ] **DevTools** consultado
- [ ] **Google** pesquisado pelo erro
- [ ] **Issues** do GitHub verificadas

---

<div align="center">

**90% dos problemas são resolvidos seguindo este guia! 🎯**

[⬅️ Voltar para README](README.md) | [🚀 Quick Start](QUICKSTART.md)

</div>
