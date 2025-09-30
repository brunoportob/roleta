<div align="center">

# Roleta de Itens

Uma roleta animada para sorteios de brindes, dinâmicas de equipe e distribuição divertida de chances.

Desenvolvido e mantido por **Bruno Porto**.

![Tela Principal](docs/img/tela-principal.png)
<br/>
<sub>Interface principal com placeholders e itens quantificados.</sub>

</div>

---

## Índice
1. [Visão Geral](#visão-geral)
2. [Pré-requisitos](#pré-requisitos)
3. [Instalação](#instalação)
4. [Uso](#uso)
5. [Exemplos / Prints](#exemplos--prints)
6. [Estrutura do Projeto](#estrutura-do-projeto)
7. [Arquitetura](#arquitetura)
8. [Persistência & Migração](#persistência--migração)
9. [Conceitos de Sorteio](#conceitos-de-sorteio)
10. [Personalização Rápida](#personalização-rápida)
11. [Scripts](#scripts)
12. [FAQ](#faq)
13. [Roadmap](#roadmap)
14. [Changelog](#changelog)
15. [Contribuição](#contribuição)
16. [Licença](#licença)
17. [Autor](#autor)
18. [Contato](#contato)

---

## Visão Geral
Criei esta aplicação para ter um sorteador visual controlado, rápido e agradável para eventos e usos internos. Diferente de sites genéricos, aqui controlo probabilidades, placeholders “inteligentes”, persistência local e um modo fullscreen limpo (fundo branco) ideal para projetar.

## Pré-requisitos
- Node.js >= 18 (testado também em 20/22)
- NPM >= 9
- (Opcional) Ambiente Windows para build portátil via electron-builder
- (Opcional) SQLite já vem embutido; módulo nativo é carregado só se disponível

## Instalação
```powershell
git clone <URL_DO_REPOSITORIO>
cd roleta
npm install
```

## Uso
### Servidor Web (Express)
```powershell
npm start
# Acessar http://localhost:3000
```
### Modo Desktop (Electron)
```powershell
npm run electron
```
### Build Windows (pasta portable)
```powershell
npm run dist
```
Saída: `roleta/win-unpacked/Roleta de Itens.exe`.

## Exemplos / Prints
Fullscreen:
![Roleta Fullscreen](docs/img/tela-fullscreen.png)

## Estrutura do Projeto
```
index.html
src/
	frontend/
		js/
		css/
		img/
	electron/
	server/
package.json
README.md
CHANGELOG.md
itens.txt (legado)
```

## Arquitetura
| Camada | Papel | Observações |
|--------|-------|------------|
| UI (HTML/CSS/JS) | Interface e animações | Sem framework para leveza |
| wheel.js | Geração de segmentos e giro | Calcula pesos & offset |
| itemsStore.js | Persistência & migração | Detecta backend e fallback |
| main.js | Eventos, fullscreen, efeitos | Coordena UI + store |
| Electron main/preload | Janela & integração FS | Inicializa SQLite se possível |
| Express (opcional) | API simples/arquivo texto | Usa `itens.txt` |

## Persistência & Migração
Electron cria `roleta.db` em `%APPDATA%/Roleta de Itens/`. Se existir `itens.txt`, ele é migrado e renomeado para `.bak`.

Schema:
```
meta(id INTEGER PRIMARY KEY CHECK(id=1), item_chance_percent INTEGER)
items(name TEXT PRIMARY KEY, quantity INTEGER)
```

Formato legado (`itens.txt`):
```
#probItem=100
#probNone=100
Item A:3
Item B:1
Nenhum item:0
Nenhum item 2:0
```

## Conceitos de Sorteio
- Grupo de itens vs grupo de placeholders: slider distribui o %.
- Se só um grupo existir, recebe 100% automaticamente.
- Placeholders nunca decrementam e não “consomem” suas entradas.
- Itens com quantidade 0 permanecem visíveis mas não são sorteados.
- Giro: 7–9 voltas, easing, offset interno para evitar linha divisória.

## Personalização Rápida
Elemento | Como mudar
---------|-----------
Logo central | Colocar `src/frontend/img/logo.png`
Texto placeholder | Ajustar constante em `itemsStore.js`
Duração do giro | CSS/JS: transição em `wheel.js`
Probabilidade inicial | Meta padrão no store
Cor do fullscreen | Variável `--fullscreen-bg` em `styles.css`

## Scripts
Script | Ação
-------|------
`npm start` | Servidor Express
`npm run electron` | Modo desktop (SQLite)
`npm run dist` | Build Windows

## FAQ
**Placeholders não são sorteados?**  São, conforme a % atribuída ao grupo deles.

**Por que vejo itens com quantidade 0?**  Mantidos para contexto; não entram no cálculo de peso.

**Posso usar só placeholders?**  Sim – eles assumem 100% se forem únicos.

**Logo não aparece.**  Verifique se `logo.png` existe exatamente nesse nome e pasta.

**Build falha com variáveis WIN_CSC_***  Remover variáveis de assinatura se não usar certificado.

## Roadmap
- Exportar / importar configuração (JSON)
- Pesos individuais por item
- Tema escuro
- Categorias de itens / filtros
- Atalhos de teclado (espaço/ESC)
- Automação de releases (GitHub Actions)

## Changelog
Ver [CHANGELOG.md](CHANGELOG.md).

## Contribuição
Projeto pessoal, mas PRs e issues educadas são bem-vindos. Antes de abrir, descreva claramente o caso de uso ou problema.

## Licença
Uso interno / didático. Caso reutilize, atribua crédito a Bruno Porto.

## Autor
| Nome | Perfil |
|------|--------|
| Bruno Porto | https://github.com/brunoportob |

## Contato
- Email: <brunoporto8124@gmail.com>
- LinkedIn: https://www.linkedin.com/in/brunoportob/
- GitHub Issues: abra uma nova descrevendo claramente dúvida ou sugestão.

Prefere falar rápido? Abra a issue e mencione que enviou email/LinkedIn para eu correlacionar.

---
Se isso te ajudou, deixe uma estrela no repositório. 😉
