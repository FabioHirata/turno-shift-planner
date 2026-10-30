# Turno · Go + JavaScript shift planner

**Português · English · 日本語** · demonstração de produto com pessoas, negócio e escala fictícios.

Turno é um planejador semanal com regras de disponibilidade, cobertura e carga horária. O projeto combina **API REST em Go**, persistência em arquivo com escrita atômica e controle de concorrência, e uma interface JavaScript sem framework. A versão estática continua funcionando, sem fingir que possui um servidor.

## Dois modos, responsabilidades diferentes

| Modo | Execução | Fonte da verdade | Persistência |
|---|---|---|---|
| **Demonstração local** | Site estático / GitHub Pages | Regras JavaScript no navegador | `localStorage` |
| **API Go local** | Servidor Go + mesma interface | Go valida alterações e calcula relatórios | Arquivo JSON local, revisão otimista e gravação atômica |

O seletor mostra explicitamente o modo. O modo API usa `?mode=api` e requisições **same-origin**; não envia automaticamente a escala da demonstração ao servidor. Abrir esse modo no GitHub Pages mostra uma mensagem de indisponibilidade, não dados de um backend fictício.

## Executar a demonstração estática

Requisito: Node.js 20+. Sem `npm install` ou bibliotecas externas.

```sh
npm start
# http://127.0.0.1:4173
npm run check
npm run build
# dist/ contém apenas o frontend estático
```

Sirva por HTTP: `file://` pode bloquear módulos JavaScript. `server.js` é somente um servidor local de desenvolvimento. A pasta `dist/` pode ser servida por hospedagem estática; **ela não hospeda Go**.

## Executar com API Go

Requisitos: Go 1.22+ e Node.js 20+ para preparar o frontend. A API usa somente a biblioteca padrão de Go.

```sh
npm run build
cd backend
go test ./...
go test -race ./...
go run . --web ../dist
# Abra http://127.0.0.1:8080/?mode=api
```

Veja [backend/README.md](backend/README.md) para flags, caminhos de dados, endpoints e exemplos. Não publique esta API na internet: não há autenticação ou autorização de usuários. Não requer serviços pagos, banco externo, credenciais ou conta.

## Funcionalidades

- Escala fixa de 2–8 novembro de 2026, quatro pessoas fictícias e um turno por pessoa/dia.
- Turnos manhã (08–16h), tarde (16–00h) ou folga; restrições de disponibilidade **editáveis** por pessoa e dia.
- Cobertura por turno: atribuições indisponíveis não contam para a meta de uma pessoa.
- Alertas de disponibilidade e carga planejada superior a 40h; alertas orientam a simulação, não decidem aptidão ou contratação.
- Interface, validação, labels acessíveis e CSV em português, inglês e japonês; idioma persistido no navegador.
- Restauração com confirmação/cancelamento, tabela semântica, foco visível e avisos de alteração.
- CSV UTF-8 com BOM, escaping e proteção contra fórmulas. Exporta a escala atual mesmo quando há alertas.
- Modo API: revisões previnem sobrescrita silenciosa por duas janelas. Em conflito, a interface busca o estado atual e pede revisão antes de nova tentativa; não repete a escrita automaticamente.
- Falhas de rede têm timeout e reconciliação via leitura. Se a escrita não puder ser confirmada, a interface não afirma que ela foi desfeita.

## Roteiro de demonstração

1. O cenário inicial tem **12/14** turnos cobertos: Clara está indisponível na terça à tarde e domingo à tarde está vazio.
2. Mude Clara na terça para **Folga**, Bruno na terça para **Tarde** e Davi no domingo para **Tarde**.
3. Confira **14/14**, sem conflitos; recarregue para verificar persistência.
4. Na seção de disponibilidade, selecione pessoa/dia e edite turnos indisponíveis; a cobertura é recalculada.
5. No modo API, abra duas janelas e altere a mesma revisão para explorar o tratamento de conflito. Troque idioma, exporte CSV e restaure a demonstração.

## Arquitetura

