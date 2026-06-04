# Laser Studio

Projeto open source para software desktop de controle CNC laser, inspirado no LightBurn.

## Estrutura do repositório

- `apps/desktop`: aplicação Electron + Vite + React com interface de edição e preview.
- `packages/canvas-engine`: engine vetorial básica para gerenciamento de objetos.
- `packages/gcode-engine`: gerador de G-code com suporte a vários firmwares.
- `packages/machine-driver`: abstração inicial de conexão com máquinas CNC.
- `packages/shared-ui`: componentes UI compartilhados.
- `packages/shared-types`: tipos TypeScript centrais.

## Comunidade

Este projeto está aberto para contribuições. Veja também:

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- [.github/ISSUE_TEMPLATE/bug_report.md](./.github/ISSUE_TEMPLATE/bug_report.md)
- [.github/ISSUE_TEMPLATE/feature_request.md](./.github/ISSUE_TEMPLATE/feature_request.md)
- [.github/PULL_REQUEST_TEMPLATE.md](./.github/PULL_REQUEST_TEMPLATE.md)

## Execução local

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

## Ideias para contribuir

- corrigir bugs de edição e seleção
- melhorar suporte a SVG/DXF
- adicionar simulação mais fiel ao G-code
- ampliar o painel de máquina e jog
- melhorar documentação e integração com dispositivos reais

## Licença

Este projeto está licenciado sob a licença MIT. Veja o arquivo [LICENSE](./LICENSE).
