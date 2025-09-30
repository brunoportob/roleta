# Changelog

Todas as mudanças notáveis deste projeto.

## [Unreleased]
- (planejado) Testes automatizados
- (planejado) ESLint/Prettier
- (planejado) CI build

## [1.0.0] - Estrutura Modular & Limpeza
### Adicionado
- Modularização: `itemsStore.js`, `wheel.js`, `main.js`.
- Pesos separados `probItem` / `probNone` com retrocompatibilidade `#prob=`.
- Intercalação automática de placeholders.
- Animação multi-voltas (7–9) com margem anti-linha.
- Fullscreen overlay mantendo integridade visual.
- Histórico de resultados (20) + destaques + toast + efeitos (confete / nuvem).
- Persistência híbrida (Electron arquivo / Web API Express / fallback localStorage).

### Alterado
- Remoção de alert() substituído por UI não bloqueante.
- Conversão de layout para tamanho fixo e wheel ancorada.
- Simplificação da exibição de placeholders: sempre "Nenhum item".

### Removido
- Arquivos raiz duplicados (legacy `script.js`, `server.js`, `electron-main.js`, `preload.js`, `styles.css`).
- Conteúdo redundante de README antigo (unificação em único README).

### Correções
- Normalização de rotação (visualRotation vs currentRotation) evitando drift.
- Tratamento de boundary para não parar em linhas divisórias.

## [0.9.0] - Versão Inicial
- Roleta funcional básica com itens, decremento e placeholders simples.

--

Formato inspirado em Keep a Changelog.