```text
backend/
  main.go            Servidor Go: HTTP + arquivos estáticos
  domain.go          Regras e relatório derivados
  store.go           Persistência atômica e revisões
  http.go            Rotas REST e validação de requisições
  backend_test.go    Testes de HTTP, domínio e armazenamento
src/domain.js        Regras puras da demonstração estática e validação de estado
src/api.js           Cliente REST same-origin, timeout e validação de respostas
src/app.js           DOM, eventos e escolha explícita entre fonte local ou API
src/i18n.js          Catálogo PT/EN/JA e formatação
index.html           Estrutura semântica
style.css            Layout responsivo, sem fontes ou recursos externos
scripts/build.js     Copia somente os recursos estáticos para dist/
tests/               Testes Node: domínio, idiomas, API e eventos de interface
```

A duplicação limitada das regras em Go e JavaScript é intencional: permite uma demo estática independente. No modo API, a interface exibe **relatórios devolvidos por Go**, em vez de tratar um cálculo local como resposta do servidor. Os testes verificam ambos os lados e o contrato. O estado guarda atribuições e disponibilidade; totais são derivados.

A persistência Go é adequada a um **único processo local**, não a múltiplas instâncias distribuídas. O servidor valida entradas novamente: as restrições do navegador não são uma fronteira de segurança.

## Verificação

- `npm run check`: sintaxe e testes de domínio, catálogo trilíngue, escaping CSV, disponibilidade, armazenamento inválido, eventos de edição/reset, cliente HTTP, timeout e reconciliação de revisões.
- Os testes de eventos usam um adaptador DOM leve, não um motor de renderização.
- `cd backend && go test ./...`: testes de regras, HTTP real com `httptest`, persistência e erros.
- `go test -race ./...`: detecção de condições de corrida em testes de atualizações concorrentes.
- `npm run test:contract`: compila/inicia a API real, usa o cliente JavaScript por HTTP, compara Go/JS em 30 escalas determinísticas e verifica persistência após reinício. Requer o compilador `go` no PATH (ou variável `GO`).
- Resultados executados e limites de browser QA: [docs/QA.md](docs/QA.md).

## Limites deliberados

- Equipe e semana fixas; não é um sistema de RH completo, calendário multi-semana ou otimizador automático.
- Não trata pausas, descanso entre jornadas, feriados, banco de horas, adicional noturno ou regras jurídicas. O limite de 40h é **regra do exemplo, não conclusão legal**.
- Turno 16–00h pertence ao dia em que começa. Datas não representam controle de ponto.
- Sem login, autorização, auditoria de usuários, sincronização distribuída ou garantias de operação em produção.
- Dados locais sem criptografia. Não use dados pessoais reais/sensíveis. Limpar o navegador remove a demo; remover o arquivo da API remove seu estado persistido.
- Sem analytics, rastreamento, recursos externos, clientes ou resultados operacionais alegados.

## English

Turno is a **Go + JavaScript** portfolio project using fictional data. The Go REST API validates assignments and editable availability, derives coverage/conflicts, and persists state with atomic file writes and optimistic revisions. A separate static browser-demo mode remains usable on GitHub Pages; it never pretends to be a hosted backend. Build with `npm run build`, then run the Go server from `backend` and open `http://127.0.0.1:8080/?mode=api`. Portuguese, English and Japanese are supported. This is a bounded, unauthenticated local demo—not a production HR system or labor-law validator.

## 日本語

Turnoは**Go + JavaScript**で作成したポートフォリオ用のシフト管理デモです。人物・店舗・予定はすべて架空です。GoのREST APIがシフトと勤務条件を検証し、必要人数と問題点を計算します。状態はアトミックなファイル書き込みで保存し、リビジョンによって同時編集の上書きを防ぎます。GitHub Pagesで使えるブラウザ内デモは別モードで、バックエンドがあるように見せるものではありません。`npm run build` の後、`backend` でGoサーバーを起動し、`http://127.0.0.1:8080/?mode=api` を開いてください。ポルトガル語・英語・日本語に対応しています。認証のないローカル用デモであり、本番用の人事システムや労働法の適合性検証ツールではありません。
