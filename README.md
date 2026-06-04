# Laser Studio

Laser Studio é um software open source de controle CNC laser para desktop, focado em edição vetorial, geração de G-code e conexão com máquinas reais.

> Este repositório foi preparado para a comunidade: contribuições, issues e pull requests são bem-vindos.

## O que é o Laser Studio

O objetivo do projeto é oferecer uma base de software livre para criadores e makers que usam cortadoras e gravadoras a laser. O app combina:

- editor vetorial básico com desenho, caminhos, textos e importação de SVG
- painel de propriedades e camadas
- geração de G-code para diferentes firmwares
- simulação de trajetória
- controle básico de máquina e jog

## Suporte a máquinas e firmwares

Atualmente o Laser Studio suporta:

- `GRBL`
- `Marlin`
- `Ruida`
- `Smoothieware`
- `ESP32 CNC`

O driver de máquina é projetado para suportar conexões via `serial` / `COM` e já prevê opções futuras de `wifi` e `ethernet`.

### Tipos de máquinas alvo

- cortadoras e gravadoras a laser hobby / semi-profissionais
- máquinas CNC com firmware compatível com G-code
- sistemas embarcados baseados em ESP32

## Recursos principais

- Edição de formas vetoriais: retângulos, linhas, círculos, textos, paths e Bézier
- Importação de SVG com preservação de traços e preenchimentos
- Geração de G-code com lógica de passes, velocidade, potência e preenchimento
- Simulação visual de trajetória do cabeçote
- Conexão de máquina com comandos de jog, home e stop
- Painel de máquina com status e posição atual

## Estrutura do repositório

- `apps/desktop`: aplicação Electron + Vite + React com interface de edição e preview.
- `packages/canvas-engine`: engine vetorial básica para gerenciamento de objetos.
- `packages/gcode-engine`: gerador de G-code com suporte a vários firmwares.
- `packages/machine-driver`: abstração inicial de conexão com máquinas CNC.
- `packages/shared-ui`: componentes UI compartilhados.
- `packages/shared-types`: tipos TypeScript centrais.

## Começando a contribuir

Veja também os arquivos de comunidade:

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

## Como contribuir

- envie issues para bugs e novos recursos
- abra pull requests com descrições claras
- mantenha as mudanças pequenas e focadas
- verifique o TypeScript e o comportamento antes de enviar

## Licença

Este projeto está licenciado sob a licença MIT. Veja o arquivo [LICENSE](./LICENSE).
