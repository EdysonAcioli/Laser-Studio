# Laser Studio

Monorepo inicial para software desktop profissional de controle CNC laser inspirado no LightBurn.

## Estrutura

- `apps/desktop`: aplicação Electron + Vite + React com interface de edição e preview.
- `packages/canvas-engine`: engine vetorial básica para gerenciamento de objetos.
- `packages/gcode-engine`: gerador de G-code com suporte a vários firmwares.
- `packages/machine-driver`: abstração inicial de conexão com máquinas CNC.
- `packages/shared-ui`: componentes UI compartilhados.
- `packages/shared-types`: tipos TypeScript centrais.

## Execução

1. Instale dependências:

```bash
npm install
```

2. Inicie a aplicação desktop em modo desenvolvimento:

```bash
npm --workspace=apps/desktop run dev
```

3. Em outro terminal, abra o Electron shell:

```bash
npm --workspace=apps/desktop run start
```

Se você quiser usar `pnpm` no futuro, instale-o globalmente com:

```bash
npm install -g pnpm
```
